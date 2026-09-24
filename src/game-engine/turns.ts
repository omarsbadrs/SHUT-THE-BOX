/**
 * Next eligible player after `currentId` in cyclic `order`. The current player
 * is considered last, so a lone remaining player keeps the turn.
 */
export function getNextPlayer(
  order: readonly string[],
  currentId: string | null,
  isEligible: (playerId: string) => boolean,
): string | null {
  if (order.length === 0) return null;
  const start = currentId === null ? -1 : order.indexOf(currentId);
  for (let step = 1; step <= order.length; step++) {
    const id = order[(start + step + order.length) % order.length];
    if (isEligible(id)) return id;
  }
  return null;
}

/** Rotates seat order so that `starterId` goes first. */
export function orderFromStarter(seatOrder: readonly string[], starterId: string): string[] {
  const idx = seatOrder.indexOf(starterId);
  if (idx < 0) return [...seatOrder];
  return [...seatOrder.slice(idx), ...seatOrder.slice(0, idx)];
}

export function makeTurnId(matchId: string, roundNumber: number, counter: number): string {
  return `${matchId.slice(0, 8)}-r${roundNumber}-t${counter}`;
}
