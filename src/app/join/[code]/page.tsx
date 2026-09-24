import { normalizeRoomCode } from "@/lib/shared/room-code";
import { JoinClient } from "./join-client";

export default async function JoinPage(props: PageProps<"/join/[code]">) {
  const { code } = await props.params;
  return <JoinClient code={normalizeRoomCode(code)} />;
}
