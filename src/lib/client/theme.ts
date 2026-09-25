"use client";

import { useSyncExternalStore } from "react";
import { THEME_COOKIE, themeById, themeVars } from "@/lib/shared/themes";

const listeners = new Set<() => void>();

function current(): string {
  return document.documentElement.dataset.theme ?? "emerald";
}

/** Switches the app theme instantly and remembers it (cookie → first paint on the next visit). */
export function setTheme(id: string) {
  const t = themeById(id);
  const root = document.documentElement;
  for (const [k, v] of Object.entries(themeVars(t))) root.style.setProperty(k, v);
  root.dataset.theme = t.id;
  document.cookie = `${THEME_COOKIE}=${t.id}; path=/; max-age=31536000; samesite=lax`;
  document.querySelector('meta[name="theme-color"]')?.setAttribute("content", t.night);
  listeners.forEach((l) => l());
}

export function useTheme(): string {
  return useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    current,
    () => "emerald",
  );
}
