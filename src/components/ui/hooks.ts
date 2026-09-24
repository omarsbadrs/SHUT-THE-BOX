"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { serverNow } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import type { ApiError } from "@/lib/client/api";

/** Server clock that re-renders every `intervalMs`. Countdowns never use the phone clock directly. */
export function useServerNow(intervalMs = 250): number {
  const [now, setNow] = useState(() => serverNow());
  useEffect(() => {
    const id = setInterval(() => setNow(serverNow()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

/** Transient toast message. */
const subscribeResize = (fn: () => void) => {
  window.addEventListener("resize", fn);
  return () => window.removeEventListener("resize", fn);
};

/** True on short phone screens (e.g. iPhone SE with Safari bars) where layouts must tighten further. */
export function useShortScreen(maxHeight = 620): boolean {
  return useSyncExternalStore(
    subscribeResize,
    () => window.innerHeight <= maxHeight,
    () => false,
  );
}

export function useToast(ms = 2600) {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const show = useCallback(
    (m: string) => {
      setMessage(m);
      clearTimeout(timer.current);
      timer.current = setTimeout(() => setMessage(null), ms);
    },
    [ms],
  );
  useEffect(() => () => clearTimeout(timer.current), []);
  return { message, show };
}

/** Friendly, translated error text for an API error code. */
export function useErrorText() {
  const { t } = useI18n();
  return useCallback(
    (err: ApiError) => {
      const key = `err_${err.code}` as MessageKey;
      try {
        const text = t(key, err.params);
        if (text) return text;
      } catch {
        // fall through
      }
      return t("err_generic");
    },
    [t],
  );
}
