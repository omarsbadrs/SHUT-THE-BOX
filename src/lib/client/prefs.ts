"use client";

import { useSyncExternalStore } from "react";
import type { PlayerColor } from "@/game-engine";

/** Per-device conveniences (remembered name, avatar, toggles). Never game state. */
export interface Prefs {
  nickname: string;
  avatar: string;
  color: PlayerColor | null;
  sound: boolean;
  haptics: boolean;
  /** In-game layout: the four-sided table (default) or stacked player strips. */
  view: "table" | "players";
  trainer: boolean;
}

const KEY = "s10_prefs";
const DEFAULTS: Prefs = { nickname: "", avatar: "🦊", color: null, sound: true, haptics: true, view: "table", trainer: true };

let cache: Prefs | null = null;
const listeners = new Set<() => void>();

function read(): Prefs {
  if (cache) return cache;
  try {
    const raw = localStorage.getItem(KEY);
    cache = { ...DEFAULTS, ...(raw ? (JSON.parse(raw) as Partial<Prefs>) : {}) };
  } catch {
    cache = { ...DEFAULTS };
  }
  return cache;
}

export function getPrefs(): Prefs {
  if (typeof window === "undefined") return DEFAULTS;
  return read();
}

export function setPrefs(patch: Partial<Prefs>) {
  cache = { ...read(), ...patch };
  try {
    localStorage.setItem(KEY, JSON.stringify(cache));
  } catch {
    // ignore
  }
  listeners.forEach((l) => l());
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function usePrefs(): Prefs {
  return useSyncExternalStore(subscribe, getPrefs, () => DEFAULTS);
}
