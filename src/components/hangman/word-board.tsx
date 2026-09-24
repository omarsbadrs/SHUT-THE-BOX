"use client";

import { motion } from "motion/react";
import { isSeparator, KEYBOARDS, type HmLanguage } from "@/games/hangman";

/**
 * Chalk letter slots. `secret` (word master only) shows still-hidden letters
 * as faint ghosts so the master can follow along.
 */
export function WordSlots({ mask, lang, secret, compact = false }: { mask: ReadonlyArray<string | null>; lang: HmLanguage; secret?: string | null; compact?: boolean }) {
  const chars = [...mask];
  const secretChars = secret ? [...secret] : null;
  // group into words so long phrases wrap between words, never inside one
  const words: Array<Array<{ ch: string | null; i: number }>> = [[]];
  chars.forEach((ch, i) => {
    if (ch === " ") words.push([]);
    else words[words.length - 1].push({ ch, i });
  });
  const longest = Math.max(1, ...words.map((w) => w.length));
  const size = compact ? "clamp(1rem, 5vw, 1.4rem)" : `clamp(1.2rem, ${Math.min(9, 62 / longest)}vw, 2.6rem)`;

  return (
    <div dir={lang === "ar" ? "rtl" : "ltr"} className="chalk flex flex-wrap justify-center gap-x-[0.9em] gap-y-2" style={{ fontSize: size }} data-testid="word-slots" data-mask={chars.map((c) => c ?? "_").join("")}>
      {words.map((word, wi) => (
        <div key={wi} className="flex gap-[0.18em]">
          {word.map(({ ch, i }) => {
            const hyphen = ch !== null && isSeparator(ch);
            const ghost = ch === null && secretChars ? secretChars[i] : null;
            return (
              <div key={i} className="flex w-[0.9em] flex-col items-center" data-testid={`slot-${i}`} data-revealed={ch !== null ? "yes" : "no"}>
                <div className="relative flex h-[1.25em] items-end justify-center leading-none">
                  {ch !== null ? (
                    <motion.span
                      key={ch}
                      initial={{ opacity: 0, scale: 0.3, rotate: -14, y: -6 }}
                      animate={{ opacity: 1, scale: 1, rotate: 0, y: 0 }}
                      transition={{ type: "spring", stiffness: 380, damping: 16 }}
                    >
                      {ch}
                    </motion.span>
                  ) : ghost ? (
                    <span className="opacity-25">{ghost}</span>
                  ) : null}
                </div>
                {!hyphen && <div className="mt-[0.08em] h-[0.09em] w-full rounded-full bg-[#f4f1e8]/80" style={{ filter: "blur(0.3px)" }} />}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}

export function Keyboard({
  lang,
  correct,
  wrong,
  disabled,
  onKey,
}: {
  lang: HmLanguage;
  correct: ReadonlySet<string>;
  wrong: ReadonlySet<string>;
  disabled: boolean;
  onKey: (letter: string) => void;
}) {
  return (
    <div className="grid gap-[clamp(3px,0.9dvh,6px)]" dir="ltr" data-testid="keyboard">
      {KEYBOARDS[lang].map((row, ri) => (
        <div key={ri} className="flex justify-center gap-1">
          {row.map((l) => {
            const isCorrect = correct.has(l);
            const isWrong = wrong.has(l);
            const used = isCorrect || isWrong;
            return (
              <motion.button
                key={l}
                type="button"
                data-testid={`key-${l}`}
                data-state={isCorrect ? "correct" : isWrong ? "wrong" : "open"}
                disabled={disabled || used}
                onClick={() => onKey(l)}
                whileTap={{ scale: 0.88 }}
                className={`chalk relative flex h-[clamp(34px,6.4dvh,44px)] max-w-[42px] min-w-0 flex-1 items-center justify-center rounded-lg border-2 text-xl leading-none transition-colors ${
                  isCorrect
                    ? "border-emerald-300/50 bg-emerald-400/15 text-emerald-200"
                    : isWrong
                      ? "border-white/10 bg-black/20 opacity-40"
                      : "border-white/25 bg-white/5 active:bg-white/15 disabled:opacity-60"
                }`}
              >
                <span className={isWrong ? "text-white/60" : ""}>{l}</span>
                {isWrong && <span className="absolute inset-0 flex items-center justify-center text-2xl text-[#ff8a82]">✕</span>}
              </motion.button>
            );
          })}
        </div>
      ))}
    </div>
  );
}
