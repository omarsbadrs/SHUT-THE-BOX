"use client";

import { motion } from "motion/react";
import type { GameSettings, MatchPlayerStats, MatchResult, PlayerColor, RoundResult } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { GameButton } from "../ui/primitives";
import { Avatar } from "./player-badge";
import { ColorIcon, PLAYER_STYLE } from "./theme";

export interface ResultPlayer {
  id: string;
  nickname: string;
  avatar: string;
  color: PlayerColor;
}

function standingValue(s: MatchPlayerStats, settings: GameSettings, t: ReturnType<typeof useI18n>["t"], n: (v: number) => string) {
  if (settings.scoringMode === "cumulative_low") return `Σ ${n(s.cumulativeScore)}`;
  if (settings.scoringMode === "match_points") return t("pts", { n: s.matchPoints });
  return t("wins", { n: s.roundWins });
}

export function RoundResultsPanel({
  result,
  players,
  stats,
  settings,
  secondsLeft,
  canAdvance,
  onNext,
  matchOver,
}: {
  result: RoundResult;
  players: ResultPlayer[];
  stats: Record<string, MatchPlayerStats>;
  settings: GameSettings;
  secondsLeft: number | null;
  canAdvance: boolean;
  onNext: () => void;
  matchOver: boolean;
}) {
  const { t, n } = useI18n();
  const byId = new Map(players.map((p) => [p.id, p]));
  const standings = players
    .map((p) => stats[p.id])
    .filter(Boolean)
    .sort((a, b) =>
      settings.scoringMode === "cumulative_low"
        ? a.cumulativeScore - b.cumulativeScore
        : settings.scoringMode === "match_points"
          ? b.matchPoints - a.matchPoints
          : b.roundWins - a.roundWins || a.cumulativeScore - b.cumulativeScore,
    );
  return (
    <motion.div
      className="fixed inset-0 z-30 flex items-end justify-center bg-black/60 sm:items-center"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      data-testid="round-results"
    >
      <motion.div
        initial={{ y: 80 }}
        animate={{ y: 0 }}
        className="safe-bottom w-full max-w-[520px] rounded-t-[28px] border-t border-white/10 bg-[#10231a] px-4 pt-5 sm:rounded-[28px]"
      >
        <div className="text-center">
          <div className="text-xs font-bold tracking-[0.25em] text-white/50">{t("roundN", { n: result.roundNumber })}</div>
          <div className="text-3xl font-extrabold text-[#ffcf4a]">{t("roundResults")}</div>
          <div className="mt-1 text-xs font-bold tracking-wider text-white/60">
            {t("openTileScore")} · {t("lowerIsBetter")}
          </div>
        </div>
        <ol className="mt-4 space-y-2">
          {result.entries.map((e) => {
            const p = byId.get(e.playerId);
            if (!p) return null;
            const winner = result.winnerIds.includes(e.playerId);
            return (
              <li
                key={e.playerId}
                data-testid={`round-result-${p.color}`}
                data-score={e.openTileSum}
                className={`flex items-center gap-3 rounded-2xl px-3 py-2.5 ${winner ? "bg-[#ffcf4a]/15 ring-1 ring-[#ffcf4a]/60" : "bg-white/5"}`}
              >
                <span className="w-6 text-center text-lg font-extrabold text-white/60">{n(e.placement)}</span>
                <Avatar player={p} size={32} />
                <span className="min-w-0 flex-1 truncate font-extrabold">
                  {p.nickname} {winner && "👑"} {e.perfectBox && <span className="ms-1 rounded bg-[#ffcf4a] px-1.5 text-[10px] text-[#2a1a00]">{t("shutTheBox")}</span>}
                </span>
                <span className="text-2xl font-extrabold tabular-nums" style={{ color: PLAYER_STYLE[p.color].light }}>
                  {n(e.openTileSum)}
                </span>
              </li>
            );
          })}
        </ol>
        {standings.length > 0 && (
          <div className="mt-4 rounded-2xl bg-black/25 p-3">
            <div className="mb-2 text-xs font-bold tracking-wider text-white/50 uppercase">{t(`scoring_${settings.scoringMode}`)}</div>
            <div className="flex flex-wrap gap-2">
              {standings.map((s) => (
                <span key={s.playerId} className="inline-flex items-center gap-1.5 rounded-full bg-white/5 px-2.5 py-1 text-sm font-bold">
                  <ColorIcon color={s.color} size={10} />
                  {s.nickname} · {standingValue(s, settings, t, n)}
                </span>
              ))}
            </div>
          </div>
        )}
        {!matchOver && (
          <div className="mt-4 flex items-center gap-3 pb-2">
            <div className="flex-1 text-sm font-bold text-white/60">{secondsLeft !== null && t("nextRoundIn", { n: secondsLeft })}</div>
            {canAdvance && (
              <GameButton size="md" variant="green" onClick={onNext} data-testid="next-round">
                {t("nextRound")}
              </GameButton>
            )}
          </div>
        )}
      </motion.div>
    </motion.div>
  );
}

export function MatchResultsView({
  players,
  stats,
  result,
  settings,
  isHost,
  onRematch,
  onLobby,
  onNewRoom,
  onExit,
  shuffle,
  setShuffle,
  shareUrl,
}: {
  players: ResultPlayer[];
  stats: Record<string, MatchPlayerStats>;
  result: MatchResult;
  settings: GameSettings;
  isHost: boolean;
  onRematch?: () => void;
  onLobby?: () => void;
  onNewRoom: () => void;
  onExit: () => void;
  shuffle?: boolean;
  setShuffle?: (v: boolean) => void;
  shareUrl: string | null;
}) {
  const { t, n } = useI18n();
  const byId = new Map(players.map((p) => [p.id, p]));
  const winners = result.winnerIds.map((id) => byId.get(id)).filter(Boolean) as ResultPlayer[];
  const main = winners[0];

  const share = async () => {
    const text = t("shareResultText", { name: winners.map((w) => w.nickname).join(" & ") || "—" });
    try {
      if (navigator.share) await navigator.share({ title: "SHUT10", text, url: shareUrl ?? undefined });
      else await navigator.clipboard.writeText(`${text} ${shareUrl ?? ""}`.trim());
    } catch {
      // cancelled
    }
  };

  const statRows: Array<[string, (s: MatchPlayerStats) => string]> = [
    [t("stat_roundWins"), (s) => n(s.roundWins)],
    [t("stat_perfect"), (s) => n(s.perfectRounds)],
    [t("stat_avg"), (s) => (s.roundsPlayed ? n((s.cumulativeScore / s.roundsPlayed).toFixed(1)) : "—")],
    [t("stat_best"), (s) => (s.bestRound === null ? "—" : n(s.bestRound))],
    [t("stat_tiles"), (s) => n(s.tilesClosed)],
    [t("stat_rolls"), (s) => n(s.diceRolls)],
    [t("stat_doubles"), (s) => n(s.doubles)],
  ];
  const ordered = result.standings.map((s) => ({ standing: s, player: byId.get(s.playerId), stats: stats[s.playerId] })).filter((x) => x.player && x.stats);

  return (
    <div className="mx-auto flex min-h-dvh w-full max-w-[560px] flex-col px-4 safe-top safe-bottom" data-testid="match-results">
      <div className="relative flex flex-col items-center pt-6 pb-4 text-center">
        <motion.div initial={{ scale: 0, rotate: -20 }} animate={{ scale: 1, rotate: 0 }} transition={{ type: "spring", stiffness: 200, damping: 12 }} className="text-7xl">
          🏆
        </motion.div>
        <div className="mt-2 text-sm font-extrabold tracking-[0.35em] text-white/60">{winners.length > 1 ? t("winners") : t("winner")}</div>
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.25 }}
          className="text-5xl font-extrabold"
          style={{ color: main ? PLAYER_STYLE[main.color].light : "#ffcf4a" }}
          data-testid="match-winner"
        >
          {winners.map((w) => w.nickname).join(" & ") || "—"}
        </motion.div>
        {result.reason !== "completed" && (
          <div className="mt-1 text-xs font-bold text-white/50">{result.reason === "host_ended" ? t("matchEndedByHost") : t("notEnoughPlayersLeft")}</div>
        )}
      </div>

      <div className="text-xs font-bold tracking-wider text-white/50 uppercase">{t("finalStandings")}</div>
      <ol className="mt-2 space-y-2">
        {ordered.map(({ standing, player, stats: s }) => (
          <li key={standing.playerId} className="flex items-center gap-3 rounded-2xl bg-white/5 px-3 py-2.5" data-testid={`standing-${player!.color}`}>
            <span className="w-6 text-center text-xl font-extrabold text-white/60">{n(standing.rank)}</span>
            <Avatar player={player!} size={34} />
            <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{player!.nickname}</span>
            <span className="text-sm font-bold text-white/70">{standingValue(s!, settings, t, n)}</span>
          </li>
        ))}
      </ol>

      <div className="mt-5 text-xs font-bold tracking-wider text-white/50 uppercase">{t("stats")}</div>
      <div className="no-scrollbar mt-2 overflow-x-auto rounded-2xl bg-black/25">
        <table className="w-full min-w-[340px] text-sm">
          <thead>
            <tr className="text-white/60">
              <th className="px-3 py-2 text-start font-bold" />
              {ordered.map(({ player }) => (
                <th key={player!.id} className="px-2 py-2 text-center font-extrabold" style={{ color: PLAYER_STYLE[player!.color].light }}>
                  {player!.nickname}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {statRows.map(([label, fn]) => (
              <tr key={label} className="border-t border-white/5">
                <td className="px-3 py-2 text-white/70">{label}</td>
                {ordered.map(({ player, stats: s }) => (
                  <td key={player!.id} className="px-2 py-2 text-center font-extrabold tabular-nums">
                    {fn(s!)}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div className="mt-auto grid gap-3 pt-6">
        {isHost && onRematch ? (
          <>
            {setShuffle && (
              <label className="flex items-center justify-center gap-2 text-sm font-bold text-white/80">
                <input type="checkbox" checked={!!shuffle} onChange={(e) => setShuffle(e.target.checked)} className="h-4 w-4 accent-[#ffcf4a]" />
                {t("shuffleColors")}
              </label>
            )}
            <GameButton onClick={onRematch} data-testid="rematch">
              {t("rematch")}
            </GameButton>
          </>
        ) : onRematch ? (
          <div className="text-center text-sm font-bold text-white/60">{t("waitingRematch")}</div>
        ) : null}
        <div className="grid grid-cols-2 gap-3">
          <GameButton variant="blue" size="md" onClick={share}>
            {t("shareResult")}
          </GameButton>
          <GameButton variant="dark" size="md" onClick={onNewRoom}>
            {t("newRoom")}
          </GameButton>
        </div>
        <div className="flex justify-center gap-4 pb-2">
          {isHost && onLobby && (
            <button type="button" onClick={onLobby} className="text-sm font-bold text-white/60 underline">
              {t("backToLobby")}
            </button>
          )}
          <button type="button" onClick={onExit} className="text-sm font-bold text-white/60 underline">
            {t("exit")}
          </button>
        </div>
      </div>
    </div>
  );
}
