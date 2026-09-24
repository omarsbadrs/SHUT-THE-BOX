"use client";

import { useSyncExternalStore } from "react";

/** Practice-mode personal stats (this device only). */
export interface SoloStats {
  games: number;
  total: number;
  best: number | null;
  perfect: number;
  streak: number;
  bestStreak: number;
}

const STATS_KEY = "s10_solo_stats";
const EMPTY: SoloStats = { games: 0, total: 0, best: null, perfect: 0, streak: 0, bestStreak: 0 };
let cache: SoloStats | null = null;
const listeners = new Set<() => void>();

function read(): SoloStats {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...JSON.parse(localStorage.getItem(STATS_KEY) ?? "{}") };
  } catch {
    cache = { ...EMPTY };
  }
  return cache!;
}

export function recordSoloGame(score: number) {
  const s = { ...read() };
  s.games += 1;
  s.total += score;
  s.best = s.best === null ? score : Math.min(s.best, score);
  if (score === 0) {
    s.perfect += 1;
    s.streak += 1;
    s.bestStreak = Math.max(s.bestStreak, s.streak);
  } else s.streak = 0;
  cache = s;
  try {
    localStorage.setItem(STATS_KEY, JSON.stringify(s));
  } catch {
    // storage unavailable
  }
  listeners.forEach((l) => l());
}

export function useSoloStats(): SoloStats {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    read,
    () => EMPTY,
  );
}
