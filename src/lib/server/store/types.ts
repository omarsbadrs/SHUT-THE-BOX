import type { GameEvent, MatchPlayerStats, MatchResult, RoomPlayer, RoundResult, GameSettings, ServerRoomState as ShutServerState } from "@/game-engine";
import type { HangmanServerState, HangmanSettings, HmEvent, HmMatchResult, HmRoundResult, HmScore } from "@/games/hangman";
import type { GuessWhoServerState, GuessWhoSettings, GwEvent, GwMatchResult, GwRoundResult, GwScore } from "@/games/guesswho";
import type { C4Event, C4MatchResult, C4RoundResult, C4Score, Connect4ServerState, Connect4Settings } from "@/games/connect4";

/** Any game's server state; stores only rely on roomId / code / version. */
export type ServerRoomState = ShutServerState | HangmanServerState | GuessWhoServerState | Connect4ServerState;
export type StoredEvent = GameEvent | HmEvent | GwEvent | C4Event;

type SummaryPlayer = Pick<RoomPlayer, "id" | "nickname" | "avatar" | "color" | "isBot">;

/** Immutable record of a finished SHUT10 match (shareable /results page). */
export interface MatchSummary {
  game?: "shut10";
  matchId: string;
  roomId: string;
  code: string;
  number: number;
  settings: GameSettings;
  players: SummaryPlayer[];
  stats: Record<string, MatchPlayerStats>;
  history: RoundResult[];
  result: MatchResult;
  startedAt: number;
  endedAt: number;
}

/** Immutable record of a finished Hangman match. */
export interface HangmanMatchSummary {
  game: "hangman";
  matchId: string;
  roomId: string;
  code: string;
  number: number;
  settings: HangmanSettings;
  players: SummaryPlayer[];
  scores: Record<string, HmScore>;
  history: HmRoundResult[];
  result: HmMatchResult;
  startedAt: number;
  endedAt: number;
}

/** Immutable record of a finished Guess Who duel. */
export interface GuessWhoMatchSummary {
  game: "guesswho";
  matchId: string;
  roomId: string;
  code: string;
  number: number;
  settings: GuessWhoSettings;
  players: SummaryPlayer[];
  scores: Record<string, GwScore>;
  history: GwRoundResult[];
  result: GwMatchResult;
  startedAt: number;
  endedAt: number;
}

/** Immutable record of a finished Connect 4 duel. */
export interface Connect4MatchSummary {
  game: "connect4";
  matchId: string;
  roomId: string;
  code: string;
  number: number;
  settings: Connect4Settings;
  players: SummaryPlayer[];
  /** Match player order: snapshots use "0"/"1" for these. */
  playerIds: string[];
  scores: Record<string, C4Score>;
  history: C4RoundResult[];
  result: C4MatchResult;
  startedAt: number;
  endedAt: number;
}

export type AnyMatchSummary = MatchSummary | HangmanMatchSummary | GuessWhoMatchSummary | Connect4MatchSummary;

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
  archiveMatch(summary: AnyMatchSummary): Promise<void>;
  findMatch(matchId: string): Promise<{ code: string; summary: AnyMatchSummary | null } | null>;
  recordAnalytics(rows: AnalyticsRow[]): Promise<void>;
  recordError(source: string, message: string, context: Record<string, unknown>): Promise<void>;
  linkProfile(userId: string, guestId: string, nickname: string | null, avatar: string | null): Promise<string>;
  adminOverview(): Promise<AdminOverview>;
}
