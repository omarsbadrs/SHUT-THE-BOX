"use client";

import type { ConnectionStatus, PlayerColor, RoomPlayer } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { ColorIcon, PLAYER_STYLE } from "./theme";

export function Avatar({ player, size = 36 }: { player: Pick<RoomPlayer, "avatar" | "color" | "nickname">; size?: number }) {
  const c = PLAYER_STYLE[player.color];
  return (
    <div
      className="relative flex shrink-0 items-center justify-center rounded-full"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.55,
        background: `radial-gradient(circle at 35% 30%, ${c.light}, ${c.base} 60%, ${c.dark})`,
        boxShadow: `0 0 0 2px rgba(0,0,0,.35), 0 3px 8px rgba(0,0,0,.4)`,
      }}
      aria-hidden
    >
      <span className="leading-none">{player.avatar || player.nickname.slice(0, 1).toUpperCase()}</span>
      <span className="absolute -right-1 -bottom-1 rounded-full bg-black/70 p-[2px]">
        <ColorIcon color={player.color} size={Math.max(9, size * 0.3)} />
      </span>
    </div>
  );
}

export function ConnectionDot({ status, presence }: { status: ConnectionStatus; presence?: boolean }) {
  const { t } = useI18n();
  const effective: ConnectionStatus = presence && status !== "left" ? "online" : status;
  const label = t(effective === "online" ? "online" : effective === "reconnecting" ? "reconnecting" : effective === "left" ? "left" : "offline");
  return (
    <span className="inline-flex items-center gap-1 text-[10px] font-semibold opacity-80" title={label}>
      {effective === "online" ? (
        <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_6px_#34d399]" />
      ) : effective === "reconnecting" ? (
        <span className="h-2 w-2 animate-pulse rounded-full border-2 border-amber-300" />
      ) : (
        <span className="h-2 w-2 rounded-full border-2 border-white/40" />
      )}
      <span className="sr-only">{label}</span>
    </span>
  );
}

/** "BLUE • OMAR" — color name + icon + name, never color alone. */
export function ColorName({ color, name }: { color: PlayerColor; name: string }) {
  const { t } = useI18n();
  return (
    <span className="inline-flex items-center gap-1.5 font-extrabold tracking-wide">
      <ColorIcon color={color} size={11} />
      <span style={{ color: PLAYER_STYLE[color].light }}>{t(color)}</span>
      <span className="opacity-50">•</span>
      <span className="truncate">{name}</span>
    </span>
  );
}
