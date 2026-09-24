import "server-only";
import { timingSafeEqual } from "node:crypto";
import { cookies } from "next/headers";
import { env, isProduction } from "./env";
import { sign, verifySigned } from "./session";

export const ADMIN_COOKIE = "s10_admin";
const TTL_MS = 12 * 60 * 60 * 1000;

/** ADMIN_PASSWORD protects /admin. Without it the admin panel is disabled in production. */
function password(): string | null {
  if (env.adminPassword) return env.adminPassword;
  return isProduction ? null : "admin";
}

export function adminEnabled(): boolean {
  return password() !== null;
}

export function checkAdminPassword(given: string): boolean {
  const expected = password();
  if (!expected) return false;
  const a = Buffer.from(given);
  const b = Buffer.from(expected);
  return a.length === b.length && timingSafeEqual(a, b);
}

export async function setAdminSession() {
  const exp = Date.now() + TTL_MS;
  (await cookies()).set(ADMIN_COOKIE, `${exp}.${sign(`admin:${exp}`)}`, {
    httpOnly: true,
    sameSite: "strict",
    secure: isProduction,
    path: "/",
    maxAge: TTL_MS / 1000,
  });
}

export async function clearAdminSession() {
  (await cookies()).delete(ADMIN_COOKIE);
}

export async function isAdmin(): Promise<boolean> {
  if (!adminEnabled()) return false;
  const raw = (await cookies()).get(ADMIN_COOKIE)?.value;
  if (!raw) return false;
  const [exp, sig] = raw.split(".");
  if (!exp || !sig || Number(exp) < Date.now()) return false;
  return verifySigned(`admin:${exp}`, sig);
}
