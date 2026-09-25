import "server-only";
import { z } from "zod";
import {
  createRoom as createShutRoom,
  executeCommand as executeShut,
  findPlayerIdByGuest as findShutPlayer,
  toPublicState as shutPublic,
  type Command as ShutCommand,
  type CommandContext,
  type GameEvent,
  type ServerRoomState,
  type PlayerColor,
} from "@/game-engine";
import {
  createHangmanRoom,
  executeHangman,
  findHmPlayerByGuest,
  hangmanPersonal,
  toPublicHangman,
  type HangmanServerState,
  type HmCommand,
  type HmEvent,
} from "@/games/hangman";
import {
  createGuessWhoRoom,
  executeGuessWho,
  findGwPlayerByGuest,
  guessWhoPersonal,
  toPublicGuessWho,
  type GuessWhoServerState,
  type GwCommand,
  type GwEvent,
} from "@/games/guesswho";
import { commandSchema as shutCommandSchema, settingsSchema as shutSettingsSchema } from "./schemas";

/**
 * Game registry: every room holds exactly one game. Rooms, sessions, storage,
 * realtime and presence are shared; rules live in each game's engine.
 */

export type GameId = "shut10" | "hangman" | "guesswho";
export type AnyServerState = ServerRoomState | HangmanServerState | GuessWhoServerState;
export type AnyEvent = GameEvent | HmEvent | GwEvent;
export type AnyServerCommand = ShutCommand | HmCommand | GwCommand;

/** SHUT10 rooms predate the `game` field, so a missing value means SHUT10. */
export function gameOf(state: object): GameId {
  const g = (state as { game?: string }).game;
  return g === "hangman" || g === "guesswho" ? g : "shut10";
}

export interface ExecOutcome {
  ok: boolean;
  state: AnyServerState;
  events: AnyEvent[];
  changed: boolean;
  duplicate?: boolean;
  data?: Record<string, unknown>;
  presence: Record<string, number>;
  error?: { code: string; params: Record<string, string | number> };
}

export interface CreateParams {
  roomId: string;
  code: string;
  nickname: string;
  avatar: string;
  color?: PlayerColor | null;
  guestId: string;
  userId?: string | null;
  settings?: unknown;
}

// ───────────────── Shared lobby commands ─────────────────

const color = z.enum(["blue", "green", "red", "yellow"]);
const id = z.string().min(1).max(64);
const lobbyCommands = [
  z.object({ type: z.literal("JOIN"), nickname: z.string().max(40), avatar: z.string().max(16), color: color.nullable().optional() }),
  z.object({ type: z.literal("LEAVE") }),
  z.object({ type: z.literal("UPDATE_PROFILE"), nickname: z.string().max(40).optional(), avatar: z.string().max(16).optional(), color: color.optional() }),
  z.object({ type: z.literal("SET_READY"), ready: z.boolean() }),
  z.object({ type: z.literal("KICK"), playerId: id, ban: z.boolean().optional() }),
  z.object({ type: z.literal("TRANSFER_HOST"), playerId: id }),
  z.object({ type: z.literal("ADD_BOT"), level: z.enum(["easy", "normal", "hard"]) }),
  z.object({ type: z.literal("START") }),
  z.object({ type: z.literal("SPECTATE") }),
  z.object({ type: z.literal("TICK") }),
  z.object({ type: z.literal("CLOSE_ROOM") }),
  z.object({ type: z.literal("NEXT_ROUND") }),
  z.object({ type: z.literal("END_MATCH") }),
  z.object({ type: z.literal("REMATCH"), shuffleColors: z.boolean().optional() }),
  z.object({ type: z.literal("BACK_TO_LOBBY") }),
  z.object({ type: z.literal("DEV_ADD_FAKE_PLAYERS"), count: z.number().int().min(1).max(3) }),
] as const;

// ───────────────── Hangman wire schema ─────────────────

export const hangmanSettingsSchema = z
  .object({
    gameMode: z.enum(["hangman_master", "hangman_race"]),
    maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    language: z.enum(["en", "ar"]),
    category: z.enum(["mixed", "animals", "countries", "food", "sports", "jobs", "home", "nature"]),
    rounds: z.number().int().min(1).max(10),
    lives: z.union([z.literal(6), z.literal(9)]),
    guessTimer: z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(45), z.literal(60)]),
    raceTimer: z.union([z.literal(0), z.literal(60), z.literal(90), z.literal(120), z.literal(180)]),
    spectators: z.boolean(),
    disconnectGraceSeconds: z.number().int().min(20).max(300),
  })
  .partial();

const hangmanCommandSchema = z.discriminatedUnion("type", [
  ...lobbyCommands,
  z.object({ type: z.literal("UPDATE_SETTINGS"), settings: hangmanSettingsSchema }),
  z.object({ type: z.literal("HM_SET_WORD"), word: z.string().min(1).max(60) }),
  z.object({ type: z.literal("HM_RANDOM_WORD") }),
  z.object({ type: z.literal("HM_GUESS"), letter: z.string().min(1).max(4) }),
  z.object({ type: z.literal("HM_SOLVE"), guess: z.string().min(1).max(60) }),
  z.object({ type: z.literal("DEV_HM_FORCE_WORD"), words: z.array(z.string().min(1).max(60)).max(20) }),
]);

// ───────────────── Guess Who wire schema ─────────────────

export const guessWhoSettingsSchema = z
  .object({
    gameMode: z.literal("guesswho_classic"),
    maxPlayers: z.literal(2),
    category: z.enum(["food", "stars", "singers", "footballers", "pharaohs", "nature", "everyday", "icons"]),
    boardSize: z.union([z.literal(16), z.literal(20), z.literal(24)]),
    rounds: z.union([z.literal(1), z.literal(3), z.literal(5)]),
    turnTimer: z.union([z.literal(0), z.literal(30), z.literal(60), z.literal(90)]),
    freeQuestions: z.boolean(),
    wrongGuessLoses: z.boolean(),
    spectators: z.boolean(),
    disconnectGraceSeconds: z.number().int().min(20).max(300),
  })
  .partial();

const cardId = z.string().min(3).max(64);
const guessWhoCommandSchema = z.discriminatedUnion("type", [
  ...lobbyCommands,
  z.object({ type: z.literal("UPDATE_SETTINGS"), settings: guessWhoSettingsSchema }),
  z.object({ type: z.literal("GW_ASK"), questionId: z.string().min(3).max(64) }),
  z.object({ type: z.literal("GW_ASK_FREE"), text: z.string().min(1).max(200) }),
  z.object({ type: z.literal("GW_ANSWER"), answer: z.enum(["yes", "no"]) }),
  z.object({ type: z.literal("GW_FLIP"), cardIds: z.array(cardId).min(1).max(24), down: z.boolean() }),
  z.object({ type: z.literal("GW_GUESS"), cardId }),
  z.object({ type: z.literal("DEV_GW_FORCE_SECRETS"), cards: z.array(cardId).max(2) }),
]);

// ───────────────── Registry ─────────────────

export function parseCommand(game: GameId, raw: unknown): AnyServerCommand | null {
  const schema = game === "hangman" ? hangmanCommandSchema : game === "guesswho" ? guessWhoCommandSchema : shutCommandSchema;
  const parsed = schema.safeParse(raw);
  return parsed.success ? (parsed.data as AnyServerCommand) : null;
}

export function execute(state: AnyServerState, command: AnyServerCommand, ctx: CommandContext, commandId?: string): ExecOutcome {
  switch (gameOf(state)) {
    case "hangman":
      return executeHangman(state as HangmanServerState, command as HmCommand, ctx, commandId);
    case "guesswho":
      return executeGuessWho(state as GuessWhoServerState, command as GwCommand, ctx, commandId);
    default:
      return executeShut(state as ServerRoomState, command as ShutCommand, ctx, commandId);
  }
}

export function findPlayerByGuest(state: AnyServerState, guestId: string): string | null {
  switch (gameOf(state)) {
    case "hangman":
      return findHmPlayerByGuest(state as HangmanServerState, guestId);
    case "guesswho":
      return findGwPlayerByGuest(state as GuessWhoServerState, guestId);
    default:
      return findShutPlayer(state as ServerRoomState, guestId);
  }
}

export function toPublic(state: AnyServerState) {
  switch (gameOf(state)) {
    case "hangman":
      return toPublicHangman(state as HangmanServerState);
    case "guesswho":
      return toPublicGuessWho(state as GuessWhoServerState);
    default:
      return shutPublic(state as ServerRoomState);
  }
}

/** Viewer-only data (Hangman secrets, Guess Who secret card). SHUT10 has none. */
export function personalView(state: AnyServerState, playerId: string | null) {
  switch (gameOf(state)) {
    case "hangman":
      return hangmanPersonal(state as HangmanServerState, playerId);
    case "guesswho":
      return guessWhoPersonal(state as GuessWhoServerState, playerId);
    default:
      return null;
  }
}

export function createForGame(game: GameId, params: CreateParams, ctx: Omit<CommandContext, "actorId" | "presence">) {
  if (game === "hangman") {
    const settings = hangmanSettingsSchema.safeParse(params.settings ?? {});
    return createHangmanRoom({ ...params, settings: settings.success ? settings.data : undefined }, ctx);
  }
  if (game === "guesswho") {
    const settings = guessWhoSettingsSchema.safeParse(params.settings ?? {});
    return createGuessWhoRoom({ ...params, settings: settings.success ? settings.data : undefined }, ctx);
  }
  const settings = shutSettingsSchema.safeParse(params.settings ?? {});
  return createShutRoom({ ...params, settings: settings.success ? settings.data : undefined }, ctx);
}

export function gameModeOf(state: AnyServerState): string {
  return state.settings.gameMode;
}
