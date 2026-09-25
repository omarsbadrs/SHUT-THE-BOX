import type { BotLevel, RandomSource } from "@/game-engine";
import type { C4Move } from "./board";
import type { C4Disc, C4Mode } from "./types";

/**
 * Connect 4 bot: alpha-beta minimax over a compact board. Easy plays loosely
 * (but usually takes a win or blocks one), normal looks 4 moves ahead, hard 6+.
 */

interface Board {
  cols: number;
  rows: number;
  connect: number;
  /** cell = col * rows + row; 0 empty, 1 bot, 2 rival. */
  cells: Int8Array;
  heights: Int8Array;
}

const WIN = 1_000_000;
const windowCache = new Map<string, Int16Array[]>();

function windowsFor(cols: number, rows: number, connect: number): Int16Array[] {
  const key = `${cols}x${rows}x${connect}`;
  const hit = windowCache.get(key);
  if (hit) return hit;
  const out: Int16Array[] = [];
  const dirs: Array<[number, number]> = [
    [1, 0],
    [0, 1],
    [1, 1],
    [1, -1],
  ];
  for (let c = 0; c < cols; c++)
    for (let r = 0; r < rows; r++)
      for (const [dc, dr] of dirs) {
        const ec = c + dc * (connect - 1);
        const er = r + dr * (connect - 1);
        if (ec < 0 || ec >= cols || er < 0 || er >= rows) continue;
        const w = new Int16Array(connect);
        for (let i = 0; i < connect; i++) w[i] = (c + dc * i) * rows + (r + dr * i);
        out.push(w);
      }
  windowCache.set(key, out);
  return out;
}

function toBoard(columns: C4Disc[][], rows: number, connect: number, botId: string): Board {
  const cols = columns.length;
  const cells = new Int8Array(cols * rows);
  const heights = new Int8Array(cols);
  columns.forEach((col, c) => {
    heights[c] = col.length;
    col.forEach((d, r) => (cells[c * rows + r] = d.p === botId ? 1 : 2));
  });
  return { cols, rows, connect, cells, heights };
}

function clone(b: Board): Board {
  return { ...b, cells: b.cells.slice(), heights: b.heights.slice() };
}

function apply(b: Board, m: C4Move, who: 1 | 2): Board {
  const n = clone(b);
  if (m.kind === "drop") {
    n.cells[m.column * n.rows + n.heights[m.column]] = who;
    n.heights[m.column]++;
  } else {
    const base = m.column * n.rows;
    for (let r = 0; r < n.heights[m.column] - 1; r++) n.cells[base + r] = n.cells[base + r + 1];
    n.cells[base + n.heights[m.column] - 1] = 0;
    n.heights[m.column]--;
  }
  return n;
}

function moves(b: Board, mode: C4Mode, who: 1 | 2): C4Move[] {
  const out: C4Move[] = [];
  // centre-first ordering makes alpha-beta prune far more
  const mid = (b.cols - 1) / 2;
  const order = [...Array(b.cols).keys()].sort((x, y) => Math.abs(x - mid) - Math.abs(y - mid));
  for (const c of order) {
    if (b.heights[c] < b.rows) out.push({ kind: "drop", column: c });
    if (mode === "c4_popout" && b.heights[c] > 0 && b.cells[c * b.rows] === who) out.push({ kind: "pop", column: c });
  }
  return out;
}

function hasLine(b: Board, who: 1 | 2): boolean {
  for (const w of windowsFor(b.cols, b.rows, b.connect)) {
    let ok = true;
    for (let i = 0; i < w.length; i++)
      if (b.cells[w[i]] !== who) {
        ok = false;
        break;
      }
    if (ok) return true;
  }
  return false;
}

function evaluate(b: Board): number {
  let score = 0;
  const k = b.connect;
  for (const w of windowsFor(b.cols, b.rows, k)) {
    let mine = 0;
    let theirs = 0;
    for (let i = 0; i < w.length; i++) {
      const v = b.cells[w[i]];
      if (v === 1) mine++;
      else if (v === 2) theirs++;
    }
    if (mine && theirs) continue;
    if (mine === k - 1) score += 50;
    else if (mine === k - 2) score += 6;
    if (theirs === k - 1) score -= 60;
    else if (theirs === k - 2) score -= 6;
  }
  // centre control
  const mid = Math.floor(b.cols / 2);
  for (let r = 0; r < b.rows; r++) {
    const v = b.cells[mid * b.rows + r];
    if (v === 1) score += 4;
    else if (v === 2) score -= 4;
  }
  return score;
}

/** Outcome after `who` moved: a line for the mover wins (even if a pop made both). */
function terminal(b: Board, mover: 1 | 2): number | null {
  const other: 1 | 2 = mover === 1 ? 2 : 1;
  const m = hasLine(b, mover);
  if (m) return mover === 1 ? WIN : -WIN;
  if (hasLine(b, other)) return other === 1 ? WIN : -WIN;
  return null;
}

function search(b: Board, depth: number, alpha: number, beta: number, who: 1 | 2, mode: C4Mode): number {
  const list = moves(b, mode, who);
  if (list.length === 0) return 0; // draw
  if (depth === 0) return evaluate(b);
  if (who === 1) {
    let best = -Infinity;
    for (const m of list) {
      const n = apply(b, m, 1);
      const t = terminal(n, 1);
      const v = t !== null ? t + depth : search(n, depth - 1, alpha, beta, 2, mode);
      if (v > best) best = v;
      if (best > alpha) alpha = best;
      if (alpha >= beta) break;
    }
    return best;
  }
  let best = Infinity;
  for (const m of list) {
    const n = apply(b, m, 2);
    const t = terminal(n, 2);
    const v = t !== null ? t - depth : search(n, depth - 1, alpha, beta, 1, mode);
    if (v < best) best = v;
    if (best < beta) beta = best;
    if (alpha >= beta) break;
  }
  return best;
}

function depthFor(level: BotLevel, b: Board, mode: C4Mode): number {
  const big = b.cols * b.rows > 42;
  if (level === "normal") return mode === "c4_popout" ? 3 : 4;
  // hard
  if (mode === "c4_popout") return 4;
  return big ? 5 : 6;
}

export function botC4Move(level: BotLevel, columns: C4Disc[][], rows: number, connect: number, mode: C4Mode, botId: string, rng: RandomSource): C4Move {
  const b = toBoard(columns, rows, connect, botId);
  const list = moves(b, mode, 1);
  if (list.length === 0) return { kind: "drop", column: 0 };
  const pick = <T>(xs: T[]) => xs[rng.int(0, xs.length - 1)];

  // Immediate win / block, used by every level (easy only sometimes).
  const winning = list.find((m) => terminal(apply(b, m, 1), 1) === WIN);
  const theirWins = moves(b, mode, 2).filter((m) => m.kind === "drop" && terminal(apply(b, m, 2), 2) === -WIN);
  if (level === "easy") {
    if (winning && rng.int(1, 10) <= 7) return winning;
    if (theirWins.length && rng.int(1, 10) <= 6) {
      const block = list.find((m) => m.kind === "drop" && m.column === theirWins[0].column);
      if (block) return block;
    }
    const drops = list.filter((m) => m.kind === "drop");
    return pick(drops.length ? drops : list);
  }
  if (winning) return winning;

  const depth = depthFor(level, b, mode);
  let bestScore = -Infinity;
  let best: C4Move[] = [];
  for (const m of list) {
    const n = apply(b, m, 1);
    const t = terminal(n, 1);
    const v = t !== null ? t + depth : search(n, depth - 1, -Infinity, Infinity, 2, mode);
    if (v > bestScore) {
      bestScore = v;
      best = [m];
    } else if (v === bestScore) best.push(m);
  }
  return pick(best);
}
