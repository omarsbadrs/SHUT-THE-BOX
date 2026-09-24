"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import { useRoom } from "@/lib/client/use-room";
import { useI18n } from "@/lib/i18n/context";
import { GameView } from "./game/game-view";
import { LobbyView } from "./lobby/lobby-view";
import { GameButton, GameLink } from "./ui/primitives";

export function FullScreenMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex min-h-dvh max-w-[520px] flex-col items-center justify-center gap-5 px-6 text-center">
      <div className="text-3xl font-extrabold text-[#ffcf4a]" data-testid="fullscreen-message">
        {title}
      </div>
      {children}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="h-12 w-12 animate-spin rounded-xl border-4 border-[#ffcf4a] border-t-transparent" />
    </div>
  );
}

/** One live component for the whole room lifetime; the URL follows the phase. */
export function RoomClient({ code }: { code: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const room = useRoom(code);
  const state = room.state;

  useEffect(() => {
    if (room.status === "not_member") router.replace(`/join/${code}`);
  }, [room.status, code, router]);

  // Keep the address bar meaningful without remounting: /room/CODE in the lobby, /game/MATCH during play.
  const matchId = state && state.phase !== "ROOM_LOBBY" && state.phase !== "FINISHED" ? state.match?.id : null;
  useEffect(() => {
    if (!state) return;
    const target = matchId ? `/game/${matchId}` : `/room/${state.code}`;
    if (window.location.pathname !== target) window.history.replaceState(window.history.state, "", target);
  }, [matchId, state]);

  if (room.status === "loading" || room.status === "not_member") return <Loading />;
  if (room.status === "not_found")
    return (
      <FullScreenMessage title={t("err_ROOM_NOT_FOUND")}>
        <GameLink href="/join">{t("joinRoom")}</GameLink>
      </FullScreenMessage>
    );
  if (room.status === "error" || !state)
    return (
      <FullScreenMessage title={room.errorCode === "NOT_CONFIGURED" ? t("err_NOT_CONFIGURED") : t("err_generic")}>
        <GameButton onClick={room.reload}>↻</GameButton>
      </FullScreenMessage>
    );
  if (state.phase === "FINISHED")
    return (
      <FullScreenMessage title={t("roomClosed")}>
        <GameLink href="/">{t("exit")}</GameLink>
      </FullScreenMessage>
    );
  if (state.phase === "ROOM_LOBBY") return <LobbyView room={room} />;
  return <GameView room={room} />;
}
