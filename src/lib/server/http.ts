import "server-only";
import { GameError, type ErrorCode } from "@/game-engine";
import { recordServerError } from "./service";

const STATUS: Partial<Record<ErrorCode, number>> = {
  ROOM_NOT_FOUND: 404,
  NOT_A_PLAYER: 403,
  NOT_HOST: 403,
  FORBIDDEN: 403,
  BANNED: 403,
  DEV_TOOLS_DISABLED: 403,
  SPECTATORS_DISABLED: 403,
  RATE_LIMITED: 429,
  CONFLICT: 409,
  NOT_CONFIGURED: 503,
  SERVER_ERROR: 500,
};

const NO_STORE = { "Cache-Control": "no-store" };

export function json(body: Record<string, unknown>, status = 200) {
  return Response.json({ serverNow: Date.now(), ...body }, { status, headers: NO_STORE });
}

export function gameError(code: ErrorCode, params: Record<string, string | number> = {}) {
  return json({ ok: false, error: { code, params } }, STATUS[code] ?? 400);
}

/** Wraps a route handler: typed game errors become friendly JSON, others are logged. */
export async function api(source: string, fn: () => Promise<Response>): Promise<Response> {
  try {
    return await fn();
  } catch (err) {
    if (err instanceof GameError) return gameError(err.code, err.params);
    await recordServerError(source, err);
    return gameError("SERVER_ERROR");
  }
}

export async function readJson(req: Request): Promise<unknown> {
  try {
    return await req.json();
  } catch {
    return null;
  }
}
