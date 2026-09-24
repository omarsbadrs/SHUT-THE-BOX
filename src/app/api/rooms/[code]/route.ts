import { api, json } from "@/lib/server/http";
import { getRoomPreview } from "@/lib/server/service";
import { readIdentity } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** Join-screen preview: seats, taken colors, whether the caller is already seated. */
export async function GET(_req: Request, ctx: RouteContext<"/api/rooms/[code]">) {
  return api("rooms.preview", async () => {
    const { code } = await ctx.params;
    const identity = await readIdentity();
    return json({ ok: true, room: await getRoomPreview(code, { guestId: identity.guestId }) });
  });
}
