"use client";

import { useEffect, useState } from "react";
import type { PlayerColor } from "@/game-engine";
import { PreferenceToggles } from "@/components/game/menu";
import { MadeBy } from "@/components/made-by";
import { PageShell } from "@/components/page-shell";
import { ProfileFields } from "@/components/profile-fields";
import { GameButton, TextInput, Toggle } from "@/components/ui/primitives";
import { apiFetch, getConfig, type RuntimeConfig } from "@/lib/client/api";
import { setPrefs, usePrefs } from "@/lib/client/prefs";
import { supabaseClient } from "@/lib/client/realtime";
import { useSoloStats } from "@/lib/client/solo-stats";
import { useI18n } from "@/lib/i18n/context";

export default function ProfilePage() {
  const { t, n } = useI18n();
  const prefs = usePrefs();
  const stats = useSoloStats();
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  const [email, setEmail] = useState("");
  const [account, setAccount] = useState<string | null>(null);
  const [sent, setSent] = useState(false);
  const [tab, setTab] = useState<"you" | "settings" | "stats" | "account">("you");

  useEffect(() => {
    void getConfig().then(async (cfg) => {
      setConfig(cfg);
      const client = supabaseClient(cfg);
      if (!client) return;
      const { data } = await client.auth.getSession();
      const session = data.session;
      if (!session) return;
      setAccount(session.user.email ?? session.user.id);
      // Bind this account to one guest identity (server verifies the token).
      await apiFetch("/api/profile/link", {
        method: "POST",
        body: JSON.stringify({ accessToken: session.access_token, nickname: prefs.nickname || null, avatar: prefs.avatar }),
      });
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const client = config ? supabaseClient(config) : null;

  const sendLink = async () => {
    if (!client || !email) return;
    const { error } = await client.auth.signInWithOtp({ email, options: { emailRedirectTo: `${window.location.origin}/profile` } });
    if (!error) setSent(true);
  };

  const signOut = async () => {
    await client?.auth.signOut();
    setAccount(null);
  };

  const isIos = typeof navigator !== "undefined" && /iPad|iPhone|iPod/.test(navigator.userAgent);

  return (
    <PageShell title={t("profileTitle")}>
      <div className="mb-3 grid shrink-0 grid-cols-4 gap-1 rounded-2xl bg-black/25 p-1" role="tablist">
        {(["you", "settings", "stats", "account"] as const).map((k) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            onClick={() => setTab(k)}
            data-testid={`profile-tab-${k}`}
            className={`truncate rounded-xl py-1.5 text-[13px] font-extrabold ${tab === k ? "bg-[#ffcf4a] text-[#2a1a00]" : "text-white/70"}`}
          >
            {t(`tab_${k}`)}
          </button>
        ))}
      </div>
      <div className="-mx-1.5 min-h-0 min-w-0 flex-1 overflow-hidden px-1.5 pt-1 pb-2">
        {tab === "you" && (
          <ProfileFields
            nickname={prefs.nickname}
            setNickname={(v) => setPrefs({ nickname: v })}
            avatar={prefs.avatar}
            setAvatar={(v) => setPrefs({ avatar: v })}
            color={prefs.color}
            setColor={(v: PlayerColor | null) => setPrefs({ color: v })}
          />
        )}
        {tab === "settings" && (
          <div className="grid gap-2">
            <PreferenceToggles />
            <Toggle checked={prefs.trainer} onChange={(v) => setPrefs({ trainer: v })} label={`🎓 ${t("trainer")}`} />
          </div>
        )}
        {tab === "stats" && (
          <section className="glass rounded-3xl p-4">
            <div className="mb-3 text-sm font-extrabold tracking-wider text-white/70 uppercase">{t("practiceStats")}</div>
            <div className="grid grid-cols-3 gap-2 text-center">
              {[
                [t("gamesPlayed"), n(stats.games)],
                [t("bestScore"), stats.best === null ? "—" : n(stats.best)],
                [t("averageScore"), stats.games ? n((stats.total / stats.games).toFixed(1)) : "—"],
                [t("perfectGames"), n(stats.perfect)],
                [t("streak"), n(stats.streak)],
                ["🏅", n(stats.bestStreak)],
              ].map(([k, v]) => (
                <div key={k} className="rounded-xl bg-black/25 py-2">
                  <div className="truncate px-1 text-[10px] font-bold text-white/50 uppercase">{k}</div>
                  <div className="text-xl font-extrabold">{v}</div>
                </div>
              ))}
            </div>
          </section>
        )}
        {tab === "account" && (
          <div className="grid gap-3">
            <section className="glass rounded-3xl p-4">
              <div className="mb-1 text-sm font-extrabold tracking-wider text-white/70 uppercase">{t("account")}</div>
              <p className="mb-3 text-xs text-white/60">{t("accountHint")}</p>
              {!client ? (
                <p className="text-sm text-white/50">{t("accountUnavailable")}</p>
              ) : account ? (
                <div className="flex items-center justify-between gap-2">
                  <span className="min-w-0 truncate text-sm font-bold">{t("signedInAs", { email: account })}</span>
                  <GameButton size="sm" variant="dark" onClick={signOut}>
                    {t("signOut")}
                  </GameButton>
                </div>
              ) : sent ? (
                <p className="text-sm font-bold text-emerald-300">{t("linkSent")}</p>
              ) : (
                <div className="grid gap-2">
                  <TextInput type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("emailPlaceholder")} dir="ltr" />
                  <GameButton size="md" variant="blue" onClick={sendLink} disabled={!email}>
                    {t("sendMagicLink")}
                  </GameButton>
                </div>
              )}
            </section>
            <MadeBy />
            <section className="glass rounded-3xl p-4 text-sm">
              <div className="mb-1 font-extrabold">📲 {t("install")}</div>
              <p className="text-white/60">{isIos ? t("installIos") : "Chrome ⋮ → Install app"}</p>
            </section>
          </div>
        )}
      </div>
    </PageShell>
  );
}
