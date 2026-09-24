import { redirect } from "next/navigation";
import { FullScreenMessage } from "@/components/room-client";
import { findMatch } from "@/lib/server/service";

export const dynamic = "force-dynamic";

/** /game/MATCH resolves to its room; the live room page keeps the URL in sync. */
export default async function GamePage(props: PageProps<"/game/[matchId]">) {
  const { matchId } = await props.params;
  let code: string | null = null;
  try {
    code = (await findMatch(matchId))?.code ?? null;
  } catch {
    code = null;
  }
  if (!code) return <FullScreenMessage title="ROOM NOT FOUND" />;
  redirect(`/room/${code}`);
}
