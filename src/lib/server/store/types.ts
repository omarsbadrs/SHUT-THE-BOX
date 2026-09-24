import type { GameEvent, MatchPlayerStats, MatchResult, RoomPlayer, RoundResult, GameSettings, ServerRoomState as ShutServerState } from "@/game-engine";
import type { HangmanServerState, HmEvent } from "@/games/hangman";

/** Any game's server state; stores only rely on roomId / code / version. */
export type ServerRoomState = ShutServerState | HangmanServerState;
export type StoredEvent = GameEvent | HmEvent;

export interface MatchSummary {
  matchId: string;
  roomId: string;
  code: string;
  number: number;
  settings: GameSettings;
  players: Array<Pick<RoomPlayer, "id" | "nickname" | "avatar" | "color" | "isBot">>;
  stats: Record<string, MatchPlayerStats>;
  history: RoundResult[];
  result: MatchResult;
  startedAt: number;
  endedAt: number;
}

export interface AnalyticsRow {
  name: string;
  roomId: string | null;
  props: Record<string, unknown>;
  at: number;
}

export interface AdminRoomRow {
  roomId: string;
  code: string;
  phase: string;
  mode: string;
  players: number;
  version: number;
  updatedAt: string;
}

export interface AdminOverview {
  store: "memory" | "supabase";
  activeRooms: AdminRoomRow[];
  finishedMatches: Array<{ matchId: string; code: string; winner: string; rounds: number; endedAt: string }>;
  stats: {
    roomsCreated: number;
    matchesStarted: number;
    matchesCompleted: number;
    rematches: number;
    averageRoomSize: number;
    averageRounds: number;
    averageScore: number;
    perfectBoxes: number;
    completionRate: number;
    rematchRate: number;
  };
  errors: Array<{ source: string; message: string; at: string }>;
}

/**
 * Persistence boundary. `commit` must be atomic and version-checked: it
 * succeeds only if the stored version still equals `expectedVersion`.
 */
export interface RoomStore {
  readonly kind: "memory" | "supabase";
  createRoom(state: ServerRoomState, events: StoredEvent[]): Promise<"ok" | "code_taken">;
  loadRoomByCode(code: string): Promise<ServerRoomState | null>;
  commit(roomId: string, expectedVersion: number, state: ServerRoomState, events: StoredEvent[]): Promise<boolean>;
  eventsSince(roomId: string, seq: number, limit: number): Promise<StoredEvent[]>;
  touchPresence(roomId: string, entries: Record<string, number>): Promise<void>;
  getPresence(roomId: string): Promise<Record<string, number>>;
  archiveMatch(summary: MatchSummary): Promise<void>;
  findMatch(matchId: string): Promise<{ code: string; summary: MatchSummary | null } | null>;
  recordAnalytics(rows: AnalyticsRow[]): Promise<void>;
  recordError(source: string, message: string, context: Record<string, unknown>): Promise<void>;
  linkProfile(userId: string, guestId: string, nickname: string | null, avatar: string | null): Promise<string>;
  adminOverview(): Promise<AdminOverview>;
}
