import type { BotLevel, PlayerColor, RoomPlayer } from "@/game-engine";

export type C4Mode = "c4_classic" | "c4_popout";
export type C4BoardSize = "7x6" | "8x7" | "9x7";
export type C4Timer = 0 | 10 | 20 | 30;
export type C4Starter = "alternate" | "loser" | "random";

export interface Connect4Settings {
  gameMode: C4Mode;
  /** Always 2: Connect 4 is a duel. */
  maxPlayers: 2;
  boardSize: C4BoardSize;
  /** Discs in a row needed to win. */
  connect: 4 | 5;
  /** Best of 1 / 3 / 5 (draws are replayed, up to twice the rounds). */
  rounds: 1 | 3 | 5;
  turnTimer: C4Timer;
  /** Who opens the next round. */
  starter: C4Starter;
  spectators: boolean;
  disconnectGraceSeconds: number;
}

export type Connect4Phase = "ROOM_LOBBY" | "C4_STARTING" | "C4_PLAYING" | "C4_ROUND_RESULTS" | "C4_MATCH_RESULTS" | "FINISHED";

/** A disc on the board; `n` (move number that placed it) keeps it stable for animation. */
export interface C4Disc {
  p: string;
  n: number;
}

export type C4MoveKind = "drop" | "pop";

export interface C4LastMove {
  playerId: string;
  kind: C4MoveKind;
  column: number;
  row: number;
  n: number;
  auto: C4Auto;
  at: number;
}

export type C4Auto = "bot" | "timeout" | "disconnect" | null;

export interface C4Score {
  playerId: string;
  nickname: string;
  avatar: string;
  color: PlayerColor;
  wins: number;
  draws: number;
  discs: number;
  pops: number;
  /** Fewest own moves in a winning round. */
  fastestWin: number | null;
}

export type C4Outcome = "connect" | "draw" | "abandoned";

export interface C4RoundResult {
  roundNumber: number;
  winnerId: string | null;
  outcome: C4Outcome;
  /** Winning cells as [column, row] (row 0 = bottom). */
  line: Array<[number, number]> | null;
  moves: number;
  starterId: string;
  /** Final board: one string per column, bottom→top, "0"/"1" = index in match.playerIds. */
  snapshot: string[];
  endedAt: number;
}

export interface C4Round {
  id: string;
  number: number;
  cols: number;
  rows: number;
  connect: number;
  mode: C4Mode;
  /** One stack per column, bottom → top. */
  columns: C4Disc[][];
  starterId: string;
  currentId: string | null;
  turnStartedAt: number | null;
  deadlineAt: number | null;
  moves: number;
  lastMove: C4LastMove | null;
  startedAt: number;
  result: C4RoundResult | null;
}

export interface C4Standing {
  playerId: string;
  rank: number;
  wins: number;
}

export interface C4MatchResult {
  winnerIds: string[];
  standings: C4Standing[];
  reason: "completed" | "host_ended" | "insufficient_players";
  endedAt: number;
}

export interface C4Match {
  id: string;
  number: number;
  startedAt: number;
  settings: Connect4Settings;
  playerIds: string[];
  scores: Record<string, C4Score>;
  roundsPlayed: number;
  target: number;
  round: C4Round | null;
  history: C4RoundResult[];
  result: C4MatchResult | null;
}

export interface Connect4RoomState {
  game: "connect4";
  roomId: string;
  code: string;
  createdAt: number;
  hostId: string;
  phase: Connect4Phase;
  phaseEndsAt: number | null;
  settings: Connect4Settings;
  players: RoomPlayer[];
  match: C4Match | null;
  matchCount: number;
  spectatorCount: number;
  version: number;
}

export interface Connect4Private {
  guests: Record<string, string>;
  userIds: Record<string, string>;
  bans: string[];
  commandIds: string[];
  spectators: string[];
}

export interface Connect4ServerState extends Connect4RoomState {
  private: Connect4Private;
}

export type { BotLevel };
