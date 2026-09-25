import type { BotLevel, PlayerColor, RoomPlayer } from "@/game-engine";
import type { GwCategory } from "./cards";

export type GuessWhoMode = "guesswho_classic";
export type GwTurnTimer = 0 | 30 | 60 | 90;
export type GwBoardSize = 16 | 20 | 24;

export interface GuessWhoSettings {
  gameMode: GuessWhoMode;
  /** Always 2: Guess Who is a duel. */
  maxPlayers: 2;
  category: GwCategory;
  boardSize: GwBoardSize;
  /** Best of 1 / 3 / 5 rounds. */
  rounds: 1 | 3 | 5;
  turnTimer: GwTurnTimer;
  /** Players may type their own question for the opponent to answer. */
  freeQuestions: boolean;
  /** Classic: a wrong guess loses the round. Otherwise it just ends your turn. */
  wrongGuessLoses: boolean;
  spectators: boolean;
  disconnectGraceSeconds: number;
}

export type GuessWhoPhase = "ROOM_LOBBY" | "GW_STARTING" | "GW_PLAYING" | "GW_ROUND_RESULTS" | "GW_MATCH_RESULTS" | "FINISHED";

export type GwAnswer = "yes" | "no";

export interface GwLogEntry {
  n: number;
  askerId: string;
  kind: "preset" | "free" | "guess";
  questionId?: string;
  text?: string;
  answer?: GwAnswer;
  cardId?: string;
  correct?: boolean;
  at: number;
}

export interface GwPending {
  askerId: string;
  answererId: string;
  text: string;
  askedAt: number;
  deadlineAt: number;
}

export interface GwScore {
  playerId: string;
  nickname: string;
  avatar: string;
  color: PlayerColor;
  wins: number;
  questions: number;
  rightGuesses: number;
  wrongGuesses: number;
}

export type GwOutcome = "guessed" | "wrong_guess" | "abandoned";

export interface GwRoundResult {
  roundNumber: number;
  winnerId: string | null;
  outcome: GwOutcome;
  /** Who made the deciding guess, and which card. */
  guesserId: string | null;
  guessCardId: string | null;
  /** Both secret cards, revealed. */
  secrets: Record<string, string>;
  questions: number;
  endedAt: number;
}

export interface GwRound {
  id: string;
  number: number;
  category: GwCategory;
  /** Card ids on the board (same board for both players). */
  board: string[];
  currentId: string | null;
  turnStartedAt: number | null;
  deadlineAt: number | null;
  /** Cards each player has flipped down on their own board. */
  flipped: Record<string, string[]>;
  log: GwLogEntry[];
  pending: GwPending | null;
  startedAt: number;
  result: GwRoundResult | null;
}

export interface GwStanding {
  playerId: string;
  rank: number;
  wins: number;
}

export interface GwMatchResult {
  winnerIds: string[];
  standings: GwStanding[];
  reason: "completed" | "host_ended" | "insufficient_players";
  endedAt: number;
}

export interface GwMatch {
  id: string;
  number: number;
  startedAt: number;
  settings: GuessWhoSettings;
  playerIds: string[];
  scores: Record<string, GwScore>;
  roundsPlayed: number;
  /** Rounds needed to win the match. */
  target: number;
  round: GwRound | null;
  history: GwRoundResult[];
  result: GwMatchResult | null;
}

export interface GuessWhoRoomState {
  game: "guesswho";
  roomId: string;
  code: string;
  createdAt: number;
  hostId: string;
  phase: GuessWhoPhase;
  phaseEndsAt: number | null;
  settings: GuessWhoSettings;
  players: RoomPlayer[];
  match: GwMatch | null;
  matchCount: number;
  spectatorCount: number;
  version: number;
}

export interface GuessWhoPrivate {
  guests: Record<string, string>;
  userIds: Record<string, string>;
  bans: string[];
  commandIds: string[];
  spectators: string[];
  /** Secret card per player for the current round (never sent until the round ends). */
  secrets: Record<string, string>;
  /** Dev tools: secrets to deal next, by seat order. */
  forcedSecrets: string[];
}

export interface GuessWhoServerState extends GuessWhoRoomState {
  private: GuessWhoPrivate;
}

/** Per-viewer data the server sends privately (never in the public event log). */
export interface GuessWhoPersonal {
  /** Your own secret card this round. */
  card: string | null;
}

export type { BotLevel };
