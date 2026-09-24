import type { RandomSource } from "./dice";
import type { PlayerRoundStatus, RoundResultEntry, TieBreakRule } from "./types";
import { TILE_VALUES } from "./types";

/** OPEN-TILE SCORE: sum of the tiles still open. Lower is better; 0 = shut the box. */
export function calculateOpenTileScore(openTiles: readonly number[]): number {
  return openTiles.reduce((sum, t) => sum + t, 0);
}

export function isShutBox(openTiles: readonly number[]): boolean {
  return openTiles.length === 0;
}

export function highestTile(openTiles: readonly number[]): number {
  return openTiles.length ? Math.max(...openTiles) : 0;
}

/** Match points for a placement among `playerCount` players: 4p → 3/2/1/0, 2p → 1/0. */
export function matchPointsFor(placement: number, playerCount: number): number {
  return Math.max(0, playerCount - placement);
}

export interface RankInput {
  playerId: string;
  openTiles: number[];
  status: PlayerRoundStatus;
  /** Players who left the match rank after everyone else. */
  forfeited: boolean;
}

export interface RankOutput {
  entries: RoundResultEntry[];
  winnerIds: string[];
  tieBreakRolls: Record<string, number[]> | null;
}

type Keyed = RankInput & { score: number; count: number; high: number; rolls: number[] };

function baseCompare(a: Keyed, b: Keyed, rule: TieBreakRule): number {
  if (a.forfeited !== b.forfeited) return a.forfeited ? 1 : -1;
  if (a.score !== b.score) return a.score - b.score;
  if (rule === "shared") return 0;
  if (a.count !== b.count) return a.count - b.count;
  if (a.high !== b.high) return a.high - b.high;
  return 0;
}

function rollCompare(a: Keyed, b: Keyed): number {
  // Higher roll-off total wins, compared round by round.
  const n = Math.max(a.rolls.length, b.rolls.length);
  for (let i = 0; i < n; i++) {
    const d = (b.rolls[i] ?? 0) - (a.rolls[i] ?? 0);
    if (d !== 0) return d;
  }
  return 0;
}

/**
 * Ranks a finished round. Tie order: open-tile score, then (unless "shared")
 * fewest open tiles, then lowest highest tile, then (for "tiles_roll") a
 * server dice roll-off. Equal players share a placement and its points.
 */
export function rankRound(inputs: RankInput[], rule: TieBreakRule, rng: RandomSource): RankOutput {
  const keyed: Keyed[] = inputs.map((p) => ({
    ...p,
    score: calculateOpenTileScore(p.openTiles),
    count: p.openTiles.length,
    high: highestTile(p.openTiles),
    rolls: [],
  }));
  keyed.sort((a, b) => baseCompare(a, b, rule) || a.playerId.localeCompare(b.playerId));

  let tieBreakRolls: Record<string, number[]> | null = null;
  if (rule === "tiles_roll") {
    // Resolve every group of fully tied players with dice roll-offs.
    let i = 0;
    while (i < keyed.length) {
      let j = i + 1;
      while (j < keyed.length && baseCompare(keyed[i], keyed[j], rule) === 0) j++;
      if (j - i > 1 && !keyed[i].forfeited) {
        const group = keyed.slice(i, j);
        let unresolved = group;
        for (let attempt = 0; attempt < 20 && unresolved.length > 1; attempt++) {
          for (const p of unresolved) p.rolls.push(rng.int(1, 6) + rng.int(1, 6));
          unresolved = group.filter((p) => group.some((q) => q !== p && rollCompare(p, q) === 0));
        }
        group.sort((a, b) => rollCompare(a, b) || a.playerId.localeCompare(b.playerId));
        keyed.splice(i, j - i, ...group);
        tieBreakRolls ??= {};
        for (const p of group) tieBreakRolls[p.playerId] = [...p.rolls];
      }
      i = j;
    }
  }

  const n = keyed.length;
  const entries: RoundResultEntry[] = [];
  keyed.forEach((p, idx) => {
    const prev = keyed[idx - 1];
    const tied =
      prev !== undefined &&
      baseCompare(prev, p, rule) === 0 &&
      (rule !== "tiles_roll" || rollCompare(prev, p) === 0);
    const placement = tied ? entries[idx - 1].placement : idx + 1;
    entries.push({
      playerId: p.playerId,
      openTiles: [...p.openTiles].sort((a, b) => a - b),
      openTileSum: p.score,
      tilesClosed: TILE_VALUES.length - p.count,
      placement,
      perfectBox: p.count === 0 && !p.forfeited,
      points: p.forfeited ? 0 : matchPointsFor(placement, n),
      status: p.status,
    });
  });

  const winnerIds = entries.filter((e) => e.placement === 1 && !keyed.find((k) => k.playerId === e.playerId)?.forfeited).map((e) => e.playerId);
  return { entries, winnerIds, tieBreakRolls };
}
