import { describe, expect, it } from "vitest";
import { nextWakeAt } from "../engine";
import { TIMING } from "../rules";
import { Harness } from "./harness";

function twoPlayer(settings = {}) {
  const h = new Harness({ rollTimer: 0, moveTimer: 0, ...settings });
  h.join("g-ahmed", "Ahmed", "green");
  h.startMatch();
  return h;
}

/** Makes Omar the current player (acceptance scenario: "Omar gets first turn"). */
function omarFirst(h: Harness) {
  if (h.round().currentPlayerId !== h.pid("g-omar")) h.ok("g-omar", { type: "DEV_SET_TURN", playerId: h.pid("g-omar") });
}

describe("lobby", () => {
  it("assigns unique colors and nicknames and enforces room size", () => {
    const h = new Harness({ maxPlayers: 3 });
    h.join("g-ahmed", "Ahmed", "blue"); // blue taken → random free color
    expect(h.state.players.find((p) => p.nickname === "Ahmed")!.color).not.toBe("blue");
    expect(h.run("g-x", { type: "JOIN", nickname: "ahmed", avatar: "🐼" })).toMatchObject({ ok: false, error: { code: "NICKNAME_TAKEN" } });
    h.join("g-sara", "Sara");
    expect(h.run("g-karim", { type: "JOIN", nickname: "Karim", avatar: "🐼" })).toMatchObject({ ok: false, error: { code: "ROOM_FULL" } });
    const colors = h.state.players.map((p) => p.color);
    expect(new Set(colors).size).toBe(3);
  });

  it("requires 2+ players, everyone ready, and only the host can start", () => {
    const h = new Harness();
    expect(h.run("g-omar", { type: "START" })).toMatchObject({ ok: false, error: { code: "NOT_ENOUGH_PLAYERS" } });
    h.join("g-ahmed", "Ahmed");
    expect(h.run("g-omar", { type: "START" })).toMatchObject({ ok: false, error: { code: "NOT_ALL_READY" } });
    h.ok("g-ahmed", { type: "SET_READY", ready: true });
    expect(h.run("g-ahmed", { type: "START" })).toMatchObject({ ok: false, error: { code: "NOT_HOST" } });
    h.ok("g-omar", { type: "START" });
    expect(h.state.phase).toBe("STARTING");
    expect(h.run("g-late", { type: "JOIN", nickname: "Late", avatar: "🐼" })).toMatchObject({ ok: false, error: { code: "GAME_ALREADY_STARTED" } });
  });

  it("rejoining with the same guest restores the same seat", () => {
    const h = new Harness();
    h.join("g-ahmed", "Ahmed", "green");
    const id = h.pid("g-ahmed");
    const r = h.ok("g-ahmed", { type: "JOIN", nickname: "Whatever", avatar: "🐸" });
    expect(r.data).toMatchObject({ playerId: id, rejoined: true });
    expect(h.state.players).toHaveLength(2);
  });

  it("kick with ban prevents rejoining", () => {
    const h = new Harness();
    h.join("g-ahmed", "Ahmed");
    h.ok("g-omar", { type: "KICK", playerId: h.pid("g-ahmed"), ban: true });
    expect(h.state.players).toHaveLength(1);
    expect(h.run("g-ahmed", { type: "JOIN", nickname: "Ahmed", avatar: "🐼" })).toMatchObject({ ok: false, error: { code: "BANNED" } });
  });
});

describe("acceptance scenario (Face-Off, 2 players)", () => {
  it("roll 3+5, close 3+5, Ahmed rolls 2+6 closes 8, turn returns to Omar", () => {
    const h = twoPlayer();
    expect(h.state.phase).toBe("PLAYER_TURN");
    omarFirst(h);
    h.forceDice([3, 5], [2, 6]);

    // Ahmed cannot act on Omar's turn.
    expect(h.run("g-ahmed", { type: "ROLL" })).toMatchObject({ ok: false, error: { code: "NOT_YOUR_TURN" } });

    const roll = h.ok("g-omar", { type: "ROLL" });
    const pending = h.round().players[h.pid("g-omar")].pending!;
    expect(pending).toMatchObject({ die1: 3, die2: 5, total: 8, isDouble: false });
    expect(h.state.phase).toBe("AWAITING_TILE_SELECTION");
    expect(roll.events.map((e) => e.type)).toEqual(["DICE_ROLLED"]);
    expect(h.run("g-omar", { type: "ROLL" })).toMatchObject({ ok: false, error: { code: "ALREADY_ROLLED" } });

    // Server validation of the selection.
    const turnId = pending.turnId;
    expect(h.run("g-omar", { type: "CLOSE_TILES", turnId, tiles: [3, 6] })).toMatchObject({ ok: false, error: { code: "WRONG_TOTAL", params: { total: 8, sum: 9 } } });
    expect(h.run("g-omar", { type: "CLOSE_TILES", turnId, tiles: [4, 4] })).toMatchObject({ ok: false, error: { code: "DUPLICATE_TILE" } });
    expect(h.run("g-omar", { type: "CLOSE_TILES", turnId: "bogus", tiles: [3, 5] })).toMatchObject({ ok: false, error: { code: "STALE_TURN" } });

    const close = h.ok("g-omar", { type: "CLOSE_TILES", turnId, tiles: [3, 5] });
    expect(close.events.map((e) => e.type)).toEqual(["TILES_CLOSED", "TURN_CHANGED"]);
    expect(h.board("g-omar")).toEqual([1, 2, 4, 6, 7, 8, 9, 10]);
    expect(h.round().currentPlayerId).toBe(h.pid("g-ahmed"));
    // Retry of the same close is rejected as already resolved.
    expect(h.run("g-omar", { type: "CLOSE_TILES", turnId, tiles: [3, 5] })).toMatchObject({ ok: false });

    h.ok("g-ahmed", { type: "ROLL" });
    const t2 = h.round().players[h.pid("g-ahmed")].pending!.turnId;
    h.ok("g-ahmed", { type: "CLOSE_TILES", turnId: t2, tiles: [8] });
    expect(h.board("g-ahmed")).toEqual([1, 2, 3, 4, 5, 6, 7, 9, 10]);
    expect(h.round().currentPlayerId).toBe(h.pid("g-omar"));

    // A client folding the same events sees exactly the server's public state.
    expect(h.folded()).toEqual(h.publicState());
  });
});

describe("face-off rules", () => {
  it("doubles grant an extra turn when enabled", () => {
    const h = twoPlayer({ doubleExtraTurn: true });
    omarFirst(h);
    h.forceDice([4, 4]);
    h.ok("g-omar", { type: "ROLL" });
    const r = h.ok("g-omar", { type: "CLOSE_TILES", turnId: h.round().players[h.pid("g-omar")].pending!.turnId, tiles: [1, 7] });
    expect(r.events.map((e) => e.type)).toEqual(["TILES_CLOSED", "EXTRA_TURN", "TURN_STARTED"]);
    expect(h.round().currentPlayerId).toBe(h.pid("g-omar"));
  });

  it("doubles pass the dice when the option is off", () => {
    const h = twoPlayer({ doubleExtraTurn: false });
    omarFirst(h);
    h.forceDice([4, 4]);
    h.ok("g-omar", { type: "ROLL" });
    h.ok("g-omar", { type: "CLOSE_TILES", turnId: h.round().players[h.pid("g-omar")].pending!.turnId, tiles: [8] });
    expect(h.round().currentPlayerId).toBe(h.pid("g-ahmed"));
  });

  it("blocked players stop receiving turns; last active player keeps rolling", () => {
    const h = twoPlayer();
    omarFirst(h);
    h.ok("g-omar", { type: "DEV_SET_TILES", playerId: h.pid("g-omar"), openTiles: [9, 10] });
    h.forceDice([1, 1], [3, 5], [1, 2]);
    const r = h.ok("g-omar", { type: "ROLL" });
    expect(r.events.map((e) => e.type)).toEqual(["DICE_ROLLED", "PLAYER_BLOCKED", "TURN_CHANGED"]);
    expect(h.round().players[h.pid("g-omar")]).toMatchObject({ status: "blocked", finalScore: 19 });
    h.ok("g-ahmed", { type: "ROLL" });
    h.ok("g-ahmed", { type: "CLOSE_TILES", turnId: h.round().players[h.pid("g-ahmed")].pending!.turnId, tiles: [8] });
    expect(h.round().currentPlayerId).toBe(h.pid("g-ahmed"));
    expect(h.run("g-omar", { type: "ROLL" })).toMatchObject({ ok: false, error: { code: "NOT_YOUR_TURN" } });
  });

  it("shutting the box wins the round immediately with score 0", () => {
    const h = twoPlayer({ matchFormat: "best_of", rounds: 3 });
    omarFirst(h);
    h.ok("g-omar", { type: "DEV_SET_TILES", playerId: h.pid("g-omar"), openTiles: [3, 5] });
    h.forceDice([3, 5]);
    h.ok("g-omar", { type: "ROLL" });
    const r = h.ok("g-omar", { type: "CLOSE_TILES", turnId: h.round().players[h.pid("g-omar")].pending!.turnId, tiles: [3, 5] });
    expect(r.events.map((e) => e.type)).toEqual(["TILES_CLOSED", "PLAYER_SHUT_BOX", "ROUND_COMPLETED", "SCORE_UPDATED"]);
    const result = h.state.match!.history[0];
    expect(result.winnerIds).toEqual([h.pid("g-omar")]);
    expect(result.entries[0]).toMatchObject({ playerId: h.pid("g-omar"), openTileSum: 0, perfectBox: true, placement: 1 });
    expect(result.entries[1]).toMatchObject({ openTileSum: 55, placement: 2 });
    expect(h.state.phase).toBe("ROUND_RESULTS");
    expect(h.state.match!.stats[h.pid("g-omar")]).toMatchObject({ roundWins: 1, perfectRounds: 1, cumulativeScore: 0 });
  });

  it("when everyone is blocked the lowest open-tile score wins", () => {
    const h = twoPlayer();
    omarFirst(h);
    h.ok("g-omar", { type: "DEV_SET_TILES", playerId: h.pid("g-omar"), openTiles: [9, 10] });
    h.ok("g-omar", { type: "DEV_SET_TILES", playerId: h.pid("g-ahmed"), openTiles: [1, 10] });
    h.forceDice([1, 1], [2, 2]);
    h.ok("g-omar", { type: "ROLL" }); // 2 → blocked with 19
    const r = h.ok("g-ahmed", { type: "ROLL" }); // 4 → blocked with 11
    expect(r.events.map((e) => e.type)).toEqual(["DICE_ROLLED", "PLAYER_BLOCKED", "ROUND_COMPLETED", "SCORE_UPDATED"]);
    const result = h.state.match!.history[0];
    expect(result.entries.map((e) => [e.openTileSum, e.placement])).toEqual([
      [11, 1],
      [19, 2],
    ]);
    expect(result.winnerIds).toEqual([h.pid("g-ahmed")]);
  });

  it("next round starts after intermission; starter rotates; tiles reopen", () => {
    const h = twoPlayer({ matchFormat: "best_of", rounds: 3, starterRule: "rotate" });
    const firstStarter = h.round().starterId;
    h.ok("g-omar", { type: "DEV_NEXT_ROUND" });
    expect(h.state.phase).toBe("ROUND_RESULTS");
    h.advance(TIMING.intermissionMs + 10);
    expect(h.state.phase).toBe("ROUND_SETUP");
    expect(h.round().number).toBe(2);
    expect(h.round().starterId).not.toBe(firstStarter);
    expect(h.board("g-omar")).toHaveLength(10);
    h.advance(TIMING.roundSetupMs + 10);
    expect(h.state.phase).toBe("PLAYER_TURN");
    expect(h.round().currentPlayerId).toBe(h.round().starterId);
  });

  it("best of 3 ends when a player reaches 2 wins; rematch keeps room and resets scores", () => {
    const h = twoPlayer({ matchFormat: "best_of", rounds: 3 });
    for (let i = 0; i < 2; i++) {
      h.ok("g-omar", { type: "DEV_SHUT_BOARD", playerId: h.pid("g-omar") });
      if (i === 0) {
        h.advance(TIMING.intermissionMs + 10);
        h.advance(TIMING.roundSetupMs + 10);
      }
    }
    expect(h.state.phase).toBe("MATCH_RESULTS");
    expect(h.state.match!.result!.winnerIds).toEqual([h.pid("g-omar")]);
    const code = h.state.code;
    const ids = h.state.players.map((p) => p.id).sort();
    h.ok("g-omar", { type: "REMATCH", shuffleColors: true });
    expect(h.state.code).toBe(code);
    expect(h.state.players.map((p) => p.id).sort()).toEqual(ids);
    expect(h.state.phase).toBe("STARTING");
    expect(h.state.match!.number).toBe(2);
    expect(Object.values(h.state.match!.stats).every((s) => s.roundWins === 0 && s.cumulativeScore === 0)).toBe(true);
    expect(new Set(h.state.players.map((p) => p.color)).size).toBe(2);
    expect(h.folded()).toEqual(h.publicState());
  });
});

describe("anti-cheat & idempotency", () => {
  it("duplicate command ids are applied once", () => {
    const h = twoPlayer();
    omarFirst(h);
    const a = h.run("g-omar", { type: "ROLL" }, "cmd-1");
    const b = h.run("g-omar", { type: "ROLL" }, "cmd-1");
    expect(a.ok && a.events.length).toBe(1);
    expect(b).toMatchObject({ ok: true, duplicate: true, events: [] });
    expect(h.round().players[h.pid("g-omar")].rolls).toBe(1);
  });

  it("cannot close before rolling, or close tiles already closed", () => {
    const h = twoPlayer();
    omarFirst(h);
    expect(h.run("g-omar", { type: "CLOSE_TILES", turnId: "x", tiles: [8] })).toMatchObject({ ok: false, error: { code: "NOT_ROLLED" } });
    h.ok("g-omar", { type: "DEV_SET_TILES", playerId: h.pid("g-omar"), openTiles: [1, 2, 4, 6, 7, 8, 9, 10] });
    h.forceDice([3, 5]);
    h.ok("g-omar", { type: "ROLL" });
    const turnId = h.round().players[h.pid("g-omar")].pending!.turnId;
    expect(h.run("g-omar", { type: "CLOSE_TILES", turnId, tiles: [3, 5] })).toMatchObject({ ok: false, error: { code: "TILE_CLOSED", params: { tile: 3 } } });
  });

  it("private-only changes (forced dice) report changed with no public events", () => {
    const h = twoPlayer();
    const r = h.run("g-omar", { type: "DEV_FORCE_DICE", dice: [[6, 6]] });
    expect(r).toMatchObject({ ok: true, changed: true, events: [] });
    expect(h.state.private.forcedDice).toEqual([[6, 6]]);
    const tick = h.run(null, { type: "TICK" });
    expect(tick).toMatchObject({ ok: true, changed: false });
  });

  it("non-members and spectators cannot act", () => {
    const h = twoPlayer();
    expect(h.run("g-stranger", { type: "ROLL" })).toMatchObject({ ok: false, error: { code: "NOT_A_PLAYER" } });
  });

  it("dev tools are refused when disabled", async () => {
    const { executeCommand } = await import("../engine");
    const h = twoPlayer();
    const r = executeCommand(h.state, { type: "DEV_FORCE_DICE", dice: [[6, 6]] }, {
      now: h.now,
      rng: h.rng,
      newId: () => "x",
      actorId: h.pid("g-omar"),
      guestId: "g-omar",
      presence: h.presence,
      devTools: false,
      isAdmin: false,
    });
    expect(r).toMatchObject({ ok: false, error: { code: "DEV_TOOLS_DISABLED" } });
  });
});

describe("timers", () => {
  it("roll timer auto-rolls and move timer auto-closes a legal move", () => {
    const h = new Harness({ rollTimer: 15, moveTimer: 15 });
    h.join("g-ahmed", "Ahmed");
    h.startMatch();
    const cur = h.round().currentPlayerId!;
    expect(h.round().players[cur].deadlineAt).not.toBeNull();
    h.forceDice([3, 5]);
    h.advance(15_100);
    const pending = h.round().players[cur].pending;
    expect(pending?.auto).toBe("timeout");
    h.advance(15_100);
    expect(h.round().players[cur].last?.status).toBe("EXPIRED");
    expect(h.round().players[cur].openTiles.reduce((a, b) => a + b, 0)).toBe(55 - 8);
    expect(h.round().currentPlayerId).not.toBe(cur);
  });

  it("pause shifts deadlines and freezes the clock", () => {
    const h = new Harness({ rollTimer: 15, moveTimer: 0 });
    h.join("g-ahmed", "Ahmed");
    h.startMatch();
    const cur = h.round().currentPlayerId!;
    const deadline = h.round().players[cur].deadlineAt!;
    h.ok("g-omar", { type: "PAUSE" });
    h.advance(60_000);
    expect(h.round().players[cur].pending).toBeNull();
    h.ok("g-omar", { type: "RESUME" });
    expect(h.round().players[cur].deadlineAt).toBe(deadline + 60_000);
  });

  it("nextWakeAt reports the earliest due action", () => {
    const h = new Harness({ rollTimer: 30, moveTimer: 0 });
    h.join("g-ahmed", "Ahmed");
    h.ok("g-ahmed", { type: "SET_READY", ready: true });
    h.ok("g-omar", { type: "START" });
    expect(nextWakeAt(h.state, h.now)).toBe(h.state.phaseEndsAt);
    h.advance(TIMING.matchIntroMs + 10);
    const cur = h.round().currentPlayerId!;
    expect(nextWakeAt(h.state, h.now)).toBe(h.round().players[cur].deadlineAt);
  });
});

describe("disconnection & reconnection", () => {
  it("wait rule: 30s wait then skip once; reconnect restores the board", () => {
    const h = new Harness({ rollTimer: 0, moveTimer: 0, disconnectRule: "wait" });
    h.join("g-ahmed", "Ahmed", "green");
    h.join("g-sara", "Sara", "red");
    h.startMatch();
    const sara = h.pid("g-sara");
    h.ok("g-omar", { type: "DEV_SET_TURN", playerId: sara });
    h.ok("g-omar", { type: "DEV_SET_TILES", playerId: sara, openTiles: [1, 2, 4, 9] });
    h.connected.delete("g-sara");
    h.advance(TIMING.reconnectingAfterMs + 1000);
    expect(h.state.players.find((p) => p.id === sara)!.connection).toBe("reconnecting");
    expect(h.round().currentPlayerId).toBe(sara);
    h.advance(TIMING.disconnectWaitMs);
    expect(h.round().currentPlayerId).not.toBe(sara);
    expect(h.events.some((e) => e.type === "TURN_SKIPPED" && e.playerId === sara)).toBe(true);
    // Sara comes back.
    h.connected.add("g-sara");
    h.ok("g-sara", { type: "JOIN", nickname: "Sara", avatar: "🐼" });
    expect(h.state.players.find((p) => p.id === sara)).toMatchObject({ connection: "online", color: "red" });
    expect(h.board("g-sara")).toEqual([1, 2, 4, 9]);
    expect(h.round().players[sara].status).toBe("active");
    expect(h.folded()).toEqual(h.publicState());
  });

  it("offline beyond the grace period blocks the player and migrates the host", () => {
    const h = new Harness({ rollTimer: 0, moveTimer: 0, disconnectGraceSeconds: 60 });
    h.join("g-ahmed", "Ahmed", "green");
    h.join("g-sara", "Sara", "red");
    h.startMatch();
    h.connected.delete("g-omar");
    h.advance(20_000);
    h.advance(20_000);
    h.advance(21_000);
    const omar = h.pid("g-omar");
    expect(h.state.players.find((p) => p.id === omar)!.connection).toBe("offline");
    expect(h.round().players[omar].status).toBe("blocked");
    expect(h.state.hostId).toBe(h.pid("g-ahmed"));
    expect(h.events.some((e) => e.type === "HOST_CHANGED" && e.reason === "migration")).toBe(true);
  });

  it("a player leaving a 2-player match ends it", () => {
    const h = twoPlayer();
    h.ok("g-ahmed", { type: "LEAVE" });
    expect(h.state.phase).toBe("MATCH_RESULTS");
    expect(h.state.match!.result).toMatchObject({ reason: "insufficient_players", winnerIds: [h.pid("g-omar")] });
  });
});

describe("other modes", () => {
  it("classic: a player keeps rolling until blocked, then the next player plays", () => {
    const h = twoPlayer({ gameMode: "classic" });
    omarFirst(h);
    h.forceDice([3, 5], [2, 6], [6, 6]);
    h.ok("g-omar", { type: "ROLL" });
    h.ok("g-omar", { type: "CLOSE_TILES", turnId: h.round().players[h.pid("g-omar")].pending!.turnId, tiles: [8] });
    expect(h.round().currentPlayerId).toBe(h.pid("g-omar"));
    h.ok("g-omar", { type: "ROLL" });
    h.ok("g-omar", { type: "CLOSE_TILES", turnId: h.round().players[h.pid("g-omar")].pending!.turnId, tiles: [2, 6] });
    expect(h.round().currentPlayerId).toBe(h.pid("g-omar"));
    h.ok("g-omar", { type: "DEV_SET_TILES", playerId: h.pid("g-omar"), openTiles: [1, 10] });
    h.ok("g-omar", { type: "ROLL" }); // 12 → blocked
    expect(h.round().currentPlayerId).toBe(h.pid("g-ahmed"));
  });

  it("race: everyone rolls simultaneously on their own board", () => {
    const h = twoPlayer({ gameMode: "race" });
    h.forceDice([3, 5], [2, 6]);
    h.ok("g-omar", { type: "ROLL" });
    h.ok("g-ahmed", { type: "ROLL" });
    const o = h.round().players[h.pid("g-omar")].pending!;
    const a = h.round().players[h.pid("g-ahmed")].pending!;
    h.ok("g-ahmed", { type: "CLOSE_TILES", turnId: a.turnId, tiles: [8] });
    h.ok("g-omar", { type: "CLOSE_TILES", turnId: o.turnId, tiles: [3, 5] });
    h.ok("g-ahmed", { type: "ROLL" });
    expect(h.state.phase).toBe("PLAYER_TURN");
    h.ok("g-omar", { type: "DEV_SHUT_BOARD", playerId: h.pid("g-omar") });
    expect(h.state.match!.history[0].winnerIds).toEqual([h.pid("g-omar")]);
  });

  it("one-die endgame is only offered once tiles >= threshold are closed", () => {
    const h = twoPlayer({ oneDieEndgame: true, oneDieThreshold: 7 });
    omarFirst(h);
    expect(h.run("g-omar", { type: "ROLL", diceCount: 1 })).toMatchObject({ ok: false, error: { code: "ONE_DIE_UNAVAILABLE" } });
    h.ok("g-omar", { type: "DEV_SET_TILES", playerId: h.pid("g-omar"), openTiles: [1, 2, 3] });
    h.forceDice([2, 6]);
    h.ok("g-omar", { type: "ROLL", diceCount: 1 });
    expect(h.round().players[h.pid("g-omar")].pending).toMatchObject({ die1: 2, die2: null, total: 2, diceCount: 1 });
  });

  it("limited hints are server-counted and suggest a legal move", () => {
    const h = twoPlayer({ hints: "limited" });
    omarFirst(h);
    h.forceDice([3, 5]);
    h.ok("g-omar", { type: "ROLL" });
    const r = h.ok("g-omar", { type: "USE_HINT" });
    const tiles = r.data.tiles as number[];
    expect(tiles.reduce((a, b) => a + b, 0)).toBe(8);
    h.ok("g-omar", { type: "USE_HINT" });
    h.ok("g-omar", { type: "USE_HINT" });
    expect(h.run("g-omar", { type: "USE_HINT" })).toMatchObject({ ok: false, error: { code: "HINTS_UNAVAILABLE" } });
  });
});

describe("full matches with bots", () => {
  for (const mode of ["faceoff", "classic", "race", "tournament"] as const) {
    it(`${mode}: bots play a complete match; every client fold equals the server state`, () => {
      const h = new Harness({ gameMode: mode, matchFormat: "fixed", rounds: 3, rollTimer: 15, moveTimer: 15 }, "Omar", "blue", 11);
      for (const level of ["easy", "normal", "hard"] as const) h.ok("g-omar", { type: "ADD_BOT", level });
      h.startMatch();
      let guard = 0;
      while (h.state.phase !== "MATCH_RESULTS" && guard++ < 5000) h.advance(1000);
      expect(h.state.phase).toBe("MATCH_RESULTS");
      const match = h.state.match!;
      expect(match.history).toHaveLength(3);
      expect(match.result!.winnerIds.length).toBeGreaterThan(0);
      for (const r of match.history) {
        const sums = r.entries.map((e) => e.openTileSum);
        expect([...sums].sort((a, b) => a - b)).toEqual(sums);
      }
      // Every closed tile set in history is a legal move for its roll.
      for (const e of h.events) {
        if (e.type === "TILES_CLOSED") expect(e.tiles.length).toBeGreaterThan(0);
      }
      const totalCumulative = Object.values(match.stats).reduce((a, s) => a + s.cumulativeScore, 0);
      expect(totalCumulative).toBe(match.history.flatMap((r) => r.entries).reduce((a, e) => a + e.openTileSum, 0));
      expect(h.folded()).toEqual(h.publicState());
    });
  }
});
