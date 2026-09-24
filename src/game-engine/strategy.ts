import { getValidCombinations } from "./combinations";
import type { RandomSource } from "./dice";
import { canUseOneDie } from "./rules";
import type { BotLevel, GameSettings } from "./types";

/**
 * Expected-value strategy. V(open set) is the expected final open-tile score
 * under optimal play, solved exactly by dynamic programming over all 1024
 * subsets of 1..10. Used by HARD bots, timeout auto-moves and the trainer.
 * Bots receive the same server dice as everyone else; they never peek.
 */

const TWO_DICE: Array<[number, number]> = (() => {
  const counts = new Map<number, number>();
  for (let a = 1; a <= 6; a++) for (let b = 1; b <= 6; b++) counts.set(a + b, (counts.get(a + b) ?? 0) + 1);
  return [...counts.entries()].map(([t, c]) => [t, c / 36] as [number, number]);
})();
const ONE_DIE: Array<[number, number]> = [1, 2, 3, 4, 5, 6].map((t) => [t, 1 / 6] as [number, number]);

function toMask(tiles: readonly number[]): number {
  return tiles.reduce((m, t) => m | (1 << (t - 1)), 0);
}

function maskSum(mask: number): number {
  let s = 0;
  for (let t = 1; t <= 10; t++) if (mask & (1 << (t - 1))) s += t;
  return s;
}

function maskTiles(mask: number): number[] {
  const out: number[] = [];
  for (let t = 1; t <= 10; t++) if (mask & (1 << (t - 1))) out.push(t);
  return out;
}

interface Table {
  value: Float64Array;
}

const tables = new Map<string, Table>();

function tableFor(oneDie: boolean, threshold: number): Table {
  const key = `${oneDie}:${threshold}`;
  const cached = tables.get(key);
  if (cached) return cached;

  const value = new Float64Array(1024);
  const sums = new Int32Array(1024);
  for (let m = 0; m < 1024; m++) sums[m] = maskSum(m);
  // Process masks by popcount so every submask is solved first.
  const masks = [...Array(1024).keys()].sort((a, b) => popcount(a) - popcount(b));
  const oneDieMask = (m: number) => oneDie && maskTiles(m).every((t) => t < threshold);

  for (const m of masks) {
    if (m === 0) {
      value[m] = 0;
      continue;
    }
    // best[t] = min V over submasks of m summing to t
    const best = new Float64Array(13).fill(Infinity);
    for (let sub = m; sub > 0; sub = (sub - 1) & m) {
      const t = sums[sub];
      if (t <= 12) {
        const v = value[m & ~sub];
        if (v < best[t]) best[t] = v;
      }
    }
    const ev = (dist: Array<[number, number]>) =>
      dist.reduce((acc, [t, p]) => acc + p * (best[t] === Infinity ? sums[m] : best[t]), 0);
    let v = ev(TWO_DICE);
    if (oneDieMask(m)) v = Math.min(v, ev(ONE_DIE));
    value[m] = v;
  }
  const table = { value };
  tables.set(key, table);
  return table;
}

function popcount(n: number): number {
  let c = 0;
  while (n) {
    n &= n - 1;
    c++;
  }
  return c;
}

export function expectedScore(openTiles: readonly number[], settings: Pick<GameSettings, "oneDieEndgame" | "oneDieThreshold">): number {
  return tableFor(settings.oneDieEndgame, settings.oneDieThreshold).value[toMask(openTiles)];
}

export interface RatedMove {
  tiles: number[];
  expectedScore: number;
}

/** Every legal combination with the expected final score after playing it (best first). */
export function rateMoves(
  openTiles: readonly number[],
  total: number,
  settings: Pick<GameSettings, "oneDieEndgame" | "oneDieThreshold">,
): RatedMove[] {
  const table = tableFor(settings.oneDieEndgame, settings.oneDieThreshold);
  const openMask = toMask(openTiles);
  return getValidCombinations(openTiles, total)
    .map((tiles) => ({ tiles, expectedScore: table.value[openMask & ~toMask(tiles)] }))
    .sort((a, b) => a.expectedScore - b.expectedScore || a.tiles.length - b.tiles.length);
}

/** "Prefer combinations that close larger numbers." */
function normalChoice(combos: number[][]): number[] {
  return [...combos].sort((a, b) => Math.max(...b) - Math.max(...a) || a.length - b.length)[0];
}

export function chooseMove(
  level: BotLevel,
  openTiles: readonly number[],
  total: number,
  settings: GameSettings,
  rng: RandomSource,
): number[] | null {
  const combos = getValidCombinations(openTiles, total);
  if (combos.length === 0) return null;
  switch (level) {
    case "easy":
      return combos[rng.int(0, combos.length - 1)];
    case "normal":
      return normalChoice(combos);
    case "hard":
      return rateMoves(openTiles, total, settings)[0].tiles;
  }
}

export function chooseDiceCount(level: BotLevel, openTiles: readonly number[], settings: GameSettings): 1 | 2 {
  if (!canUseOneDie(openTiles, settings)) return 2;
  if (level === "easy") return 2;
  if (level === "normal") return openTiles.reduce((a, b) => a + b, 0) <= 6 ? 1 : 2;
  // hard: compare exact expectations
  const table = tableFor(settings.oneDieEndgame, settings.oneDieThreshold);
  const mask = toMask(openTiles);
  const evFor = (dist: Array<[number, number]>) =>
    dist.reduce((acc, [t, p]) => {
      const opts = getValidCombinations(openTiles, t);
      if (!opts.length) return acc + p * maskSum(mask);
      return acc + p * Math.min(...opts.map((c) => table.value[mask & ~toMask(c)]));
    }, 0);
  return evFor(ONE_DIE) < evFor(TWO_DICE) ? 1 : 2;
}
