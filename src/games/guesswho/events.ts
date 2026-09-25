import type { ConnectionStatus, PlayerColor, RoomPlayer } from "@/game-engine";
import type { GwCategory } from "./cards";
import type { GuessWhoSettings, GwAnswer, GwMatchResult, GwRoundResult, GwScore } from "./types";

/**
 * Guess Who events. Lobby events share names and shapes with SHUT10 so the
 * database projection (room_players) works for every game. Game events are
 * prefixed GW_. Secret cards never appear in events until GW_ROUND_ENDED.
 */
export type GwEventBody =
  | { type: "ROOM_CREATED"; game: "guesswho"; roomId: string; code: string; hostId: string; settings: GuessWhoSettings; createdAt: number }
  | { type: "PLAYER_JOINED"; player: RoomPlayer }
  | { type: "PLAYER_LEFT"; playerId: string; reason: "left" | "kicked" | "timeout" }
  | { type: "PLAYER_UPDATED"; playerId: string; nickname?: string; avatar?: string; color?: PlayerColor }
  | { type: "PLAYER_READY"; playerId: string; ready: boolean }
  | { type: "HOST_CHANGED"; hostId: string; previousHostId: string; reason: "transfer" | "migration" | "left" }
  | { type: "SETTINGS_UPDATED"; settings: GuessWhoSettings }
  | { type: "PLAYER_CONNECTION"; playerId: string; status: ConnectionStatus }
  | { type: "SPECTATOR_JOINED"; count: number }
  | { type: "ROOM_CLOSED"; reason: "empty" | "admin" | "host" }
  | { type: "GW_MATCH_STARTED"; matchId: string; number: number; settings: GuessWhoSettings; playerIds: string[]; target: number; phaseEndsAt: number }
  | { type: "GW_ROUND_STARTED"; roundId: string; number: number; category: GwCategory; board: string[]; firstId: string; deadlineAt: number | null }
  | { type: "GW_ASKED"; askerId: string; questionId: string; answer: GwAnswer; nextId: string; deadlineAt: number | null; auto: "bot" | null }
  | { type: "GW_FREE_ASKED"; askerId: string; answererId: string; text: string; deadlineAt: number }
  | { type: "GW_FREE_ANSWERED"; askerId: string; answer: GwAnswer; nextId: string; deadlineAt: number | null }
  | { type: "GW_FREE_EXPIRED"; askerId: string; deadlineAt: number | null }
  | { type: "GW_FLIPPED"; playerId: string; cardIds: string[]; down: boolean }
  | { type: "GW_WRONG_GUESS"; guesserId: string; cardId: string; nextId: string; deadlineAt: number | null }
  | { type: "GW_TURN"; playerId: string; deadlineAt: number | null; reason: "timeout" | "disconnect" | "left" }
  | { type: "GW_ROUND_ENDED"; result: GwRoundResult; scores: Record<string, GwScore>; phaseEndsAt: number | null }
  | { type: "GW_MATCH_ENDED"; result: GwMatchResult }
  | { type: "GW_REMATCH" }
  | { type: "GW_RETURNED_TO_LOBBY" };

export type GwEvent = GwEventBody & { seq: number; at: number };
