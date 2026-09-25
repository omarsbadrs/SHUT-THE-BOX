import { describe, expect, it } from "vitest";
import type { PlayerColor } from "@/game-engine";
import { lcg } from "@/game-engine/__tests__/harness";
import {
  applyC4Events,
  botC4Move,
  C4_TIMING,
  createConnect4Room,
  emptyConnect4State,
  executeConnect4,
  findC4PlayerByGuest,
  findLine,
  nextWakeConnect4,
  toPublicConnect4,
  type C4Command,
  type C4Disc,
  type C4Event,
  type Connect4ServerState,
  type Connect4Settings,
} from "..";

const errOf = (r: { ok: boolean } & Partial<{ error: { code: string } }>) => (r.ok ? null : r.error!.code);

class H {
  now = 1_700_000_000_000;
  state: Connect4ServerState;
  events: C4Event[] = [];
  presence: Record<string, number> = {};
  connected = new Set<string>(["g-omar"]);
  rng = lcg(3);
  ids = 0;
  constructor(settings: Partial<Connect4Settings> = {}) {
    const c = createConnect4Room(
      { roomId: "r1", code: "K7MX42", settings, nickname: "Omar", avatar: "🦊", color: "red", guestId: "g-omar" },
      { now: this.now, rng: this.rng, newId: () => this.id(), guestId: "g-omar", devTools: true, isAdmin: false },
    );
    this.state = c.state;
    this.events.push(...c.events);
    this.presence[c.hostId] = this.now;
  }
  id() {
    return `id${String(++this.ids).padStart(6, "0")}`;
  }
  pid(g: string) {
    return findC4PlayerByGuest(this.state, g)!;
  }
  run(g: string | null, command: C4Command) {
    const r = executeConnect4(this.state, command, {
      now: this.now,
      rng: this.rng,
      newId: () => this.id(),
      actorId: g ? findC4PlayerByGuest(this.state, g) : null,
      guestId: g,
      presence: { ...this.presence },
      devTools: true,
      isAdmin: false,
    });
    this.state = r.state;
    this.events.push(...r.events);
    Object.assign(this.presence, r.presence);
    return r;
  }
  ok(g: string | null, command: C4Command) {
    const r = this.run(g, command);
    if (!r.ok) throw new Error(`${command.type}: ${r.error.code}`);
    return r;
  }
  join(g: string, nick: string, color: PlayerColor) {
    this.connected.add(g);
    return this.ok(g, { type: "JOIN", nickname: nick, avatar: "🐼", color });
  }
  advance(ms: number) {
    this.now += ms;
    for (const g of this.connected) {
      const id = findC4PlayerByGuest(this.state, g);
      if (id) this.presence[id] = this.now;
    }
    return this.run(null, { type: "TICK" });
  }
  duel(settings: Partial<Connect4Settings> = {}) {
    if (Object.keys(settings).length) this.ok("g-omar", { type: "UPDATE_SETTINGS", settings });
    this.join("g-sara", "Sara", "yellow");
    this.ok("g-sara", { type: "SET_READY", ready: true });
    this.ok("g-omar", { type: "START" });
    this.advance(C4_TIMING.introMs);
    return this.state.match!.round!;
  }
  guestOf(id: string) {
    return id === this.pid("g-omar") ? "g-omar" : "g-sara";
  }
  /** Drops for whoever's turn it is. */
  drop(column: number) {
    return this.ok(this.guestOf(this.state.match!.round!.currentId!), { type: "C4_DROP", column });
  }
  play(columns: number[]) {
    for (const c of columns) this.drop(c);
  }
}

describe("connect 4 board", () => {
  it("finds horizontal, vertical and both diagonal lines", () => {
    const col = (...ps: string[]): C4Disc[] => ps.map((p, n) => ({ p, n }));
    // vertical in column 0
    expect(findLine([col("a", "a", "a", "a"), [], [], []], 6, 4, "a")).toEqual([
      [0, 0],
      [0, 1],
      [0, 2],
      [0, 3],
    ]);
    // horizontal on the bottom row
    expect(findLine([col("b"), col("b"), col("b"), col("b")], 6, 4, "b")?.length).toBe(4);
    // rising diagonal
    expect(findLine([col("a"), col("x", "a"), col("x", "x", "a"), col("x", "x", "x", "a")], 6, 4, "a")?.length).toBe(4);
    // falling diagonal
    expect(findLine([col("x", "x", "x", "a"), col("x", "x", "a"), col("x", "a"), col("a")], 6, 4, "a")?.length).toBe(4);
    expect(findLine([col("a", "a", "a"), [], [], []], 6, 4, "a")).toBeNull();
  });
});

describe("connect 4 engine", () => {
  it("only red & yellow seats; a third player can't join", () => {
    const h = new H();
    const r = h.run("g-sara", { type: "JOIN", nickname: "Sara", avatar: "🐼", color: "blue" });
    expect(r.ok).toBe(true);
    expect(h.state.players.find((p) => p.nickname === "Sara")?.color).toBe("yellow");
    expect(errOf(h.run("g-karim", { type: "JOIN", nickname: "Karim", avatar: "🐯", color: "green" }))).toBe("ROOM_FULL");
  });

  it("drops fall to the lowest free row and turns alternate; clients rebuild the same state", () => {
    const h = new H();
    const round = h.duel();
    const first = round.currentId!;
    expect(first).toBe(h.pid("g-omar")); // red opens round 1
    h.drop(3);
    h.drop(3);
    const r = h.state.match!.round!;
    expect(r.columns[3].map((d) => d.p)).toEqual([h.pid("g-omar"), h.pid("g-sara")]);
    expect(r.currentId).toBe(first);
    expect(errOf(h.run("g-sara", { type: "C4_DROP", column: 2 }))).toBe("NOT_YOUR_TURN");
    expect(errOf(h.run("g-omar", { type: "C4_POP", column: 3 }))).toBe("INVALID_COMMAND"); // classic: no pops
    expect(applyC4Events(emptyConnect4State(), h.events)).toEqual(toPublicConnect4(h.state));
  });

  it("four in a row wins the round and records the line", () => {
    const h = new H({ rounds: 3 });
    h.duel();
    h.play([0, 6, 1, 6, 2, 6, 3]); // red: 0,1,2,3 on the bottom row
    const res = h.state.match!.history[0];
    expect(res).toMatchObject({ outcome: "connect", winnerId: h.pid("g-omar"), moves: 7 });
    expect(res.line).toEqual([
      [0, 0],
      [1, 0],
      [2, 0],
      [3, 0],
    ]);
    expect(res.snapshot[6]).toBe("111");
    expect(h.state.phase).toBe("C4_ROUND_RESULTS");
    expect(h.state.match!.scores[h.pid("g-omar")]).toMatchObject({ wins: 1, fastestWin: 4, discs: 4 });
  });

  it("a full column rejects drops", () => {
    const h = new H();
    h.duel();
    h.play([0, 0, 0, 0, 0, 0]);
    expect(errOf(h.run(h.guestOf(h.state.match!.round!.currentId!), { type: "C4_DROP", column: 0 }))).toBe("COLUMN_FULL");
  });

  it("a full board without a line is a draw", () => {
    const h = new H({ rounds: 3 });
    h.duel();
    const [a, b] = h.state.match!.playerIds;
    const round = h.state.match!.round!;
    // Known no-line pattern, last cell left empty for the final drop.
    const owner = (c: number, r: number) => (((Math.floor(c / 2) + r) % 2) === 0 ? a : b);
    round.columns = Array.from({ length: 7 }, (_, c) => Array.from({ length: c === 6 ? 5 : 6 }, (_, r) => ({ p: owner(c, r), n: c * 6 + r })));
    round.currentId = owner(6, 5);
    h.drop(6);
    expect(h.state.match!.history[0]).toMatchObject({ outcome: "draw", winnerId: null });
    expect(h.state.match!.scores[a].draws).toBe(1);
  });

  it("popout: pop your own bottom disc; the column slides down; a pop can win", () => {
    const h = new H({ gameMode: "c4_popout" });
    h.duel();
    const red = "g-omar";
    h.drop(0); // red
    h.drop(1); // yellow
    expect(errOf(h.run(red, { type: "C4_POP", column: 1 }))).toBe("CANT_POP");
    h.ok(red, { type: "C4_POP", column: 0 });
    expect(h.state.match!.round!.columns[0]).toEqual([]);
    expect(h.state.match!.scores[h.pid(red)].pops).toBe(1);
  });

  it("best of 3 ends at two wins; the other player opens the next round", () => {
    const h = new H({ rounds: 3 });
    h.duel();
    h.play([0, 6, 1, 6, 2, 6, 3]); // red wins round 1
    h.advance(C4_TIMING.intermissionMs);
    const r2 = h.state.match!.round!;
    expect(r2.number).toBe(2);
    expect(r2.currentId).toBe(h.pid("g-sara"));
    h.play([6, 0, 5, 0, 4, 0, 3]); // yellow opens and wins round 2
    expect(h.state.match!.history[1].winnerId).toBe(h.pid("g-sara"));
    h.advance(C4_TIMING.intermissionMs);
    h.play([0, 6, 1, 6, 2, 6, 3]); // red wins round 3
    expect(h.state.phase).toBe("C4_MATCH_RESULTS");
    expect(h.state.match!.result).toMatchObject({ winnerIds: [h.pid("g-omar")], reason: "completed" });
  });

  it("the turn timer plays a move for a player who runs out of time", () => {
    const h = new H({ turnTimer: 10 });
    h.duel();
    const first = h.state.match!.round!.currentId;
    expect(nextWakeConnect4(h.state, h.now)).toBe(h.state.match!.round!.deadlineAt);
    h.advance(10_000);
    const r = h.state.match!.round!;
    expect(r.moves).toBe(1);
    expect(r.lastMove).toMatchObject({ playerId: first, auto: "timeout" });
  });

  it("leaving mid-round hands the duel to the other player", () => {
    const h = new H();
    h.duel();
    h.ok("g-sara", { type: "LEAVE" });
    expect(h.state.phase).toBe("C4_MATCH_RESULTS");
    expect(h.state.match!.result).toMatchObject({ winnerIds: [h.pid("g-omar")], reason: "insufficient_players" });
  });

  it("bots play whole rounds by themselves", () => {
    const h = new H({ rounds: 1 });
    h.ok("g-omar", { type: "ADD_BOT", level: "hard" });
    h.ok("g-omar", { type: "START" });
    h.advance(C4_TIMING.introMs);
    const bot = h.state.players.find((p) => p.isBot)!;
    let guard = 0;
    while (h.state.phase === "C4_PLAYING" && guard++ < 60) {
      const r = h.state.match!.round!;
      if (r.currentId === bot.id) h.advance(C4_TIMING.botDelayMs);
      else {
        const col = [3, 2, 4, 1, 5, 0, 6].find((c) => r.columns[c].length < r.rows)!;
        h.ok("g-omar", { type: "C4_DROP", column: col });
      }
    }
    expect(["C4_ROUND_RESULTS", "C4_MATCH_RESULTS"]).toContain(h.state.phase);
    expect(h.events.some((e) => e.type === "C4_MOVED" && e.auto === "bot")).toBe(true);
  });
});

describe("connect 4 bot", () => {
  const board = (spec: string[], ids = ["b", "h"]) => spec.map((s) => [...s].map((ch, n) => ({ p: ids[Number(ch)], n })));

  it("takes a winning move and blocks the rival's", () => {
    // bot "b" (0) has three on the bottom row: columns 0,1,2 → plays 3
    expect(botC4Move("normal", board(["0", "0", "0", "", "1", "1", ""]), 6, 4, "c4_classic", "b", lcg(1))).toEqual({ kind: "drop", column: 3 });
    // human "h" (1) threatens column 3 → the bot blocks
    expect(botC4Move("hard", board(["1", "1", "1", "", "0", "", ""]), 6, 4, "c4_classic", "b", lcg(1))).toEqual({ kind: "drop", column: 3 });
  });

  it("thinks fast enough on the biggest board", () => {
    for (const [cols, rows] of [
      [7, 6],
      [9, 7],
    ]) {
      const empty = Array.from({ length: cols }, () => [] as C4Disc[]);
      const t0 = performance.now();
      botC4Move("hard", empty, rows, 4, "c4_classic", "b", lcg(2));
      botC4Move("hard", empty, rows, 4, "c4_popout", "b", lcg(2));
      expect(performance.now() - t0, `${cols}x${rows}`).toBeLessThan(2500);
    }
  });

  it("hard beats easy most of the time", () => {
    let hardWins = 0;
    for (let g = 0; g < 6; g++) {
      const rng = lcg(10 + g);
      const cols: C4Disc[][] = Array.from({ length: 7 }, () => []);
      let who = g % 2 === 0 ? "hard" : "easy";
      for (let n = 0; n < 42; n++) {
        const m = botC4Move(who === "hard" ? "hard" : "easy", cols, 6, 4, "c4_classic", who, rng);
        cols[m.column].push({ p: who, n });
        if (findLine(cols, 6, 4, who)) {
          if (who === "hard") hardWins++;
          break;
        }
        who = who === "hard" ? "easy" : "hard";
      }
    }
    expect(hardWins).toBeGreaterThanOrEqual(5);
  });
});
