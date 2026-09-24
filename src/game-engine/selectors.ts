import { canUseOneDie, displayRoundTotal, isTurnBased } from "./rules";
import { calculateOpenTileScore } from "./scoring";
import type { PlayerGameState, PlayerRoundState, RoomPlayer, RoomState } from "./types";

export function getPlayer(state: RoomState, id: string | null | undefined): RoomPlayer | undefined {
  return id ? state.players.find((p) => p.id === id) : undefined;
}

export function roundPlayer(state: RoomState, id: string | null | undefined): PlayerRoundState | undefined {
  return id ? state.match?.round?.players[id] : undefined;
}

export function isInMatch(state: RoomState): boolean {
  return state.phase !== "ROOM_LOBBY" && state.phase !== "FINISHED" && !!state.match;
}

export function isRoundLive(state: RoomState): boolean {
  return (state.phase === "PLAYER_TURN" || state.phase === "AWAITING_TILE_SELECTION") && !state.paused;
}

export function canRoll(state: RoomState, me: string | null): boolean {
  if (!me || !isRoundLive(state)) return false;
  const round = state.match?.round;
  const p = round?.players[me];
  if (!round || !p || p.status !== "active" || p.pending) return false;
  if (isTurnBased(state.match!.settings.gameMode)) return round.currentPlayerId === me;
  return true;
}

export function canSelect(state: RoomState, me: string | null): boolean {
  if (!me || !isRoundLive(state)) return false;
  const p = roundPlayer(state, me);
  return !!p?.pending && p.pending.validCount > 0 && p.status === "active";
}

export function oneDieAvailable(state: RoomState, me: string | null): boolean {
  const p = roundPlayer(state, me);
  return !!p && !!state.match && canUseOneDie(p.openTiles, state.match.settings);
}

export function roundLabel(state: RoomState): { current: number; total: number | null } {
  const settings = state.match?.settings ?? state.settings;
  return { current: state.match?.round?.number ?? 0, total: displayRoundTotal(settings) };
}

export function playerGameStates(state: RoomState): PlayerGameState[] {
  const round = state.match?.round;
  if (!round) return [];
  return round.order.map((id) => {
    const p = round.players[id];
    const player = getPlayer(state, id)!;
    return {
      playerId: id,
      color: player?.color ?? "blue",
      openTiles: p.openTiles,
      blocked: p.status === "blocked",
      roundScore: p.finalScore,
    };
  });
}

export function liveScore(p: PlayerRoundState | undefined): number {
  return p ? calculateOpenTileScore(p.openTiles) : 0;
}
