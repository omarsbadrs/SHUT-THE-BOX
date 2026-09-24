import type { RandomSource } from "./dice";
import { rankRound } from "./scoring";
import type { PlayerRoundState, PlayerRoundStatus, RoundEndReason, RoundResult, RoundState, TieBreakRule } from "./types";
import { TILE_VALUES } from "./types";

export function freshPlayerRound(playerId: string, status: PlayerRoundStatus): PlayerRoundState {
  return {
    playerId,
    openTiles: [...TILE_VALUES],
    status,
    pending: null,
    last: null,
    rolls: 0,
    turnStartedAt: null,
    deadlineAt: null,
    hintsUsed: 0,
    blockedReason: status === "out" ? "absent" : null,
    finalScore: status === "out" ? 55 : null,
  };
}

export function activePlayerIds(round: RoundState): string[] {
  return round.order.filter((id) => round.players[id]?.status === "active");
}

export function isRoundOver(round: RoundState): RoundEndReason | null {
  const players = Object.values(round.players);
  if (players.some((p) => p.status === "shut")) return "shut";
  if (!players.some((p) => p.status === "active")) return "all_blocked";
  return null;
}

/** Computes the immutable round result from the final boards. */
export function resolveRound(
  round: RoundState,
  reason: RoundEndReason,
  forfeitedIds: ReadonlySet<string>,
  tieBreak: TieBreakRule,
  rng: RandomSource,
  now: number,
): RoundResult {
  const inputs = round.order.map((id) => {
    const p = round.players[id];
    return { playerId: id, openTiles: [...p.openTiles], status: p.status, forfeited: forfeitedIds.has(id) };
  });
  // A shut box always wins outright regardless of tie-break settings.
  const ranked = rankRound(inputs, tieBreak, rng);
  return {
    roundId: round.id,
    roundNumber: round.number,
    winnerIds: ranked.winnerIds,
    entries: ranked.entries,
    reason,
    tieBreakRolls: ranked.tieBreakRolls,
    endedAt: now,
  };
}
