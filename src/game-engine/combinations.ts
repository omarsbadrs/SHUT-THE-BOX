/**
 * Legal-move generation. Every subset of the currently open tiles whose sum
 * equals the dice total is a legal move. Nothing here is hardcoded.
 */

function normalizeTiles(openTiles: readonly number[]): number[] {
  return [...new Set(openTiles)].filter((n) => Number.isInteger(n) && n > 0).sort((a, b) => a - b);
}

function compareCombos(a: number[], b: number[]): number {
  if (a.length !== b.length) return a.length - b.length;
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) return a[i] - b[i];
  }
  return 0;
}

/**
 * All subsets of `openTiles` summing to `diceTotal`, each sorted ascending.
 * Ordered by size, then lexicographically: [7], [1,6], [2,5], [3,4], [1,2,4].
 */
export function getValidCombinations(openTiles: readonly number[], diceTotal: number): number[][] {
  const tiles = normalizeTiles(openTiles);
  const out: number[][] = [];
  if (!Number.isInteger(diceTotal) || diceTotal <= 0) return out;
  const current: number[] = [];

  const search = (start: number, remaining: number) => {
    if (remaining === 0) {
      out.push([...current]);
      return;
    }
    for (let i = start; i < tiles.length; i++) {
      const tile = tiles[i];
      if (tile > remaining) break;
      current.push(tile);
      search(i + 1, remaining - tile);
      current.pop();
    }
  };

  search(0, diceTotal);
  return out.sort(compareCombos);
}

/** True when at least one legal combination exists (early exit). */
export function hasValidCombination(openTiles: readonly number[], diceTotal: number): boolean {
  const tiles = normalizeTiles(openTiles);
  if (!Number.isInteger(diceTotal) || diceTotal <= 0) return false;
  const search = (start: number, remaining: number): boolean => {
    if (remaining === 0) return true;
    for (let i = start; i < tiles.length; i++) {
      if (tiles[i] > remaining) return false;
      if (search(i + 1, remaining - tiles[i])) return true;
    }
    return false;
  };
  return search(0, diceTotal);
}

export function isBlocked(openTiles: readonly number[], diceTotal: number): boolean {
  return !hasValidCombination(openTiles, diceTotal);
}

export type MoveCheck =
  | { ok: true; tiles: number[] }
  | { ok: false; code: "EMPTY_SELECTION" | "DUPLICATE_TILE" | "TILE_CLOSED" | "INVALID_TILE" | "WRONG_TOTAL"; tile?: number; sum?: number };

/** Validates a proposed selection against the open tiles and dice total. */
export function checkMove(openTiles: readonly number[], diceTotal: number, selection: readonly unknown[]): MoveCheck {
  if (!Array.isArray(selection) || selection.length === 0) return { ok: false, code: "EMPTY_SELECTION" };
  const seen = new Set<number>();
  const open = new Set(openTiles);
  let sum = 0;
  for (const raw of selection) {
    if (typeof raw !== "number" || !Number.isInteger(raw) || raw < 1 || raw > 10) {
      return { ok: false, code: "INVALID_TILE" };
    }
    if (seen.has(raw)) return { ok: false, code: "DUPLICATE_TILE", tile: raw };
    if (!open.has(raw)) return { ok: false, code: "TILE_CLOSED", tile: raw };
    seen.add(raw);
    sum += raw;
  }
  if (sum !== diceTotal) return { ok: false, code: "WRONG_TOTAL", sum };
  return { ok: true, tiles: [...seen].sort((a, b) => a - b) };
}

export function isValidMove(openTiles: readonly number[], diceTotal: number, selection: readonly number[]): boolean {
  return checkMove(openTiles, diceTotal, selection).ok;
}

/** Returns the open tiles left after closing `tiles`. */
export function closeTiles(openTiles: readonly number[], tiles: readonly number[]): number[] {
  const closing = new Set(tiles);
  return openTiles.filter((t) => !closing.has(t));
}
