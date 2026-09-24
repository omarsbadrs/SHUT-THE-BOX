"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import {
  HM_TIMING,
  normalizeWord,
  type HangmanRoomState,
  type HmCommand,
  type HmRound,
  type HmRoundResult,
  type HmScore,
} from "@/games/hangman";
import { haptic, sfx, unlockAudio } from "@/lib/client/feedback";
import type { RoomHandle } from "@/lib/client/use-room";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { PreferenceToggles } from "../game/menu";
import { ConnectionBanner } from "../game/overlays";
import { Avatar, ConnectionDot } from "../game/player-badge";
import { PLAYER_STYLE } from "../game/theme";
import { useErrorText, useServerNow, useToast } from "../ui/hooks";
import { GameButton, Sheet, TextInput, Toast } from "../ui/primitives";
import { Gallows, type GallowsState } from "./gallows";
import { Keyboard, WordSlots } from "./word-board";

const RESULT_DELAY_MS = 2200; // let the hang / rescue animation play before the results sheet
const FINAL_ROUND_MS = 5000;

function Timer({ deadline, now }: { deadline: number | null | undefined; now: number }) {
  const { t } = useI18n();
  if (!deadline) return null;
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${secs <= 5 ? "animate-pulse bg-[#e0413b] text-white" : "bg-black/35 text-white/80"}`} data-testid="hm-timer">
      ⏱ {t("timeLeft", { n: secs })}
    </span>
  );
}

function PlayerChips({ state, me, presence }: { state: HangmanRoomState; me: string | null; presence: Set<string> }) {
  const { t, n } = useI18n();
  const match = state.match!;
  const round = match.round;
  const players = state.players.filter((p) => match.playerIds.includes(p.id));
  return (
    <div className="grid gap-1.5" style={{ gridTemplateColumns: `repeat(${players.length}, minmax(0, 1fr))` }} data-testid="hm-players">
      {players.map((p) => {
        const c = PLAYER_STYLE[p.color];
        const score = match.scores[p.id]?.points ?? 0;
        const isMaster = round?.masterId === p.id;
        const isTurn = round?.currentGuesserId === p.id && !round.result;
        const rp = round?.race?.[p.id];
        return (
          <motion.div
            key={p.id}
            data-testid={`hm-chip-${p.color}`}
            className="glass relative min-w-0 rounded-xl px-1.5 py-1"
            animate={{ boxShadow: isTurn ? `0 0 0 2px ${c.light}, 0 0 14px -2px ${c.glow}` : "0 0 0 0 transparent" }}
          >
            <div className="flex min-w-0 items-center gap-1">
              <Avatar player={p} size={20} />
              <span className="min-w-0 flex-1 truncate text-[11px] leading-tight font-extrabold" style={{ color: p.id === me ? "#ffcf4a" : undefined }}>
                {p.nickname}
              </span>
              <ConnectionDot status={p.connection} presence={presence.has(p.id)} />
            </div>
            <div className="mt-0.5 flex items-center justify-between gap-1 text-[10px] leading-none font-bold">
              <span style={{ color: c.light }}>{t("pts", { n: score })}</span>
              {isMaster && <span className="rounded bg-[#ffcf4a] px-1 text-[8px] text-[#2a1a00]">✎</span>}
              {rp && <span className="text-white/60">{rp.status === "playing" ? `${n(rp.revealed)}/${n(rp.total)}` : t(`hm_status_${rp.status}` as MessageKey)}</span>}
            </div>
            {rp && (
              <div className="mt-1 h-1 overflow-hidden rounded-full bg-black/40">
                <motion.div className="h-full rounded-full" style={{ background: c.light }} animate={{ width: `${rp.total ? (rp.revealed / rp.total) * 100 : 0}%` }} />
              </div>
            )}
            {rp && rp.wrong > 0 && (
              <div className="absolute -top-1.5 end-1 rounded-full bg-black/70 px-1 text-[8px] font-extrabold text-[#ff8a82]">✕{n(rp.wrong)}</div>
            )}
          </motion.div>
        );
      })}
    </div>
  );
}

function RoundPanel({
  result,
  state,
  me,
  secondsLeft,
  canAdvance,
  onNext,
  final,
  onContinue,
}: {
  result: HmRoundResult;
  state: HangmanRoomState;
  me: string | null;
  secondsLeft: number | null;
  canAdvance: boolean;
  onNext: () => void;
  final: boolean;
  onContinue: () => void;
}) {
  const { t, n } = useI18n();
  const match = state.match!;
  const name = (id: string | null) => state.players.find((p) => p.id === id)?.nickname ?? "—";
  const headline =
    result.outcome === "solved"
      ? t("hm_solvedBy", { name: name(result.solverId) })
      : result.outcome === "hanged"
        ? t("hm_masterWins", { name: name(result.masterId) })
        : result.outcome === "race" && result.solverId
          ? t("hm_solvedBy", { name: name(result.solverId) })
          : t("hm_nobody");
  const order = match.playerIds.slice().sort((a, b) => (match.scores[b]?.points ?? 0) - (match.scores[a]?.points ?? 0));
  return (
    <motion.div className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="hm-round-results">
      <motion.div initial={{ y: 80 }} animate={{ y: 0 }} className="safe-bottom w-full max-w-[520px] rounded-t-[28px] border-t border-white/10 bg-[#10231a] px-4 pt-5 sm:rounded-[28px]">
        <div className="chalkboard rounded-2xl px-3 py-4 text-center">
          <div className="text-xs font-bold tracking-[0.25em] text-white/50">{t("hm_wordWas")}</div>
          <div className="chalk mt-1 text-4xl" data-testid="hm-reveal" dir={match.settings.language === "ar" ? "rtl" : "ltr"}>
            {result.word}
          </div>
          <div className="mt-2 text-base font-extrabold text-[#ffcf4a]">{headline}</div>
        </div>
        <div className="mt-3 text-xs font-bold tracking-wider text-white/50 uppercase">
          {t("hm_roundPoints")} · {t("hm_totals")}
        </div>
        <ol className="mt-2 space-y-1.5">
          {order.map((id) => {
            const p = state.players.find((x) => x.id === id);
            if (!p) return null;
            const s: HmScore | undefined = match.scores[id];
            const gain = result.points[id] ?? 0;
            return (
              <li key={id} className={`flex items-center gap-3 rounded-2xl px-3 py-2 ${id === me ? "bg-[#ffcf4a]/10 ring-1 ring-[#ffcf4a]/40" : "bg-white/5"}`} data-testid={`hm-result-${p.color}`}>
                <Avatar player={p} size={28} />
                <span className="min-w-0 flex-1 truncate font-extrabold">
                  {p.nickname} {result.masterId === id && <span className="ms-1 rounded bg-[#ffcf4a] px-1 text-[10px] text-[#2a1a00]">{t("hm_master")}</span>}
                </span>
                <span className="text-sm font-extrabold text-emerald-300">{gain > 0 ? `+${n(gain)}` : n(0)}</span>
                <span className="w-12 text-end text-lg font-extrabold tabular-nums" style={{ color: PLAYER_STYLE[p.color].light }} data-points={s?.points ?? 0}>
                  {n(s?.points ?? 0)}
                </span>
              </li>
            );
          })}
        </ol>
        <div className="mt-4 flex items-center gap-3 pb-2">
          {final ? (
            <GameButton size="md" className="ms-auto" onClick={onContinue} data-testid="hm-continue">
              {t("continue")} →
            </GameButton>
          ) : (
            <>
              <div className="flex-1 text-sm font-bold text-white/60">{secondsLeft !== null && t("nextRoundIn", { n: secondsLeft })}</div>
              {canAdvance && (
                <GameButton size="md" variant="green" onClick={onNext} data-testid="next-round">
                  {t("nextRound")}
                </GameButton>
              )}
            </>
          )}
        </div>
      </motion.div>
    </motion.div>
  );
}

function MatchResults({ state, me, onRematch, onLobby, onExit }: { state: HangmanRoomState; me: string | null; onRematch: () => void; onLobby: () => void; onExit: () => void }) {
  const { t, n } = useI18n();
  const router = useRouter();
  const match = state.match!;
  const result = match.result!;
  const isHost = state.hostId === me;
  const byId = new Map(state.players.map((p) => [p.id, p]));
  const winners = result.winnerIds.map((id) => byId.get(id)).filter(Boolean);
  const rows: Array<[string, (s: HmScore) => number]> = [
    [t("hm_stat_words"), (s) => s.wordsSolved],
    [t("hm_stat_letters"), (s) => s.lettersFound],
    [t("hm_stat_wrong"), (s) => s.wrongGuesses],
    ...(match.settings.gameMode === "hangman_master" ? ([[t("hm_stat_hangmen"), (s: HmScore) => s.hangmen]] as Array<[string, (s: HmScore) => number]>) : []),
  ];
  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 safe-top safe-bottom" data-testid="hm-match-results">
      <div className="flex flex-col items-center pt-6 pb-4 text-center">
        <div className="chalkboard relative flex h-36 w-44 items-center justify-center rounded-2xl p-2">
          <Gallows wrong={6} lives={6} state="saved" />
        </div>
        <div className="mt-3 text-sm font-extrabold tracking-[0.35em] text-white/60">{winners.length > 1 ? t("winners") : t("winner")}</div>
        <div className="text-5xl font-extrabold" style={{ color: winners[0] ? PLAYER_STYLE[winners[0]!.color].light : "#ffcf4a" }} data-testid="match-winner">
          {winners.map((w) => w!.nickname).join(" & ") || "—"}
        </div>
        {result.reason !== "completed" && <div className="mt-1 text-xs font-bold text-white/50">{result.reason === "host_ended" ? t("matchEndedByHost") : t("notEnoughPlayersLeft")}</div>}
      </div>
      <ol className="space-y-2">
        {result.standings.map((s) => {
          const p = byId.get(s.playerId);
          if (!p) return null;
          return (
            <li key={s.playerId} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5">
              <span className="w-6 text-center text-xl font-extrabold text-white/60">{n(s.rank)}</span>
              <Avatar player={p} size={34} />
              <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{p.nickname}</span>
              <span className="text-sm font-bold text-white/70">{t("pts", { n: s.points })}</span>
            </li>
          );
        })}
      </ol>
      <div className="no-scrollbar mt-5 overflow-x-auto rounded-2xl bg-black/25">
        <table className="w-full min-w-[320px] text-sm">
          <thead>
            <tr className="text-white/60">
              <th />
              {result.standings.map((s) => (
                <th key={s.playerId} className="px-2 py-2 text-center font-extrabold" style={{ color: byId.get(s.playerId) ? PLAYER_STYLE[byId.get(s.playerId)!.color].light : undefined }}>
                  {byId.get(s.playerId)?.nickname}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map(([label, fn]) => (
              <tr key={label} className="border-t border-white/5">
                <td className="px-3 py-2 text-white/70">{label}</td>
                {result.standings.map((s) => (
                  <td key={s.playerId} className="px-2 py-2 text-center font-extrabold tabular-nums">
                    {match.scores[s.playerId] ? n(fn(match.scores[s.playerId])) : "—"}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="mt-auto grid gap-3 pt-6">
        {isHost ? (
          <GameButton onClick={onRematch} data-testid="rematch">
            {t("rematch")}
          </GameButton>
        ) : (
          <div className="text-center text-sm font-bold text-white/60">{t("waitingRematch")}</div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <GameButton variant="dark" size="md" onClick={() => router.push("/hangman/create")}>
            {t("newRoom")}
          </GameButton>
          <GameButton variant="dark" size="md" onClick={onExit}>
            {t("exit")}
          </GameButton>
        </div>
        {isHost && (
          <button type="button" onClick={onLobby} className="pb-2 text-sm font-bold text-white/60 underline">
            {t("backToLobby")}
          </button>
        )}
      </div>
    </div>
  );
}

function Intro({ phaseEndsAt, now }: { phaseEndsAt: number; now: number }) {
  const { t, n } = useI18n();
  const el = now - (phaseEndsAt - HM_TIMING.introMs);
  const step = el < 1000 ? 3 : el < 2000 ? 2 : el < 3000 ? 1 : 0;
  if (now >= phaseEndsAt) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/70" data-testid="intro">
      <AnimatePresence mode="popLayout">
        <motion.div key={step} initial={{ scale: 2, opacity: 0, rotate: -8 }} animate={{ scale: 1, opacity: 1, rotate: 0 }} exit={{ opacity: 0 }} className="chalk text-8xl" data-testid={step > 0 ? "countdown" : undefined}>
          {step > 0 ? n(step) : t("gameHangman")}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

export function HangmanView({ room }: { room: RoomHandle }) {
  const { t, n } = useI18n();
  const router = useRouter();
  const state = room.state as HangmanRoomState; // RoomClient only renders this view for Hangman rooms
  const me = room.me;
  const personal = room.personal;
  const match = state.match!;
  const round: HmRound | null = match.round;
  const settings = match.settings;
  const phase = state.phase;
  const now = useServerNow(250);
  const toast = useToast();
  const errText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [solveOpen, setSolveOpen] = useState(false);
  const [solveText, setSolveText] = useState("");
  const [word, setWord] = useState("");
  const [finalAck, setFinalAck] = useState<string | null>(null);

  const isHost = state.hostId === me;
  const race = !!round && round.masterId === null;
  const isMaster = !!round && !!me && round.masterId === me;
  const lang = round?.language ?? settings.language;
  const myRace = race && me ? round?.race?.[me] : undefined;
  const current = state.players.find((p) => p.id === round?.currentGuesserId);
  const master = state.players.find((p) => p.id === round?.masterId);

  const send = async (c: HmCommand) => {
    const res = await room.send(c);
    if (!res.ok) toast.show(errText(res.error));
    return res;
  };

  // Sounds & haptics as events are presented.
  useEffect(
    () =>
      room.subscribe((e) => {
        switch (e.type) {
          case "HM_LETTER":
            if (e.correct) sfx.letterRight(e.positions.length);
            else {
              sfx.letterWrong();
              setTimeout(() => sfx.chalk(), 150);
            }
            if (e.playerId === me) (e.correct ? haptic.select : haptic.blocked)();
            break;
          case "HM_SOLVE_FAILED":
            sfx.letterWrong();
            setTimeout(() => sfx.chalk(), 150);
            break;
          case "HM_TURN":
            if (e.playerId === me) {
              sfx.turn();
              haptic.yourTurn();
            }
            break;
          case "HM_WORD_SET":
            sfx.chalk();
            if (e.firstGuesserId === me) haptic.yourTurn();
            break;
          case "HM_ROUND_ENDED":
            if (e.result.outcome === "hanged") {
              sfx.hanged();
              haptic.blocked();
            } else if (e.result.outcome !== "abandoned") {
              sfx.saved();
              haptic.roundWin();
            }
            break;
          case "HM_ROUND_STARTED":
            sfx.chalk();
            break;
        }
      }),
    [room, me],
  );

  // ── board data (race boards are private: they come from `personal`) ──
  const mask = race ? (personal?.race?.mask ?? round?.mask ?? []) : (round?.mask ?? []);
  const singles = (xs: string[]) => xs.filter((x) => [...x].length === 1);
  const guessed = race ? (personal?.race?.guessed ?? []) : singles(round?.guessed ?? []);
  const wrongList = race ? (personal?.race?.wrong ?? []) : (round?.wrong ?? []);
  const wrongCount = race ? (myRace?.wrong ?? 0) : (round?.wrong.length ?? 0);
  const wrongSet = new Set(singles(wrongList));
  const correctSet = new Set(guessed.filter((l) => !wrongSet.has(l)));

  let gState: GallowsState = "playing";
  if (race && myRace) gState = myRace.status === "solved" ? "saved" : myRace.status === "hanged" ? "hanged" : "playing";
  if (round?.result) {
    if (!race) gState = round.result.outcome === "solved" ? "saved" : round.result.outcome === "hanged" ? "hanged" : "playing";
    else if (myRace?.status === "timeup") gState = "playing";
  }

  const canGuess =
    !busy &&
    !round?.result &&
    ((phase === "HM_GUESSING" && round?.currentGuesserId === me) || (phase === "HM_RACE" && myRace?.status === "playing"));

  const guess = async (letter: string) => {
    if (!canGuess) return;
    unlockAudio();
    sfx.chalkTap();
    setBusy(true);
    const before = myRace?.wrong ?? 0;
    const res = await send({ type: "HM_GUESS", letter });
    setBusy(false);
    if (race && res.ok) {
      const p = res.data.personal as { race?: { wrong: string[] } } | undefined;
      const after = p?.race?.wrong.length ?? before;
      if (after > before) {
        sfx.letterWrong();
        setTimeout(() => sfx.chalk(), 150);
        haptic.blocked();
      } else {
        sfx.letterRight();
        haptic.select();
      }
    }
  };

  const submitSolve = async () => {
    if (!solveText.trim()) return;
    setBusy(true);
    const res = await send({ type: "HM_SOLVE", guess: solveText });
    setBusy(false);
    if (res.ok) {
      setSolveOpen(false);
      setSolveText("");
    }
  };

  const wordCheck = normalizeWord(word, lang);
  const setSecret = async (random: boolean) => {
    unlockAudio();
    setBusy(true);
    const res = await send(random ? { type: "HM_RANDOM_WORD" } : { type: "HM_SET_WORD", word });
    setBusy(false);
    if (res.ok) setWord("");
  };

  const leave = async () => {
    await room.send({ type: "LEAVE" });
    router.push("/");
  };

  // ── results ──
  const lastResult = match.history[match.history.length - 1];
  const resultAge = lastResult ? now - lastResult.endedAt : 0;
  const showRoundPanel = !!lastResult && resultAge > RESULT_DELAY_MS && (phase === "HM_ROUND_RESULTS" || (phase === "HM_MATCH_RESULTS" && finalAck !== match.id && resultAge < FINAL_ROUND_MS + RESULT_DELAY_MS));
  if (phase === "HM_MATCH_RESULTS" && match.result && !showRoundPanel && (resultAge > RESULT_DELAY_MS || !lastResult || finalAck === match.id)) {
    return <MatchResults state={state} me={me} onRematch={() => send({ type: "REMATCH" })} onLobby={() => send({ type: "BACK_TO_LOBBY" })} onExit={leave} />;
  }

  // ── status line ──
  let status: React.ReactNode = null;
  if (phase === "HM_CHOOSING") status = isMaster ? t("hm_chooseWord") : t("hm_isChoosing", { name: master?.nickname.toUpperCase() ?? "" });
  else if (phase === "HM_GUESSING")
    status = isMaster ? t("hm_watch") : round?.currentGuesserId === me ? t("hm_yourGuess") : t("hm_isGuessing", { name: current?.nickname.toUpperCase() ?? "" });
  else if (phase === "HM_RACE")
    status = myRace?.status === "solved" ? t("hm_youSolved") : myRace?.status === "hanged" ? t("hm_youHanged") : myRace?.status === "playing" ? t("hm_yourGuess") : t("hm_waitRace");
  else if (round?.result) status = round.result.outcome === "hanged" ? t("hm_hanged") : t("hm_saved");

  const timerDeadline = phase === "HM_GUESSING" ? round?.deadlineAt : phase === "HM_RACE" || phase === "HM_CHOOSING" ? state.phaseEndsAt : null;
  const livesLeft = Math.max(0, settings.lives - wrongCount);
  const label = t("roundOf", { n: round?.number ?? 0, total: match.totalRounds });
  const categoryKey = `cat_${round?.category ?? settings.category}` as MessageKey;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden px-3 safe-top safe-bottom" data-testid="hangman-view" data-phase={phase}>
      <Toast message={toast.message} />
      <header className="mb-1.5 flex items-center gap-2">
        <span className="glass rounded-xl px-2.5 py-1.5 text-xs font-extrabold tracking-[0.2em]" data-testid="room-code">
          {state.code}
        </span>
        <span className="flex-1 text-center text-sm font-extrabold tracking-wider text-[#ffcf4a]" data-testid="round-label">
          {label}
        </span>
        {me && (
          <span className="glass rounded-xl px-2.5 py-1 text-center leading-tight">
            <span className="block text-[9px] font-bold tracking-wider text-white/60">{t("score")}</span>
            <span className="block text-lg font-extrabold tabular-nums" data-testid="my-points">
              {n(match.scores[me]?.points ?? 0)}
            </span>
          </span>
        )}
        <button type="button" aria-label={t("settings")} onClick={() => setMenu(true)} className="glass h-10 w-10 rounded-xl text-lg" data-testid="menu-button">
          ⚙
        </button>
      </header>
      <ConnectionBanner net={room.net} restoredAt={room.restoredAt} reconnectingName={null} />
      <PlayerChips state={state} me={me} presence={room.presence} />

      {/* CHALKBOARD */}
      <div className="wood mt-2 min-h-0 flex-1 rounded-[22px] p-2">
        <div className="chalkboard flex h-full flex-col rounded-[16px] px-3 pt-2 pb-3">
          <div className="flex items-center justify-between text-xs">
            <span className="chalk text-base opacity-80" data-testid="hm-category">
              {round?.category === "custom" ? t("cat_custom") : t(categoryKey)}
            </span>
            <span className="chalk text-base opacity-80" data-testid="hm-lives">
              {"❤".repeat(Math.min(livesLeft, 9))}
              <span className="opacity-30">{"❤".repeat(Math.max(0, settings.lives - livesLeft))}</span>
            </span>
          </div>
          <div className="relative min-h-0 flex-1">
            <Gallows wrong={wrongCount} lives={settings.lives} state={gState} roundKey={round?.id} />
          </div>
          {mask.length > 0 ? (
            <WordSlots mask={mask} lang={lang} secret={isMaster ? personal?.secret : null} />
          ) : (
            <div className="chalk text-center text-3xl opacity-60">
              <motion.span animate={{ opacity: [0.2, 1, 0.2] }} transition={{ duration: 1.4, repeat: Infinity }}>
                ✎ …
              </motion.span>
            </div>
          )}
          <div className="chalk mt-2 flex min-h-[1.4em] flex-wrap items-center justify-center gap-x-2 text-lg" data-testid="hm-misses">
            {wrongList.length > 0 && <span className="text-sm opacity-60">{t("hm_misses")}:</span>}
            {wrongList.map((w, i) => (
              <span key={`${w}-${i}`} className="text-[#ff9a92] line-through decoration-2">
                {w}
              </span>
            ))}
          </div>
        </div>
      </div>

      {/* STATUS */}
      <div className="my-1.5 flex min-h-[28px] items-center justify-center gap-2 text-center text-sm font-extrabold tracking-wide" data-testid="hm-status">
        <span style={{ color: current && phase === "HM_GUESSING" ? PLAYER_STYLE[current.color].light : undefined }}>{status}</span>
        <Timer deadline={timerDeadline} now={now} />
      </div>

      {/* CONTROLS */}
      <div className="shrink-0 pb-1">
        {phase === "HM_CHOOSING" && isMaster ? (
          <div className="grid gap-2" data-testid="hm-chooser">
            <TextInput
              value={word}
              onChange={(e) => setWord(e.target.value)}
              placeholder={t("hm_wordPlaceholder")}
              maxLength={24}
              dir={lang === "ar" ? "rtl" : "ltr"}
              autoComplete="off"
              autoCorrect="off"
              spellCheck={false}
              className="chalk text-center text-2xl"
              data-testid="hm-word-input"
            />
            {word && !wordCheck.ok && <div className="text-center text-xs font-bold text-[#ff8a82]">{t("err_INVALID_WORD")}</div>}
            <div className="grid grid-cols-2 gap-2">
              <GameButton size="md" variant="dark" className="text-sm" onClick={() => setSecret(true)} disabled={busy} data-testid="hm-random">
                🎲 {t("hm_randomWord")}
              </GameButton>
              <GameButton size="md" variant="green" className="text-sm" onClick={() => setSecret(false)} disabled={busy || !wordCheck.ok} data-testid="hm-set-word">
                {t("hm_setWord")}
              </GameButton>
            </div>
          </div>
        ) : isMaster && phase === "HM_GUESSING" ? (
          <div className="glass rounded-2xl px-3 py-3 text-center">
            <div className="text-[10px] font-bold tracking-[0.25em] text-white/50">{t("hm_yourWord")}</div>
            <div className="chalk text-3xl" dir={lang === "ar" ? "rtl" : "ltr"} data-testid="hm-secret">
              {personal?.secret}
            </div>
          </div>
        ) : phase === "HM_GUESSING" || phase === "HM_RACE" || phase === "HM_ROUND_RESULTS" ? (
          <div className="grid gap-2">
            <Keyboard lang={lang} correct={correctSet} wrong={wrongSet} disabled={!canGuess} onKey={guess} />
            <GameButton size="md" variant="blue" disabled={!canGuess} onClick={() => setSolveOpen(true)} data-testid="hm-solve">
              ✎ {t("hm_solve")}
            </GameButton>
          </div>
        ) : null}
      </div>

      {phase === "HM_STARTING" && state.phaseEndsAt !== null && <Intro phaseEndsAt={state.phaseEndsAt} now={now} />}
      {showRoundPanel && lastResult && (
        <RoundPanel
          result={lastResult}
          state={state}
          me={me}
          secondsLeft={state.phaseEndsAt !== null ? Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)) : null}
          canAdvance={isHost && phase === "HM_ROUND_RESULTS"}
          onNext={() => send({ type: "NEXT_ROUND" })}
          final={phase === "HM_MATCH_RESULTS"}
          onContinue={() => setFinalAck(match.id)}
        />
      )}

      <Sheet open={solveOpen} onClose={() => setSolveOpen(false)} title={t("hm_solveTitle")}>
        <form
          className="grid gap-3 pb-6"
          onSubmit={(e) => {
            e.preventDefault();
            void submitSolve();
          }}
        >
          <TextInput
            autoFocus
            value={solveText}
            onChange={(e) => setSolveText(e.target.value)}
            placeholder={t("hm_solvePlaceholder")}
            dir={lang === "ar" ? "rtl" : "ltr"}
            autoComplete="off"
            className="chalk text-center text-2xl"
            data-testid="hm-solve-input"
          />
          <GameButton type="submit" variant="green" disabled={busy || !solveText.trim()} data-testid="hm-solve-submit">
            {t("hm_submit")}
          </GameButton>
        </form>
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} title={t("settings")}>
        <div className="grid gap-2 pb-6">
          <PreferenceToggles />
          {isHost && !match.result && (
            <GameButton size="md" variant="red" onClick={() => send({ type: "END_MATCH" })} data-testid="end-match">
              {t("endMatch")}
            </GameButton>
          )}
          <GameButton size="md" variant="ghost" onClick={leave}>
            {t("leaveRoom")}
          </GameButton>
        </div>
      </Sheet>
    </div>
  );
}
