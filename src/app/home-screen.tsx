"use client";

import { motion } from "motion/react";
import Link from "next/link";
import { useEffect, useState, type ReactNode } from "react";
import { cardImage } from "@/games/guesswho";
import { Disc } from "@/components/connect4/disc";
import { GuideButton } from "@/components/guide/guide";
import type { GuideGame } from "@/components/guide/guides";
import { Gallows, type GallowsState } from "@/components/hangman/gallows";
import { Logo } from "@/components/logo";
import { MadeBy } from "@/components/made-by";
import { ThemeButton } from "@/components/theme-picker";
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

const FAN = ["pharaohs/tutankhamun", "stars/soad_hosny", "food/koshary", "footballers/mohamed_salah", "stars/adel_emam", "pharaohs/nefertiti"];

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
          className="gold-frame absolute inset-y-[4%] left-[30%] w-[40%] rounded-md p-[2px]"
          style={{ zIndex: k === 1 ? 2 : 1 }}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardImage(id)} alt="" className="h-full w-full rounded-[5px] object-cover" />
        </motion.div>
      ))}
    </div>
  );
}

/** Mini Connect 4: discs keep dropping into a 5×4 board, then the slider lets them all fall out. */
const DEMO_MOVES = [2, 1, 3, 3, 1, 2, 4, 0, 2, 2, 3, 4, 1, 0];
function Connect4Demo() {
  const [step, setStep] = useState(0);
  useEffect(() => {
    const id = setInterval(() => setStep((s) => (s + 1) % (DEMO_MOVES.length + 3)), 520);
    return () => clearInterval(id);
  }, []);
  const heights = [0, 0, 0, 0, 0];
  const discs = DEMO_MOVES.slice(0, Math.min(step, DEMO_MOVES.length)).map((c, i) => ({ c, r: heights[c]++, i }));
  return (
    <div className="relative h-full w-full">
      <div className="absolute inset-x-[4%] top-[8%] bottom-[4%] overflow-hidden">
        {discs.map((d) => (
          <motion.div
            key={d.i}
            className="absolute"
            style={{ left: `${d.c * 20}%`, bottom: `${d.r * 25}%`, width: "20%", height: "25%" }}
            initial={{ y: `-${(4 - d.r) * 100}%` }}
            animate={{ y: ["-" + (4 - d.r) * 100 + "%", "0%", "-12%", "0%"] }}
            transition={{ duration: 0.4, times: [0, 0.6, 0.8, 1], ease: ["easeIn", "easeOut", "easeIn"] }}
          >
            <div className="absolute inset-[6%]">
              <Disc color={d.i % 2 ? "yellow" : "red"} className="h-full w-full" />
            </div>
          </motion.div>
        ))}
      </div>
      <svg viewBox="0 0 100 84" className="pointer-events-none absolute inset-x-[4%] top-[8%] bottom-[4%] h-[88%] w-[92%]" preserveAspectRatio="none" aria-hidden>
        <defs>
          <mask id="c4demo-m">
            <rect width="100" height="84" fill="#fff" />
            {Array.from({ length: 20 }, (_, i) => (
              <ellipse key={i} cx={(i % 5) * 20 + 10} cy={Math.floor(i / 5) * 21 + 10.5} rx="7.6" ry="8" fill="#000" />
            ))}
          </mask>
        </defs>
        <rect width="100" height="84" rx="8" fill="#2458d6" mask="url(#c4demo-m)" />
      </svg>
    </div>
  );
}

function GameTile({
  guide,
  testId,
  frame,
  surface,
  title,
  art,
  primary,
  secondary,
  delay,
}: {
  guide: GuideGame;
  testId: string;
  frame: string;
  surface: string;
  title: ReactNode;
  art: ReactNode;
  primary: ReactNode;
  secondary: ReactNode;
  delay: number;
}) {
  return (
    <motion.section initial={{ opacity: 0, y: 20, scale: 0.96 }} animate={{ opacity: 1, y: 0, scale: 1 }} transition={{ delay }} className={`${frame} flex min-h-0 rounded-[22px] p-[6px]`} data-testid={testId}>
      <div className={`${surface} relative flex min-h-0 w-full flex-col rounded-[17px] p-[clamp(6px,1.3dvh,10px)]`}>
        <div className="absolute end-1.5 top-1.5 z-10">
          <GuideButton game={guide} className="!h-6 !min-w-6 !rounded-full !px-0 text-[11px]" />
        </div>
        <div className="flex min-h-[40px] flex-1 items-center justify-center">
          <div className="h-full max-h-[96px] w-full max-w-[120px]">{art}</div>
        </div>
        <div className="mb-[clamp(4px,0.9dvh,8px)] truncate text-center">{title}</div>
        <div className="grid gap-1.5">
          {primary}
          {secondary}
        </div>
      </div>
    </motion.section>
  );
}

const BTN = "!h-[clamp(30px,5.4dvh,42px)] w-full !px-1 text-[clamp(10px,3vw,13px)] leading-tight";

export function HomeScreen() {
  const { t, lang, setLang } = useI18n();
  return (
    <main className="mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden px-3 safe-top safe-bottom" onPointerDown={unlockAudio}>
      {/* three columns so the title is centred on the screen, whatever sits beside it */}
      <div className="grid shrink-0 grid-cols-[minmax(0,1fr)_auto_minmax(0,1fr)] items-center gap-2 pt-1">
        <div className="flex gap-1 justify-self-start">
          <Link href="/profile" className="glass flex h-10 w-10 items-center justify-center rounded-xl text-sm font-bold" aria-label={t("profile")}>
            👤
          </Link>
          <ThemeButton />
        </div>
        <motion.h1
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center text-[clamp(1.05rem,min(4.4dvh,5vw),1.9rem)] font-extrabold tracking-[0.12em] whitespace-nowrap text-[#ffcf4a] drop-shadow-[0_3px_0_#6b4500]"
          data-testid="hub-title"
        >
          {t("hubTitle")}
        </motion.h1>
        <button type="button" onClick={() => setLang(lang === "en" ? "ar" : "en")} className="glass flex h-10 w-10 items-center justify-center justify-self-end rounded-xl text-sm font-extrabold" data-testid="home-lang">
          {lang === "en" ? "ع" : "EN"}
        </button>
      </div>
      <p className="shrink-0 text-center text-sm font-bold text-white/60 [@media(max-height:760px)]:hidden">{t("hubTagline")}</p>

      <div className="grid min-h-0 flex-1 grid-cols-2 gap-[clamp(6px,1.4dvh,12px)] py-2" style={{ gridTemplateRows: "minmax(0,1fr) minmax(0,1fr)" }}>
        <GameTile
          guide="shut10"
          testId="card-shut10"
          frame="wood"
          surface="felt"
          delay={0.05}
          title={<h2 className="text-[clamp(0.9rem,2.8dvh,1.2rem)] font-extrabold tracking-wide">{t("gameShut10")}</h2>}
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
        <GameTile
          guide="hangman"
          testId="card-hangman"
          frame="wood"
          surface="chalkboard"
          delay={0.12}
          title={<h2 className="chalk text-[clamp(1.2rem,3.6dvh,1.7rem)] leading-none">{t("gameHangman")}</h2>}
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
        <GameTile
          guide="guesswho"
          testId="card-guesswho"
          frame="gold-frame"
          surface="lapis"
          delay={0.19}
          title={<h2 className="kufi gold-text text-[clamp(1rem,3dvh,1.4rem)] leading-tight font-bold">{t("gameGuessWho")}</h2>}
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
        <GameTile
          guide="connect4"
          testId="card-connect4"
          frame="bg-gradient-to-b from-[#4a86f5] to-[#173c9e] shadow-[0_18px_40px_-12px_rgba(0,0,0,.75)]"
          surface="bg-[radial-gradient(120%_90%_at_50%_20%,#1f4fc9,#10286b)]"
          delay={0.26}
          title={<h2 className="text-[clamp(0.95rem,2.9dvh,1.25rem)] font-extrabold tracking-wide text-[#ffe57a] drop-shadow-[0_2px_0_rgba(0,0,0,.35)]">{t("gameConnect4")}</h2>}
          art={<Connect4Demo />}
          primary={
            <GameLink href="/connect4/create" size="md" variant="red" className={BTN} testId="home-c4-create">
              {t("playWithFriends")}
            </GameLink>
          }
          secondary={
            <GameLink href="/connect4/practice" size="md" variant="dark" className={BTN} testId="home-c4-practice">
              {t("playVsBot")}
            </GameLink>
          }
        />
      </div>

      <div className="shrink-0 pb-2 text-center">
        <GameLink href="/join" variant="blue" className="!h-[clamp(42px,7dvh,54px)] w-full" testId="home-join">
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
