"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useState } from "react";
import { useI18n } from "@/lib/i18n/context";
import { GameButton, Sheet } from "../ui/primitives";
import { GUIDES, type GuideGame } from "./guides";

const TITLE_KEY = { shut10: "gameShut10", hangman: "gameHangman", guesswho: "gameGuessWho" } as const;
const seenKey = (game: GuideGame) => `s10_guide_seen_${game}`;

/** Paged beginner guide: one short page at a time, so it never scrolls. */
export function GuideSheet({ game, open, onClose }: { game: GuideGame; open: boolean; onClose: () => void }) {
  const { t, lang, dir, n } = useI18n();
  const pages = GUIDES[game][lang];
  const [index, setIndex] = useState(0);
  const page = pages[Math.min(index, pages.length - 1)];
  const last = index >= pages.length - 1;
  const close = () => {
    onClose();
    setIndex(0);
  };
  return (
    <Sheet open={open} onClose={close} title={`${t(TITLE_KEY[game])} · ${t("guide_title")}`}>
      <div className="flex min-h-0 flex-col pb-4" data-testid={`guide-${game}`} data-page={index}>
        <div className="mb-2 flex shrink-0 justify-center gap-1.5">
          {pages.map((p, i) => (
            <button
              key={p.title}
              type="button"
              aria-label={p.title}
              onClick={() => setIndex(i)}
              className={`h-1.5 rounded-full transition-all ${i === index ? "w-6 bg-[#ffcf4a]" : "w-1.5 bg-white/25"}`}
            />
          ))}
        </div>
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={index}
            initial={{ opacity: 0, x: dir === "rtl" ? -20 : 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: dir === "rtl" ? 20 : -20 }}
            transition={{ duration: 0.16 }}
            className="min-h-0"
          >
            <div className="mb-2 flex items-center gap-2">
              <span className="text-2xl leading-none">{page.icon}</span>
              <span className="text-lg font-extrabold text-[#ffcf4a]" data-testid="guide-page-title">
                {page.title}
              </span>
              <span className="ms-auto text-xs font-bold text-white/40 tabular-nums">
                {n(index + 1)}/{n(pages.length)}
              </span>
            </div>
            <ul className="grid gap-1.5">
              {page.items.map((it, i) => (
                <li key={i} className="rounded-xl bg-white/5 px-3 py-1.5 text-[13px] leading-snug text-white/85">
                  {it.term && <span className="font-extrabold text-white">{it.term}: </span>}
                  {it.text}
                </li>
              ))}
            </ul>
          </motion.div>
        </AnimatePresence>
        <div className="mt-3 grid shrink-0 gap-2" style={{ gridTemplateColumns: index > 0 ? "auto 1fr" : "1fr" }}>
          {index > 0 && (
            <GameButton size="md" variant="dark" onClick={() => setIndex(index - 1)} data-testid="guide-back">
              {dir === "rtl" ? "→" : "←"}
            </GameButton>
          )}
          {last ? (
            <GameButton size="md" variant="green" onClick={close} data-testid="guide-done">
              {t("guide_done")}
            </GameButton>
          ) : (
            <GameButton size="md" onClick={() => setIndex(index + 1)} data-testid="guide-next">
              {t("next")} {dir === "rtl" ? "←" : "→"}
            </GameButton>
          )}
        </div>
      </div>
    </Sheet>
  );
}

/** A "?" button that opens the guide; with `autoOpen`, beginners see it once on their first visit. */
export function GuideButton({ game, autoOpen = false, className = "" }: { game: GuideGame; autoOpen?: boolean; className?: string }) {
  const { t } = useI18n();
  const [open, setOpen] = useState(false);
  useEffect(() => {
    if (!autoOpen) return;
    try {
      if (!localStorage.getItem(seenKey(game))) {
        localStorage.setItem(seenKey(game), "1");
        const id = setTimeout(() => setOpen(true), 350);
        return () => clearTimeout(id);
      }
    } catch {
      // storage unavailable: don't auto-open
    }
  }, [autoOpen, game]);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`glass flex h-10 min-w-10 shrink-0 items-center justify-center rounded-xl px-2 text-sm font-extrabold ${className}`}
        aria-label={t("guide_title")}
        data-testid={`guide-open-${game}`}
      >
        ?
      </button>
      <GuideSheet game={game} open={open} onClose={() => setOpen(false)} />
    </>
  );
}
