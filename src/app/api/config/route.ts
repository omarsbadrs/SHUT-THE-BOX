import { devToolsEnabled, env, storeMode } from "@/lib/server/env";
import { json } from "@/lib/server/http";

export const dynamic = "force-dynamic";

/** Public runtime config: which realtime transport to use and whether dev tools exist. */
export async function GET() {
  const mode = storeMode();
  return json({
    ok: true,
    store: mode,
    realtime: mode === "supabase" ? "supabase" : "sse",
    supabaseUrl: mode === "supabase" ? env.supabaseUrl : null,
    supabasePublishableKey: mode === "supabase" ? env.supabasePublishableKey : null,
    devTools: devToolsEnabled(),
  });
}
