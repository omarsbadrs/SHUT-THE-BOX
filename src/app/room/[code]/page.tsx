import { RoomClient } from "@/components/room-client";
import { normalizeRoomCode } from "@/lib/shared/room-code";

export default async function RoomPage(props: PageProps<"/room/[code]">) {
  const { code } = await props.params;
  return <RoomClient code={normalizeRoomCode(code)} />;
}
