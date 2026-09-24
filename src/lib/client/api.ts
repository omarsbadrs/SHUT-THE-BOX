"use client";

import type { Command, GameEvent, RoomState } from "@/game-engine";

/**
 * Thin API client. Tracks the server clock offset (timers use server time,
 * never the phone's clock) and keeps a backup of the signed session token
 * for browsers that drop cookies.
 */

const TOKEN_KEY = "s10_token";
const SESSION_HEADER = "x-shut10-session";

let offset = 0;
let bestRtt = Infinity;

export function serverNow(): number {
  return Date.now() + offset;
}

function updateClock(serverTime: unknown, t0: number, t1: number) {
  if (typeof serverTime !== "number") return;
  const rtt = t1 - t0;
  // Prefer low-latency samples; slowly accept worse ones so drift is corrected.
  if (rtt <= bestRtt * 1.5 || rtt < 150) {
    bestRtt = Math.min(bestRtt, rtt);
    offset = serverTime - (t0 + t1) / 2;
  }
}

function storedToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function storeToken(token: unknown) {
  if (typeof token !== "string") return;
  try {
    localStorage.setItem(TOKEN_KEY, token);
  } catch {
    // storage unavailable (private mode): cookie still works
  }
}

export interface ApiError {
  code: string;
  params: Record<string, string | number>;
}

export type ApiResult<T> = ({ ok: true } & T) | { ok: false; error: ApiError };

export async function apiFetch<T = Record<string, unknown>>(path: string, init: RequestInit = {}): Promise<ApiResult<T>> {
  const headers = new Headers(init.headers);
  const token = storedToken();
  if (token) headers.set(SESSION_HEADER, token);
  if (init.body) headers.set("Content-Type", "application/json");
  const t0 = Date.now();
  let res: Response;
  try {
    res = await fetch(path, { ...init, headers, cache: "no-store", credentials: "same-origin" });
  } catch {
    return { ok: false, error: { code: "CONNECTION", params: {} } };
  }
  const t1 = Date.now();
  let body: Record<string, unknown>;
  try {
    body = await res.json();
  } catch {
    return { ok: false, error: { code: "CONNECTION", params: {} } };
  }
  updateClock(body.serverNow, t0, t1);
  storeToken(body.token);
  if (body.ok === false || !res.ok) {
    const error = (body.error as ApiError) ?? { code: "generic", params: {} };
    return { ok: false, error };
  }
  return body as { ok: true } & T;
}

export function newCommandId(): string {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random().toString(36).slice(2)}-${Math.random().toString(36).slice(2)}`;
}

export interface CommandResponse {
  events: GameEvent[];
  version: number;
  me: string | null;
  data: Record<string, unknown>;
}

/** Sends an intent. Retries once on network failure with the same idempotency key. */
export async function sendCommand(code: string, command: Command | { type: string; [k: string]: unknown }): Promise<ApiResult<CommandResponse> & Partial<CommandResponse>> {
  const commandId = command.type === "TICK" ? undefined : newCommandId();
  const body = JSON.stringify({ command, commandId });
  let res = await apiFetch<CommandResponse>(`/api/rooms/${code}/command`, { method: "POST", body });
  if (!res.ok && res.error.code === "CONNECTION" && commandId) {
    await new Promise((r) => setTimeout(r, 600));
    res = await apiFetch<CommandResponse>(`/api/rooms/${code}/command`, { method: "POST", body });
  }
  return res;
}

export interface StateResponse {
  state: RoomState;
  me: string | null;
  spectator: boolean;
}

export interface RuntimeConfig {
  store: "supabase" | "memory" | "unconfigured";
  realtime: "supabase" | "sse";
  supabaseUrl: string | null;
  supabasePublishableKey: string | null;
  devTools: boolean;
}

let configPromise: Promise<RuntimeConfig> | null = null;

export function getConfig(): Promise<RuntimeConfig> {
  configPromise ??= apiFetch<RuntimeConfig>("/api/config").then((r) => {
    if (!r.ok) {
      configPromise = null;
      return { store: "memory", realtime: "sse", supabaseUrl: null, supabasePublishableKey: null, devTools: false };
    }
    return r;
  });
  return configPromise;
}
