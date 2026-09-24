import { storeMode } from "@/lib/server/env";
import { api, gameError } from "@/lib/server/http";
import { getRoomView } from "@/lib/server/service";
import { readIdentity } from "@/lib/server/session";
import { subscribeMemoryRoom } from "@/lib/server/store/memory";

export const dynamic = "force-dynamic";

/**
 * Local realtime transport (in-memory store only): Server-Sent Events carrying
 * the same event deltas Supabase Realtime delivers in production.
 */
export async function GET(req: Request, ctx: RouteContext<"/api/rooms/[code]/stream">) {
  return api("rooms.stream", async () => {
    if (storeMode() !== "memory") return gameError("NOT_CONFIGURED");
    const { code } = await ctx.params;
    const identity = await readIdentity();
    const view = await getRoomView(code, { guestId: identity.guestId });
    const encoder = new TextEncoder();
    let cleanup = () => {};
    const stream = new ReadableStream<Uint8Array>({
      start(controller) {
        const send = (event: string, data: unknown) => {
          try {
            controller.enqueue(encoder.encode(`event: ${event}\ndata: ${JSON.stringify(data)}\n\n`));
          } catch {
            cleanup();
          }
        };
        send("hello", { version: view.state.version });
        const unsubscribe = subscribeMemoryRoom(view.state.roomId, (events) => send("events", events));
        const ping = setInterval(() => send("ping", Date.now()), 15000);
        cleanup = () => {
          clearInterval(ping);
          unsubscribe();
          try {
            controller.close();
          } catch {
            // already closed
          }
        };
        req.signal.addEventListener("abort", () => cleanup());
      },
      cancel() {
        cleanup();
      },
    });
    return new Response(stream, {
      headers: {
        "Content-Type": "text/event-stream; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
        "X-Accel-Buffering": "no",
      },
    });
  });
}
