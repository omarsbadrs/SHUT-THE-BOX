import "server-only";
import { z } from "zod";
import type { Command } from "@/game-engine";

const color = z.enum(["blue", "green", "red", "yellow"]);
const timer = z.union([z.literal(0), z.literal(15), z.literal(30), z.literal(45), z.literal(60)]);
const tile = z.number().int().min(1).max(10);
const die = z.number().int().min(1).max(6);
const id = z.string().min(1).max(64);

export const settingsSchema = z
  .object({
    gameMode: z.enum(["faceoff", "classic", "race", "tournament"]),
    maxPlayers: z.union([z.literal(2), z.literal(3), z.literal(4)]),
    matchFormat: z.enum(["single", "best_of", "first_to", "fixed", "endless"]),
    rounds: z.number().int().min(0).max(20),
    scoringMode: z.enum(["round_wins", "match_points", "cumulative_low"]),
    doubleExtraTurn: z.boolean(),
    oneDieEndgame: z.boolean(),
    oneDieThreshold: z.number().int().min(4).max(10),
    rollTimer: timer,
    moveTimer: timer,
    hints: z.enum(["off", "limited", "on", "all"]),
    spectators: z.boolean(),
    privateRoom: z.boolean(),
    disconnectGraceSeconds: z.number().int().min(20).max(300),
    disconnectRule: z.enum(["wait", "skip", "block"]),
    tieBreak: z.enum(["tiles", "tiles_roll", "shared"]),
    starterRule: z.enum(["rotate", "random"]),
  })
  .partial();

const profile = {
  nickname: z.string().max(40),
  avatar: z.string().max(16),
};

export const createRoomSchema = z.object({
  ...profile,
  color: color.nullable().optional(),
  settings: settingsSchema.optional(),
});

/** Every command a client may send. Admin-only commands are not accepted here. */
export const commandSchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("JOIN"), ...profile, color: color.nullable().optional() }),
  z.object({ type: z.literal("LEAVE") }),
  z.object({ type: z.literal("UPDATE_PROFILE"), nickname: profile.nickname.optional(), avatar: profile.avatar.optional(), color: color.optional() }),
  z.object({ type: z.literal("SET_READY"), ready: z.boolean() }),
  z.object({ type: z.literal("UPDATE_SETTINGS"), settings: settingsSchema }),
  z.object({ type: z.literal("KICK"), playerId: id, ban: z.boolean().optional() }),
  z.object({ type: z.literal("TRANSFER_HOST"), playerId: id }),
  z.object({ type: z.literal("ADD_BOT"), level: z.enum(["easy", "normal", "hard"]) }),
  z.object({ type: z.literal("START") }),
  z.object({ type: z.literal("ROLL"), diceCount: z.union([z.literal(1), z.literal(2)]).optional() }),
  z.object({ type: z.literal("CLOSE_TILES"), turnId: id, tiles: z.array(tile).min(1).max(10) }),
  z.object({ type: z.literal("USE_HINT") }),
  z.object({ type: z.literal("NEXT_ROUND") }),
  z.object({ type: z.literal("PAUSE") }),
  z.object({ type: z.literal("RESUME") }),
  z.object({ type: z.literal("END_MATCH") }),
  z.object({ type: z.literal("REMATCH"), shuffleColors: z.boolean().optional() }),
  z.object({ type: z.literal("BACK_TO_LOBBY") }),
  z.object({ type: z.literal("SPECTATE") }),
  z.object({ type: z.literal("TICK") }),
  z.object({ type: z.literal("CLOSE_ROOM") }),
  z.object({ type: z.literal("DEV_FORCE_DICE"), dice: z.array(z.tuple([die, die])).max(50) }),
  z.object({ type: z.literal("DEV_SET_TURN"), playerId: id }),
  z.object({ type: z.literal("DEV_SET_TILES"), playerId: id, openTiles: z.array(tile).max(10) }),
  z.object({ type: z.literal("DEV_BLOCK_PLAYER"), playerId: id }),
  z.object({ type: z.literal("DEV_SHUT_BOARD"), playerId: id }),
  z.object({ type: z.literal("DEV_NEXT_ROUND") }),
  z.object({ type: z.literal("DEV_SIMULATE_DISCONNECT"), playerId: id }),
  z.object({ type: z.literal("DEV_ADD_FAKE_PLAYERS"), count: z.number().int().min(1).max(3) }),
]);

export const commandRequestSchema = z.object({
  command: commandSchema,
  commandId: z.string().min(8).max(64).optional(),
});

export type ParsedCommand = z.infer<typeof commandSchema>;

// Compile-time check that the wire schema stays assignable to engine commands.
export const asCommand = (c: ParsedCommand): Command => c as Command;
