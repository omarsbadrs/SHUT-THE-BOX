"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { secureRandom, type BotLevel, type CommandContext, type PlayerColor } from "@/game-engine";
import type { AnyClientEvent, AnyCommand, AnyPersonal, AnyRoomState } from "./games";
import type { RoomHandle } from "./use-room";

const GUEST = "local-player";
const newId = () => globalThis.crypto.randomUUID();

export interface LocalExec<S> {
  ok: boolean;
  state: S;
  events: AnyClientEvent[];
  data?: Record<string, unknown>;
  error?: { code: string; params: Record<string, string | number> };
}

/** What a game provides to be played offline against a bot on this phone. */
export interface LocalAdapter<S extends { hostId: string }, P extends AnyRoomState, C extends AnyCommand> {
  create(
    params: { roomId: string; code: string; settings: Record<string, unknown>; nickname: string; avatar: string; color: PlayerColor | null; guestId: string },
    ctx: Omit<CommandContext, "actorId" | "presence">,
  ): { state: S; hostId: string };
  execute(state: S, command: C, ctx: CommandContext): LocalExec<S>;
  toPublic(state: S): P;
  personal(state: S, me: string): AnyPersonal | null;
  nextWake(state: P, now: number): number | null;
}

/**
 * Solo practice: the real game engine running in this browser against a bot.
 * No server, no database — same rules, same screen (exposed as a RoomHandle).
 */
export function useLocalGame<S extends { hostId: string }, P extends AnyRoomState, C extends AnyCommand>(adapter: LocalAdapter<S, P, C>) {
  const [server, setServer] = useState<S | null>(null);
  const serverRef = useRef<S | null>(null);
  const meRef = useRef<string | null>(null);
  const listeners = useRef(new Set<(e: AnyClientEvent, after: AnyRoomState) => void>());

  const exec = useCallback(
    (command: C) => {
      const base = serverRef.current;
      if (!base) return null;
      const now = Date.now();
      const r = adapter.execute(base, command, {
        now,
        rng: secureRandom,
        newId,
        actorId: meRef.current,
        guestId: GUEST,
        presence: meRef.current ? { [meRef.current]: now } : {},
        devTools: false,
        isAdmin: false,
      });
      serverRef.current = r.state;
      setServer(r.state);
      const pub = adapter.toPublic(r.state);
      for (const e of r.events) for (const l of listeners.current) l(e, pub);
      return r;
    },
    [adapter],
  );

  const start = useCallback(
    (settings: Record<string, unknown>, level: BotLevel, profile: { nickname: string; avatar: string; color: PlayerColor | null }) => {
      const created = adapter.create(
        { roomId: newId(), code: "SOLO", settings, nickname: profile.nickname || "You", avatar: profile.avatar, color: profile.color, guestId: GUEST },
        { now: Date.now(), rng: secureRandom, newId, guestId: GUEST, devTools: false, isAdmin: false },
      );
      serverRef.current = created.state;
      meRef.current = created.hostId;
      exec({ type: "ADD_BOT", level } as C);
      exec({ type: "START" } as C);
    },
    [adapter, exec],
  );

  const stop = useCallback(() => {
    serverRef.current = null;
    meRef.current = null;
    setServer(null);
  }, []);

  // The lazy clock: wake the engine at its next deadline (intro, bot turns, intermission).
  useEffect(() => {
    if (!server) return;
    const wake = adapter.nextWake(adapter.toPublic(server), Date.now());
    if (wake === null) return;
    const id = setTimeout(() => exec({ type: "TICK" } as C), Math.max(50, wake - Date.now() + 30));
    return () => clearTimeout(id);
  }, [server, exec, adapter]);

  const handle = useMemo<RoomHandle | null>(() => {
    if (!server) return null;
    const pub = adapter.toPublic(server);
    const me = server.hostId; // the human is always the host; the bot can't be
    return {
      status: "ready",
      errorCode: null,
      state: pub,
      auth: pub,
      me,
      spectator: false,
      net: "online",
      restoredAt: null,
      realtimeHealthy: true,
      config: null,
      presence: new Set([me]),
      personal: adapter.personal(server, me),
      send: async (command) => {
        const r = exec(command as C);
        if (!r) return { ok: false, error: { code: "ROOM_CLOSED", params: {} } };
        return r.ok ? { ok: true, data: r.data ?? {} } : { ok: false, error: r.error ?? { code: "SERVER_ERROR", params: {} } };
      },
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
      reload: () => undefined,
    };
  }, [server, exec, adapter]);

  return { room: handle, start, stop };
}
