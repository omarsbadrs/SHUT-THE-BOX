"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId } from "react";

export type GallowsState = "playing" | "hanged" | "saved";

const CHALK = "#f4f1e8";
const WOOD = "#c79a62";

/** Body parts in drawing order. 6 lives: head → legs. 9 lives adds the face. */
const PARTS = {
  head: "M125 48 a16 16 0 1 1 -0.01 0",
  body: "M125 80 V130",
  armL: "M125 92 L103 115",
  armR: "M125 92 L147 115",
  legL: "M125 130 L107 165",
  legR: "M125 130 L143 165",
  eyeL: "M116 58 L122 64 M122 58 L116 64",
  eyeR: "M128 58 L134 64 M134 58 L128 64",
  frown: "M117 73 Q125 67 133 73",
};
const ORDER_6 = ["head", "body", "armL", "armR", "legL", "legR"] as const;
const ORDER_9 = [...ORDER_6, "eyeL", "eyeR", "frown"] as const;
/** Where a stroke ends — chalk dust puffs there. */
const PART_END: Record<string, [number, number]> = {
  head: [125, 48], body: [125, 130], armL: [103, 115], armR: [147, 115], legL: [107, 165], legR: [143, 165], eyeL: [119, 61], eyeR: [131, 61], frown: [133, 73],
};

const ARMS_UP = { armL: "M125 92 L106 70", armR: "M125 92 L144 70" };
const SMILE = "M117 69 Q125 76 133 69";
const DOT_EYES = "M119 60 h0.1 M131 60 h0.1";

function Stroke({ d, delay = 0, width = 4.5, color = CHALK, filter, duration = 0.55 }: { d: string; delay?: number; width?: number; color?: string; filter?: string; duration?: number }) {
  return (
    <motion.path
      d={d}
      fill="none"
      stroke={color}
      strokeWidth={width}
      strokeLinecap="round"
      strokeLinejoin="round"
      filter={filter}
      initial={{ pathLength: 0, opacity: 0 }}
      animate={{ pathLength: 1, opacity: 0.95 }}
      transition={{ pathLength: { duration, delay, ease: "easeInOut" }, opacity: { duration: 0.05, delay } }}
    />
  );
}

function Dust({ x, y }: { x: number; y: number }) {
  return (
    <g pointerEvents="none">
      {Array.from({ length: 7 }, (_, i) => {
        const a = (i / 7) * Math.PI * 2;
        return (
          <motion.circle
            key={i}
            cx={x}
            cy={y}
            r={1.6}
            fill={CHALK}
            initial={{ opacity: 0.9, cx: x, cy: y }}
            animate={{ opacity: 0, cx: x + Math.cos(a) * 14, cy: y + Math.sin(a) * 14 + 6 }}
            transition={{ duration: 0.8, delay: 0.45, ease: "easeOut" }}
          />
        );
      })}
    </g>
  );
}

export function Gallows({
  wrong,
  lives,
  state,
  mini = false,
  roundKey,
}: {
  wrong: number;
  lives: 6 | 9;
  state: GallowsState;
  mini?: boolean;
  /** Changing it redraws the structure (new round). */
  roundKey?: string | number;
}) {
  const fid = useId().replace(/:/g, "");
  const filter = mini ? undefined : `url(#chalk-${fid})`;
  const order = lives === 9 ? ORDER_9 : ORDER_6;
  const shown = state === "saved" ? ORDER_6.length : Math.min(wrong, order.length);
  const visible = (state === "saved" ? ORDER_6 : order).slice(0, shown);
  const last = visible[visible.length - 1];
  const w = mini ? 7 : 4.5;

  const figure = (
    <>
      {visible.map((part) => {
        if (state === "saved" && (part === "armL" || part === "armR")) return <Stroke key={`${part}-up`} d={ARMS_UP[part]} width={w} filter={filter} duration={0.3} />;
        return <Stroke key={part} d={PARTS[part]} width={w} filter={filter} duration={state === "saved" ? 0.25 : 0.55} />;
      })}
      {state === "hanged" && (
        <>
          {!visible.includes("eyeL") && <Stroke d={PARTS.eyeL} width={w * 0.7} filter={filter} delay={0.2} />}
          {!visible.includes("eyeR") && <Stroke d={PARTS.eyeR} width={w * 0.7} filter={filter} delay={0.3} />}
        </>
      )}
      {state === "saved" && (
        <>
          <Stroke d={DOT_EYES} width={w * 1.1} filter={filter} delay={0.3} />
          <Stroke d={SMILE} width={w * 0.8} filter={filter} delay={0.4} />
        </>
      )}
    </>
  );

  return (
    <svg viewBox="0 0 200 215" className="h-full w-full" preserveAspectRatio="xMidYMid meet" role="img" aria-label={`${wrong} / ${lives}`} data-testid={mini ? undefined : "gallows"} data-wrong={wrong} data-state={state}>
      {!mini && (
        <defs>
          {/* userSpaceOnUse: straight lines have a zero-size bbox, which would clip them away */}
          <filter id={`chalk-${fid}`} filterUnits="userSpaceOnUse" x="0" y="0" width="200" height="215">
            <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="3" result="noise" />
            <feDisplacementMap in="SourceGraphic" in2="noise" scale="2.2" xChannelSelector="R" yChannelSelector="G" />
          </filter>
        </defs>
      )}
      <g key={roundKey}>
        {/* wooden gallows, drawn when the round starts */}
        <Stroke d="M18 205 H158" color={WOOD} width={mini ? 9 : 7} filter={filter} duration={0.35} />
        <Stroke d="M50 205 V20" color={WOOD} width={mini ? 9 : 7} filter={filter} delay={0.25} duration={0.4} />
        <Stroke d="M44 22 H132" color={WOOD} width={mini ? 9 : 7} filter={filter} delay={0.55} duration={0.3} />
        <Stroke d="M50 58 L86 22" color={WOOD} width={mini ? 7 : 5} filter={filter} delay={0.8} duration={0.25} />
        {/* rope — snaps when saved */}
        {state === "saved" ? (
          <>
            <Stroke d="M125 22 V36" color="#d8c9a8" width={mini ? 5 : 3} filter={filter} duration={0.01} />
            <motion.path
              d="M125 36 V48"
              stroke="#d8c9a8"
              strokeWidth={mini ? 5 : 3}
              strokeLinecap="round"
              initial={{ y: 0, opacity: 1, rotate: 0 }}
              animate={{ y: 150, opacity: 0, rotate: 50 }}
              transition={{ duration: 0.9, ease: "easeIn" }}
            />
          </>
        ) : (
          <Stroke d="M125 22 V48" color="#d8c9a8" width={mini ? 5 : 3} filter={filter} delay={1} duration={0.25} />
        )}
      </g>

      {state === "hanged" ? (
        <motion.g
          style={{ transformOrigin: "125px 40px", transformBox: "view-box" }}
          animate={{ rotate: [0, 9, -7, 5, -3, 0] }}
          transition={{ duration: 2.6, repeat: Infinity, ease: "easeInOut" }}
        >
          {figure}
        </motion.g>
      ) : state === "saved" ? (
        <motion.g animate={{ y: [0, 40, 22, 40, 28, 40] }} transition={{ duration: 1.8, times: [0, 0.3, 0.5, 0.65, 0.8, 1], ease: "easeOut" }}>
          {figure}
        </motion.g>
      ) : (
        <g>{figure}</g>
      )}

      {!mini && (
        <AnimatePresence>
          {state === "playing" && last && <Dust key={`${roundKey}-${last}`} x={PART_END[last][0]} y={PART_END[last][1]} />}
        </AnimatePresence>
      )}
    </svg>
  );
}
