import { roundCap, winsToClinch } from "./rules";
import type {
  GameSettings,
  MatchEndReason,
  MatchPlayerStats,
  MatchResult,
  MatchStanding,
  MatchState,
  RoomPlayer,
  RoundResult,
} from "./types";

export function emptyStats(p: RoomPlayer): MatchPlayerStats {
  return {
    playerId: p.id,
    color: p.color,
    nickname: p.nickname,
    avatar: p.avatar,
    roundWins: 0,
    matchPoints: 0,
    cumulativeScore: 0,
    perfectRounds: 0,
    roundsPlayed: 0,
    tilesClosed: 0,
    diceRolls: 0,
    doubles: 0,
    bestRound: null,
    scores: [],
  };
}

/** New stats after a round result (pure). Tile/roll counters are tracked live by the reducer. */
export function statsAfterRound(
  stats: Record<string, MatchPlayerStats>,
  result: RoundResult,
): Record<string, MatchPlayerStats> {
  const next: Record<string, MatchPlayerStats> = {};
  for (const [id, s] of Object.entries(stats)) next[id] = { ...s, scores: [...s.scores] };
  for (const e of result.entries) {
    const s = next[e.playerId];
    if (!s) continue;
    s.roundsPlayed += 1;
    s.scores.push(e.openTileSum);
    s.cumulativeScore += e.openTileSum;
    s.matchPoints += e.points;
    if (result.winnerIds.includes(e.playerId)) s.roundWins += 1;
    if (e.perfectBox) s.perfectRounds += 1;
    s.bestRound = s.bestRound === null ? e.openTileSum : Math.min(s.bestRound, e.openTileSum);
  }
  return next;
}

/** Has the match reached its end condition after `roundsPlayed` rounds? */
export function isMatchOver(match: Pick<MatchState, "roundsPlayed" | "stats">, settings: GameSettings): boolean {
  if (settings.matchFormat === "endless") return match.roundsPlayed >= roundCap(settings);
  if (match.roundsPlayed >= roundCap(settings)) return true;
  const clinch = winsToClinch(settings);
  if (clinch !== null) {
    const maxWins = Math.max(0, ...Object.values(match.stats).map((s) => s.roundWins));
    if (maxWins >= clinch) return true;
  }
  return false;
}

function compareStandings(a: MatchPlayerStats, b: MatchPlayerStats, settings: GameSettings): number {
  switch (settings.scoringMode) {
    case "cumulative_low":
      return a.cumulativeScore - b.cumulativeScore || b.roundWins - a.roundWins || b.matchPoints - a.matchPoints;
    case "match_points":
      return b.matchPoints - a.matchPoints || b.roundWins - a.roundWins || a.cumulativeScore - b.cumulativeScore;
    case "round_wins":
    default:
      return b.roundWins - a.roundWins || b.matchPoints - a.matchPoints || a.cumulativeScore - b.cumulativeScore;
  }
}

/** Final standings and winner(s). Players who left rank last and cannot win. */
export function resolveMatch(
  match: Pick<MatchState, "stats" | "playerIds">,
  settings: GameSettings,
  leftIds: ReadonlySet<string>,
  reason: MatchEndReason,
  now: number,
): MatchResult {
  const stats = match.playerIds.map((id) => match.stats[id]).filter(Boolean);
  const sorted = [...stats].sort((a, b) => {
    const la = leftIds.has(a.playerId) ? 1 : 0;
    const lb = leftIds.has(b.playerId) ? 1 : 0;
    return la - lb || compareStandings(a, b, settings) || a.playerId.localeCompare(b.playerId);
  });
  const standings: MatchStanding[] = [];
  sorted.forEach((s, i) => {
    const prev = sorted[i - 1];
    const tied =
      prev !== undefined &&
      leftIds.has(prev.playerId) === leftIds.has(s.playerId) &&
      compareStandings(prev, s, settings) === 0;
    standings.push({
      playerId: s.playerId,
      rank: tied ? standings[i - 1].rank : i + 1,
      roundWins: s.roundWins,
      matchPoints: s.matchPoints,
      cumulativeScore: s.cumulativeScore,
    });
  });
  const winnerIds = standings.filter((s) => s.rank === 1 && !leftIds.has(s.playerId)).map((s) => s.playerId);
  return { winnerIds, standings, reason, endedAt: now };
}
