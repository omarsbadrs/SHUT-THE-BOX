import { adminEnabled, checkAdminPassword, clearAdminSession, setAdminSession } from "@/lib/server/admin";
import { api, gameError, json, readJson } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  return api("admin.login", async () => {
    if (!adminEnabled()) return gameError("NOT_CONFIGURED");
    const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
    if (!(await allow("admin", ip))) return gameError("RATE_LIMITED");
    const body = (await readJson(req)) as { password?: unknown } | null;
    if (typeof body?.password !== "string" || !checkAdminPassword(body.password)) return gameError("FORBIDDEN");
    await setAdminSession();
    return json({ ok: true });
  });
}

export async function DELETE() {
  await clearAdminSession();
  return json({ ok: true });
}
