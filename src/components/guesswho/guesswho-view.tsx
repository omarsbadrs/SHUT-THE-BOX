"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { cardById, eliminatedBy, GW_QUESTIONS, GW_TIMING, questionById, type GuessWhoRoomState, type GwCommand, type GwLogEntry, type GwRound, type GwRoundResult } from "@/games/guesswho";
import { haptic, sfx, unlockAudio } from "@/lib/client/feedback";
import type { RoomHandle } from "@/lib/client/use-room";
import { useI18n } from "@/lib/i18n/context";
import type { Lang } from "@/lib/i18n/dictionaries";
import type { RoomPlayer } from "@/game-engine";
import { PreferenceToggles } from "../game/menu";
import { ConnectionBanner } from "../game/overlays";
import { Avatar, ConnectionDot } from "../game/player-badge";
import { PLAYER_STYLE } from "../game/theme";
import { useErrorText, useServerNow, useShortScreen, useToast } from "../ui/hooks";
import { GameButton, Sheet, TextInput, Toast } from "../ui/primitives";
import { CardBack, CardFace, GwCardTile } from "./card";
import { GuessWhoMatchResultsView } from "./results";

const FINAL_ROUND_MS = 6000;

function Timer({ deadline, now }: { deadline: number | null | undefined; now: number }) {
  const { t } = useI18n();
  if (!deadline) return null;
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${secs <= 5 ? "animate-pulse bg-[#e0413b] text-white" : "bg-black/35 text-white/80"}`} data-testid="gw-timer">
      ⏱ {t("timeLeft", { n: secs })}
    </span>
  );
}

function gridFor(n: number) {
  return n <= 16 ? { cols: 4, rows: Math.ceil(n / 4) } : n <= 20 ? { cols: 5, rows: Math.ceil(n / 5) } : { cols: 6, rows: Math.ceil(n / 6) };
}

/** The text of a log entry's question in the viewer's language. */
function questionText(entry: GwLogEntry, lang: Lang) {
  if (entry.kind === "free") return `“${entry.text}”`;
  const q = entry.questionId ? questionById(entry.questionId) : undefined;
  return q ? (lang === "ar" ? q.ar : q.en) : "";
}

function Stamp({ answer }: { answer: "yes" | "no" }) {
  const { t } = useI18n();
  const yes = answer === "yes";
  return (
    <motion.span
      key={answer}
      initial={{ scale: 2.4, rotate: -18, opacity: 0 }}
      animate={{ scale: 1, rotate: -8, opacity: 1 }}
      transition={{ type: "spring", stiffness: 420, damping: 14 }}
      className={`kufi inline-block shrink-0 rounded-md border-2 px-2 py-0.5 text-base leading-none font-bold ${yes ? "border-emerald-400 text-emerald-300" : "border-[#ff7a70] text-[#ff8a82]"}`}
      data-testid="gw-stamp"
      data-answer={answer}
    >
      {yes ? t("gw_yes") : t("gw_no")}
    </motion.span>
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
  result: GwRoundResult;
  state: GuessWhoRoomState;
  me: string | null;
  secondsLeft: number | null;
  canAdvance: boolean;
  onNext: () => void;
  final: boolean;
  onContinue: () => void;
}) {
  const { t, n, lang } = useI18n();
  const match = state.match!;
  const player = (id: string | null) => state.players.find((p) => p.id === id);
  const winner = player(result.winnerId);
  const guesser = player(result.guesserId);
  const headline =
    result.outcome === "guessed" ? t("gw_guessed", { name: guesser?.nickname ?? "—" }) : result.outcome === "wrong_guess" ? t("gw_wrongGuess", { name: guesser?.nickname ?? "—" }) : t("gw_roundOver");
  const order = match.playerIds;
  return (
    <motion.div className="fixed inset-0 z-30 flex items-end justify-center bg-black/65 sm:items-center" initial={{ opacity: 0 }} animate={{ opacity: 1 }} data-testid="gw-round-results">
      <motion.div initial={{ y: 80 }} animate={{ y: 0 }} className="safe-bottom w-full max-w-[520px] rounded-t-[28px] border-t border-[#c9962b]/40 bg-[#0e1f4d] px-4 pt-4 sm:rounded-[28px]">
        <div className="text-center">
          <div className="text-xs font-bold tracking-[0.25em] text-white/50">{t("roundN", { n: result.roundNumber })}</div>
          <div className="kufi gold-text text-2xl font-bold" data-testid="gw-round-headline">
            {headline}
          </div>
        </div>
        <div className="mt-3 grid grid-cols-2 gap-3">
          {order.map((id, i) => {
            const p = player(id);
            const card = result.secrets[id];
            if (!p || !card) return null;
            return (
              <div key={id} className="flex min-w-0 flex-col items-center gap-1.5" data-testid={`gw-reveal-${p.color}`} data-card={card}>
                <motion.div className="h-[clamp(120px,26dvh,210px)] w-auto [perspective:800px]" style={{ aspectRatio: "3 / 4" }}>
                  <motion.div
                    className="preserve-3d relative h-full w-full"
                    initial={{ rotateY: 180 }}
                    animate={{ rotateY: 0 }}
                    transition={{
                      delay: 0.3 + i * 0.35,
                      type: "spring",
                      stiffness: 160,
                      damping: 16,
                    }}
                  >
                    <div className="backface-hidden absolute inset-0">
                      <CardFace cardId={card} lang={lang} className="h-full w-full" nameSize="lg" />
                    </div>
                    <div className="backface-hidden absolute inset-0 [transform:rotateY(180deg)]">
                      <CardBack className="h-full w-full" />
                    </div>
                  </motion.div>
                </motion.div>
                <div className="flex max-w-full items-center gap-1.5 text-sm font-extrabold">
                  <Avatar player={p} size={22} />
                  <span
                    className="truncate"
                    style={{
                      color: id === me ? "#ffcf4a" : PLAYER_STYLE[p.color].light,
                    }}
                  >
                    {p.nickname}
                  </span>
                  {winner?.id === id && <span>👑</span>}
                  <span className="text-white/60 tabular-nums">· {n(match.scores[id]?.wins ?? 0)}</span>
                </div>
              </div>
            );
          })}
        </div>
        <div className="mt-3 flex items-center gap-3 pb-2">
          {final ? (
            <GameButton size="md" className="ms-auto" onClick={onContinue} data-testid="gw-continue">
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

function Intro({ phaseEndsAt, now }: { phaseEndsAt: number; now: number }) {
  const { t, n } = useI18n();
  const el = now - (phaseEndsAt - GW_TIMING.introMs);
  const step = el < 1000 ? 3 : el < 2000 ? 2 : el < 3000 ? 1 : 0;
  if (now >= phaseEndsAt) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/75" data-testid="intro">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={step}
          initial={{ scale: 2, opacity: 0, rotate: -8 }}
          animate={{ scale: 1, opacity: 1, rotate: 0 }}
          exit={{ opacity: 0 }}
          className="kufi gold-text text-8xl font-bold"
          data-testid={step > 0 ? "countdown" : undefined}
        >
          {step > 0 ? n(step) : t("gameGuessWho")}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

function PlayerChip({ player, isMe, turn, left, wins, online }: { player: RoomPlayer; isMe: boolean; turn: boolean; left: number; wins: number; online: boolean }) {
  const { t } = useI18n();
  const c = PLAYER_STYLE[player.color];
  return (
    <motion.div
      className="glass relative flex min-w-0 flex-1 items-center gap-1.5 rounded-xl px-2 py-1"
      animate={{
        boxShadow: turn ? `0 0 0 2px ${c.light}, 0 0 14px -2px ${c.glow}` : "0 0 0 0 transparent",
      }}
      data-testid={`gw-chip-${player.color}`}
    >
      <Avatar player={player} size={24} />
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1 text-xs font-extrabold">
          <span className="truncate" style={{ color: isMe ? "#ffcf4a" : undefined }}>
            {player.nickname}
          </span>
          <ConnectionDot status={player.connection} presence={online} />
        </div>
        <div className="flex items-center gap-1.5 text-[10px] font-bold text-white/60">
          <span data-testid={`gw-left-${player.color}`}>{t("gw_cardsLeft", { n: left })}</span>
          <span style={{ color: c.light }}>· {"★".repeat(wins) || "☆"}</span>
        </div>
      </div>
    </motion.div>
  );
}

/** Keeps a board card's flip instant on this phone while the server confirms it. */
function useOptimisticFlips(round: GwRound | null, me: string | null) {
  const [pending, setPending] = useState<Record<string, boolean>>({});
  const server = new Set(round && me ? (round.flipped[me] ?? []) : []);
  const isDown = (id: string) => (id in pending ? pending[id] : server.has(id));
  const settle = (ids: string[]) =>
    setPending((p) => {
      const next = { ...p };
      for (const id of ids) delete next[id];
      return next;
    });
  const mark = (ids: string[], down: boolean) =>
    setPending((p) => ({
      ...p,
      ...Object.fromEntries(ids.map((id) => [id, down])),
    }));
  return { isDown, mark, settle, roundId: round?.id };
}

export function GuessWhoView({ room }: { room: RoomHandle }) {
  const { t, n, lang } = useI18n();
  const router = useRouter();
  const state = room.state as GuessWhoRoomState; // RoomClient only renders this view for Guess Who rooms
  const me = room.spectator ? null : room.me;
  const personal = room.personal;
  const match = state.match!;
  const round: GwRound | null = match.round;
  const settings = match.settings;
  const phase = state.phase;
  const now = useServerNow(250);
  const short = useShortScreen();
  const toast = useToast();
  const errText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [askOpen, setAskOpen] = useState(false);
  const [logOpen, setLogOpen] = useState(false);
  const [cardOpen, setCardOpen] = useState(false);
  const [guessing, setGuessing] = useState(false);
  const [confirm, setConfirm] = useState<string | null>(null);
  const [freeText, setFreeText] = useState("");
  const [finalAck, setFinalAck] = useState<string | null>(null);
  const flips = useOptimisticFlips(round, me);

  const players = state.players.filter((p) => match.playerIds.includes(p.id));
  const meP = players.find((p) => p.id === me) ?? null;
  const other = players.find((p) => p.id !== me) ?? null;
  const isHost = state.hostId === room.me;
  const current = players.find((p) => p.id === round?.currentId);
  const pending = round?.pending ?? null;
  const live = phase === "GW_PLAYING" && !!round && !round.result;
  const myTurn = live && !!me && round.currentId === me && !pending;
  const answering = live && !!pending && pending.answererId === me;
  const freeAllowed = settings.freeQuestions && !other?.isBot;

  // Leave guess mode whenever it stops being my turn.
  const [guessRound, setGuessRound] = useState<string | null>(null);
  if (guessing && (!myTurn || guessRound !== round?.id)) {
    setGuessing(false);
  }

  const send = async (c: GwCommand) => {
    const res = await room.send(c);
    if (!res.ok) toast.show(errText(res.error));
    return res;
  };

  useEffect(
    () =>
      room.subscribe((e) => {
        switch (e.type) {
          case "GW_ASKED":
            sfx.stamp(e.answer === "yes");
            if (e.nextId === me) haptic.yourTurn();
            break;
          case "GW_FREE_ANSWERED":
            sfx.stamp(e.answer === "yes");
            break;
          case "GW_FREE_ASKED":
            if (e.answererId === me) {
              sfx.turn();
              haptic.yourTurn();
            }
            break;
          case "GW_TURN":
          case "GW_WRONG_GUESS":
            if ((e.type === "GW_TURN" ? e.playerId : e.nextId) === me) {
              sfx.turn();
              haptic.yourTurn();
            }
            break;
          case "GW_FLIPPED":
            if (e.playerId !== me) e.cardIds.slice(0, 6).forEach((_, i) => sfx.cardFlip(i * 0.05));
            break;
          case "GW_ROUND_STARTED":
            e.board.slice(0, 8).forEach((_, i) => sfx.cardFlip(i * 0.04));
            if (e.firstId === me) haptic.yourTurn();
            break;
          case "GW_ROUND_ENDED":
            if (e.result.winnerId === me) {
              sfx.saved();
              haptic.roundWin();
            } else if (me) {
              sfx.hanged();
              haptic.blocked();
            }
            break;
        }
      }),
    [room, me],
  );

  const leave = async () => {
    await room.send({ type: "LEAVE" });
    router.push("/");
  };

  // ── results ──
  const lastResult = match.history[match.history.length - 1];
  const resultAge = lastResult ? now - lastResult.endedAt : 0;
  const showRoundPanel = !!lastResult && (phase === "GW_ROUND_RESULTS" || (phase === "GW_MATCH_RESULTS" && finalAck !== match.id && resultAge < FINAL_ROUND_MS));
  if (phase === "GW_MATCH_RESULTS" && match.result && !showRoundPanel) {
    return (
      <GuessWhoMatchResultsView
        players={players}
        scores={match.scores}
        result={match.result}
        history={match.history}
        settings={settings}
        isHost={isHost}
        onRematch={() => send({ type: "REMATCH" })}
        onLobby={() => send({ type: "BACK_TO_LOBBY" })}
        onNewRoom={() => router.push("/guesswho/create")}
        onExit={leave}
        shareUrl={typeof window !== "undefined" && room.config ? `${window.location.origin}/results/${match.id}` : null}
      />
    );
  }

  // ── board helpers ──
  const board = round?.board ?? [];
  const grid = gridFor(board.length || settings.boardSize);
  const leftFor = (id: string | null | undefined) => (round && id ? board.length - (round.flipped[id]?.length ?? 0) : 0);
  const toFlip = round && me && live ? eliminatedBy(round, me).filter((id) => !flips.isDown(id)) : [];

  const flip = async (ids: string[], down: boolean) => {
    if (!ids.length) return;
    unlockAudio();
    ids.slice(0, 6).forEach((_, i) => sfx.cardFlip(i * 0.05));
    haptic.select();
    flips.mark(ids, down);
    await send({ type: "GW_FLIP", cardIds: ids, down });
    flips.settle(ids);
  };

  const tapCard = (id: string) => {
    if (!round || !me || !live) return;
    if (guessing) {
      if (!flips.isDown(id)) setConfirm(id);
      return;
    }
    void flip([id], !flips.isDown(id));
  };

  const ask = async (questionId: string) => {
    unlockAudio();
    setBusy(true);
    const res = await send({ type: "GW_ASK", questionId });
    setBusy(false);
    if (res.ok) setAskOpen(false);
  };
  const askFree = async () => {
    if (freeText.trim().length < 3) return;
    setBusy(true);
    const res = await send({ type: "GW_ASK_FREE", text: freeText });
    setBusy(false);
    if (res.ok) {
      setFreeText("");
      setAskOpen(false);
    }
  };
  const doGuess = async () => {
    if (!confirm) return;
    setBusy(true);
    await send({ type: "GW_GUESS", cardId: confirm });
    setBusy(false);
    setConfirm(null);
    setGuessing(false);
  };

  // ── last answer banner ──
  const last = round?.log.filter((l) => l.kind !== "guess").at(-1) ?? null;
  const lastWrong = round?.log.filter((l) => l.kind === "guess" && l.correct === false).at(-1) ?? null;
  const asker = (id: string) => players.find((p) => p.id === id);

  let status: React.ReactNode;
  if (!live) status = null;
  else if (answering)
    status = null; // the answer prompt takes over
  else if (pending)
    status = t("gw_waitingAnswer", {
      name: players.find((p) => p.id === pending.answererId)?.nickname ?? "",
    });
  else if (guessing) status = t("gw_pickCard");
  else if (myTurn) status = t("gw_yourTurn");
  else status = t("gw_theirTurn", { name: current?.nickname.toUpperCase() ?? "" });
  const deadline = pending ? pending.deadlineAt : round?.deadlineAt;
  const secret = personal?.card ?? null;

  const asked = new Map((round?.log ?? []).filter((l) => l.askerId === me && l.questionId).map((l) => [l.questionId!, l.answer]));
  const questions = round ? GW_QUESTIONS[round.category] : [];
  const logFit = typeof window !== "undefined" ? Math.max(4, Math.floor((window.innerHeight * 0.6) / 40)) : 8;

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[520px] flex-col overflow-hidden px-3 safe-top safe-bottom" data-testid="guesswho-view" data-phase={phase}>
      <Toast message={toast.message} />
      <header className="mb-1.5 flex shrink-0 items-center gap-2">
        <span className="glass rounded-xl px-2.5 py-1.5 text-xs font-extrabold tracking-[0.2em]" data-testid="room-code">
          {state.code}
        </span>
        <span className="kufi gold-text flex-1 truncate text-center text-base font-bold" data-testid="round-label">
          {t("roundN", { n: round?.number ?? 1 })} · {settings.rounds === 1 ? t("gw_oneRound") : t("gw_bestOf", { n: settings.rounds })}
        </span>
        <button type="button" onClick={() => setLogOpen(true)} className="glass h-10 w-10 shrink-0 rounded-xl text-lg" aria-label={t("gw_log")} data-testid="gw-log-button">
          📜
        </button>
        <button type="button" aria-label={t("settings")} onClick={() => setMenu(true)} className="glass h-10 w-10 shrink-0 rounded-xl text-lg" data-testid="menu-button">
          ⚙
        </button>
      </header>
      <ConnectionBanner net={room.net} restoredAt={room.restoredAt} reconnectingName={null} />
      <div className="flex shrink-0 gap-2">
        {meP && (
          <PlayerChip
            player={meP}
            isMe={meP.id === me}
            turn={live && round?.currentId === meP.id && !pending}
            left={leftFor(meP.id)}
            wins={match.scores[meP.id]?.wins ?? 0}
            online={meP.isBot || room.presence.has(meP.id)}
          />
        )}
        {other && (
          <PlayerChip
            player={other}
            isMe={other.id === me}
            turn={live && round?.currentId === other.id && !pending}
            left={leftFor(other.id)}
            wins={match.scores[other.id]?.wins ?? 0}
            online={other.isBot || room.presence.has(other.id)}
          />
        )}
      </div>

      {/* BOARD */}
      {/* Sized to the space left, keeping every card at 3:4 (no stretched tiles on tall phones). */}
      <div className="mt-2 flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <div
          className="gold-frame rounded-[20px] p-[5px]"
          style={{
            width: `min(100cqw, calc((100cqh - 38px) * ${(grid.cols * 3) / (grid.rows * 4)}))`,
          }}
        >
          <div className="lapis relative flex flex-col rounded-[16px]">
            <div className="hiero-band h-3 shrink-0 rounded-t-[16px] opacity-80" />
            <div
              className="grid gap-[clamp(3px,0.8dvh,6px)] p-[clamp(4px,1dvh,8px)]"
              style={{
                gridTemplateColumns: `repeat(${grid.cols}, minmax(0, 1fr))`,
                gridTemplateRows: `repeat(${grid.rows}, minmax(0, 1fr))`,
                aspectRatio: `${grid.cols * 3} / ${grid.rows * 4}`,
              }}
              data-testid="gw-board"
            >
              {board.map((id) => (
                <GwCardTile key={`${round?.id}-${id}`} cardId={id} lang={lang} down={flips.isDown(id)} onTap={() => tapCard(id)} mode={guessing ? "guess" : "normal"} disabled={!me || !live} />
              ))}
            </div>
            <div className="hiero-band h-3 shrink-0 rounded-b-[16px] opacity-80" />
          </div>
        </div>
      </div>

      {/* LAST ANSWER */}
      <div className="mt-1.5 flex min-h-[34px] shrink-0 items-center gap-2 rounded-xl bg-black/25 px-2.5 py-1 text-[13px] leading-tight font-bold" data-testid="gw-last">
        {lastWrong && (!last || lastWrong.n > last.n) ? (
          <>
            <span className="min-w-0 flex-1 truncate text-white/80">
              {t("gw_wrongGuess", {
                name: asker(lastWrong.askerId)?.nickname ?? "",
              })}{" "}
              · {cardById(lastWrong.cardId ?? "")?.[lang]}
            </span>
            <Stamp answer="no" />
          </>
        ) : last ? (
          <>
            <span className="min-w-0 flex-1 truncate py-0.5 leading-snug">
              <span className="text-white/55">
                {last.askerId === me
                  ? t("gw_youAsked")
                  : t("gw_theyAsked", {
                      name: asker(last.askerId)?.nickname ?? "",
                    })}
                :{" "}
              </span>
              <span className="text-white/90" data-testid="gw-last-question">
                {questionText(last, lang)}
              </span>
            </span>
            {last.answer && <Stamp answer={last.answer} />}
          </>
        ) : (
          <span className="flex-1 text-center text-white/50">{me ? t("gw_flipHint") : t("gw_noQuestions")}</span>
        )}
      </div>

      {/* STATUS */}
      <div className="my-1 flex min-h-[24px] shrink-0 items-center justify-center gap-2 text-center text-[13px] font-extrabold tracking-wide" data-testid="gw-status">
        <span
          className="truncate"
          style={{
            color: current && !myTurn && !pending ? PLAYER_STYLE[current.color].light : undefined,
          }}
        >
          {status}
        </span>
        {live && <Timer deadline={deadline} now={now} />}
      </div>

      {/* CONTROLS */}
      <div className="shrink-0 pb-1">
        {answering && pending ? (
          <motion.div initial={{ y: 20, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="papyrus rounded-2xl p-2.5" data-testid="gw-answer-prompt">
            <div className="text-[11px] font-extrabold tracking-wider text-[#7a4a14] uppercase">
              {t("gw_asksYou", {
                name: players.find((p) => p.id === pending.askerId)?.nickname ?? "",
              })}
            </div>
            <div className="kufi mb-2 text-lg leading-tight font-bold" data-testid="gw-pending-text">
              “{pending.text}”
            </div>
            <div className="grid grid-cols-2 gap-2">
              <GameButton size="md" variant="green" disabled={busy} onClick={() => send({ type: "GW_ANSWER", answer: "yes" })} data-testid="gw-answer-yes">
                ✓ {t("gw_yes")}
              </GameButton>
              <GameButton size="md" variant="red" disabled={busy} onClick={() => send({ type: "GW_ANSWER", answer: "no" })} data-testid="gw-answer-no">
                ✕ {t("gw_no")}
              </GameButton>
            </div>
          </motion.div>
        ) : me ? (
          <div className="flex items-stretch gap-2">
            <button
              type="button"
              onClick={() => secret && setCardOpen(true)}
              className="relative h-[clamp(52px,9.5dvh,70px)] shrink-0"
              style={{ aspectRatio: "3 / 4" }}
              aria-label={t("gw_yourCard")}
              data-testid="gw-my-card"
              data-card={secret ?? ""}
            >
              {secret ? <CardFace cardId={secret} lang={lang} className="h-full w-full" /> : <CardBack className="h-full w-full" />}
              <span className="absolute -top-1.5 start-1/2 -translate-x-1/2 rounded bg-[#ffcf4a] px-1 text-[7px] leading-tight font-extrabold whitespace-nowrap text-[#2a1a00] rtl:translate-x-1/2">
                {t("gw_yourCard")}
              </span>
            </button>
            <div
              className="grid min-w-0 flex-1 gap-2"
              style={{
                gridTemplateColumns: toFlip.length > 0 && !guessing ? "1fr 1fr auto" : "1fr 1fr",
              }}
            >
              {guessing ? (
                <>
                  <div className="col-span-1 flex items-center justify-center rounded-2xl bg-[#ffcf4a]/15 text-center text-xs font-extrabold text-[#ffcf4a]">🎯 {t("gw_pickCard")}</div>
                  <GameButton size="md" variant="dark" className={short ? "!h-11" : ""} onClick={() => setGuessing(false)} data-testid="gw-cancel-guess">
                    {t("cancel")}
                  </GameButton>
                </>
              ) : (
                <>
                  <GameButton size="md" variant="blue" className={`${short ? "!h-11" : "!h-full"} kufi !px-2 text-lg`} disabled={!myTurn || busy} onClick={() => setAskOpen(true)} data-testid="gw-ask">
                    ❓ {t("gw_ask")}
                  </GameButton>
                  <GameButton
                    size="md"
                    className={`${short ? "!h-11" : "!h-full"} kufi !px-2 text-lg`}
                    disabled={!myTurn || busy}
                    onClick={() => {
                      setGuessRound(round?.id ?? null);
                      setGuessing(true);
                    }}
                    data-testid="gw-guess"
                  >
                    🎯 {t("gw_guess")}
                  </GameButton>
                  {toFlip.length > 0 && (
                    <GameButton size="md" variant="dark" className={`${short ? "!h-11" : "!h-full"} !px-2.5 text-sm`} onClick={() => flip(toFlip, true)} data-testid="gw-auto-flip">
                      {t("gw_flipNo", { n: toFlip.length })}
                    </GameButton>
                  )}
                </>
              )}
            </div>
          </div>
        ) : (
          <div className="py-2 text-center text-sm font-bold text-white/60">{t("spectating")}</div>
        )}
      </div>

      {phase === "GW_STARTING" && state.phaseEndsAt !== null && <Intro phaseEndsAt={state.phaseEndsAt} now={now} />}
      {showRoundPanel && lastResult && (
        <RoundPanel
          result={lastResult}
          state={state}
          me={me}
          secondsLeft={state.phaseEndsAt !== null ? Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)) : null}
          canAdvance={isHost && phase === "GW_ROUND_RESULTS"}
          onNext={() => send({ type: "NEXT_ROUND" })}
          final={phase === "GW_MATCH_RESULTS"}
          onContinue={() => setFinalAck(match.id)}
        />
      )}

      {/* ASK */}
      <Sheet open={askOpen} onClose={() => setAskOpen(false)} title={t("gw_askTitle")}>
        <div className="grid gap-2 pb-4" data-testid="gw-ask-sheet">
          <div className="grid grid-cols-2 gap-1.5">
            {questions.map((q) => {
              const a = asked.get(q.id);
              return (
                <button
                  key={q.id}
                  type="button"
                  disabled={!myTurn || busy || !!a}
                  onClick={() => ask(q.id)}
                  data-testid={`gw-q-${q.id.split(":")[1]}`}
                  className={`flex min-h-[clamp(30px,5.6dvh,40px)] items-center justify-between gap-1 rounded-xl px-2 py-1 text-start text-[12px] leading-tight font-bold transition ${a ? "bg-black/30 text-white/40" : "bg-white/8 text-white/90 active:bg-white/15"}`}
                >
                  <span className="line-clamp-2">{lang === "ar" ? q.ar : q.en}</span>
                  {a && <span className={`shrink-0 text-[10px] font-extrabold ${a === "yes" ? "text-emerald-300" : "text-[#ff8a82]"}`}>{a === "yes" ? t("gw_yes") : t("gw_no")}</span>}
                </button>
              );
            })}
          </div>
          {settings.freeQuestions &&
            (freeAllowed ? (
              <form
                className="flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  void askFree();
                }}
              >
                <TextInput value={freeText} onChange={(e) => setFreeText(e.target.value)} maxLength={80} placeholder={t("gw_typeOwn")} className="!h-11 !text-base" data-testid="gw-free-input" />
                <GameButton type="submit" size="md" variant="green" className="!h-11 shrink-0" disabled={busy || freeText.trim().length < 3} data-testid="gw-free-send">
                  {t("gw_send")}
                </GameButton>
              </form>
            ) : (
              <div className="text-center text-xs text-white/50">{t("gw_botOnlyPreset")}</div>
            ))}
        </div>
      </Sheet>

      {/* GUESS CONFIRM */}
      <Sheet open={!!confirm} onClose={() => setConfirm(null)} title={confirm ? t("gw_confirmGuess", { name: cardById(confirm)?.[lang] ?? "" }) : undefined}>
        {confirm && (
          <div className="flex flex-col items-center gap-3 pb-5" data-testid="gw-confirm">
            <CardFace cardId={confirm} lang={lang} className="h-[clamp(150px,36dvh,300px)]" nameSize="lg" />
            {settings.wrongGuessLoses && <div className="text-xs font-bold text-[#ff8a82]">{t("gw_guessWarn")}</div>}
            <div className="grid w-full grid-cols-2 gap-2">
              <GameButton size="md" variant="dark" onClick={() => setConfirm(null)}>
                {t("cancel")}
              </GameButton>
              <GameButton size="md" disabled={busy} onClick={doGuess} data-testid="gw-confirm-guess">
                🎯 {t("gw_guess")}
              </GameButton>
            </div>
          </div>
        )}
      </Sheet>

      {/* MY CARD */}
      <Sheet open={cardOpen} onClose={() => setCardOpen(false)} title={t("gw_yourCard")}>
        {secret && (
          <div className="flex flex-col items-center gap-3 pb-5">
            <CardFace cardId={secret} lang={lang} className="h-[clamp(180px,48dvh,380px)]" nameSize="lg" />
            <GameButton size="md" variant="dark" onClick={() => setCardOpen(false)}>
              {t("gw_hideCard")}
            </GameButton>
          </div>
        )}
      </Sheet>

      {/* LOG */}
      <Sheet open={logOpen} onClose={() => setLogOpen(false)} title={t("gw_log")}>
        <ol className="grid gap-1 overflow-hidden pb-5" data-testid="gw-log">
          {(round?.log ?? []).length === 0 && <li className="py-6 text-center text-white/50">{t("gw_noQuestions")}</li>}
          {[...(round?.log ?? [])]
            .reverse()
            .slice(0, logFit)
            .map((l) => {
              const p = asker(l.askerId);
              return (
                <li key={l.n} className="flex items-center gap-2 rounded-xl bg-white/5 px-2.5 py-1.5 text-sm">
                  {p && <Avatar player={p} size={20} />}
                  <span className="min-w-0 flex-1 truncate font-bold">{l.kind === "guess" ? `🎯 ${cardById(l.cardId ?? "")?.[lang] ?? ""}` : questionText(l, lang)}</span>
                  {l.answer ? <Stamp answer={l.answer} /> : l.kind === "guess" ? <Stamp answer={l.correct ? "yes" : "no"} /> : null}
                </li>
              );
            })}
        </ol>
      </Sheet>

      <Sheet open={menu} onClose={() => setMenu(false)} title={t("settings")}>
        <div className="grid gap-2 pb-6">
          <PreferenceToggles />
          {isHost && !match.result && (
            <GameButton size="md" variant="red" onClick={() => send({ type: "END_MATCH" }).then(() => setMenu(false))} data-testid="end-match">
              {t("endMatch")}
            </GameButton>
          )}
          <GameButton size="md" variant="ghost" onClick={leave}>
            {t("leaveRoom")}
          </GameButton>
          <div className="text-center text-xs text-white/40">
            {state.code} · v{n(state.version)}
          </div>
        </div>
      </Sheet>
    </div>
  );
}
