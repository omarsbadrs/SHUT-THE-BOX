"use client";

import { motion } from "motion/react";
import type { PlayerColor } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { PLAYER_STYLE } from "./theme";

export interface TileProps {
  value: number;
  color: PlayerColor;
  closed: boolean;
  selected?: boolean;
  hinted?: boolean;
  interactive?: boolean;
  /** Seconds; used for the sequential rise when a new round opens the board. */
  delay?: number;
  size?: "lg" | "md";
  /** Animate up from a closed pose on mount (round reset). */
  rise?: boolean;
  onTap?: (value: number) => void;
}

/**
 * A hinged wooden tile. The flap pivots on its bottom edge (perspective +
 * rotateX) and falls forward to close, revealing the recessed slot.
 */
export function Tile({ value, color, closed, selected = false, hinted = false, interactive = false, delay = 0, size = "lg", rise = false, onTap }: TileProps) {
  const { n } = useI18n();
  const c = PLAYER_STYLE[color];
  const lifted = selected && !closed;
  const fontSize = size === "lg" ? "clamp(1.5rem, 7.5vw, 2.4rem)" : "clamp(1rem, 4.5vw, 1.4rem)";
  return (
    <motion.button
      type="button"
      data-testid={`tile-${value}`}
      data-state={closed ? "closed" : selected ? "selected" : "open"}
      aria-pressed={selected}
      aria-label={`${value}${closed ? " closed" : ""}`}
      disabled={!interactive || closed}
      onClick={() => onTap?.(value)}
      whileTap={interactive && !closed ? { scale: 0.93 } : undefined}
      className="relative aspect-[4/5] w-full select-none outline-none disabled:cursor-default"
      style={{ perspective: 650 }}
    >
      {/* recessed slot, visible once the flap falls */}
      <div
        className="absolute inset-0 flex items-end justify-center rounded-[10px] pb-[8%] font-extrabold"
        style={{
          background: "linear-gradient(180deg, rgba(0,0,0,.55), rgba(0,0,0,.35))",
          boxShadow: "inset 0 4px 10px rgba(0,0,0,.7), inset 0 -1px 0 rgba(255,255,255,.06)",
          color: "rgba(255,255,255,.14)",
          fontSize: `calc(${fontSize} * .55)`,
        }}
      >
        {n(value)}
      </div>

      <motion.div
        className="preserve-3d absolute inset-0"
        style={{ transformOrigin: "50% 100%" }}
        initial={rise ? { rotateX: -93 } : false}
        animate={{ rotateX: closed ? -93 : 0, y: lifted ? -9 : 0, scale: lifted ? 1.04 : 1 }}
        transition={{ type: "spring", stiffness: closed ? 210 : 320, damping: closed ? 14 : 20, delay: closed ? 0 : delay }}
      >
        {/* front face */}
        <div
          className="backface-hidden absolute inset-0 flex items-center justify-center rounded-[10px] font-extrabold"
          style={{
            color: c.text,
            fontSize,
            textShadow: c.text === "#ffffff" ? "0 2px 0 rgba(0,0,0,.25)" : "0 1px 0 rgba(255,255,255,.4)",
            background: `var(--grain), linear-gradient(180deg, ${c.light} 0%, ${c.base} 55%, ${c.dark} 130%)`,
            boxShadow: lifted
              ? `0 14px 18px -6px rgba(0,0,0,.6), 0 0 0 3px #ffcf4a, 0 0 22px 4px ${c.glow}, inset 0 2px 0 rgba(255,255,255,.45)`
              : `0 5px 0 ${c.dark}, 0 9px 12px -4px rgba(0,0,0,.55), inset 0 2px 0 rgba(255,255,255,.4)`,
          }}
        >
          {n(value)}
          {hinted && !closed && (
            <span className="animate-pulse-ring pointer-events-none absolute inset-0 rounded-[10px]" style={{ ["--ring" as string]: "#ffe08a", boxShadow: "0 0 0 3px #ffe08a" }} />
          )}
        </div>
        {/* back face: dark wood seen when the tile lies flat */}
        <div
          className="backface-hidden absolute inset-0 rounded-[10px]"
          style={{
            transform: "rotateX(180deg)",
            background: `var(--grain), linear-gradient(180deg, #5a3417, #3a200c)`,
            boxShadow: `inset 0 0 0 2px ${c.dark}`,
          }}
        />
      </motion.div>
    </motion.button>
  );
}
