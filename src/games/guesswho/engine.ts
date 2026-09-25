import {
  COLORS,
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
import { botMove, eliminatedBy } from "./bot";
import { answerFor, cardById, GW_CARDS, questionById } from "./cards";
import type { GwEvent, GwEventBody } from "./events";
import { applyGwEvent, emptyGuessWhoState } from "./reducer";
import { GW_TIMING, normalizeGuessWhoSettings, targetFor } from "./rules";
import type {
  GuessWhoPersonal,
  GuessWhoPhase,
  GuessWhoPrivate,
  GuessWhoRoomState,
  GuessWhoServerState,
  GuessWhoSettings,
  GwAnswer,
  GwMatchResult,
  GwOutcome,
  GwScore,
} from "./types";

// ───────────────────────────── Commands ─────────────────────────────

export type GwCommand =
  | { type: "JOIN"; nickname: string; avatar: string; color?: PlayerColor | null }
  | { type: "LEAVE" }
  | { type: "UPDATE_PROFILE"; nickname?: string; avatar?: string; color?: PlayerColor }
  | { type: "SET_READY"; ready: boolean }
  | { type: "UPDATE_SETTINGS"; settings: Partial<GuessWhoSettings> }
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
  | { type: "GW_ASK"; questionId: string }
  | { type: "GW_ASK_FREE"; text: string }
  | { type: "GW_ANSWER"; answer: GwAnswer }
  | { type: "GW_FLIP"; cardIds: string[]; down: boolean }
  | { type: "GW_GUESS"; cardId: string }
  | { type: "DEV_GW_FORCE_SECRETS"; cards: string[] }
  | { type: "DEV_ADD_FAKE_PLAYERS"; count: number };

export type GwResult =
  | { ok: true; state: GuessWhoServerState; events: GwEvent[]; changed: boolean; duplicate: boolean; data: Record<string, unknown>; presence: Record<string, number> }
  | { ok: false; state: GuessWhoServerState; events: GwEvent[]; changed: boolean; error: { code: ErrorCode; params: ErrorParams }; presence: Record<string, number> };

const BOT_NAMES = ["Horus", "Anubis", "Bastet", "Thoth"];
const COMMAND_MEMORY = 64;
const FREE_MAX = 80;

class Tx {
  state: GuessWhoServerState;
  readonly events: GwEvent[] = [];
  readonly presence: Record<string, number> = {};
  constructor(
    state: GuessWhoServerState,
    readonly ctx: CommandContext,
  ) {
    this.state = state;
  }
  get now() {
    return this.ctx.now;
  }
  emit(body: GwEventBody) {
    const e = { ...body, seq: this.state.version + 1, at: this.ctx.now } as GwEvent;
    this.state = applyGwEvent(this.state, e);
    this.events.push(e);
    return e;
  }
  priv(fn: (p: GuessWhoPrivate) => void) {
    const p = structuredClone(this.state.private);
    fn(p);
    this.state = { ...this.state, private: p };
  }
  get settings(): GuessWhoSettings {
    return this.state.match?.settings ?? this.state.settings;
  }
  player(id: string | null | undefined): RoomPlayer | undefined {
    return id ? this.state.players.find((p) => p.id === id) : undefined;
  }
}

/** Reads the phase without TypeScript narrowing (emit() mutates it). */
const phaseOf = (tx: Tx): GuessWhoPhase => tx.state.phase;

// ───────────────────────────── Public helpers ─────────────────────────────

export function emptyGwPrivate(): GuessWhoPrivate {
  return { guests: {}, userIds: {}, bans: [], commandIds: [], spectators: [], secrets: {}, forcedSecrets: [] };
}

export function toPublicGuessWho(s: GuessWhoServerState): GuessWhoRoomState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { private: _p, ...pub } = s;
  return pub;
}

export function findGwPlayerByGuest(s: GuessWhoServerState, guestId: string): string | null {
  for (const [pid, gid] of Object.entries(s.private.guests)) {
    if (gid === guestId && s.players.some((p) => p.id === pid && p.connection !== "left")) return pid;
  }
  return null;
}

/** What only this viewer may see: their own secret card. */
export function guessWhoPersonal(s: GuessWhoServerState, playerId: string | null): GuessWhoPersonal {
  const round = s.match?.round;
  if (!round || !playerId || round.result) return { card: null };
  return { card: s.private.secrets[playerId] ?? null };
}

export interface CreateGuessWhoParams {
  roomId: string;
  code: string;
  settings?: Partial<GuessWhoSettings>;
  nickname: string;
  avatar: string;
  color?: PlayerColor | null;
  guestId: string;
  userId?: string | null;
}

export function createGuessWhoRoom(params: CreateGuessWhoParams, ctx: Omit<CommandContext, "actorId" | "presence">) {
  const nickname = sanitizeNickname(params.nickname);
  if (!validNickname(nickname)) throw new GameError("INVALID_NICKNAME");
  const initial: GuessWhoServerState = { ...emptyGuessWhoState(), private: emptyGwPrivate() };
  const tx = new Tx(initial, { ...ctx, actorId: null, presence: {} });
  const hostId = ctx.newId();
  const color = params.color && COLORS.includes(params.color) ? params.color : "blue";
  tx.emit({ type: "ROOM_CREATED", game: "guesswho", roomId: params.roomId, code: params.code, hostId, settings: normalizeGuessWhoSettings(params.settings), createdAt: ctx.now });
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

export function executeGuessWho(state: GuessWhoServerState, command: GwCommand, ctx: CommandContext, commandId?: string): GwResult {
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
    // A new round may have been dealt (by this command or the clock): tell the actor their card.
    if (ctx.actorId && tx.events.some((e) => e.type === "GW_ROUND_STARTED")) data.personal = guessWhoPersonal(tx.state, ctx.actorId);
    const changed = tx.events.length > 0 || tx.state.private !== state.private;
    return { ok: true, state: tx.state, events: tx.events, changed, duplicate: false, data, presence: tx.presence };
  } catch (err) {
    if (err instanceof GameError) {
      return { ok: false, state: afterTime, events: tx.events.slice(0, timeEvents), changed: afterTime !== state, error: { code: err.code, params: err.params }, presence: {} };
    }
    throw err;
  }
}

function handle(tx: Tx, cmd: GwCommand): Record<string, unknown> | void {
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
      tx.emit({ type: "SETTINGS_UPDATED", settings: normalizeGuessWhoSettings({ ...tx.state.settings, ...cmd.settings }) });
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
      if (tx.state.phase !== "GW_ROUND_RESULTS") fail("WRONG_PHASE");
      beginRound(tx);
      return;
    case "END_MATCH":
      host(tx);
      if (!tx.state.match || tx.state.match.result) fail("WRONG_PHASE");
      if (tx.state.phase === "GW_PLAYING") finishRound(tx, null, "abandoned", null, null, "host_ended");
      else finishMatch(tx, "host_ended");
      return;
    case "REMATCH":
      host(tx);
      if (tx.state.phase !== "GW_MATCH_RESULTS") fail("WRONG_PHASE");
      tx.emit({ type: "GW_REMATCH" });
      if (tx.state.players.length >= 2) startMatch(tx);
      return;
    case "BACK_TO_LOBBY":
      host(tx);
      if (tx.state.phase !== "GW_MATCH_RESULTS") fail("WRONG_PHASE");
      tx.emit({ type: "GW_RETURNED_TO_LOBBY" });
      return;
    case "GW_ASK":
      return ask(tx, cmd.questionId);
    case "GW_ASK_FREE":
      return askFree(tx, cmd.text);
    case "GW_ANSWER":
      return answerFree(tx, cmd.answer);
    case "GW_FLIP":
      return flip(tx, cmd.cardIds, cmd.down);
    case "GW_GUESS":
      return guess(tx, cmd.cardId);
    case "DEV_GW_FORCE_SECRETS": {
      if (!tx.ctx.devTools) fail("DEV_TOOLS_DISABLED");
      tx.priv((p) => void (p.forcedSecrets = cmd.cards.filter((c) => !!cardById(c)).slice(0, 2)));
      return;
    }
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
/** The acting player, during their own turn with no typed question waiting. */
function onTurn(tx: Tx): RoomPlayer {
  const me = actor(tx);
  const round = tx.state.match?.round;
  if (tx.state.phase !== "GW_PLAYING" || !round || round.result) fail("WRONG_PHASE");
  if (!tx.state.match!.playerIds.includes(me.id) || round.currentId !== me.id) fail("NOT_YOUR_TURN");
  if (round.pending) fail("QUESTION_PENDING");
  return me;
}

// ───────────────────────────── Lobby ─────────────────────────────

function freeColors(tx: Tx, except?: string): PlayerColor[] {
  const taken = new Set(tx.state.players.filter((p) => p.id !== except && p.connection !== "left").map((p) => p.color));
  return COLORS.filter((c) => !taken.has(c));
}
function nicknameTaken(tx: Tx, nick: string, except?: string) {
  const n = nick.toLocaleLowerCase();
  return tx.state.players.some((p) => p.id !== except && p.connection !== "left" && p.nickname.toLocaleLowerCase() === n);
}

function join(tx: Tx, cmd: Extract<GwCommand, { type: "JOIN" }>) {
  const guestId = tx.ctx.guestId;
  if (!guestId) fail("FORBIDDEN");
  if (tx.state.private.bans.includes(guestId)) fail("BANNED");
  const existing = findGwPlayerByGuest(tx.state, guestId);
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

function updateProfile(tx: Tx, cmd: Extract<GwCommand, { type: "UPDATE_PROFILE" }>) {
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
    if (tx.state.players.length >= 2) fail("ROOM_FULL");
    const name = BOT_NAMES.find((n) => !nicknameTaken(tx, n)) ?? `Bot ${tx.state.players.length + 1}`;
    tx.emit({ type: "PLAYER_JOINED", player: makePlayer(tx.ctx.newId(), name, "🤖", freeColors(tx)[0], tx.now, { ready: true, bot: level }) });
  }
}

function spectate(tx: Tx) {
  const guestId = tx.ctx.guestId;
  if (!guestId) fail("FORBIDDEN");
  if (findGwPlayerByGuest(tx.state, guestId)) return { spectator: false };
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
    if (tx.state.phase === "GW_PLAYING") finishRound(tx, stayer, "abandoned", null, null, "insufficient_players");
    else finishMatch(tx, "insufficient_players");
  }
  if (wasHost) migrateHost(tx, "left");
  if (humans(tx).length === 0 && phaseOf(tx) !== "FINISHED") tx.emit({ type: "ROOM_CLOSED", reason: "empty" });
}

// ───────────────────────────── Match & rounds ─────────────────────────────

function startMatch(tx: Tx) {
  const players = tx.state.players.filter((p) => p.connection !== "left");
  tx.emit({
    type: "GW_MATCH_STARTED",
    matchId: tx.ctx.newId(),
    number: tx.state.matchCount + 1,
    settings: tx.state.settings,
    playerIds: players.map((p) => p.id),
    target: targetFor(tx.state.settings),
    phaseEndsAt: tx.now + GW_TIMING.introMs,
  });
}

function shuffle<T>(tx: Tx, xs: T[]): T[] {
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = tx.ctx.rng.int(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function turnDeadline(tx: Tx): number | null {
  return tx.settings.turnTimer ? tx.now + tx.settings.turnTimer * 1000 : null;
}

function beginRound(tx: Tx) {
  const match = tx.state.match!;
  const settings = match.settings;
  const number = match.roundsPlayed + 1;
  const deck = GW_CARDS[settings.category].map((c) => c.id);
  const forced = tx.ctx.devTools ? tx.state.private.forcedSecrets.filter((id) => deck.includes(id)) : [];
  // The board always includes forced secrets (dev tools), the rest is random.
  const rest = shuffle(tx, deck.filter((id) => !forced.includes(id))).slice(0, Math.min(settings.boardSize, deck.length) - forced.length);
  const board = shuffle(tx, [...forced, ...rest]);
  const pool = shuffle(tx, board);
  const secrets: Record<string, string> = {};
  match.playerIds.forEach((id, i) => (secrets[id] = forced[i] ?? pool.find((c) => !Object.values(secrets).includes(c))!));
  tx.priv((p) => {
    p.secrets = secrets;
    p.forcedSecrets = [];
  });
  // Players alternate who opens: the loser of the previous round, else seat order.
  const last = match.history[match.history.length - 1];
  const live = match.playerIds.filter((id) => tx.player(id)?.connection !== "left");
  const firstId = last?.winnerId ? (live.find((id) => id !== last.winnerId) ?? live[0]) : live[(number - 1) % live.length];
  tx.emit({ type: "GW_ROUND_STARTED", roundId: tx.ctx.newId(), number, category: settings.category, board, firstId, deadlineAt: turnDeadline(tx) });
}

const opponentOf = (tx: Tx, id: string) => tx.state.match!.playerIds.find((p) => p !== id)!;

function ask(tx: Tx, questionId: string, auto: "bot" | null = null) {
  const me = auto ? tx.player(tx.state.match!.round!.currentId)! : onTurn(tx);
  const round = tx.state.match!.round!;
  const q = questionById(questionId);
  if (!q || q.category !== round.category) fail("INVALID_COMMAND", { reason: "question" });
  const other = opponentOf(tx, me.id);
  const answer: GwAnswer = answerFor(tx.state.private.secrets[other], questionId) ? "yes" : "no";
  tx.emit({ type: "GW_ASKED", askerId: me.id, questionId, answer, nextId: other, deadlineAt: turnDeadline(tx), auto });
  return { answer };
}

function askFree(tx: Tx, raw: string) {
  const me = onTurn(tx);
  if (!tx.settings.freeQuestions) fail("INVALID_COMMAND", { reason: "free_off" });
  const other = opponentOf(tx, me.id);
  if (tx.player(other)?.isBot) fail("BOT_CANT_ANSWER");
  const text = raw.replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "").replace(/\s+/g, " ").trim().slice(0, FREE_MAX);
  if (text.length < 3) fail("INVALID_COMMAND", { reason: "too_short" });
  tx.emit({ type: "GW_FREE_ASKED", askerId: me.id, answererId: other, text, deadlineAt: tx.now + GW_TIMING.answerMs });
}

function answerFree(tx: Tx, answer: GwAnswer) {
  const me = actor(tx);
  const round = tx.state.match?.round;
  if (tx.state.phase !== "GW_PLAYING" || !round?.pending) fail("WRONG_PHASE");
  if (round.pending.answererId !== me.id) fail("NOT_YOUR_TURN");
  tx.emit({ type: "GW_FREE_ANSWERED", askerId: round.pending.askerId, answer, nextId: me.id, deadlineAt: turnDeadline(tx) });
}

function flip(tx: Tx, cardIds: string[], down: boolean) {
  const me = actor(tx);
  const round = tx.state.match?.round;
  if (tx.state.phase !== "GW_PLAYING" || !round || !tx.state.match!.playerIds.includes(me.id)) fail("WRONG_PHASE");
  const board = new Set(round.board);
  const mine = new Set(round.flipped[me.id] ?? []);
  const ids = [...new Set(cardIds)].filter((id) => board.has(id) && mine.has(id) !== down);
  if (cardIds.some((id) => !board.has(id))) fail("INVALID_CARD");
  if (ids.length) tx.emit({ type: "GW_FLIPPED", playerId: me.id, cardIds: ids, down });
}

function guess(tx: Tx, cardId: string, auto = false) {
  const me = auto ? tx.player(tx.state.match!.round!.currentId)! : onTurn(tx);
  const round = tx.state.match!.round!;
  if (!round.board.includes(cardId)) fail("INVALID_CARD");
  const other = opponentOf(tx, me.id);
  const correct = tx.state.private.secrets[other] === cardId;
  if (correct) {
    finishRound(tx, me.id, "guessed", me.id, cardId);
    return { correct };
  }
  if (tx.settings.wrongGuessLoses) finishRound(tx, other, "wrong_guess", me.id, cardId);
  else tx.emit({ type: "GW_WRONG_GUESS", guesserId: me.id, cardId, nextId: other, deadlineAt: turnDeadline(tx) });
  return { correct };
}

function finishRound(tx: Tx, winnerId: string | null, outcome: GwOutcome, guesserId: string | null, guessCardId: string | null, endMatch: GwMatchResult["reason"] | null = null) {
  const match = tx.state.match!;
  const round = match.round!;
  const scores: Record<string, GwScore> = structuredClone(match.scores);
  if (winnerId && scores[winnerId]) scores[winnerId].wins += 1;
  if (guesserId && scores[guesserId]) {
    if (outcome === "guessed") scores[guesserId].rightGuesses += 1;
    else if (outcome === "wrong_guess") scores[guesserId].wrongGuesses += 1;
  }
  const remaining = match.playerIds.filter((id) => tx.player(id)?.connection !== "left").length;
  const topWins = Math.max(0, ...Object.values(scores).map((s) => s.wins));
  const over = endMatch !== null || remaining < 2 || topWins >= match.target || match.roundsPlayed + 1 >= match.settings.rounds;
  tx.emit({
    type: "GW_ROUND_ENDED",
    result: {
      roundNumber: round.number,
      winnerId,
      outcome,
      guesserId,
      guessCardId,
      secrets: { ...tx.state.private.secrets },
      questions: round.log.filter((l) => l.kind !== "guess").length,
      endedAt: tx.now,
    },
    scores,
    phaseEndsAt: over ? null : tx.now + GW_TIMING.intermissionMs,
  });
  if (over) finishMatch(tx, endMatch ?? (remaining < 2 ? "insufficient_players" : "completed"));
}

function finishMatch(tx: Tx, reason: GwMatchResult["reason"]) {
  const match = tx.state.match!;
  const left = new Set(match.playerIds.filter((id) => tx.player(id)?.connection === "left"));
  const cmp = (a: GwScore, b: GwScore) => b.wins - a.wins || b.rightGuesses - a.rightGuesses || a.questions - b.questions;
  const sorted = match.playerIds
    .map((id) => match.scores[id])
    .filter(Boolean)
    .sort((a, b) => Number(left.has(a.playerId)) - Number(left.has(b.playerId)) || cmp(a, b));
  const standings: GwMatchResult["standings"] = [];
  sorted.forEach((s, i) => {
    const prev = sorted[i - 1];
    const tied = prev && left.has(prev.playerId) === left.has(s.playerId) && cmp(prev, s) === 0;
    standings.push({ playerId: s.playerId, rank: tied ? standings[i - 1].rank : i + 1, wins: s.wins });
  });
  tx.emit({
    type: "GW_MATCH_ENDED",
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
    if (idle <= GW_TIMING.reconnectingAfterMs) status = "online";
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

interface Due {
  at: number;
  kind: "phase" | "bot_turn" | "turn_timeout" | "player_gone" | "answer_timeout";
}

/** Everything the lazy clock may need to do, earliest first. Shared by the server clock and client tick scheduling. */
function dues(state: GuessWhoRoomState, now: number): Due[] {
  const out: Due[] = [];
  const round = state.match?.round;
  switch (state.phase) {
    case "GW_STARTING":
    case "GW_ROUND_RESULTS":
      if (state.phaseEndsAt !== null) out.push({ at: state.phaseEndsAt, kind: "phase" });
      break;
    case "GW_PLAYING": {
      if (!round || round.result) break;
      if (round.pending) {
        out.push({ at: round.pending.deadlineAt, kind: "answer_timeout" });
        break;
      }
      const p = state.players.find((x) => x.id === round.currentId);
      if (!p) break;
      if (p.isBot) out.push({ at: (round.turnStartedAt ?? now) + GW_TIMING.botDelayMs, kind: "bot_turn" });
      // Skip an absent player's turn — but only to hand it to someone who is there.
      const other = state.players.find((x) => x.id !== p.id && state.match!.playerIds.includes(x.id));
      const otherHere = !!other && (other.isBot || other.connection === "online");
      if (otherHere && p.connection === "offline") out.push({ at: now, kind: "player_gone" });
      else if (otherHere && p.connection === "reconnecting") out.push({ at: Math.max(p.disconnectedAt ?? now, round.turnStartedAt ?? 0) + GW_TIMING.disconnectSkipMs, kind: "player_gone" });
      if (round.deadlineAt !== null) out.push({ at: round.deadlineAt, kind: "turn_timeout" });
      break;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function nextWakeGuessWho(state: GuessWhoRoomState, now: number): number | null {
  return dues(state, now)[0]?.at ?? null;
}

function passTurn(tx: Tx, reason: "timeout" | "disconnect") {
  const round = tx.state.match!.round!;
  tx.emit({ type: "GW_TURN", playerId: opponentOf(tx, round.currentId!), deadlineAt: turnDeadline(tx), reason });
}

function timeStep(tx: Tx): boolean {
  const due = dues(tx.state, tx.now).find((d) => d.at <= tx.now);
  if (!due) return false;
  switch (due.kind) {
    case "phase":
      if (tx.state.phase === "GW_STARTING" || (tx.state.phase === "GW_ROUND_RESULTS" && !tx.state.match?.result)) beginRound(tx);
      else return false;
      return true;
    case "bot_turn": {
      const round = tx.state.match!.round!;
      const bot = tx.player(round.currentId)!;
      const move = botMove(bot.botLevel ?? "normal", round, bot.id, tx.ctx.rng);
      if (move.kind === "guess") guess(tx, move.cardId, true);
      else {
        ask(tx, move.questionId, "bot");
        // Bots flip what the answer rules out, so the human sees their board shrink.
        const after = tx.state.match?.round;
        if (after && !after.result) {
          const down = new Set(after.flipped[bot.id] ?? []);
          const out = eliminatedBy(after, bot.id).filter((id) => !down.has(id));
          if (out.length) tx.emit({ type: "GW_FLIPPED", playerId: bot.id, cardIds: out, down: true });
        }
      }
      return true;
    }
    case "player_gone":
      passTurn(tx, "disconnect");
      return true;
    case "turn_timeout":
      passTurn(tx, "timeout");
      return true;
    case "answer_timeout": {
      const round = tx.state.match!.round!;
      tx.emit({ type: "GW_FREE_EXPIRED", askerId: round.pending!.askerId, deadlineAt: turnDeadline(tx) });
      return true;
    }
  }
}
