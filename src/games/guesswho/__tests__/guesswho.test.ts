import { describe, expect, it } from "vitest";
import type { PlayerColor } from "@/game-engine";
import { lcg } from "@/game-engine/__tests__/harness";
import {
  answerFor,
  applyGwEvents,
  botMove,
  candidatesFor,
  cardById,
  createGuessWhoRoom,
  emptyGuessWhoState,
  executeGuessWho,
  findGwPlayerByGuest,
  GW_CARDS,
  GW_CATEGORIES,
  GW_QUESTIONS,
  GW_TIMING,
  guessWhoPersonal,
  nextWakeGuessWho,
  toPublicGuessWho,
  type GuessWhoServerState,
  type GuessWhoSettings,
  type GwCommand,
  type GwEvent,
} from "..";

const errOf = (r: { ok: boolean } & Partial<{ error: { code: string } }>) => (r.ok ? null : r.error!.code);

class H {
  now = 1_700_000_000_000;
  state: GuessWhoServerState;
  events: GwEvent[] = [];
  presence: Record<string, number> = {};
  connected = new Set<string>(["g-omar"]);
  rng = lcg(7);
  ids = 0;
  constructor(settings: Partial<GuessWhoSettings> = {}) {
    const c = createGuessWhoRoom(
      { roomId: "r1", code: "K7MX42", settings: { turnTimer: 0, ...settings }, nickname: "Omar", avatar: "🦊", color: "blue", guestId: "g-omar" },
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
    return findGwPlayerByGuest(this.state, g)!;
  }
  run(g: string | null, command: GwCommand) {
    const r = executeGuessWho(this.state, command, {
      now: this.now,
      rng: this.rng,
      newId: () => this.id(),
      actorId: g ? findGwPlayerByGuest(this.state, g) : null,
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
  ok(g: string | null, command: GwCommand) {
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
      const id = findGwPlayerByGuest(this.state, g);
      if (id) this.presence[id] = this.now;
    }
    return this.run(null, { type: "TICK" });
  }
  /** Two humans, forced secrets, round 1 dealt. */
  duel(secrets = ["stars/adel_emam", "stars/soad_hosny"], settings: Partial<GuessWhoSettings> = {}) {
    if (Object.keys(settings).length) this.ok("g-omar", { type: "UPDATE_SETTINGS", settings });
    this.join("g-sara", "Sara", "red");
    this.ok("g-sara", { type: "SET_READY", ready: true });
    this.ok("g-omar", { type: "DEV_GW_FORCE_SECRETS", cards: secrets });
    this.ok("g-omar", { type: "START" });
    this.advance(GW_TIMING.introMs);
    return this.state.match!.round!;
  }
}

describe("guess who decks", () => {
  it("every card has a unique id, both names, and every tag is askable", () => {
    for (const cat of GW_CATEGORIES) {
      const cards = GW_CARDS[cat];
      expect(cards.length, cat).toBeGreaterThanOrEqual(24);
      expect(new Set(cards.map((c) => c.id)).size).toBe(cards.length);
      const tags = new Set(GW_QUESTIONS[cat].map((q) => q.tag));
      for (const c of cards) {
        expect(c.en && c.ar, c.id).toBeTruthy();
        for (const t of c.tags) expect(tags.has(t), `${c.id} tag ${t}`).toBe(true);
      }
      // every question actually splits the deck
      for (const q of GW_QUESTIONS[cat]) {
        const yes = cards.filter((c) => answerFor(c.id, q.id)).length;
        expect(yes, q.id).toBeGreaterThan(0);
        expect(yes, q.id).toBeLessThan(cards.length);
      }
    }
  });
});

describe("guess who engine", () => {
  it("deals a shared board and private secrets that never reach the public state", () => {
    const h = new H();
    const round = h.duel();
    const omar = h.pid("g-omar");
    const sara = h.pid("g-sara");
    expect(round.board).toHaveLength(24);
    expect(round.board).toContain("stars/adel_emam");
    expect(round.board).toContain("stars/soad_hosny");
    expect(guessWhoPersonal(h.state, omar).card).toBe("stars/adel_emam");
    expect(guessWhoPersonal(h.state, sara).card).toBe("stars/soad_hosny");
    const pub = JSON.stringify(toPublicGuessWho(h.state)) + JSON.stringify(h.events);
    expect(pub).not.toContain("secrets");
    // Clients rebuild the same public state from the event log.
    expect(applyGwEvents(emptyGuessWhoState(), h.events)).toEqual(toPublicGuessWho(h.state));
  });

  it("answers ready-made questions from the opponent's card and passes the turn", () => {
    const h = new H();
    const round = h.duel();
    const first = round.currentId!;
    const firstGuest = first === h.pid("g-omar") ? "g-omar" : "g-sara";
    const otherGuest = firstGuest === "g-omar" ? "g-sara" : "g-omar";
    // Omar holds Adel Emam (a man, a comedian); Sara holds Soad Hosny (a woman).
    const r = h.ok(firstGuest, { type: "GW_ASK", questionId: "stars:female" });
    expect(r.data.answer).toBe(firstGuest === "g-omar" ? "yes" : "no");
    expect(h.state.match!.round!.currentId).toBe(h.pid(otherGuest));
    expect(h.run(firstGuest, { type: "GW_ASK", questionId: "stars:comedian" }).ok).toBe(false); // not your turn
    expect(h.run(otherGuest, { type: "GW_ASK", questionId: "food:dessert" }).ok).toBe(false); // wrong deck
    expect(h.state.match!.scores[first].questions).toBe(1);
  });

  it("typed questions wait for the opponent's YES/NO, then the turn passes", () => {
    const h = new H();
    const round = h.duel();
    const a = round.currentId === h.pid("g-omar") ? "g-omar" : "g-sara";
    const b = a === "g-omar" ? "g-sara" : "g-omar";
    h.ok(a, { type: "GW_ASK_FREE", text: "  Is your star   in a Ramadan series? " });
    expect(h.state.match!.round!.pending?.text).toBe("Is your star in a Ramadan series?");
    expect(errOf(h.run(a, { type: "GW_ASK", questionId: "stars:female" }))).toBe("QUESTION_PENDING");
    expect(h.run(a, { type: "GW_ANSWER", answer: "yes" }).ok).toBe(false); // the asker can't answer
    h.ok(b, { type: "GW_ANSWER", answer: "no" });
    const after = h.state.match!.round!;
    expect(after.pending).toBeNull();
    expect(after.log.at(-1)).toMatchObject({ kind: "free", text: "Is your star in a Ramadan series?", answer: "no" });
    expect(after.currentId).toBe(h.pid(b));
  });

  it("an unanswered typed question expires and the asker keeps the turn", () => {
    const h = new H();
    const round = h.duel();
    const a = round.currentId === h.pid("g-omar") ? "g-omar" : "g-sara";
    h.ok(a, { type: "GW_ASK_FREE", text: "Does he sing?" });
    h.advance(GW_TIMING.answerMs + 10);
    expect(h.state.match!.round!.pending).toBeNull();
    expect(h.state.match!.round!.currentId).toBe(h.pid(a));
  });

  it("flips are per player and validated against the board", () => {
    const h = new H();
    const round = h.duel();
    const card = round.board.find((c) => c !== "stars/adel_emam")!;
    h.ok("g-sara", { type: "GW_FLIP", cardIds: [card], down: true }); // any time, not only on your turn
    expect(h.state.match!.round!.flipped[h.pid("g-sara")]).toEqual([card]);
    expect(h.state.match!.round!.flipped[h.pid("g-omar")]).toEqual([]);
    h.ok("g-sara", { type: "GW_FLIP", cardIds: [card], down: false });
    expect(h.state.match!.round!.flipped[h.pid("g-sara")]).toEqual([]);
    expect(errOf(h.run("g-sara", { type: "GW_FLIP", cardIds: ["food/koshary"], down: true }))).toBe("INVALID_CARD");
  });

  it("a right guess wins the round and reveals both cards; best of 3 ends at 2 wins", () => {
    const h = new H();
    let round = h.duel(["stars/adel_emam", "stars/soad_hosny"], { rounds: 3 });
    const omar = h.pid("g-omar");
    const guessFor = (g: string) => (g === "g-omar" ? "stars/soad_hosny" : "stars/adel_emam");
    const guestOf = (id: string) => (id === omar ? "g-omar" : "g-sara");
    const g1 = guestOf(round.currentId!);
    h.ok(g1, { type: "GW_GUESS", cardId: guessFor(g1) });
    const res = h.state.match!.history[0];
    expect(res).toMatchObject({ outcome: "guessed", winnerId: h.pid(g1), secrets: { [omar]: "stars/adel_emam" } });
    expect(h.state.phase).toBe("GW_ROUND_RESULTS");
    expect(guessWhoPersonal(h.state, omar).card).toBeNull();

    h.ok("g-omar", { type: "DEV_GW_FORCE_SECRETS", cards: ["stars/adel_emam", "stars/soad_hosny"] });
    h.advance(GW_TIMING.intermissionMs);
    round = h.state.match!.round!;
    expect(round.number).toBe(2);
    expect(round.currentId).not.toBe(h.pid(g1)); // the loser opens the next round
    // The same winner wins again when their turn comes.
    const opener = guestOf(round.currentId!);
    h.ok(opener, { type: "GW_ASK", questionId: "stars:bw" });
    h.ok(g1, { type: "GW_GUESS", cardId: guessFor(g1) });
    expect(h.state.phase).toBe("GW_MATCH_RESULTS");
    expect(h.state.match!.result).toMatchObject({ winnerIds: [h.pid(g1)], reason: "completed" });
  });

  it("classic rule: a wrong guess loses; relaxed rule: it just costs the turn", () => {
    const h = new H();
    const round = h.duel(["stars/adel_emam", "stars/soad_hosny"], { rounds: 1 });
    const a = round.currentId === h.pid("g-omar") ? "g-omar" : "g-sara";
    const wrong = round.board.find((c) => c !== "stars/adel_emam" && c !== "stars/soad_hosny")!;
    h.ok(a, { type: "GW_GUESS", cardId: wrong });
    expect(h.state.match!.history[0]).toMatchObject({ outcome: "wrong_guess", guesserId: h.pid(a) });
    expect(h.state.match!.history[0].winnerId).not.toBe(h.pid(a));

    const h2 = new H();
    const r2 = h2.duel(["stars/adel_emam", "stars/soad_hosny"], { wrongGuessLoses: false });
    const a2 = r2.currentId === h2.pid("g-omar") ? "g-omar" : "g-sara";
    const wrong2 = r2.board.find((c) => c !== "stars/adel_emam" && c !== "stars/soad_hosny")!;
    const res = h2.ok(a2, { type: "GW_GUESS", cardId: wrong2 });
    expect(res.data.correct).toBe(false);
    expect(h2.state.phase).toBe("GW_PLAYING");
    expect(h2.state.match!.round!.flipped[h2.pid(a2)]).toContain(wrong2);
    expect(h2.state.match!.round!.currentId).not.toBe(h2.pid(a2));
  });

  it("the turn timer passes the turn", () => {
    const h = new H();
    h.duel(undefined, { turnTimer: 30 });
    const first = h.state.match!.round!.currentId;
    h.advance(30_000);
    expect(h.state.match!.round!.currentId).not.toBe(first);
  });

  it("a bot opponent plays by itself, flips what answers rule out, and can't take typed questions", () => {
    const h = new H({ rounds: 1 });
    h.ok("g-omar", { type: "ADD_BOT", level: "hard" });
    h.ok("g-omar", { type: "START" });
    h.advance(GW_TIMING.introMs);
    const bot = h.state.players.find((p) => p.isBot)!;
    let guard = 0;
    while (h.state.phase === "GW_PLAYING" && guard++ < 60) {
      const round = h.state.match!.round!;
      if (round.currentId === bot.id) h.advance(GW_TIMING.botDelayMs);
      else {
        if (guard === 1) expect(errOf(h.run("g-omar", { type: "GW_ASK_FREE", text: "Are you a robot?" }))).toBe("BOT_CANT_ANSWER");
        h.ok("g-omar", { type: "GW_ASK", questionId: GW_QUESTIONS.stars[guard % GW_QUESTIONS.stars.length].id });
      }
    }
    expect(h.state.phase).toBe("GW_MATCH_RESULTS");
    const flips = h.events.filter((e) => e.type === "GW_FLIPPED" && e.playerId === bot.id);
    expect(flips.length).toBeGreaterThan(0);
  });

  it("the bot never needs the secret: its candidates always contain the real card", () => {
    const h = new H();
    const round = h.duel();
    const omar = h.pid("g-omar");
    // Omar asks everything about Sara's card; candidates stay consistent with the truth.
    let r = round;
    for (const q of GW_QUESTIONS.stars.slice(0, 6)) {
      if (r.currentId !== omar) h.ok("g-sara", { type: "GW_ASK", questionId: "stars:bw" });
      h.ok("g-omar", { type: "GW_ASK", questionId: q.id });
      r = h.state.match!.round!;
    }
    const c = candidatesFor(r, omar);
    expect(c).toContain("stars/soad_hosny");
    expect(c.length).toBeLessThan(r.board.length);
    const move = botMove("hard", r, omar, lcg(1));
    if (move.kind === "guess") expect(c).toContain(move.cardId);
    else expect(r.log.some((l) => l.askerId === omar && l.questionId === move.questionId)).toBe(false);
  });

  it("a player leaving mid-round hands the match to the other; the clock schedules bots and timers", () => {
    const h = new H();
    h.duel(undefined, { turnTimer: 60 });
    expect(nextWakeGuessWho(h.state, h.now)).toBe(h.state.match!.round!.deadlineAt);
    h.ok("g-sara", { type: "LEAVE" });
    expect(h.state.phase).toBe("GW_MATCH_RESULTS");
    expect(h.state.match!.result).toMatchObject({ winnerIds: [h.pid("g-omar")], reason: "insufficient_players" });
  });

  it("rooms are duels: a third player can't join", () => {
    const h = new H();
    h.join("g-sara", "Sara", "red");
    const r = h.run("g-karim", { type: "JOIN", nickname: "Karim", avatar: "🐯", color: "green" });
    expect(r.ok).toBe(false);
    expect(!r.ok && r.error.code).toBe("ROOM_FULL");
    expect(cardById("stars/adel_emam")?.ar).toBe("عادل إمام");
  });
});
