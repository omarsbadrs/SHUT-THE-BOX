"use client";

import { normalizeConnect4Settings, type C4BoardSize, type Connect4Settings } from "@/games/connect4";
import { useI18n } from "@/lib/i18n/context";
import { Field, Segmented, Toggle } from "../ui/primitives";
import { Disc } from "./disc";

export type Connect4Section = "game" | "rules";

/** One short section of the Connect 4 settings (fits a phone screen — no scrolling). */
export function Connect4SettingsForm({ value, onChange, section }: { value: Connect4Settings; onChange: (s: Connect4Settings) => void; section: Connect4Section }) {
  const { t } = useI18n();
  const set = (patch: Partial<Connect4Settings>) => onChange(normalizeConnect4Settings({ ...value, ...patch }));

  if (section === "game")
    return (
      <div className="grid min-w-0 grid-cols-1 gap-3" data-testid="c4-settings-form">
        <Field label={t("c4_mode")} hint={t(`modeDesc_${value.gameMode}`)}>
          <Segmented
            value={value.gameMode}
            onChange={(gameMode) => set({ gameMode })}
            options={(["c4_classic", "c4_popout"] as const).map((m) => ({ value: m, label: t(`mode_${m}`) }))}
            cols="grid-cols-2"
            testId="c4-mode"
          />
        </Field>
        <Field label={t("c4_board")}>
          <Segmented
            value={value.boardSize}
            onChange={(boardSize) => set({ boardSize })}
            options={(["7x6", "8x7", "9x7"] as C4BoardSize[]).map((b) => ({ value: b, label: b.replace("x", " × ") }))}
            cols="grid-cols-3"
            testId="c4-board-size"
          />
        </Field>
        <Field label={t("c4_connect")}>
          <Segmented
            value={value.connect}
            onChange={(connect) => set({ connect })}
            options={([4, 5] as const).map((n) => ({
              value: n,
              label: (
                <span className="inline-flex items-center justify-center gap-0.5">
                  {Array.from({ length: n }, (_, i) => (
                    <Disc key={i} color={i % 2 ? "yellow" : "red"} className="h-3.5 w-3.5" />
                  ))}
                  <span className="ms-1">{n}</span>
                </span>
              ),
            }))}
            cols="grid-cols-2"
            testId="c4-connect"
          />
        </Field>
      </div>
    );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3" data-testid="c4-settings-form">
      <Field label={t("gw_match")}>
        <Segmented
          value={value.rounds}
          onChange={(rounds) => set({ rounds })}
          options={([1, 3, 5] as const).map((n) => ({ value: n, label: n === 1 ? t("gw_oneRound") : t("gw_bestOf", { n }) }))}
          cols="grid-cols-3"
          testId="c4-rounds"
        />
      </Field>
      <Field label={t("c4_turnTimer")}>
        <Segmented
          value={value.turnTimer}
          onChange={(turnTimer) => set({ turnTimer })}
          options={([0, 10, 20, 30] as const).map((s) => ({ value: s, label: s === 0 ? t("noTimer") : t("seconds", { n: s }) }))}
          cols="grid-cols-4"
        />
      </Field>
      <Field label={t("c4_starter")}>
        <Segmented
          value={value.starter}
          onChange={(starter) => set({ starter })}
          options={(["alternate", "loser", "random"] as const).map((s) => ({ value: s, label: t(`c4_starter_${s}`) }))}
          cols="grid-cols-3"
        />
      </Field>
      <Toggle checked={value.spectators} onChange={(spectators) => set({ spectators })} label={t("spectators")} />
    </div>
  );
}

export function Connect4SettingsSummary({ settings }: { settings: Connect4Settings }) {
  const { t } = useI18n();
  const chips = [
    t(`mode_${settings.gameMode}`),
    settings.boardSize.replace("x", "×"),
    `${settings.connect} 🔴`,
    settings.rounds === 1 ? t("gw_oneRound") : t("gw_bestOf", { n: settings.rounds }),
    `⏱ ${settings.turnTimer ? t("seconds", { n: settings.turnTimer }) : t("off")}`,
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
