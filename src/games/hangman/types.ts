import type { BotLevel, PlayerColor, RoomPlayer } from "@/game-engine";
import type { HmLanguage } from "./letters";
import type { HmCategory } from "./words";

export type HangmanMode = "hangman_master" | "hangman_race";
export type HmCategoryChoice = HmCategory | "mixed";
export type HmTimer = 0 | 15 | 30 | 45 | 60;
export type HmRaceTimer = 0 | 60 | 90 | 120 | 180;

export interface HangmanSettings {
  gameMode: HangmanMode;
  maxPlayers: 2 | 3 | 4;
  language: HmLanguage;
  category: HmCategoryChoice;
  /** Word master: rounds per player (1–3). Race: total rounds. */
  rounds: number;
  lives: 6 | 9;
  guessTimer: HmTimer;
  raceTimer: HmRaceTimer;
  spectators: boolean;
  disconnectGraceSeconds: number;
}

export type HangmanPhase =
  | "ROOM_LOBBY"
  | "HM_STARTING"
  | "HM_CHOOSING"
  | "HM_GUESSING"
  | "HM_RACE"
  | "HM_ROUND_RESULTS"
  | "HM_MATCH_RESULTS"
  | "FINISHED";

export interface HmScore {
  playerId: string;
  nickname: string;
  avatar: string;
  color: PlayerColor;
  points: number;
  roundWins: number;
  lettersFound: number;
  wordsSolved: number;
  wrongGuesses: number;
  /** Word master rounds where the guessers were hanged. */
  hangmen: number;
}

export type HmRaceStatus = "playing" | "solved" | "hanged" | "timeup" | "out";

export interface HmRacePlayer {
  revealed: number;
  total: number;
  wrong: number;
  /** Number of guesses made (a count only — reveals nothing about the word). */
  guesses: number;
  status: HmRaceStatus;
  finishedAt: number | null;
}

export interface HmLastGuess {
  playerId: string;
  letter: string;
  correct: boolean;
  count: number;
  at: number;
}

export interface HmRound {
  id: string;
  number: number;
  /** Word master (null in race mode). */
  masterId: string | null;
  category: HmCategoryChoice | "custom";
  language: HmLanguage;
  /** Shared public board (word master). Race: separators only — boards are private. */
  mask: Array<string | null> | null;
  guessed: string[];
  wrong: string[];
  lastGuess: HmLastGuess | null;
  lastSolveFail: { playerId: string; guess: string; at: number } | null;
  turnOrder: string[];
  currentGuesserId: string | null;
  turnStartedAt: number | null;
  deadlineAt: number | null;
  race: Record<string, HmRacePlayer> | null;
  /** Points earned so far this round (letters; bonuses are added at the end). */
  points: Record<string, number>;
  startedAt: number;
  endedAt: number | null;
  result: HmRoundResult | null;
}

export type HmOutcome = "solved" | "hanged" | "race" | "abandoned";

export interface HmRoundResult {
  roundNumber: number;
  word: string;
  masterId: string | null;
  outcome: HmOutcome;
  solverId: string | null;
  points: Record<string, number>;
  /** Race: finishing order (solvers first). */
  ranking: string[];
  endedAt: number;
}

export interface HmStanding {
  playerId: string;
  rank: number;
  points: number;
}

export interface HmMatchResult {
  winnerIds: string[];
  standings: HmStanding[];
  reason: "completed" | "host_ended" | "insufficient_players";
  endedAt: number;
}

export interface HmMatch {
  id: string;
  number: number;
  startedAt: number;
  settings: HangmanSettings;
  playerIds: string[];
  scores: Record<string, HmScore>;
  roundsPlayed: number;
  totalRounds: number;
  round: HmRound | null;
  history: HmRoundResult[];
  result: HmMatchResult | null;
}

export interface HangmanRoomState {
  game: "hangman";
  roomId: string;
  code: string;
  createdAt: number;
  hostId: string;
  phase: HangmanPhase;
  phaseEndsAt: number | null;
  settings: HangmanSettings;
  players: RoomPlayer[];
  match: HmMatch | null;
  matchCount: number;
  spectatorCount: number;
  version: number;
}

export interface HangmanPrivate {
  guests: Record<string, string>;
  userIds: Record<string, string>;
  bans: string[];
  commandIds: string[];
  spectators: string[];
  /** The secret word of the current round (never sent to clients until the round ends). */
  word: string | null;
  /** Race mode: guessed keys per player (private boards). */
  race: Record<string, string[]>;
  /** Dev tools: queue of words to use next. */
  forcedWords: string[];
}

export interface HangmanServerState extends HangmanRoomState {
  private: HangmanPrivate;
}

/** Per-viewer data the server sends privately (never in the public event log). */
export interface HangmanPersonal {
  /** Word master: the secret word they chose. */
  secret: string | null;
  /** Race: the viewer's own board. */
  race: { mask: Array<string | null>; guessed: string[]; wrong: string[] } | null;
}

export type { BotLevel };
