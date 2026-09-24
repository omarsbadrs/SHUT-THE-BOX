import "server-only";
import type { AnyEvent, AnyServerState } from "./games";
import { gameOf } from "./games";
import type { AnalyticsRow } from "./store/types";

/** Derives product analytics from committed game events (every event row is tagged with its game). */
export function analyticsFor(state: AnyServerState, events: AnyEvent[]): AnalyticsRow[] {
  const rows: AnalyticsRow[] = [];
  const roomId = state.roomId || null;
  const game = gameOf(state);
  events.forEach((e, i) => {
    const push = (name: string, props: Record<string, unknown> = {}) => rows.push({ name, roomId, props: { game, ...props }, at: e.at });
    switch (e.type) {
      case "ROOM_CREATED":
        push("room_created", { mode: e.settings.gameMode });
        break;
      case "PLAYER_JOINED":
        if (!e.player.isBot && i > 1) push("player_joined");
        break;
      case "MATCH_STARTED":
      case "HM_MATCH_STARTED":
        if (events[i - 1]?.type === "REMATCH_STARTED" || events[i - 1]?.type === "HM_REMATCH") push("rematch");
        push("game_started", { players: e.playerIds.length, mode: e.settings.gameMode });
        break;
      case "ROUND_COMPLETED": {
        const sums = e.result.entries.map((x) => x.openTileSum);
        push("round_completed", { players: sums.length, reason: e.result.reason, averageScore: sums.length ? sums.reduce((a, b) => a + b, 0) / sums.length : 0 });
        break;
      }
      case "HM_ROUND_ENDED":
        push("round_completed", { outcome: e.result.outcome });
        break;
      case "PLAYER_SHUT_BOX":
        push("perfect_box");
        break;
      case "MATCH_COMPLETED":
      case "HM_MATCH_ENDED":
        push("game_completed", { rounds: state.match?.history.length ?? 0, reason: e.result.reason });
        break;
      case "PLAYER_CONNECTION":
        push(e.status === "online" ? "reconnect" : "disconnect", { status: e.status });
        break;
    }
  });
  return rows;
}
