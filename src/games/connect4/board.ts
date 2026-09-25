import type { C4Disc, C4Mode, C4MoveKind } from "./types";

/** Pure board helpers. Columns are stacks, bottom → top; row 0 is the bottom. */

export interface C4Move {
  kind: C4MoveKind;
  column: number;
}

export const ownerAt = (columns: C4Disc[][], c: number, r: number): string | null => columns[c]?.[r]?.p ?? null;

export const canDrop = (columns: C4Disc[][], c: number, rows: number) => c >= 0 && c < columns.length && columns[c].length < rows;

export const canPop = (columns: C4Disc[][], c: number, playerId: string) => c >= 0 && c < columns.length && columns[c][0]?.p === playerId;

export function legalMoves(columns: C4Disc[][], rows: number, mode: C4Mode, playerId: string): C4Move[] {
  const out: C4Move[] = [];
  for (let c = 0; c < columns.length; c++) {
    if (canDrop(columns, c, rows)) out.push({ kind: "drop", column: c });
    if (mode === "c4_popout" && canPop(columns, c, playerId)) out.push({ kind: "pop", column: c });
  }
  return out;
}

const DIRS: Array<[number, number]> = [
  [1, 0],
  [0, 1],
  [1, 1],
  [1, -1],
];

/** The longest run of `connect`+ discs for a player, or null. Cells are [column, row]. */
export function findLine(columns: C4Disc[][], rows: number, connect: number, playerId: string): Array<[number, number]> | null {
  const cols = columns.length;
  let best: Array<[number, number]> | null = null;
  for (let c = 0; c < cols; c++) {
    for (let r = 0; r < columns[c].length; r++) {
      if (columns[c][r].p !== playerId) continue;
      for (const [dc, dr] of DIRS) {
        // only start at the beginning of a run
        if (ownerAt(columns, c - dc, r - dr) === playerId) continue;
        const run: Array<[number, number]> = [];
        let x = c;
        let y = r;
        while (x >= 0 && x < cols && y >= 0 && y < rows && ownerAt(columns, x, y) === playerId) {
          run.push([x, y]);
          x += dc;
          y += dr;
        }
        if (run.length >= connect && (!best || run.length > best.length)) best = run;
      }
    }
  }
  return best;
}

export const isFull = (columns: C4Disc[][], rows: number) => columns.every((col) => col.length >= rows);

/** Compact snapshot for results: one string per column of player indexes. */
export function snapshotOf(columns: C4Disc[][], playerIds: string[]): string[] {
  return columns.map((col) => col.map((d) => String(Math.max(0, playerIds.indexOf(d.p)))).join(""));
}
