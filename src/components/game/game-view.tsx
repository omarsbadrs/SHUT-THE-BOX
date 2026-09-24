"use client";

import { AnimatePresence, motion } from "motion/react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  calculateOpenTileScore,
  canRoll,
  canSelect,
  getPlayer,
  getValidCombinations,
  HINTS_PER_ROUND_LIMITED,
  isTurnBased,
  oneDieAvailable,
  rateMoves,
  roundLabel,
  TIMING,
  type Command,
  type HistoryEntry,
  type PlayerColor,
  type RoomState,
} from "@/game-engine";
import { haptic, sfx, unlockAudio } from "@/lib/client/feedback";
import { setPrefs, usePrefs } from "@/lib/client/prefs";
import type { RoomHandle } from "@/lib/client/use-room";
import { useI18n } from "@/lib/i18n/context";
import { useErrorText, useServerNow, useToast } from "../ui/hooks";
import { GameButton, Toast } from "../ui/primitives";
import { Board } from "./board";
import { Die } from "./dice";
import { GameMenu } from "./menu";
import { Opponents } from "./opponents";
import { BlockedOverlay, ConnectionBanner, MatchIntro, PausedOverlay, RoundSetupBanner, ShutBoxCelebration } from "./overlays";
import { MatchResultsView, RoundResultsPanel } from "./results";
import { TableView } from "./table-view";
import { PLAYER_STYLE } from "./theme";

const FINAL_ROUND_PANEL_MS = 4500;

function Countdown({ deadline, now, testId }: { deadline: number | null; now: number; testId?: string }) {
  const { t } = useI18n();
  if (deadline === null) return null;
  const secs = Math.max(0, Math.ceil((deadline - now) / 1000));
  const urgent = secs <= 5;
  return (
    <span data-testid={testId} className={`rounded-full px-2.5 py-0.5 text-sm font-extrabold tabular-nums ${urgent ? "animate-pulse bg-[#e0413b] text-white" : "bg-black/35 text-white/80"}`}>
      ⏱ {t("timeLeft", { n: secs })}
    </span>
  );
}

function lastAction(state: RoomState): HistoryEntry | null {
  for (let i = state.history.length - 1; i >= 0; i--) {
    const h = state.history[i];
    if (h.kind === "round") return null;
    if (h.kind === "close" || h.kind === "blocked" || h.kind === "skip") return h;
  }
  return null;
}

export function GameView({ room }: { room: RoomHandle }) {
  const { t, n } = useI18n();
  const router = useRouter();
  const prefs = usePrefs();
  const state = room.state as RoomState; // RoomClient only renders this view for SHUT10 rooms
  const me = room.me;
  const match = state.match!;
  const round = match.round;
  const settings = match.settings;
  const now = useServerNow(250);
  const toast = useToast();
  const errText = useErrorText();

  const myPlayer = getPlayer(state, me);
  const myRound = me ? round?.players[me] : undefined;
  const tableMode = room.spectator || !me || prefs.view === "table";
  const diceSize = tableMode ? 42 : 50;
  const isHost = !!me && state.hostId === me;
  const turnBased = isTurnBased(settings.gameMode);
  const pending = myRound?.pending ?? null;
  const turnKey = pending?.turnId ?? null;

  const [selection, setSelection] = useState<{ turn: string | null; tiles: number[] }>({ turn: null, tiles: [] });
  const [hint, setHint] = useState<{ turn: string | null; tiles: number[] }>({ turn: null, tiles: [] });
  const selected = selection.turn === turnKey ? selection.tiles : [];
  const [rollingLocal, setRollingLocal] = useState(false);
  const [busy, setBusy] = useState(false);
  const [diceCount, setDiceCount] = useState<1 | 2>(2);
  const [blocked, setBlocked] = useState<{ key: number; name: string; score: number; isMe: boolean } | null>(null);
  const [shut, setShut] = useState<{ key: number; name: string; color: PlayerColor; isMe: boolean } | null>(null);
  const [banner, setBanner] = useState<{ key: number; text: string } | null>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const [shuffle, setShuffle] = useState(false);
  const [finalAck, setFinalAck] = useState<string | null>(null);

  const send = useCallback(
    async (command: Command) => {
      const res = await room.send(command);
      if (!res.ok) toast.show(errText(res.error));
      return res;
    },
    [room, toast, errText],
  );

  // Presentation side effects (sound, haptics, overlays) as each event is displayed.
  useEffect(
    () =>
      room.subscribe((e, after) => {
        const p = getPlayer(after as RoomState, "playerId" in e ? (e.playerId as string | null) : null);
        switch (e.type) {
          case "DICE_ROLLED":
            if (e.playerId === me) setRollingLocal(false);
            else sfx.diceShake();
            setTimeout(() => sfx.diceLand(), 650);
            break;
          case "TILES_CLOSED":
            e.tiles.forEach((_, i) => sfx.tileFlip(i * 0.09));
            if (e.playerId === me) haptic.close();
            break;
          case "TURN_STARTED":
          case "TURN_CHANGED":
            if (e.playerId === me && e.type === "TURN_CHANGED") {
              sfx.turn();
              haptic.yourTurn();
            }
            break;
          case "EXTRA_TURN":
            setBanner({ key: e.seq, text: `${p?.nickname ?? ""} · ${t("extraTurn")}` });
            break;
          case "TURN_SKIPPED":
            setBanner({ key: e.seq, text: `${p?.nickname ?? ""} · ${t("skipped")}` });
            break;
          case "PLAYER_BLOCKED":
            if (e.reason === "no_move" || e.reason === "timeout") {
              setBlocked({ key: e.seq, name: p?.nickname ?? "", score: e.score, isMe: e.playerId === me });
              sfx.blocked();
              if (e.playerId === me) haptic.blocked();
            }
            break;
          case "PLAYER_SHUT_BOX":
            setShut({ key: e.seq, name: p?.nickname ?? "", color: p?.color ?? "blue", isMe: e.playerId === me });
            sfx.shutTheBox();
            haptic.shutTheBox();
            break;
          case "ROUND_COMPLETED":
            if (me && e.result.winnerIds.includes(me)) {
              sfx.roundWin();
              haptic.roundWin();
            }
            break;
          case "ROUND_STARTED":
            sfx.turn();
            break;
        }
      }),
    [room, me, t],
  );

  useEffect(() => {
    if (!banner) return;
    const id = setTimeout(() => setBanner(null), 1600);
    return () => clearTimeout(id);
  }, [banner]);

  // ── derived UI state ──
  const iCanRoll = canRoll(state, me) && !busy;
  const iCanSelect = canSelect(state, me);
  const sum = selected.reduce((a, b) => a + b, 0);
  const target = pending?.total ?? 0;
  const oneDie = oneDieAvailable(state, me);
  const effectiveDice: 1 | 2 = oneDie ? diceCount : 2;

  const kidsHints = useMemo(() => {
    if (settings.hints !== "all" || !pending || !myRound) return [];
    return [...new Set(getValidCombinations(myRound.openTiles, pending.total).flat())];
  }, [settings.hints, pending, myRound]);
  const hinted = settings.hints === "all" ? kidsHints : hint.turn === turnKey ? hint.tiles : [];

  const toggleTile = (v: number) => {
    if (!iCanSelect) return;
    unlockAudio();
    sfx.select();
    haptic.select();
    setSelection({ turn: turnKey, tiles: selected.includes(v) ? selected.filter((x) => x !== v) : [...selected, v] });
  };

  const doRoll = async () => {
    if (!iCanRoll) return;
    unlockAudio();
    sfx.diceShake();
    haptic.roll();
    setRollingLocal(true);
    setBusy(true);
    const res = await send({ type: "ROLL", diceCount: effectiveDice });
    setBusy(false);
    if (!res.ok) setRollingLocal(false);
  };

  const doClose = async () => {
    if (!pending || sum !== target) return;
    setBusy(true);
    await send({ type: "CLOSE_TILES", turnId: pending.turnId, tiles: [...selected].sort((a, b) => a - b) });
    setBusy(false);
  };

  const doHint = async () => {
    if (!pending || !myRound) return;
    if (settings.hints === "on") {
      const best = rateMoves(myRound.openTiles, pending.total, settings)[0];
      if (best) setHint({ turn: turnKey, tiles: best.tiles });
      return;
    }
    const res = await send({ type: "USE_HINT" });
    if (res.ok && Array.isArray(res.data.tiles)) setHint({ turn: turnKey, tiles: res.data.tiles as number[] });
  };

  const leave = async () => {
    await room.send({ type: "LEAVE" });
    router.push("/");
  };

  // ── phase overlays ──
  const phase = state.phase;
  const starter = getPlayer(state, round?.starterId);
  const introRevealAt = state.phaseEndsAt !== null ? state.phaseEndsAt - TIMING.matchIntroMs + 3600 : 0;
  const hideTiles = phase === "STARTING" && now < introRevealAt;
  const label = roundLabel(state);
  const myScore = calculateOpenTileScore(myRound?.openTiles ?? []);
  const lastRound = match.history[match.history.length - 1];
  const showFinalRound = phase === "MATCH_RESULTS" && match.result?.reason === "completed" && !!lastRound && finalAck !== match.id && now - match.result.endedAt < FINAL_ROUND_PANEL_MS;
  const resultPlayers = state.players.filter((p) => match.playerIds.includes(p.id));

  if (phase === "MATCH_RESULTS" && match.result && !showFinalRound) {
    return (
      <MatchResultsView
        players={resultPlayers}
        stats={match.stats}
        result={match.result}
        settings={settings}
        isHost={isHost}
        onRematch={() => send({ type: "REMATCH", shuffleColors: shuffle })}
        onLobby={() => send({ type: "BACK_TO_LOBBY" })}
        onNewRoom={() => router.push("/create")}
        onExit={leave}
        shuffle={shuffle}
        setShuffle={setShuffle}
        shareUrl={typeof window !== "undefined" ? `${window.location.origin}/results/${match.id}` : null}
      />
    );
  }

  // ── status area ──
  const focusId = turnBased ? round?.currentPlayerId ?? null : me;
  const focus = focusId ? round?.players[focusId] : undefined;
  const focusPlayer = getPlayer(state, focusId);
  const focusPending = focus?.pending ?? null;
  const act = lastAction(state);
  const actPlayer = getPlayer(state, act?.playerId);
  const actRoll = act?.playerId ? round?.players[act.playerId]?.last : null;
  const myTurn = !!me && myRound?.status === "active" && (!turnBased || round?.currentPlayerId === me);
  const diceColor = focusPlayer?.color ?? myPlayer?.color ?? "blue";

  const lastLine =
    act && actPlayer ? (
      <div className="text-xs font-bold text-white/60" data-testid="last-action">
        {act.kind === "close" && actRoll?.closed
          ? `${t("closed", { name: actPlayer.nickname.toUpperCase() })} ${actRoll.closed.map((x) => n(x)).join(" + ")}`
          : act.kind === "blocked"
            ? `${actPlayer.nickname} · ${t("blocked")}`
            : `${actPlayer.nickname} · ${t("skipped")}`}
      </div>
    ) : null;

  let status: React.ReactNode = null;
  if (phase === "PLAYER_TURN" || phase === "AWAITING_TILE_SELECTION") {
    const showDice = rollingLocal || !!focusPending;
    const dice = focusPending;
    if (showDice) {
      const isMine = focusId === me;
      const checking = !!dice && dice.validCount === 0;
      status = (
        <div className="flex flex-col items-center gap-1.5" data-testid="dice-area">
          <div className="text-[10px] font-extrabold tracking-[0.25em] text-white/60">
            {isMine || rollingLocal ? t("yourRoll") : t("rolled", { name: focusPlayer?.nickname.toUpperCase() ?? "" })}
          </div>
          <div className="flex items-center gap-3">
            <Die value={dice?.die1 ?? 1} color={rollingLocal ? myPlayer?.color ?? diceColor : diceColor} rollKey={dice?.turnId ?? null} shaking={rollingLocal && !dice} size={diceSize} testId="die-1" />
            {(rollingLocal ? effectiveDice === 2 : dice?.die2 !== null) && (
              <>
                <span className="text-2xl font-extrabold text-white/50">+</span>
                <Die value={dice?.die2 ?? 1} color={rollingLocal ? myPlayer?.color ?? diceColor : diceColor} rollKey={dice?.turnId ?? null} shaking={rollingLocal && !dice} size={diceSize} testId="die-2" />
              </>
            )}
            {dice && (
              <motion.div key={dice.turnId} initial={{ scale: 0, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.75 }} className="ms-2 flex flex-col items-center">
                <span className="text-[10px] font-extrabold tracking-widest text-white/60">{t("total")}</span>
                <span className="text-4xl leading-none font-extrabold text-[#ffcf4a]" data-testid="dice-total">
                  {n(dice.total)}
                </span>
              </motion.div>
            )}
          </div>
          {dice && (
            <motion.div key={`p-${dice.turnId}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.8 }} className="flex flex-wrap items-center justify-center gap-x-2 gap-y-1 text-center">
              {checking ? (
                <span className="animate-pulse text-sm font-extrabold tracking-wider text-white/80">{t("checkingMoves")}</span>
              ) : isMine ? (
                <>
                  <span className="text-sm font-extrabold tracking-wide" data-testid="choose-prompt">
                    {t("chooseTiles", { total: dice.total })}
                  </span>
                  <Countdown deadline={focus?.deadlineAt ?? null} now={now} testId="move-timer" />
                </>
              ) : (
                <>
                  <span className="text-sm font-bold text-white/70">
                    {dice.die2 !== null ? `${n(dice.die1)} + ${n(dice.die2)} = ${n(dice.total)}` : `${n(dice.die1)} = ${n(dice.total)}`}
                  </span>
                  <span className="text-xs font-extrabold tracking-wider text-white/60">{t("isChoosing", { name: focusPlayer?.nickname.toUpperCase() ?? "" })}</span>
                </>
              )}
            </motion.div>
          )}
        </div>
      );
    } else if (myTurn) {
      status = (
        <div className="flex flex-col items-center gap-2" data-testid="your-turn">
          <motion.div
            initial={{ scale: 0.7, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            className="text-4xl font-extrabold tracking-wide drop-shadow-[0_5px_0_rgba(0,0,0,.4)]"
            style={{ color: myPlayer ? PLAYER_STYLE[myPlayer.color].light : "#ffcf4a" }}
          >
            {t("yourTurn")}
          </motion.div>
          <Countdown deadline={myRound?.deadlineAt ?? null} now={now} testId="roll-timer" />
          {lastLine}
        </div>
      );
    } else if (focusPlayer && turnBased) {
      status = (
        <div className="flex flex-col items-center gap-2" data-testid="waiting-turn">
          <div className="text-center text-xl leading-tight font-extrabold tracking-wide" style={{ color: PLAYER_STYLE[focusPlayer.color].light }}>
            {t("isRolling", { name: focusPlayer.nickname.toUpperCase() })}
          </div>
          <Countdown deadline={focus?.deadlineAt ?? null} now={now} />
          {lastLine}
        </div>
      );
    } else {
      status = <div className="text-center text-sm font-bold text-white/60">{lastLine}</div>;
    }
  }

  const myStatusNote =
    myRound && (myRound.status === "blocked" || myRound.status === "out") && phase !== "ROUND_RESULTS" ? (
      <div className="text-center text-xs font-extrabold tracking-wider text-[#ff8a82]">{t("youAreBlocked")}</div>
    ) : null;

  const reconnectingName = state.players.find((p) => p.connection === "reconnecting" && p.id !== me && match.playerIds.includes(p.id))?.nickname ?? null;
  // Keep the whole game on one phone screen: the board shrinks to the height left over.
  const opponentCount = match.playerIds.filter((id) => id !== me).length;
  const boardReserve = 300 + opponentCount * 58;
  const hintsLeft = settings.hints === "limited" ? Math.max(0, HINTS_PER_ROUND_LIMITED - (myRound?.hintsUsed ?? 0)) : null;

  const statusBlock = (
    <>
      {status}
      {myStatusNote}
      <AnimatePresence>
        {banner && (
          <motion.div key={banner.key} initial={{ y: 10, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ opacity: 0 }} className="absolute bottom-1 rounded-full bg-[#ffcf4a] px-3 py-1 text-xs font-extrabold text-[#2a1a00]">
            {banner.text}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );

  return (
    <div
      className={`mx-auto flex w-full max-w-[520px] flex-col px-3 safe-top safe-bottom ${tableMode ? "h-dvh overflow-hidden" : "min-h-dvh"}`}
      data-testid="game-view"
      data-phase={phase}
      data-view={tableMode ? "table" : "players"}
    >
      <Toast message={toast.message} />
      {/* TOP BAR */}
      <header className="mb-1.5 flex items-center gap-2">
        <span className="glass rounded-xl px-2.5 py-1.5 text-xs font-extrabold tracking-[0.2em]" data-testid="room-code">
          {state.code}
        </span>
        <span className="flex-1 text-center text-sm font-extrabold tracking-wider text-[#ffcf4a]" data-testid="round-label">
          {label.total ? t("roundOf", { n: label.current, total: label.total }) : t("roundN", { n: label.current })}
        </span>
        {me && !room.spectator ? (
          <span className="glass rounded-xl px-2.5 py-1 text-center leading-tight" title={t("openTileScore")}>
            <span className="block text-[9px] font-bold tracking-wider text-white/60">{t("score")}</span>
            <span className="block text-lg font-extrabold tabular-nums" data-testid="my-score">
              {n(myScore)}
            </span>
          </span>
        ) : (
          <span className="rounded-xl bg-white/10 px-2 py-1 text-xs font-extrabold">{t("spectating")}</span>
        )}
        <button
          type="button"
          aria-label={tableMode ? t("playerView") : t("tableView")}
          title={tableMode ? t("playerView") : t("tableView")}
          onClick={() => setPrefs({ view: tableMode ? "players" : "table" })}
          className="glass flex h-10 w-10 items-center justify-center rounded-xl"
          data-testid="view-toggle"
        >
          {tableMode ? (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden>
              <path d="M4 6h16M4 12h16M4 18h16" />
            </svg>
          ) : (
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" aria-hidden>
              <rect x="3" y="3" width="18" height="18" rx="3" />
              <rect x="8.5" y="8.5" width="7" height="7" rx="1.5" />
            </svg>
          )}
        </button>
        <button type="button" aria-label={t("settings")} onClick={() => setMenuOpen(true)} className="glass h-10 w-10 rounded-xl text-lg" data-testid="menu-button">
          ⚙
        </button>
      </header>

      <ConnectionBanner net={room.net} restoredAt={room.restoredAt} reconnectingName={reconnectingName} />

      {tableMode ? (
        /* TABLE: fills the height left over; dice + turn status sit in the center tray */
        <div className="min-h-0 flex-1 pb-1.5">
          <TableView state={state} me={room.spectator ? null : me} presence={room.presence} center={statusBlock} />
        </div>
      ) : (
        <>
          <Opponents state={state} me={me} presence={room.presence} />
          <div className="relative flex min-h-[100px] flex-1 flex-col items-center justify-center gap-1 py-2">{statusBlock}</div>
        </>
      )}

      {/* MY BOARD */}
      {myPlayer && myRound && !room.spectator && (
        <div
          className="mx-auto mb-2 w-full shrink-0"
          style={{ maxWidth: tableMode ? "min(100%, calc(28dvh * 2.1))" : `min(100%, calc((100dvh - ${boardReserve}px) * 1.8))` }}
        >
          <Board
            color={myPlayer.color}
            openTiles={hideTiles ? [] : myRound.openTiles}
            selected={selected}
            hinted={hinted}
            interactive={iCanSelect && !busy}
            onToggle={toggleTile}
            active={myTurn && (phase === "PLAYER_TURN" || phase === "AWAITING_TILE_SELECTION")}
          />
        </div>
      )}

      {/* ACTIONS */}
      {me && !room.spectator && (
        <div className="min-h-[64px] shrink-0 pb-1">
          {iCanSelect && pending ? (
            <div className="grid gap-2">
              <div className="flex items-center justify-center gap-2 text-center text-sm font-extrabold" data-testid="selection-readout">
                {selected.length === 0 ? (
                  <span className="text-white/60">{t("selected", { sum: 0, total: target })}</span>
                ) : sum === target ? (
                  <span className="text-emerald-300">
                    {[...selected].sort((a, b) => a - b).map((x) => n(x)).join(" + ")} = {n(target)} ✓
                  </span>
                ) : sum > target ? (
                  <span className="text-[#ff8a82]">
                    {n(sum)} / {n(target)} · {t("tooHigh")}
                  </span>
                ) : (
                  <span className="text-white/80">{t("selected", { sum, total: target })}</span>
                )}
              </div>
              <div className="flex gap-2">
                {(settings.hints === "on" || settings.hints === "limited") && (
                  <GameButton variant="dark" size="lg" className="w-24 shrink-0 flex-col !gap-0 text-sm" onClick={doHint} disabled={hintsLeft === 0} data-testid="hint">
                    💡 {t("hint")}
                    {hintsLeft !== null && <span className="text-[10px] opacity-70">{t("hintsLeft", { n: hintsLeft })}</span>}
                  </GameButton>
                )}
                <GameButton variant="green" className="flex-1" disabled={sum !== target || busy} onClick={doClose} data-testid="close-tiles">
                  {t("closeTiles")}
                </GameButton>
              </div>
            </div>
          ) : iCanRoll || (rollingLocal && busy) ? (
            <div className="grid gap-2">
              {oneDie && (
                <div className="flex justify-center gap-2">
                  {([2, 1] as const).map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDiceCount(c)}
                      className={`rounded-full px-3 py-1 text-xs font-extrabold ${diceCount === c ? "bg-[#ffcf4a] text-[#2a1a00]" : "bg-white/10"}`}
                    >
                      {c === 2 ? t("twoDiceToggle") : t("oneDieToggle")}
                    </button>
                  ))}
                </div>
              )}
              <GameButton className="w-full text-2xl" onClick={doRoll} disabled={!iCanRoll} data-testid="roll-button">
                🎲 {busy ? t("rolling") : t("rollDice")}
              </GameButton>
            </div>
          ) : null}
        </div>
      )}

      {/* OVERLAYS */}
      {phase === "STARTING" && state.phaseEndsAt !== null && <MatchIntro phaseEndsAt={state.phaseEndsAt} starter={starter} isMe={starter?.id === me} />}
      <AnimatePresence>
        {phase === "ROUND_SETUP" && round && <RoundSetupBanner key={round.id} round={round.number} starter={starter} isMe={starter?.id === me} total={label.total} />}
      </AnimatePresence>
      <AnimatePresence>{blocked && <BlockedOverlay key={blocked.key} name={blocked.name} score={blocked.score} isMe={blocked.isMe} onDone={() => setBlocked(null)} />}</AnimatePresence>
      <AnimatePresence>{shut && <ShutBoxCelebration key={shut.key} name={shut.name} color={shut.color} isMe={shut.isMe} onDone={() => setShut(null)} />}</AnimatePresence>
      {(phase === "ROUND_RESULTS" || showFinalRound) && lastRound && !shut && (
        <RoundResultsPanel
          result={lastRound}
          players={resultPlayers}
          stats={match.stats}
          settings={settings}
          secondsLeft={state.phaseEndsAt !== null ? Math.max(0, Math.ceil((state.phaseEndsAt - now) / 1000)) : null}
          canAdvance={isHost && !showFinalRound}
          onNext={() => send({ type: "NEXT_ROUND" })}
          matchOver={showFinalRound}
        />
      )}
      {showFinalRound && (
        <button type="button" className="fixed inset-x-0 bottom-3 z-40 mx-auto w-fit rounded-full bg-[#ffcf4a] px-5 py-2 font-extrabold text-[#2a1a00]" onClick={() => setFinalAck(match.id)}>
          {t("continue")} →
        </button>
      )}
      {state.paused && <PausedOverlay by={getPlayer(state, state.paused.by)?.nickname ?? ""} canResume={isHost} onResume={() => send({ type: "RESUME" })} />}

      <GameMenu
        open={menuOpen}
        onClose={() => setMenuOpen(false)}
        state={state}
        me={me}
        isHost={isHost}
        devTools={!!room.config?.devTools}
        send={(c) => void send(c)}
        onLeave={leave}
      />
    </div>
  );
}
