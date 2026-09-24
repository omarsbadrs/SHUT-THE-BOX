import { z } from "zod";
import { isAdmin } from "@/lib/server/admin";
import { api, gameError, json, readJson } from "@/lib/server/http";
import { runCommand } from "@/lib/server/service";

export const dynamic = "force-dynamic";

const body = z.discriminatedUnion("action", [
  z.object({ action: z.literal("close") }),
  z.object({ action: z.literal("set_tiles"), playerId: z.string().min(1), openTiles: z.array(z.number().int().min(1).max(10)).max(10) }),
]);

/** Admin corrections: close a room, or explicitly correct a board (audited as TILES_CORRECTED). */
export async function POST(req: Request, ctx: RouteContext<"/api/admin/rooms/[code]">) {
  return api("admin.room", async () => {
    if (!(await isAdmin())) return gameError("FORBIDDEN");
    const { code } = await ctx.params;
    const parsed = body.safeParse(await readJson(req));
    if (!parsed.success) return gameError("INVALID_COMMAND");
    const cmd =
      parsed.data.action === "close"
        ? ({ type: "CLOSE_ROOM" } as const)
        : ({ type: "ADMIN_SET_TILES", playerId: parsed.data.playerId, openTiles: parsed.data.openTiles } as const);
    const outcome = await runCommand(code, { guestId: null, isAdmin: true }, cmd);
    return json({ ...outcome }, outcome.ok ? 200 : 400);
  });
}
