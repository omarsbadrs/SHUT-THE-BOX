"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";
import type { PlayerColor, RoomPlayer, RoomState } from "@/game-engine";
import { calculateOpenTileScore } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { MiniBoard } from "./board";
import { Avatar, ConnectionDot } from "./player-badge";
import { PLAYER_STYLE } from "./theme";

type Side = "top" | "left" | "right" | "bottom";

/** Physical seats walking clockwise from the bottom: Blue, Yellow, Green, Red. */
const CLOCKWISE: PlayerColor[] = ["blue", "yellow", "green", "red"];
const SIDES: Side[] = ["bottom", "left", "top", "right"];

/**
 * Seat map with the viewer at the bottom (like sitting at the real box).
 * Relative order around the table is preserved; with two players the
 * opponent always sits across (top).
 */
function seatMap(players: RoomPlayer[], me: RoomPlayer | undefined): Partial<Record<Side, RoomPlayer>> {
  const map: Partial<Record<Side, RoomPlayer>> = {};
  if (me && players.length === 2) {
    map.bottom = me;
    map.top = players.find((p) => p.id !== me.id);
    return map;
  }
  const start = me ? CLOCKWISE.indexOf(me.color) : 0;
  for (let i = 0; i < 4; i++) {
    const color = CLOCKWISE[(start + i) % 4];
    const p = players.find((x) => x.color === color);
    if (p) map[SIDES[i]] = p;
  }
  return map;
}

function SeatLabel({ player, score, isCurrent, presence, status }: { player: RoomPlayer; score: number; isCurrent: boolean; presence: boolean; status: string | null }) {
  const c = PLAYER_STYLE[player.color];
  return (
    <div className="flex min-w-0 items-center gap-1 text-[11px] leading-tight font-extrabold">
      <Avatar player={player} size={20} />
      <span className="min-w-0 truncate" style={{ color: isCurrent ? "#ffcf4a" : undefined }}>
        {player.nickname}
      </span>
      <ConnectionDot status={player.connection} presence={presence} />
      <span className="tabular-nums" style={{ color: c.light }}>
        {score}
      </span>
      {status && <span className="rounded-full bg-black/50 px-1 text-[8px] tracking-wide text-white/80">{status}</span>}
    </div>
  );
}

export function TableView({
  state,
  me,
  presence,
  center,
}: {
  state: RoomState;
  me: string | null;
  presence: Set<string>;
  /** Dice tray / turn status shown in the middle of the table. */
  center: ReactNode;
}) {
  const { t, n } = useI18n();
  const round = state.match?.round;
  const players = state.players.filter((p) => state.match?.playerIds.includes(p.id));
  const mePlayer = players.find((p) => p.id === me);
  const seats = seatMap(players, mePlayer);
  const showBottom = !mePlayer; // spectators see all four sides; players' own board sits below the table

  const statusOf = (p: RoomPlayer): string | null => {
    const pr = round?.players[p.id];
    if (p.connection === "reconnecting") return "…";
    if (p.connection === "offline" || p.connection === "left") return t(p.connection === "left" ? "left" : "offline");
    if (pr?.status === "blocked") return t("status_blocked");
    if (pr?.status === "shut") return t("status_shut");
    if (pr?.status === "out") return t("status_out");
    return null;
  };

  const seat = (side: Side) => {
    const p = seats[side];
    if (!p || (side === "bottom" && !showBottom)) return null;
    const pr = round?.players[p.id];
    const open = pr?.openTiles ?? [];
    const isCurrent = round?.currentPlayerId === p.id && !round.result;
    const c = PLAYER_STYLE[p.color];
    const vertical = side === "left" || side === "right";
    return (
      <motion.div
        key={side}
        data-testid={`seat-${side}`}
        style={{ gridArea: side }}
        animate={{ boxShadow: isCurrent ? `0 0 0 2px ${c.light}, 0 0 18px -2px ${c.glow}` : "0 0 0 0 transparent" }}
        className={`min-h-0 min-w-0 rounded-xl bg-black/20 p-1.5 ${vertical ? "flex w-[68px] flex-col items-center gap-1" : "mx-auto flex w-full max-w-[320px] flex-col gap-1"}`}
      >
        {vertical ? (
          <>
            <Avatar player={p} size={24} />
            <div className="w-full truncate text-center text-[10px] leading-none font-extrabold" style={{ color: isCurrent ? "#ffcf4a" : undefined }}>
              {p.nickname}
            </div>
            <div className="flex items-center gap-1 text-[10px] leading-none font-extrabold">
              <ConnectionDot status={p.connection} presence={presence.has(p.id)} />
              <span style={{ color: c.light }}>{n(calculateOpenTileScore(open))}</span>
            </div>
            {statusOf(p) && <div className="rounded-full bg-black/50 px-1 text-[8px] font-extrabold">{statusOf(p)}</div>}
            <MiniBoard color={p.color} openTiles={open} vertical className="min-h-0 w-7 flex-1" />
          </>
        ) : (
          <>
            <SeatLabel player={p} score={calculateOpenTileScore(open)} isCurrent={isCurrent} presence={presence.has(p.id)} status={statusOf(p)} />
            <MiniBoard color={p.color} openTiles={open} />
          </>
        )}
      </motion.div>
    );
  };

  const hasLeft = !!seats.left;
  const hasRight = !!seats.right;
  return (
    <div className="wood h-full w-full rounded-[24px] p-2" data-testid="table-view">
      <div
        className="felt grid h-full w-full gap-1.5 rounded-[18px] p-1.5"
        style={{
          gridTemplateAreas: showBottom ? `"top top top" "left center right" "bottom bottom bottom"` : `"top top top" "left center right"`,
          gridTemplateColumns: `${hasLeft ? "auto" : "0px"} minmax(0,1fr) ${hasRight ? "auto" : "0px"}`,
          gridTemplateRows: showBottom ? "auto minmax(0,1fr) auto" : "auto minmax(0,1fr)",
        }}
      >
        {seat("top")}
        {seat("left")}
        {seat("right")}
        {seat("bottom")}
        <div style={{ gridArea: "center" }} className="relative flex min-h-0 min-w-0 flex-col items-center justify-center gap-1 overflow-hidden rounded-2xl bg-black/25 p-2 shadow-inner">
          {center}
        </div>
      </div>
    </div>
  );
}
