import "server-only";

/** Server environment. Secrets never leave this module's callers. */
export const env = {
  supabaseUrl: process.env.NEXT_PUBLIC_SUPABASE_URL ?? "",
  supabasePublishableKey: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY ?? "",
  supabaseSecretKey: process.env.SUPABASE_SECRET_KEY ?? "",
  upstashUrl: process.env.UPSTASH_REDIS_REST_URL ?? "",
  upstashToken: process.env.UPSTASH_REDIS_REST_TOKEN ?? "",
  appUrl: process.env.NEXT_PUBLIC_APP_URL ?? "",
  sessionSecret: process.env.SESSION_SECRET ?? "",
  adminPassword: process.env.ADMIN_PASSWORD ?? "",
};

export const isProduction = process.env.NODE_ENV === "production";
export const isVercelProduction = process.env.VERCEL_ENV === "production";

export type StoreMode = "supabase" | "memory" | "unconfigured";

/**
 * Supabase is required on Vercel: serverless instances do not share memory,
 * so the in-memory store would silently break multiplayer. Locally (and in
 * the Playwright suite) the in-memory store + SSE provide the same semantics.
 */
export function storeMode(): StoreMode {
  if (env.supabaseUrl && env.supabaseSecretKey) return "supabase";
  if (process.env.VERCEL && process.env.SHUT10_ALLOW_MEMORY_STORE !== "1") return "unconfigured";
  return "memory";
}

/** Dev panel: never in a Vercel production deployment. */
export function devToolsEnabled(): boolean {
  if (isVercelProduction) return false;
  return !isProduction || process.env.SHUT10_DEV_TOOLS === "1";
}

export function upstashConfigured(): boolean {
  return !!(env.upstashUrl && env.upstashToken);
}
