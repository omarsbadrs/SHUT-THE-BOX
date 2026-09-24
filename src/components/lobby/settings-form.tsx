"use client";

import { useState } from "react";
import type { GameMode, GameSettings, TimerSeconds } from "@/game-engine";
import { MAX_CUSTOM_ROUNDS, MODE_PRESETS, normalizeSettings } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { Field, Segmented, Toggle } from "../ui/primitives";

type FormatKey = "single" | "bo3" | "bo5" | "bo7" | "ft3" | "ft5" | "custom" | "endless";

function formatKey(s: GameSettings): FormatKey {
  switch (s.matchFormat) {
    case "single":
      return "single";
    case "best_of":
      return s.rounds === 3 ? "bo3" : s.rounds === 7 ? "bo7" : "bo5";
    case "first_to":
      return s.rounds === 5 ? "ft5" : "ft3";
    case "fixed":
      return "custom";
    case "endless":
      return "endless";
  }
}

const TIMERS: TimerSeconds[] = [0, 15, 30, 45, 60];

export function SettingsForm({ value, onChange }: { value: GameSettings; onChange: (s: GameSettings) => void }) {
  const { t } = useI18n();
  const [advanced, setAdvanced] = useState(false);
  const set = (patch: Partial<GameSettings>) => onChange(normalizeSettings({ ...value, ...patch }));
  const fk = formatKey(value);

  const setFormat = (k: FormatKey) => {
    const map: Record<FormatKey, Partial<GameSettings>> = {
      single: { matchFormat: "single", rounds: 1 },
      bo3: { matchFormat: "best_of", rounds: 3 },
      bo5: { matchFormat: "best_of", rounds: 5 },
      bo7: { matchFormat: "best_of", rounds: 7 },
      ft3: { matchFormat: "first_to", rounds: 3 },
      ft5: { matchFormat: "first_to", rounds: 5 },
      custom: { matchFormat: "fixed", rounds: value.matchFormat === "fixed" ? value.rounds : 4 },
      endless: { matchFormat: "endless", rounds: 0 },
    };
    set(map[k]);
  };

  const timerOptions = TIMERS.map((s) => ({ value: s, label: s === 0 ? t("noTimer") : t("seconds", { n: s }) }));

  return (
    <div className="grid gap-4" data-testid="settings-form">
      <Field label={t("gameMode")} hint={t(`modeDesc_${value.gameMode}`)}>
        <Segmented<GameMode>
          value={value.gameMode}
          onChange={(m) => set({ gameMode: m, ...MODE_PRESETS[m] })}
          options={(["faceoff", "classic", "race", "tournament"] as const).map((m) => ({ value: m, label: t(`mode_${m}`) }))}
          testId="mode"
        />
      </Field>
      <Field label={t("players")}>
        <Segmented<2 | 3 | 4> value={value.maxPlayers} onChange={(v) => set({ maxPlayers: v })} options={[2, 3, 4].map((v) => ({ value: v as 2 | 3 | 4, label: `${v}` }))} />
      </Field>
      <Field label={t("rounds")}>
        <Segmented<FormatKey>
          value={fk}
          onChange={setFormat}
          testId="format"
          options={[
            { value: "single", label: t("format_single") },
            { value: "bo3", label: t("format_best_of", { n: 3 }) },
            { value: "bo5", label: t("format_best_of", { n: 5 }) },
            { value: "bo7", label: t("format_best_of", { n: 7 }) },
            { value: "ft3", label: t("format_first_to", { n: 3 }) },
            { value: "ft5", label: t("format_first_to", { n: 5 }) },
            { value: "custom", label: t("custom") },
            { value: "endless", label: t("format_endless") },
          ]}
        />
        {fk === "custom" && (
          <div className="mt-2 flex items-center gap-3">
            <input
              type="range"
              min={1}
              max={MAX_CUSTOM_ROUNDS}
              value={value.rounds}
              onChange={(e) => set({ rounds: Number(e.target.value) })}
              className="flex-1 accent-[#ffcf4a]"
            />
            <span className="w-24 text-end font-extrabold">{t("format_fixed", { n: value.rounds })}</span>
          </div>
        )}
      </Field>
      <Field label={t("scoring")}>
        <Segmented
          value={value.scoringMode}
          onChange={(v) => set({ scoringMode: v })}
          options={(["round_wins", "match_points", "cumulative_low"] as const).map((v) => ({ value: v, label: t(`scoring_${v}`) }))}
        />
      </Field>
      <Toggle checked={value.doubleExtraTurn} onChange={(v) => set({ doubleExtraTurn: v })} label={t("doublesExtra")} testId="doubles-toggle" />
      <Field label={t("hints")}>
        <Segmented value={value.hints} onChange={(v) => set({ hints: v })} options={(["off", "limited", "on", "all"] as const).map((v) => ({ value: v, label: t(`hints_${v}`) }))} />
      </Field>
      <Toggle checked={value.spectators} onChange={(v) => set({ spectators: v })} label={t("spectators")} />

      <button type="button" onClick={() => setAdvanced((a) => !a)} className="text-start text-sm font-extrabold text-[#ffcf4a]">
        {advanced ? "▾" : "▸"} {t("advanced")}
      </button>
      {advanced && (
        <div className="grid gap-4">
          <Field label={t("rollTimer")}>
            <Segmented value={value.rollTimer} onChange={(v) => set({ rollTimer: v })} options={timerOptions} />
          </Field>
          <Field label={t("moveTimer")}>
            <Segmented value={value.moveTimer} onChange={(v) => set({ moveTimer: v })} options={timerOptions} />
          </Field>
          <Toggle checked={value.oneDieEndgame} onChange={(v) => set({ oneDieEndgame: v })} label={t("oneDie")} />
          {value.oneDieEndgame && (
            <Segmented value={value.oneDieThreshold} onChange={(v) => set({ oneDieThreshold: v })} options={[6, 7, 8].map((v) => ({ value: v, label: t("oneDieThreshold", { n: v }) }))} />
          )}
          <Field label={t("disconnectRule")}>
            <Segmented value={value.disconnectRule} onChange={(v) => set({ disconnectRule: v })} options={(["wait", "skip", "block"] as const).map((v) => ({ value: v, label: t(`rule_${v}`) }))} />
          </Field>
          <Field label={t("tieBreak")}>
            <Segmented value={value.tieBreak} onChange={(v) => set({ tieBreak: v })} options={(["tiles", "tiles_roll", "shared"] as const).map((v) => ({ value: v, label: t(`tie_${v}`) }))} />
          </Field>
          <Field label={t("starter")}>
            <Segmented value={value.starterRule} onChange={(v) => set({ starterRule: v })} options={(["rotate", "random"] as const).map((v) => ({ value: v, label: t(`starter_${v}`) }))} />
          </Field>
        </div>
      )}
    </div>
  );
}

export function SettingsSummary({ settings }: { settings: GameSettings }) {
  const { t } = useI18n();
  const format =
    settings.matchFormat === "single"
      ? t("format_single")
      : settings.matchFormat === "best_of"
        ? t("format_best_of", { n: settings.rounds })
        : settings.matchFormat === "first_to"
          ? t("format_first_to", { n: settings.rounds })
          : settings.matchFormat === "fixed"
            ? t("format_fixed", { n: settings.rounds })
            : t("format_endless");
  const chips = [
    t(`mode_${settings.gameMode}`),
    format,
    t(`scoring_${settings.scoringMode}`),
    settings.doubleExtraTurn ? `⚄⚄ ${t("on")}` : `⚄⚄ ${t("off")}`,
    settings.rollTimer || settings.moveTimer ? `⏱ ${settings.rollTimer || "–"}/${settings.moveTimer || "–"}s` : `⏱ ${t("off")}`,
    `💡 ${t(`hints_${settings.hints}`)}`,
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
