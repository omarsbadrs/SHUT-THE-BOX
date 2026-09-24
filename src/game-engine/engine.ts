import { checkMove, getValidCombinations } from "./combinations";
import type { RandomSource } from "./dice";
import { isDieValue, rollDice } from "./dice";
import type { EventBody, GameEvent } from "./events";
import { isMatchOver, resolveMatch, statsAfterRound } from "./match";
import { applyEvent, emptyRoomState } from "./reducer";
import { isRoundOver, resolveRound } from "./round";
import {
  canUseOneDie,
  doublesGrantExtraTurn,
  HINTS_PER_ROUND_LIMITED,
  isTurnBased,
  MIN_PLAYERS,
  normalizeSettings,
  passesAfterEveryRoll,
  seatOf,
  TIMING,
} from "./rules";
import { calculateOpenTileScore } from "./scoring";
import { chooseDiceCount, chooseMove, rateMoves } from "./strategy";
import { getNextPlayer, makeTurnId, orderFromStarter } from "./turns";
import type {
  AutoReason,
  BlockReason,
  BotLevel,
  GameSettings,
  MatchEndReason,
  PersistedPhase,
  PlayerColor,
  PrivateState,
  RoomPlayer,
  RoomState,
  RoundEndReason,
  ServerRoomState,
} from "./types";
import { COLORS } from "./types";
import type { ErrorCode, ErrorParams } from "./validators";
import { fail, GameError, sanitizeAvatar, sanitizeNickname, validNickname } from "./validators";

// ───────────────────────────── Commands ─────────────────────────────

/** Client intents. The client never sends dice, scores, turn owners or tile state. */
export type Command =
  | { type: "JOIN"; nickname: string; avatar: string; color?: PlayerColor | null }
  | { type: "LEAVE" }
  | { type: "UPDATE_PROFILE"; nickname?: string; avatar?: string; color?: PlayerColor }
  | { type: "SET_READY"; ready: boolean }
  | { type: "UPDATE_SETTINGS"; settings: Partial<GameSettings> }
  | { type: "KICK"; playerId: string; ban?: boolean }
  | { type: "TRANSFER_HOST"; playerId: string }
  | { type: "ADD_BOT"; level: BotLevel }
  | { type: "START" }
  | { type: "ROLL"; diceCount?: 1 | 2 }
  | { type: "CLOSE_TILES"; turnId: string; tiles: number[] }
  | { type: "USE_HINT" }
  | { type: "NEXT_ROUND" }
  | { type: "PAUSE" }
  | { type: "RESUME" }
  | { type: "END_MATCH" }
  | { type: "REMATCH"; shuffleColors?: boolean }
  | { type: "BACK_TO_LOBBY" }
  | { type: "SPECTATE" }
  | { type: "TICK" }
  | { type: "CLOSE_ROOM" }
  | { type: "ADMIN_SET_TILES"; playerId: string; openTiles: number[] }
  | { type: "DEV_FORCE_DICE"; dice: Array<[number, number]> }
  | { type: "DEV_SET_TURN"; playerId: string }
  | { type: "DEV_SET_TILES"; playerId: string; openTiles: number[] }
  | { type: "DEV_BLOCK_PLAYER"; playerId: string }
  | { type: "DEV_SHUT_BOARD"; playerId: string }
  | { type: "DEV_NEXT_ROUND" }
  | { type: "DEV_SIMULATE_DISCONNECT"; playerId: string }
  | { type: "DEV_ADD_FAKE_PLAYERS"; count: number };

export type CommandType = Command["type"];

export interface CommandContext {
  now: number;
  rng: RandomSource;
  newId: () => string;
  /** Room player id of the requester, resolved by the server from the signed session. */
  actorId: string | null;
  guestId: string | null;
  userId?: string | null;
  /** Last heartbeat per player id (server clock, ms). */
  presence: Record<string, number>;
  devTools: boolean;
  isAdmin: boolean;
}

export type CommandResult =
  | {
      ok: true;
      state: ServerRoomState;
      events: GameEvent[];
      /** True when anything must be persisted (events, or server-private changes only). */
      changed: boolean;
      duplicate: boolean;
      data: Record<string, unknown>;
      presence: Record<string, number>;
    }
  | {
      ok: false;
      state: ServerRoomState;
      events: GameEvent[];
      changed: boolean;
      error: { code: ErrorCode; params: ErrorParams };
      presence: Record<string, number>;
    };

const COMMAND_MEMORY = 64;
const BOT_NAMES = ["Dicey", "Pip", "Tumble", "Lucky", "Boxer", "Hinge"];

// ───────────────────────────── Transaction ─────────────────────────────

class Tx {
  state: ServerRoomState;
  readonly events: GameEvent[] = [];
  readonly presence: Record<string, number> = {};
  constructor(
    state: ServerRoomState,
    readonly ctx: CommandContext,
  ) {
    this.state = state;
  }
  get now() {
    return this.ctx.now;
  }
  emit(body: EventBody): GameEvent {
    const e = { ...body, seq: this.state.version + 1, at: this.ctx.now } as GameEvent;
    this.state = applyEvent(this.state, e);
    this.events.push(e);
    return e;
  }
  priv(fn: (p: PrivateState) => void) {
    const p = structuredClone(this.state.private);
    fn(p);
    this.state = { ...this.state, private: p };
  }
  get settings(): GameSettings {
    return this.state.match?.settings ?? this.state.settings;
  }
  player(id: string | null | undefined): RoomPlayer | undefined {
    return id ? this.state.players.find((p) => p.id === id) : undefined;
  }
}

// ───────────────────────────── Public helpers ─────────────────────────────

export function emptyPrivate(): PrivateState {
  return { guests: {}, userIds: {}, bans: [], commandIds: [], spectators: [], forcedDice: [] };
}

export function toPublicState(s: ServerRoomState | RoomState): RoomState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { private: _private, ...pub } = s as ServerRoomState;
  return pub;
}

export function findPlayerIdByGuest(s: ServerRoomState, guestId: string): string | null {
  for (const [pid, gid] of Object.entries(s.private.guests)) {
    if (gid === guestId && s.players.some((p) => p.id === pid && p.connection !== "left")) return pid;
  }
  return null;
}

export interface CreateRoomParams {
  roomId: string;
  code: string;
  settings?: Partial<GameSettings>;
  nickname: string;
  avatar: string;
  color?: PlayerColor | null;
  guestId: string;
  userId?: string | null;
}

export function createRoom(params: CreateRoomParams, ctx: Omit<CommandContext, "actorId" | "presence">) {
  const nickname = sanitizeNickname(params.nickname);
  if (!validNickname(nickname)) throw new GameError("INVALID_NICKNAME");
  const initial: ServerRoomState = { ...emptyRoomState(), private: emptyPrivate() };
  const tx = new Tx(initial, { ...ctx, actorId: null, presence: {} });
  const hostId = ctx.newId();
  const color = params.color && COLORS.includes(params.color) ? params.color : "blue";
  tx.emit({
    type: "ROOM_CREATED",
    roomId: params.roomId,
    code: params.code,
    hostId,
    settings: normalizeSettings(params.settings),
    createdAt: ctx.now,
  });
  tx.emit({
    type: "PLAYER_JOINED",
    player: makePlayer(hostId, nickname, sanitizeAvatar(params.avatar), color, ctx.now, { ready: true }),
  });
  tx.priv((p) => {
    p.guests[hostId] = params.guestId;
    if (params.userId) p.userIds[hostId] = params.userId;
  });
  return { state: tx.state, events: tx.events, hostId };
}

function makePlayer(
  id: string,
  nickname: string,
  avatar: string,
  color: PlayerColor,
  now: number,
  opts: { ready?: boolean; bot?: BotLevel } = {},
): RoomPlayer {
  return {
    id,
    nickname,
    avatar,
    color,
    seat: seatOf(color),
    isReady: opts.ready ?? false,
    isBot: !!opts.bot,
    botLevel: opts.bot ?? null,
    connection: "online",
    joinedAt: now,
    connectedAt: now,
    disconnectedAt: null,
  };
}

// ───────────────────────────── Entry point ─────────────────────────────

export function executeCommand(state: ServerRoomState, command: Command, ctx: CommandContext, commandId?: string): CommandResult {
  if (commandId && state.private.commandIds.includes(commandId)) {
    return { ok: true, state, events: [], changed: false, duplicate: true, data: {}, presence: {} };
  }
  const tx = new Tx(state, ctx);
  advanceTime(tx);
  const afterTime = tx.state;
  const timeEvents = tx.events.length;
  try {
    const data = handle(tx, command) ?? {};
    if (commandId) {
      tx.priv((p) => {
        p.commandIds.push(commandId);
        if (p.commandIds.length > COMMAND_MEMORY) p.commandIds.splice(0, p.commandIds.length - COMMAND_MEMORY);
      });
    }
    const changed = tx.events.length > 0 || tx.state.private !== state.private;
    return { ok: true, state: tx.state, events: tx.events, changed, duplicate: false, data, presence: tx.presence };
  } catch (err) {
    if (err instanceof GameError) {
      // Command effects roll back; time-driven progress (timers, presence) is kept.
      return {
        ok: false,
        state: afterTime,
        events: tx.events.slice(0, timeEvents),
        changed: timeEvents > 0,
        error: { code: err.code, params: err.params },
        presence: {},
      };
    }
    throw err;
  }
}

function handle(tx: Tx, cmd: Command): Record<string, unknown> | void {
  if (tx.state.phase === "FINISHED" && cmd.type !== "TICK") fail("ROOM_CLOSED");
  switch (cmd.type) {
    case "TICK":
      return;
    case "JOIN":
      return join(tx, cmd);
    case "LEAVE":
      departure(tx, actor(tx).id, "left");
      return;
    case "UPDATE_PROFILE":
      return updateProfile(tx, cmd);
    case "SET_READY": {
      const me = actor(tx);
      lobbyOnly(tx);
      if (me.isReady !== cmd.ready) tx.emit({ type: "PLAYER_READY", playerId: me.id, ready: cmd.ready });
      return;
    }
    case "UPDATE_SETTINGS": {
      host(tx);
      lobbyOnly(tx);
      const next = normalizeSettings({ ...tx.state.settings, ...cmd.settings });
      if (next.maxPlayers < tx.state.players.length) fail("INVALID_COMMAND", { reason: "maxPlayers" });
      tx.emit({ type: "SETTINGS_UPDATED", settings: next });
      return;
    }
    case "KICK": {
      const me = host(tx);
      const target = tx.player(cmd.playerId);
      if (!target || target.connection === "left") fail("INVALID_COMMAND");
      if (target.id === me.id) fail("INVALID_COMMAND");
      if (cmd.ban) {
        const gid = tx.state.private.guests[target.id];
        if (gid) tx.priv((p) => void p.bans.push(gid));
      }
      departure(tx, target.id, "kicked");
      return;
    }
    case "TRANSFER_HOST": {
      const me = host(tx);
      const target = tx.player(cmd.playerId);
      if (!target || target.isBot || target.connection === "left" || target.id === me.id) fail("INVALID_COMMAND");
      tx.emit({ type: "HOST_CHANGED", hostId: target.id, previousHostId: me.id, reason: "transfer" });
      return;
    }
    case "ADD_BOT": {
      host(tx);
      lobbyOnly(tx);
      addBots(tx, 1, cmd.level);
      return;
    }
    case "START":
      return start(tx);
    case "ROLL":
      return roll(tx, cmd);
    case "CLOSE_TILES":
      return closeCmd(tx, cmd);
    case "USE_HINT":
      return hint(tx);
    case "NEXT_ROUND": {
      host(tx);
      if (tx.state.phase !== "ROUND_RESULTS") fail("WRONG_PHASE");
      if (tx.state.paused) fail("PAUSED");
      startNextRound(tx);
      return;
    }
    case "PAUSE": {
      const me = host(tx);
      if (!tx.state.match || tx.state.match.result) fail("WRONG_PHASE");
      if (!tx.state.paused) tx.emit({ type: "MATCH_PAUSED", by: me.id });
      return;
    }
    case "RESUME": {
      const me = host(tx);
      if (tx.state.paused) tx.emit({ type: "MATCH_RESUMED", by: me.id, shiftMs: Math.max(0, tx.now - tx.state.paused.at) });
      return;
    }
    case "END_MATCH": {
      host(tx);
      if (!tx.state.match || tx.state.match.result) fail("WRONG_PHASE");
      finishMatch(tx, "host_ended");
      return;
    }
    case "REMATCH":
      return rematch(tx, !!cmd.shuffleColors);
    case "BACK_TO_LOBBY": {
      host(tx);
      if (tx.state.phase !== "MATCH_RESULTS") fail("WRONG_PHASE");
      tx.emit({ type: "RETURNED_TO_LOBBY" });
      return;
    }
    case "SPECTATE":
      return spectate(tx);
    case "CLOSE_ROOM": {
      if (!tx.ctx.isAdmin) host(tx);
      tx.emit({ type: "ROOM_CLOSED", reason: tx.ctx.isAdmin ? "admin" : "host" });
      return;
    }
    case "ADMIN_SET_TILES": {
      if (!tx.ctx.isAdmin) fail("FORBIDDEN");
      correctTiles(tx, cmd.playerId, cmd.openTiles, "admin");
      return;
    }
    default:
      return dev(tx, cmd);
  }
}

// ───────────────────────────── Guards ─────────────────────────────

function actor(tx: Tx): RoomPlayer {
  const p = tx.player(tx.ctx.actorId);
  if (!p || p.connection === "left") fail("NOT_A_PLAYER");
  return p;
}

function host(tx: Tx): RoomPlayer {
  const p = actor(tx);
  if (tx.state.hostId !== p.id) fail("NOT_HOST");
  return p;
}

function lobbyOnly(tx: Tx) {
  if (tx.state.phase !== "ROOM_LOBBY") fail("GAME_ALREADY_STARTED");
}

function inPlay(tx: Tx) {
  const { match } = tx.state;
  const round = match?.round;
  if (!match || !round || round.result || match.result) fail("WRONG_PHASE");
  if (tx.state.phase === "STARTING" || tx.state.phase === "ROUND_SETUP") fail("TOO_EARLY");
  if (tx.state.phase !== "PLAYER_TURN" && tx.state.phase !== "AWAITING_TILE_SELECTION") fail("WRONG_PHASE");
  if (tx.state.paused) fail("PAUSED");
  return { match, round };
}

// ───────────────────────────── Lobby ─────────────────────────────

function freeColors(tx: Tx, exceptPlayerId?: string): PlayerColor[] {
  const taken = new Set(tx.state.players.filter((p) => p.id !== exceptPlayerId && p.connection !== "left").map((p) => p.color));
  return COLORS.filter((c) => !taken.has(c));
}

function nicknameTaken(tx: Tx, nick: string, exceptPlayerId?: string) {
  const n = nick.toLocaleLowerCase();
  return tx.state.players.some((p) => p.id !== exceptPlayerId && p.connection !== "left" && p.nickname.toLocaleLowerCase() === n);
}

function join(tx: Tx, cmd: Extract<Command, { type: "JOIN" }>) {
  const guestId = tx.ctx.guestId;
  if (!guestId) fail("FORBIDDEN");
  if (tx.state.private.bans.includes(guestId)) fail("BANNED");
  const existing = findPlayerIdByGuest(tx.state, guestId);
  if (existing) {
    // Reconnect: seat, color, board, score and turn are all restored from server state.
    tx.presence[existing] = tx.now;
    const p = tx.player(existing)!;
    if (p.connection !== "online") tx.emit({ type: "PLAYER_CONNECTION", playerId: existing, status: "online" });
    return { playerId: existing, rejoined: true };
  }
  lobbyOnly(tx);
  if (tx.state.players.length >= tx.state.settings.maxPlayers) fail("ROOM_FULL");
  const nickname = sanitizeNickname(cmd.nickname);
  if (!validNickname(nickname)) fail("INVALID_NICKNAME");
  if (nicknameTaken(tx, nickname)) fail("NICKNAME_TAKEN");
  const free = freeColors(tx);
  if (free.length === 0) fail("ROOM_FULL");
  const color = cmd.color && free.includes(cmd.color) ? cmd.color : free[tx.ctx.rng.int(0, free.length - 1)];
  const id = tx.ctx.newId();
  tx.emit({ type: "PLAYER_JOINED", player: makePlayer(id, nickname, sanitizeAvatar(cmd.avatar), color, tx.now) });
  tx.priv((p) => {
    p.guests[id] = guestId;
    if (tx.ctx.userId) p.userIds[id] = tx.ctx.userId;
    p.spectators = p.spectators.filter((g) => g !== guestId);
  });
  tx.presence[id] = tx.now;
  return { playerId: id, rejoined: false };
}

function updateProfile(tx: Tx, cmd: Extract<Command, { type: "UPDATE_PROFILE" }>) {
  const me = actor(tx);
  lobbyOnly(tx);
  const patch: { nickname?: string; avatar?: string; color?: PlayerColor } = {};
  if (cmd.nickname !== undefined) {
    const nick = sanitizeNickname(cmd.nickname);
    if (!validNickname(nick)) fail("INVALID_NICKNAME");
    if (nicknameTaken(tx, nick, me.id)) fail("NICKNAME_TAKEN");
    if (nick !== me.nickname) patch.nickname = nick;
  }
  if (cmd.avatar !== undefined) {
    const av = sanitizeAvatar(cmd.avatar);
    if (av !== me.avatar) patch.avatar = av;
  }
  if (cmd.color !== undefined && cmd.color !== me.color) {
    if (!freeColors(tx, me.id).includes(cmd.color)) fail("COLOR_TAKEN");
    patch.color = cmd.color;
  }
  if (Object.keys(patch).length) tx.emit({ type: "PLAYER_UPDATED", playerId: me.id, ...patch });
}

function addBots(tx: Tx, count: number, level: BotLevel) {
  for (let i = 0; i < count; i++) {
    if (tx.state.players.length >= tx.state.settings.maxPlayers) fail("ROOM_FULL");
    const free = freeColors(tx);
    const name = BOT_NAMES.find((n) => !nicknameTaken(tx, n)) ?? `Bot ${tx.state.players.length + 1}`;
    tx.emit({
      type: "PLAYER_JOINED",
      player: makePlayer(tx.ctx.newId(), name, "🤖", free[0], tx.now, { ready: true, bot: level }),
    });
  }
}

function spectate(tx: Tx) {
  const guestId = tx.ctx.guestId;
  if (!guestId) fail("FORBIDDEN");
  if (findPlayerIdByGuest(tx.state, guestId)) return { spectator: false };
  if (!tx.state.settings.spectators) fail("SPECTATORS_DISABLED");
  if (tx.state.private.bans.includes(guestId)) fail("BANNED");
  if (!tx.state.private.spectators.includes(guestId)) {
    tx.priv((p) => void p.spectators.push(guestId));
    tx.emit({ type: "SPECTATOR_JOINED", count: tx.state.private.spectators.length });
  }
  return { spectator: true };
}

function humans(tx: Tx) {
  return tx.state.players.filter((p) => !p.isBot && p.connection !== "left");
}

function migrateHost(tx: Tx, reason: "migration" | "left") {
  const previous = tx.state.hostId;
  const candidates = humans(tx)
    .filter((p) => p.id !== previous)
    .sort((a, b) => {
      const rank = (p: RoomPlayer) => (p.connection === "online" ? 0 : p.connection === "reconnecting" ? 1 : 2);
      return rank(a) - rank(b) || a.connectedAt - b.connectedAt || a.joinedAt - b.joinedAt;
    });
  const next = candidates[0];
  if (!next) return false;
  if (reason === "migration" && next.connection !== "online") return false;
  tx.emit({ type: "HOST_CHANGED", hostId: next.id, previousHostId: previous, reason });
  return true;
}

/** Player leaves or is removed. In a match their board freezes and play continues. */
function departure(tx: Tx, playerId: string, reason: "left" | "kicked" | "timeout") {
  const wasHost = tx.state.hostId === playerId;
  tx.emit({ type: "PLAYER_LEFT", playerId, reason });

  const { match } = tx.state;
  const round = match?.round;
  if (match && !match.result && round && !round.result) {
    const p = round.players[playerId];
    if (p && p.status === "active") blockPlayer(tx, playerId, "left");
    else settleRound(tx);
  }
  const m = tx.state.match;
  if (m && !m.result) {
    const remaining = m.playerIds.filter((id) => tx.player(id)?.connection !== "left");
    if (remaining.length < MIN_PLAYERS) {
      const r = m.round;
      if (r && !r.result) finishRound(tx, "forfeit");
      if (!tx.state.match?.result) finishMatch(tx, "insufficient_players");
    }
  }
  if (wasHost) migrateHost(tx, "left");
  if (humans(tx).length === 0 && tx.state.phase !== "FINISHED") tx.emit({ type: "ROOM_CLOSED", reason: "empty" });
}

// ───────────────────────────── Match flow ─────────────────────────────

function start(tx: Tx) {
  host(tx);
  lobbyOnly(tx);
  const players = tx.state.players.filter((p) => p.connection !== "left");
  if (players.length < MIN_PLAYERS) fail("NOT_ENOUGH_PLAYERS", { min: MIN_PLAYERS });
  if (players.some((p) => !p.isReady)) fail("NOT_ALL_READY");
  startMatch(tx);
}

function startMatch(tx: Tx) {
  const players = tx.state.players.filter((p) => p.connection !== "left");
  const phaseEndsAt = tx.now + TIMING.matchIntroMs;
  tx.emit({
    type: "MATCH_STARTED",
    matchId: tx.ctx.newId(),
    number: tx.state.matchCount + 1,
    settings: tx.state.settings,
    playerIds: players.map((p) => p.id),
    phaseEndsAt,
  });
  startRound(tx, 1, "STARTING", phaseEndsAt);
}

function startRound(tx: Tx, number: number, phase: "STARTING" | "ROUND_SETUP", phaseEndsAt: number) {
  const match = tx.state.match!;
  const seatOrder = tx.state.players.filter((p) => match.playerIds.includes(p.id)).map((p) => p.id);
  const outIds = seatOrder.filter((id) => {
    const c = tx.player(id)?.connection;
    return c === "left" || c === "offline";
  });
  const available = seatOrder.filter((id) => !outIds.includes(id));
  const pool = available.length ? available : seatOrder;
  let starterId: string;
  const previous = match.round?.starterId ?? null;
  if (number === 1 || match.settings.starterRule === "random" || previous === null) {
    starterId = pool[tx.ctx.rng.int(0, pool.length - 1)];
  } else {
    starterId = getNextPlayer(seatOrder, previous, (id) => pool.includes(id)) ?? pool[0];
  }
  tx.emit({
    type: "ROUND_STARTED",
    roundId: tx.ctx.newId(),
    number,
    starterId,
    order: orderFromStarter(seatOrder, starterId),
    outIds,
    phase,
    phaseEndsAt,
  });
}

function startNextRound(tx: Tx) {
  const match = tx.state.match;
  if (!match || match.result) fail("WRONG_PHASE");
  startRound(tx, match.roundsPlayed + 1, "ROUND_SETUP", tx.now + TIMING.roundSetupMs);
}

function rollDeadline(tx: Tx, from: number): number | null {
  return tx.settings.rollTimer ? from + tx.settings.rollTimer * 1000 : null;
}

function beginTurns(tx: Tx) {
  const round = tx.state.match!.round!;
  const startedAt = tx.state.phaseEndsAt ?? tx.now;
  const deadlineAt = rollDeadline(tx, startedAt);
  if (!isTurnBased(tx.settings.gameMode)) {
    tx.emit({ type: "TURN_STARTED", playerId: null, turnNumber: 1, startedAt, deadlineAt, reason: "first" });
    settleRound(tx);
    return;
  }
  const active = (id: string) => round.players[id]?.status === "active";
  const first = active(round.starterId) ? round.starterId : getNextPlayer(round.order, round.starterId, active);
  if (!first) {
    tx.emit({ type: "TURN_STARTED", playerId: round.starterId, turnNumber: 1, startedAt, deadlineAt: null, reason: "first" });
    settleRound(tx);
    return;
  }
  tx.emit({ type: "TURN_STARTED", playerId: first, turnNumber: 1, startedAt, deadlineAt, reason: "first" });
}

/** Ends the round if someone shut the box or nobody can move. Returns true if it ended. */
function settleRound(tx: Tx): boolean {
  const round = tx.state.match?.round;
  if (!round || round.result) return false;
  const over = isRoundOver(round);
  if (!over) return false;
  finishRound(tx, over);
  return true;
}

function finishRound(tx: Tx, reason: RoundEndReason) {
  const match = tx.state.match!;
  const round = match.round!;
  const leftIds = new Set(match.playerIds.filter((id) => tx.player(id)?.connection === "left"));
  const result = resolveRound(round, reason, leftIds, match.settings.tieBreak, tx.ctx.rng, tx.now);
  const stats = statsAfterRound(match.stats, result);
  const remaining = match.playerIds.length - leftIds.size;
  const over = reason === "forfeit" || remaining < MIN_PLAYERS || isMatchOver({ roundsPlayed: match.roundsPlayed + 1, stats }, match.settings);
  tx.emit({ type: "ROUND_COMPLETED", result, phaseEndsAt: over ? null : tx.now + TIMING.intermissionMs });
  tx.emit({ type: "SCORE_UPDATED", stats });
  if (over) finishMatch(tx, remaining < MIN_PLAYERS ? "insufficient_players" : "completed");
}

function finishMatch(tx: Tx, reason: MatchEndReason) {
  const match = tx.state.match!;
  const leftIds = new Set(match.playerIds.filter((id) => tx.player(id)?.connection === "left"));
  tx.emit({ type: "MATCH_COMPLETED", result: resolveMatch(match, match.settings, leftIds, reason, tx.now) });
}

function rematch(tx: Tx, shuffle: boolean) {
  host(tx);
  if (tx.state.phase !== "MATCH_RESULTS") fail("WRONG_PHASE");
  const players = tx.state.players.filter((p) => p.connection !== "left");
  let colors: Record<string, PlayerColor> | null = null;
  if (shuffle) {
    const pool = [...COLORS];
    for (let i = pool.length - 1; i > 0; i--) {
      const j = tx.ctx.rng.int(0, i);
      [pool[i], pool[j]] = [pool[j], pool[i]];
    }
    colors = {};
    players.forEach((p, i) => (colors![p.id] = pool[i]));
  }
  tx.emit({ type: "REMATCH_STARTED", colors });
  if (tx.state.players.length >= MIN_PLAYERS) startMatch(tx);
  else tx.emit({ type: "RETURNED_TO_LOBBY" });
}

// ───────────────────────────── Turns ─────────────────────────────

function roll(tx: Tx, cmd: Extract<Command, { type: "ROLL" }>) {
  const me = actor(tx);
  const { round } = inPlay(tx);
  const p = round.players[me.id];
  if (!p || p.status !== "active") fail("NOT_YOUR_TURN");
  if (isTurnBased(tx.settings.gameMode)) {
    if (round.currentPlayerId !== me.id) fail("NOT_YOUR_TURN");
  }
  if (p.pending) fail("ALREADY_ROLLED");
  const diceCount = cmd.diceCount ?? 2;
  if (diceCount === 1 && !canUseOneDie(p.openTiles, tx.settings)) fail("ONE_DIE_UNAVAILABLE");
  doRoll(tx, me.id, diceCount, null);
  const pending = tx.state.match?.round?.players[me.id]?.pending;
  return { turnId: pending?.turnId ?? null };
}

function doRoll(tx: Tx, playerId: string, diceCount: 1 | 2, auto: AutoReason | null) {
  const match = tx.state.match!;
  const round = match.round!;
  const p = round.players[playerId];
  let dice = rollDice(tx.ctx.rng, diceCount);
  const forced = tx.state.private.forcedDice[0];
  if (forced && tx.ctx.devTools) {
    tx.priv((pv) => void pv.forcedDice.shift());
    const d2 = diceCount === 2 ? forced[1] : null;
    dice = { die1: forced[0], die2: d2, total: forced[0] + (d2 ?? 0), isDouble: d2 !== null && forced[0] === d2, diceCount };
  }
  const validCount = getValidCombinations(p.openTiles, dice.total).length;
  const turnId = makeTurnId(match.id, round.number, round.turnCounter + 1);
  const moveTimer = tx.settings.moveTimer;
  tx.emit({
    type: "DICE_ROLLED",
    playerId,
    turnId,
    ...dice,
    validCount,
    deadlineAt: validCount > 0 && moveTimer ? tx.now + moveTimer * 1000 : null,
    auto,
  });
  if (validCount === 0) blockPlayer(tx, playerId, "no_move");
}

function closeCmd(tx: Tx, cmd: Extract<Command, { type: "CLOSE_TILES" }>) {
  const me = actor(tx);
  const { round } = inPlay(tx);
  const p = round.players[me.id];
  if (!p) fail("NOT_A_PLAYER");
  if (isTurnBased(tx.settings.gameMode) && round.currentPlayerId !== me.id) fail("NOT_YOUR_TURN");
  if (!p.pending) fail(p.last?.turnId === cmd.turnId ? "STALE_TURN" : "NOT_ROLLED");
  if (p.pending.turnId !== cmd.turnId) fail("STALE_TURN");
  const check = checkMove(p.openTiles, p.pending.total, cmd.tiles);
  if (!check.ok) {
    fail(check.code, {
      total: p.pending.total,
      ...(check.tile !== undefined ? { tile: check.tile } : {}),
      ...(check.sum !== undefined ? { sum: check.sum } : {}),
    });
  }
  doClose(tx, me.id, check.tiles, null);
}

function doClose(tx: Tx, playerId: string, tiles: number[], auto: AutoReason | null) {
  const round = tx.state.match!.round!;
  const wasDouble = round.players[playerId].pending?.isDouble ?? false;
  const race = !isTurnBased(tx.settings.gameMode);
  tx.emit({
    type: "TILES_CLOSED",
    playerId,
    turnId: round.players[playerId].pending!.turnId,
    tiles,
    auto,
    nextDeadlineAt: race ? rollDeadline(tx, tx.now) : null,
  });
  const after = tx.state.match!.round!.players[playerId];
  if (after.openTiles.length === 0) {
    tx.emit({ type: "PLAYER_SHUT_BOX", playerId });
    settleRound(tx);
    return;
  }
  if (!race) advanceTurn(tx, wasDouble && doublesGrantExtraTurn(tx.settings));
}

function blockPlayer(tx: Tx, playerId: string, reason: BlockReason) {
  const round = tx.state.match!.round!;
  const wasCurrent = round.currentPlayerId === playerId;
  const p = round.players[playerId];
  tx.emit({ type: "PLAYER_BLOCKED", playerId, score: calculateOpenTileScore(p.openTiles), reason });
  const inTurns = tx.state.phase === "PLAYER_TURN" || tx.state.phase === "AWAITING_TILE_SELECTION";
  if (isTurnBased(tx.settings.gameMode) && wasCurrent && inTurns) advanceTurn(tx, false);
  else settleRound(tx);
}

/** Face-Off: dice pass after every roll. Classic: same player continues until blocked. */
function advanceTurn(tx: Tx, extraTurn: boolean) {
  if (settleRound(tx)) return;
  const round = tx.state.match!.round!;
  const cur = round.currentPlayerId;
  const curActive = !!cur && round.players[cur]?.status === "active";
  const deadlineAt = rollDeadline(tx, tx.now);
  const turnNumber = round.turnNumber + 1;
  if (cur && curActive && extraTurn) {
    tx.emit({ type: "EXTRA_TURN", playerId: cur });
    tx.emit({ type: "TURN_STARTED", playerId: cur, turnNumber, startedAt: tx.now, deadlineAt, reason: "extra" });
    return;
  }
  if (cur && curActive && !passesAfterEveryRoll(tx.settings.gameMode)) {
    tx.emit({ type: "TURN_STARTED", playerId: cur, turnNumber, startedAt: tx.now, deadlineAt, reason: "continue" });
    return;
  }
  const next = getNextPlayer(round.order, cur, (id) => round.players[id]?.status === "active");
  if (!next) {
    settleRound(tx);
    return;
  }
  if (next === cur) {
    tx.emit({ type: "TURN_STARTED", playerId: cur, turnNumber, startedAt: tx.now, deadlineAt, reason: "continue" });
  } else {
    tx.emit({ type: "TURN_CHANGED", from: cur, playerId: next, turnNumber, startedAt: tx.now, deadlineAt });
  }
}

function hint(tx: Tx) {
  const me = actor(tx);
  const { round } = inPlay(tx);
  const p = round.players[me.id];
  if (!p?.pending) fail("NOT_ROLLED");
  const mode = tx.settings.hints;
  if (mode === "off") fail("HINTS_UNAVAILABLE");
  if (mode === "limited" && p.hintsUsed >= HINTS_PER_ROUND_LIMITED) fail("HINTS_UNAVAILABLE", { limit: HINTS_PER_ROUND_LIMITED });
  const best = rateMoves(p.openTiles, p.pending.total, tx.settings)[0];
  if (!best) fail("HINTS_UNAVAILABLE");
  tx.emit({ type: "HINT_USED", playerId: me.id, tiles: best.tiles });
  return { tiles: best.tiles };
}

// ───────────────────────────── Time ─────────────────────────────

/**
 * Lazy server clock. Runs before every command (and on TICK/heartbeat):
 * presence transitions, host migration, countdowns, timers, disconnect rules
 * and bot moves. All deadlines are server timestamps.
 */
function advanceTime(tx: Tx) {
  if (tx.state.phase === "FINISHED") return;
  presencePass(tx);
  if (phaseOf(tx) === "FINISHED" || tx.state.paused) return;
  for (let i = 0; i < 48; i++) {
    if (!timeStep(tx)) break;
  }
}

/** Reads the phase without TypeScript narrowing (emit() mutates it). */
function phaseOf(tx: Tx): PersistedPhase {
  return tx.state.phase;
}

function presencePass(tx: Tx) {
  const grace = tx.settings.disconnectGraceSeconds * 1000;
  for (const p of [...tx.state.players]) {
    if (p.isBot || p.connection === "left") continue;
    const last = Math.max(tx.ctx.presence[p.id] ?? 0, tx.presence[p.id] ?? 0) || p.connectedAt;
    const idle = tx.now - last;
    let status = p.connection;
    if (idle <= TIMING.reconnectingAfterMs) status = "online";
    else if (idle <= grace) status = p.connection === "offline" ? "offline" : "reconnecting";
    else status = "offline";
    if (status !== p.connection) tx.emit({ type: "PLAYER_CONNECTION", playerId: p.id, status });
  }
  if (tx.state.phase === "ROOM_LOBBY") {
    for (const p of [...tx.state.players]) {
      if (!p.isBot && p.connection === "offline") departure(tx, p.id, "timeout");
      if (phaseOf(tx) === "FINISHED") return;
    }
  }
  const h = tx.player(tx.state.hostId);
  if (!h || h.connection === "offline" || h.connection === "left") migrateHost(tx, "migration");
}

function timeStep(tx: Tx): boolean {
  const s = tx.state;
  const now = tx.now;
  if ((s.phase === "STARTING" || s.phase === "ROUND_SETUP") && s.phaseEndsAt !== null && now >= s.phaseEndsAt) {
    beginTurns(tx);
    return true;
  }
  if (s.phase === "ROUND_RESULTS" && s.phaseEndsAt !== null && now >= s.phaseEndsAt) {
    startNextRound(tx);
    return true;
  }
  if (s.phase === "PLAYER_TURN" || s.phase === "AWAITING_TILE_SELECTION") return roundStep(tx);
  return false;
}

function roundStep(tx: Tx): boolean {
  const round = tx.state.match?.round;
  if (!round || round.result) return false;
  for (const id of round.order) {
    const p = round.players[id];
    const c = tx.player(id)?.connection;
    if (p.status === "active" && (c === "offline" || c === "left")) {
      blockPlayer(tx, id, "disconnect");
      return true;
    }
  }
  if (isTurnBased(tx.settings.gameMode)) {
    return round.currentPlayerId ? actFor(tx, round.currentPlayerId) : false;
  }
  for (const id of round.order) if (actFor(tx, id)) return true;
  return false;
}

type DueKind = "bot" | "disconnect" | "timer";

/** What is due for this player and when (shared by the server clock and client tick scheduling). */
function dueFor(state: RoomState, playerId: string, now: number): { at: number; kind: DueKind } | null {
  const match = state.match;
  const round = match?.round;
  if (!match || !round) return null;
  const settings = match.settings;
  const p = round.players[playerId];
  const player = state.players.find((x) => x.id === playerId);
  if (!p || !player || p.status !== "active") return null;
  if (player.isBot) {
    const at = p.pending ? p.pending.rolledAt + TIMING.botMoveDelayMs : (p.turnStartedAt ?? now) + TIMING.botRollDelayMs;
    return { at, kind: "bot" };
  }
  if (player.connection !== "online") {
    const turnBased = isTurnBased(settings.gameMode);
    if (turnBased && passesAfterEveryRoll(settings.gameMode) && settings.disconnectRule !== "block") {
      const next = getNextPlayer(round.order, playerId, (id) => round.players[id]?.status === "active");
      if (next === playerId) return null; // lone player: wait for grace expiry instead of skip-looping
    }
    if (settings.disconnectRule === "wait") {
      const waitStart = Math.max(player.disconnectedAt ?? now, p.turnStartedAt ?? 0);
      return { at: waitStart + TIMING.disconnectWaitMs, kind: "disconnect" };
    }
    return { at: now, kind: "disconnect" };
  }
  if (p.deadlineAt !== null) return { at: p.deadlineAt, kind: "timer" };
  return null;
}

function actFor(tx: Tx, playerId: string): boolean {
  const due = dueFor(tx.state, playerId, tx.now);
  if (!due || tx.now < due.at) return false;
  const settings = tx.settings;
  const round = tx.state.match!.round!;
  const p = round.players[playerId];
  const player = tx.player(playerId)!;
  switch (due.kind) {
    case "bot": {
      const level = player.botLevel ?? "normal";
      if (!p.pending) {
        doRoll(tx, playerId, chooseDiceCount(level, p.openTiles, settings), "bot");
      } else {
        const tiles = chooseMove(level, p.openTiles, p.pending.total, settings, tx.ctx.rng);
        if (tiles) doClose(tx, playerId, tiles, "bot");
        else blockPlayer(tx, playerId, "no_move");
      }
      return true;
    }
    case "disconnect": {
      const skipAllowed =
        settings.disconnectRule !== "block" && isTurnBased(settings.gameMode) && passesAfterEveryRoll(settings.gameMode);
      if (skipAllowed) {
        tx.emit({ type: "TURN_SKIPPED", playerId, reason: "disconnect" });
        advanceTurn(tx, false);
      } else {
        blockPlayer(tx, playerId, "disconnect");
      }
      return true;
    }
    case "timer": {
      if (p.pending) {
        const tiles = chooseMove("normal", p.openTiles, p.pending.total, settings, tx.ctx.rng);
        if (tiles) doClose(tx, playerId, tiles, "timeout");
        else blockPlayer(tx, playerId, "timeout");
      } else {
        doRoll(tx, playerId, 2, "timeout");
      }
      return true;
    }
  }
}

/**
 * Earliest server time at which a TICK would change something. Clients use
 * this to schedule a tick; presence transitions are driven by heartbeats.
 */
export function nextWakeAt(state: RoomState, now: number): number | null {
  if (state.paused || state.phase === "FINISHED") return null;
  if (state.phase === "STARTING" || state.phase === "ROUND_SETUP" || state.phase === "ROUND_RESULTS") return state.phaseEndsAt;
  if (state.phase !== "PLAYER_TURN" && state.phase !== "AWAITING_TILE_SELECTION") return null;
  const round = state.match?.round;
  if (!round || round.result) return null;
  const ids = isTurnBased(state.match!.settings.gameMode) ? (round.currentPlayerId ? [round.currentPlayerId] : []) : round.order;
  let best: number | null = null;
  for (const id of ids) {
    const d = dueFor(state, id, now);
    if (d && (best === null || d.at < best)) best = d.at;
  }
  return best;
}

// ───────────────────────────── Corrections & dev tools ─────────────────────────────

function correctTiles(tx: Tx, playerId: string, openTiles: number[], by: "admin" | "dev") {
  const round = tx.state.match?.round;
  if (!round || round.result || !round.players[playerId]) fail("WRONG_PHASE");
  const clean = [...new Set(openTiles)].filter((t) => Number.isInteger(t) && t >= 1 && t <= 10);
  tx.emit({ type: "TILES_CORRECTED", playerId, openTiles: clean, by });
  if (clean.length === 0 && round.players[playerId].status === "active") {
    tx.emit({ type: "PLAYER_SHUT_BOX", playerId });
    settleRound(tx);
  }
}

function dev(tx: Tx, cmd: Command) {
  if (!tx.ctx.devTools) fail("DEV_TOOLS_DISABLED");
  switch (cmd.type) {
    case "DEV_FORCE_DICE": {
      const dice = cmd.dice.filter((d) => isDieValue(d[0]) && isDieValue(d[1]));
      tx.priv((p) => void (p.forcedDice = dice.map((d) => [d[0], d[1]] as [number, number])));
      return;
    }
    case "DEV_SET_TURN": {
      const { round } = inPlay(tx);
      if (!isTurnBased(tx.settings.gameMode)) fail("WRONG_PHASE");
      if (round.players[cmd.playerId]?.status !== "active") fail("INVALID_COMMAND");
      const cur = round.currentPlayerId;
      if (cur && round.players[cur]?.pending) tx.emit({ type: "TURN_SKIPPED", playerId: cur, reason: "dev" });
      tx.emit({
        type: "TURN_CHANGED",
        from: cur,
        playerId: cmd.playerId,
        turnNumber: round.turnNumber + 1,
        startedAt: tx.now,
        deadlineAt: rollDeadline(tx, tx.now),
      });
      return;
    }
    case "DEV_SET_TILES":
      correctTiles(tx, cmd.playerId, cmd.openTiles, "dev");
      return;
    case "DEV_SHUT_BOARD":
      correctTiles(tx, cmd.playerId, [], "dev");
      return;
    case "DEV_BLOCK_PLAYER": {
      const round = tx.state.match?.round;
      if (!round || round.result || round.players[cmd.playerId]?.status !== "active") fail("INVALID_COMMAND");
      blockPlayer(tx, cmd.playerId, "dev");
      return;
    }
    case "DEV_NEXT_ROUND": {
      const round = tx.state.match?.round;
      if (tx.state.phase === "ROUND_RESULTS") startNextRound(tx);
      else if (round && !round.result && !tx.state.match?.result) finishRound(tx, "all_blocked");
      else fail("WRONG_PHASE");
      return;
    }
    case "DEV_SIMULATE_DISCONNECT": {
      const p = tx.player(cmd.playerId);
      if (!p || p.isBot || p.connection === "left") fail("INVALID_COMMAND");
      tx.presence[p.id] = tx.now - TIMING.reconnectingAfterMs - 1000;
      if (p.connection === "online") tx.emit({ type: "PLAYER_CONNECTION", playerId: p.id, status: "reconnecting" });
      return;
    }
    case "DEV_ADD_FAKE_PLAYERS": {
      lobbyOnly(tx);
      const room = tx.state.settings.maxPlayers - tx.state.players.length;
      addBots(tx, Math.max(0, Math.min(room, cmd.count)), "normal");
      return;
    }
    default:
      fail("INVALID_COMMAND");
  }
}
