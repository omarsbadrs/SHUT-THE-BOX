"use client";

import type { PlayerColor, RoomState } from "@/game-engine";
import { calculateOpenTileScore } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { MiniBoard } from "./board";
import { Die } from "./dice";
import { Avatar } from "./player-badge";
import { PLAYER_STYLE } from "./theme";

/** Physical layout: green top, red right, blue bottom, yellow left; central dice tray. */
const SIDES: Record<PlayerColor, { area: string; rotate: number }> = {
  green: { area: "top", rotate: 180 },
  red: { area: "right", rotate: -90 },
  blue: { area: "bottom", rotate: 0 },
  yellow: { area: "left", rotate: 90 },
};

export function TableView({ state }: { state: RoomState }) {
  const { n } = useI18n();
  const round = state.match?.round;
  const players = state.players.filter((p) => state.match?.playerIds.includes(p.id));
  const current = round?.currentPlayerId ? state.players.find((p) => p.id === round.currentPlayerId) : null;
  const shown = current ? round?.players[current.id] : null;
  const dice = shown?.pending ?? shown?.last ?? null;

  const side = (color: PlayerColor) => {
    const p = players.find((x) => x.color === color);
    const s = SIDES[color];
    if (!p) return <div style={{ gridArea: s.area }} />;
    const pr = round?.players[p.id];
    const isCur = current?.id === p.id;
    return (
      <div style={{ gridArea: s.area }} className="flex items-center justify-center">
        <div style={{ transform: `rotate(${s.rotate}deg)` }} className="w-[200px]">
          <div className={`mb-1 flex items-center gap-1.5 text-xs font-extrabold ${isCur ? "text-[#ffcf4a]" : ""}`}>
            <Avatar player={p} size={20} />
            <span className="truncate">{p.nickname}</span>
            <span className="ms-auto tabular-nums" style={{ color: PLAYER_STYLE[p.color].light }}>
              {n(calculateOpenTileScore(pr?.openTiles ?? []))}
            </span>
          </div>
          <MiniBoard color={p.color} openTiles={pr?.openTiles ?? []} />
        </div>
      </div>
    );
  };

  return (
    <div className="wood mx-auto aspect-square w-full max-w-[640px] rounded-[28px] p-3" data-testid="table-view">
      <div
        className="felt grid h-full w-full rounded-[20px]"
        style={{ gridTemplateAreas: `". top ." "left center right" ". bottom ."`, gridTemplateColumns: "1fr 1.3fr 1fr", gridTemplateRows: "1fr 1.3fr 1fr" }}
      >
        {side("green")}
        {side("red")}
        {side("blue")}
        {side("yellow")}
        <div style={{ gridArea: "center" }} className="m-2 flex items-center justify-center gap-3 rounded-2xl bg-black/25 shadow-inner">
          {dice && current ? (
            <>
              <Die value={dice.die1} color={current.color} rollKey={dice.turnId} size={44} />
              {dice.die2 !== null && <Die value={dice.die2} color={current.color} rollKey={dice.turnId} size={44} />}
              <span className="text-2xl font-extrabold">= {n(dice.total)}</span>
            </>
          ) : (
            <span className="text-sm font-bold text-white/40">🎲</span>
          )}
        </div>
      </div>
    </div>
  );
}
