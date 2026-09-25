"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BotLevel } from "@/game-engine";
import type { C4BoardSize, C4Mode } from "@/games/connect4";
import { Connect4View } from "@/components/connect4/connect4-view";
import { Disc } from "@/components/connect4/disc";
import { GuideButton } from "@/components/guide/guide";
import { PageShell } from "@/components/page-shell";
import { Field, GameButton, Segmented } from "@/components/ui/primitives";
import { unlockAudio } from "@/lib/client/feedback";
import { useLocalConnect4 } from "@/lib/client/local-connect4";
import { usePrefs } from "@/lib/client/prefs";
import { useI18n } from "@/lib/i18n/context";

/** Connect 4 against the bot, played entirely on this phone. */
export default function Connect4PracticePage() {
  const { t } = useI18n();
  const router = useRouter();
  const prefs = usePrefs();
  const { room, start, stop } = useLocalConnect4();
  const [mode, setMode] = useState<C4Mode>("c4_classic");
  const [boardSize, setBoardSize] = useState<C4BoardSize>("7x6");
  const [level, setLevel] = useState<BotLevel>("normal");
  const [color, setColor] = useState<"red" | "yellow">("red");

  if (room?.state) {
    // "Leave" in the game menu ends the local match and goes home.
    const wrapped = {
      ...room,
      send: async (c: Parameters<typeof room.send>[0]) => {
        if (c.type === "LEAVE") {
          stop();
          router.push("/");
          return { ok: true as const, data: {} };
        }
        if (c.type === "BACK_TO_LOBBY") {
          stop();
          return { ok: true as const, data: {} };
        }
        return room.send(c);
      },
    };
    return <Connect4View room={wrapped} />;
  }

  return (
    <PageShell title={t("c4_practiceTitle")} right={<GuideButton game="connect4" autoOpen />}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Field label={t("c4_mode")} hint={t(`modeDesc_${mode}`)}>
          <Segmented value={mode} onChange={setMode} options={(["c4_classic", "c4_popout"] as const).map((m) => ({ value: m, label: t(`mode_${m}`) }))} cols="grid-cols-2" />
        </Field>
        <Field label={t("c4_board")}>
          <Segmented value={boardSize} onChange={setBoardSize} options={(["7x6", "8x7", "9x7"] as const).map((b) => ({ value: b, label: b.replace("x", " × ") }))} cols="grid-cols-3" />
        </Field>
        <Field label={t("colorPreference")}>
          <div className="grid grid-cols-2 gap-2">
            {(["red", "yellow"] as const).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                data-testid={`c4-solo-color-${c}`}
                className={`flex h-12 items-center justify-center gap-2 rounded-2xl bg-white/5 font-extrabold ${color === c ? "ring-2 ring-[#ffcf4a]" : ""}`}
              >
                <Disc color={c} className="h-8 w-8" />
                {t(c)}
              </button>
            ))}
          </div>
        </Field>
        <Field label={t("bot")}>
          <Segmented value={level} onChange={setLevel} options={(["easy", "normal", "hard"] as const).map((l) => ({ value: l, label: t(`bot_${l}`) }))} cols="grid-cols-3" testId="c4-bot-level" />
        </Field>
        <div className="mt-auto pb-2">
          <GameButton
            className="w-full"
            onClick={() => {
              unlockAudio();
              start({ gameMode: mode, boardSize, rounds: 3 }, level, { nickname: prefs.nickname, avatar: prefs.avatar, color });
            }}
            data-testid="c4-solo-start"
          >
            🔴 {t("newGame")}
          </GameButton>
        </div>
      </div>
    </PageShell>
  );
}
