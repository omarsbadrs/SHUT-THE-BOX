import { describe, expect, it } from "vitest";
import type { PlayerColor } from "@/game-engine";
import { lcg } from "@/game-engine/__tests__/harness";
import {
  applyHmEvents,
  createHangmanRoom,
  emptyHangmanState,
  executeHangman,
  findHmPlayerByGuest,
  hangmanPersonal,
  HM_TIMING,
  maskFor,
  nextWakeHangman,
  normalizeLetter,
  normalizeWord,
  solveKey,
  toPublicHangman,
  WORDS,
  type HangmanServerState,
  type HangmanSettings,
  type HmCommand,
  type HmEvent,
} from "..";

class H {
  now = 1_700_000_000_000;
  state: HangmanServerState;
  events: HmEvent[] = [];
  presence: Record<string, number> = {};
  connected = new Set<string>(["g-omar"]);
  rng = lcg(5);
  ids = 0;
  constructor(settings: Partial<HangmanSettings> = {}) {
    const c = createHangmanRoom(
      { roomId: "r1", code: "K7MX42", settings: { guessTimer: 0, ...settings }, nickname: "Omar", avatar: "🦊", color: "blue", guestId: "g-omar" },
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
    return findHmPlayerByGuest(this.state, g)!;
  }
  run(g: string | null, command: HmCommand) {
    const r = executeHangman(this.state, command, {
      now: this.now,
      rng: this.rng,
      newId: () => this.id(),
      actorId: g ? findHmPlayerByGuest(this.state, g) : null,
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
  ok(g: string | null, command: HmCommand) {
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
      const id = findHmPlayerByGuest(this.state, g);
      if (id) this.presence[id] = this.now;
    }
    return this.run(null, { type: "TICK" });
  }
  start() {
    for (const p of this.state.players) if (!p.isReady && !p.isBot) this.ok(this.state.private.guests[p.id], { type: "SET_READY", ready: true });
    this.ok("g-omar", { type: "START" });
    this.advance(HM_TIMING.introMs + 10);
  }
  round() {
    return this.state.match!.round!;
  }
  guestOf(id: string) {
    return this.state.private.guests[id];
  }
  publicJson() {
    return JSON.stringify(toPublicHangman(this.state)) + JSON.stringify(this.events);
  }
  folded() {
    return applyHmEvents(emptyHangmanState(), this.events);
  }
}

describe("letters", () => {
  it("normalizes English words and rejects junk", () => {
    expect(normalizeWord("  polar   bear ", "en")).toEqual({ ok: true, display: "POLAR BEAR" });
    expect(normalizeWord("a", "en")).toMatchObject({ ok: false, reason: "too_short" });
    expect(normalizeWord("cat5", "en")).toMatchObject({ ok: false, reason: "invalid_chars" });
    expect(normalizeWord("قط", "en")).toMatchObject({ ok: false, reason: "invalid_chars" });
  });
  it("folds Arabic alef/hamza forms and strips tashkeel", () => {
    expect(normalizeLetter("أ", "ar")).toBe("ا");
    expect(normalizeLetter("ى", "ar")).toBe("ي");
    expect(normalizeWord("أَسَد", "ar")).toEqual({ ok: true, display: "أسد" });
    expect(solveKey("اسد", "ar")).toBe(solveKey("أسد", "ar"));
    expect(solveKey("زرافه", "ar")).toBe(solveKey("زرافة", "ar"));
    expect(maskFor("أسد", new Set(["ا"]), "ar")).toEqual(["أ", null, null]);
  });
  it("every built-in word is valid in its language", () => {
    for (const lang of ["en", "ar"] as const) {
      for (const list of Object.values(WORDS[lang])) for (const w of list) expect(normalizeWord(w, lang), `${lang}:${w}`).toEqual({ ok: true, display: w });
    }
  });
});

describe("word master mode", () => {
  function setup(players = 3, settings: Partial<HangmanSettings> = {}) {
    const h = new H({ gameMode: "hangman_master", ...settings });
    h.join("g-ahmed", "Ahmed", "green");
    if (players >= 3) h.join("g-sara", "Sara", "red");
    h.start();
    return h;
  }

  it("the master's word never appears in public state or events until the round ends", () => {
    const h = setup();
    expect(h.state.phase).toBe("HM_CHOOSING");
    expect(h.round().masterId).toBe(h.pid("g-omar"));
    expect(h.run("g-ahmed", { type: "HM_SET_WORD", word: "CAT" })).toMatchObject({ ok: false, error: { code: "NOT_YOUR_TURN" } });
    const set = h.ok("g-omar", { type: "HM_SET_WORD", word: "elephant" });
    expect(set.data.secret).toBe("ELEPHANT");
    expect(h.state.phase).toBe("HM_GUESSING");
    expect(h.round().mask).toEqual(Array(8).fill(null));
    expect(h.publicJson()).not.toContain("ELEPHANT");
    expect(hangmanPersonal(h.state, h.pid("g-omar")).secret).toBe("ELEPHANT");
    expect(hangmanPersonal(h.state, h.pid("g-ahmed")).secret).toBeNull();
    expect(h.folded()).toEqual(toPublicHangman(h.state));
  });

  it("correct guesses keep the turn and score per letter; wrong guesses pass it and draw a part", () => {
    const h = setup();
    h.ok("g-omar", { type: "HM_SET_WORD", word: "ELEPHANT" });
    const first = h.round().currentGuesserId!;
    expect(first).toBe(h.pid("g-ahmed")); // seat after the master
    expect(h.run("g-omar", { type: "HM_GUESS", letter: "E" })).toMatchObject({ ok: false, error: { code: "NOT_YOUR_TURN" } });
    h.ok("g-ahmed", { type: "HM_GUESS", letter: "e" });
    expect(h.round().mask).toEqual(["E", null, "E", null, null, null, null, null]);
    expect(h.state.match!.scores[first].points).toBe(2);
    expect(h.round().currentGuesserId).toBe(first);
    expect(h.run("g-ahmed", { type: "HM_GUESS", letter: "E" })).toMatchObject({ ok: false, error: { code: "ALREADY_GUESSED" } });
    expect(h.run("g-ahmed", { type: "HM_GUESS", letter: "7" })).toMatchObject({ ok: false, error: { code: "INVALID_LETTER" } });
    h.ok("g-ahmed", { type: "HM_GUESS", letter: "Z" });
    expect(h.round().wrong).toEqual(["Z"]);
    expect(h.round().currentGuesserId).toBe(h.pid("g-sara"));
  });

  it("solving the word ends the round with a bonus", () => {
    const h = setup();
    h.ok("g-omar", { type: "HM_SET_WORD", word: "ELEPHANT" });
    h.ok("g-ahmed", { type: "HM_GUESS", letter: "E" });
    const r = h.ok("g-ahmed", { type: "HM_SOLVE", guess: "elephant" });
    expect(r.data.correct).toBe(true);
    const result = h.state.match!.history[0];
    expect(result).toMatchObject({ outcome: "solved", solverId: h.pid("g-ahmed"), word: "ELEPHANT" });
    // 2 letters + 3 solve bonus + 6 hidden letters
    expect(result.points[h.pid("g-ahmed")]).toBe(2 + 3 + 6);
    expect(h.state.phase).toBe("HM_ROUND_RESULTS");
    expect(h.round().mask!.join("")).toBe("ELEPHANT");
  });

  it("running out of lives hangs the guessers and scores the master", () => {
    const h = setup(2, { lives: 6 });
    h.ok("g-omar", { type: "HM_SET_WORD", word: "OWL" });
    for (const l of ["Q", "Z", "X", "J", "K"]) h.ok("g-ahmed", { type: "HM_GUESS", letter: l });
    expect(h.state.phase).toBe("HM_GUESSING");
    h.ok("g-ahmed", { type: "HM_SOLVE", guess: "CAT" }); // wrong solve = 6th miss
    const result = h.state.match!.history[0];
    expect(result.outcome).toBe("hanged");
    expect(result.points[h.pid("g-omar")]).toBe(5);
  });

  it("masters rotate and the match ends after everyone was master", () => {
    const h = setup(2, { rounds: 1 });
    expect(h.state.match!.totalRounds).toBe(2);
    h.ok("g-omar", { type: "HM_SET_WORD", word: "CAT" });
    h.ok("g-ahmed", { type: "HM_SOLVE", guess: "cat" });
    h.advance(HM_TIMING.intermissionMs + 10);
    expect(h.round().masterId).toBe(h.pid("g-ahmed"));
    h.ok("g-ahmed", { type: "HM_RANDOM_WORD" });
    h.ok("g-omar", { type: "HM_SOLVE", guess: "wrong" });
    // 2-player: the lone guesser keeps guessing after a miss
    expect(h.round().currentGuesserId).toBe(h.pid("g-omar"));
    h.ok("g-omar", { type: "HM_SOLVE", guess: h.state.private.word! });
    expect(h.state.phase).toBe("HM_MATCH_RESULTS");
    expect(h.state.match!.result).toMatchObject({ reason: "completed" });
    expect(h.state.match!.history.map((r) => r.masterId)).toEqual([h.pid("g-omar"), h.pid("g-ahmed")]);
  });

  it("choosing timeout picks a random word; guess timeout passes the turn", () => {
    const h = setup(3, { guessTimer: 15 });
    h.advance(HM_TIMING.chooseMs + 10);
    expect(h.state.phase).toBe("HM_GUESSING");
    expect(h.state.private.word).toBeTruthy();
    const cur = h.round().currentGuesserId;
    h.advance(15_100);
    expect(h.round().currentGuesserId).not.toBe(cur);
  });

  it("a guesser leaving a 2-player match ends it", () => {
    const h = setup(2);
    h.ok("g-omar", { type: "HM_SET_WORD", word: "CAT" });
    h.ok("g-ahmed", { type: "LEAVE" });
    expect(h.state.phase).toBe("HM_MATCH_RESULTS");
    expect(h.state.match!.result!.reason).toBe("insufficient_players");
  });
});

describe("race mode", () => {
  it("everyone plays the same hidden word privately; public events carry progress only", () => {
    const h = new H({ gameMode: "hangman_race", rounds: 3 });
    h.join("g-ahmed", "Ahmed", "green");
    h.ok("g-omar", { type: "DEV_HM_FORCE_WORD", words: ["GIRAFFE"] });
    h.start();
    expect(h.state.phase).toBe("HM_RACE");
    expect(h.round().mask).toEqual(Array(7).fill(null));
    const g = h.ok("g-omar", { type: "HM_GUESS", letter: "F" });
    expect((g.data.personal as { race: { mask: unknown[] } }).race.mask).toEqual([null, null, null, null, "F", "F", null]);
    h.ok("g-ahmed", { type: "HM_GUESS", letter: "Q" });
    expect(h.round().race![h.pid("g-omar")]).toMatchObject({ revealed: 2, wrong: 0, guesses: 1 });
    expect(h.round().race![h.pid("g-ahmed")]).toMatchObject({ revealed: 0, wrong: 1 });
    // Nothing public reveals letters or the word.
    const json = h.publicJson();
    expect(json).not.toContain("GIRAFFE");
    expect(json).not.toMatch(/"letter":"F"/);
    expect(hangmanPersonal(h.state, h.pid("g-ahmed")).race!.mask).toEqual(Array(7).fill(null));

    h.ok("g-ahmed", { type: "HM_SOLVE", guess: "giraffe" });
    for (const l of ["X", "Z", "J", "K", "Q", "V"]) h.ok("g-omar", { type: "HM_GUESS", letter: l });
    const result = h.state.match!.history[0];
    expect(result.outcome).toBe("race");
    expect(result.ranking[0]).toBe(h.pid("g-ahmed"));
    expect(result.points[h.pid("g-ahmed")]).toBe(3);
    expect(result.word).toBe("GIRAFFE");
    expect(h.folded()).toEqual(toPublicHangman(h.state));
  });

  it("race timer ends the round for players still playing", () => {
    const h = new H({ gameMode: "hangman_race", raceTimer: 60 });
    h.join("g-ahmed", "Ahmed", "green");
    h.start();
    h.advance(60_100);
    expect(h.state.phase).toBe("HM_ROUND_RESULTS");
    expect(Object.values(h.state.match!.round!.race!).every((r) => r.status === "timeup")).toBe(true);
  });

  it("Arabic words: one key reveals every alef form", () => {
    const h = new H({ gameMode: "hangman_race", language: "ar" });
    h.join("g-ahmed", "Ahmed", "green");
    h.ok("g-omar", { type: "DEV_HM_FORCE_WORD", words: ["الأردن"] });
    h.start();
    const r = h.ok("g-omar", { type: "HM_GUESS", letter: "أ" });
    expect((r.data.personal as { race: { mask: unknown[] } }).race.mask).toEqual(["ا", null, "أ", null, null, null]);
  });
});

describe("bots play complete matches", () => {
  for (const mode of ["hangman_master", "hangman_race"] as const) {
    for (const lang of ["en", "ar"] as const) {
      it(`${mode} / ${lang}`, () => {
        const h = new H({ gameMode: mode, language: lang, rounds: mode === "hangman_race" ? 3 : 1, guessTimer: 15, raceTimer: 120 });
        for (const level of ["easy", "normal", "hard"] as const) h.ok("g-omar", { type: "ADD_BOT", level });
        h.start();
        let guard = 0;
        while (h.state.phase !== "HM_MATCH_RESULTS" && guard++ < 4000) {
          // The human host plays badly but legally when it's their turn.
          const round = h.state.match?.round;
          const me = h.pid("g-omar");
          if (h.state.phase === "HM_CHOOSING" && round?.masterId === me) h.ok("g-omar", { type: "HM_RANDOM_WORD" });
          const wake = nextWakeHangman(h.state, h.now);
          h.advance(wake ? Math.max(200, wake - h.now + 10) : 1000);
        }
        expect(h.state.phase).toBe("HM_MATCH_RESULTS");
        expect(h.state.match!.history.length).toBe(h.state.match!.totalRounds);
        expect(h.state.match!.result!.winnerIds.length).toBeGreaterThan(0);
        expect(h.folded()).toEqual(toPublicHangman(h.state));
      });
    }
  }
});
