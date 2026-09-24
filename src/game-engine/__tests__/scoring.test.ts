import { describe, expect, it } from "vitest";
import { sequenceRandom } from "../dice";
import { isMatchOver, resolveMatch, statsAfterRound } from "../match";
import { normalizeSettings } from "../rules";
import { calculateOpenTileScore, matchPointsFor, rankRound } from "../scoring";
import { expectedScore, rateMoves } from "../strategy";
import type { MatchPlayerStats, RoundResult } from "../types";

const rng = sequenceRandom([3]);

describe("open-tile score", () => {
  it("sums open tiles; lower is better; shut = 0", () => {
    expect(calculateOpenTileScore([2, 4, 7])).toBe(13);
    expect(calculateOpenTileScore([])).toBe(0);
    expect(calculateOpenTileScore([1, 2, 3, 4, 5, 6, 7, 8, 9, 10])).toBe(55);
  });
});

describe("match points", () => {
  it("4 players: 3/2/1/0 · 2 players: 1/0", () => {
    expect([1, 2, 3, 4].map((p) => matchPointsFor(p, 4))).toEqual([3, 2, 1, 0]);
    expect([1, 2].map((p) => matchPointsFor(p, 2))).toEqual([1, 0]);
  });
});

describe("rankRound", () => {
  const p = (playerId: string, openTiles: number[]) => ({ playerId, openTiles, status: "blocked" as const, forfeited: false });

  it("orders by score, lowest first", () => {
    const r = rankRound([p("sara", [8, 9]), p("omar", [6]), p("ahmed", [3, 9])], "tiles", rng);
    expect(r.entries.map((e) => [e.playerId, e.openTileSum, e.placement])).toEqual([
      ["omar", 6, 1],
      ["ahmed", 12, 2],
      ["sara", 17, 3],
    ]);
    expect(r.winnerIds).toEqual(["omar"]);
  });

  it("ties: fewer open tiles, then lower highest tile", () => {
    const r = rankRound([p("a", [1, 2, 3]), p("b", [6]), p("c", [2, 4])], "tiles", rng);
    expect(r.entries.map((e) => e.playerId)).toEqual(["b", "c", "a"]);
    const r2 = rankRound([p("a", [1, 5]), p("b", [2, 4])], "tiles", rng);
    expect(r2.entries.map((e) => e.playerId)).toEqual(["b", "a"]);
  });

  it("identical boards share placement and points", () => {
    const r = rankRound([p("a", [2, 4]), p("b", [2, 4]), p("c", [9])], "tiles", rng);
    expect(r.entries.map((e) => e.placement)).toEqual([1, 1, 3]);
    expect(r.winnerIds.sort()).toEqual(["a", "b"]);
    expect(r.entries.map((e) => e.points)).toEqual([2, 2, 0]);
  });

  it("shared rule ignores tile counts", () => {
    const r = rankRound([p("a", [1, 5]), p("b", [6])], "shared", rng);
    expect(r.entries.map((e) => e.placement)).toEqual([1, 1]);
  });

  it("dice roll-off resolves full ties", () => {
    const r = rankRound([p("a", [2, 4]), p("b", [2, 4])], "tiles_roll", sequenceRandom([1, 1, 6, 6]));
    expect(r.entries.map((e) => e.placement)).toEqual([1, 2]);
    expect(r.winnerIds).toEqual(["b"]);
    expect(r.tieBreakRolls).toEqual({ a: [2], b: [12] });
  });

  it("perfect box is flagged and always first", () => {
    const r = rankRound([p("a", [1]), { ...p("b", []), status: "shut" as const }], "tiles", rng);
    expect(r.entries[0]).toMatchObject({ playerId: "b", perfectBox: true, openTileSum: 0, placement: 1 });
  });

  it("forfeited players rank last and cannot win", () => {
    const r = rankRound([{ ...p("a", []), forfeited: true }, p("b", [9])], "tiles", rng);
    expect(r.entries.map((e) => e.playerId)).toEqual(["b", "a"]);
    expect(r.winnerIds).toEqual(["b"]);
  });
});

function stats(id: string, patch: Partial<MatchPlayerStats> = {}): MatchPlayerStats {
  return {
    playerId: id,
    color: "blue",
    nickname: id,
    avatar: "🦊",
    roundWins: 0,
    matchPoints: 0,
    cumulativeScore: 0,
    perfectRounds: 0,
    roundsPlayed: 0,
    tilesClosed: 0,
    diceRolls: 0,
    doubles: 0,
    bestRound: null,
    scores: [],
    ...patch,
  };
}

describe("match resolution", () => {
  it("cumulative low score over 5 rounds (39 beats 63)", () => {
    let s = { omar: stats("omar"), ahmed: stats("ahmed") };
    const omar = [8, 14, 0, 6, 11];
    const ahmed = [17, 5, 9, 12, 20];
    omar.forEach((o, i) => {
      const a = ahmed[i];
      const result: RoundResult = {
        roundId: `r${i}`,
        roundNumber: i + 1,
        winnerIds: [o < a ? "omar" : "ahmed"],
        entries: [
          { playerId: "omar", openTiles: [], openTileSum: o, tilesClosed: 0, placement: o < a ? 1 : 2, perfectBox: o === 0, points: o < a ? 1 : 0, status: "blocked" },
          { playerId: "ahmed", openTiles: [], openTileSum: a, tilesClosed: 0, placement: a < o ? 1 : 2, perfectBox: false, points: a < o ? 1 : 0, status: "blocked" },
        ],
        reason: "all_blocked",
        tieBreakRolls: null,
        endedAt: 0,
      };
      s = statsAfterRound(s, result) as typeof s;
    });
    expect(s.omar.cumulativeScore).toBe(39);
    expect(s.ahmed.cumulativeScore).toBe(63);
    expect(s.omar.perfectRounds).toBe(1);
    expect(s.omar.bestRound).toBe(0);
    const settings = normalizeSettings({ matchFormat: "fixed", rounds: 5, scoringMode: "cumulative_low" });
    expect(isMatchOver({ roundsPlayed: 5, stats: s }, settings)).toBe(true);
    const res = resolveMatch({ stats: s, playerIds: ["omar", "ahmed"] }, settings, new Set(), "completed", 0);
    expect(res.winnerIds).toEqual(["omar"]);
  });

  it("best of 5 ends early at 3 wins", () => {
    const settings = normalizeSettings({ matchFormat: "best_of", rounds: 5 });
    expect(isMatchOver({ roundsPlayed: 3, stats: { a: stats("a", { roundWins: 3 }), b: stats("b") } }, settings)).toBe(true);
    expect(isMatchOver({ roundsPlayed: 3, stats: { a: stats("a", { roundWins: 2 }), b: stats("b", { roundWins: 1 }) } }, settings)).toBe(false);
    expect(isMatchOver({ roundsPlayed: 5, stats: { a: stats("a", { roundWins: 2 }), b: stats("b", { roundWins: 2 }) } }, settings)).toBe(true);
  });

  it("first to N and endless", () => {
    const first = normalizeSettings({ matchFormat: "first_to", rounds: 3 });
    expect(isMatchOver({ roundsPlayed: 10, stats: { a: stats("a", { roundWins: 2 }) } }, first)).toBe(false);
    expect(isMatchOver({ roundsPlayed: 10, stats: { a: stats("a", { roundWins: 3 }) } }, first)).toBe(true);
    const endless = normalizeSettings({ matchFormat: "endless" });
    expect(isMatchOver({ roundsPlayed: 40, stats: { a: stats("a", { roundWins: 40 }) } }, endless)).toBe(false);
  });

  it("match points mode ranks by points", () => {
    const settings = normalizeSettings({ scoringMode: "match_points" });
    const res = resolveMatch(
      { stats: { a: stats("a", { matchPoints: 5, roundWins: 1 }), b: stats("b", { matchPoints: 6, roundWins: 1 }) }, playerIds: ["a", "b"] },
      settings,
      new Set(),
      "completed",
      0,
    );
    expect(res.standings.map((s) => s.playerId)).toEqual(["b", "a"]);
  });
});

describe("expected-value strategy", () => {
  const s = { oneDieEndgame: false, oneDieThreshold: 7 };
  it("empty board has value 0 and full board is between 0 and 55", () => {
    expect(expectedScore([], s)).toBe(0);
    const v = expectedScore([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], s);
    expect(v).toBeGreaterThan(0);
    expect(v).toBeLessThan(55);
  });
  it("rates every legal move", () => {
    const moves = rateMoves([1, 2, 3, 4, 5, 6, 7, 8, 9, 10], 8, s);
    expect(moves).toHaveLength(6);
    for (let i = 1; i < moves.length; i++) expect(moves[i].expectedScore).toBeGreaterThanOrEqual(moves[i - 1].expectedScore);
  });
});
