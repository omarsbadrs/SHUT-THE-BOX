import { api, gameError, json } from "@/lib/server/http";
import { findMatch } from "@/lib/server/service";

export const dynamic = "force-dynamic";

/** Resolves a match id to its room code and (if finished) its immutable results. */
export async function GET(_req: Request, ctx: RouteContext<"/api/matches/[matchId]">) {
  return api("matches.get", async () => {
    const { matchId } = await ctx.params;
    const found = await findMatch(matchId);
    if (!found) return gameError("ROOM_NOT_FOUND");
    return json({ ok: true, code: found.code, summary: found.summary });
  });
}
