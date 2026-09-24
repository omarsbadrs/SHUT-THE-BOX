"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState, type ReactNode } from "react";
import { useI18n } from "@/lib/i18n/context";
import { GameButton } from "./primitives";

export interface WizardStep {
  key: string;
  title: string;
  content: ReactNode;
  /** False blocks moving forward (e.g. nickname missing). */
  valid?: boolean;
}

/**
 * Multi-step form that always fits one screen: each step is short, so nothing
 * ever scrolls. The finish action is available from every step once the
 * required steps are valid (defaults are good enough to start playing).
 */
export function Wizard({
  steps,
  finishLabel,
  onFinish,
  busy = false,
  testId = "wizard",
}: {
  steps: WizardStep[];
  finishLabel: string;
  onFinish: () => void;
  busy?: boolean;
  testId?: string;
}) {
  const { t, dir } = useI18n();
  const [index, setIndex] = useState(0);
  const step = steps[index];
  const last = index === steps.length - 1;
  const allValid = steps.every((s) => s.valid !== false);
  const forward = dir === "rtl" ? -1 : 1;

  return (
    <div className="flex min-h-0 flex-1 flex-col" data-testid={testId} data-step={step.key}>
      {/* progress */}
      <div className="mb-2 flex items-center gap-2">
        {steps.map((s, i) => (
          <button
            key={s.key}
            type="button"
            onClick={() => (i < index || steps.slice(0, i).every((x) => x.valid !== false) ? setIndex(i) : undefined)}
            className={`h-1.5 flex-1 rounded-full transition-colors ${i <= index ? "bg-[#ffcf4a]" : "bg-white/15"}`}
            aria-label={s.title}
            data-testid={`${testId}-dot-${s.key}`}
          />
        ))}
      </div>
      <div className="mb-2 text-xs font-extrabold tracking-[0.2em] text-white/60 uppercase">
        {index + 1}/{steps.length} · {step.title}
      </div>
      {/* small inset so selection rings / scaled buttons aren't clipped at the edges */}
      <div className="relative -mx-1.5 min-h-0 flex-1 overflow-hidden px-1.5 pt-1">
        <AnimatePresence mode="wait" initial={false}>
          <motion.div
            key={step.key}
            initial={{ opacity: 0, x: 24 * forward }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -24 * forward }}
            transition={{ duration: 0.18 }}
            className="h-full"
          >
            {step.content}
          </motion.div>
        </AnimatePresence>
      </div>
      <div className="mt-2 grid shrink-0 gap-2 pt-1" style={{ gridTemplateColumns: index > 0 ? "auto 1fr" : "1fr" }}>
        {index > 0 && (
          <GameButton size="md" variant="dark" onClick={() => setIndex(index - 1)} data-testid={`${testId}-back`}>
            {dir === "rtl" ? "→" : "←"}
          </GameButton>
        )}
        {last ? (
          <GameButton size="md" onClick={onFinish} disabled={busy || !allValid} data-testid={`${testId}-finish`}>
            {finishLabel}
          </GameButton>
        ) : (
          <div className="grid grid-cols-[1fr_auto] gap-2">
            <GameButton size="md" variant="green" onClick={() => setIndex(index + 1)} disabled={step.valid === false} data-testid={`${testId}-next`}>
              {t("next")} {dir === "rtl" ? "←" : "→"}
            </GameButton>
            <GameButton size="md" variant="dark" onClick={onFinish} disabled={busy || !allValid} className="!px-3 text-sm" data-testid={`${testId}-finish-now`}>
              ⚡ {finishLabel}
            </GameButton>
          </div>
        )}
      </div>
    </div>
  );
}
