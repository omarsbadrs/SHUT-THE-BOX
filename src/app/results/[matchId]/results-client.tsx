"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { FullScreenMessage, Loading } from "@/components/room-client";
import { MatchResultsView } from "@/components/game/results";
import { apiFetch } from "@/lib/client/api";
import { useI18n } from "@/lib/i18n/context";
import type { MatchSummary } from "@/lib/server/store/types";

/** Shareable, immutable final results of a match. */
export function ResultsClient({ matchId }: { matchId: string }) {
  const { t } = useI18n();
  const router = useRouter();
  const [summary, setSummary] = useState<MatchSummary | null | undefined>(undefined);
  const [code, setCode] = useState<string | null>(null);

  useEffect(() => {
    void apiFetch<{ code: string; summary: MatchSummary | null }>(`/api/matches/${matchId}`).then((r) => {
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
  return (
    <MatchResultsView
      players={summary.players}
      stats={summary.stats}
      result={summary.result}
      settings={summary.settings}
      isHost={false}
      onNewRoom={() => router.push("/create")}
      onExit={() => router.push("/")}
      shareUrl={typeof window !== "undefined" ? window.location.href : null}
    />
  );
}
