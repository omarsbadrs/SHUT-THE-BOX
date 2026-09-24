import "server-only";
import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { env, upstashConfigured } from "./env";

/**
 * Sliding-window rate limits. Upstash Redis when configured (shared across
 * serverless instances); otherwise a per-instance in-memory window.
 */

type Bucket = "command" | "heartbeat" | "create" | "join" | "admin";

const LIMITS: Record<Bucket, { tokens: number; windowSec: number }> = {
  command: { tokens: 40, windowSec: 10 },
  heartbeat: { tokens: 20, windowSec: 10 },
  create: { tokens: 10, windowSec: 60 },
  join: { tokens: 20, windowSec: 60 },
  admin: { tokens: 10, windowSec: 60 },
};

const g = globalThis as typeof globalThis & {
  __shut10Limiters?: Map<Bucket, Ratelimit>;
  __shut10LocalHits?: Map<string, number[]>;
};

function upstash(bucket: Bucket): Ratelimit {
  g.__shut10Limiters ??= new Map();
  let limiter = g.__shut10Limiters.get(bucket);
  if (!limiter) {
    const { tokens, windowSec } = LIMITS[bucket];
    limiter = new Ratelimit({
      redis: new Redis({ url: env.upstashUrl, token: env.upstashToken }),
      limiter: Ratelimit.slidingWindow(tokens, `${windowSec} s`),
      prefix: `shut10:${bucket}`,
    });
    g.__shut10Limiters.set(bucket, limiter);
  }
  return limiter;
}

function local(bucket: Bucket, key: string): boolean {
  g.__shut10LocalHits ??= new Map();
  const { tokens, windowSec } = LIMITS[bucket];
  const now = Date.now();
  const id = `${bucket}:${key}`;
  const hits = (g.__shut10LocalHits.get(id) ?? []).filter((t) => now - t < windowSec * 1000);
  if (hits.length >= tokens) {
    g.__shut10LocalHits.set(id, hits);
    return false;
  }
  hits.push(now);
  g.__shut10LocalHits.set(id, hits);
  if (g.__shut10LocalHits.size > 10000) g.__shut10LocalHits.clear();
  return true;
}

export async function allow(bucket: Bucket, key: string): Promise<boolean> {
  if (!upstashConfigured()) return local(bucket, key);
  try {
    const res = await upstash(bucket).limit(key);
    return res.success;
  } catch {
    return local(bucket, key);
  }
}
