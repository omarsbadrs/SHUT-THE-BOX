"use client";

import { useState, useSyncExternalStore } from "react";
import {
  CATEGORIES,
  isSolved,
  maskFor,
  normalizeLetter,
  positionsOf,
  secureRandomWord,
  solveKey,
  type HmCategoryChoice,
  type HmLanguage,
} from "./practice-logic";
import { Gallows, type GallowsState } from "@/components/hangman/gallows";
import { Keyboard, WordSlots } from "@/components/hangman/word-board";
import { GuideButton } from "@/components/guide/guide";
import { PageShell } from "@/components/page-shell";
import { GameButton, Segmented, Sheet, TextInput } from "@/components/ui/primitives";
import { haptic, sfx, unlockAudio } from "@/lib/client/feedback";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/dictionaries";

interface Stats {
  wins: number;
  losses: number;
  streak: number;
  best: number;
}
const KEY = "s10_hm_stats";
const EMPTY: Stats = { wins: 0, losses: 0, streak: 0, best: 0 };
let cache: Stats | null = null;
const listeners = new Set<() => void>();
const readStats = (): Stats => {
  if (cache) return cache;
  try {
    cache = { ...EMPTY, ...JSON.parse(localStorage.getItem(KEY) ?? "{}") };
  } catch {
    cache = { ...EMPTY };
  }
  return cache!;
};
function record(win: boolean) {
  const s = { ...readStats() };
  if (win) {
    s.wins += 1;
    s.streak += 1;
    s.best = Math.max(s.best, s.streak);
  } else {
    s.losses += 1;
    s.streak = 0;
  }
  cache = s;
  try {
    localStorage.setItem(KEY, JSON.stringify(s));
  } catch {
    // storage unavailable
  }
  listeners.forEach((l) => l());
}

export default function HangmanPracticePage() {
  const { t, n, lang: uiLang } = useI18n();
  const stats = useSyncExternalStore(
    (fn) => {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    readStats,
    () => EMPTY,
  );
  const [lang, setLang] = useState<HmLanguage>(uiLang);
  const [category, setCategory] = useState<HmCategoryChoice>("mixed");
  const [lives, setLives] = useState<6 | 9>(6);
  const [game, setGame] = useState<{ word: string; category: string; guessed: string[]; wrongSolves: string[] } | null>(null);
  const [solveOpen, setSolveOpen] = useState(false);
  const [solveText, setSolveText] = useState("");

  const start = () => {
    unlockAudio();
    const pick = secureRandomWord(lang, category);
    setGame({ word: pick.word, category: pick.category, guessed: [], wrongSolves: [] });
    sfx.chalk();
  };

  const guessedSet = new Set(game?.guessed ?? []);
  const mask = game ? maskFor(game.word, guessedSet, lang) : [];
  const wrongLetters = game ? game.guessed.filter((l) => positionsOf(game.word, l, lang).length === 0) : [];
  const wrongCount = wrongLetters.length + (game?.wrongSolves.length ?? 0);
  const solved = !!game && (isSolved(mask) || game.wrongSolves.includes("✓"));
  const hanged = !!game && !solved && wrongCount >= lives;
  const over = solved || hanged;
  const gState: GallowsState = solved ? "saved" : hanged ? "hanged" : "playing";

  const finish = (win: boolean) => {
    record(win);
    if (win) {
      sfx.saved();
      haptic.roundWin();
    } else {
      sfx.hanged();
      haptic.blocked();
    }
  };

  const guess = (letter: string) => {
    if (!game || over) return;
    const key = normalizeLetter(letter, lang);
    if (!key || guessedSet.has(key)) return;
    const next = { ...game, guessed: [...game.guessed, key] };
    const hit = positionsOf(game.word, key, lang).length > 0;
    setGame(next);
    if (hit) {
      sfx.letterRight(positionsOf(game.word, key, lang).length);
      haptic.select();
      if (isSolved(maskFor(game.word, new Set(next.guessed), lang))) finish(true);
    } else {
      sfx.letterWrong();
      setTimeout(() => sfx.chalk(), 150);
      haptic.blocked();
      if (wrongCount + 1 >= lives) finish(false);
    }
  };

  const solve = () => {
    if (!game || over || !solveText.trim()) return;
    const correct = solveKey(solveText, lang) === solveKey(game.word, lang);
    setSolveOpen(false);
    setSolveText("");
    if (correct) {
      setGame({ ...game, wrongSolves: [...game.wrongSolves, "✓"] });
      finish(true);
    } else {
      setGame({ ...game, wrongSolves: [...game.wrongSolves, solveText.trim()] });
      sfx.letterWrong();
      if (wrongCount + 1 >= lives) finish(false);
    }
  };

  const shownMask = over && game ? [...game.word] : mask;
  const misses = [...wrongLetters, ...(game?.wrongSolves.filter((w) => w !== "✓") ?? [])];

  return (
    <PageShell title={t("hm_practiceTitle")} right={<GuideButton game="hangman" />}>
      <div className="flex min-h-0 flex-1 flex-col">
        <div className="mb-2 grid shrink-0 grid-cols-4 gap-1.5 text-center" data-testid="hm-solo-stats">
          {[
            [t("hm_wins"), n(stats.wins)],
            [t("hm_losses"), n(stats.losses)],
            [t("streak"), n(stats.streak)],
            ["🏅", n(stats.best)],
          ].map(([k, v]) => (
            <div key={k} className="glass flex items-baseline justify-center gap-1.5 rounded-xl px-1 py-1">
              <div className="truncate text-[9px] font-bold tracking-wider text-white/50 uppercase">{k}</div>
              <div className="text-base font-extrabold">{v}</div>
            </div>
          ))}
        </div>

        {!game ? (
          <div className="grid gap-4">
            <Segmented value={lang} onChange={setLang} options={(["en", "ar"] as const).map((v) => ({ value: v, label: t(`lang_${v}`) }))} cols="grid-cols-2" />
            <Segmented value={category} onChange={setCategory} options={(["mixed", ...CATEGORIES] as HmCategoryChoice[]).map((c) => ({ value: c, label: t(`cat_${c}` as MessageKey) }))} cols="grid-cols-4" />
            <Segmented value={lives} onChange={setLives} options={[{ value: 6 as const, label: t("hm_lives6") }, { value: 9 as const, label: t("hm_lives9") }]} cols="grid-cols-2" />
            <GameButton onClick={start} data-testid="hm-solo-start">
              ✎ {t("newGame")}
            </GameButton>
          </div>
        ) : (
          <>
            <div className="wood min-h-[140px] flex-1 rounded-[22px] p-2">
              <div className="chalkboard flex h-full flex-col rounded-[16px] px-3 pt-2 pb-3">
                <div className="flex items-center justify-between">
                  <span className="chalk text-base opacity-80">{t(`cat_${game.category}` as MessageKey)}</span>
                  <span className="chalk text-base opacity-80">
                    {"❤".repeat(Math.max(0, lives - wrongCount))}
                    <span className="opacity-30">{"❤".repeat(Math.min(lives, wrongCount))}</span>
                  </span>
                </div>
                <div className="relative min-h-0 flex-1">
                  <Gallows wrong={wrongCount} lives={lives} state={gState} roundKey={game.word} />
                </div>
                <WordSlots mask={shownMask} lang={lang} />
                <div className="chalk mt-2 flex min-h-[1.4em] flex-wrap justify-center gap-x-2 text-lg" data-testid="hm-misses">
                  {misses.map((w, i) => (
                    <span key={`${w}-${i}`} className="text-[#ff9a92] line-through decoration-2">
                      {w}
                    </span>
                  ))}
                </div>
              </div>
            </div>
            <div className="my-1.5 shrink-0 text-center text-sm font-extrabold" data-testid="hm-solo-status">
              {solved ? t("hm_youSolved") : hanged ? t("hm_youHanged") : t("hm_livesLeft", { n: Math.max(0, lives - wrongCount) })}
            </div>
            <div className="grid shrink-0 gap-2 pb-2">
              {over ? (
                <GameButton onClick={start} data-testid="hm-solo-next">
                  ✎ {t("hm_newWord")}
                </GameButton>
              ) : (
                <>
                  <Keyboard lang={lang} correct={new Set(game.guessed.filter((l) => !wrongLetters.includes(l)))} wrong={new Set(wrongLetters)} disabled={over} onKey={guess} />
                  <div className="grid grid-cols-2 gap-2">
                    <GameButton size="md" variant="blue" onClick={() => setSolveOpen(true)} data-testid="hm-solve">
                      ✎ {t("hm_solve")}
                    </GameButton>
                    <GameButton size="md" variant="dark" onClick={() => setGame(null)}>
                      {t("settings")}
                    </GameButton>
                  </div>
                </>
              )}
            </div>
          </>
        )}
      </div>
      <Sheet open={solveOpen} onClose={() => setSolveOpen(false)} title={t("hm_solveTitle")}>
        <form
          className="grid gap-3 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            solve();
          }}
        >
          <TextInput autoFocus value={solveText} onChange={(e) => setSolveText(e.target.value)} placeholder={t("hm_solvePlaceholder")} dir={lang === "ar" ? "rtl" : "ltr"} className="chalk text-center text-2xl" />
          <GameButton type="submit" variant="green" disabled={!solveText.trim()}>
            {t("hm_submit")}
          </GameButton>
        </form>
      </Sheet>
    </PageShell>
  );
}
