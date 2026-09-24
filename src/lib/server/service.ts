import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { after } from "next/server";
import { GameError, secureRandom, type PlayerColor, type ServerRoomState as ShutServerState } from "@/game-engine";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "@/lib/shared/room-code";
import { analyticsFor } from "./analytics";
import { devToolsEnabled } from "./env";
import {
  createForGame,
  execute,
  findPlayerByGuest,
  gameModeOf,
  gameOf,
  parseCommand,
  personalView,
  toPublic,
  type AnyEvent,
  type AnyServerState,
  type GameId,
} from "./games";
import { getStore } from "./store";
import type { MatchSummary } from "./store/types";

/**
 * Server-authoritative command pipeline (any game):
 *   load → validate intent with the room's game → run engine (server clock +
 *   CSPRNG) → version-checked atomic commit → on conflict reload and retry.
 */

const MAX_ATTEMPTS = 6;
const MAX_EVENTS_DELTA = 400;

export interface Caller {
  guestId: string | null;
  userId?: string | null;
  isAdmin?: boolean;
}

function codeOrThrow(raw: string): string {
  const code = normalizeRoomCode(raw);
  if (!isValidRoomCode(code)) throw new GameError("ROOM_NOT_FOUND");
  return code;
}

function sideEffects(state: AnyServerState, events: AnyEvent[]) {
  const store = getStore();
  const analytics = analyticsFor(state, events);
  const shutCompleted = gameOf(state) === "shut10" && events.some((e) => e.type === "MATCH_COMPLETED");
  after(async () => {
    try {
      if (analytics.length) await store.recordAnalytics(analytics);
      if (shutCompleted && (state as ShutServerState).match?.result) await store.archiveMatch(summarize(state as ShutServerState));
    } catch (err) {
      console.error("side effects failed", err);
    }
  });
}

function summarize(state: ShutServerState): MatchSummary {
  const match = state.match!;
  return {
    matchId: match.id,
    roomId: state.roomId,
    code: state.code,
    number: match.number,
    settings: match.settings,
    players: state.players.filter((p) => match.playerIds.includes(p.id)).map(({ id, nickname, avatar, color, isBot }) => ({ id, nickname, avatar, color, isBot })),
    stats: match.stats,
    history: match.history,
    result: match.result!,
    startedAt: match.startedAt,
    endedAt: match.result!.endedAt,
  };
}

export async function createRoomForCaller(
  caller: Caller & { guestId: string },
  input: { game?: GameId; nickname: string; avatar: string; color?: PlayerColor | null; settings?: Record<string, unknown> },
) {
  const store = getStore();
  const game: GameId = input.game ?? "shut10";
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode((n) => randomInt(n));
    const now = Date.now();
    const created = createForGame(
      game,
      { roomId: randomUUID(), code, settings: input.settings, nickname: input.nickname, avatar: input.avatar, color: input.color, guestId: caller.guestId, userId: caller.userId },
      { now, rng: secureRandom, newId: randomUUID, guestId: caller.guestId, userId: caller.userId, devTools: devToolsEnabled(), isAdmin: false },
    );
    const res = await store.createRoom(created.state, created.events);
    if (res === "code_taken") continue;
    await store.touchPresence(created.state.roomId, { [created.hostId]: now });
    sideEffects(created.state, created.events);
    return { code, game, playerId: created.hostId, state: toPublic(created.state), version: created.state.version };
  }
  throw new GameError("SERVER_ERROR", { reason: "code_generation" });
}

export interface CommandOutcome {
  ok: boolean;
  events: AnyEvent[];
  version: number;
  me: string | null;
  data: Record<string, unknown>;
  error?: { code: string; params: Record<string, string | number> };
  duplicate?: boolean;
}

/** `rawCommand` is validated against the room's own game before it reaches an engine. */
export async function runCommand(rawCode: string, caller: Caller, rawCommand: unknown, commandId?: string): Promise<CommandOutcome> {
  const code = codeOrThrow(rawCode);
  const store = getStore();
  const devTools = devToolsEnabled();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const state = await store.loadRoomByCode(code);
    if (!state) throw new GameError("ROOM_NOT_FOUND");
    const command = parseCommand(gameOf(state), rawCommand);
    if (!command) throw new GameError("INVALID_COMMAND");
    const now = Date.now();
    const presence = await store.getPresence(state.roomId);
    const actorId = caller.guestId ? findPlayerByGuest(state, caller.guestId) : null;
    // Any authenticated request from a seated player is proof of life.
    if (actorId && command.type !== "LEAVE") presence[actorId] = now;

    const result = execute(
      state,
      command,
      { now, rng: secureRandom, newId: randomUUID, actorId, guestId: caller.guestId, userId: caller.userId, presence, devTools, isAdmin: !!caller.isAdmin },
      commandId,
    );

    const touches: Record<string, number> = { ...result.presence };
    if (actorId && command.type !== "LEAVE" && !(actorId in touches)) touches[actorId] = now;

    if (result.changed) {
      const committed = await store.commit(state.roomId, state.version, result.state, result.events);
      if (!committed) continue; // someone else committed first: reload and re-validate
      if (result.events.length) sideEffects(result.state, result.events);
    }
    if (Object.keys(touches).length) await store.touchPresence(state.roomId, touches);

    const me = caller.guestId ? findPlayerByGuest(result.state, caller.guestId) : null;
    if (!result.ok) return { ok: false, events: result.events, version: result.state.version, me, data: {}, error: result.error };
    return { ok: true, events: result.events, version: result.state.version, me, data: result.data ?? {}, duplicate: result.duplicate };
  }
  throw new GameError("CONFLICT");
}

function canView(state: AnyServerState, caller: Caller): { me: string | null; spectator: boolean } | null {
  const me = caller.guestId ? findPlayerByGuest(state, caller.guestId) : null;
  if (me) return { me, spectator: false };
  if (caller.isAdmin) return { me: null, spectator: true };
  if (caller.guestId && state.private.spectators.includes(caller.guestId)) return { me: null, spectator: true };
  return null;
}

export async function getRoomView(rawCode: string, caller: Caller) {
  const state = await getStore().loadRoomByCode(codeOrThrow(rawCode));
  if (!state) throw new GameError("ROOM_NOT_FOUND");
  const access = canView(state, caller);
  if (!access) throw new GameError("NOT_A_PLAYER");
  return { state: toPublic(state), game: gameOf(state), personal: personalView(state, access.me), ...access };
}

export async function getEventsSince(rawCode: string, caller: Caller, since: number) {
  const store = getStore();
  const state = await store.loadRoomByCode(codeOrThrow(rawCode));
  if (!state) throw new GameError("ROOM_NOT_FOUND");
  const access = canView(state, caller);
  if (!access) throw new GameError("NOT_A_PLAYER");
  if (since >= state.version) return { events: [], version: state.version };
  if (state.version - since > MAX_EVENTS_DELTA) return { reset: toPublic(state), personal: personalView(state, access.me), version: state.version, me: access.me };
  const events = await store.eventsSince(state.roomId, since, MAX_EVENTS_DELTA);
  return { events, version: state.version };
}

export interface RoomPreview {
  code: string;
  game: GameId;
  phase: string;
  gameMode: string;
  maxPlayers: number;
  players: Array<{ nickname: string; avatar: string; color: PlayerColor; isHost: boolean; isBot: boolean }>;
  takenColors: PlayerColor[];
  isMember: boolean;
  spectatorsAllowed: boolean;
  full: boolean;
}

export async function getRoomPreview(rawCode: string, caller: Caller): Promise<RoomPreview> {
  const state = await getStore().loadRoomByCode(codeOrThrow(rawCode));
  if (!state || state.phase === "FINISHED") throw new GameError("ROOM_NOT_FOUND");
  const active = state.players.filter((p) => p.connection !== "left");
  return {
    code: state.code,
    game: gameOf(state),
    phase: state.phase,
    gameMode: gameModeOf(state),
    maxPlayers: state.settings.maxPlayers,
    players: active.map((p) => ({ nickname: p.nickname, avatar: p.avatar, color: p.color, isHost: p.id === state.hostId, isBot: p.isBot })),
    takenColors: active.map((p) => p.color),
    isMember: !!(caller.guestId && findPlayerByGuest(state, caller.guestId)),
    spectatorsAllowed: state.settings.spectators,
    full: active.length >= state.settings.maxPlayers,
  };
}

export async function findMatch(matchId: string) {
  return getStore().findMatch(matchId);
}

export async function recordServerError(source: string, err: unknown, context: Record<string, unknown> = {}) {
  const message = err instanceof Error ? err.message : String(err);
  console.error(`[${source}]`, err);
  try {
    await getStore().recordError(source, message, context);
  } catch {
    // never throw from error reporting
  }
}
