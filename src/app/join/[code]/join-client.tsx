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

interface Preview {
  code: string;
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
      <div className="glass mb-5 rounded-3xl p-4 text-center">
        <div className="text-xs font-bold tracking-[0.3em] text-white/60">{t("roomCode")}</div>
        <div className="text-4xl font-extrabold tracking-[0.18em] text-[#ffcf4a]" dir="ltr">
          {preview.code}
        </div>
        <div className="mt-1 text-sm font-bold text-white/70">
          {t(`mode_${preview.gameMode as "faceoff"}`)} · {t("playersCount", { n: preview.players.length, max: preview.maxPlayers })}
        </div>
        <div className="mt-3 flex flex-wrap justify-center gap-2">
          {preview.players.map((p) => (
            <span key={p.color} className="inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-sm font-extrabold" style={{ background: PLAYER_STYLE[p.color].dark }}>
              <ColorIcon color={p.color} size={10} /> {p.avatar} {p.nickname} {p.isHost && "👑"}
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
          <div className="pb-28">
            <ProfileFields
              nickname={nickname}
              setNickname={setNickname}
              avatar={avatar}
              setAvatar={setAvatar}
              color={color}
              setColor={setColor}
              takenColors={preview.takenColors}
            />
            <div className="mt-3 text-center text-xs text-white/50">{t("playersCount", { n: n(preview.players.length), max: n(preview.maxPlayers) })}</div>
          </div>
          <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#07120d] via-[#07120d]/95 to-transparent px-4 pt-6 safe-bottom">
            <div className="mx-auto max-w-[520px]">
              <GameButton className="w-full" onClick={join} disabled={busy} data-testid="join-button">
                {busy ? t("joining") : t("join")}
              </GameButton>
            </div>
          </div>
        </>
      )}
    </PageShell>
  );
}
