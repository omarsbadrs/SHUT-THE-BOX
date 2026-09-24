import { cookies } from "next/headers";
import { sanitizeAvatar, sanitizeNickname } from "@/game-engine";
import { storeMode } from "@/lib/server/env";
import { api, gameError, json, readJson } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";
import { SupabaseStore } from "@/lib/server/store/supabase";
import { ensureIdentity, makeToken, setSessionCookie } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * Optional account: after a Supabase Auth sign-in the client posts its access
 * token. The server verifies it and binds the account to one guest identity,
 * so the same player identity follows the account across devices.
 */
export async function POST(req: Request) {
  return api("profile.link", async () => {
    if (storeMode() !== "supabase") return gameError("NOT_CONFIGURED");
    const body = (await readJson(req)) as { accessToken?: unknown; nickname?: unknown; avatar?: unknown } | null;
    if (typeof body?.accessToken !== "string") return gameError("INVALID_COMMAND");
    const store = getStore() as SupabaseStore;
    const user = await store.verifyAccessToken(body.accessToken);
    if (!user) return gameError("FORBIDDEN");
    const identity = await ensureIdentity();
    const nickname = sanitizeNickname(body.nickname) || null;
    const avatar = body.avatar ? sanitizeAvatar(body.avatar) : null;
    const guestId = await store.linkProfile(user.id, identity.guestId, nickname, avatar);
    const token = makeToken(guestId);
    setSessionCookie(await cookies(), token);
    return json({ ok: true, email: user.email, token });
  });
}
