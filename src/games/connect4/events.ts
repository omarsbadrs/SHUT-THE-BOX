import type { ConnectionStatus, PlayerColor, RoomPlayer } from "@/game-engine";
import type { C4Auto, C4MatchResult, C4MoveKind, C4RoundResult, C4Score, Connect4Settings } from "./types";

/**
 * Connect 4 events. Lobby events share names and shapes with SHUT10 so the
 * database projection (room_players) works for every game. Game events are
 * prefixed C4_. Everything in Connect 4 is public — there are no secrets.
 */
export type C4EventBody =
  | { type: "ROOM_CREATED"; game: "connect4"; roomId: string; code: string; hostId: string; settings: Connect4Settings; createdAt: number }
  | { type: "PLAYER_JOINED"; player: RoomPlayer }
  | { type: "PLAYER_LEFT"; playerId: string; reason: "left" | "kicked" | "timeout" }
  | { type: "PLAYER_UPDATED"; playerId: string; nickname?: string; avatar?: string; color?: PlayerColor }
  | { type: "PLAYER_READY"; playerId: string; ready: boolean }
  | { type: "HOST_CHANGED"; hostId: string; previousHostId: string; reason: "transfer" | "migration" | "left" }
  | { type: "SETTINGS_UPDATED"; settings: Connect4Settings }
  | { type: "PLAYER_CONNECTION"; playerId: string; status: ConnectionStatus }
  | { type: "SPECTATOR_JOINED"; count: number }
  | { type: "ROOM_CLOSED"; reason: "empty" | "admin" | "host" }
  | { type: "C4_MATCH_STARTED"; matchId: string; number: number; settings: Connect4Settings; playerIds: string[]; target: number; phaseEndsAt: number }
  | { type: "C4_ROUND_STARTED"; roundId: string; number: number; cols: number; rows: number; connect: number; firstId: string; deadlineAt: number | null }
  | { type: "C4_MOVED"; playerId: string; kind: C4MoveKind; column: number; row: number; nextId: string; deadlineAt: number | null; auto: C4Auto }
  | { type: "C4_ROUND_ENDED"; result: C4RoundResult; scores: Record<string, C4Score>; phaseEndsAt: number | null }
  | { type: "C4_MATCH_ENDED"; result: C4MatchResult }
  | { type: "C4_REMATCH" }
  | { type: "C4_RETURNED_TO_LOBBY" };

export type C4Event = C4EventBody & { seq: number; at: number };
