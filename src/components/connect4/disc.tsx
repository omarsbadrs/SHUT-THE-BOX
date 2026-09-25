"use client";

import { useId } from "react";
import type { PlayerColor } from "@/game-engine";

/** Disc palettes like the real set: red and yellow plastic with an embossed star. */
export const DISC: Record<string, { base: string; light: string; dark: string }> = {
  red: { base: "#e2352c", light: "#ff7d6e", dark: "#9c1b15" },
  yellow: { base: "#f7c21a", light: "#ffe57a", dark: "#b88200" },
  blue: { base: "#2f6fed", light: "#8ab0ff", dark: "#173e94" },
  green: { base: "#1f9d57", light: "#6ee0a0", dark: "#0c5a30" },
};

const STAR = "M50 26 L56.5 42 L73.8 42.6 L60.2 53.2 L65 70 L50 60.4 L35 70 L39.8 53.2 L26.2 42.6 L43.5 42 Z";

export function Disc({ color, className = "", ghost = false }: { color: PlayerColor | string; className?: string; ghost?: boolean }) {
  const id = useId().replace(/:/g, "");
  const c = DISC[color] ?? DISC.red;
  return (
    <svg viewBox="0 0 100 100" className={className} aria-hidden style={ghost ? { opacity: 0.55 } : undefined}>
      <defs>
        <radialGradient id={`${id}-g`} cx="38%" cy="32%" r="75%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="55%" stopColor={c.base} />
          <stop offset="100%" stopColor={c.dark} />
        </radialGradient>
        <radialGradient id={`${id}-i`} cx="60%" cy="65%" r="70%">
          <stop offset="0%" stopColor={c.light} />
          <stop offset="70%" stopColor={c.base} />
        </radialGradient>
      </defs>
      <circle cx="50" cy="50" r="48" fill={`url(#${id}-g)`} />
      <circle cx="50" cy="50" r="36" fill={`url(#${id}-i)`} stroke={c.dark} strokeOpacity="0.55" strokeWidth="3.5" />
      <path d={STAR} fill={c.dark} fillOpacity="0.28" stroke={c.light} strokeOpacity="0.45" strokeWidth="1.5" strokeLinejoin="round" />
      <ellipse cx="36" cy="28" rx="16" ry="8" fill="#fff" opacity="0.28" transform="rotate(-25 36 28)" />
    </svg>
  );
}
