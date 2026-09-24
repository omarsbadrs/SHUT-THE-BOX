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
import { commandSchema as shutCommandSchema, settingsSchema as shutSettingsSchema } from "./schemas";

/**
 * Game registry: every room holds exactly one game. Rooms, sessions, storage,
 * realtime and presence are shared; rules live in each game's engine.
 */

export type GameId = "shut10" | "hangman";
export type AnyServerState = ServerRoomState | HangmanServerState;
export type AnyEvent = GameEvent | HmEvent;

/** SHUT10 rooms predate the `game` field, so a missing value means SHUT10. */
export function gameOf(state: object): GameId {
  return (state as { game?: string }).game === "hangman" ? "hangman" : "shut10";
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

// ───────────────── Hangman wire schema ─────────────────

const color = z.enum(["blue", "green", "red", "yellow"]);
const id = z.string().min(1).max(64);
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
  z.object({ type: z.literal("JOIN"), nickname: z.string().max(40), avatar: z.string().max(16), color: color.nullable().optional() }),
  z.object({ type: z.literal("LEAVE") }),
  z.object({ type: z.literal("UPDATE_PROFILE"), nickname: z.string().max(40).optional(), avatar: z.string().max(16).optional(), color: color.optional() }),
  z.object({ type: z.literal("SET_READY"), ready: z.boolean() }),
  z.object({ type: z.literal("UPDATE_SETTINGS"), settings: hangmanSettingsSchema }),
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
  z.object({ type: z.literal("HM_SET_WORD"), word: z.string().min(1).max(60) }),
  z.object({ type: z.literal("HM_RANDOM_WORD") }),
  z.object({ type: z.literal("HM_GUESS"), letter: z.string().min(1).max(4) }),
  z.object({ type: z.literal("HM_SOLVE"), guess: z.string().min(1).max(60) }),
  z.object({ type: z.literal("DEV_HM_FORCE_WORD"), words: z.array(z.string().min(1).max(60)).max(20) }),
  z.object({ type: z.literal("DEV_ADD_FAKE_PLAYERS"), count: z.number().int().min(1).max(3) }),
]);

// ───────────────── Registry ─────────────────

export function parseCommand(game: GameId, raw: unknown): ShutCommand | HmCommand | null {
  const parsed = game === "hangman" ? hangmanCommandSchema.safeParse(raw) : shutCommandSchema.safeParse(raw);
  return parsed.success ? (parsed.data as ShutCommand | HmCommand) : null;
}

export function execute(state: AnyServerState, command: ShutCommand | HmCommand, ctx: CommandContext, commandId?: string): ExecOutcome {
  if (gameOf(state) === "hangman") return executeHangman(state as HangmanServerState, command as HmCommand, ctx, commandId);
  return executeShut(state as ServerRoomState, command as ShutCommand, ctx, commandId);
}

export function findPlayerByGuest(state: AnyServerState, guestId: string): string | null {
  return gameOf(state) === "hangman" ? findHmPlayerByGuest(state as HangmanServerState, guestId) : findShutPlayer(state as ServerRoomState, guestId);
}

export function toPublic(state: AnyServerState) {
  return gameOf(state) === "hangman" ? toPublicHangman(state as HangmanServerState) : shutPublic(state as ServerRoomState);
}

/** Viewer-only data (Hangman secrets). SHUT10 has none. */
export function personalView(state: AnyServerState, playerId: string | null) {
  return gameOf(state) === "hangman" ? hangmanPersonal(state as HangmanServerState, playerId) : null;
}

export function createForGame(game: GameId, params: CreateParams, ctx: Omit<CommandContext, "actorId" | "presence">) {
  if (game === "hangman") {
    const settings = hangmanSettingsSchema.safeParse(params.settings ?? {});
    return createHangmanRoom({ ...params, settings: settings.success ? settings.data : undefined }, ctx);
  }
  const settings = shutSettingsSchema.safeParse(params.settings ?? {});
  return createShutRoom({ ...params, settings: settings.success ? settings.data : undefined }, ctx);
}

export function gameModeOf(state: AnyServerState): string {
  return state.settings.gameMode;
}
