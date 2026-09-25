"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { BotLevel } from "@/game-engine";
import type { GwBoardSize, GwCategory } from "@/games/guesswho";
import { DeckPicker } from "@/components/guesswho/settings";
import { GuessWhoView } from "@/components/guesswho/guesswho-view";
import { PageShell } from "@/components/page-shell";
import { Field, GameButton, Segmented } from "@/components/ui/primitives";
import { unlockAudio } from "@/lib/client/feedback";
import { useLocalGuessWho } from "@/lib/client/local-guesswho";
import { usePrefs } from "@/lib/client/prefs";
import { useI18n } from "@/lib/i18n/context";

/** Guess Who against the bot, played entirely on this phone. */
export default function GuessWhoPracticePage() {
  const { t } = useI18n();
  const router = useRouter();
  const prefs = usePrefs();
  const { room, start, stop } = useLocalGuessWho();
  const [category, setCategory] = useState<GwCategory>("stars");
  const [boardSize, setBoardSize] = useState<GwBoardSize>(24);
  const [level, setLevel] = useState<BotLevel>("normal");

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
    return <GuessWhoView room={wrapped} />;
  }

  return (
    <PageShell title={t("gw_practiceTitle")}>
      <div className="flex min-h-0 flex-1 flex-col gap-3">
        <Field label={t("gw_category")}>
          <DeckPicker value={category} onChange={setCategory} />
        </Field>
        <Field label={t("gw_boardSize")}>
          <Segmented value={boardSize} onChange={setBoardSize} options={([16, 20, 24] as const).map((n) => ({ value: n, label: `${n}` }))} cols="grid-cols-3" />
        </Field>
        <Field label={t("bot")}>
          <Segmented value={level} onChange={setLevel} options={(["easy", "normal", "hard"] as const).map((l) => ({ value: l, label: t(`bot_${l}`) }))} cols="grid-cols-3" testId="gw-bot-level" />
        </Field>
        <div className="mt-auto pb-2">
          <GameButton
            className="w-full"
            onClick={() => {
              unlockAudio();
              start({ category, boardSize, rounds: 3 }, level, { nickname: prefs.nickname, avatar: prefs.avatar, color: prefs.color });
            }}
            data-testid="gw-solo-start"
          >
            🎯 {t("newGame")}
          </GameButton>
        </div>
      </div>
    </PageShell>
  );
}
