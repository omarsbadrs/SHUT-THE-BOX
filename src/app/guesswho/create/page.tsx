"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { DEFAULT_GUESSWHO_SETTINGS, type GuessWhoSettings } from "@/games/guesswho";
import type { PlayerColor } from "@/game-engine";
import { GuessWhoSettingsForm } from "@/components/guesswho/settings";
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

export default function GuessWhoCreatePage() {
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
  const [settings, setSettings] = useState<GuessWhoSettings>({ ...DEFAULT_GUESSWHO_SETTINGS });
  const [busy, setBusy] = useState(false);

  const create = async () => {
    unlockAudio();
    if (!nickname.trim()) return toast.show(t("err_INVALID_NICKNAME"));
    setBusy(true);
    setPrefs({ nickname: nickname.trim(), avatar, color });
    const res = await apiFetch<{ code: string }>("/api/rooms", { method: "POST", body: JSON.stringify({ game: "guesswho", nickname, avatar, color, settings }) });
    if (!res.ok) {
      setBusy(false);
      return toast.show(errText(res.error));
    }
    router.push(`/room/${res.code}`);
  };

  return (
    <PageShell right={<GuideButton game="guesswho" autoOpen />} title={`${t("gameGuessWho")} · ${t("playWithFriends")}`}>
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
            content: <ProfileFields nickname={nickname} setNickname={setNickname} avatar={avatar} setAvatar={setAvatar} color={color} setColor={setColor} allowAny={false} />,
          },
          { key: "game", title: t("step_game"), content: <GuessWhoSettingsForm section="game" value={settings} onChange={setSettings} /> },
          { key: "rules", title: t("step_rules"), content: <GuessWhoSettingsForm section="rules" value={settings} onChange={setSettings} /> },
        ]}
      />
    </PageShell>
  );
}
