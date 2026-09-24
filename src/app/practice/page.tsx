"use client";

import { AnimatePresence, motion } from "motion/react";
import { useState } from "react";
import {
  calculateOpenTileScore,
  canUseOneDie,
  checkMove,
  closeTiles,
  DEFAULT_SETTINGS,
  getValidCombinations,
  rateMoves,
  rollDice,
  secureRandom,
  TILE_VALUES,
  type DiceRoll,
  type PlayerColor,
} from "@/game-engine";
import { Board } from "@/components/game/board";
import { Die } from "@/components/game/dice";
import { ShutBoxCelebration } from "@/components/game/overlays";
import { PageShell } from "@/components/page-shell";
import { GameButton, Toggle } from "@/components/ui/primitives";
import { haptic, sfx, unlockAudio } from "@/lib/client/feedback";
import { setPrefs, usePrefs } from "@/lib/client/prefs";
import { recordSoloGame, useSoloStats } from "@/lib/client/solo-stats";
import { useI18n } from "@/lib/i18n/context";

/** Solo practice: no room, instant start, local stats. Dice use the Web Crypto CSPRNG. */

const recordGame = recordSoloGame;

interface Review {
  chosen: number[];
  options: Array<{ tiles: number[]; expectedScore: number }>;
}

export default function PracticePage() {
  const { t, n } = useI18n();
  const prefs = usePrefs();
  const stats = useSoloStats();
  const color: PlayerColor = prefs.color ?? "blue";
  const [oneDieRule, setOneDieRule] = useState(false);
  const settings = { ...DEFAULT_SETTINGS, oneDieEndgame: oneDieRule };
  const [open, setOpen] = useState<number[]>([...TILE_VALUES]);
  const [roll, setRoll] = useState<(DiceRoll & { key: number }) | null>(null);
  const [selected, setSelected] = useState<number[]>([]);
  const [over, setOver] = useState<{ score: number } | null>(null);
  const [review, setReview] = useState<Review | null>(null);
  const [celebrate, setCelebrate] = useState(false);
  const [diceCount, setDiceCount] = useState<1 | 2>(2);
  const [rolling, setRolling] = useState(false);

  const oneDie = canUseOneDie(open, settings);
  const total = roll?.total ?? 0;
  const sum = selected.reduce((a, b) => a + b, 0);
  const awaiting = !!roll && !over && !rolling;

  const newGame = () => {
    setOpen([...TILE_VALUES]);
    setRoll(null);
    setSelected([]);
    setOver(null);
    setReview(null);
  };

  const doRoll = () => {
    unlockAudio();
    sfx.diceShake();
    haptic.roll();
    const r = rollDice(secureRandom, oneDie ? diceCount : 2);
    setRolling(true);
    setRoll({ ...r, key: Date.now() });
    setSelected([]);
    setTimeout(() => {
      sfx.diceLand();
      setRolling(false);
      if (getValidCombinations(open, r.total).length === 0) {
        const score = calculateOpenTileScore(open);
        setTimeout(() => {
          sfx.blocked();
          haptic.blocked();
          setOver({ score });
          recordGame(score);
        }, 900);
      }
    }, 800);
  };

  const commit = () => {
    const check = checkMove(open, total, selected);
    if (!check.ok) return;
    const options = rateMoves(open, total, settings);
    const next = closeTiles(open, check.tiles);
    check.tiles.forEach((_, i) => sfx.tileFlip(i * 0.09));
    haptic.close();
    if (prefs.trainer) setReview({ chosen: check.tiles, options });
    setOpen(next);
    setRoll(null);
    setSelected([]);
    if (next.length === 0) {
      setCelebrate(true);
      sfx.shutTheBox();
      haptic.shutTheBox();
      setOver({ score: 0 });
      recordGame(0);
    }
  };

  const avg = stats.games ? stats.total / stats.games : null;

  return (
    <PageShell title={t("practiceTitle")}>
      <div className="mb-3 grid grid-cols-5 gap-1.5 text-center" data-testid="solo-stats">
        {[
          [t("bestScore"), stats.best === null ? "—" : n(stats.best)],
          [t("averageScore"), avg === null ? "—" : n(avg.toFixed(1))],
          [t("perfectGames"), n(stats.perfect)],
          [t("streak"), n(stats.streak)],
          [t("gamesPlayed"), n(stats.games)],
        ].map(([k, v]) => (
          <div key={k} className="glass rounded-xl px-1 py-1.5">
            <div className="text-[9px] font-bold tracking-wider text-white/50 uppercase">{k}</div>
            <div className="text-lg font-extrabold">{v}</div>
          </div>
        ))}
      </div>

      <div className="flex min-h-[170px] flex-col items-center justify-center gap-2">
        {roll ? (
          <>
            <div className="flex items-center gap-4">
              <Die value={roll.die1} color={color} rollKey={roll.key} size={66} testId="solo-die-1" />
              {roll.die2 !== null && (
                <>
                  <span className="text-2xl font-extrabold text-white/50">+</span>
                  <Die value={roll.die2} color={color} rollKey={roll.key} size={66} />
                </>
              )}
              {!rolling && (
                <div className="ms-2 flex flex-col items-center">
                  <span className="text-[10px] font-extrabold tracking-widest text-white/60">{t("total")}</span>
                  <span className="text-5xl leading-none font-extrabold text-[#ffcf4a]">{n(roll.total)}</span>
                </div>
              )}
            </div>
            {!rolling && !over && <div className="text-base font-extrabold">{t("chooseTiles", { total: roll.total })}</div>}
          </>
        ) : over ? null : (
          <div className="text-center text-3xl font-extrabold text-white/80">{t("yourTurn")}</div>
        )}
        {over && (
          <motion.div initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} className="text-center" data-testid="solo-over">
            <div className="text-3xl font-extrabold text-[#ff8a82]">{over.score === 0 ? t("shutTheBox") : t("gameOver")}</div>
            <div className="text-lg font-bold">{t("finalScore", { n: over.score })}</div>
          </motion.div>
        )}
      </div>

      <Board color={color} openTiles={open} selected={selected} interactive={awaiting} onToggle={(v) => {
        sfx.select();
        haptic.select();
        setSelected((s) => (s.includes(v) ? s.filter((x) => x !== v) : [...s, v]));
      }} active={!over} />

      <div className="mt-3 grid gap-2">
        {awaiting ? (
          <>
            <div className="text-center font-extrabold">
              {sum === total ? (
                <span className="text-emerald-300">
                  {[...selected].sort((a, b) => a - b).map((x) => n(x)).join(" + ")} = {n(total)} ✓
                </span>
              ) : sum > total ? (
                <span className="text-[#ff8a82]">
                  {n(sum)} / {n(total)} · {t("tooHigh")}
                </span>
              ) : (
                <span className="text-white/70">{t("selected", { sum, total })}</span>
              )}
            </div>
            <GameButton variant="green" disabled={sum !== total} onClick={commit} data-testid="solo-close">
              {t("closeTiles")}
            </GameButton>
          </>
        ) : over ? (
          <GameButton onClick={newGame} data-testid="solo-new">
            {t("newGame")}
          </GameButton>
        ) : (
          <>
            {oneDie && (
              <div className="flex justify-center gap-2">
                {([2, 1] as const).map((c) => (
                  <button key={c} type="button" onClick={() => setDiceCount(c)} className={`rounded-full px-3 py-1 text-xs font-extrabold ${diceCount === c ? "bg-[#ffcf4a] text-[#2a1a00]" : "bg-white/10"}`}>
                    {c === 2 ? t("twoDiceToggle") : t("oneDieToggle")}
                  </button>
                ))}
              </div>
            )}
            <GameButton onClick={doRoll} disabled={rolling} data-testid="solo-roll">
              🎲 {t("rollDice")}
            </GameButton>
          </>
        )}
      </div>

      <AnimatePresence>
        {review && prefs.trainer && review.options.length > 1 && (
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0 }} className="glass mt-4 rounded-2xl p-3" data-testid="trainer">
            <div className="mb-2 text-xs font-bold text-white/60">{t("otherCombos")}</div>
            <div className="flex flex-wrap gap-1.5">
              {review.options.map((o, i) => {
                const chosen = o.tiles.join() === review.chosen.join();
                return (
                  <span key={o.tiles.join()} className={`rounded-full px-2.5 py-1 text-sm font-bold ${chosen ? "bg-[#ffcf4a] text-[#2a1a00]" : "bg-white/8"}`}>
                    {o.tiles.map((x) => n(x)).join(" + ")}
                    {i === 0 && <span className="ms-1 text-[10px] opacity-80">★ {t("bestMove")}</span>}
                    <span className="ms-1 text-[10px] opacity-60">{t("expected", { n: o.expectedScore.toFixed(1) })}</span>
                  </span>
                );
              })}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      <div className="mt-6 grid gap-2 pb-6">
        <Toggle checked={prefs.trainer} onChange={(v) => setPrefs({ trainer: v })} label={`🎓 ${t("trainer")}`} />
        <Toggle checked={oneDieRule} onChange={setOneDieRule} label={t("oneDie")} />
      </div>

      <AnimatePresence>{celebrate && <ShutBoxCelebration name="" color={color} isMe onDone={() => setCelebrate(false)} />}</AnimatePresence>
    </PageShell>
  );
}
