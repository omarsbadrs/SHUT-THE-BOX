import "server-only";
import type { GameEvent, ServerRoomState } from "@/game-engine";
import type { AnalyticsRow } from "./store/types";

/** Derives product analytics from committed game events. */
export function analyticsFor(state: ServerRoomState, events: GameEvent[]): AnalyticsRow[] {
  const rows: AnalyticsRow[] = [];
  const roomId = state.roomId || null;
  events.forEach((e, i) => {
    const push = (name: string, props: Record<string, unknown> = {}) => rows.push({ name, roomId, props, at: e.at });
    switch (e.type) {
      case "ROOM_CREATED":
        push("room_created", { mode: e.settings.gameMode });
        break;
      case "PLAYER_JOINED":
        if (!e.player.isBot && i > 1) push("player_joined");
        break;
      case "MATCH_STARTED":
        if (events[i - 1]?.type === "REMATCH_STARTED") push("rematch");
        push("game_started", { players: e.playerIds.length, mode: e.settings.gameMode });
        break;
      case "ROUND_COMPLETED": {
        const sums = e.result.entries.map((x) => x.openTileSum);
        push("round_completed", {
          players: sums.length,
          reason: e.result.reason,
          averageScore: sums.length ? sums.reduce((a, b) => a + b, 0) / sums.length : 0,
        });
        break;
      }
      case "PLAYER_SHUT_BOX":
        push("perfect_box");
        break;
      case "MATCH_COMPLETED":
        push("game_completed", { rounds: state.match?.history.length ?? 0, reason: e.result.reason });
        break;
      case "PLAYER_CONNECTION":
        push(e.status === "online" ? "reconnect" : "disconnect", { status: e.status });
        break;
    }
  });
  return rows;
}
