import type { RandomSource } from "../dice";
import type { Command, CommandResult } from "../engine";
import { createRoom, executeCommand, findPlayerIdByGuest, toPublicState } from "../engine";
import type { GameEvent } from "../events";
import { applyEvents, emptyRoomState } from "../reducer";
import { TIMING } from "../rules";
import type { GameSettings, PlayerColor, RoomState, ServerRoomState } from "../types";

/** Deterministic LCG so tests are reproducible. */
export function lcg(seed = 42): RandomSource {
  let s = seed >>> 0;
  return {
    int(min, max) {
      s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
      return min + (s % (max - min + 1));
    },
  };
}

export class Harness {
  now = 1_700_000_000_000;
  state: ServerRoomState;
  events: GameEvent[] = [];
  presence: Record<string, number> = {};
  /** guest ids that are "connected" and heartbeat on every advance. */
  connected = new Set<string>();
  private ids = 0;
  rng: RandomSource;

  constructor(settings: Partial<GameSettings> = {}, hostNick = "Omar", hostColor: PlayerColor = "blue", seed = 7) {
    this.rng = lcg(seed);
    const created = createRoom(
      { roomId: "room-1", code: "K7MX42", settings, nickname: hostNick, avatar: "🦊", color: hostColor, guestId: "g-omar" },
      { now: this.now, rng: this.rng, newId: () => this.newId(), guestId: "g-omar", devTools: true, isAdmin: false },
    );
    this.state = created.state;
    this.events.push(...created.events);
    this.connected.add("g-omar");
    this.presence[created.hostId] = this.now;
  }

  newId() {
    this.ids += 1;
    return `id${String(this.ids).padStart(8, "0")}`;
  }

  pid(guest: string): string {
    const id = findPlayerIdByGuest(this.state, guest);
    if (!id) throw new Error(`no player for ${guest}`);
    return id;
  }

  run(guest: string | null, command: Command, commandId?: string): CommandResult {
    const actorId = guest ? findPlayerIdByGuest(this.state, guest) : null;
    const r = executeCommand(
      this.state,
      command,
      {
        now: this.now,
        rng: this.rng,
        newId: () => this.newId(),
        actorId,
        guestId: guest,
        presence: { ...this.presence },
        devTools: true,
        isAdmin: false,
      },
      commandId,
    );
    this.state = r.state;
    this.events.push(...r.events);
    Object.assign(this.presence, r.presence);
    return r;
  }

  ok(guest: string | null, command: Command) {
    const r = this.run(guest, command);
    if (!r.ok) throw new Error(`${command.type} failed: ${r.error.code} ${JSON.stringify(r.error.params)}`);
    return r;
  }

  join(guest: string, nickname: string, color?: PlayerColor) {
    this.connected.add(guest);
    return this.ok(guest, { type: "JOIN", nickname, avatar: "🐼", color });
  }

  heartbeat() {
    for (const g of this.connected) {
      const id = findPlayerIdByGuest(this.state, g);
      if (id) this.presence[id] = this.now;
    }
  }

  advance(ms: number) {
    this.now += ms;
    this.heartbeat();
    return this.run(null, { type: "TICK" });
  }

  /** Starts a match with everyone ready and runs past the intro. */
  startMatch() {
    for (const p of this.state.players) {
      if (!p.isReady && !p.isBot) {
        const guest = this.state.private.guests[p.id];
        this.ok(guest, { type: "SET_READY", ready: true });
      }
    }
    this.ok("g-omar", { type: "START" });
    this.advance(TIMING.matchIntroMs + 10);
  }

  forceDice(...dice: Array<[number, number]>) {
    this.ok("g-omar", { type: "DEV_FORCE_DICE", dice });
  }

  guestOf(playerId: string) {
    return this.state.private.guests[playerId];
  }

  currentGuest(): string {
    const cur = this.state.match!.round!.currentPlayerId!;
    return this.guestOf(cur);
  }

  round() {
    return this.state.match!.round!;
  }

  board(guest: string) {
    return this.round().players[this.pid(guest)].openTiles;
  }

  /** What a client that folded every event from scratch would see. */
  folded(): RoomState {
    return applyEvents(emptyRoomState(), this.events);
  }

  publicState(): RoomState {
    return toPublicState(this.state);
  }
}
