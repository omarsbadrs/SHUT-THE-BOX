"use client";

import { motion } from "motion/react";
import type { C4MatchResult, C4RoundResult, C4Score, Connect4Settings } from "@/games/connect4";
import { BOARD_DIMS } from "@/games/connect4";
import { useI18n } from "@/lib/i18n/context";
import { Avatar } from "../game/player-badge";
import { ResultActions, type ResultPlayer } from "../game/results";
import { PLAYER_STYLE } from "../game/theme";
import { GameButton } from "../ui/primitives";
import { ResultsFrame, StatsGrid, WinnerHero } from "../ui/results-frame";
import { MiniBoard } from "./board";
import { Disc, DISC } from "./disc";

/** Final Connect 4 results: live at the end of a duel and on the shareable /results page. */
export function Connect4MatchResultsView({
  players,
  playerIds,
  scores,
  result,
  history,
  settings,
  isHost,
  onRematch,
  onLobby,
  onNewRoom,
  onExit,
  shareUrl,
}: {
  players: ResultPlayer[];
  playerIds: string[];
  scores: Record<string, C4Score>;
  result: C4MatchResult;
  history: C4RoundResult[];
  settings: Connect4Settings;
  isHost: boolean;
  onRematch?: () => void;
  onLobby?: () => void;
  onNewRoom: () => void;
  onExit: () => void;
  shareUrl: string | null;
}) {
  const { t, n } = useI18n();
  const byId = new Map(players.map((p) => [p.id, p]));
  const winners = result.winnerIds.map((id) => byId.get(id)).filter(Boolean) as ResultPlayer[];
  const names = winners.map((w) => w.nickname).join(" & ") || "—";
  const ordered = result.standings.filter((s) => byId.has(s.playerId));
  const colorOf = (id: string) => DISC[byId.get(id)?.color ?? "red"]?.base ?? DISC.red.base;
  const snapColors: [string, string] = [colorOf(playerIds[0]), colorOf(playerIds[1])];
  const rows = BOARD_DIMS[settings.boardSize].rows;
  // Skip the empty round left behind when the host ends the match early.
  const played = history.filter((r) => !(r.outcome === "abandoned" && r.moves === 0));

  const hero = (
    <WinnerHero
      art={
        <motion.div initial={{ y: -40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} transition={{ type: "spring", stiffness: 260, damping: 12 }} className="flex h-[clamp(48px,11dvh,96px)] items-end gap-1">
          {(winners[0] ? [winners[0].color, winners[0].color, winners[0].color, winners[0].color] : ["red", "yellow", "red", "yellow"]).map((c, i) => (
            <motion.div key={i} initial={{ y: -30 }} animate={{ y: 0 }} transition={{ delay: 0.15 + i * 0.1, type: "spring", stiffness: 400, damping: 12 }}>
              <Disc color={c} className="h-[clamp(22px,5dvh,40px)] w-[clamp(22px,5dvh,40px)]" />
            </motion.div>
          ))}
        </motion.div>
      }
      label={winners.length > 1 ? t("winners") : t("winner")}
      name={names}
      color={winners[0] ? PLAYER_STYLE[winners[0].color].light : "#ffcf4a"}
      note={result.reason !== "completed" ? (result.reason === "host_ended" ? t("matchEndedByHost") : t("notEnoughPlayersLeft")) : `${t(`mode_${settings.gameMode}`)} · ${settings.boardSize.replace("x", "×")}`}
    />
  );

  const standingsTab = (
    <ol className="grid gap-1.5">
      {ordered.map((s) => {
        const p = byId.get(s.playerId)!;
        return (
          <li key={s.playerId} className={`flex items-center gap-3 rounded-2xl px-3 py-[clamp(3px,1.1dvh,8px)] ${s.rank === 1 ? "bg-[#ffcf4a]/12 ring-1 ring-[#ffcf4a]/50" : "bg-white/5"}`} data-testid={`c4-standing-${p.color}`}>
            <span className="w-6 text-center text-xl font-extrabold text-white/60">{n(s.rank)}</span>
            <Avatar player={p} size={32} />
            <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{p.nickname}</span>
            <Disc color={p.color} className="h-5 w-5" />
            <span className="text-sm font-bold text-white/70">{t("c4_wins", { n: s.wins })}</span>
          </li>
        );
      })}
    </ol>
  );

  const rowsDef: Array<[string, (s: C4Score) => string]> = [
    [t("c4_stat_wins"), (s) => n(s.wins)],
    [t("c4_stat_draws"), (s) => n(s.draws)],
    [t("c4_stat_discs"), (s) => n(s.discs)],
    ...(settings.gameMode === "c4_popout" ? ([[t("c4_stat_pops"), (s: C4Score) => n(s.pops)]] as Array<[string, (s: C4Score) => string]>) : []),
    [t("c4_stat_fastest"), (s) => (s.fastestWin === null ? "—" : n(s.fastestWin))],
  ];
  const statsTab = (
    <StatsGrid
      columns={ordered.map((s) => {
        const p = byId.get(s.playerId)!;
        return {
          id: p.id,
          head: (
            <span className="flex min-w-0 flex-col items-center gap-0.5">
              <Avatar player={p} size={22} />
              <span className="max-w-full truncate text-[10px] font-extrabold" style={{ color: PLAYER_STYLE[p.color].light }}>
                {p.nickname}
              </span>
            </span>
          ),
        };
      })}
      rows={rowsDef.map(([label, fn]) => ({ label, values: Object.fromEntries(ordered.map((s) => [s.playerId, scores[s.playerId] ? fn(scores[s.playerId]) : "—"])) }))}
    />
  );

  // The final board of every round, with the winning line outlined.
  const roundsTab = (
    <div className={`grid h-full content-start gap-2 ${played.length > 2 ? "grid-cols-3" : "grid-cols-2"}`} data-testid="c4-rounds">
      {played.slice(0, 9).map((r) => {
        const w = r.winnerId ? byId.get(r.winnerId) : undefined;
        return (
          <div key={r.roundNumber} className="flex min-w-0 flex-col items-center gap-1 rounded-xl bg-white/5 p-1.5">
            <MiniBoard snapshot={r.snapshot} rows={rows} colors={snapColors} line={r.line} className="w-full" />
            <span className="max-w-full truncate text-[11px] font-extrabold" style={{ color: w ? PLAYER_STYLE[w.color].light : undefined }}>
              {n(r.roundNumber)}. {w ? `👑 ${w.nickname}` : r.outcome === "draw" ? t("c4_draw") : "—"}
            </span>
          </div>
        );
      })}
    </div>
  );

  return (
    <ResultsFrame
      testId="c4-match-results"
      hero={hero}
      tabs={[
        { key: "standings", label: t("tab_standings"), content: standingsTab },
        { key: "stats", label: t("tab_stats"), content: statsTab },
        ...(played.length ? [{ key: "rounds", label: t("tab_rounds"), content: roundsTab }] : []),
      ]}
      actions={
        <>
          {onRematch &&
            (isHost ? (
              <GameButton onClick={onRematch} className="[@media(max-height:640px)]:h-12" data-testid="rematch">
                {t("rematch")}
              </GameButton>
            ) : (
              <div className="text-center text-sm font-bold text-white/60">{t("waitingRematch")}</div>
            ))}
          <ResultActions shareText={t("c4_shareText", { name: names })} shareUrl={shareUrl} onNewRoom={onNewRoom} onExit={onExit} onLobby={isHost ? onLobby : undefined} />
        </>
      }
    />
  );
}
