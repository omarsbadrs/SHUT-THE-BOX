"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";

export interface ResultsTab {
  key: string;
  label: string;
  content: ReactNode;
}

/**
 * Full-screen match results that never scroll: a compact hero, tabs for the
 * details (standings / stats / …), and the actions pinned to the bottom.
 */
export function ResultsFrame({ hero, tabs, actions, testId }: { hero: ReactNode; tabs: ResultsTab[]; actions: ReactNode; testId: string }) {
  const [active, setActive] = useState(tabs[0]?.key);
  const tab = tabs.find((x) => x.key === active) ?? tabs[0];
  return (
    <div className="mx-auto flex h-dvh w-full max-w-[560px] flex-col overflow-hidden px-4 safe-top safe-bottom" data-testid={testId}>
      <div className="flex shrink-0 flex-col items-center pt-3 pb-2 text-center [@media(max-height:640px)]:pt-1.5 [@media(max-height:640px)]:pb-1">{hero}</div>
      {tabs.length > 1 && (
        <div className="grid shrink-0 gap-1 rounded-2xl bg-black/25 p-1" style={{ gridTemplateColumns: `repeat(${tabs.length}, minmax(0, 1fr))` }} role="tablist">
          {tabs.map((x) => (
            <button
              key={x.key}
              type="button"
              role="tab"
              aria-selected={x.key === tab.key}
              onClick={() => setActive(x.key)}
              data-testid={`tab-${x.key}`}
              className={`rounded-xl py-1.5 text-[13px] font-extrabold tracking-wide transition ${x.key === tab.key ? "bg-[#ffcf4a] text-[#2a1a00]" : "text-white/70"}`}
            >
              {x.label}
            </button>
          ))}
        </div>
      )}
      <div className="relative mt-2 min-h-0 flex-1 overflow-hidden">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div key={tab.key} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} transition={{ duration: 0.15 }} className="h-full">
            {tab.content}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="grid shrink-0 gap-2 pt-2 pb-2 [@media(max-height:640px)]:gap-1.5 [@media(max-height:640px)]:pt-1.5">{actions}</div>
    </div>
  );
}

/** A compact per-player stats grid that fits 4 players at 360px (no horizontal scroll). */
export function StatsGrid({ columns, rows }: { columns: Array<{ id: string; head: ReactNode }>; rows: Array<{ label: string; values: Record<string, string> }> }) {
  return (
    <div className="rounded-2xl bg-black/25 px-2 py-1">
      <div className="grid items-center gap-x-1" style={{ gridTemplateColumns: `minmax(0, 1.5fr) repeat(${columns.length}, minmax(0, 1fr))` }}>
        <div />
        {columns.map((c) => (
          <div key={c.id} className="flex justify-center py-1">
            {c.head}
          </div>
        ))}
        {rows.map((r) => (
          <div key={r.label} className="contents">
            <div className="truncate border-t border-white/5 py-1 text-[12px] text-white/70">{r.label}</div>
            {columns.map((c) => (
              <div key={c.id} className="border-t border-white/5 py-1 text-center text-[13px] font-extrabold tabular-nums">
                {r.values[c.id] ?? "—"}
              </div>
            ))}
          </div>
        ))}
      </div>
    </div>
  );
}

/** Winner hero shared by every game's results; `art` is the game's trophy / picture. */
export function WinnerHero({ art, label, name, color, note }: { art: ReactNode; label: string; name: string; color: string; note?: ReactNode }) {
  // Stacked on normal phones; side by side on short ones so the details keep their room.
  return (
    <div className="flex w-full min-w-0 flex-col items-center [@media(max-height:640px)]:flex-row [@media(max-height:640px)]:gap-3">
      <div className="shrink-0">{art}</div>
      <div className="flex min-w-0 flex-col items-center [@media(max-height:640px)]:items-start">
        <div className="mt-1 text-xs font-extrabold tracking-[0.35em] text-white/60">{label}</div>
        <motion.div
          initial={{ y: 16, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
          className="max-w-full truncate text-[clamp(1.5rem,min(9vw,6.5dvh),3rem)] leading-tight font-extrabold"
          style={{ color }}
          data-testid="match-winner"
        >
          {name}
        </motion.div>
        {note && <div className="max-w-full truncate text-xs font-bold text-white/50">{note}</div>}
      </div>
    </div>
  );
}
