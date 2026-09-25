"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { cardImage } from "@/games/guesswho";
import { GuideButton } from "@/components/guide/guide";
import type { GuideGame } from "@/components/guide/guides";
import { Gallows, type GallowsState } from "@/components/hangman/gallows";
import { Logo } from "@/components/logo";
import { MadeBy } from "@/components/made-by";
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

const FAN = ["pharaohs/tutankhamun", "stars/soad_hosny", "food/koshary", "music_sport/mohamed_salah", "stars/adel_emam", "pharaohs/nefertiti"];

/** A little fan of Guess Who cards that keeps reshuffling. */
function CardFan() {
  const [i, setI] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setI((x) => (x + 1) % FAN.length), 1800);
    return () => clearInterval(id);
  }, []);
  const cards = [FAN[i], FAN[(i + 1) % FAN.length], FAN[(i + 2) % FAN.length]];
  return (
    <div className="relative h-full w-full">
      {cards.map((id, k) => (
        <motion.div
          key={id}
          layout
          initial={{ opacity: 0, y: -12 }}
          animate={{ opacity: 1, y: 0, rotate: (k - 1) * 14, x: `${(k - 1) * 26}%` }}
          transition={{ type: "spring", stiffness: 180, damping: 18 }}
          className="gold-frame absolute inset-y-[4%] left-[26%] w-[48%] rounded-md p-[2px]"
          style={{ zIndex: k === 1 ? 2 : 1 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardImage(id)} alt="" className="h-full w-full rounded-[5px] object-cover" />
        </motion.div>
      ))}
    </div>
  );
}

function GameCard({
  guide,
  testId,
  frame,
  surface,
  title,
  desc,
  art,
  primary,
  secondary,
  delay,
}: {
  testId: string;
  frame: string;
  surface: string;
  title: ReactNode;
  desc: string;
  art: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
  delay: number;
  guide: GuideGame;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay }} className={`${frame} shrink-0 rounded-[24px] p-[7px]`} data-testid={testId}>
      <div className={`${surface} flex items-center gap-3 rounded-[18px] p-[clamp(8px,1.6dvh,14px)]`}>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <div className="min-w-0">{title}</div>
            <GuideButton game={guide} className="!h-7 !min-w-7 !rounded-full !px-0 text-xs" />
          </div>
          <p className="mt-0.5 text-xs leading-snug font-semibold text-white/75 [@media(max-height:760px)]:hidden">{desc}</p>
          <div className="mt-[clamp(6px,1.2dvh,10px)] grid grid-cols-2 gap-2">
            {primary}
            {secondary}
          </div>
        </div>
        <div className="h-[clamp(60px,12dvh,100px)] w-[clamp(60px,12dvh,100px)] shrink-0">{art}</div>
      </div>
    </motion.section>
  );
}

const BTN = "!h-[clamp(38px,6.4dvh,48px)] !px-2 text-[13px] leading-tight";

export function HomeScreen() {
  const { t, lang, setLang } = useI18n();
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[480px] flex-col overflow-hidden px-4 safe-top safe-bottom" onPointerDown={unlockAudio}>
      <div className="flex shrink-0 items-center justify-between pt-1">
        <Link href="/profile" className="glass rounded-xl px-3 py-2 text-sm font-bold" aria-label={t("profile")}>
          👤
        </Link>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-[clamp(1.5rem,4.6dvh,2.1rem)] font-extrabold tracking-[0.12em] text-[#ffcf4a] drop-shadow-[0_3px_0_#6b4500]"
          data-testid="hub-title"
        >
          {t("hubTitle")}
        </motion.h1>
        <button type="button" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="glass rounded-xl px-3 py-2 text-sm font-extrabold" data-testid="home-lang">
          {lang === "en" ? "ع" : "EN"}
        </button>
      </div>
      <p className="shrink-0 text-center text-sm font-bold text-white/60 [@media(max-height:700px)]:hidden">{t("hubTagline")}</p>

      <div className="flex min-h-0 flex-1 flex-col justify-center gap-[clamp(8px,1.6dvh,14px)] py-2">
        <GameCard
          testId="card-shut10"
          guide="shut10"
          frame="wood"
          surface="felt"
          delay={0.1}
          title={<h2 className="text-[clamp(1.2rem,3.6dvh,1.5rem)] leading-tight font-extrabold tracking-wide">{t("gameShut10")}</h2>}
          desc={t("gameShut10Desc")}
          art={
            <div className="flex h-full w-full items-center justify-center">
              <Logo size={0.22} />
            </div>
          }
          primary={
            <GameLink href="/create" size="md" className={BTN} testId="home-create">
              {t("playWithFriends")}
            </GameLink>
          }
          secondary={
            <GameLink href="/practice" size="md" variant="dark" className={BTN} testId="home-practice">
              {t("practice")}
            </GameLink>
          }
        />
        <GameCard
          testId="card-hangman"
          guide="hangman"
          frame="wood"
          surface="chalkboard"
          delay={0.2}
          title={<h2 className="chalk text-[clamp(1.6rem,4.8dvh,2.2rem)] leading-none">{t("gameHangman")}</h2>}
          desc={t("gameHangmanDesc")}
          art={<GallowsDemo />}
          primary={
            <GameLink href="/hangman/create" size="md" variant="green" className={BTN} testId="home-hm-create">
              {t("playWithFriends")}
            </GameLink>
          }
          secondary={
            <GameLink href="/hangman/practice" size="md" variant="dark" className={BTN} testId="home-hm-practice">
              {t("practice")}
            </GameLink>
          }
        />
        <GameCard
          testId="card-guesswho"
          guide="guesswho"
          frame="gold-frame"
          surface="lapis"
          delay={0.3}
          title={<h2 className="kufi gold-text text-[clamp(1.35rem,4dvh,1.8rem)] leading-tight font-bold">{t("gameGuessWho")}</h2>}
          desc={t("gameGuessWhoDesc")}
          art={<CardFan />}
          primary={
            <GameLink href="/guesswho/create" size="md" className={BTN} testId="home-gw-create">
              {t("playWithFriends")}
            </GameLink>
          }
          secondary={
            <GameLink href="/guesswho/practice" size="md" variant="dark" className={BTN} testId="home-gw-practice">
              {t("playVsBot")}
            </GameLink>
          }
        />
      </div>

      <div className="shrink-0 pb-2 text-center">
        <GameLink href="/join" variant="blue" className="!h-[clamp(44px,7.5dvh,56px)] w-full" testId="home-join">
          {t("joinRoom")}
        </GameLink>
        <div className="mt-1.5">
          <MadeBy compact />
        </div>
        <Link href="/credits" className="mt-0.5 block text-[10px] font-bold text-white/35 underline [@media(max-height:600px)]:hidden" data-testid="home-credits">
          {t("credits")}
        </Link>
      </div>
    </main>
  );
}
