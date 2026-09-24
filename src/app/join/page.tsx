"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { PageShell } from "@/components/page-shell";
import { GameButton } from "@/components/ui/primitives";
import { useI18n } from "@/lib/i18n/context";
import { isValidRoomCode, normalizeRoomCode, ROOM_CODE_LENGTH } from "@/lib/shared/room-code";

export default function JoinCodePage() {
  const { t } = useI18n();
  const router = useRouter();
  const [code, setCode] = useState("");
  const valid = isValidRoomCode(code);
  const go = () => valid && router.push(`/join/${code}`);
  return (
    <PageShell title={t("joinRoom")}>
      <form
        className="flex flex-1 flex-col items-center gap-6 pt-10"
        onSubmit={(e) => {
          e.preventDefault();
          go();
        }}
      >
        <div className="text-sm font-bold tracking-[0.3em] text-white/60">{t("roomCode")}</div>
        <input
          autoFocus
          inputMode="text"
          autoCapitalize="characters"
          autoComplete="off"
          spellCheck={false}
          dir="ltr"
          value={code}
          onChange={(e) => setCode(normalizeRoomCode(e.target.value))}
          maxLength={ROOM_CODE_LENGTH}
          placeholder="K7MX42"
          data-testid="room-code-input"
          className="h-20 w-full rounded-3xl border-2 border-white/10 bg-black/30 text-center text-5xl font-extrabold tracking-[0.25em] text-[#ffcf4a] uppercase placeholder:text-white/15 focus:border-[#ffcf4a] focus:outline-none"
        />
        <div className="text-xs text-white/50">{t("enterRoomCode")}</div>
        <GameButton type="submit" className="w-full" disabled={!valid} data-testid="join-continue">
          {t("continue")}
        </GameButton>
      </form>
    </PageShell>
  );
}
