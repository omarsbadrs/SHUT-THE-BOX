import { isAdmin } from "@/lib/server/admin";
import { api, json } from "@/lib/server/http";
import { getEventsSince } from "@/lib/server/service";
import { readIdentity } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Event deltas after `since` (gap recovery). Returns a full snapshot when too far behind. */
export async function GET(req: Request, ctx: RouteContext<"/api/rooms/[code]/events">) {
  return api("rooms.events", async () => {
    const { code } = await ctx.params;
    const since = Math.max(0, Number(new URL(req.url).searchParams.get("since") ?? 0) || 0);
    const identity = await readIdentity();
    return json({ ok: true, ...(await getEventsSince(code, { guestId: identity.guestId, isAdmin: await isAdmin() }, since)) });
  });
}
