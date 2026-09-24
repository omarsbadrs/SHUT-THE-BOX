"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import type { PlayerColor } from "@/game-engine";
import { ColorIcon, PLAYER_STYLE } from "@/components/game/theme";
import { PageShell } from "@/components/page-shell";
import { ProfileFields } from "@/components/profile-fields";
import { FullScreenMessage, Loading } from "@/components/room-client";
import { useErrorText, useToast } from "@/components/ui/hooks";
import { GameButton, GameLink, Toast } from "@/components/ui/primitives";
import { apiFetch, sendCommand, type ApiError } from "@/lib/client/api";
import { unlockAudio } from "@/lib/client/feedback";
import { setPrefs, usePrefs } from "@/lib/client/prefs";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/dictionaries";

interface Preview {
  code: string;
  game: "shut10" | "hangman";
  phase: string;
  gameMode: string;
  maxPlayers: number;
  players: Array<{ nickname: string; avatar: string; color: PlayerColor; isHost: boolean; isBot: boolean }>;
  takenColors: PlayerColor[];
  isMember: boolean;
  spectatorsAllowed: boolean;
  full: boolean;
}

export function JoinClient({ code }: { code: string }) {
  const { t, n } = useI18n();
  const router = useRouter();
  const prefs = usePrefs();
  const toast = useToast();
  const errText = useErrorText();
  const [preview, setPreview] = useState<Preview | null>(null);
  const [loadError, setLoadError] = useState<ApiError | null>(null);
  const [nick, setNickname] = useState<string | null>(null);
  const [av, setAvatar] = useState<string | null>(null);
  const [col, setColor] = useState<PlayerColor | null | undefined>(undefined);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void apiFetch<{ room: Preview }>(`/api/rooms/${code}`).then((r) => {
      if (cancelled) return;
      if (!r.ok) return setLoadError(r.error);
      if (r.room.isMember) return router.replace(`/room/${code}`);
      setPreview(r.room);
    });
    return () => {
      cancelled = true;
    };
  }, [code, router]);

  if (loadError)
    return (
      <FullScreenMessage title={errText(loadError)}>
        <GameLink href="/join">{t("joinRoom")}</GameLink>
      </FullScreenMessage>
    );
  if (!preview) return <Loading />;

  const nickname = nick ?? prefs.nickname;
  const avatar = av ?? prefs.avatar;
  const preferred = col === undefined ? prefs.color : col;
  const color = preferred && !preview.takenColors.includes(preferred) ? preferred : null;
  const started = preview.phase !== "ROOM_LOBBY";

  const join = async () => {
    unlockAudio();
    if (!nickname.trim()) return toast.show(t("err_INVALID_NICKNAME"));
    setBusy(true);
    setPrefs({ nickname: nickname.trim(), avatar, color: preferred ?? null });
    const res = await sendCommand(code, { type: "JOIN", nickname, avatar, color });
    if (!res.ok) {
      setBusy(false);
      return toast.show(errText(res.error));
    }
    router.push(`/room/${code}`);
  };

  const spectate = async () => {
    setBusy(true);
    const res = await sendCommand(code, { type: "SPECTATE" });
    if (!res.ok) {
      setBusy(false);
      return toast.show(errText(res.error));
    }
    router.push(`/room/${code}`);
  };

  return (
    <PageShell title={t("joinRoom")} back="/join">
      <Toast message={toast.message} />
      <div className="glass mb-3 shrink-0 rounded-2xl p-2.5">
        <div className="flex items-center gap-3">
          <div className="text-3xl font-extrabold tracking-[0.14em] text-[#ffcf4a]" dir="ltr">
            {preview.code}
          </div>
          <div className="min-w-0 flex-1 text-end text-xs leading-tight font-bold text-white/70">
            <div className="truncate" data-testid="join-game">
              {t(preview.game === "hangman" ? "gameHangman" : "gameShut10")}
            </div>
            <div className="truncate">
              {t(`mode_${preview.gameMode}` as MessageKey)} · {t("playersCount", { n: n(preview.players.length), max: n(preview.maxPlayers) })}
            </div>
          </div>
        </div>
        <div className="mt-2 flex flex-wrap justify-center gap-1.5">
          {preview.players.map((p) => (
            <span key={p.color} className="inline-flex max-w-[48%] items-center gap-1 rounded-full px-2 py-0.5 text-xs font-extrabold" style={{ background: PLAYER_STYLE[p.color].dark }}>
              <ColorIcon color={p.color} size={9} /> {p.avatar} <span className="truncate">{p.nickname}</span> {p.isHost && "👑"}
            </span>
          ))}
        </div>
      </div>

      {started || preview.full ? (
        <div className="grid gap-4 text-center">
          <div className="text-2xl font-extrabold text-[#ff8a82]">{started ? t("err_GAME_ALREADY_STARTED") : t("err_ROOM_FULL")}</div>
          {preview.spectatorsAllowed && (
            <GameButton variant="blue" onClick={spectate} disabled={busy}>
              👀 {t("watch")}
            </GameButton>
          )}
          <GameLink href="/" variant="dark">
            {t("exit")}
          </GameLink>
        </div>
      ) : (
        <>
          <div className="-mx-1.5 min-h-0 flex-1 overflow-hidden px-1.5 pt-1">
            <ProfileFields
              nickname={nickname}
              setNickname={setNickname}
              avatar={avatar}
              setAvatar={setAvatar}
              color={color}
              setColor={setColor}
              takenColors={preview.takenColors}
            />
          </div>
          <div className="shrink-0 pt-2 pb-2">
            <GameButton className="w-full" onClick={join} disabled={busy} data-testid="join-button">
              {busy ? t("joining") : t("join")}
            </GameButton>
          </div>
        </>
      )}
    </PageShell>
  );
}
