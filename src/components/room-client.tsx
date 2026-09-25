"use client";

import { useRouter } from "next/navigation";
import { useEffect } from "react";
import type { GameSettings } from "@/game-engine";
import type { HangmanSettings } from "@/games/hangman";
import type { GuessWhoSettings } from "@/games/guesswho";
import { isGuessWho, isHangman } from "@/lib/client/games";
import { useRoom } from "@/lib/client/use-room";
import { useI18n } from "@/lib/i18n/context";
import { GameView } from "./game/game-view";
import { DevPanel } from "./game/menu";
import { GuessWhoView } from "./guesswho/guesswho-view";
import { GuessWhoSettingsForm, GuessWhoSettingsSummary } from "./guesswho/settings";
import { HangmanView } from "./hangman/hangman-view";
import { HangmanSettingsForm, HangmanSettingsSummary } from "./hangman/settings";
import { LobbyView } from "./lobby/lobby-view";
import { SettingsForm, SettingsSummary } from "./lobby/settings-form";
import { GameButton, GameLink } from "./ui/primitives";

export function FullScreenMessage({ title, children }: { title: string; children?: React.ReactNode }) {
  return (
    <div className="mx-auto flex h-dvh max-w-[520px] flex-col items-center justify-center gap-5 overflow-hidden px-6 text-center">
      <div className="text-3xl font-extrabold text-[#ffcf4a]" data-testid="fullscreen-message">
        {title}
      </div>
      {children}
    </div>
  );
}

export function Loading() {
  return (
    <div className="flex h-dvh items-center justify-center">
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
  // Hangman and Guess Who rooms always stay on /room/CODE (only SHUT10 uses /game/…).
  const matchId = state && !isHangman(state) && !isGuessWho(state) && state.phase !== "ROOM_LOBBY" && state.phase !== "FINISHED" ? state.match?.id : null;
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
  if (isHangman(state)) {
    if (state.phase === "ROOM_LOBBY")
      return (
        <LobbyView
          room={room}
          title={t("gameHangman")}
          summary={<HangmanSettingsSummary settings={state.settings} />}
          editorSteps={(draft, setDraft) =>
            (["game", "rules"] as const).map((section) => ({
              key: section,
              title: t(`step_${section}`),
              content: <HangmanSettingsForm section={section} value={draft as unknown as HangmanSettings} onChange={(s) => setDraft(s as unknown as Record<string, unknown>)} />,
            }))
          }
        />
      );
    return <HangmanView room={room} />;
  }
  if (isGuessWho(state)) {
    if (state.phase === "ROOM_LOBBY")
      return (
        <LobbyView
          room={room}
          title={t("gameGuessWho")}
          summary={<GuessWhoSettingsSummary settings={state.settings} />}
          editorSteps={(draft, setDraft) =>
            (["game", "rules"] as const).map((section) => ({
              key: section,
              title: t(`step_${section}`),
              content: <GuessWhoSettingsForm section={section} value={draft as unknown as GuessWhoSettings} onChange={(s) => setDraft(s as unknown as Record<string, unknown>)} />,
            }))
          }
        />
      );
    return <GuessWhoView room={room} />;
  }
  if (state.phase === "ROOM_LOBBY")
    return (
      <LobbyView
        room={room}
        title={t("gameShut10")}
        summary={<SettingsSummary settings={state.settings} />}
        editorSteps={(draft, setDraft) =>
          (["game", "rules", "more"] as const).map((section) => ({
            key: section,
            title: t(`step_${section}`),
            content: <SettingsForm section={section} value={draft as unknown as GameSettings} onChange={(s) => setDraft(s as unknown as Record<string, unknown>)} />,
          }))
        }
        devPanel={<DevPanel state={state} me={room.me} send={(c) => void room.send(c)} />}
      />
    );
  return <GameView room={room} />;
}
