"use client";

import { motion } from "motion/react";
import { COLORS } from "@/game-engine";
import { PLAYER_STYLE } from "./game/theme";

/** Original wordmark: "SHUT" on colored hinged tiles + "10" in gold. */
export function Logo({ size = 1 }: { size?: number }) {
  const letters = ["S", "H", "U", "T"];
  return (
    <div className="flex items-end justify-center gap-[0.35em]" style={{ fontSize: `${2.6 * size}rem` }} dir="ltr" aria-label="SHUT10">
      {letters.map((l, i) => {
        const c = PLAYER_STYLE[COLORS[i]];
        return (
          <motion.span
            key={l}
            initial={{ rotateX: -100, opacity: 0 }}
            animate={{ rotateX: 0, opacity: 1 }}
            transition={{ type: "spring", stiffness: 200, damping: 14, delay: 0.1 + i * 0.09 }}
            style={{
              transformOrigin: "50% 100%",
              background: `linear-gradient(180deg, ${c.light}, ${c.base} 60%, ${c.dark})`,
              color: c.text,
              boxShadow: `0 0.12em 0 ${c.dark}, 0 0.25em 0.4em -0.1em rgba(0,0,0,.6)`,
              width: "1.05em",
              height: "1.3em",
            }}
            className="flex items-center justify-center rounded-[0.18em] leading-none font-extrabold"
          >
            {l}
          </motion.span>
        );
      })}
      <motion.span
        initial={{ scale: 0, rotate: -20 }}
        animate={{ scale: 1, rotate: -6 }}
        transition={{ type: "spring", stiffness: 260, damping: 12, delay: 0.55 }}
        className="ms-1 leading-none font-extrabold text-[#ffcf4a] drop-shadow-[0_0.08em_0_#8a5a00]"
        style={{ fontSize: "1.25em" }}
      >
        10
      </motion.span>
    </div>
  );
}
