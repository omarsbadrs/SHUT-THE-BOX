import "server-only";
import { EventEmitter } from "node:events";
import type { AdminOverview, AnalyticsRow, AnyMatchSummary as MatchSummary, RoomStore, ServerRoomState, StoredEvent as GameEvent } from "./types";

/**
 * Single-process store for local development and the Playwright suite.
 * Commits are atomic because the version check and the write happen
 * synchronously (no await between them) on Node's single thread.
 * NOT used on Vercel (see env.storeMode).
 */

interface MemoryDb {
  rooms: Map<string, { state: ServerRoomState; events: GameEvent[]; updatedAt: number }>;
  codes: Map<string, string>;
  presence: Map<string, Map<string, number>>;
  matches: Map<string, { code: string; summary: MatchSummary | null }>;
  analytics: AnalyticsRow[];
  errors: Array<{ source: string; message: string; at: number }>;
  profiles: Map<string, string>;
  bus: EventEmitter;
}

const g = globalThis as typeof globalThis & { __shut10MemoryDb?: MemoryDb };

function db(): MemoryDb {
  if (!g.__shut10MemoryDb) {
    const bus = new EventEmitter();
    bus.setMaxListeners(0);
    g.__shut10MemoryDb = {
      rooms: new Map(),
      codes: new Map(),
      presence: new Map(),
      matches: new Map(),
      analytics: [],
      errors: [],
      profiles: new Map(),
      bus,
    };
  }
  return g.__shut10MemoryDb;
}

/** Local realtime: SSE subscribers listen on this bus. */
export function subscribeMemoryRoom(roomId: string, fn: (events: GameEvent[]) => void): () => void {
  const bus = db().bus;
  bus.on(roomId, fn);
  return () => bus.off(roomId, fn);
}

function clone<T>(v: T): T {
  return structuredClone(v);
}

export class MemoryStore implements RoomStore {
  readonly kind = "memory" as const;

  async createRoom(state: ServerRoomState, events: GameEvent[]) {
    const d = db();
    if (d.codes.has(state.code)) return "code_taken" as const;
    d.codes.set(state.code, state.roomId);
    d.rooms.set(state.roomId, { state: clone(state), events: clone(events), updatedAt: Date.now() });
    return "ok" as const;
  }

  async loadRoomByCode(code: string) {
    const d = db();
    const id = d.codes.get(code);
    const row = id ? d.rooms.get(id) : undefined;
    return row ? clone(row.state) : null;
  }

  async commit(roomId: string, expectedVersion: number, state: ServerRoomState, events: GameEvent[]) {
    const row = db().rooms.get(roomId);
    if (!row || row.state.version !== expectedVersion) return false;
    if (state.version !== expectedVersion + events.length) return false;
    if (events.length && events[0].seq !== expectedVersion + 1) return false;
    row.state = clone(state);
    row.updatedAt = Date.now();
    if (events.length) {
      row.events.push(...clone(events));
      if (row.events.length > 5000) row.events.splice(0, row.events.length - 5000);
      queueMicrotask(() => db().bus.emit(roomId, clone(events)));
    }
    return true;
  }

  async eventsSince(roomId: string, seq: number, limit: number) {
    const row = db().rooms.get(roomId);
    if (!row) return [];
    return clone(row.events.filter((e) => e.seq > seq).slice(0, limit));
  }

  async touchPresence(roomId: string, entries: Record<string, number>) {
    const d = db();
    let m = d.presence.get(roomId);
    if (!m) d.presence.set(roomId, (m = new Map()));
    for (const [pid, at] of Object.entries(entries)) m.set(pid, at);
  }

  async getPresence(roomId: string) {
    return Object.fromEntries(db().presence.get(roomId) ?? []);
  }

  async archiveMatch(summary: MatchSummary) {
    db().matches.set(summary.matchId, { code: summary.code, summary: clone(summary) });
  }

  async findMatch(matchId: string) {
    const d = db();
    const archived = d.matches.get(matchId);
    if (archived) return clone(archived);
    for (const row of d.rooms.values()) {
      if (row.state.match?.id === matchId) return { code: row.state.code, summary: null };
    }
    return null;
  }

  async recordAnalytics(rows: AnalyticsRow[]) {
    const d = db();
    d.analytics.push(...rows);
    if (d.analytics.length > 20000) d.analytics.splice(0, d.analytics.length - 20000);
  }

  async recordError(source: string, message: string) {
    const d = db();
    d.errors.push({ source, message, at: Date.now() });
    if (d.errors.length > 500) d.errors.splice(0, d.errors.length - 500);
  }

  async linkProfile(userId: string, guestId: string) {
    const d = db();
    const existing = d.profiles.get(userId);
    if (existing) return existing;
    d.profiles.set(userId, guestId);
    return guestId;
  }

  async adminOverview(): Promise<AdminOverview> {
    const d = db();
    const count = (name: string) => d.analytics.filter((a) => a.name === name).length;
    const started = d.analytics.filter((a) => a.name === "game_started");
    const completed = d.analytics.filter((a) => a.name === "game_completed");
    const rounds = d.analytics.filter((a) => a.name === "round_completed");
    const avg = (xs: number[]) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : 0);
    const activeRooms = [...d.rooms.values()]
      .filter((r) => r.state.phase !== "FINISHED")
      .sort((a, b) => b.updatedAt - a.updatedAt)
      .slice(0, 100)
      .map((r) => ({
        roomId: r.state.roomId,
        code: r.state.code,
        phase: r.state.phase,
        mode: r.state.settings.gameMode,
        players: r.state.players.filter((p) => p.connection !== "left").length,
        version: r.state.version,
        updatedAt: new Date(r.updatedAt).toISOString(),
      }));
    const finishedMatches = [...d.matches.entries()]
      .filter(([, m]) => m.summary)
      .slice(-50)
      .reverse()
      .map(([id, m]) => {
        const s = m.summary!;
        const winner = s.players.find((p) => s.result.winnerIds[0] === p.id)?.nickname ?? "—";
        return { matchId: id, code: m.code, winner, rounds: s.history.length, endedAt: new Date(s.endedAt).toISOString() };
      });
    const startedCount = started.length;
    return {
      store: "memory",
      activeRooms,
      finishedMatches,
      stats: {
        roomsCreated: count("room_created"),
        matchesStarted: startedCount,
        matchesCompleted: completed.length,
        rematches: count("rematch"),
        averageRoomSize: avg(started.map((a) => Number(a.props.players ?? 0))),
        averageRounds: avg(completed.map((a) => Number(a.props.rounds ?? 0))),
        averageScore: avg(rounds.map((a) => Number(a.props.averageScore ?? 0))),
        perfectBoxes: count("perfect_box"),
        completionRate: startedCount ? completed.length / startedCount : 0,
        rematchRate: completed.length ? count("rematch") / completed.length : 0,
      },
      errors: d.errors.slice(-50).reverse().map((e) => ({ source: e.source, message: e.message, at: new Date(e.at).toISOString() })),
    };
  }
}
