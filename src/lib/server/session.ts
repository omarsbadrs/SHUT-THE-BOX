import "server-only";
import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { cookies, headers } from "next/headers";
import { env, isProduction } from "./env";

/**
 * Guest-first identity. A random guest id is signed with a server secret and
 * stored in an httpOnly cookie. The same signed token doubles as the
 * reconnect token (kept by the client as a fallback header when cookies are
 * lost), so a refreshed or reconnecting phone reclaims its seat.
 */

export const SESSION_COOKIE = "s10_session";
export const SESSION_HEADER = "x-shut10-session";
const ONE_YEAR = 60 * 60 * 24 * 365;

function secret(): string {
  if (env.sessionSecret) return env.sessionSecret;
  if (env.supabaseSecretKey) return createHash("sha256").update(`shut10:${env.supabaseSecretKey}`).digest("hex");
  if (isProduction && process.env.VERCEL) throw new Error("SESSION_SECRET or SUPABASE_SECRET_KEY must be set");
  return "shut10-local-development-secret";
}

export function sign(payload: string): string {
  return createHmac("sha256", secret()).update(payload).digest("base64url");
}

export function verifySigned(payload: string, signature: string): boolean {
  const expected = Buffer.from(sign(payload));
  const given = Buffer.from(signature);
  return expected.length === given.length && timingSafeEqual(expected, given);
}

export function makeToken(guestId: string): string {
  return `v1.${guestId}.${sign(`guest:${guestId}`)}`;
}

export function parseToken(token: string | null | undefined): string | null {
  if (!token) return null;
  const parts = token.split(".");
  if (parts.length !== 3 || parts[0] !== "v1") return null;
  const [, guestId, sig] = parts;
  if (!/^[0-9a-f-]{36}$/.test(guestId)) return null;
  return verifySigned(`guest:${guestId}`, sig) ? guestId : null;
}

export interface Identity {
  guestId: string | null;
  token: string | null;
}

export async function readIdentity(): Promise<Identity> {
  const jar = await cookies();
  const fromCookie = jar.get(SESSION_COOKIE)?.value;
  let guestId = parseToken(fromCookie);
  let token = guestId ? fromCookie! : null;
  if (!guestId) {
    const h = await headers();
    const fromHeader = h.get(SESSION_HEADER);
    guestId = parseToken(fromHeader);
    token = guestId ? fromHeader : null;
  }
  return { guestId, token };
}

/** Returns the caller's identity, minting and setting a new guest session if absent. */
export async function ensureIdentity(): Promise<{ guestId: string; token: string }> {
  const current = await readIdentity();
  const jar = await cookies();
  if (current.guestId && current.token) {
    // Re-set the cookie when it only arrived via the fallback header.
    if (jar.get(SESSION_COOKIE)?.value !== current.token) setSessionCookie(jar, current.token);
    return { guestId: current.guestId, token: current.token };
  }
  const guestId = randomUUID();
  const token = makeToken(guestId);
  setSessionCookie(jar, token);
  return { guestId, token };
}

type Jar = Awaited<ReturnType<typeof cookies>>;

export function setSessionCookie(jar: Jar, token: string) {
  jar.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: isProduction,
    path: "/",
    maxAge: ONE_YEAR,
  });
}
