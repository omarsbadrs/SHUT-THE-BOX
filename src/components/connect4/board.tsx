"use client";

import { AnimatePresence, motion } from "motion/react";
import { useId, useState } from "react";
import type { C4Disc } from "@/games/connect4";
import { Disc } from "./disc";

/** Rows of space above the board (the falling disc) and below it (the tray). */
const GHOST = 1;
const TRAY = 0.42;

export interface C4BoardProps {
  cols: number;
  rows: number;
  columns: C4Disc[][];
  colorOf: (playerId: string) => string;
  /** Move number of the disc that was just dropped (it falls from the top). */
  lastDropN: number | null;
  win: Array<[number, number]> | null;
  interactive: boolean;
  action: "drop" | "pop";
  canPopCol: (c: number) => boolean;
  myColor: string | null;
  onColumn: (c: number) => void;
  /** Changing it releases every disc out of the bottom (new round). */
  roundKey: string;
}

/**
 * The classic blue board. Discs live in a layer *behind* the plastic frame,
 * so they fall through the holes like the real thing.
 */
export function C4Board({ cols, rows, columns, colorOf, lastDropN, win, interactive, action, canPopCol, myColor, onColumn, roundKey }: C4BoardProps) {
  const uid = useId().replace(/:/g, "");
  const [hover, setHover] = useState<number | null>(null);
  const total = rows + GHOST + TRAY;
  const W = cols * 100;
  const H = rows * 100;
  const winSet = new Set((win ?? []).map(([c, r]) => `${c}:${r}`));
  const landing = interactive && action === "drop" && hover !== null && columns[hover] && columns[hover].length < rows ? hover : null;

  return (
    <div className="relative w-full select-none" dir="ltr" style={{ aspectRatio: `${cols} / ${total}` }} data-testid="c4-board" onPointerLeave={() => setHover(null)}>
      {/* ghost disc above the hovered column */}
      <div className="absolute inset-x-0 top-0" style={{ height: `${(GHOST / total) * 100}%` }}>
        <AnimatePresence>
          {myColor && landing !== null && (
            <motion.div
              key="ghost"
              className="absolute top-0"
              style={{ width: `${100 / cols}%`, height: "100%" }}
              initial={{ opacity: 0, y: -8 }}
              animate={{ opacity: 1, y: [0, -4, 0], left: `${(landing / cols) * 100}%` }}
              exit={{ opacity: 0 }}
              transition={{ left: { type: "spring", stiffness: 500, damping: 34 }, y: { duration: 1.1, repeat: Infinity } }}
            >
              <div className="absolute inset-[7%]">
                <Disc color={myColor} className="h-full w-full" ghost />
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* the board itself */}
      <div className="absolute inset-x-0" style={{ top: `${(GHOST / total) * 100}%`, height: `${(rows / total) * 100}%` }}>
        {/* discs: clipped at the bottom (they fall out into the tray), free above (they fall in) */}
        <div className="absolute inset-0" style={{ clipPath: "inset(-400% 0 0 0)" }}>
          <AnimatePresence>
            {columns.flatMap((col, c) =>
              col.map((d, r) => {
                const falling = d.n === lastDropN;
                const isWin = winSet.has(`${c}:${r}`);
                return (
                  <motion.div
                    key={`${roundKey}-${d.n}`}
                    layout="position"
                    className="absolute"
                    style={{ left: `${(c / cols) * 100}%`, bottom: `${(r / rows) * 100}%`, width: `${100 / cols}%`, height: `${100 / rows}%` }}
                    initial={falling ? { y: `-${(rows - r + GHOST - 0.1) * 100}%` } : false}
                    animate={{ y: falling ? ["-" + (rows - r + GHOST - 0.1) * 100 + "%", "0%", "-14%", "0%", "-4%", "0%"] : "0%" }}
                    transition={
                      falling
                        ? { y: { duration: 0.34 + (rows - r) * 0.045, times: [0, 0.58, 0.72, 0.84, 0.93, 1], ease: ["easeIn", "easeOut", "easeIn", "easeOut", "easeIn"] }, layout: { type: "spring", stiffness: 420, damping: 30 } }
                        : { layout: { type: "spring", stiffness: 420, damping: 30 } }
                    }
                    exit={{ y: `${(r + 1) * 100 + 40}%`, transition: { duration: 0.42 + r * 0.03, delay: c * 0.035 + (r % 3) * 0.02, ease: "easeIn" } }}
                    data-testid={`c4-disc-${c}-${r}`}
                    data-owner={d.p}
                  >
                    <motion.div
                      className="absolute inset-[9%]"
                      animate={isWin ? { scale: [1, 1.13, 1], filter: ["drop-shadow(0 0 0px #fff)", "drop-shadow(0 0 10px #fff6c2)", "drop-shadow(0 0 0px #fff)"] } : { scale: 1 }}
                      transition={isWin ? { duration: 0.9, repeat: Infinity, delay: 0.15 } : undefined}
                    >
                      <Disc color={colorOf(d.p)} className="h-full w-full" />
                    </motion.div>
                  </motion.div>
                );
              }),
            )}
          </AnimatePresence>
          {/* where the hovered disc would land */}
          {landing !== null && myColor && (
            <div
              className="pointer-events-none absolute"
              style={{ left: `${(landing / cols) * 100}%`, bottom: `${(columns[landing].length / rows) * 100}%`, width: `${100 / cols}%`, height: `${100 / rows}%` }}
            >
              <div className="absolute inset-[16%] rounded-full border-[3px] border-dashed border-white/50" />
            </div>
          )}
        </div>

        {/* the blue plastic frame with holes */}
        <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden>
          <defs>
            <linearGradient id={`${uid}-f`} x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="#4a86f5" />
              <stop offset="45%" stopColor="#2458d6" />
              <stop offset="100%" stopColor="#173c9e" />
            </linearGradient>
            <linearGradient id={`${uid}-s`} x1="0" y1="0" x2="1" y2="1">
              <stop offset="0%" stopColor="#fff" stopOpacity="0.28" />
              <stop offset="40%" stopColor="#fff" stopOpacity="0" />
            </linearGradient>
            <mask id={`${uid}-m`}>
              <rect width={W} height={H} fill="#fff" />
              {Array.from({ length: cols * rows }, (_, i) => (
                <circle key={i} cx={(i % cols) * 100 + 50} cy={Math.floor(i / cols) * 100 + 50} r="39" fill="#000" />
              ))}
            </mask>
          </defs>
          <rect width={W} height={H} rx="26" fill={`url(#${uid}-f)`} mask={`url(#${uid}-m)`} />
          <rect width={W} height={H} rx="26" fill={`url(#${uid}-s)`} mask={`url(#${uid}-m)`} />
          {Array.from({ length: cols * rows }, (_, i) => (
            <circle key={i} cx={(i % cols) * 100 + 50} cy={Math.floor(i / cols) * 100 + 50} r="40.5" fill="none" stroke="#0e2a78" strokeOpacity="0.75" strokeWidth="4" />
          ))}
          <rect x="2" y="2" width={W - 4} height={H - 4} rx="25" fill="none" stroke="#7fa8ff" strokeOpacity="0.5" strokeWidth="3" />
        </svg>

        {/* the winning line */}
        {win && win.length > 1 && (
          <svg viewBox={`0 0 ${W} ${H}`} className="pointer-events-none absolute inset-0 h-full w-full" preserveAspectRatio="none" aria-hidden data-testid="c4-win-line">
            <motion.line
              x1={win[0][0] * 100 + 50}
              y1={(rows - 1 - win[0][1]) * 100 + 50}
              x2={win[win.length - 1][0] * 100 + 50}
              y2={(rows - 1 - win[win.length - 1][1]) * 100 + 50}
              stroke="#fff3b0"
              strokeWidth="16"
              strokeLinecap="round"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 0.9 }}
              transition={{ duration: 0.55, delay: 0.25, ease: "easeOut" }}
              style={{ filter: "drop-shadow(0 0 8px #ffcf4a)" }}
            />
          </svg>
        )}
      </div>

      {/* the tray / base; pop arrows sit here */}
      <div className="absolute inset-x-[2%] bottom-0 rounded-b-[14px] bg-gradient-to-b from-[#1e4cc0] to-[#12307e] shadow-[0_8px_18px_-6px_rgba(0,0,0,.7)]" style={{ height: `${(TRAY / total) * 100}%` }}>
        {interactive && action === "pop" && (
          <div className="grid h-full" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
            {Array.from({ length: cols }, (_, c) => (
              <div key={c} className="flex items-center justify-center">
                {canPopCol(c) && (
                  <motion.span animate={{ y: [0, 3, 0] }} transition={{ duration: 0.9, repeat: Infinity }} className="text-[clamp(10px,3vw,16px)] font-extrabold text-[#ffe57a]">
                    ⬇
                  </motion.span>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* tap targets: one per column, full height */}
      <div className="absolute inset-0 grid" style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}>
        {Array.from({ length: cols }, (_, c) => (
          <button
            key={c}
            type="button"
            aria-label={`${action === "pop" ? "Pop" : "Drop"} ${c + 1}`}
            data-testid={`c4-col-${c}`}
            disabled={!interactive || (action === "drop" ? columns[c].length >= rows : !canPopCol(c))}
            onPointerEnter={() => setHover(c)}
            onPointerMove={() => hover !== c && setHover(c)}
            onClick={() => onColumn(c)}
            className="h-full w-full cursor-pointer rounded-md transition-colors hover:bg-white/5 disabled:cursor-default disabled:hover:bg-transparent"
          />
        ))}
      </div>
    </div>
  );
}

/** Tiny static board for results (snapshot strings: "0"/"1" per disc, bottom → top). */
export function MiniBoard({ snapshot, rows, colors, line, className = "" }: { snapshot: string[]; rows: number; colors: [string, string]; line: Array<[number, number]> | null; className?: string }) {
  const cols = snapshot.length;
  const win = new Set((line ?? []).map(([c, r]) => `${c}:${r}`));
  return (
    <svg viewBox={`0 0 ${cols * 20} ${rows * 20}`} className={className} aria-hidden>
      <rect width={cols * 20} height={rows * 20} rx="5" fill="#2458d6" />
      {Array.from({ length: cols * rows }, (_, i) => {
        const c = i % cols;
        const r = rows - 1 - Math.floor(i / cols);
        const ch = snapshot[c]?.[r];
        const fill = ch === undefined ? "#0d1f4f" : ch === "0" ? colors[0] : colors[1];
        return <circle key={i} cx={c * 20 + 10} cy={Math.floor(i / cols) * 20 + 10} r="7.5" fill={fill} stroke={win.has(`${c}:${r}`) ? "#fff3b0" : "none"} strokeWidth="2.5" />;
      })}
    </svg>
  );
}
