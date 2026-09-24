import "server-only";
import { randomInt, randomUUID } from "node:crypto";
import { after } from "next/server";
import {
  createRoom,
  executeCommand,
  findPlayerIdByGuest,
  GameError,
  secureRandom,
  toPublicState,
  type Command,
  type GameEvent,
  type PlayerColor,
  type RoomState,
  type ServerRoomState,
  type GameSettings,
} from "@/game-engine";
import { generateRoomCode, isValidRoomCode, normalizeRoomCode } from "@/lib/shared/room-code";
import { analyticsFor } from "./analytics";
import { devToolsEnabled } from "./env";
import { getStore } from "./store";
import type { MatchSummary } from "./store/types";

/**
 * Server-authoritative command pipeline:
 *   load → run engine (server clock + CSPRNG) → version-checked atomic commit
 *   → on conflict reload and retry. Clients only ever submit intents.
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

function sideEffects(state: ServerRoomState, events: GameEvent[]) {
  const store = getStore();
  const analytics = analyticsFor(state, events);
  const completed = events.some((e) => e.type === "MATCH_COMPLETED");
  after(async () => {
    try {
      if (analytics.length) await store.recordAnalytics(analytics);
      if (completed && state.match?.result) await store.archiveMatch(summarize(state));
    } catch (err) {
      console.error("side effects failed", err);
    }
  });
}

function summarize(state: ServerRoomState): MatchSummary {
  const match = state.match!;
  return {
    matchId: match.id,
    roomId: state.roomId,
    code: state.code,
    number: match.number,
    settings: match.settings,
    players: state.players
      .filter((p) => match.playerIds.includes(p.id))
      .map(({ id, nickname, avatar, color, isBot }) => ({ id, nickname, avatar, color, isBot })),
    stats: match.stats,
    history: match.history,
    result: match.result!,
    startedAt: match.startedAt,
    endedAt: match.result!.endedAt,
  };
}

export async function createRoomForCaller(
  caller: Caller & { guestId: string },
  input: { nickname: string; avatar: string; color?: PlayerColor | null; settings?: Partial<GameSettings> },
) {
  const store = getStore();
  for (let attempt = 0; attempt < 8; attempt++) {
    const code = generateRoomCode((n) => randomInt(n));
    const now = Date.now();
    const created = createRoom(
      { roomId: randomUUID(), code, settings: input.settings, nickname: input.nickname, avatar: input.avatar, color: input.color, guestId: caller.guestId, userId: caller.userId },
      { now, rng: secureRandom, newId: randomUUID, guestId: caller.guestId, userId: caller.userId, devTools: devToolsEnabled(), isAdmin: false },
    );
    const res = await store.createRoom(created.state, created.events);
    if (res === "code_taken") continue;
    await store.touchPresence(created.state.roomId, { [created.hostId]: now });
    sideEffects(created.state, created.events);
    return { code, playerId: created.hostId, state: toPublicState(created.state), version: created.state.version };
  }
  throw new GameError("SERVER_ERROR", { reason: "code_generation" });
}

export interface CommandOutcome {
  ok: boolean;
  events: GameEvent[];
  version: number;
  me: string | null;
  data: Record<string, unknown>;
  error?: { code: string; params: Record<string, string | number> };
  duplicate?: boolean;
}

export async function runCommand(rawCode: string, caller: Caller, command: Command, commandId?: string): Promise<CommandOutcome> {
  const code = codeOrThrow(rawCode);
  const store = getStore();
  const devTools = devToolsEnabled();
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const state = await store.loadRoomByCode(code);
    if (!state) throw new GameError("ROOM_NOT_FOUND");
    const now = Date.now();
    const presence = await store.getPresence(state.roomId);
    const actorId = caller.guestId ? findPlayerIdByGuest(state, caller.guestId) : null;
    // Any authenticated request from a seated player is proof of life.
    if (actorId && command.type !== "LEAVE") presence[actorId] = now;

    const result = executeCommand(
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

    const me = caller.guestId ? findPlayerIdByGuest(result.state, caller.guestId) : null;
    if (!result.ok) {
      return { ok: false, events: result.events, version: result.state.version, me, data: {}, error: result.error };
    }
    return { ok: true, events: result.events, version: result.state.version, me, data: result.data, duplicate: result.duplicate };
  }
  throw new GameError("CONFLICT");
}

export interface RoomView {
  state: RoomState;
  me: string | null;
  spectator: boolean;
}

function canView(state: ServerRoomState, caller: Caller): { me: string | null; spectator: boolean } | null {
  const me = caller.guestId ? findPlayerIdByGuest(state, caller.guestId) : null;
  if (me) return { me, spectator: false };
  if (caller.isAdmin) return { me: null, spectator: true };
  if (caller.guestId && state.private.spectators.includes(caller.guestId)) return { me: null, spectator: true };
  return null;
}

export async function getRoomView(rawCode: string, caller: Caller): Promise<RoomView> {
  const state = await getStore().loadRoomByCode(codeOrThrow(rawCode));
  if (!state) throw new GameError("ROOM_NOT_FOUND");
  const access = canView(state, caller);
  if (!access) throw new GameError("NOT_A_PLAYER");
  return { state: toPublicState(state), ...access };
}

export async function getEventsSince(rawCode: string, caller: Caller, since: number) {
  const store = getStore();
  const state = await store.loadRoomByCode(codeOrThrow(rawCode));
  if (!state) throw new GameError("ROOM_NOT_FOUND");
  const access = canView(state, caller);
  if (!access) throw new GameError("NOT_A_PLAYER");
  if (since >= state.version) return { events: [], version: state.version };
  if (state.version - since > MAX_EVENTS_DELTA) return { reset: toPublicState(state), version: state.version, me: access.me };
  const events = await store.eventsSince(state.roomId, since, MAX_EVENTS_DELTA);
  return { events, version: state.version };
}

export interface RoomPreview {
  code: string;
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
    phase: state.phase,
    gameMode: state.settings.gameMode,
    maxPlayers: state.settings.maxPlayers,
    players: active.map((p) => ({ nickname: p.nickname, avatar: p.avatar, color: p.color, isHost: p.id === state.hostId, isBot: p.isBot })),
    takenColors: active.map((p) => p.color),
    isMember: !!(caller.guestId && findPlayerIdByGuest(state, caller.guestId)),
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
