"use client";

import { motion } from "motion/react";
import type { GuessWhoSettings, GwMatchResult, GwRoundResult, GwScore } from "@/games/guesswho";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Avatar } from "../game/player-badge";
import { ResultActions, type ResultPlayer } from "../game/results";
import { PLAYER_STYLE } from "../game/theme";
import { GameButton } from "../ui/primitives";
import { ResultsFrame, StatsGrid, WinnerHero } from "../ui/results-frame";
import { CardFace, EyeOfHorus } from "./card";

/** Final Guess Who results: live at the end of a duel and on the shareable /results page. */
export function GuessWhoMatchResultsView({
  players,
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
  scores: Record<string, GwScore>;
  result: GwMatchResult;
  history: GwRoundResult[];
  settings: GuessWhoSettings;
  isHost: boolean;
  onRematch?: () => void;
  onLobby?: () => void;
  onNewRoom: () => void;
  onExit: () => void;
  shareUrl: string | null;
}) {
  const { t, n, lang } = useI18n();
  const byId = new Map(players.map((p) => [p.id, p]));
  const winners = result.winnerIds.map((id) => byId.get(id)).filter(Boolean) as ResultPlayer[];
  const names = winners.map((w) => w.nickname).join(" & ") || "—";
  const ordered = result.standings.filter((s) => byId.has(s.playerId));

  const hero = (
    <WinnerHero
      art={
        <motion.div
          initial={{ scale: 0, rotate: -12 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 12 }}
          className="gold-frame flex h-[clamp(52px,12dvh,110px)] w-[clamp(52px,12dvh,110px)] items-center justify-center rounded-full p-1"
        >
          <div className="lapis flex h-full w-full items-center justify-center rounded-full">
            <EyeOfHorus className="w-[70%]" />
          </div>
        </motion.div>
      }
      label={winners.length > 1 ? t("winners") : t("winner")}
      name={names}
      color={winners[0] ? PLAYER_STYLE[winners[0].color].light : "#ffcf4a"}
      note={result.reason !== "completed" ? (result.reason === "host_ended" ? t("matchEndedByHost") : t("notEnoughPlayersLeft")) : t(`gw_cat_${settings.category}` as MessageKey)}
    />
  );

  const standingsTab = (
    <ol className="grid gap-1.5">
      {ordered.map((s) => {
        const p = byId.get(s.playerId)!;
        return (
          <li
            key={s.playerId}
            className={`flex items-center gap-3 rounded-2xl px-3 py-[clamp(3px,1.1dvh,8px)] ${s.rank === 1 ? "bg-[#ffcf4a]/12 ring-1 ring-[#ffcf4a]/50" : "bg-white/5"}`}
            data-testid={`gw-standing-${p.color}`}
          >
            <span className="w-6 text-center text-xl font-extrabold text-white/60">{n(s.rank)}</span>
            <Avatar player={p} size={32} />
            <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{p.nickname}</span>
            <span className="text-sm font-bold text-white/70">{t("gw_wins", { n: s.wins })}</span>
          </li>
        );
      })}
    </ol>
  );

  const rows: Array<[string, (s: GwScore) => number]> = [
    [t("gw_stat_wins"), (s) => s.wins],
    [t("gw_stat_questions"), (s) => s.questions],
    [t("gw_stat_right"), (s) => s.rightGuesses],
    [t("gw_stat_wrong"), (s) => s.wrongGuesses],
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
      rows={rows.map(([label, fn]) => ({
        label,
        values: Object.fromEntries(ordered.map((s) => [s.playerId, scores[s.playerId] ? n(fn(scores[s.playerId])) : "—"])),
      }))}
    />
  );

  // Each round: who won, and both secret cards (up to 5 rounds fit as rows).
  const roundsTab = (
    <div className="grid h-full content-start gap-1.5" data-testid="gw-rounds">
      {history.map((r) => {
        const w = r.winnerId ? byId.get(r.winnerId) : undefined;
        return (
          <div key={r.roundNumber} className="flex items-center gap-2 rounded-xl bg-white/5 px-2 py-1">
            <span className="w-5 shrink-0 text-center text-xs font-bold text-white/50">{n(r.roundNumber)}</span>
            <div className="flex shrink-0 gap-1">
              {players.map((p) => (r.secrets[p.id] ? <CardFace key={p.id} cardId={r.secrets[p.id]} lang={lang} className="h-[clamp(34px,7dvh,54px)] w-[clamp(26px,5.3dvh,40px)]" /> : null))}
            </div>
            <span className="min-w-0 flex-1 truncate text-sm font-extrabold" style={{ color: w ? PLAYER_STYLE[w.color].light : undefined }}>
              {w ? `👑 ${w.nickname}` : "—"}
            </span>
            <span className="shrink-0 text-[11px] font-bold text-white/50">{r.outcome === "wrong_guess" ? "✕" : r.outcome === "guessed" ? "🎯" : ""}</span>
          </div>
        );
      })}
    </div>
  );

  return (
    <ResultsFrame
      testId="gw-match-results"
      hero={hero}
      tabs={[
        { key: "standings", label: t("tab_standings"), content: standingsTab },
        { key: "stats", label: t("tab_stats"), content: statsTab },
        ...(history.length ? [{ key: "rounds", label: t("tab_rounds"), content: roundsTab }] : []),
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
          <ResultActions shareText={t("gw_shareText", { name: names })} shareUrl={shareUrl} onNewRoom={onNewRoom} onExit={onExit} onLobby={isHost ? onLobby : undefined} />
        </>
      }
    />
  );
}
