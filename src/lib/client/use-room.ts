"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { apiFetch, getConfig, sendCommand, serverNow, type ApiError, type RuntimeConfig } from "./api";
import { applyAny, displayDelay, refreshesPersonal, wakeAny, type AnyClientEvent, type AnyCommand, type AnyPersonal, type AnyRoomState } from "./games";
import { openFeed, openPresence, type Feed } from "./realtime";

/**
 * Room synchronisation.
 *
 * - `auth` is the authoritative client copy: the server snapshot folded with
 *   every event in strict `seq` order (gaps trigger a delta fetch).
 * - `state` (display) replays the same events through a short presentation
 *   queue so dice can tumble, "Checking moves…" can breathe, tiles can flip.
 *   Backlogs (reconnect, refresh) fast-forward instantly.
 * - Heartbeats every 8 s prove presence and double as a missed-event check.
 * - A tick is scheduled for the next server deadline (timers, countdowns).
 */

export type RoomStatus = "loading" | "ready" | "not_member" | "not_found" | "error";
export type NetStatus = "online" | "reconnecting" | "offline";

const HEARTBEAT_MS = 8000;
export interface RoomHandle {
  status: RoomStatus;
  errorCode: string | null;
  state: AnyRoomState | null;
  auth: AnyRoomState | null;
  me: string | null;
  spectator: boolean;
  net: NetStatus;
  restoredAt: number | null;
  realtimeHealthy: boolean;
  config: RuntimeConfig | null;
  presence: Set<string>;
  /** Viewer-only data from the server (Hangman: own secret word / race board; Guess Who: own secret card). */
  personal: AnyPersonal | null;
  send: (command: AnyCommand) => Promise<{ ok: true; data: Record<string, unknown> } | { ok: false; error: ApiError }>;
  subscribe: (fn: (e: AnyClientEvent, after: AnyRoomState) => void) => () => void;
  reload: () => void;
}

export function useRoom(code: string): RoomHandle {
  const [status, setStatus] = useState<RoomStatus>("loading");
  const [errorCode, setErrorCode] = useState<string | null>(null);
  const [display, setDisplay] = useState<AnyRoomState | null>(null);
  const [auth, setAuth] = useState<AnyRoomState | null>(null);
  const [me, setMe] = useState<string | null>(null);
  const [spectator, setSpectator] = useState(false);
  const [net, setNet] = useState<NetStatus>("online");
  const [restoredAt, setRestoredAt] = useState<number | null>(null);
  const [realtimeHealthy, setRealtimeHealthy] = useState(false);
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [presence, setPresence] = useState<Set<string>>(new Set());
  const [personal, setPersonal] = useState<AnyPersonal | null>(null);
  const [reloadKey, setReloadKey] = useState(0);

  const authRef = useRef<AnyRoomState | null>(null);
  const displayRef = useRef<AnyRoomState | null>(null);
  const queueRef = useRef<AnyClientEvent[]>([]);
  const pumpingRef = useRef(false);
  const pumpTimer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const listeners = useRef(new Set<(e: AnyClientEvent, after: AnyRoomState) => void>());
  const resyncing = useRef(false);
  const resyncAgain = useRef(false);
  const failures = useRef(0);
  const meRef = useRef<string | null>(null);
  const alive = useRef(true);

  const setSnapshot = useCallback((state: AnyRoomState) => {
    authRef.current = state;
    displayRef.current = state;
    queueRef.current = [];
    clearTimeout(pumpTimer.current);
    pumpingRef.current = false;
    setAuth(state);
    setDisplay(state);
  }, []);

  // Private data (e.g. a newly dealt Guess Who card) is not in the event feed: fetch it for this viewer.
  const refreshPersonal = useCallback(() => {
    void apiFetch<{ personal: AnyPersonal | null }>(`/api/rooms/${code}/state`).then((res) => {
      if (alive.current && res.ok) setPersonal(res.personal ?? null);
    });
  }, [code]);

  const pump = useCallback(() => {
    if (pumpingRef.current) return;
    const step = () => {
      if (!alive.current) return;
      const next = queueRef.current.shift();
      if (!next || !displayRef.current) {
        pumpingRef.current = false;
        return;
      }
      const backlog = queueRef.current.length;
      const after = applyAny(displayRef.current, next);
      if (refreshesPersonal(next)) refreshPersonal();
      displayRef.current = after;
      setDisplay(after);
      for (const l of listeners.current) {
        try {
          l(next, after);
        } catch (err) {
          console.error(err);
        }
      }
      const delay = displayDelay(next, backlog);
      if (delay === 0) step();
      else pumpTimer.current = setTimeout(step, delay);
    };
    pumpingRef.current = true;
    step();
  }, [refreshPersonal]);

  const resync = useCallback(async () => {
    if (resyncing.current) {
      resyncAgain.current = true;
      return;
    }
    const base = authRef.current;
    if (!base) return;
    resyncing.current = true;
    try {
      const res = await apiFetch<{ events?: AnyClientEvent[]; reset?: AnyRoomState; personal?: AnyPersonal | null; version: number; me?: string | null }>(
        `/api/rooms/${code}/events?since=${base.version}`,
      );
      if (!alive.current || !res.ok) return;
      if (res.reset) {
        setSnapshot(res.reset);
        setPersonal(res.personal ?? null);
      }
      else if (res.events?.length) ingestRef.current(res.events);
    } finally {
      resyncing.current = false;
      if (resyncAgain.current) {
        resyncAgain.current = false;
        void resync();
      }
    }
  }, [code, setSnapshot]);

  const ingest = useCallback(
    (events: AnyClientEvent[]) => {
      let base = authRef.current;
      if (!base || events.length === 0) return;
      const sorted = [...events].sort((a, b) => a.seq - b.seq);
      let gap = false;
      for (const e of sorted) {
        if (e.seq <= base.version) continue; // duplicate delivery
        if (e.seq !== base.version + 1) {
          gap = true;
          break;
        }
        base = applyAny(base, e);
        queueRef.current.push(e);
      }
      if (base !== authRef.current) {
        authRef.current = base;
        setAuth(base);
        pump();
      }
      if (gap) void resync();
    },
    [pump, resync],
  );
  const ingestRef = useRef(ingest);
  useEffect(() => {
    ingestRef.current = ingest;
  }, [ingest]);

  // Initial snapshot.
  useEffect(() => {
    alive.current = true;
    let cancelled = false;
    (async () => {
      const [cfg, res] = await Promise.all([
        getConfig(),
        apiFetch<{ state: AnyRoomState; me: string | null; spectator: boolean; personal: AnyPersonal | null }>(`/api/rooms/${code}/state`),
      ]);
      if (cancelled) return;
      setConfig(cfg);
      if (!res.ok) {
        setErrorCode(res.error.code);
        setStatus(res.error.code === "NOT_A_PLAYER" ? "not_member" : res.error.code === "ROOM_NOT_FOUND" ? "not_found" : "error");
        return;
      }
      meRef.current = res.me;
      setMe(res.me);
      setSpectator(res.spectator);
      setPersonal(res.personal ?? null);
      setSnapshot(res.state);
      setStatus("ready");
    })();
    return () => {
      cancelled = true;
      alive.current = false;
      clearTimeout(pumpTimer.current);
    };
  }, [code, reloadKey, setSnapshot]);

  const roomId = auth?.roomId ?? null;

  // Realtime feed + presence.
  useEffect(() => {
    if (status !== "ready" || !config || !roomId) return;
    const feed: Feed = openFeed(config, code, roomId, {
      onEvents: (events) => ingestRef.current(events),
      onHealthy: setRealtimeHealthy,
      onResync: () => void resync(),
    });
    const pres = openPresence(config, roomId, meRef.current, setPresence);
    return () => {
      feed.close();
      pres.close();
    };
  }, [status, config, roomId, code, resync]);

  // Heartbeat, visibility and connectivity.
  useEffect(() => {
    if (status !== "ready") return;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const beat = async () => {
      clearTimeout(timer);
      if (!meRef.current) {
        void resync();
        timer = setTimeout(beat, HEARTBEAT_MS);
        return;
      }
      const res = await apiFetch<{ version: number; me: string | null; events: AnyClientEvent[] }>(`/api/rooms/${code}/heartbeat`, { method: "POST" });
      if (!alive.current) return;
      if (res.ok) {
        if (failures.current > 0) setRestoredAt(serverNow());
        failures.current = 0;
        setNet("online");
        if (res.events?.length) ingestRef.current(res.events);
        if (authRef.current && res.version > authRef.current.version) void resync();
      } else if (res.error.code === "CONNECTION") {
        failures.current += 1;
        setNet(typeof navigator !== "undefined" && navigator.onLine === false ? "offline" : "reconnecting");
      } else if (res.error.code === "NOT_A_PLAYER") {
        meRef.current = null;
        setMe(null);
        setStatus("not_member");
      }
      timer = setTimeout(beat, failures.current ? 3000 : HEARTBEAT_MS);
    };
    void beat();
    const onVisible = () => document.visibilityState === "visible" && void beat();
    const onOnline = () => void beat();
    const onOffline = () => setNet("offline");
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", onOffline);
    return () => {
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("online", onOnline);
      window.removeEventListener("offline", onOffline);
    };
  }, [status, code, resync]);

  // Poll when realtime is down (and slowly for spectators as a safety net).
  useEffect(() => {
    if (status !== "ready" || realtimeHealthy) return;
    const id = setInterval(() => void resync(), 2500);
    return () => clearInterval(id);
  }, [status, realtimeHealthy, resync]);

  // Tick at the next server deadline.
  useEffect(() => {
    if (status !== "ready" || !auth) return;
    const wake = wakeAny(auth, serverNow());
    if (wake === null) return;
    const delay = Math.max(250, wake - serverNow() + 150 + Math.random() * 400);
    const id = setTimeout(async () => {
      const res = await sendCommand(code, { type: "TICK" });
      if (res.ok && res.events?.length) ingestRef.current(res.events);
    }, delay);
    return () => clearTimeout(id);
  }, [status, auth, code]);

  const send = useCallback<RoomHandle["send"]>(
    async (command) => {
      const res = await sendCommand(code, command);
      if (res.events?.length) ingestRef.current(res.events);
      if (res.ok && res.data && "personal" in res.data) setPersonal(res.data.personal as AnyPersonal);
      if (res.ok && res.data && typeof res.data.secret === "string") setPersonal((p) => ({ ...p, secret: res.data!.secret as string }));
      if (res.ok && res.me !== undefined && res.me !== meRef.current) {
        meRef.current = res.me ?? null;
        setMe(res.me ?? null);
      }
      if (!res.ok) {
        if (res.error.code === "CONNECTION") setNet("reconnecting");
        return { ok: false, error: res.error };
      }
      return { ok: true, data: res.data ?? {} };
    },
    [code],
  );

  const subscribe = useCallback<RoomHandle["subscribe"]>((fn) => {
    listeners.current.add(fn);
    return () => listeners.current.delete(fn);
  }, []);

  const reload = useCallback(() => {
    setStatus("loading");
    setReloadKey((k) => k + 1);
  }, []);

  return { status, errorCode, state: display, auth, me, spectator, net, restoredAt, realtimeHealthy, config, presence, personal, send, subscribe, reload };
}
