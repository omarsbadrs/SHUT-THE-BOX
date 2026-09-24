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
import { botLetter } from "./bot";
import type { HmEvent, HmEventBody } from "./events";
import { isSeparator, isSolved, maskFor, normalizeLetter, normalizeWord, positionsOf, skeletonFor, solveKey } from "./letters";
import { applyHmEvent, emptyHangmanState } from "./reducer";
import { HM_POINTS, HM_TIMING, normalizeHangmanSettings, totalRoundsFor } from "./rules";
import type {
  HangmanPersonal,
  HangmanPhase,
  HangmanPrivate,
  HangmanRoomState,
  HangmanServerState,
  HangmanSettings,
  HmMatchResult,
  HmOutcome,
  HmRoundResult,
  HmScore,
} from "./types";
import { categoryOf, wordsFor } from "./words";

// ───────────────────────────── Commands ─────────────────────────────

export type HmCommand =
  | { type: "JOIN"; nickname: string; avatar: string; color?: PlayerColor | null }
  | { type: "LEAVE" }
  | { type: "UPDATE_PROFILE"; nickname?: string; avatar?: string; color?: PlayerColor }
  | { type: "SET_READY"; ready: boolean }
  | { type: "UPDATE_SETTINGS"; settings: Partial<HangmanSettings> }
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
  | { type: "HM_SET_WORD"; word: string }
  | { type: "HM_RANDOM_WORD" }
  | { type: "HM_GUESS"; letter: string }
  | { type: "HM_SOLVE"; guess: string }
  | { type: "DEV_HM_FORCE_WORD"; words: string[] }
  | { type: "DEV_ADD_FAKE_PLAYERS"; count: number };

export type HmResult =
  | { ok: true; state: HangmanServerState; events: HmEvent[]; changed: boolean; duplicate: boolean; data: Record<string, unknown>; presence: Record<string, number> }
  | { ok: false; state: HangmanServerState; events: HmEvent[]; changed: boolean; error: { code: ErrorCode; params: ErrorParams }; presence: Record<string, number> };

const BOT_NAMES = ["Chalky", "Scribble", "Doodle", "Sketch"];
const COMMAND_MEMORY = 64;

class Tx {
  state: HangmanServerState;
  readonly events: HmEvent[] = [];
  readonly presence: Record<string, number> = {};
  constructor(
    state: HangmanServerState,
    readonly ctx: CommandContext,
  ) {
    this.state = state;
  }
  get now() {
    return this.ctx.now;
  }
  emit(body: HmEventBody) {
    const e = { ...body, seq: this.state.version + 1, at: this.ctx.now } as HmEvent;
    this.state = applyHmEvent(this.state, e);
    this.events.push(e);
    return e;
  }
  priv(fn: (p: HangmanPrivate) => void) {
    const p = structuredClone(this.state.private);
    fn(p);
    this.state = { ...this.state, private: p };
  }
  get settings(): HangmanSettings {
    return this.state.match?.settings ?? this.state.settings;
  }
  player(id: string | null | undefined): RoomPlayer | undefined {
    return id ? this.state.players.find((p) => p.id === id) : undefined;
  }
}

/** Reads the phase without TypeScript narrowing (emit() mutates it). */
const phaseOf = (tx: Tx): HangmanPhase => tx.state.phase;

// ───────────────────────────── Public helpers ─────────────────────────────

export function emptyHmPrivate(): HangmanPrivate {
  return { guests: {}, userIds: {}, bans: [], commandIds: [], spectators: [], word: null, race: {}, forcedWords: [] };
}

export function toPublicHangman(s: HangmanServerState): HangmanRoomState {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  const { private: _p, ...pub } = s;
  return pub;
}

export function findHmPlayerByGuest(s: HangmanServerState, guestId: string): string | null {
  for (const [pid, gid] of Object.entries(s.private.guests)) {
    if (gid === guestId && s.players.some((p) => p.id === pid && p.connection !== "left")) return pid;
  }
  return null;
}

/** What only this viewer may see: their own secret word, or their private race board. */
export function hangmanPersonal(s: HangmanServerState, playerId: string | null): HangmanPersonal {
  const round = s.match?.round;
  const word = s.private.word;
  const out: HangmanPersonal = { secret: null, race: null };
  if (!round || !word || !playerId) return out;
  const lang = round.language;
  if (round.masterId === playerId && !round.result) out.secret = word;
  if (round.masterId === null && round.race?.[playerId]) {
    const entries = s.private.race[playerId] ?? [];
    const letters = entries.filter((x) => !x.startsWith("*"));
    const guessed = new Set(letters);
    const mask = round.result ? [...word] : maskFor(word, guessed, lang);
    const wrong = entries.filter((x) => x.startsWith("*") || positionsOf(word, x, lang).length === 0).map((x) => (x.startsWith("*") ? x.slice(1) : x));
    out.race = { mask, guessed: letters, wrong };
  }
  return out;
}

export interface CreateHangmanParams {
  roomId: string;
  code: string;
  settings?: Partial<HangmanSettings>;
  nickname: string;
  avatar: string;
  color?: PlayerColor | null;
  guestId: string;
  userId?: string | null;
}

export function createHangmanRoom(params: CreateHangmanParams, ctx: Omit<CommandContext, "actorId" | "presence">) {
  const nickname = sanitizeNickname(params.nickname);
  if (!validNickname(nickname)) throw new GameError("INVALID_NICKNAME");
  const initial: HangmanServerState = { ...emptyHangmanState(), private: emptyHmPrivate() };
  const tx = new Tx(initial, { ...ctx, actorId: null, presence: {} });
  const hostId = ctx.newId();
  const color = params.color && COLORS.includes(params.color) ? params.color : "blue";
  tx.emit({ type: "ROOM_CREATED", game: "hangman", roomId: params.roomId, code: params.code, hostId, settings: normalizeHangmanSettings(params.settings), createdAt: ctx.now });
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

export function executeHangman(state: HangmanServerState, command: HmCommand, ctx: CommandContext, commandId?: string): HmResult {
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

function handle(tx: Tx, cmd: HmCommand): Record<string, unknown> | void {
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
      const next = normalizeHangmanSettings({ ...tx.state.settings, ...cmd.settings });
      if (next.maxPlayers < tx.state.players.length) fail("INVALID_COMMAND", { reason: "maxPlayers" });
      tx.emit({ type: "SETTINGS_UPDATED", settings: next });
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
      if (tx.state.phase !== "HM_ROUND_RESULTS") fail("WRONG_PHASE");
      beginRound(tx);
      return;
    case "END_MATCH":
      host(tx);
      if (!tx.state.match || tx.state.match.result) fail("WRONG_PHASE");
      finishMatch(tx, "host_ended");
      return;
    case "REMATCH":
      host(tx);
      if (tx.state.phase !== "HM_MATCH_RESULTS") fail("WRONG_PHASE");
      tx.emit({ type: "HM_REMATCH" });
      if (tx.state.players.length >= 2) startMatch(tx);
      return;
    case "BACK_TO_LOBBY":
      host(tx);
      if (tx.state.phase !== "HM_MATCH_RESULTS") fail("WRONG_PHASE");
      tx.emit({ type: "HM_RETURNED_TO_LOBBY" });
      return;
    case "HM_SET_WORD":
      return setWordCmd(tx, cmd.word);
    case "HM_RANDOM_WORD": {
      const me = actor(tx);
      const round = tx.state.match?.round;
      if (tx.state.phase !== "HM_CHOOSING" || round?.masterId !== me.id) fail("NOT_YOUR_TURN");
      setWord(tx, pickWord(tx), true);
      return { secret: tx.state.private.word };
    }
    case "HM_GUESS":
      return guess(tx, cmd.letter);
    case "HM_SOLVE":
      return solve(tx, cmd.guess);
    case "DEV_HM_FORCE_WORD": {
      if (!tx.ctx.devTools) fail("DEV_TOOLS_DISABLED");
      tx.priv((p) => void (p.forcedWords = cmd.words.slice(0, 20)));
      return;
    }
    case "DEV_ADD_FAKE_PLAYERS": {
      if (!tx.ctx.devTools) fail("DEV_TOOLS_DISABLED");
      lobbyOnly(tx);
      addBots(tx, Math.max(0, Math.min(tx.state.settings.maxPlayers - tx.state.players.length, cmd.count)), "normal");
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

// ───────────────────────────── Lobby ─────────────────────────────

function freeColors(tx: Tx, except?: string): PlayerColor[] {
  const taken = new Set(tx.state.players.filter((p) => p.id !== except && p.connection !== "left").map((p) => p.color));
  return COLORS.filter((c) => !taken.has(c));
}
function nicknameTaken(tx: Tx, nick: string, except?: string) {
  const n = nick.toLocaleLowerCase();
  return tx.state.players.some((p) => p.id !== except && p.connection !== "left" && p.nickname.toLocaleLowerCase() === n);
}

function join(tx: Tx, cmd: Extract<HmCommand, { type: "JOIN" }>) {
  const guestId = tx.ctx.guestId;
  if (!guestId) fail("FORBIDDEN");
  if (tx.state.private.bans.includes(guestId)) fail("BANNED");
  const existing = findHmPlayerByGuest(tx.state, guestId);
  if (existing) {
    tx.presence[existing] = tx.now;
    if (tx.player(existing)!.connection !== "online") tx.emit({ type: "PLAYER_CONNECTION", playerId: existing, status: "online" });
    return { playerId: existing, rejoined: true };
  }
  lobbyOnly(tx);
  if (tx.state.players.length >= tx.state.settings.maxPlayers) fail("ROOM_FULL");
  const nickname = sanitizeNickname(cmd.nickname);
  if (!validNickname(nickname)) fail("INVALID_NICKNAME");
  if (nicknameTaken(tx, nickname)) fail("NICKNAME_TAKEN");
  const free = freeColors(tx);
  if (!free.length) fail("ROOM_FULL");
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

function updateProfile(tx: Tx, cmd: Extract<HmCommand, { type: "UPDATE_PROFILE" }>) {
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
    if (tx.state.players.length >= tx.state.settings.maxPlayers) fail("ROOM_FULL");
    const name = BOT_NAMES.find((n) => !nicknameTaken(tx, n)) ?? `Bot ${tx.state.players.length + 1}`;
    tx.emit({ type: "PLAYER_JOINED", player: makePlayer(tx.ctx.newId(), name, "🤖", freeColors(tx)[0], tx.now, { ready: true, bot: level }) });
  }
}

function spectate(tx: Tx) {
  const guestId = tx.ctx.guestId;
  if (!guestId) fail("FORBIDDEN");
  if (findHmPlayerByGuest(tx.state, guestId)) return { spectator: false };
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
    const remaining = match.playerIds.filter((id) => tx.player(id)?.connection !== "left");
    const round = match.round;
    if (remaining.length < 2) {
      if (round && !round.result && tx.state.phase !== "HM_ROUND_RESULTS") finishRound(tx, "abandoned", null, 0, "insufficient_players");
      else if (!tx.state.match?.result) finishMatch(tx, "insufficient_players");
    } else if (round && !round.result) {
      dropFromRound(tx, playerId, "left");
    }
  }
  if (wasHost) migrateHost(tx, "left");
  if (humans(tx).length === 0 && phaseOf(tx) !== "FINISHED") tx.emit({ type: "ROOM_CLOSED", reason: "empty" });
}

/** A player can no longer play this round (left / offline). */
function dropFromRound(tx: Tx, playerId: string, reason: "left" | "disconnect") {
  const round = tx.state.match!.round!;
  if (round.masterId === null) {
    const rp = round.race?.[playerId];
    if (rp && rp.status === "playing") {
      tx.emit({ type: "HM_RACE_PROGRESS", playerId, correct: false, revealed: rp.revealed, wrong: rp.wrong, guesses: rp.guesses, status: "out", finishedAt: tx.now, auto: "out" });
      settleRace(tx);
    }
    return;
  }
  if (round.masterId === playerId && tx.state.phase === "HM_CHOOSING") {
    setWord(tx, pickWord(tx), true);
    return;
  }
  if (round.currentGuesserId === playerId && tx.state.phase === "HM_GUESSING") nextTurn(tx, reason);
}

// ───────────────────────────── Match & rounds ─────────────────────────────

function startMatch(tx: Tx) {
  const players = tx.state.players.filter((p) => p.connection !== "left");
  tx.emit({
    type: "HM_MATCH_STARTED",
    matchId: tx.ctx.newId(),
    number: tx.state.matchCount + 1,
    settings: tx.state.settings,
    playerIds: players.map((p) => p.id),
    totalRounds: totalRoundsFor(tx.state.settings, players.length),
    phaseEndsAt: tx.now + HM_TIMING.introMs,
  });
}

function pickWord(tx: Tx): string {
  const forced = tx.ctx.devTools ? tx.state.private.forcedWords[0] : undefined;
  if (forced) {
    tx.priv((p) => void p.forcedWords.shift());
    const w = normalizeWord(forced, tx.settings.language);
    if (w.ok) return w.display;
  }
  const list = wordsFor(tx.settings.language, tx.settings.category);
  const used = new Set(tx.state.match?.history.map((h) => h.word) ?? []);
  const fresh = list.filter((w) => !used.has(w));
  const pool = fresh.length ? fresh : list;
  return pool[tx.ctx.rng.int(0, pool.length - 1)];
}

function guessDeadline(tx: Tx): number | null {
  return tx.settings.guessTimer ? tx.now + tx.settings.guessTimer * 1000 : null;
}

function beginRound(tx: Tx) {
  const match = tx.state.match!;
  const number = match.roundsPlayed + 1;
  const seatOrder = tx.state.players.filter((p) => match.playerIds.includes(p.id)).map((p) => p.id);
  const isOut = (id: string) => {
    const c = tx.player(id)?.connection;
    return c === "left" || c === "offline";
  };
  const outIds = seatOrder.filter(isOut);
  const settings = match.settings;

  if (settings.gameMode === "hangman_race") {
    const word = pickWord(tx);
    tx.priv((p) => {
      p.word = word;
      p.race = {};
    });
    tx.emit({
      type: "HM_ROUND_STARTED",
      roundId: tx.ctx.newId(),
      number,
      masterId: null,
      turnOrder: seatOrder,
      outIds,
      category: settings.category === "mixed" ? (categoryOf(settings.language, word) ?? "mixed") : settings.category,
      language: settings.language,
      skeleton: skeletonFor(word),
      phase: "HM_RACE",
      phaseEndsAt: settings.raceTimer ? tx.now + settings.raceTimer * 1000 : null,
    });
    settleRace(tx);
    return;
  }

  // Word master rotates by seat; skip players who are out.
  let masterIdx = (number - 1) % seatOrder.length;
  for (let i = 0; i < seatOrder.length && isOut(seatOrder[masterIdx]); i++) masterIdx = (masterIdx + 1) % seatOrder.length;
  const masterId = seatOrder[masterIdx];
  const turnOrder = [...seatOrder.slice(masterIdx + 1), ...seatOrder.slice(0, masterIdx)].filter((id) => !isOut(id));
  tx.priv((p) => {
    p.word = null;
    p.race = {};
  });
  tx.emit({
    type: "HM_ROUND_STARTED",
    roundId: tx.ctx.newId(),
    number,
    masterId,
    turnOrder,
    outIds,
    category: settings.category,
    language: settings.language,
    skeleton: null,
    phase: "HM_CHOOSING",
    phaseEndsAt: tx.now + HM_TIMING.chooseMs,
  });
  if (turnOrder.length === 0) finishRound(tx, "abandoned", null, 0, "insufficient_players");
}

function setWordCmd(tx: Tx, raw: string) {
  const me = actor(tx);
  const round = tx.state.match?.round;
  if (tx.state.phase !== "HM_CHOOSING" || !round || round.masterId !== me.id) fail("NOT_YOUR_TURN");
  const check = normalizeWord(raw, round.language);
  if (!check.ok) fail("INVALID_WORD", { reason: check.reason });
  setWord(tx, check.display, false);
  return { secret: check.display };
}

function setWord(tx: Tx, display: string, random: boolean) {
  const round = tx.state.match!.round!;
  const first = round.turnOrder.find((id) => tx.player(id)?.connection !== "left");
  if (!first) {
    finishRound(tx, "abandoned", null, 0, "insufficient_players");
    return;
  }
  tx.priv((p) => void (p.word = display));
  const lang = round.language;
  tx.emit({
    type: "HM_WORD_SET",
    skeleton: skeletonFor(display),
    category: random ? (tx.settings.category === "mixed" ? (categoryOf(lang, display) ?? "mixed") : tx.settings.category) : "custom",
    random,
    firstGuesserId: first,
    deadlineAt: guessDeadline(tx),
  });
}

function nextTurn(tx: Tx, reason: "wrong" | "timeout" | "disconnect" | "left") {
  const round = tx.state.match!.round!;
  const order = round.turnOrder.filter((id) => {
    const c = tx.player(id)?.connection;
    return c !== "left" && c !== "offline";
  });
  if (order.length === 0) {
    finishRound(tx, "abandoned", null, 0);
    return;
  }
  const idx = round.currentGuesserId ? order.indexOf(round.currentGuesserId) : -1;
  const next = idx === -1 ? (order.find((id) => round.turnOrder.indexOf(id) > round.turnOrder.indexOf(round.currentGuesserId ?? "")) ?? order[0]) : order[(idx + 1) % order.length];
  tx.emit({ type: "HM_TURN", playerId: next, deadlineAt: guessDeadline(tx), reason });
}

function keyOf(tx: Tx, raw: string): string {
  const lang = tx.state.match!.round!.language;
  const ch = [...raw.normalize("NFC")][0] ?? "";
  const key = normalizeLetter(ch, lang);
  if (!key) fail("INVALID_LETTER");
  return key;
}

function guess(tx: Tx, raw: string) {
  const me = actor(tx);
  const round = tx.state.match?.round;
  if (!round || round.result) fail("WRONG_PHASE");
  if (tx.state.phase === "HM_RACE") {
    const rp = round.race?.[me.id];
    if (!rp || rp.status !== "playing") fail("NOT_YOUR_TURN");
    const key = keyOf(tx, raw);
    const mine = tx.state.private.race[me.id] ?? [];
    if (mine.includes(key)) fail("ALREADY_GUESSED", { letter: key });
    raceGuess(tx, me.id, key, null);
    return { personal: hangmanPersonal(tx.state, me.id) };
  }

  if (tx.state.phase !== "HM_GUESSING") fail("WRONG_PHASE");
  if (round.currentGuesserId !== me.id) fail("NOT_YOUR_TURN");
  const key = keyOf(tx, raw);
  if (round.guessed.includes(key)) fail("ALREADY_GUESSED", { letter: key });
  masterGuess(tx, me.id, key, null);
}

function masterGuess(tx: Tx, playerId: string, key: string, auto: "bot" | null) {
  const round = tx.state.match!.round!;
  const word = tx.state.private.word!;
  const positions = positionsOf(word, key, round.language);
  const chars = positions.map((i) => [...word][i]);
  const correct = positions.length > 0;
  tx.emit({ type: "HM_LETTER", playerId, letter: key, positions, chars, correct, deadlineAt: guessDeadline(tx), auto });
  const after = tx.state.match!.round!;
  if (correct && after.mask && isSolved(after.mask)) {
    finishRound(tx, "solved", playerId, 0);
    return;
  }
  if (!correct) {
    if (after.wrong.length >= tx.settings.lives) finishRound(tx, "hanged", null, 0);
    else nextTurn(tx, "wrong");
  }
}

function solve(tx: Tx, attempt: string) {
  const me = actor(tx);
  const round = tx.state.match?.round;
  if (!round || round.result) fail("WRONG_PHASE");
  const word = tx.state.private.word!;
  const lang = round.language;
  const text = attempt.trim().slice(0, 40);
  if (!text) fail("INVALID_WORD", { reason: "too_short" });
  const correct = solveKey(text, lang) === solveKey(word, lang);

  if (tx.state.phase === "HM_RACE") {
    const rp = round.race?.[me.id];
    if (!rp || rp.status !== "playing") fail("NOT_YOUR_TURN");
    raceSolve(tx, me.id, text, correct);
    return { personal: hangmanPersonal(tx.state, me.id), correct };
  }

  if (tx.state.phase !== "HM_GUESSING") fail("WRONG_PHASE");
  if (round.currentGuesserId !== me.id) fail("NOT_YOUR_TURN");
  if (correct) {
    const hidden = (round.mask ?? []).filter((c) => c === null).length;
    finishRound(tx, "solved", me.id, hidden);
    return { correct };
  }
  tx.emit({ type: "HM_SOLVE_FAILED", playerId: me.id, guess: text });
  if (tx.state.match!.round!.wrong.length >= tx.settings.lives) finishRound(tx, "hanged", null, 0);
  else nextTurn(tx, "wrong");
  return { correct };
}

function raceStatus(tx: Tx, playerId: string) {
  const round = tx.state.match!.round!;
  const word = tx.state.private.word!;
  const lang = round.language;
  const entries = tx.state.private.race[playerId] ?? [];
  const letters = new Set(entries.filter((x) => !x.startsWith("*")));
  const mask = maskFor(word, letters, lang);
  const chars = [...word];
  const revealed = mask.filter((c, i) => c !== null && !isSeparator(chars[i])).length;
  const wrong = entries.filter((x) => x.startsWith("*") || positionsOf(word, x, lang).length === 0).length;
  return { mask, revealed, wrong, guesses: entries.length };
}

function raceGuess(tx: Tx, playerId: string, key: string, auto: "bot" | null) {
  tx.priv((p) => void (p.race[playerId] = [...(p.race[playerId] ?? []), key]));
  const r = raceStatus(tx, playerId);
  const correct = positionsOf(tx.state.private.word!, key, tx.state.match!.round!.language).length > 0;
  const status = isSolved(r.mask) ? "solved" : r.wrong >= tx.settings.lives ? "hanged" : "playing";
  tx.emit({ type: "HM_RACE_PROGRESS", playerId, correct, revealed: r.revealed, wrong: r.wrong, guesses: r.guesses, status, finishedAt: status === "playing" ? null : tx.now, auto });
  settleRace(tx);
}

function raceSolve(tx: Tx, playerId: string, text: string, correct: boolean) {
  const rp = tx.state.match!.round!.race![playerId];
  if (correct) {
    tx.emit({ type: "HM_RACE_PROGRESS", playerId, correct: true, revealed: rp.total, wrong: rp.wrong, guesses: rp.guesses + 1, status: "solved", finishedAt: tx.now, auto: null });
  } else {
    tx.priv((p) => void (p.race[playerId] = [...(p.race[playerId] ?? []), `*${text}`]));
    const r = raceStatus(tx, playerId);
    const status = r.wrong >= tx.settings.lives ? "hanged" : "playing";
    tx.emit({ type: "HM_RACE_PROGRESS", playerId, correct: false, revealed: r.revealed, wrong: r.wrong, guesses: r.guesses, status, finishedAt: status === "playing" ? null : tx.now, auto: null });
  }
  settleRace(tx);
}

/** Race ends when nobody is still playing. */
function settleRace(tx: Tx) {
  const round = tx.state.match?.round;
  if (!round || round.result || round.masterId !== null || !round.race) return;
  if (Object.values(round.race).some((r) => r.status === "playing")) return;
  finishRound(tx, "race", null, 0);
}

function finishRound(tx: Tx, outcome: HmOutcome, solverId: string | null, solveBonusHidden: number, endMatch: HmMatchResult["reason"] | null = null) {
  const match = tx.state.match!;
  const round = match.round!;
  const word = tx.state.private.word ?? "";
  const scores: Record<string, HmScore> = structuredClone(match.scores);
  const points: Record<string, number> = { ...round.points };
  const add = (id: string, n: number) => {
    points[id] = (points[id] ?? 0) + n;
    if (scores[id]) scores[id].points += n;
  };
  let ranking: string[] = [];

  if (outcome === "solved" && solverId) {
    add(solverId, HM_POINTS.solve + solveBonusHidden);
    if (scores[solverId]) {
      scores[solverId].wordsSolved += 1;
      scores[solverId].roundWins += 1;
      scores[solverId].lettersFound += solveBonusHidden;
    }
  } else if (outcome === "hanged" && round.masterId) {
    add(round.masterId, HM_POINTS.hanged);
    if (scores[round.masterId]) {
      scores[round.masterId].hangmen += 1;
      scores[round.masterId].roundWins += 1;
    }
  } else if (outcome === "race" && round.race) {
    const entries = Object.entries(round.race);
    const solvers = entries
      .filter(([, r]) => r.status === "solved")
      .sort((a, b) => (a[1].finishedAt ?? 0) - (b[1].finishedAt ?? 0) || a[1].wrong - b[1].wrong)
      .map(([id]) => id);
    const others = entries
      .filter(([, r]) => r.status !== "solved")
      .sort((a, b) => b[1].revealed - a[1].revealed || a[1].wrong - b[1].wrong)
      .map(([id]) => id);
    ranking = [...solvers, ...others];
    solvers.forEach((id, i) => {
      add(id, HM_POINTS.race[Math.min(i, HM_POINTS.race.length - 1)]);
      if (scores[id]) scores[id].wordsSolved += 1;
    });
    if (solvers[0] && scores[solvers[0]]) scores[solvers[0]].roundWins += 1;
    for (const [id, r] of entries) if (scores[id]) scores[id].lettersFound += r.revealed;
  }

  const result: HmRoundResult = {
    roundNumber: round.number,
    word,
    masterId: round.masterId,
    outcome,
    solverId: outcome === "solved" ? solverId : outcome === "race" ? (ranking.find((id) => round.race?.[id]?.status === "solved") ?? null) : null,
    points,
    ranking,
    endedAt: tx.now,
  };
  const remaining = match.playerIds.filter((id) => tx.player(id)?.connection !== "left").length;
  const over = endMatch !== null || remaining < 2 || match.roundsPlayed + 1 >= match.totalRounds;
  tx.emit({ type: "HM_ROUND_ENDED", result, scores, phaseEndsAt: over ? null : tx.now + HM_TIMING.intermissionMs });
  if (over) finishMatch(tx, endMatch ?? (remaining < 2 ? "insufficient_players" : "completed"));
}

function finishMatch(tx: Tx, reason: HmMatchResult["reason"]) {
  const match = tx.state.match!;
  const left = new Set(match.playerIds.filter((id) => tx.player(id)?.connection === "left"));
  const cmp = (a: HmScore, b: HmScore) => b.points - a.points || b.roundWins - a.roundWins || a.wrongGuesses - b.wrongGuesses;
  const sorted = match.playerIds
    .map((id) => match.scores[id])
    .filter(Boolean)
    .sort((a, b) => Number(left.has(a.playerId)) - Number(left.has(b.playerId)) || cmp(a, b));
  const standings: HmMatchResult["standings"] = [];
  sorted.forEach((s, i) => {
    const prev = sorted[i - 1];
    const tied = prev && left.has(prev.playerId) === left.has(s.playerId) && cmp(prev, s) === 0;
    standings.push({ playerId: s.playerId, rank: tied ? standings[i - 1].rank : i + 1, points: s.points });
  });
  tx.emit({
    type: "HM_MATCH_ENDED",
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
    if (idle <= HM_TIMING.reconnectingAfterMs) status = "online";
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
  kind: "phase" | "master_bot" | "choose_timeout" | "master_gone" | "guesser_bot" | "guesser_gone" | "guess_timeout" | "race_bot" | "race_gone" | "race_timeout";
  playerId?: string;
}

/** Everything the lazy clock may need to do, earliest first. Shared by the server clock and client tick scheduling. */
function dues(state: HangmanRoomState, now: number): Due[] {
  const out: Due[] = [];
  const round = state.match?.round;
  const player = (id: string | null | undefined) => state.players.find((p) => p.id === id);
  switch (state.phase) {
    case "HM_STARTING":
    case "HM_ROUND_RESULTS":
      if (state.phaseEndsAt !== null) out.push({ at: state.phaseEndsAt, kind: "phase" });
      break;
    case "HM_CHOOSING": {
      const m = player(round?.masterId);
      if (m?.isBot) out.push({ at: (round?.startedAt ?? now) + HM_TIMING.botDelayMs, kind: "master_bot" });
      if (m && (m.connection === "offline" || m.connection === "left")) out.push({ at: now, kind: "master_gone" });
      if (state.phaseEndsAt !== null) out.push({ at: state.phaseEndsAt, kind: "choose_timeout" });
      break;
    }
    case "HM_GUESSING": {
      const g = player(round?.currentGuesserId);
      if (!g || !round) break;
      if (g.connection === "offline" || g.connection === "left") out.push({ at: now, kind: "guesser_gone", playerId: g.id });
      else if (g.connection === "reconnecting") out.push({ at: Math.max(g.disconnectedAt ?? now, round.turnStartedAt ?? 0) + HM_TIMING.disconnectSkipMs, kind: "guesser_gone", playerId: g.id });
      if (g.isBot) out.push({ at: (round.turnStartedAt ?? now) + HM_TIMING.botDelayMs, kind: "guesser_bot", playerId: g.id });
      if (round.deadlineAt !== null) out.push({ at: round.deadlineAt, kind: "guess_timeout" });
      break;
    }
    case "HM_RACE": {
      if (!round?.race) break;
      for (const [id, r] of Object.entries(round.race)) {
        if (r.status !== "playing") continue;
        const p = player(id);
        if (!p) continue;
        if (p.connection === "offline" || p.connection === "left") out.push({ at: now, kind: "race_gone", playerId: id });
        if (p.isBot) out.push({ at: round.startedAt + (r.guesses + 1) * HM_TIMING.botDelayMs, kind: "race_bot", playerId: id });
      }
      if (state.phaseEndsAt !== null) out.push({ at: state.phaseEndsAt, kind: "race_timeout" });
      break;
    }
  }
  return out.sort((a, b) => a.at - b.at);
}

export function nextWakeHangman(state: HangmanRoomState, now: number): number | null {
  return dues(state, now)[0]?.at ?? null;
}

function timeStep(tx: Tx): boolean {
  const due = dues(tx.state, tx.now).find((d) => d.at <= tx.now);
  if (!due) return false;
  const round = tx.state.match?.round;
  const lang = round?.language ?? "en";
  switch (due.kind) {
    case "phase":
      if (tx.state.phase === "HM_STARTING" || (tx.state.phase === "HM_ROUND_RESULTS" && !tx.state.match?.result)) beginRound(tx);
      else return false;
      return true;
    case "master_bot":
    case "choose_timeout":
    case "master_gone":
      setWord(tx, pickWord(tx), true);
      return true;
    case "guesser_gone":
      nextTurn(tx, "disconnect");
      return true;
    case "guess_timeout":
      nextTurn(tx, "timeout");
      return true;
    case "guesser_bot": {
      const bot = tx.player(due.playerId)!;
      const guessed = new Set(round!.guessed.filter((x) => [...x].length === 1));
      masterGuess(tx, bot.id, botLetter(bot.botLevel ?? "normal", lang, round!.mask ?? [], guessed, tx.ctx.rng), "bot");
      return true;
    }
    case "race_bot": {
      const bot = tx.player(due.playerId)!;
      const mine = new Set((tx.state.private.race[bot.id] ?? []).filter((x) => !x.startsWith("*")));
      const mask = maskFor(tx.state.private.word!, mine, lang);
      raceGuess(tx, bot.id, botLetter(bot.botLevel ?? "normal", lang, mask, mine, tx.ctx.rng), "bot");
      return true;
    }
    case "race_gone":
      dropFromRound(tx, due.playerId!, "disconnect");
      return true;
    case "race_timeout": {
      for (const [id, r] of Object.entries(round!.race ?? {})) {
        if (r.status === "playing") tx.emit({ type: "HM_RACE_PROGRESS", playerId: id, correct: false, revealed: r.revealed, wrong: r.wrong, guesses: r.guesses, status: "timeup", finishedAt: tx.now, auto: "timeup" });
      }
      settleRace(tx);
      return true;
    }
  }
}
