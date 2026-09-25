import {
  fail,
  GameError,
  sanitizeAvatar,
  sanitizeNickname,
  seatOf,
  validNickname,
  type BotLevel,
  type CommandContext,
  type ErrorCode,
  type ErrorParams,
  type PlayerColor,
  type RoomPlayer,
} from "@/game-engine";
import { canDrop, canPop, findLine, isFull, legalMoves, snapshotOf, type C4Move } from "./board";
import { botC4Move } from "./bot";
import type { C4Event, C4EventBody } from "./events";
import { applyC4Event, emptyConnect4State } from "./reducer";
import { BOARD_DIMS, C4_TIMING, c4Target, moveCap, normalizeConnect4Settings } from "./rules";
import type { C4Auto, C4MatchResult, C4Outcome, C4Score, Connect4Phase, Connect4Private, Connect4RoomState, Connect4ServerState, Connect4Settings } from "./types";

// ───────────────────────────── Commands ─────────────────────────────

export type C4Command =
  | { type: "JOIN"; nickname: string; avatar: string; color?: PlayerColor | null }
  | { type: "LEAVE" }
  | { type: "UPDATE_PROFILE"; nickname?: string; avatar?: string; color?: PlayerColor }
  | { type: "SET_READY"; ready: boolean }
  | { type: "UPDATE_SETTINGS"; settings: Partial<Connect4Settings> }
  | { type: "KICK"; playerId: string; ban?: boolean }
  | { type: "TRANSFER_HOST"; playerId: string }
  | { type: "ADD_BOT"; level: BotLevel }
  | { type: "START" }
  | { type: "SPECTATE" }
  | { type: "TICK" }
  | { type: "CLOSE_ROOM" }
  | { type: "NEXT_ROUND" }
  | { type: "END_MATCH" }
  | { type: "REMATCH" }
  | { type: "BACK_TO_LOBBY" }
  | { type: "C4_DROP"; column: number }
  | { type: "C4_POP"; column: number }
  | { type: "DEV_ADD_FAKE_PLAYERS"; count: number };

export type C4Result =
  | { ok: true; state: Connect4ServerState; events: C4Event[]; changed: boolean; duplicate: boolean; data: Record<string, unknown>; presence: Record<string, number> }
  | { ok: false; state: Connect4ServerState; events: C4Event[]; changed: boolean; error: { code: ErrorCode; params: ErrorParams }; presence: Record<string, number> };

/** Connect 4 uses the real game's red and yellow discs. */
export const C4_COLORS: PlayerColor[] = ["red", "yellow"];
const BOT_NAMES = ["Dizzy", "Clacker", "Stacker", "Rolly"];
const COMMAND_MEMORY = 64;

class Tx {
  state: Connect4ServerState;
  readonly events: C4Event[] = [];
  readonly presence: Record<string, number> = {};
  constructor(
    state: Connect4ServerState,
    readonly ctx: CommandContext,
  ) {
    this.state = state;
  }
  get now() {
    return this.ctx.now;
  }
  emit(body: C4EventBody) {
    const e = { ...body, seq: this.state.version + 1, at: this.ctx.now } as C4Event;
    this.state = applyC4Event(this.state, e);
    this.events.push(e);
    return e;
  }
  priv(fn: (p: Connect4Private) => void) {
    const p = structuredClone(this.state.private);
    fn(p);
    this.state = { ...this.state, private: p };
  }
  get settings(): Connect4Settings {
    return this.state.match?.settings ?? this.state.settings;
  }
  player(id: string | null | undefined): RoomPlayer | undefined {
    return id ? this.state.players.find((p) => p.id === id) : undefined;
  }
}

const phaseOf = (tx: Tx): Connect4Phase => tx.state.phase;

// ───────────────────────────── Public helpers ─────────────────────────────

export function emptyC4Private(): Connect4Private {
  return { guests: {}, userIds: {}, bans: [], commandIds: [], spectators: [] };
}

export function toPublicConnect4(s: Connect4ServerState): Connect4RoomState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { private: _p, ...pub } = s;
  return pub;
}

export function findC4PlayerByGuest(s: Connect4ServerState, guestId: string): string | null {
  for (const [pid, gid] of Object.entries(s.private.guests)) {
    if (gid === guestId && s.players.some((p) => p.id === pid && p.connection !== "left")) return pid;
  }
  return null;
}

export interface CreateConnect4Params {
  roomId: string;
  code: string;
  settings?: Partial<Connect4Settings>;
  nickname: string;
  avatar: string;
  color?: PlayerColor | null;
  guestId: string;
  userId?: string | null;
}

export function createConnect4Room(params: CreateConnect4Params, ctx: Omit<CommandContext, "actorId" | "presence">) {
  const nickname = sanitizeNickname(params.nickname);
  if (!validNickname(nickname)) throw new GameError("INVALID_NICKNAME");
  const initial: Connect4ServerState = { ...emptyConnect4State(), private: emptyC4Private() };
  const tx = new Tx(initial, { ...ctx, actorId: null, presence: {} });
  const hostId = ctx.newId();
  const color = params.color && C4_COLORS.includes(params.color) ? params.color : "red";
  tx.emit({ type: "ROOM_CREATED", game: "connect4", roomId: params.roomId, code: params.code, hostId, settings: normalizeConnect4Settings(params.settings), createdAt: ctx.now });
  tx.emit({ type: "PLAYER_JOINED", player: makePlayer(hostId, nickname, sanitizeAvatar(params.avatar), color, ctx.now, { ready: true }) });
  tx.priv((p) => {
    p.guests[hostId] = params.guestId;
    if (params.userId) p.userIds[hostId] = params.userId;
  });
  return { state: tx.state, events: tx.events, hostId };
}

function makePlayer(id: string, nickname: string, avatar: string, color: PlayerColor, now: number, opts: { ready?: boolean; bot?: BotLevel } = {}): RoomPlayer {
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

export function executeConnect4(state: Connect4ServerState, command: C4Command, ctx: CommandContext, commandId?: string): C4Result {
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
      return { ok: false, state: afterTime, events: tx.events.slice(0, timeEvents), changed: afterTime !== state, error: { code: err.code, params: err.params }, presence: {} };
    }
    throw err;
  }
}

function handle(tx: Tx, cmd: C4Command): Record<string, unknown> | void {
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
      tx.emit({ type: "SETTINGS_UPDATED", settings: normalizeConnect4Settings({ ...tx.state.settings, ...cmd.settings }) });
      return;
    }
    case "KICK": {
      const me = host(tx);
      const target = tx.player(cmd.playerId);
      if (!target || target.connection === "left" || target.id === me.id) fail("INVALID_COMMAND");
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
    case "ADD_BOT":
      host(tx);
      lobbyOnly(tx);
      addBots(tx, 1, cmd.level);
      return;
    case "START": {
      host(tx);
      lobbyOnly(tx);
      const players = tx.state.players.filter((p) => p.connection !== "left");
      if (players.length < 2) fail("NOT_ENOUGH_PLAYERS", { min: 2 });
      if (players.some((p) => !p.isReady)) fail("NOT_ALL_READY");
      startMatch(tx);
      return;
    }
    case "SPECTATE":
      return spectate(tx);
    case "CLOSE_ROOM":
      if (!tx.ctx.isAdmin) host(tx);
      tx.emit({ type: "ROOM_CLOSED", reason: tx.ctx.isAdmin ? "admin" : "host" });
      return;
    case "NEXT_ROUND":
      host(tx);
      if (tx.state.phase !== "C4_ROUND_RESULTS") fail("WRONG_PHASE");
      beginRound(tx);
      return;
    case "END_MATCH":
      host(tx);
      if (!tx.state.match || tx.state.match.result) fail("WRONG_PHASE");
      if (tx.state.phase === "C4_PLAYING") finishRound(tx, null, "abandoned", null, "host_ended");
      else finishMatch(tx, "host_ended");
      return;
    case "REMATCH":
      host(tx);
      if (tx.state.phase !== "C4_MATCH_RESULTS") fail("WRONG_PHASE");
      tx.emit({ type: "C4_REMATCH" });
      if (tx.state.players.length >= 2) startMatch(tx);
      return;
    case "BACK_TO_LOBBY":
      host(tx);
      if (tx.state.phase !== "C4_MATCH_RESULTS") fail("WRONG_PHASE");
      tx.emit({ type: "C4_RETURNED_TO_LOBBY" });
      return;
    case "C4_DROP":
      return move(tx, onTurn(tx).id, { kind: "drop", column: cmd.column }, null);
    case "C4_POP":
      return move(tx, onTurn(tx).id, { kind: "pop", column: cmd.column }, null);
    case "DEV_ADD_FAKE_PLAYERS": {
      if (!tx.ctx.devTools) fail("DEV_TOOLS_DISABLED");
      lobbyOnly(tx);
      addBots(tx, Math.max(0, Math.min(2 - tx.state.players.length, cmd.count)), "normal");
      return;
    }
    default:
      fail("INVALID_COMMAND");
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
function onTurn(tx: Tx): RoomPlayer {
  const me = actor(tx);
  const round = tx.state.match?.round;
  if (tx.state.phase !== "C4_PLAYING" || !round || round.result) fail("WRONG_PHASE");
  if (round.currentId !== me.id) fail("NOT_YOUR_TURN");
  return me;
}

// ───────────────────────────── Lobby ─────────────────────────────

function freeColors(tx: Tx, except?: string): PlayerColor[] {
  const taken = new Set(tx.state.players.filter((p) => p.id !== except && p.connection !== "left").map((p) => p.color));
  return C4_COLORS.filter((c) => !taken.has(c));
}
function nicknameTaken(tx: Tx, nick: string, except?: string) {
  const n = nick.toLocaleLowerCase();
  return tx.state.players.some((p) => p.id !== except && p.connection !== "left" && p.nickname.toLocaleLowerCase() === n);
}

function join(tx: Tx, cmd: Extract<C4Command, { type: "JOIN" }>) {
  const guestId = tx.ctx.guestId;
  if (!guestId) fail("FORBIDDEN");
  if (tx.state.private.bans.includes(guestId)) fail("BANNED");
  const existing = findC4PlayerByGuest(tx.state, guestId);
  if (existing) {
    tx.presence[existing] = tx.now;
    if (tx.player(existing)!.connection !== "online") tx.emit({ type: "PLAYER_CONNECTION", playerId: existing, status: "online" });
    return { playerId: existing, rejoined: true };
  }
  lobbyOnly(tx);
  if (tx.state.players.length >= 2) fail("ROOM_FULL");
  const nickname = sanitizeNickname(cmd.nickname);
  if (!validNickname(nickname)) fail("INVALID_NICKNAME");
  if (nicknameTaken(tx, nickname)) fail("NICKNAME_TAKEN");
  const free = freeColors(tx);
  if (!free.length) fail("ROOM_FULL");
  const color = cmd.color && free.includes(cmd.color) ? cmd.color : free[0];
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

function updateProfile(tx: Tx, cmd: Extract<C4Command, { type: "UPDATE_PROFILE" }>) {
  const me = actor(tx);
  lobbyOnly(tx);
  const patch: { nickname?: string; avatar?: string; color?: PlayerColor } = {};
  if (cmd.nickname !== undefined) {
    const nick = sanitizeNickname(cmd.nickname);
    if (!validNickname(nick)) fail("INVALID_NICKNAME");
    if (nicknameTaken(tx, nick, me.id)) fail("NICKNAME_TAKEN");
    if (nick !== me.nickname) patch.nickname = nick;
  }
  if (cmd.avatar !== undefined && sanitizeAvatar(cmd.avatar) !== me.avatar) patch.avatar = sanitizeAvatar(cmd.avatar);
  if (cmd.color !== undefined && cmd.color !== me.color) {
    if (!freeColors(tx, me.id).includes(cmd.color)) fail("COLOR_TAKEN");
    patch.color = cmd.color;
  }
  if (Object.keys(patch).length) tx.emit({ type: "PLAYER_UPDATED", playerId: me.id, ...patch });
}

function addBots(tx: Tx, count: number, level: BotLevel) {
  for (let i = 0; i < count; i++) {
    const free = freeColors(tx);
    if (tx.state.players.length >= 2 || !free.length) fail("ROOM_FULL");
    const name = BOT_NAMES.find((n) => !nicknameTaken(tx, n)) ?? `Bot ${tx.state.players.length + 1}`;
    tx.emit({ type: "PLAYER_JOINED", player: makePlayer(tx.ctx.newId(), name, "🤖", free[0], tx.now, { ready: true, bot: level }) });
  }
}

function spectate(tx: Tx) {
  const guestId = tx.ctx.guestId;
  if (!guestId) fail("FORBIDDEN");
  if (findC4PlayerByGuest(tx.state, guestId)) return { spectator: false };
  if (!tx.state.settings.spectators) fail("SPECTATORS_DISABLED");
  if (tx.state.private.bans.includes(guestId)) fail("BANNED");
  if (!tx.state.private.spectators.includes(guestId)) {
    tx.priv((p) => void p.spectators.push(guestId));
    tx.emit({ type: "SPECTATOR_JOINED", count: tx.state.private.spectators.length });
  }
  return { spectator: true };
}

const humans = (tx: Tx) => tx.state.players.filter((p) => !p.isBot && p.connection !== "left");

function migrateHost(tx: Tx, reason: "migration" | "left") {
  const previous = tx.state.hostId;
  const rank = (p: RoomPlayer) => (p.connection === "online" ? 0 : p.connection === "reconnecting" ? 1 : 2);
  const next = humans(tx)
    .filter((p) => p.id !== previous)
    .sort((a, b) => rank(a) - rank(b) || a.connectedAt - b.connectedAt)[0];
  if (!next || (reason === "migration" && next.connection !== "online")) return;
  tx.emit({ type: "HOST_CHANGED", hostId: next.id, previousHostId: previous, reason });
}

function departure(tx: Tx, playerId: string, reason: "left" | "kicked" | "timeout") {
  const wasHost = tx.state.hostId === playerId;
  tx.emit({ type: "PLAYER_LEFT", playerId, reason });
  const match = tx.state.match;
  if (match && !match.result) {
    // A duel can't go on with one player: the one who stayed wins.
    const stayer = match.playerIds.find((id) => id !== playerId && tx.player(id)?.connection !== "left") ?? null;
    if (tx.state.phase === "C4_PLAYING") finishRound(tx, stayer, "abandoned", null, "insufficient_players");
    else finishMatch(tx, "insufficient_players");
  }
  if (wasHost) migrateHost(tx, "left");
  if (humans(tx).length === 0 && phaseOf(tx) !== "FINISHED") tx.emit({ type: "ROOM_CLOSED", reason: "empty" });
}

// ───────────────────────────── Match & rounds ─────────────────────────────

function startMatch(tx: Tx) {
  const players = tx.state.players.filter((p) => p.connection !== "left");
  tx.emit({
    type: "C4_MATCH_STARTED",
    matchId: tx.ctx.newId(),
    number: tx.state.matchCount + 1,
    settings: tx.state.settings,
    playerIds: players.map((p) => p.id),
    target: c4Target(tx.state.settings),
    phaseEndsAt: tx.now + C4_TIMING.introMs,
  });
}

function turnDeadline(tx: Tx): number | null {
  return tx.settings.turnTimer ? tx.now + tx.settings.turnTimer * 1000 : null;
}

const opponentOf = (tx: Tx, id: string) => tx.state.match!.playerIds.find((p) => p !== id)!;

function beginRound(tx: Tx) {
  const match = tx.state.match!;
  const settings = match.settings;
  const number = match.roundsPlayed + 1;
  const { cols, rows } = BOARD_DIMS[settings.boardSize];
  const ids = match.playerIds;
  const last = match.history[match.history.length - 1];
  let firstId: string;
  if (settings.starter === "random") firstId = ids[tx.ctx.rng.int(0, ids.length - 1)];
  else if (settings.starter === "loser" && last?.winnerId) firstId = ids.find((id) => id !== last.winnerId) ?? ids[0];
  else firstId = last ? (ids.find((id) => id !== last.starterId) ?? ids[0]) : ids[0];
  tx.emit({ type: "C4_ROUND_STARTED", roundId: tx.ctx.newId(), number, cols, rows, connect: settings.connect, firstId, deadlineAt: turnDeadline(tx) });
}

function move(tx: Tx, playerId: string, m: C4Move, auto: C4Auto) {
  const round = tx.state.match!.round!;
  const col = Math.trunc(m.column);
  if (!Number.isFinite(col) || col < 0 || col >= round.cols) fail("INVALID_COMMAND", { reason: "column" });
  if (m.kind === "drop" && !canDrop(round.columns, col, round.rows)) fail("COLUMN_FULL");
  if (m.kind === "pop") {
    if (round.mode !== "c4_popout") fail("INVALID_COMMAND", { reason: "popout_off" });
    if (!canPop(round.columns, col, playerId)) fail("CANT_POP");
  }
  const other = opponentOf(tx, playerId);
  const row = m.kind === "drop" ? round.columns[col].length : 0;
  tx.emit({ type: "C4_MOVED", playerId, kind: m.kind, column: col, row, nextId: other, deadlineAt: turnDeadline(tx), auto });

  const after = tx.state.match!.round!;
  const mine = findLine(after.columns, after.rows, after.connect, playerId);
  // A pop can complete lines for both players: the mover wins.
  const theirs = m.kind === "pop" && !mine ? findLine(after.columns, after.rows, after.connect, other) : null;
  if (mine) return void finishRound(tx, playerId, "connect", mine);
  if (theirs) return void finishRound(tx, other, "connect", theirs);
  const stuck = legalMoves(after.columns, after.rows, after.mode, other).length === 0;
  if ((after.mode === "c4_classic" && isFull(after.columns, after.rows)) || stuck || after.moves >= moveCap(after.cols, after.rows)) {
    finishRound(tx, null, "draw", null);
  }
  return { row };
}

function finishRound(tx: Tx, winnerId: string | null, outcome: C4Outcome, line: Array<[number, number]> | null, endMatch: C4MatchResult["reason"] | null = null) {
  const match = tx.state.match!;
  const round = match.round!;
  const scores: Record<string, C4Score> = structuredClone(match.scores);
  if (winnerId && scores[winnerId]) {
    scores[winnerId].wins += 1;
    if (outcome === "connect") {
      const own = Math.ceil(round.moves / 2);
      const prev = scores[winnerId].fastestWin;
      scores[winnerId].fastestWin = prev === null ? own : Math.min(prev, own);
    }
  }
  if (outcome === "draw") for (const id of match.playerIds) if (scores[id]) scores[id].draws += 1;
  const remaining = match.playerIds.filter((id) => tx.player(id)?.connection !== "left").length;
  const topWins = Math.max(0, ...Object.values(scores).map((s) => s.wins));
  const over = endMatch !== null || remaining < 2 || topWins >= match.target || match.roundsPlayed + 1 >= match.settings.rounds * 2;
  tx.emit({
    type: "C4_ROUND_ENDED",
    result: {
      roundNumber: round.number,
      winnerId,
      outcome,
      line,
      moves: round.moves,
      starterId: round.starterId,
      snapshot: snapshotOf(round.columns, match.playerIds),
      endedAt: tx.now,
    },
    scores,
    phaseEndsAt: over ? null : tx.now + C4_TIMING.intermissionMs,
  });
  if (over) finishMatch(tx, endMatch ?? (remaining < 2 ? "insufficient_players" : "completed"));
}

function finishMatch(tx: Tx, reason: C4MatchResult["reason"]) {
  const match = tx.state.match!;
  const left = new Set(match.playerIds.filter((id) => tx.player(id)?.connection === "left"));
  const cmp = (a: C4Score, b: C4Score) => b.wins - a.wins || (a.fastestWin ?? 999) - (b.fastestWin ?? 999);
  const sorted = match.playerIds
    .map((id) => match.scores[id])
    .filter(Boolean)
    .sort((a, b) => Number(left.has(a.playerId)) - Number(left.has(b.playerId)) || cmp(a, b));
  const standings: C4MatchResult["standings"] = [];
  sorted.forEach((s, i) => {
    const prev = sorted[i - 1];
    const tied = prev && left.has(prev.playerId) === left.has(s.playerId) && prev.wins === s.wins;
    standings.push({ playerId: s.playerId, rank: tied ? standings[i - 1].rank : i + 1, wins: s.wins });
  });
  tx.emit({
    type: "C4_MATCH_ENDED",
    result: { winnerIds: standings.filter((s) => s.rank === 1 && !left.has(s.playerId)).map((s) => s.playerId), standings, reason, endedAt: tx.now },
  });
}

// ───────────────────────────── Time ─────────────────────────────

function advanceTime(tx: Tx) {
  if (tx.state.phase === "FINISHED") return;
  presencePass(tx);
  if (phaseOf(tx) === "FINISHED") return;
  for (let i = 0; i < 40; i++) if (!timeStep(tx)) break;
}

function presencePass(tx: Tx) {
  const grace = tx.settings.disconnectGraceSeconds * 1000;
  for (const p of [...tx.state.players]) {
    if (p.isBot || p.connection === "left") continue;
    const last = Math.max(tx.ctx.presence[p.id] ?? 0, tx.presence[p.id] ?? 0) || p.connectedAt;
    const idle = tx.now - last;
    let status = p.connection;
    if (idle <= C4_TIMING.reconnectingAfterMs) status = "online";
    else if (idle <= grace) status = p.connection === "offline" ? "offline" : "reconnecting";
    else status = "offline";
    if (status !== p.connection) tx.emit({ type: "PLAYER_CONNECTION", playerId: p.id, status });
  }
  // Gone for good (past the grace period): out of the lobby, or forfeits the duel.
  for (const p of [...tx.state.players]) {
    if (!p.isBot && p.connection === "offline") departure(tx, p.id, "timeout");
    if (phaseOf(tx) === "FINISHED") return;
  }
  const h = tx.player(tx.state.hostId);
  if (!h || h.connection === "offline" || h.connection === "left") migrateHost(tx, "migration");
}

interface Due {
  at: number;
  kind: "phase" | "bot" | "timeout" | "away";
}

/** Everything the lazy clock may need to do, earliest first. Shared by the server clock and client tick scheduling. */
function dues(state: Connect4RoomState, now: number): Due[] {
  const out: Due[] = [];
  const round = state.match?.round;
  switch (state.phase) {
    case "C4_STARTING":
    case "C4_ROUND_RESULTS":
      if (state.phaseEndsAt !== null) out.push({ at: state.phaseEndsAt, kind: "phase" });
      break;
    case "C4_PLAYING": {
      if (!round || round.result) break;
      const p = state.players.find((x) => x.id === round.currentId);
      if (!p) break;
      if (p.isBot) out.push({ at: (round.turnStartedAt ?? now) + C4_TIMING.botDelayMs, kind: "bot" });
      else if (p.connection === "reconnecting") out.push({ at: Math.max(p.disconnectedAt ?? now, round.turnStartedAt ?? 0) + C4_TIMING.disconnectSkipMs, kind: "away" });
      if (round.deadlineAt !== null) out.push({ at: round.deadlineAt, kind: "timeout" });
      break;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function nextWakeConnect4(state: Connect4RoomState, now: number): number | null {
  return dues(state, now)[0]?.at ?? null;
}

function timeStep(tx: Tx): boolean {
  const due = dues(tx.state, tx.now).find((d) => d.at <= tx.now);
  if (!due) return false;
  if (due.kind === "phase") {
    if (tx.state.phase === "C4_STARTING" || (tx.state.phase === "C4_ROUND_RESULTS" && !tx.state.match?.result)) beginRound(tx);
    else return false;
    return true;
  }
  const round = tx.state.match!.round!;
  const p = tx.player(round.currentId)!;
  // Bots think at their level; timeouts / absent players get an easy move played for them.
  const level: BotLevel = due.kind === "bot" ? (p.botLevel ?? "normal") : "easy";
  const m = botC4Move(level, round.columns, round.rows, round.connect, round.mode, p.id, tx.ctx.rng);
  move(tx, p.id, m, due.kind === "bot" ? "bot" : due.kind === "timeout" ? "timeout" : "disconnect");
  return true;
}
