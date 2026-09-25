import { GW_CATEGORIES } from "./cards";
import type { GuessWhoSettings } from "./types";

export const GW_TIMING = {
  introMs: 3500,
  intermissionMs: 9000,
  botDelayMs: 1800,
  /** Time the opponent has to answer a typed question. */
  answerMs: 45_000,
  reconnectingAfterMs: 15_000,
  /** A disconnected player loses their turn after this long. */
  disconnectSkipMs: 12_000,
} as const;

export const DEFAULT_GUESSWHO_SETTINGS: GuessWhoSettings = {
  gameMode: "guesswho_classic",
  maxPlayers: 2,
  category: "stars",
  boardSize: 24,
  rounds: 3,
  turnTimer: 60,
  freeQuestions: true,
  wrongGuessLoses: true,
  spectators: false,
  disconnectGraceSeconds: 60,
};

export function normalizeGuessWhoSettings(input: Partial<GuessWhoSettings> | undefined): GuessWhoSettings {
  const s: GuessWhoSettings = { ...DEFAULT_GUESSWHO_SETTINGS, ...(input ?? {}) };
  s.gameMode = "guesswho_classic";
  s.maxPlayers = 2;
  // Rooms saved before the split of "Singers & Footballers" keep playing with singers.
  if ((s.category as string) === "music_sport") s.category = "singers";
  if (!GW_CATEGORIES.includes(s.category)) s.category = "stars";
  if (![16, 20, 24].includes(s.boardSize)) s.boardSize = 24;
  if (![1, 3, 5].includes(s.rounds)) s.rounds = 3;
  if (![0, 30, 60, 90].includes(s.turnTimer)) s.turnTimer = 60;
  s.freeQuestions = s.freeQuestions !== false;
  s.wrongGuessLoses = s.wrongGuessLoses !== false;
  s.spectators = !!s.spectators;
  s.disconnectGraceSeconds = Math.min(300, Math.max(20, Math.round(s.disconnectGraceSeconds || 60)));
  return s;
}

/** Round wins needed to take the match (best of N). */
export const targetFor = (settings: GuessWhoSettings) => Math.ceil(settings.rounds / 2);
