"use client";

import { motion } from "motion/react";
import type { PlayerRoundState, RoomPlayer, RoomState } from "@/game-engine";
import { calculateOpenTileScore } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { MiniBoard } from "./board";
import { Avatar, ConnectionDot } from "./player-badge";
import { PLAYER_STYLE } from "./theme";

/** One compact row per opponent: identity + stats on the left, live mini board on the right. */
export function OpponentStrip({
  player,
  round,
  isCurrent,
  presence,
  wins,
  isHost,
}: {
  player: RoomPlayer;
  round: PlayerRoundState | undefined;
  isCurrent: boolean;
  presence: boolean;
  wins: number;
  isHost: boolean;
}) {
  const { t, n } = useI18n();
  const open = round?.openTiles ?? [];
  const score = calculateOpenTileScore(open);
  const c = PLAYER_STYLE[player.color];
  let status: string | null = null;
  if (player.connection === "reconnecting") status = t("reconnectingEllipsis");
  else if (player.connection === "offline" || player.connection === "left") status = t(player.connection === "left" ? "left" : "offline");
  else if (round?.status === "blocked") status = t("status_blocked");
  else if (round?.status === "shut") status = t("status_shut");
  else if (round?.status === "out") status = t("status_out");
  else if (isCurrent) status = round?.pending ? `${n(round.pending.total)}…` : "🎲";

  return (
    <motion.div
      layout
      data-testid={`opponent-${player.color}`}
      className="glass relative flex items-center gap-2 rounded-2xl px-2 py-1.5"
      animate={{
        borderColor: isCurrent ? c.light : "rgba(255,255,255,.09)",
        boxShadow: isCurrent ? `0 0 0 1px ${c.light}, 0 0 20px -4px ${c.glow}` : "0 0 0 0 transparent",
      }}
    >
      <Avatar player={player} size={28} />
      <div className="w-[106px] min-w-0 shrink-0 leading-tight">
        <div className="flex items-center gap-1 text-[13px] font-extrabold">
          <span className="truncate">{player.nickname}</span>
          {isHost && <span className="text-[9px]">👑</span>}
          <ConnectionDot status={player.connection} presence={presence} />
        </div>
        <div className="truncate text-[10px] text-white/60">
          {t("closedCount", { n: 10 - open.length })}
          {wins > 0 && <> · 🏆{n(wins)}</>}
        </div>
        <div className="truncate text-[10px] font-bold" style={{ color: c.light }}>
          {t("scoreIfStopped", { n: score })}
        </div>
      </div>
      <MiniBoard color={player.color} openTiles={open} className="min-w-0 flex-1" />
      {status && (
        <span
          className={`absolute -top-1.5 end-2 rounded-full px-1.5 py-px text-[9px] font-extrabold tracking-wide ${
            round?.status === "shut" ? "bg-[#ffcf4a] text-[#2a1a00]" : isCurrent ? "bg-white text-[#10231a]" : "bg-black/70 text-white/80"
          }`}
        >
          {status}
        </span>
      )}
    </motion.div>
  );
}

export function Opponents({ state, me, presence }: { state: RoomState; me: string | null; presence: Set<string> }) {
  const round = state.match?.round;
  const ids = state.match?.playerIds ?? [];
  const players = state.players.filter((p) => ids.includes(p.id) && p.id !== me);
  if (!players.length) return null;
  return (
    <div className="grid gap-1.5" data-testid="opponents">
      {players.map((p) => (
        <OpponentStrip
          key={p.id}
          player={p}
          round={round?.players[p.id]}
          isCurrent={round?.currentPlayerId === p.id && !round.result}
          presence={presence.has(p.id)}
          wins={state.match?.stats[p.id]?.roundWins ?? 0}
          isHost={state.hostId === p.id}
        />
      ))}
    </div>
  );
}
