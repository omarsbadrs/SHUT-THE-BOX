"use client";

import { cardImage, GW_CATEGORIES, normalizeGuessWhoSettings, type GuessWhoSettings, type GwCategory } from "@/games/guesswho";
import { useI18n } from "@/lib/i18n/context";
import type { MessageKey } from "@/lib/i18n/dictionaries";
import { Field, Segmented, Toggle } from "../ui/primitives";

export type GuessWhoSection = "game" | "rules";

/** Photo used on each deck's picker tile. */
export const DECK_COVER: Record<GwCategory, string> = {
  food: "food/koshary",
  stars: "stars/soad_hosny",
  music_sport: "music_sport/mohamed_salah",
  pharaohs: "pharaohs/tutankhamun",
};

export function DeckPicker({ value, onChange }: { value: GwCategory; onChange: (c: GwCategory) => void }) {
  const { t } = useI18n();
  return (
    <div className="grid grid-cols-2 gap-2" data-testid="gw-deck">
      {GW_CATEGORIES.map((c) => (
        <button
          key={c}
          type="button"
          onClick={() => onChange(c)}
          aria-pressed={value === c}
          data-testid={`gw-deck-${c}`}
          className={`relative h-[clamp(52px,11dvh,84px)] overflow-hidden rounded-2xl border-2 text-start transition ${value === c ? "border-[#ffcf4a] shadow-[0_0_18px_-4px_#ffcf4a]" : "border-white/10 opacity-80"}`}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={cardImage(DECK_COVER[c])} alt="" className="absolute inset-0 h-full w-full object-cover object-top" />
          <span className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/30 to-transparent" />
          <span className="kufi absolute inset-x-2 bottom-1.5 text-[13px] leading-tight font-bold text-white">{t(`gw_cat_${c}` as MessageKey)}</span>
          {value === c && <span className="absolute end-1.5 top-1.5 rounded-full bg-[#ffcf4a] px-1.5 text-[10px] font-extrabold text-[#2a1a00]">✓</span>}
        </button>
      ))}
    </div>
  );
}

/** One short section of the Guess Who settings (fits a phone screen — no scrolling). */
export function GuessWhoSettingsForm({ value, onChange, section }: { value: GuessWhoSettings; onChange: (s: GuessWhoSettings) => void; section: GuessWhoSection }) {
  const { t } = useI18n();
  const set = (patch: Partial<GuessWhoSettings>) => onChange(normalizeGuessWhoSettings({ ...value, ...patch }));

  if (section === "game")
    return (
      <div className="grid min-w-0 grid-cols-1 gap-3" data-testid="gw-settings-form">
        <Field label={t("gw_category")}>
          <DeckPicker value={value.category} onChange={(category) => set({ category })} />
        </Field>
        <Field label={t("gw_boardSize")}>
          <Segmented
            value={value.boardSize}
            onChange={(boardSize) => set({ boardSize })}
            options={([16, 20, 24] as const).map((n) => ({
              value: n,
              label: `${n}`,
            }))}
            cols="grid-cols-3"
            testId="gw-board-size"
          />
        </Field>
        <Field label={t("gw_match")}>
          <Segmented
            value={value.rounds}
            onChange={(rounds) => set({ rounds })}
            options={([1, 3, 5] as const).map((n) => ({
              value: n,
              label: n === 1 ? t("gw_oneRound") : t("gw_bestOf", { n }),
            }))}
            cols="grid-cols-3"
            testId="gw-rounds"
          />
        </Field>
      </div>
    );

  return (
    <div className="grid min-w-0 grid-cols-1 gap-3" data-testid="gw-settings-form">
      <Field label={t("gw_turnTimer")}>
        <Segmented
          value={value.turnTimer}
          onChange={(turnTimer) => set({ turnTimer })}
          options={([0, 30, 60, 90] as const).map((s) => ({
            value: s,
            label: s === 0 ? t("noTimer") : t("seconds", { n: s }),
          }))}
          cols="grid-cols-4"
        />
      </Field>
      <Toggle checked={value.freeQuestions} onChange={(freeQuestions) => set({ freeQuestions })} label={`✍ ${t("gw_freeQuestions")}`} testId="gw-free-toggle" />
      <Toggle checked={value.wrongGuessLoses} onChange={(wrongGuessLoses) => set({ wrongGuessLoses })} label={`🎯 ${t("gw_wrongGuessLoses")}`} />
      <Toggle checked={value.spectators} onChange={(spectators) => set({ spectators })} label={t("spectators")} />
    </div>
  );
}

export function GuessWhoSettingsSummary({ settings }: { settings: GuessWhoSettings }) {
  const { t } = useI18n();
  const chips = [
    t(`gw_cat_${settings.category}` as MessageKey),
    `🂠 ${settings.boardSize}`,
    settings.rounds === 1 ? t("gw_oneRound") : t("gw_bestOf", { n: settings.rounds }),
    `⏱ ${settings.turnTimer ? t("seconds", { n: settings.turnTimer }) : t("off")}`,
    ...(settings.freeQuestions ? ["✍"] : []),
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
