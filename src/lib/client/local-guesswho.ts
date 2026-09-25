"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { secureRandom, type BotLevel, type PlayerColor } from "@/game-engine";
import {
  createGuessWhoRoom,
  executeGuessWho,
  guessWhoPersonal,
  nextWakeGuessWho,
  toPublicGuessWho,
  type GuessWhoServerState,
  type GuessWhoSettings,
  type GwCommand,
} from "@/games/guesswho";
import type { AnyClientEvent, AnyRoomState } from "./games";
import type { RoomHandle } from "./use-room";

const GUEST = "local-player";
const newId = () => globalThis.crypto.randomUUID();

/**
 * Solo practice: the real Guess Who engine running in this browser against a
 * bot. No server, no database — but the same rules and the same screen
 * (exposed as a RoomHandle).
 */
export function useLocalGuessWho() {
  const [server, setServer] = useState<GuessWhoServerState | null>(null);
  const serverRef = useRef<GuessWhoServerState | null>(null);
  const meRef = useRef<string | null>(null);
  const listeners = useRef(new Set<(e: AnyClientEvent, after: AnyRoomState) => void>());

  const exec = useCallback((command: GwCommand) => {
    const base = serverRef.current;
    if (!base) return null;
    const now = Date.now();
    const r = executeGuessWho(base, command, {
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
    const pub = toPublicGuessWho(r.state);
    for (const e of r.events) for (const l of listeners.current) l(e, pub);
    return r;
  }, []);

  const start = useCallback(
    (settings: Partial<GuessWhoSettings>, level: BotLevel, profile: { nickname: string; avatar: string; color: PlayerColor | null }) => {
      const created = createGuessWhoRoom(
        { roomId: newId(), code: "SOLO", settings: { ...settings, turnTimer: 0, freeQuestions: false }, nickname: profile.nickname || "You", avatar: profile.avatar, color: profile.color, guestId: GUEST },
        { now: Date.now(), rng: secureRandom, newId, guestId: GUEST, devTools: false, isAdmin: false },
      );
      serverRef.current = created.state;
      meRef.current = created.hostId;
      exec({ type: "ADD_BOT", level });
      exec({ type: "START" });
    },
    [exec],
  );

  const stop = useCallback(() => {
    serverRef.current = null;
    meRef.current = null;
    setServer(null);
  }, []);

  // The lazy clock: wake the engine at its next deadline (intro, bot turns, intermission).
  useEffect(() => {
    if (!server) return;
    const wake = nextWakeGuessWho(server, Date.now());
    if (wake === null) return;
    const id = setTimeout(() => exec({ type: "TICK" }), Math.max(50, wake - Date.now() + 30));
    return () => clearTimeout(id);
  }, [server, exec]);

  const handle = useMemo<RoomHandle | null>(() => {
    if (!server) return null;
    const pub = toPublicGuessWho(server);
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
      presence: new Set(me ? [me] : []),
      personal: guessWhoPersonal(server, me),
      send: async (command) => {
        const r = exec(command as GwCommand);
        if (!r) return { ok: false, error: { code: "ROOM_CLOSED", params: {} } };
        return r.ok ? { ok: true, data: r.data } : { ok: false, error: { code: r.error.code, params: r.error.params } };
      },
      subscribe: (fn) => {
        listeners.current.add(fn);
        return () => listeners.current.delete(fn);
      },
      reload: () => undefined,
    };
  }, [server, exec]);

  return { room: handle, start, stop };
}
