"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState } from "react";
import { Gallows, type GallowsState } from "@/components/hangman/gallows";
import { Logo } from "@/components/logo";
import { GameLink } from "@/components/ui/primitives";
import { unlockAudio } from "@/lib/client/feedback";
import { useI18n } from "@/lib/i18n/context";

/** Looping chalk demo: parts get drawn, then the little man is saved. */
function GallowsDemo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % 9), 900);
    return () => clearInterval(id);
  }, []);
  const wrong = Math.min(step, 6);
  const state: GallowsState = step >= 7 ? "saved" : "playing";
  return <Gallows wrong={wrong} lives={6} state={state} roundKey={step === 0 ? "a" : "b"} />;
}

export function HomeScreen() {
  const { t, lang, setLang } = useI18n();
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden px-4 safe-top safe-bottom" onPointerDown={unlockAudio}>
      <div className="flex shrink-0 justify-between pt-1">
        <Link href="/profile" className="glass rounded-xl px-3 py-2 text-sm font-bold" aria-label={t("profile")}>
          👤
        </Link>
        <button type="button" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="glass rounded-xl px-3 py-2 text-sm font-extrabold" data-testid="home-lang">
          {lang === "en" ? "العربية" : "English"}
        </button>
      </div>

      <motion.header initial={{ opacity: 0, y: -10 }} animate={{ opacity: 1, y: 0 }} className="shrink-0 py-3 text-center [@media(max-height:640px)]:py-1.5">
        <h1 className="text-[clamp(1.9rem,6dvh,2.25rem)] font-extrabold tracking-[0.12em] text-[#ffcf4a] drop-shadow-[0_4px_0_#6b4500]" data-testid="hub-title">
          {t("hubTitle")}
        </h1>
        <p className="mt-1 text-sm font-bold text-white/60 [@media(max-height:640px)]:hidden">{t("hubTagline")}</p>
      </motion.header>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-3">
        {/* SHUT THE BOX */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }} className="wood rounded-[26px] p-2" data-testid="card-shut10">
          <div className="felt rounded-[20px] p-3.5 [@media(max-height:640px)]:p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="text-2xl font-extrabold tracking-wide">{t("gameShut10")}</h2>
                <p className="text-xs font-semibold text-white/75 [@media(max-height:640px)]:hidden">{t("gameShut10Desc")}</p>
              </div>
              <div className="shrink-0">
                <Logo size={0.36} />
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <GameLink href="/create" size="md" className="!px-2 text-sm leading-tight" testId="home-create">
                {t("playWithFriends")}
              </GameLink>
              <GameLink href="/practice" size="md" variant="dark" className="text-sm" testId="home-practice">
                {t("practice")}
              </GameLink>
            </div>
          </div>
        </motion.section>

        {/* HANGMAN */}
        <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.2 }} className="wood rounded-[26px] p-2" data-testid="card-hangman">
          <div className="chalkboard rounded-[20px] p-3.5 [@media(max-height:640px)]:p-3">
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <h2 className="chalk text-4xl leading-none">{t("gameHangman")}</h2>
                <p className="mt-1 text-xs font-semibold text-white/75 [@media(max-height:640px)]:hidden">{t("gameHangmanDesc")}</p>
              </div>
              <div className="h-[clamp(56px,13dvh,96px)] w-[clamp(56px,13dvh,96px)] shrink-0">
                <GallowsDemo />
              </div>
            </div>
            <div className="mt-2.5 grid grid-cols-2 gap-2">
              <GameLink href="/hangman/create" size="md" variant="green" className="!px-2 text-sm leading-tight" testId="home-hm-create">
                {t("playWithFriends")}
              </GameLink>
              <GameLink href="/hangman/practice" size="md" variant="dark" className="text-sm" testId="home-hm-practice">
                {t("practice")}
              </GameLink>
            </div>
          </div>
        </motion.section>
      </div>

      <div className="shrink-0 pt-3 pb-3 text-center">
        <div className="mb-2 text-xs font-bold text-white/50 [@media(max-height:640px)]:hidden">{t("haveCode")}</div>
        <GameLink href="/join" variant="blue" className="w-full" testId="home-join">
          {t("joinRoom")}
        </GameLink>
      </div>
    </main>
  );
}
