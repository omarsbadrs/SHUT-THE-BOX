import { api, gameError, json, readJson } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";
import { createRoomSchema } from "@/lib/server/schemas";
import { createRoomForCaller } from "@/lib/server/service";
import { ensureIdentity } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/** CREATE ROOM → returns the six-character code. */
export async function POST(req: Request) {
  return api("rooms.create", async () => {
    const identity = await ensureIdentity();
    if (!(await allow("create", identity.guestId))) return gameError("RATE_LIMITED");
    const parsed = createRoomSchema.safeParse(await readJson(req));
    if (!parsed.success) return gameError("INVALID_COMMAND");
    const res = await createRoomForCaller({ guestId: identity.guestId }, parsed.data);
    return json({ ok: true, ...res, token: identity.token });
  });
}
