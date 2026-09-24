"use client";

import { createClient, type RealtimeChannel, type SupabaseClient } from "@supabase/supabase-js";
import type { GameEvent } from "@/game-engine";
import type { RuntimeConfig } from "./api";

/**
 * Realtime transport. Production: Supabase Realtime postgres_changes on the
 * append-only game_events table (events come from the database, so a client
 * cannot forge them) plus Presence for connection dots. Local: SSE.
 * Either way the payloads are the same event deltas.
 */

let supabase: SupabaseClient | null = null;

export function supabaseClient(config: RuntimeConfig): SupabaseClient | null {
  if (!config.supabaseUrl || !config.supabasePublishableKey) return null;
  supabase ??= createClient(config.supabaseUrl, config.supabasePublishableKey, {
    auth: { persistSession: true, autoRefreshToken: true },
  });
  return supabase;
}

export interface FeedHandlers {
  onEvents: (events: GameEvent[]) => void;
  onHealthy: (healthy: boolean) => void;
  /** Transport (re)connected: caller should reconcile via /events. */
  onResync: () => void;
}

export interface Feed {
  close: () => void;
}

export function openFeed(config: RuntimeConfig, code: string, roomId: string, h: FeedHandlers): Feed {
  if (config.realtime === "supabase") {
    const client = supabaseClient(config);
    if (!client) {
      h.onHealthy(false);
      return { close() {} };
    }
    const channel: RealtimeChannel = client
      .channel(`events:${roomId}`)
      .on(
        "postgres_changes",
        { event: "INSERT", schema: "public", table: "game_events", filter: `room_id=eq.${roomId}` },
        (payload) => {
          const row = payload.new as { payload?: GameEvent };
          if (row?.payload) h.onEvents([row.payload]);
        },
      )
      .subscribe((status) => {
        const healthy = status === "SUBSCRIBED";
        h.onHealthy(healthy);
        if (healthy) h.onResync();
      });
    return { close: () => void client.removeChannel(channel) };
  }

  let es: EventSource | null = null;
  let closed = false;
  let retry: ReturnType<typeof setTimeout> | undefined;
  const connect = () => {
    if (closed) return;
    es = new EventSource(`/api/rooms/${code}/stream`);
    es.addEventListener("hello", () => {
      h.onHealthy(true);
      h.onResync();
    });
    es.addEventListener("events", (msg) => {
      try {
        h.onEvents(JSON.parse((msg as MessageEvent).data) as GameEvent[]);
      } catch {
        h.onResync();
      }
    });
    es.onerror = () => {
      h.onHealthy(false);
      es?.close();
      retry = setTimeout(connect, 2000);
    };
  };
  connect();
  return {
    close() {
      closed = true;
      clearTimeout(retry);
      es?.close();
    },
  };
}

/** Supabase Presence: instant online markers (UI only; gameplay uses server heartbeats). */
export function openPresence(config: RuntimeConfig, roomId: string, playerId: string | null, onChange: (online: Set<string>) => void): Feed {
  const client = config.realtime === "supabase" ? supabaseClient(config) : null;
  if (!client) return { close() {} };
  const channel = client.channel(`presence:${roomId}`, { config: { presence: { key: playerId ?? `viewer-${Math.random().toString(36).slice(2)}` } } });
  channel
    .on("presence", { event: "sync" }, () => onChange(new Set(Object.keys(channel.presenceState()))))
    .subscribe(async (status) => {
      if (status === "SUBSCRIBED" && playerId) await channel.track({ at: Date.now() });
    });
  return { close: () => void client.removeChannel(channel) };
}
