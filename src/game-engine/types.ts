// Core domain types for SHUT10. This module is framework-free and shared by
// the server (authoritative) and the client (event folding / presentation).

export type PlayerColor = "blue" | "green" | "red" | "yellow";

/** Seat / turn order: BLUE → GREEN → RED → YELLOW. */
export const COLORS: readonly PlayerColor[] = ["blue", "green", "red", "yellow"];

export const TILE_VALUES: readonly number[] = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
export const MAX_OPEN_SCORE = 55;

export type TileState = {
  value: number;
  closed: boolean;
};

export type DiceRoll = {
  die1: number;
  /** null when the player chose the one-die endgame. */
  die2: number | null;
  total: number;
  isDouble: boolean;
  diceCount: 1 | 2;
};

export type GameMode = "faceoff" | "classic" | "race" | "tournament";
export type MatchFormat = "single" | "best_of" | "first_to" | "fixed" | "endless";
export type ScoringMode = "round_wins" | "match_points" | "cumulative_low";
export type HintMode = "off" | "limited" | "on" | "all";
export type DisconnectRule = "wait" | "skip" | "block";
export type TieBreakRule = "tiles" | "tiles_roll" | "shared";
export type StarterRule = "rotate" | "random";
export type TimerSeconds = 0 | 15 | 30 | 45 | 60;
export type BotLevel = "easy" | "normal" | "hard";

export interface GameSettings {
  gameMode: GameMode;
  maxPlayers: 2 | 3 | 4;
  matchFormat: MatchFormat;
  /** N for best_of / first_to / fixed. Ignored for single / endless. */
  rounds: number;
  scoringMode: ScoringMode;
  diceCount: 2;
  doubleExtraTurn: boolean;
  oneDieEndgame: boolean;
  /** One die may be used once every tile >= threshold is closed. */
  oneDieThreshold: number;
  rollTimer: TimerSeconds;
  moveTimer: TimerSeconds;
  hints: HintMode;
  spectators: boolean;
  privateRoom: boolean;
  disconnectGraceSeconds: number;
  disconnectRule: DisconnectRule;
  tieBreak: TieBreakRule;
  starterRule: StarterRule;
}

export type ConnectionStatus = "online" | "reconnecting" | "offline" | "left";

export interface RoomPlayer {
  id: string;
  nickname: string;
  avatar: string;
  color: PlayerColor;
  seat: number;
  isReady: boolean;
  isBot: boolean;
  botLevel: BotLevel | null;
  connection: ConnectionStatus;
  joinedAt: number;
  /** Start of the current continuous connection (host migration picks the oldest). */
  connectedAt: number;
  disconnectedAt: number | null;
}

/**
 * Explicit state machine. Persisted phases are the ones a room can rest in.
 * Transient phases happen inside one atomic server transition and reach
 * clients as events (the presentation layer animates them).
 */
export type PersistedPhase =
  | "ROOM_LOBBY"
  | "STARTING"
  | "ROUND_SETUP"
  | "PLAYER_TURN"
  | "AWAITING_TILE_SELECTION"
  | "ROUND_RESULTS"
  | "MATCH_RESULTS"
  | "FINISHED";

export type TransientPhase =
  | "DICE_ROLLING"
  | "RESOLVING_MOVE"
  | "PLAYER_BLOCKED"
  | "NEXT_PLAYER"
  | "ROUND_COMPLETE"
  | "INTERMISSION"
  | "REMATCH";

export type GamePhase = PersistedPhase | TransientPhase;

export type TurnStatus = "WAITING" | "ROLLED" | "AWAITING_SELECTION" | "RESOLVED" | "BLOCKED" | "EXPIRED";

export type AutoReason = "timeout" | "bot" | "disconnect";

export interface PendingRoll extends DiceRoll {
  turnId: string;
  rolledAt: number;
  /** Number of legal combinations, computed by the server at roll time. */
  validCount: number;
  auto: AutoReason | null;
}

export interface LastAction extends DiceRoll {
  turnId: string;
  closed: number[] | null;
  blocked: boolean;
  status: TurnStatus;
  at: number;
}

export type PlayerRoundStatus = "active" | "blocked" | "shut" | "out";

export type BlockReason = "no_move" | "timeout" | "disconnect" | "left" | "skip" | "absent" | "host" | "dev";

export interface PlayerRoundState {
  playerId: string;
  openTiles: number[];
  status: PlayerRoundStatus;
  pending: PendingRoll | null;
  last: LastAction | null;
  rolls: number;
  /** When this player's current action window started (turn start or last resolution). */
  turnStartedAt: number | null;
  /** Timer deadline for the current action (roll or move), server clock. */
  deadlineAt: number | null;
  hintsUsed: number;
  blockedReason: BlockReason | null;
  finalScore: number | null;
}

export interface RoundResultEntry {
  playerId: string;
  openTiles: number[];
  openTileSum: number;
  tilesClosed: number;
  placement: number;
  perfectBox: boolean;
  points: number;
  status: PlayerRoundStatus;
}

export type RoundEndReason = "shut" | "all_blocked" | "forfeit";

export interface RoundResult {
  roundId: string;
  roundNumber: number;
  winnerIds: string[];
  entries: RoundResultEntry[];
  reason: RoundEndReason;
  tieBreakRolls: Record<string, number[]> | null;
  endedAt: number;
}

export interface RoundState {
  id: string;
  number: number;
  starterId: string;
  order: string[];
  currentPlayerId: string | null;
  turnNumber: number;
  turnCounter: number;
  startedAt: number;
  players: Record<string, PlayerRoundState>;
  endedAt: number | null;
  result: RoundResult | null;
}

export interface MatchPlayerStats {
  playerId: string;
  color: PlayerColor;
  nickname: string;
  avatar: string;
  roundWins: number;
  matchPoints: number;
  cumulativeScore: number;
  perfectRounds: number;
  roundsPlayed: number;
  tilesClosed: number;
  diceRolls: number;
  doubles: number;
  bestRound: number | null;
  scores: number[];
}

export interface MatchStanding {
  playerId: string;
  rank: number;
  roundWins: number;
  matchPoints: number;
  cumulativeScore: number;
}

export type MatchEndReason = "completed" | "host_ended" | "insufficient_players";

export interface MatchResult {
  winnerIds: string[];
  standings: MatchStanding[];
  reason: MatchEndReason;
  endedAt: number;
}

export interface MatchState {
  id: string;
  number: number;
  startedAt: number;
  settings: GameSettings;
  playerIds: string[];
  stats: Record<string, MatchPlayerStats>;
  roundsPlayed: number;
  round: RoundState | null;
  history: RoundResult[];
  result: MatchResult | null;
}

export type HistoryKind = "roll" | "close" | "blocked" | "shut" | "skip" | "extra" | "round" | "hint";

export interface HistoryEntry {
  n: number;
  at: number;
  kind: HistoryKind;
  playerId: string | null;
  roundNumber: number;
  dice?: [number, number | null];
  total?: number;
  tiles?: number[];
  reason?: string;
  auto?: AutoReason | null;
}

export interface PauseState {
  at: number;
  by: string;
}

/** Everything a client is allowed to see. */
export interface RoomState {
  roomId: string;
  code: string;
  createdAt: number;
  hostId: string;
  phase: PersistedPhase;
  phaseEndsAt: number | null;
  settings: GameSettings;
  players: RoomPlayer[];
  match: MatchState | null;
  matchCount: number;
  paused: PauseState | null;
  spectatorCount: number;
  history: HistoryEntry[];
  historyCounter: number;
  version: number;
}

/** Server-only fields. Never sent to clients. */
export interface PrivateState {
  guests: Record<string, string>;
  userIds: Record<string, string>;
  bans: string[];
  commandIds: string[];
  spectators: string[];
  forcedDice: Array<[number, number]>;
}

export interface ServerRoomState extends RoomState {
  private: PrivateState;
}

/** Convenience per-player view used by UI and tests. */
export type PlayerGameState = {
  playerId: string;
  color: PlayerColor;
  openTiles: number[];
  blocked: boolean;
  roundScore: number | null;
};
