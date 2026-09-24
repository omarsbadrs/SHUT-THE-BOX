"use client";

import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from "react";
import { formatNumber, LANG_COOKIE, translate, type Lang, type MessageKey } from "./dictionaries";

interface I18n {
  lang: Lang;
  dir: "ltr" | "rtl";
  t: (key: MessageKey, params?: Record<string, string | number>) => string;
  n: (v: number | string) => string;
  setLang: (lang: Lang) => void;
}

const Ctx = createContext<I18n | null>(null);

export function I18nProvider({ initialLang, children }: { initialLang: Lang; children: ReactNode }) {
  const [lang, setLangState] = useState<Lang>(initialLang);
  const setLang = useCallback((next: Lang) => {
    setLangState(next);
    document.cookie = `${LANG_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`;
    document.documentElement.lang = next;
    document.documentElement.dir = next === "ar" ? "rtl" : "ltr";
  }, []);
  const value = useMemo<I18n>(
    () => ({
      lang,
      dir: lang === "ar" ? "rtl" : "ltr",
      t: (key, params) => translate(lang, key, params),
      n: (v) => formatNumber(lang, v),
      setLang,
    }),
    [lang, setLang],
  );
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useI18n(): I18n {
  const v = useContext(Ctx);
  if (!v) throw new Error("useI18n outside provider");
  return v;
}
