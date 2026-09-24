import { isAdmin } from "@/lib/server/admin";
import { api, gameError, json, readJson } from "@/lib/server/http";
import { allow } from "@/lib/server/rate-limit";
import { asCommand, commandRequestSchema } from "@/lib/server/schemas";
import { runCommand } from "@/lib/server/service";
import { ensureIdentity } from "@/lib/server/session";

export const dynamic = "force-dynamic";

/**
 * Single intent endpoint: { command, commandId }. The server validates the
 * intent against authoritative state and commits atomically. `commandId` is
 * an idempotency key so network retries never apply an action twice.
 */
export async function POST(req: Request, ctx: RouteContext<"/api/rooms/[code]/command">) {
  return api("rooms.command", async () => {
    const { code } = await ctx.params;
    const identity = await ensureIdentity();
    const parsed = commandRequestSchema.safeParse(await readJson(req));
    if (!parsed.success) return gameError("INVALID_COMMAND");
    const { command, commandId } = parsed.data;
    const bucket = command.type === "TICK" ? "heartbeat" : command.type === "JOIN" ? "join" : "command";
    if (!(await allow(bucket, identity.guestId))) return gameError("RATE_LIMITED");
    const outcome = await runCommand(code, { guestId: identity.guestId, isAdmin: await isAdmin() }, asCommand(command), commandId);
    return json({ ...outcome, token: command.type === "JOIN" ? identity.token : undefined }, outcome.ok ? 200 : 400);
  });
}
