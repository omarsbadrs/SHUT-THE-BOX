import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import type { GameEvent, ServerRoomState } from "@/game-engine";
import { env } from "../env";
import type { AdminOverview, AnalyticsRow, MatchSummary, RoomStore } from "./types";

/**
 * Supabase-backed store. Every operation is a SECURITY DEFINER RPC executed
 * with the secret key (see supabase/migrations). The version check and event
 * append in shut10_commit run inside one Postgres transaction.
 */
export class SupabaseStore implements RoomStore {
  readonly kind = "supabase" as const;
  private client: SupabaseClient;

  constructor() {
    this.client = createClient(env.supabaseUrl, env.supabaseSecretKey, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  private async rpc<T>(fn: string, args: Record<string, unknown>): Promise<T> {
    const { data, error } = await this.client.rpc(fn, args);
    if (error) throw new Error(`${fn}: ${error.message}`);
    return data as T;
  }

  async createRoom(state: ServerRoomState, events: GameEvent[]) {
    const ok = await this.rpc<boolean>("shut10_create_room", {
      p_room_id: state.roomId,
      p_code: state.code,
      p_state: state,
      p_events: events,
    });
    return ok ? ("ok" as const) : ("code_taken" as const);
  }

  async loadRoomByCode(code: string) {
    return (await this.rpc<ServerRoomState | null>("shut10_load_room", { p_code: code })) ?? null;
  }

  async commit(roomId: string, expectedVersion: number, state: ServerRoomState, events: GameEvent[]) {
    return this.rpc<boolean>("shut10_commit", {
      p_room_id: roomId,
      p_expected_version: expectedVersion,
      p_state: state,
      p_events: events,
    });
  }

  async eventsSince(roomId: string, seq: number, limit: number) {
    return (await this.rpc<GameEvent[]>("shut10_events_since", { p_room_id: roomId, p_seq: seq, p_limit: limit })) ?? [];
  }

  async touchPresence(roomId: string, entries: Record<string, number>) {
    if (Object.keys(entries).length === 0) return;
    await this.rpc("shut10_touch", { p_room_id: roomId, p_entries: entries });
  }

  async getPresence(roomId: string) {
    const raw = (await this.rpc<Record<string, number | string>>("shut10_presence", { p_room_id: roomId })) ?? {};
    return Object.fromEntries(Object.entries(raw).map(([k, v]) => [k, Number(v)]));
  }

  async archiveMatch(summary: MatchSummary) {
    await this.rpc("shut10_archive_match", { p_summary: summary });
  }

  async findMatch(matchId: string) {
    if (!/^[0-9a-f-]{36}$/i.test(matchId)) return null;
    return (await this.rpc<{ code: string; summary: MatchSummary | null } | null>("shut10_find_match", { p_match_id: matchId })) ?? null;
  }

  async recordAnalytics(rows: AnalyticsRow[]) {
    if (rows.length) await this.rpc("shut10_record_analytics", { p_rows: rows });
  }

  async recordError(source: string, message: string, context: Record<string, unknown>) {
    await this.rpc("shut10_record_error", { p_source: source, p_message: message, p_context: context });
  }

  async linkProfile(userId: string, guestId: string, nickname: string | null, avatar: string | null) {
    return this.rpc<string>("shut10_link_profile", { p_user_id: userId, p_guest_id: guestId, p_nickname: nickname, p_avatar: avatar });
  }

  async adminOverview() {
    return this.rpc<AdminOverview>("shut10_admin_overview", {});
  }

  /** Verifies a Supabase Auth access token (optional account sign-in). */
  async verifyAccessToken(token: string): Promise<{ id: string; email: string | null } | null> {
    const { data, error } = await this.client.auth.getUser(token);
    if (error || !data.user) return null;
    return { id: data.user.id, email: data.user.email ?? null };
  }
}
