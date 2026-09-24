import { readFileSync } from "node:fs";
import { randomUUID } from "node:crypto";
import { PGlite } from "@electric-sql/pglite";
import { beforeAll, describe, expect, it } from "vitest";
import { createRoom, executeCommand, findPlayerIdByGuest, TIMING, type Command, type GameEvent, type ServerRoomState } from "@/game-engine";
import { lcg } from "@/game-engine/__tests__/harness";

/**
 * Runs the real migration on an embedded Postgres (PGlite) with small shims
 * for Supabase roles, then drives it with events produced by the engine.
 */

const SQL = readFileSync(new URL("./migrations/20260924000000_shut10_schema.sql", import.meta.url), "utf8");
const PRELUDE = `
  create role anon nologin; create role authenticated nologin; create role service_role nologin;
  create publication supabase_realtime;
`;

let db: PGlite;

beforeAll(async () => {
  db = new PGlite();
  await db.exec(PRELUDE);
  await db.exec(SQL);
  // Idempotent: the migration can be re-applied.
  await db.exec(SQL);
}, 60_000);

async function rpc<T = unknown>(fn: string, args: unknown[]): Promise<T> {
  const params = args.map((_, i) => `$${i + 1}`).join(", ");
  const res = await db.query<{ r: T }>(`select public.${fn}(${params}) as r`, args.map((a) => (typeof a === "object" && a !== null ? JSON.stringify(a) : a)));
  return res.rows[0]?.r as T;
}

class DbGame {
  now = 1_700_000_000_000;
  rng = lcg(3);
  state!: ServerRoomState;
  presence: Record<string, number> = {};
  roomId = randomUUID();

  async create() {
    const created = createRoom(
      { roomId: this.roomId, code: "K7MX42", nickname: "Omar", avatar: "🦊", color: "blue", guestId: "g-omar", settings: { rollTimer: 0, moveTimer: 0, matchFormat: "best_of", rounds: 3 } },
      { now: this.now, rng: this.rng, newId: randomUUID, guestId: "g-omar", devTools: true, isAdmin: false },
    );
    this.state = created.state;
    expect(await rpc("shut10_create_room", [this.roomId, "K7MX42", created.state, created.events])).toBe(true);
  }

  async run(guest: string | null, command: Command) {
    const actorId = guest ? findPlayerIdByGuest(this.state, guest) : null;
    const r = executeCommand(this.state, command, {
      now: this.now,
      rng: this.rng,
      newId: randomUUID,
      actorId,
      guestId: guest,
      presence: this.presence,
      devTools: true,
      isAdmin: false,
    });
    if (!r.ok) throw new Error(`${command.type}: ${r.error.code}`);
    if (r.changed) {
      const ok = await rpc<boolean>("shut10_commit", [this.roomId, this.state.version, r.state, r.events]);
      expect(ok).toBe(true);
    }
    this.state = r.state;
    return r;
  }

  heartbeat(...guests: string[]) {
    for (const g of guests) this.presence[findPlayerIdByGuest(this.state, g)!] = this.now;
  }
}

describe("supabase migration", () => {
  it("creates rooms atomically and rejects duplicate codes", async () => {
    const g = new DbGame();
    await g.create();
    const again = createRoom(
      { roomId: randomUUID(), code: "K7MX42", nickname: "X", avatar: "🦊", guestId: "g-x" },
      { now: g.now, rng: g.rng, newId: randomUUID, guestId: "g-x", devTools: false, isAdmin: false },
    );
    expect(await rpc("shut10_create_room", [again.state.roomId, "K7MX42", again.state, again.events])).toBe(false);
    await db.exec("delete from rooms where code = 'K7MX42'");
  });

  it("commits with optimistic versioning and projects a full round", async () => {
    const g = new DbGame();
    await g.create();
    await g.run("g-ahmed", { type: "JOIN", nickname: "Ahmed", avatar: "🐼", color: "green" });
    await g.run("g-ahmed", { type: "SET_READY", ready: true });
    await g.run("g-omar", { type: "START" });
    g.now += TIMING.matchIntroMs + 10;
    g.heartbeat("g-omar", "g-ahmed");
    await g.run(null, { type: "TICK" });

    const omar = findPlayerIdByGuest(g.state, "g-omar")!;
    if (g.state.match!.round!.currentPlayerId !== omar) await g.run("g-omar", { type: "DEV_SET_TURN", playerId: omar });
    await g.run("g-omar", { type: "DEV_FORCE_DICE", dice: [[3, 5], [2, 6]] });
    await g.run("g-omar", { type: "ROLL" });
    const turnId = g.state.match!.round!.players[omar].pending!.turnId;
    await g.run("g-omar", { type: "CLOSE_TILES", turnId, tiles: [3, 5] });

    // Stale version is rejected atomically.
    const stale = await rpc<boolean>("shut10_commit", [g.roomId, g.state.version - 1, g.state, [{ type: "TICK", seq: g.state.version, at: g.now }]]);
    expect(stale).toBe(false);

    const players = await db.query<{ nickname: string; color: string; is_host: boolean; guest_id: string }>(
      "select nickname, color, is_host, guest_id from room_players where room_id = $1 order by seat_position",
      [g.roomId],
    );
    expect(players.rows).toEqual([
      { nickname: "Omar", color: "blue", is_host: true, guest_id: "g-omar" },
      { nickname: "Ahmed", color: "green", is_host: false, guest_id: "g-ahmed" },
    ]);

    const tiles = await db.query<{ open_tiles: number[] }>("select open_tiles from tile_states where player_id = $1", [omar]);
    expect(tiles.rows[0].open_tiles).toEqual([1, 2, 4, 6, 7, 8, 9, 10]);
    const turn = await db.query<{ status: string; selected_tiles: number[]; total: number }>("select status, selected_tiles, total from turns where id = $1", [turnId]);
    expect(turn.rows[0]).toEqual({ status: "RESOLVED", selected_tiles: [3, 5], total: 8 });
    const rolls = await db.query<{ n: number }>("select count(*)::int n from dice_rolls where room_id = $1", [g.roomId]);
    expect(rolls.rows[0].n).toBe(1);

    // Finish the round: Omar shuts the box.
    await g.run("g-omar", { type: "DEV_SHUT_BOARD", playerId: omar });
    const scores = await db.query<{ open_tile_sum: number; placement: number; perfect_box: boolean }>(
      "select open_tile_sum, placement, perfect_box from round_scores order by placement",
    );
    expect(scores.rows[0]).toEqual({ open_tile_sum: 0, placement: 1, perfect_box: true });
    const mp = await db.query<{ round_wins: number }>("select round_wins from match_players where room_player_id = $1", [omar]);
    expect(mp.rows[0].round_wins).toBe(1);

    // Events are ordered and contiguous; events_since returns deltas.
    const since = await rpc<GameEvent[]>("shut10_events_since", [g.roomId, g.state.version - 3, 100]);
    expect(since.map((e) => e.seq)).toEqual([g.state.version - 2, g.state.version - 1, g.state.version]);
    const loaded = await rpc<ServerRoomState>("shut10_load_room", ["k7mx42"]);
    expect(loaded.version).toBe(g.state.version);

    // Presence round-trip.
    await rpc("shut10_touch", [g.roomId, { [omar]: g.now + 5000 }]);
    const presence = await rpc<Record<string, number>>("shut10_presence", [g.roomId]);
    expect(presence[omar]).toBe(g.now + 5000);

    // Rematch with shuffled colors swaps colors without violating uniqueness.
    await g.run("g-omar", { type: "END_MATCH" });
    await g.run("g-omar", { type: "REMATCH", shuffleColors: true });
    const after = await db.query<{ id: string; color: string }>("select id, color from room_players where room_id = $1 and left_at is null", [g.roomId]);
    for (const row of after.rows) expect(row.color).toBe(g.state.players.find((p) => p.id === row.id)!.color);

    const finished = await db.query<{ n: number }>("select count(*)::int n from match_scores");
    expect(finished.rows[0].n).toBe(2);

    const errors = await db.query<{ message: string; context: unknown }>("select message, context from error_events");
    expect(errors.rows).toEqual([]);
  });

  it("anon cannot write, and only reads game events", async () => {
    await db.exec("set role anon");
    await expect(db.query("insert into rooms (id, code, state) values (gen_random_uuid(), 'ABCDEF', '{}')")).rejects.toThrow();
    await expect(db.query("select * from rooms")).rejects.toThrow();
    await expect(db.query("select public.shut10_load_room('K7MX42')")).rejects.toThrow();
    const events = await db.query("select count(*) from game_events");
    expect(events.rows).toHaveLength(1);
    await db.exec("reset role");
  });

  it("admin overview aggregates", async () => {
    await rpc("shut10_record_analytics", [[{ name: "room_created", roomId: null, props: {}, at: Date.now() }]]);
    const o = await rpc<{ store: string; stats: { roomsCreated: number } }>("shut10_admin_overview", []);
    expect(o.store).toBe("supabase");
    expect(o.stats.roomsCreated).toBe(1);
  });
});
