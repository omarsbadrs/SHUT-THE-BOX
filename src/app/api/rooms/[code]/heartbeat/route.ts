import { api, gameError, json } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";
import { runCommand } from "@/lib/server/service";
import { readIdentity } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * Presence heartbeat (every ~8 s). Marks the caller online, advances the
 * server clock (timers, disconnect grace, host migration) and reports the
 * room version so the client can detect missed realtime deltas.
 */
export async function POST(_req: Request, ctx: RouteContext<"/api/rooms/[code]/heartbeat">) {
  return api("rooms.heartbeat", async () => {
    const { code } = await ctx.params;
    const identity = await readIdentity();
    if (!identity.guestId) return gameError("NOT_A_PLAYER");
    if (!(await allow("heartbeat", identity.guestId))) return gameError("RATE_LIMITED");
    const outcome = await runCommand(code, { guestId: identity.guestId }, { type: "TICK" });
    return json({ ok: true, version: outcome.version, me: outcome.me, events: outcome.events });
  });
}
