import type {
  AutoReason,
  BlockReason,
  ConnectionStatus,
  GameSettings,
  MatchPlayerStats,
  MatchResult,
  PersistedPhase,
  PlayerColor,
  RoomPlayer,
  RoundResult,
} from "./types";

/**
 * Every state change is an event. The server emits events inside an atomic
 * transition; clients fold the same events with the same reducer. Events never
 * contain secrets (guest ids, tokens).
 */
export type EventBody =
  | { type: "ROOM_CREATED"; roomId: string; code: string; hostId: string; settings: GameSettings; createdAt: number }
  | { type: "PLAYER_JOINED"; player: RoomPlayer }
  | { type: "PLAYER_LEFT"; playerId: string; reason: "left" | "kicked" | "timeout" }
  | { type: "PLAYER_UPDATED"; playerId: string; nickname?: string; avatar?: string; color?: PlayerColor }
  | { type: "PLAYER_READY"; playerId: string; ready: boolean }
  | { type: "HOST_CHANGED"; hostId: string; previousHostId: string; reason: "transfer" | "migration" | "left" }
  | { type: "SETTINGS_UPDATED"; settings: GameSettings }
  | { type: "PLAYER_CONNECTION"; playerId: string; status: ConnectionStatus }
  | { type: "SPECTATOR_JOINED"; count: number }
  | {
      type: "MATCH_STARTED";
      matchId: string;
      number: number;
      settings: GameSettings;
      playerIds: string[];
      phaseEndsAt: number;
    }
  | {
      type: "ROUND_STARTED";
      roundId: string;
      number: number;
      starterId: string;
      order: string[];
      outIds: string[];
      phase: Extract<PersistedPhase, "STARTING" | "ROUND_SETUP">;
      phaseEndsAt: number;
    }
  | {
      type: "TURN_STARTED";
      /** null in Race mode: every active player starts at once. */
      playerId: string | null;
      turnNumber: number;
      startedAt: number;
      deadlineAt: number | null;
      reason: "first" | "extra" | "continue";
    }
  | {
      type: "TURN_CHANGED";
      from: string | null;
      playerId: string;
      turnNumber: number;
      startedAt: number;
      deadlineAt: number | null;
    }
  | {
      type: "DICE_ROLLED";
      playerId: string;
      turnId: string;
      die1: number;
      die2: number | null;
      total: number;
      isDouble: boolean;
      diceCount: 1 | 2;
      validCount: number;
      deadlineAt: number | null;
      auto: AutoReason | null;
    }
  | {
      type: "TILES_CLOSED";
      playerId: string;
      turnId: string;
      tiles: number[];
      auto: AutoReason | null;
      /** Race mode: the player's next roll deadline. */
      nextDeadlineAt: number | null;
    }
  | { type: "HINT_USED"; playerId: string; tiles: number[] }
  | { type: "PLAYER_BLOCKED"; playerId: string; score: number; reason: BlockReason }
  | { type: "PLAYER_SHUT_BOX"; playerId: string }
  | { type: "TURN_SKIPPED"; playerId: string; reason: "disconnect" | "dev" }
  | { type: "EXTRA_TURN"; playerId: string }
  | { type: "ROUND_COMPLETED"; result: RoundResult; phaseEndsAt: number | null }
  | { type: "SCORE_UPDATED"; stats: Record<string, MatchPlayerStats> }
  | { type: "MATCH_COMPLETED"; result: MatchResult }
  | { type: "MATCH_PAUSED"; by: string }
  | { type: "MATCH_RESUMED"; by: string; shiftMs: number }
  | { type: "REMATCH_STARTED"; colors: Record<string, PlayerColor> | null }
  | { type: "RETURNED_TO_LOBBY" }
  | { type: "TILES_CORRECTED"; playerId: string; openTiles: number[]; by: "admin" | "dev" }
  | { type: "ROOM_CLOSED"; reason: "empty" | "admin" | "host" };

export type EventType = EventBody["type"];

export type GameEvent = EventBody & { seq: number; at: number };

export type EventOf<T extends EventType> = Extract<GameEvent, { type: T }>;
