export type ErrorCode =
  | "ROOM_NOT_FOUND"
  | "ROOM_FULL"
  | "ROOM_CLOSED"
  | "GAME_ALREADY_STARTED"
  | "NOT_YOUR_TURN"
  | "NOT_A_PLAYER"
  | "NOT_HOST"
  | "BANNED"
  | "COLOR_TAKEN"
  | "NICKNAME_TAKEN"
  | "INVALID_NICKNAME"
  | "NOT_ENOUGH_PLAYERS"
  | "NOT_ALL_READY"
  | "WRONG_PHASE"
  | "PAUSED"
  | "TOO_EARLY"
  | "ALREADY_ROLLED"
  | "NOT_ROLLED"
  | "STALE_TURN"
  | "TILE_CLOSED"
  | "INVALID_TILE"
  | "DUPLICATE_TILE"
  | "EMPTY_SELECTION"
  | "WRONG_TOTAL"
  | "ONE_DIE_UNAVAILABLE"
  | "HINTS_UNAVAILABLE"
  | "SPECTATORS_DISABLED"
  | "INVALID_COMMAND"
  | "FORBIDDEN"
  | "DEV_TOOLS_DISABLED"
  | "RATE_LIMITED"
  | "CONFLICT"
  | "SERVER_ERROR"
  | "NOT_CONFIGURED";

export type ErrorParams = Record<string, string | number>;

export class GameError extends Error {
  readonly code: ErrorCode;
  readonly params: ErrorParams;
  constructor(code: ErrorCode, params: ErrorParams = {}) {
    super(code);
    this.code = code;
    this.params = params;
  }
}

export function fail(code: ErrorCode, params?: ErrorParams): never {
  throw new GameError(code, params);
}

const NICK_MAX = 16;

/** Trims, strips control characters and collapses whitespace. */
export function sanitizeNickname(raw: unknown): string {
  if (typeof raw !== "string") return "";
  return raw
    .replace(/[\u0000-\u001f\u007f​-‏‪-‮⁦-⁩]/g, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, NICK_MAX);
}

export function validNickname(nick: string): boolean {
  return nick.length >= 1 && nick.length <= NICK_MAX;
}

export const AVATARS = ["🦊", "🐼", "🐯", "🐸", "🦁", "🐵", "🐙", "🦉", "🐺", "🐨", "🦄", "🐲", "🐧", "🐝", "🦈", "🐢"] as const;

export function sanitizeAvatar(raw: unknown): string {
  return typeof raw === "string" && (AVATARS as readonly string[]).includes(raw) ? raw : AVATARS[0];
}
