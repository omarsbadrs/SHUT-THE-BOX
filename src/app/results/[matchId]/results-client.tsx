"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FullScreenMessage, Loading } from "@/components/room-client";
import { MatchResultsView } from "@/components/game/results";
import { Connect4MatchResultsView } from "@/components/connect4/results";
import { GuessWhoMatchResultsView } from "@/components/guesswho/results";
import { HangmanMatchResultsView } from "@/components/hangman/results";
import { apiFetch } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/context";
import type { AnyMatchSummary } from "@/lib/server/store/types";

/** Shareable, immutable final results of a match (any game). */
export function ResultsClient({ matchId }: { matchId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [summary, setSummary] = useState<AnyMatchSummary | null | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ code: string; summary: AnyMatchSummary | null }>(`/api/matches/${matchId}`).then((r) => {
      if (r.ok) {
        setSummary(r.summary);
        setCode(r.code);
      } else setSummary(null);
    });
  }, [matchId]);

  if (summary === undefined) return <Loading />;
  if (!summary)
    return (
      <FullScreenMessage title={code ? t("waitingRematch") : t("err_ROOM_NOT_FOUND")}>
        {code && (
          <button type="button" className="font-bold underline" onClick={() => router.push(`/room/${code}`)}>
            {code}
          </button>
        )}
      </FullScreenMessage>
    );
  const shareUrl = typeof window !== "undefined" ? window.location.href : null;
  if (summary.game === "hangman")
    return (
      <HangmanMatchResultsView
        players={summary.players}
        scores={summary.scores}
        result={summary.result}
        history={summary.history}
        settings={summary.settings}
        isHost={false}
        onNewRoom={() => router.push("/hangman/create")}
        onExit={() => router.push("/")}
        shareUrl={shareUrl}
      />
    );
  if (summary.game === "connect4")
    return (
      <Connect4MatchResultsView
        players={summary.players}
        playerIds={summary.playerIds}
        scores={summary.scores}
        result={summary.result}
        history={summary.history}
        settings={summary.settings}
        isHost={false}
        onNewRoom={() => router.push("/connect4/create")}
        onExit={() => router.push("/")}
        shareUrl={shareUrl}
      />
    );
  if (summary.game === "guesswho")
    return (
      <GuessWhoMatchResultsView
        players={summary.players}
        scores={summary.scores}
        result={summary.result}
        history={summary.history}
        settings={summary.settings}
        isHost={false}
        onNewRoom={() => router.push("/guesswho/create")}
        onExit={() => router.push("/")}
        shareUrl={shareUrl}
      />
    );
  return (
    <MatchResultsView
      players={summary.players}
      stats={summary.stats}
      result={summary.result}
      settings={summary.settings}
      isHost={false}
      onNewRoom={() => router.push("/create")}
      onExit={() => router.push("/")}
      shareUrl={shareUrl}
    />
  );
}
