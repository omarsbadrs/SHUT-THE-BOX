"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_SETTINGS, type GameSettings, type PlayerColor } from "@/game-engine";
import { SettingsForm } from "@/components/lobby/settings-form";
import { PageShell } from "@/components/page-shell";
import { ProfileFields } from "@/components/profile-fields";
import { useErrorText, useToast } from "@/components/ui/hooks";
import { GameButton, Toast } from "@/components/ui/primitives";
import { apiFetch } from "@/lib/client/api";
import { unlockAudio } from "@/lib/client/feedback";
import { setPrefs, usePrefs } from "@/lib/client/prefs";
import { useI18n } from "@/lib/i18n/context";

export default function CreatePage() {
  const { t } = useI18n();
  const router = useRouter();
  const toast = useToast();
  const errText = useErrorText();
  const prefs = usePrefs();
  const [nick, setNickname] = useState<string | null>(null);
  const [av, setAvatar] = useState<string | null>(null);
  const [col, setColor] = useState<PlayerColor | null | undefined>(undefined);
  const nickname = nick ?? prefs.nickname;
  const avatar = av ?? prefs.avatar;
  const color = col === undefined ? (prefs.color ?? "blue") : col;
  const [settings, setSettings] = useState<GameSettings>({ ...DEFAULT_SETTINGS });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    unlockAudio();
    if (!nickname.trim()) return toast.show(t("err_INVALID_NICKNAME"));
    setBusy(true);
    setPrefs({ nickname: nickname.trim(), avatar, color });
    const res = await apiFetch<{ code: string }>("/api/rooms", {
      method: "POST",
      body: JSON.stringify({ nickname, avatar, color, settings }),
    });
    if (!res.ok) {
      setBusy(false);
      return toast.show(errText(res.error));
    }
    router.push(`/room/${res.code}`);
  };

  return (
    <PageShell title={t("playWithFriends")}>
      <Toast message={toast.message} />
      <div className="grid gap-6 pb-32">
        <ProfileFields nickname={nickname} setNickname={setNickname} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} allowAny={false} />
        <div className="glass rounded-3xl p-4">
          <div className="mb-3 text-sm font-extrabold tracking-wider text-white/70 uppercase">{t("gameOptions")}</div>
          <SettingsForm value={settings} onChange={setSettings} />
        </div>
      </div>
      <div className="fixed inset-x-0 bottom-0 z-10 bg-gradient-to-t from-[#07120d] via-[#07120d]/95 to-transparent px-4 pt-6 safe-bottom">
        <div className="mx-auto max-w-[520px]">
          <GameButton className="w-full" onClick={create} disabled={busy} data-testid="create-game">
            {busy ? t("creating") : t("createGame")}
          </GameButton>
        </div>
      </div>
    </PageShell>
  );
}
