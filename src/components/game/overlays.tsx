"use client";

import { AnimatePresence, motion } from "motion/react";
import { useEffect, useMemo, useRef } from "react";
import type { PlayerColor, RoomPlayer } from "@/game-engine";
import { TIMING } from "@/game-engine";
import { sfx } from "@/lib/client/feedback";
import { useI18n } from "@/lib/i18n/context";
import { useServerNow } from "../ui/hooks";
import { PLAYER_STYLE } from "./theme";

/** 3 · 2 · 1 · SHUT THE BOX · "OMAR GOES FIRST", synced to the server's phase deadline. */
export function MatchIntro({ phaseEndsAt, starter, isMe }: { phaseEndsAt: number; starter: RoomPlayer | undefined; isMe: boolean }) {
  const { t, n } = useI18n();
  const now = useServerNow(100);
  const start = phaseEndsAt - TIMING.matchIntroMs;
  const el = now - start;
  const step = el < 1000 ? 3 : el < 2000 ? 2 : el < 3000 ? 1 : el < 4300 ? 0 : -1;
  const last = useRef<number | null>(null);
  useEffect(() => {
    if (step === last.current) return;
    last.current = step;
    if (step > 0) sfx.countdown();
    if (step === 0) sfx.countdown(true);
  }, [step]);
  if (now >= phaseEndsAt) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center" data-testid="intro">
      <motion.div className="absolute inset-0 bg-black/70" animate={{ opacity: step >= 1 ? 1 : 0.35 }} />
      <AnimatePresence mode="popLayout">
        {step > 0 && (
          <motion.div
            key={step}
            data-testid="countdown"
            initial={{ scale: 2.4, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.4, opacity: 0 }}
            transition={{ type: "spring", stiffness: 300, damping: 20 }}
            className="relative text-[9rem] leading-none font-extrabold text-[#ffcf4a] drop-shadow-[0_8px_0_#8a5a00]"
          >
            {n(step)}
          </motion.div>
        )}
        {step === 0 && (
          <motion.div key="stb" initial={{ scale: 0.6, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ opacity: 0, y: -40 }} className="relative px-6 text-center text-5xl leading-tight font-extrabold text-white drop-shadow-[0_6px_0_rgba(0,0,0,.5)]">
            {t("shutTheBox")}
          </motion.div>
        )}
        {step === -1 && starter && (
          <motion.div key="first" initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="relative -mt-[45vh]">
            <FirstPlayerBanner name={starter.nickname} color={starter.color} isMe={isMe} />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function FirstPlayerBanner({ name, color, isMe }: { name: string; color: PlayerColor; isMe: boolean }) {
  const { t } = useI18n();
  const c = PLAYER_STYLE[color];
  return (
    <div
      data-testid="first-player"
      className="rounded-2xl px-5 py-3 text-center text-xl font-extrabold tracking-wide shadow-2xl"
      style={{ background: `linear-gradient(180deg, ${c.light}, ${c.base})`, color: c.text, boxShadow: `0 6px 0 ${c.dark}` }}
    >
      {isMe ? t("youGoFirst") : t("goesFirst", { name: name.toUpperCase() })}
    </div>
  );
}

/** Between rounds: "ROUND 2" + "AHMED GOES FIRST" while tiles rise. */
export function RoundSetupBanner({ round, starter, isMe, total }: { round: number; starter: RoomPlayer | undefined; isMe: boolean; total: number | null }) {
  const { t } = useI18n();
  return (
    <motion.div className="pointer-events-none fixed inset-x-0 top-[22%] z-30 flex flex-col items-center gap-3" initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }}>
      <div className="text-4xl font-extrabold text-[#ffcf4a] drop-shadow-[0_4px_0_#6b4500]">{total ? t("roundOf", { n: round, total }) : t("roundN", { n: round })}</div>
      {starter && <FirstPlayerBanner name={starter.nickname} color={starter.color} isMe={isMe} />}
    </motion.div>
  );
}

export function BlockedOverlay({ name, score, isMe, onDone }: { name: string; score: number; isMe: boolean; onDone: () => void }) {
  const { t } = useI18n();
  useTimeout(onDone, 1700);
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="blocked-overlay">
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(110,10,10,.85),rgba(0,0,0,.9))]" />
      <motion.div className="relative text-center" initial={{ scale: 1.8, rotate: -8 }} animate={{ scale: 1, rotate: -4 }} transition={{ type: "spring", stiffness: 380, damping: 14 }}>
        <div className="text-lg font-extrabold tracking-[0.3em] text-white/70">{t("noMove")}</div>
        <div className="rounded-2xl border-4 border-[#ff6b63] px-6 py-1 text-6xl font-extrabold text-[#ff6b63] drop-shadow-[0_6px_0_rgba(0,0,0,.5)]">{t("blocked")}</div>
        <div className="mt-3 text-base font-bold text-white">{isMe ? t("blockedSub", { score }) : `${name} · ${score}`}</div>
      </motion.div>
    </motion.div>
  );
}

/** Fires once after `ms`, calling the latest callback (parents re-render often). */
function useTimeout(fn: () => void, ms: number) {
  const ref = useRef(fn);
  useEffect(() => {
    ref.current = fn;
  });
  useEffect(() => {
    const id = setTimeout(() => ref.current(), ms);
    return () => clearTimeout(id);
  }, [ms]);
}

/** Deterministic pseudo-random in [0,1) so renders stay pure. */
function jitter(i: number, salt: number): number {
  const x = Math.sin(i * 12.9898 + salt * 78.233) * 43758.5453;
  return x - Math.floor(x);
}

/** SHUT THE BOX celebration with confetti particles. */
export function ShutBoxCelebration({ name, color, isMe, onDone }: { name: string; color: PlayerColor; isMe: boolean; onDone: () => void }) {
  const { t } = useI18n();
  const c = PLAYER_STYLE[color];
  useTimeout(onDone, 3200);
  const particles = useMemo(
    () =>
      Array.from({ length: 60 }, (_, i) => ({
        id: i,
        x: (jitter(i, 1) - 0.5) * 900,
        y: -jitter(i, 2) * 700 - 100,
        r: jitter(i, 3) * 720 - 360,
        d: 1.4 + jitter(i, 4) * 1.2,
        color: [c.light, "#ffcf4a", "#ffffff", c.base, "#ff8a82", "#66d796"][i % 6],
        w: 6 + jitter(i, 5) * 8,
      })),
    [c.light, c.base],
  );
  return (
    <motion.div className="pointer-events-none fixed inset-0 z-40 flex items-center justify-center overflow-hidden" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} data-testid="shut-celebration">
      <div className="absolute inset-0 bg-[radial-gradient(circle,rgba(255,207,74,.35),rgba(0,0,0,.8))]" />
      {particles.map((p) => (
        <motion.span
          key={p.id}
          className="absolute top-1/2 left-1/2 rounded-sm"
          style={{ width: p.w, height: p.w * 0.45, background: p.color }}
          initial={{ x: 0, y: 0, rotate: 0, opacity: 1 }}
          animate={{ x: p.x, y: [0, p.y, p.y + 900], rotate: p.r, opacity: [1, 1, 0] }}
          transition={{ duration: p.d + 1.2, ease: "easeOut" }}
        />
      ))}
      <div className="relative flex flex-col items-center text-center leading-[0.9] font-extrabold">
        {[t("shut"), t("the"), t("box")].map((w, i) => (
          <motion.div
            key={i}
            initial={{ scale: 0, rotate: -12 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.15 * i }}
            className="text-[5.5rem] text-[#ffcf4a] drop-shadow-[0_8px_0_#7a4f00]"
          >
            {w}
          </motion.div>
        ))}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.7 }} className="mt-4 rounded-full px-4 py-1 text-xl" style={{ background: c.base, color: c.text }}>
          {isMe ? "🏆" : name} 🎉
        </motion.div>
      </div>
    </motion.div>
  );
}

export function PausedOverlay({ by, canResume, onResume }: { by: string; canResume: boolean; onResume: () => void }) {
  const { t } = useI18n();
  return (
    <div className="fixed inset-0 z-30 flex flex-col items-center justify-center gap-4 bg-black/75 p-6 text-center" data-testid="paused">
      <div className="text-5xl font-extrabold text-[#ffcf4a]">⏸ {t("paused")}</div>
      <div className="text-white/70">{t("pausedBy", { name: by })}</div>
      {canResume && (
        <button type="button" className="btn-game h-14 rounded-2xl bg-[#ffcf4a] px-8 text-lg text-[#2a1a00]" onClick={onResume}>
          {t("resume")}
        </button>
      )}
    </div>
  );
}

export function ConnectionBanner({ net, restoredAt, reconnectingName }: { net: "online" | "reconnecting" | "offline"; restoredAt: number | null; reconnectingName: string | null }) {
  const { t } = useI18n();
  const now = useServerNow(500);
  const restored = restoredAt !== null && now - restoredAt < 2500;
  let text: string | null = null;
  let tone = "bg-[#7d1714]";
  if (net === "offline") text = t("connectionLost");
  else if (net === "reconnecting") text = t("reconnectingEllipsis");
  else if (restored) {
    text = t("sessionRestored");
    tone = "bg-emerald-700";
  } else if (reconnectingName) {
    text = t("playerReconnecting", { name: reconnectingName.toUpperCase() });
    tone = "bg-[#6b4a00]";
  }
  return (
    <AnimatePresence>
      {text && (
        <motion.div
          data-testid="connection-banner"
          initial={{ y: -30, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: -30, opacity: 0 }}
          className={`${tone} mx-auto mb-1.5 w-fit rounded-full px-3 py-1 text-[11px] font-extrabold tracking-wider text-white shadow-lg`}
        >
          {text}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
