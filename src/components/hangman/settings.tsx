"use client";

import { CATEGORIES, normalizeHangmanSettings, type HangmanSettings, type HmCategoryChoice } from "@/games/hangman";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Field, Segmented, Toggle } from "../ui/primitives";

export function HangmanSettingsForm({ value, onChange }: { value: HangmanSettings; onChange: (s: HangmanSettings) => void }) {
  const { t } = useI18n();
  const set = (patch: Partial<HangmanSettings>) => onChange(normalizeHangmanSettings({ ...value, ...patch }));
  const master = value.gameMode === "hangman_master";
  const cats: HmCategoryChoice[] = ["mixed", ...CATEGORIES];
  return (
    <div className="grid min-w-0 grid-cols-1 gap-4" data-testid="hm-settings-form">
      <Field label={t("hm_mode")} hint={t(`modeDesc_${value.gameMode}` as MessageKey)}>
        <Segmented
          value={value.gameMode}
          onChange={(m) => set({ gameMode: m, rounds: m === "hangman_master" ? 1 : 5 })}
          options={(["hangman_master", "hangman_race"] as const).map((m) => ({ value: m, label: t(`mode_${m}`) }))}
          cols="grid-cols-2"
          testId="hm-mode"
        />
      </Field>
      <Field label={t("hm_language")}>
        <Segmented value={value.language} onChange={(v) => set({ language: v })} options={(["en", "ar"] as const).map((v) => ({ value: v, label: t(`lang_${v}`) }))} cols="grid-cols-2" testId="hm-language" />
      </Field>
      <Field label={t("hm_category")}>
        <Segmented value={value.category} onChange={(v) => set({ category: v })} options={cats.map((c) => ({ value: c, label: t(`cat_${c}` as MessageKey) }))} cols="grid-cols-4" />
      </Field>
      <Field label={t("players")}>
        <Segmented value={value.maxPlayers} onChange={(v) => set({ maxPlayers: v })} options={[2, 3, 4].map((v) => ({ value: v as 2 | 3 | 4, label: `${v}` }))} cols="grid-cols-3" />
      </Field>
      <Field label={master ? t("hm_roundsMaster") : t("hm_roundsRace")}>
        <Segmented
          value={value.rounds}
          onChange={(v) => set({ rounds: v })}
          options={(master ? [1, 2, 3] : [3, 5, 7, 10]).map((v) => ({ value: v, label: master ? `×${v}` : `${v}` }))}
          cols={master ? "grid-cols-3" : "grid-cols-4"}
        />
      </Field>
      <Field label={t("hm_lives")}>
        <Segmented value={value.lives} onChange={(v) => set({ lives: v })} options={[{ value: 6 as const, label: t("hm_lives6") }, { value: 9 as const, label: t("hm_lives9") }]} cols="grid-cols-2" />
      </Field>
      {master ? (
        <Field label={t("hm_guessTimer")}>
          <Segmented
            value={value.guessTimer}
            onChange={(v) => set({ guessTimer: v })}
            options={([0, 15, 30, 45, 60] as const).map((s) => ({ value: s, label: s === 0 ? t("noTimer") : t("seconds", { n: s }) }))}
            cols="grid-cols-5"
          />
        </Field>
      ) : (
        <Field label={t("hm_raceTimer")}>
          <Segmented
            value={value.raceTimer}
            onChange={(v) => set({ raceTimer: v })}
            options={([0, 60, 90, 120, 180] as const).map((s) => ({ value: s, label: s === 0 ? t("noTimer") : t("seconds", { n: s }) }))}
            cols="grid-cols-5"
          />
        </Field>
      )}
      <Toggle checked={value.spectators} onChange={(v) => set({ spectators: v })} label={t("spectators")} />
    </div>
  );
}

export function HangmanSettingsSummary({ settings }: { settings: HangmanSettings }) {
  const { t } = useI18n();
  const master = settings.gameMode === "hangman_master";
  const chips = [
    t(`mode_${settings.gameMode}`),
    t(`lang_${settings.language}`),
    t(`cat_${settings.category}` as MessageKey),
    master ? `${t("hm_roundsMaster")} ×${settings.rounds}` : `${t("hm_roundsRace")} ${settings.rounds}`,
    `❤ ${settings.lives}`,
    master ? `⏱ ${settings.guessTimer ? t("seconds", { n: settings.guessTimer }) : t("off")}` : `⏱ ${settings.raceTimer ? t("seconds", { n: settings.raceTimer }) : t("off")}`,
  ];
  return (
    <div className="flex flex-wrap justify-center gap-1.5" data-testid="settings-summary">
      {chips.map((c) => (
        <span key={c} className="rounded-full bg-white/8 px-2.5 py-1 text-xs font-bold text-white/80">
          {c}
        </span>
      ))}
    </div>
  );
}
