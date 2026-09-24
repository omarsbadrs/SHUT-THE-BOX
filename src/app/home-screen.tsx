"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { Logo } from "@/components/logo";
import { GameLink } from "@/components/ui/primitives";
import { unlockAudio } from "@/lib/client/feedback";
import { useI18n } from "@/lib/i18n/context";

export function HomeScreen() {
  const { t, lang, setLang } = useI18n();
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-[460px] flex-col px-6 safe-top safe-bottom" onPointerDown={unlockAudio}>
      <div className="flex justify-between pt-1">
        <Link href="/profile" className="glass rounded-xl px-3 py-2 text-sm font-bold" aria-label={t("profile")}>
          👤
        </Link>
        <button type="button" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="glass rounded-xl px-3 py-2 text-sm font-extrabold" data-testid="home-lang">
          {lang === "en" ? "العربية" : "English"}
        </button>
      </div>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10">
        <Logo size={1.2} />
        <div className="flex gap-3 text-xl font-extrabold tracking-[0.2em] text-white/80">
          {[t("tagline1"), t("tagline2"), t("tagline3")].map((w, i) => (
            <motion.span key={w} initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.8 + i * 0.25 }} className={i === 2 ? "text-[#ffcf4a]" : ""}>
              {w}
            </motion.span>
          ))}
        </div>
      </div>

      <motion.nav initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.4 }} className="grid gap-4 pb-6">
        <GameLink href="/create" testId="home-create" className="w-full">
          {t("playWithFriends")}
        </GameLink>
        <GameLink href="/join" testId="home-join" variant="blue" className="w-full">
          {t("joinRoom")}
        </GameLink>
        <GameLink href="/practice" testId="home-practice" variant="dark" className="w-full">
          {t("practice")}
        </GameLink>
      </motion.nav>
    </main>
  );
}
