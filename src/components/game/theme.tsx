import type { PlayerColor } from "@/game-engine";

/** Colors are gameplay identity; every color also has a shape so color is never the only cue. */
export const PLAYER_STYLE: Record<PlayerColor, { base: string; light: string; dark: string; text: string; glow: string }> = {
  blue: { base: "#2f6fed", light: "#7aa5ff", dark: "#173e94", text: "#ffffff", glow: "rgba(90,140,255,.55)" },
  green: { base: "#1f9d57", light: "#66d796", dark: "#0c5a30", text: "#ffffff", glow: "rgba(70,210,130,.5)" },
  red: { base: "#e0413b", light: "#ff8a82", dark: "#8c1c18", text: "#ffffff", glow: "rgba(255,110,100,.5)" },
  yellow: { base: "#f4b400", light: "#ffdb6e", dark: "#9c6b00", text: "#2a1d00", glow: "rgba(255,210,70,.55)" },
};

export function ColorIcon({ color, size = 12, className = "" }: { color: PlayerColor; size?: number; className?: string }) {
  const fill = PLAYER_STYLE[color].light;
  const common = { width: size, height: size, viewBox: "0 0 24 24", className, "aria-hidden": true } as const;
  switch (color) {
    case "blue":
      return (
        <svg {...common}>
          <path d="M12 2 22 12 12 22 2 12Z" fill={fill} />
        </svg>
      );
    case "green":
      return (
        <svg {...common}>
          <path d="M12 3 22 21H2Z" fill={fill} />
        </svg>
      );
    case "red":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="10" fill={fill} />
        </svg>
      );
    case "yellow":
      return (
        <svg {...common}>
          <path d="m12 2 2.9 6.6 7.1.6-5.4 4.7 1.6 7L12 17.3 5.8 21l1.6-7L2 9.2l7.1-.6Z" fill={fill} />
        </svg>
      );
  }
}
