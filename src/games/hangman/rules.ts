import type { HangmanSettings } from "./types";
import { CATEGORIES } from "./words";

export const HM_TIMING = {
  introMs: 3500,
  chooseMs: 45_000,
  intermissionMs: 9000,
  botDelayMs: 1400,
  reconnectingAfterMs: 15_000,
  /** A disconnected guesser loses their turn after this long. */
  disconnectSkipMs: 12_000,
} as const;

export const HM_POINTS = {
  /** Per revealed letter occurrence (word master mode). */
  letter: 1,
  /** Completing the word, by last letter or by solving. */
  solve: 3,
  /** Word master when the guessers are hanged. */
  hanged: 5,
  /** Race placement points for solvers, in finishing order. */
  race: [3, 2, 1, 1],
} as const;

export const DEFAULT_HANGMAN_SETTINGS: HangmanSettings = {
  gameMode: "hangman_master",
  maxPlayers: 4,
  language: "en",
  category: "mixed",
  rounds: 1,
  lives: 6,
  guessTimer: 30,
  raceTimer: 120,
  spectators: false,
  disconnectGraceSeconds: 60,
};

export function normalizeHangmanSettings(input: Partial<HangmanSettings> | undefined): HangmanSettings {
  const s: HangmanSettings = { ...DEFAULT_HANGMAN_SETTINGS, ...(input ?? {}) };
  if (s.gameMode !== "hangman_master" && s.gameMode !== "hangman_race") s.gameMode = "hangman_master";
  if (![2, 3, 4].includes(s.maxPlayers)) s.maxPlayers = 4;
  if (s.language !== "en" && s.language !== "ar") s.language = "en";
  if (s.category !== "mixed" && !CATEGORIES.includes(s.category)) s.category = "mixed";
  if (s.gameMode === "hangman_master") s.rounds = Math.min(3, Math.max(1, Math.round(s.rounds || 1)));
  else s.rounds = [3, 5, 7, 10].includes(s.rounds) ? s.rounds : 5;
  if (s.lives !== 6 && s.lives !== 9) s.lives = 6;
  if (![0, 15, 30, 45, 60].includes(s.guessTimer)) s.guessTimer = 30;
  if (![0, 60, 90, 120, 180].includes(s.raceTimer)) s.raceTimer = 120;
  s.spectators = !!s.spectators;
  s.disconnectGraceSeconds = Math.min(300, Math.max(20, Math.round(s.disconnectGraceSeconds || 60)));
  return s;
}

/** Word master: everyone is master `rounds` times. Race: fixed round count. */
export function totalRoundsFor(settings: HangmanSettings, playerCount: number): number {
  return settings.gameMode === "hangman_master" ? settings.rounds * playerCount : settings.rounds;
}
