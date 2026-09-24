import type { GameMode, GameSettings, MatchFormat, PlayerColor } from "./types";
import { COLORS } from "./types";

export const MIN_PLAYERS = 2;
export const MAX_PLAYERS = 4;
export const MAX_CUSTOM_ROUNDS = 20;
/** Hard safety cap for open-ended formats. */
export const ROUND_SAFETY_CAP = 99;
export const HINTS_PER_ROUND_LIMITED = 3;

/** Timing constants (ms). */
export const TIMING = {
  /** 3 · 2 · 1 · SHUT THE BOX · boards open · "X GOES FIRST". */
  matchIntroMs: 6500,
  roundSetupMs: 3200,
  intermissionMs: 15000,
  reconnectingAfterMs: 15000,
  disconnectWaitMs: 30000,
  botRollDelayMs: 1300,
  botMoveDelayMs: 1700,
} as const;

export const DEFAULT_SETTINGS: GameSettings = {
  gameMode: "faceoff",
  maxPlayers: 4,
  matchFormat: "best_of",
  rounds: 5,
  scoringMode: "round_wins",
  diceCount: 2,
  doubleExtraTurn: true,
  oneDieEndgame: false,
  oneDieThreshold: 7,
  rollTimer: 30,
  moveTimer: 30,
  hints: "off",
  spectators: false,
  privateRoom: true,
  disconnectGraceSeconds: 60,
  disconnectRule: "wait",
  tieBreak: "tiles",
  starterRule: "rotate",
};

export const MODE_PRESETS: Record<GameMode, Partial<GameSettings>> = {
  faceoff: { doubleExtraTurn: true },
  classic: { doubleExtraTurn: false },
  race: { doubleExtraTurn: false },
  tournament: { doubleExtraTurn: true, scoringMode: "match_points", matchFormat: "fixed" },
};

export function seatOf(color: PlayerColor): number {
  return COLORS.indexOf(color);
}

/** Turn-based modes pass the dice; race lets everyone roll simultaneously. */
export function isTurnBased(mode: GameMode): boolean {
  return mode !== "race";
}

/** Face-Off passes the dice after every roll; Classic plays a whole board per turn. */
export function passesAfterEveryRoll(mode: GameMode): boolean {
  return mode === "faceoff" || mode === "tournament";
}

export function doublesGrantExtraTurn(settings: GameSettings): boolean {
  return settings.doubleExtraTurn && passesAfterEveryRoll(settings.gameMode);
}

/** One-die endgame: allowed only when configured and every tile >= threshold is closed. */
export function canUseOneDie(openTiles: readonly number[], settings: GameSettings): boolean {
  if (!settings.oneDieEndgame) return false;
  return openTiles.every((t) => t < settings.oneDieThreshold);
}

/** Number of rounds after which the match must end regardless of wins. */
export function roundCap(settings: GameSettings): number {
  switch (settings.matchFormat) {
    case "single":
      return 1;
    case "best_of":
    case "fixed":
      return settings.rounds;
    case "first_to":
    case "endless":
      return ROUND_SAFETY_CAP;
  }
}

/** Round wins needed to clinch the match early, or null when not applicable. */
export function winsToClinch(settings: GameSettings): number | null {
  switch (settings.matchFormat) {
    case "best_of":
      return Math.floor(settings.rounds / 2) + 1;
    case "first_to":
      return settings.rounds;
    default:
      return null;
  }
}

/** Display total for "ROUND 2 / 5". null = open-ended. */
export function displayRoundTotal(settings: GameSettings): number | null {
  const format: MatchFormat = settings.matchFormat;
  if (format === "first_to" || format === "endless") return null;
  return roundCap(settings);
}

/** Clamp/repair a settings object so the engine never sees impossible values. */
export function normalizeSettings(input: Partial<GameSettings> | undefined): GameSettings {
  const s: GameSettings = { ...DEFAULT_SETTINGS, ...(input ?? {}) };
  s.diceCount = 2;
  if (![2, 3, 4].includes(s.maxPlayers)) s.maxPlayers = 4;
  if (s.matchFormat === "single") s.rounds = 1;
  if (s.matchFormat === "best_of" && ![3, 5, 7].includes(s.rounds)) s.rounds = 5;
  if (s.matchFormat === "first_to" && ![3, 5].includes(s.rounds)) s.rounds = 3;
  if (s.matchFormat === "fixed") s.rounds = Math.min(MAX_CUSTOM_ROUNDS, Math.max(1, Math.round(s.rounds || 1)));
  if (s.matchFormat === "endless") s.rounds = 0;
  s.oneDieThreshold = Math.min(10, Math.max(4, Math.round(s.oneDieThreshold || 7)));
  s.disconnectGraceSeconds = Math.min(300, Math.max(20, Math.round(s.disconnectGraceSeconds || 60)));
  return s;
}
