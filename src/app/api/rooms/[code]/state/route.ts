import { isAdmin } from "@/lib/server/admin";
import { api, json } from "@/lib/server/http";
import { getRoomView } from "@/lib/server/service";
import { readIdentity } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Full public snapshot for (re)connecting clients. Server-only fields are stripped. */
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[code]/state">) {
  return api("rooms.state", async () => {
    const { code } = await ctx.params;
    const identity = await readIdentity();
    const view = await getRoomView(code, { guestId: identity.guestId, isAdmin: await isAdmin() });
    return json({ ok: true, ...view });
  });
}
