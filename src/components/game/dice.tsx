"use client";

import { motion, useAnimationControls } from "motion/react";
import { useEffect, useRef, useState } from "react";
import type { PlayerColor } from "@/game-engine";
import { PLAYER_STYLE } from "./theme";

const PIPS: Record<number, Array<[number, number]>> = {
  1: [[1, 1]],
  2: [[0, 0], [2, 2]],
  3: [[0, 0], [1, 1], [2, 2]],
  4: [[0, 0], [0, 2], [2, 0], [2, 2]],
  5: [[0, 0], [0, 2], [1, 1], [2, 0], [2, 2]],
  6: [[0, 0], [1, 0], [2, 0], [0, 2], [1, 2], [2, 2]],
};

function Face({ value, color, size }: { value: number; color: PlayerColor; size: number }) {
  const c = PLAYER_STYLE[color];
  const pip = size * 0.17;
  const pipColor = color === "yellow" ? "#2a1d00" : "#ffffff";
  return (
    <div
      className="relative"
      style={{
        width: size,
        height: size,
        borderRadius: size * 0.2,
        background: `radial-gradient(120% 120% at 30% 20%, ${c.light} 0%, ${c.base} 55%, ${c.dark} 110%)`,
        boxShadow: `inset 0 ${size * 0.05}px ${size * 0.08}px rgba(255,255,255,.35), inset 0 -${size * 0.07}px ${size * 0.1}px rgba(0,0,0,.35), 0 ${size * 0.12}px ${size * 0.22}px -${size * 0.05}px rgba(0,0,0,.7)`,
      }}
    >
      {(PIPS[value] ?? []).map(([r, col], i) => (
        <span
          key={i}
          className="absolute rounded-full"
          style={{
            width: pip,
            height: pip,
            top: size * (0.2 + r * 0.3) - pip / 2,
            left: size * (0.2 + col * 0.3) - pip / 2,
            background: pipColor,
            boxShadow: `inset 0 ${pip * 0.15}px ${pip * 0.25}px rgba(0,0,0,.45)`,
          }}
        />
      ))}
    </div>
  );
}

export interface DieProps {
  value: number;
  color: PlayerColor;
  /** Any change starts a tumble that lands on `value`. */
  rollKey: string | number | null;
  /** While true, keep shaking (waiting on the server result). */
  shaking?: boolean;
  size?: number;
  testId?: string;
}

/** Tumbles, then always lands on the server-generated value. */
export function Die({ value, color, rollKey, shaking = false, size = 64, testId }: DieProps) {
  const controls = useAnimationControls();
  const [face, setFace] = useState(value);
  const firstKey = useRef(rollKey);

  useEffect(() => {
    if (!shaking) return;
    const id = setInterval(() => setFace(1 + Math.floor(Math.random() * 6)), 80);
    void controls.start({ rotate: [0, -14, 12, -10, 8, 0], y: [0, -6, 0, -4, 0], transition: { duration: 0.45, repeat: Infinity } });
    return () => clearInterval(id);
  }, [shaking, controls]);

  useEffect(() => {
    if (rollKey === null || rollKey === firstKey.current) {
      setFace(value);
      return;
    }
    firstKey.current = rollKey;
    let frames = 0;
    const id = setInterval(() => {
      frames += 1;
      setFace(1 + Math.floor(Math.random() * 6));
      if (frames >= 8) {
        clearInterval(id);
        setFace(value);
      }
    }, 75);
    void controls.start({
      rotate: [0, 200, 400, 560, 700, 720],
      y: [-40, 8, -18, 4, -4, 0],
      scale: [0.8, 1.1, 0.95, 1.05, 0.98, 1],
      transition: { duration: 0.75, ease: "easeOut" },
    });
    return () => clearInterval(id);
  }, [rollKey, value, controls]);

  return (
    <motion.div animate={controls} data-testid={testId} data-value={value} style={{ width: size, height: size }}>
      <Face value={face} color={color} size={size} />
    </motion.div>
  );
}
