"use client";

import { motion } from "motion/react";
import { useState } from "react";
import { setTheme, useTheme } from "@/lib/client/theme";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { THEMES } from "@/lib/shared/themes";
import { Sheet } from "./ui/primitives";

/** Colour theme swatches. `compact` is one row of dots (game menus). */
export function ThemePicker({ compact = false }: { compact?: boolean }) {
  const { t } = useI18n();
  const active = useTheme();
  if (compact)
    return (
      <div className="flex items-center justify-between gap-2 rounded-2xl bg-white/5 px-4 py-2.5" data-testid="theme-picker">
        <span className="font-semibold">🎨 {t("theme")}</span>
        <div className="flex gap-1.5">
          {THEMES.map((th) => (
            <button
              key={th.id}
              type="button"
              onClick={() => setTheme(th.id)}
              aria-label={t(`theme_${th.id}` as MessageKey)}
              aria-pressed={active === th.id}
              data-testid={`theme-${th.id}`}
              className={`h-6 w-6 rounded-full transition ${active === th.id ? "ring-2 ring-[#ffcf4a] ring-offset-2 ring-offset-transparent" : "opacity-80"}`}
              style={{ background: `radial-gradient(circle at 35% 30%, ${th.feltHi}, ${th.feltDark})` }}
            />
          ))}
        </div>
      </div>
    );
  return (
    <div className="grid grid-cols-4 gap-2" data-testid="theme-picker">
      {THEMES.map((th) => (
        <motion.button
          key={th.id}
          type="button"
          whileTap={{ scale: 0.94 }}
          onClick={() => setTheme(th.id)}
          aria-pressed={active === th.id}
          data-testid={`theme-${th.id}`}
          className={`relative flex flex-col items-center gap-1 rounded-2xl p-2 transition ${active === th.id ? "bg-white/12 ring-2 ring-[#ffcf4a]" : "bg-white/5"}`}
        >
          <span className="relative block h-11 w-full overflow-hidden rounded-xl" style={{ background: th.night }}>
            <span className="absolute inset-x-1.5 top-1.5 bottom-1.5 rounded-lg" style={{ background: `radial-gradient(120% 90% at 50% 20%, ${th.feltHi}, ${th.felt} 45%, ${th.feltDark})` }} />
            {active === th.id && <span className="absolute end-1 top-1 rounded-full bg-[#ffcf4a] px-1 text-[9px] font-extrabold text-[#2a1a00]">✓</span>}
          </span>
          <span className="text-[11px] leading-tight font-extrabold">{t(`theme_${th.id}` as MessageKey)}</span>
        </motion.button>
      ))}
    </div>
  );
}

/** 🎨 button that opens the theme picker in a sheet. */
export function ThemeButton() {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button type="button" onClick={() => setOpen(true)} className="glass rounded-xl px-3 py-2 text-sm font-bold" aria-label={t("theme")} data-testid="theme-button">
        🎨
      </button>
      <Sheet open={open} onClose={() => setOpen(false)} title={t("theme")}>
        <div className="pb-6">
          <ThemePicker />
        </div>
      </Sheet>
    </>
  );
}
