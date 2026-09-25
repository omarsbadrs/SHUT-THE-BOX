import type { C4BoardSize, Connect4Settings } from "./types";

export const C4_TIMING = {
  introMs: 3000,
  intermissionMs: 8000,
  /** Bots "think" this long before dropping. */
  botDelayMs: 900,
  reconnectingAfterMs: 15_000,
  /** A disconnected player's move is played for them after this long. */
  disconnectSkipMs: 12_000,
} as const;

export const BOARD_DIMS: Record<C4BoardSize, { cols: number; rows: number }> = {
  "7x6": { cols: 7, rows: 6 },
  "8x7": { cols: 8, rows: 7 },
  "9x7": { cols: 9, rows: 7 },
};

/** PopOut rounds could cycle forever: past this many moves the round is a draw. */
export const moveCap = (cols: number, rows: number) => cols * rows * 3;

export const DEFAULT_CONNECT4_SETTINGS: Connect4Settings = {
  gameMode: "c4_classic",
  maxPlayers: 2,
  boardSize: "7x6",
  connect: 4,
  rounds: 3,
  turnTimer: 0,
  starter: "alternate",
  spectators: false,
  disconnectGraceSeconds: 60,
};

export function normalizeConnect4Settings(input: Partial<Connect4Settings> | undefined): Connect4Settings {
  const s: Connect4Settings = { ...DEFAULT_CONNECT4_SETTINGS, ...(input ?? {}) };
  if (s.gameMode !== "c4_classic" && s.gameMode !== "c4_popout") s.gameMode = "c4_classic";
  s.maxPlayers = 2;
  if (!(s.boardSize in BOARD_DIMS)) s.boardSize = "7x6";
  if (s.connect !== 4 && s.connect !== 5) s.connect = 4;
  if (![1, 3, 5].includes(s.rounds)) s.rounds = 3;
  if (![0, 10, 20, 30].includes(s.turnTimer)) s.turnTimer = 0;
  if (!["alternate", "loser", "random"].includes(s.starter)) s.starter = "alternate";
  s.spectators = !!s.spectators;
  s.disconnectGraceSeconds = Math.min(300, Math.max(20, Math.round(s.disconnectGraceSeconds || 60)));
  return s;
}

/** Round wins needed to take the match (best of N). */
export const c4Target = (s: Connect4Settings) => Math.ceil(s.rounds / 2);
