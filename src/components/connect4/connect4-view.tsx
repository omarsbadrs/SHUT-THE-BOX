"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import type { RoomPlayer } from "@/game-engine";
import { C4_TIMING, canPop, type C4Command, type C4Round, type C4RoundResult, type Connect4RoomState } from "@/games/connect4";
import { haptic, sfx, unlockAudio } from "@/lib/client/feedback";
import type { RoomHandle } from "@/lib/client/use-room";
import { useI18n } from "@/lib/i18n/context";
import { PreferenceToggles } from "../game/menu";
import { ConnectionBanner } from "../game/overlays";
import { Avatar, ConnectionDot } from "../game/player-badge";
import { PLAYER_STYLE } from "../game/theme";
import { useErrorText, useServerNow, useToast } from "../ui/hooks";
import { GameButton, Segmented, Sheet, Toast } from "../ui/primitives";
import { C4Board } from "./board";
import { Disc } from "./disc";
import { Connect4MatchResultsView } from "./results";

const FINAL_ROUND_MS = 6000;

function Timer({ deadline, now }: { deadline: number | null | undefined; now: number }) {
  const { t } = useI18n();
  if (!deadline) return null;
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));
  return (
    <span className={`rounded-full px-2 py-0.5 text-xs font-extrabold tabular-nums ${secs <= 5 ? "animate-pulse bg-[#e0413b] text-white" : "bg-black/35 text-white/80"}`} data-testid="c4-timer">
      ⏱ {t("timeLeft", { n: secs })}
    </span>
  );
}

function Intro({ phaseEndsAt, now }: { phaseEndsAt: number; now: number }) {
  const { t, n } = useI18n();
  const el = now - (phaseEndsAt - C4_TIMING.introMs);
  const step = el < 1000 ? 3 : el < 2000 ? 2 : el < 2800 ? 1 : 0;
  if (now >= phaseEndsAt) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-30 flex items-center justify-center bg-black/70" data-testid="intro">
      <AnimatePresence mode="popLayout">
        <motion.div
          key={step}
          initial={{ y: -220, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ opacity: 0, scale: 0.6 }}
          transition={{ type: "spring", stiffness: 420, damping: 14 }}
          className="flex flex-col items-center gap-2"
          data-testid={step > 0 ? "countdown" : undefined}
        >
          <div className="relative h-28 w-28">
            <Disc color={step % 2 ? "red" : "yellow"} className="h-full w-full" />
            <span className="absolute inset-0 flex items-center justify-center text-5xl font-extrabold text-white drop-shadow-[0_3px_0_rgba(0,0,0,.4)]">{step > 0 ? n(step) : "!"}</span>
          </div>
          {step === 0 && <div className="text-4xl font-extrabold tracking-wide text-[#ffcf4a]">{t("gameConnect4")}</div>}
        </motion.div>
      </AnimatePresence>
    </div>
  );
}

/** Discs of the winner's colour rain down. */
function Confetti({ color, seed }: { color: string; seed: string }) {
  const bits = useMemo(() => {
    const base = [...seed].reduce((acc, ch) => (acc * 31 + ch.charCodeAt(0)) >>> 0, 7);
    // deterministic pseudo-random value in [0, 1) for bit i, channel k
    const rnd = (i: number, k: number) => (((base ^ (i * 2654435761) ^ (k * 40503)) >>> 0) % 1000) / 1000;
    return Array.from({ length: 26 }, (_, i) => ({ x: rnd(i, 1) * 100, d: 0.2 + rnd(i, 2) * 0.8, s: 14 + rnd(i, 3) * 16, r: (rnd(i, 4) - 0.5) * 720, alt: i % 4 === 0 }));
  }, [seed]);
  return (
    <div className="pointer-events-none fixed inset-0 z-20 overflow-hidden" aria-hidden>
      {bits.map((b, i) => (
        <motion.div
          key={i}
          className="absolute top-0"
          style={{ left: `${b.x}%`, width: b.s, height: b.s }}
          initial={{ y: -40, rotate: 0, opacity: 1 }}
          animate={{ y: "110dvh", rotate: b.r, opacity: [1, 1, 0.8] }}
          transition={{ duration: 1.8 + b.d, delay: b.d * 0.6, ease: "easeIn" }}
        >
          <Disc color={b.alt ? "yellow" : color} className="h-full w-full" />
        </motion.div>
      ))}
    </div>
  );
}

function PlayerChip({ player, isMe, turn, wins, online }: { player: RoomPlayer; isMe: boolean; turn: boolean; wins: number; online: boolean }) {
  const c = PLAYER_STYLE[player.color];
  return (
    <motion.div
      className="glass relative flex min-w-0 flex-1 items-center gap-1.5 rounded-xl px-2 py-1"
      animate={{ boxShadow: turn ? `0 0 0 2px ${c.light}, 0 0 16px -2px ${c.glow}` : "0 0 0 0 transparent" }}
      data-testid={`c4-chip-${player.color}`}
    >
      <motion.div animate={turn ? { y: [0, -3, 0] } : { y: 0 }} transition={turn ? { duration: 0.9, repeat: Infinity } : undefined}>
        <Disc color={player.color} className="h-7 w-7" />
      </motion.div>
      <div className="min-w-0 flex-1 leading-tight">
        <div className="flex items-center gap-1 text-xs font-extrabold">
          <span className="truncate" style={{ color: isMe ? "#ffcf4a" : undefined }}>
            {player.nickname}
          </span>
          <ConnectionDot status={player.connection} presence={online} />
        </div>
        <div className="text-[11px] font-extrabold tabular-nums" style={{ color: c.light }} data-testid={`c4-wins-${player.color}`}>
          {"★".repeat(wins) || "☆"}
        </div>
      </div>
      <Avatar player={player} size={22} />
    </motion.div>
  );
}

function RoundCard({
  result,
  state,
  me,
  secondsLeft,
  canAdvance,
  onNext,
  final,
  onContinue,
}: {
  result: C4RoundResult;
  state: Connect4RoomState;
  me: string | null;
  secondsLeft: number | null;
  canAdvance: boolean;
  onNext: () => void;
  final: boolean;
  onContinue: () => void;
}) {
  const { t, n } = useI18n();
  const match = state.match!;
  const player = (id: string | null) => state.players.find((p) => p.id === id);
  const winner = player(result.winnerId);
  const headline =
    result.outcome === "draw"
      ? t("c4_draw")
      : winner && me && match.playerIds.includes(me)
        ? winner.id === me
          ? t("c4_youWin")
          : t("c4_youLose")
        : winner
          ? t("c4_connected", { name: winner.nickname, n: result.line?.length ?? match.settings.connect })
          : t("c4_roundOver");
  const [a, b] = match.playerIds.map((id) => player(id));
  return (
    <motion.div initial={{ y: 30, opacity: 0 }} animate={{ y: 0, opacity: 1 }} className="rounded-2xl border border-white/10 bg-[var(--panel)] px-3 py-2 shadow-xl" data-testid="c4-round-results">
      <div className="flex items-center gap-2">
        <div className="min-w-0 flex-1">
          <div className="text-[10px] font-bold tracking-[0.25em] text-white/50">
            {t("roundN", { n: result.roundNumber })} · {t("c4_moves", { n: result.moves })}
          </div>
          <div className="truncate text-xl font-extrabold" style={{ color: winner ? PLAYER_STYLE[winner.color].light : "#ffcf4a" }} data-testid="c4-headline">
            {headline}
          </div>
        </div>
        {a && b && (
          <div className="flex shrink-0 items-center gap-1.5 text-lg font-extrabold tabular-nums">
            <Disc color={a.color} className="h-5 w-5" />
            {n(match.scores[a.id]?.wins ?? 0)}
            <span className="text-white/40">–</span>
            {n(match.scores[b.id]?.wins ?? 0)}
            <Disc color={b.color} className="h-5 w-5" />
          </div>
        )}
      </div>
      <div className="mt-1.5 flex items-center gap-2">
        {final ? (
          <GameButton size="md" className="ms-auto !h-11" onClick={onContinue} data-testid="c4-continue">
            {t("continue")} →
          </GameButton>
        ) : (
          <>
            <div className="flex-1 text-sm font-bold text-white/60">{secondsLeft !== null && t("nextRoundIn", { n: secondsLeft })}</div>
            {canAdvance && (
              <GameButton size="md" variant="green" className="!h-11" onClick={onNext} data-testid="next-round">
                {t("nextRound")}
              </GameButton>
            )}
          </>
        )}
      </div>
    </motion.div>
  );
}

export function Connect4View({ room }: { room: RoomHandle }) {
  const { t, n } = useI18n();
  const router = useRouter();
  const state = room.state as Connect4RoomState; // RoomClient only renders this view for Connect 4 rooms
  const me = room.spectator ? null : room.me;
  const match = state.match!;
  const round: C4Round | null = match.round;
  const settings = match.settings;
  const phase = state.phase;
  const now = useServerNow(250);
  const toast = useToast();
  const errText = useErrorText();
  const [busy, setBusy] = useState(false);
  const [menu, setMenu] = useState(false);
  const [action, setAction] = useState<"drop" | "pop">("drop");
  const [finalAck, setFinalAck] = useState<string | null>(null);

  const players = state.players.filter((p) => match.playerIds.includes(p.id));
  const byId = new Map(players.map((p) => [p.id, p]));
  const meP = me ? (byId.get(me) ?? null) : null;
  const isHost = state.hostId === room.me;
  const live = phase === "C4_PLAYING" && !!round && !round.result;
  const myTurn = live && !!me && round.currentId === me;
  const current = round?.currentId ? byId.get(round.currentId) : undefined;
  const popout = settings.gameMode === "c4_popout";
  const canPopAny = !!round && !!me && round.columns.some((_, c) => canPop(round.columns, c, me));
  const mode: "drop" | "pop" = popout && action === "pop" && canPopAny ? "pop" : "drop";

  const send = async (c: C4Command) => {
    const res = await room.send(c);
    if (!res.ok) toast.show(errText(res.error));
    return res;
  };

  // Sounds & haptics as events are presented.
  useEffect(
    () =>
      room.subscribe((e, after) => {
        const s = after as Connect4RoomState;
        switch (e.type) {
          case "C4_MOVED":
            if (e.kind === "drop") sfx.discDrop((s.match?.round?.rows ?? 6) - e.row);
            else sfx.discPop();
            if (e.playerId === me) haptic.close();
            else if (e.nextId === me && !s.match?.round?.result) {
              haptic.yourTurn();
              setTimeout(() => sfx.turn(), 380);
            }
            if (e.auto === "timeout" && e.playerId === me) toast.show(t("c4_autoMove"));
            break;
          case "C4_ROUND_STARTED":
            if (e.number > 1) sfx.release(30);
            if (e.firstId === me) haptic.yourTurn();
            break;
          case "C4_ROUND_ENDED":
            if (e.result.winnerId && e.result.winnerId === me) {
              sfx.saved();
              haptic.roundWin();
            } else if (e.result.winnerId && me && s.match?.playerIds.includes(me)) {
              sfx.blocked();
              haptic.blocked();
            } else sfx.turn();
            break;
        }
      }),
    [room, me, toast, t],
  );

  const leave = async () => {
    await room.send({ type: "LEAVE" });
    router.push("/");
  };

  // ── results ──
  const lastResult = match.history[match.history.length - 1];
  const resultAge = lastResult ? now - lastResult.endedAt : 0;
  const showRoundCard = !!lastResult && (phase === "C4_ROUND_RESULTS" || (phase === "C4_MATCH_RESULTS" && finalAck !== match.id && resultAge < FINAL_ROUND_MS));
  if (phase === "C4_MATCH_RESULTS" && match.result && !showRoundCard) {
    return (
      <Connect4MatchResultsView
        players={players}
        playerIds={match.playerIds}
        scores={match.scores}
        result={match.result}
        history={match.history}
        settings={settings}
        isHost={isHost}
        onRematch={() => send({ type: "REMATCH" })}
        onLobby={() => send({ type: "BACK_TO_LOBBY" })}
        onNewRoom={() => router.push("/connect4/create")}
        onExit={leave}
        shareUrl={typeof window !== "undefined" && room.config ? `${window.location.origin}/results/${match.id}` : null}
      />
    );
  }

  const drop = async (column: number) => {
    if (!myTurn || busy) return;
    unlockAudio();
    setBusy(true);
    await send(mode === "pop" ? { type: "C4_POP", column } : { type: "C4_DROP", column });
    setBusy(false);
  };

  const cols = round?.cols ?? 7;
  const rows = round?.rows ?? 6;
  const lastDropN = round?.lastMove?.kind === "drop" ? round.lastMove.n : null;
  const winLine = round?.result?.line ?? null;
  const winner = round?.result?.winnerId ? byId.get(round.result.winnerId) : undefined;
  const status = !live
    ? null
    : myTurn
      ? popout && canPopAny
        ? t("c4_yourTurnPop")
        : t("c4_yourTurn")
      : t("c4_theirTurn", { name: current?.nickname.toUpperCase() ?? "" });
  const ratio = cols / (rows + 1.42);

  return (
    <div className="mx-auto flex h-dvh w-full max-w-[560px] flex-col overflow-hidden px-3 safe-top safe-bottom" data-testid="connect4-view" data-phase={phase}>
      <Toast message={toast.message} />
      <header className="mb-1.5 flex shrink-0 items-center gap-2">
        <span className="glass rounded-xl px-2.5 py-1.5 text-xs font-extrabold tracking-[0.2em]" data-testid="room-code">
          {state.code}
        </span>
        <span className="flex-1 truncate text-center text-sm font-extrabold tracking-wider text-[#ffcf4a]" data-testid="round-label">
          {t("roundN", { n: round?.number ?? 1 })} · {settings.rounds === 1 ? t("gw_oneRound") : t("gw_bestOf", { n: settings.rounds })}
        </span>
        <button type="button" aria-label={t("settings")} onClick={() => setMenu(true)} className="glass h-10 w-10 shrink-0 rounded-xl text-lg" data-testid="menu-button">
          ⚙
        </button>
      </header>
      <ConnectionBanner net={room.net} restoredAt={room.restoredAt} reconnectingName={null} />
      <div className="flex shrink-0 gap-2">
        {players.map((p) => (
          <PlayerChip key={p.id} player={p} isMe={p.id === me} turn={live && round?.currentId === p.id} wins={match.scores[p.id]?.wins ?? 0} online={p.isBot || room.presence.has(p.id)} />
        ))}
      </div>

      {/* BOARD: as big as the space allows, never distorted */}
      <div className="mt-2 flex min-h-0 flex-1 items-center justify-center [container-type:size]">
        <motion.div
          style={{ width: `min(100cqw, calc(100cqh * ${ratio.toFixed(4)}))` }}
          animate={myTurn ? { filter: ["drop-shadow(0 0 0px #ffcf4a00)", "drop-shadow(0 0 14px #ffcf4a55)", "drop-shadow(0 0 0px #ffcf4a00)"] } : { filter: "drop-shadow(0 0 0px #ffcf4a00)" }}
          transition={myTurn ? { duration: 1.8, repeat: Infinity } : undefined}
        >
          {round && (
            <C4Board
              cols={cols}
              rows={rows}
              columns={round.columns}
              colorOf={(id) => byId.get(id)?.color ?? "red"}
              lastDropN={lastDropN}
              win={winLine}
              interactive={myTurn && !busy}
              action={mode}
              canPopCol={(c) => !!me && canPop(round.columns, c, me)}
              myColor={meP?.color ?? null}
              onColumn={drop}
              roundKey={round.id}
            />
          )}
        </motion.div>
      </div>

      {/* STATUS / CONTROLS — or the round result card */}
      <div className="shrink-0 pt-1.5 pb-1">
        {showRoundCard && lastResult ? (
          <RoundCard
            result={lastResult}
            state={state}
            me={me}
            secondsLeft={state.phaseEndsAt !== null ? Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)) : null}
            canAdvance={isHost && phase === "C4_ROUND_RESULTS"}
            onNext={() => send({ type: "NEXT_ROUND" })}
            final={phase === "C4_MATCH_RESULTS"}
            onContinue={() => setFinalAck(match.id)}
          />
        ) : (
          <div className="grid gap-1.5">
            <div className="flex min-h-[26px] items-center justify-center gap-2 text-center text-sm font-extrabold tracking-wide" data-testid="c4-status">
              <span className="truncate" style={{ color: current && !myTurn ? PLAYER_STYLE[current.color].light : "#ffcf4a" }}>
                {status}
              </span>
              {live && <Timer deadline={round?.deadlineAt} now={now} />}
            </div>
            {popout && me && (
              <Segmented
                value={mode}
                onChange={(v) => setAction(v)}
                options={[
                  { value: "drop" as const, label: `⬇ ${t("c4_drop")}` },
                  { value: "pop" as const, label: `⏏ ${t("c4_pop")}` },
                ]}
                cols="grid-cols-2"
                testId="c4-action"
              />
            )}
          </div>
        )}
      </div>

      {phase === "C4_STARTING" && state.phaseEndsAt !== null && <Intro phaseEndsAt={state.phaseEndsAt} now={now} />}
      <AnimatePresence>{showRoundCard && winner && lastResult && <Confetti key={`${match.id}-${lastResult.roundNumber}`} color={winner.color} seed={`${match.id}${lastResult.roundNumber}`} />}</AnimatePresence>

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

