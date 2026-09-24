import { describe, expect, it } from "vitest";
import { checkMove, closeTiles, getValidCombinations, hasValidCombination, isBlocked, isValidMove } from "../combinations";
import { TILE_VALUES } from "../types";

describe("getValidCombinations", () => {
  it("open [1..5], target 5 includes [5], [1,4], [2,3]", () => {
    const combos = getValidCombinations([1, 2, 3, 4, 5], 5);
    expect(combos).toContainEqual([5]);
    expect(combos).toContainEqual([1, 4]);
    expect(combos).toContainEqual([2, 3]);
    expect(combos).toHaveLength(3);
  });

  it("full board, target 7 lists every subset in order", () => {
    expect(getValidCombinations(TILE_VALUES, 7)).toEqual([[7], [1, 6], [2, 5], [3, 4], [1, 2, 4]]);
  });

  it("full board, target 8 matches the rulebook examples", () => {
    const combos = getValidCombinations(TILE_VALUES, 8);
    for (const c of [[8], [1, 7], [2, 6], [3, 5], [1, 2, 5], [1, 3, 4]]) expect(combos).toContainEqual(c);
    expect(combos).toHaveLength(6);
  });

  it("never uses a tile twice and only uses open tiles", () => {
    const open = [2, 4, 6, 9];
    for (let t = 2; t <= 12; t++) {
      for (const combo of getValidCombinations(open, t)) {
        expect(new Set(combo).size).toBe(combo.length);
        expect(combo.every((x) => open.includes(x))).toBe(true);
        expect(combo.reduce((a, b) => a + b, 0)).toBe(t);
      }
    }
  });

  it("matches brute force for every subset and total", () => {
    for (let mask = 0; mask < 1024; mask += 7) {
      const open = TILE_VALUES.filter((t) => mask & (1 << (t - 1)));
      for (let total = 1; total <= 12; total++) {
        let count = 0;
        for (let sub = 1; sub < 1024; sub++) {
          if ((sub & mask) !== sub) continue;
          const sum = TILE_VALUES.filter((t) => sub & (1 << (t - 1))).reduce((a, b) => a + b, 0);
          if (sum === total) count++;
        }
        expect(getValidCombinations(open, total)).toHaveLength(count);
        expect(hasValidCombination(open, total)).toBe(count > 0);
      }
    }
  });

  it("detects blocked boards", () => {
    expect(isBlocked([9, 10], 8)).toBe(true);
    expect(isBlocked([1, 2], 4)).toBe(true);
    expect(isBlocked([1, 3], 4)).toBe(false);
    expect(isBlocked([], 2)).toBe(true);
  });
});

describe("move validation", () => {
  const open = [1, 2, 4, 5, 6, 7, 8, 9, 10];
  it("accepts a correct selection", () => {
    expect(isValidMove(open, 8, [1, 7])).toBe(true);
    expect(checkMove(open, 8, [7, 1])).toEqual({ ok: true, tiles: [1, 7] });
  });
  it("rejects closed tiles, duplicates, wrong totals and junk", () => {
    expect(checkMove(open, 8, [3, 5])).toMatchObject({ ok: false, code: "TILE_CLOSED", tile: 3 });
    expect(checkMove(open, 8, [4, 4])).toMatchObject({ ok: false, code: "DUPLICATE_TILE" });
    expect(checkMove(open, 8, [2, 7])).toMatchObject({ ok: false, code: "WRONG_TOTAL", sum: 9 });
    expect(checkMove(open, 8, [])).toMatchObject({ ok: false, code: "EMPTY_SELECTION" });
    expect(checkMove(open, 8, ["8"])).toMatchObject({ ok: false, code: "INVALID_TILE" });
    expect(checkMove(open, 8, [8.5])).toMatchObject({ ok: false, code: "INVALID_TILE" });
  });
  it("closes tiles", () => {
    expect(closeTiles([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], [3, 5])).toEqual([1, 2, 4, 6, 7, 8, 9, 10]);
  });
});
