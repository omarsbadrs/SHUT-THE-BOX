"use client";

import type { HangmanSettings, HmMatchResult, HmRoundResult, HmScore } from "@/games/hangman";
import { useI18n } from "@/lib/i18n/context";
import { Avatar } from "../game/player-badge";
import { ResultActions, type ResultPlayer } from "../game/results";
import { PLAYER_STYLE } from "../game/theme";
import { GameButton } from "../ui/primitives";
import { ResultsFrame, StatsGrid, WinnerHero } from "../ui/results-frame";
import { Gallows } from "./gallows";

/** Final Hangman results: live at the end of a match and on the shareable /results page. */
export function HangmanMatchResultsView({
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
  scores: Record<string, HmScore>;
  result: HmMatchResult;
  history: HmRoundResult[];
  settings: HangmanSettings;
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
  const master = settings.gameMode === "hangman_master";
  const ordered = result.standings.filter((s) => byId.has(s.playerId));

  const rows: Array<[string, (s: HmScore) => number]> = [
    [t("hm_stat_words"), (s) => s.wordsSolved],
    [t("hm_stat_letters"), (s) => s.lettersFound],
    [t("hm_stat_wrong"), (s) => s.wrongGuesses],
    ...(master ? ([[t("hm_stat_hangmen"), (s: HmScore) => s.hangmen]] as Array<[string, (s: HmScore) => number]>) : []),
  ];

  const hero = (
    <WinnerHero
      art={
        <div className="chalkboard relative flex h-[clamp(52px,12dvh,120px)] w-[clamp(66px,15dvh,150px)] items-center justify-center rounded-2xl p-1.5">
          <Gallows wrong={settings.lives} lives={settings.lives} state="saved" />
        </div>
      }
      label={winners.length > 1 ? t("winners") : t("winner")}
      name={names}
      color={winners[0] ? PLAYER_STYLE[winners[0].color].light : "#ffcf4a"}
      note={result.reason !== "completed" ? (result.reason === "host_ended" ? t("matchEndedByHost") : t("notEnoughPlayersLeft")) : `${t(`mode_${settings.gameMode}`)} · ${t(`lang_${settings.language}`)}`}
    />
  );

  const standingsTab = (
    <ol className="grid gap-1.5">
      {ordered.map((s) => {
        const p = byId.get(s.playerId)!;
        return (
          <li key={s.playerId} className={`flex items-center gap-3 rounded-2xl px-3 py-[clamp(3px,1.1dvh,8px)] ${s.rank === 1 ? "bg-[#ffcf4a]/12 ring-1 ring-[#ffcf4a]/50" : "bg-white/5"}`} data-testid={`hm-standing-${p.color}`}>
            <span className="w-6 text-center text-xl font-extrabold text-white/60">{n(s.rank)}</span>
            <Avatar player={p} size={32} />
            <span className="min-w-0 flex-1 truncate text-lg font-extrabold">{p.nickname}</span>
            <span className="text-sm font-bold text-white/70">{t("pts", { n: s.points })}</span>
          </li>
        );
      })}
    </ol>
  );

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
      rows={rows.map(([label, fn]) => ({ label, values: Object.fromEntries(ordered.map((s) => [s.playerId, scores[s.playerId] ? n(fn(scores[s.playerId])) : "—"])) }))}
    />
  );

  // Up to 10 words: two columns once there are more than 5 so the list never scrolls.
  const wordsTab = (
    <div className={`chalkboard grid h-full content-start gap-x-3 gap-y-1 rounded-2xl p-2.5 ${history.length > 5 ? "grid-cols-2" : "grid-cols-1"}`} data-testid="hm-words">
      {history.map((r) => {
        const solver = r.solverId ? byId.get(r.solverId) : undefined;
        const icon = r.outcome === "hanged" ? "☠" : r.outcome === "abandoned" || (r.outcome === "race" && !r.solverId) ? "—" : "✓";
        return (
          <div key={r.roundNumber} className="flex min-w-0 items-center gap-1.5 border-b border-white/10 py-1">
            <span className="w-4 shrink-0 text-center text-[11px] font-bold text-white/50">{n(r.roundNumber)}</span>
            <span className="chalk min-w-0 flex-1 truncate text-lg leading-tight" dir={settings.language === "ar" ? "rtl" : "ltr"}>
              {r.word}
            </span>
            <span className={`shrink-0 text-sm ${icon === "☠" ? "text-[#ff9a92]" : icon === "✓" ? "text-emerald-300" : "text-white/40"}`}>{icon}</span>
            {solver && (
              <span className="max-w-[4.5rem] shrink-0 truncate text-[10px] font-extrabold" style={{ color: PLAYER_STYLE[solver.color].light }}>
                {solver.nickname}
              </span>
            )}
          </div>
        );
      })}
    </div>
  );

  return (
    <ResultsFrame
      testId="hm-match-results"
      hero={hero}
      tabs={[
        { key: "standings", label: t("tab_standings"), content: standingsTab },
        { key: "stats", label: t("tab_stats"), content: statsTab },
        ...(history.length ? [{ key: "words", label: t("tab_words"), content: wordsTab }] : []),
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
          <ResultActions shareText={t("hm_shareText", { name: names })} shareUrl={shareUrl} onNewRoom={onNewRoom} onExit={onExit} onLobby={isHost ? onLobby : undefined} />
        </>
      }
    />
  );
}
