"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { C4_COLORS, DEFAULT_CONNECT4_SETTINGS, type Connect4Settings } from "@/games/connect4";
import type { PlayerColor } from "@/game-engine";
import { Connect4SettingsForm } from "@/components/connect4/settings";
import { GuideButton } from "@/components/guide/guide";
import { PageShell } from "@/components/page-shell";
import { ProfileFields } from "@/components/profile-fields";
import { useErrorText, useToast } from "@/components/ui/hooks";
import { Toast } from "@/components/ui/primitives";
import { Wizard } from "@/components/ui/wizard";
import { apiFetch } from "@/lib/client/api";
import { unlockAudio } from "@/lib/client/feedback";
import { setPrefs, usePrefs } from "@/lib/client/prefs";
import { useI18n } from "@/lib/i18n/context";

export default function Connect4CreatePage() {
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
  const preferred = col === undefined ? prefs.color : col;
  const color: PlayerColor = preferred && C4_COLORS.includes(preferred) ? preferred : "red";
  const [settings, setSettings] = useState<Connect4Settings>({ ...DEFAULT_CONNECT4_SETTINGS });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    unlockAudio();
    if (!nickname.trim()) return toast.show(t("err_INVALID_NICKNAME"));
    setBusy(true);
    setPrefs({ nickname: nickname.trim(), avatar });
    const res = await apiFetch<{ code: string }>("/api/rooms", { method: "POST", body: JSON.stringify({ game: "connect4", nickname, avatar, color, settings }) });
    if (!res.ok) {
      setBusy(false);
      return toast.show(errText(res.error));
    }
    router.push(`/room/${res.code}`);
  };

  return (
    <PageShell right={<GuideButton game="connect4" autoOpen />} title={`${t("gameConnect4")} · ${t("playWithFriends")}`}>
      <Toast message={toast.message} />
      <Wizard
        busy={busy}
        testId="create"
        finishLabel={busy ? t("creating") : t("createGame")}
        onFinish={create}
        steps={[
          {
            key: "you",
            title: t("step_you"),
            valid: !!nickname.trim(),
            content: (
              <ProfileFields nickname={nickname} setNickname={setNickname} avatar={avatar} setAvatar={setAvatar} color={color} setColor={(c) => setColor(c)} allowAny={false} colors={C4_COLORS} />
            ),
          },
          { key: "game", title: t("step_game"), content: <Connect4SettingsForm section="game" value={settings} onChange={setSettings} /> },
          { key: "rules", title: t("step_rules"), content: <Connect4SettingsForm section="rules" value={settings} onChange={setSettings} /> },
        ]}
      />
    </PageShell>
  );
}
