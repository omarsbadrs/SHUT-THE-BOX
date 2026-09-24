import { isAdmin } from "@/lib/server/admin";
import { storeMode } from "@/lib/server/env";
import { api, gameError, json } from "@/lib/server/http";
import { getStore } from "@/lib/server/store";

export const dynamic = "force-dynamic";

/** Active rooms, finished matches, aggregate stats and recent errors. No session tokens. */
export async function GET() {
  return api("admin.overview", async () => {
    if (!(await isAdmin())) return gameError("FORBIDDEN");
    const overview = await getStore().adminOverview();
    return json({
      ok: true,
      overview,
      config: {
        store: storeMode(),
        upstash: !!(process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN),
        environment: process.env.VERCEL_ENV ?? process.env.NODE_ENV,
      },
    });
  });
}
