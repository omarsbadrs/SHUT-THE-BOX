"use client";

import { motion } from "motion/react";
import type { PlayerColor } from "@/game-engine";
import { TILE_VALUES } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { PLAYER_STYLE } from "./theme";
import { Tile } from "./tile";

export interface BoardProps {
  color: PlayerColor;
  openTiles: readonly number[];
  selected?: readonly number[];
  hinted?: readonly number[];
  interactive?: boolean;
  onToggle?: (value: number) => void;
  /** Change this to replay the sequential "tiles rise" reset animation. */
  resetKey?: string | number;
  active?: boolean;
  size?: "lg" | "md";
}

/** The player's own board: wooden frame, felt bed, tiles 1–5 over 6–10. */
export function Board({ color, openTiles, selected = [], hinted = [], interactive = false, onToggle, resetKey, active = false, size = "lg" }: BoardProps) {
  const open = new Set(openTiles);
  const glow = PLAYER_STYLE[color].glow;
  return (
    <motion.div
      className="wood relative rounded-[22px] p-[10px]"
      animate={{ boxShadow: active ? `0 0 0 3px ${PLAYER_STYLE[color].light}, 0 0 38px 6px ${glow}, 0 18px 40px -12px rgba(0,0,0,.75)` : "0 18px 40px -12px rgba(0,0,0,.75)" }}
      transition={{ duration: 0.4 }}
    >
      <div className="felt rounded-[14px] px-[4%] pt-[6%] pb-[5%]" data-testid="my-board">
        <div key={resetKey} className="grid grid-cols-5 gap-x-[3.2%] gap-y-[7%]">
          {TILE_VALUES.map((v) => (
            <Tile
              key={v}
              value={v}
              color={color}
              closed={!open.has(v)}
              selected={selected.includes(v)}
              hinted={hinted.includes(v)}
              interactive={interactive}
              onTap={onToggle}
              delay={(v - 1) * 0.06}
              size={size}
              rise={resetKey !== undefined}
            />
          ))}
        </div>
      </div>
    </motion.div>
  );
}

/** Compact strip for opponents: 1 2 X X 5 … */
export function MiniBoard({ color, openTiles, className = "" }: { color: PlayerColor; openTiles: readonly number[]; className?: string }) {
  const { n } = useI18n();
  const c = PLAYER_STYLE[color];
  const open = new Set(openTiles);
  return (
    <div className={`grid grid-cols-10 gap-[3px] ${className}`}>
      {TILE_VALUES.map((v) => {
        const isOpen = open.has(v);
        return (
          <motion.div
            key={v}
            data-testid={`mini-${color}-${v}`}
            data-state={isOpen ? "open" : "closed"}
            initial={false}
            animate={{ rotateX: isOpen ? 0 : -70, opacity: isOpen ? 1 : 0.5 }}
            transition={{ type: "spring", stiffness: 260, damping: 18 }}
            style={{
              transformOrigin: "50% 100%",
              background: isOpen ? `linear-gradient(180deg, ${c.light}, ${c.base})` : "rgba(0,0,0,.45)",
              color: isOpen ? c.text : "rgba(255,255,255,.35)",
              boxShadow: isOpen ? `0 2px 0 ${c.dark}` : "inset 0 1px 3px rgba(0,0,0,.6)",
            }}
            className="flex aspect-[4/5] items-center justify-center rounded-[4px] text-[10px] leading-none font-extrabold"
          >
            {isOpen ? n(v) : "✕"}
          </motion.div>
        );
      })}
    </div>
  );
}
