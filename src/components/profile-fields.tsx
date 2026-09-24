"use client";

import { AVATARS, COLORS, type PlayerColor } from "@/game-engine";
import { useI18n } from "@/lib/i18n/context";
import { ColorIcon, PLAYER_STYLE } from "./game/theme";
import { Field, TextInput } from "./ui/primitives";

/** Nickname + avatar + color preference, shared by create and join. */
export function ProfileFields({
  nickname,
  setNickname,
  avatar,
  setAvatar,
  color,
  setColor,
  takenColors = [],
  allowAny = true,
}: {
  nickname: string;
  setNickname: (v: string) => void;
  avatar: string;
  setAvatar: (v: string) => void;
  color: PlayerColor | null;
  setColor: (v: PlayerColor | null) => void;
  takenColors?: PlayerColor[];
  allowAny?: boolean;
}) {
  const { t } = useI18n();
  return (
    <div className="grid min-w-0 grid-cols-1 gap-3">
      <Field label={t("nickname")}>
        <TextInput
          value={nickname}
          maxLength={16}
          autoComplete="nickname"
          placeholder={t("nicknamePlaceholder")}
          aria-label={t("nickname")}
          onChange={(e) => setNickname(e.target.value)}
          data-testid="nickname"
          enterKeyHint="done"
        />
      </Field>
      <Field label={t("avatar")}>
        {/* two rows of eight: always fits, never scrolls */}
        <div className="grid grid-cols-8 gap-1.5">
          {AVATARS.map((a) => (
            <button
              type="button"
              key={a}
              onClick={() => setAvatar(a)}
              aria-pressed={a === avatar}
              aria-label={a}
              className={`flex aspect-square min-w-0 items-center justify-center rounded-xl text-[clamp(1.1rem,5.5vw,1.6rem)] transition ${a === avatar ? "bg-[#ffcf4a]/25 ring-2 ring-[#ffcf4a]" : "bg-white/5"}`}
            >
              {a}
            </button>
          ))}
        </div>
      </Field>
      <Field label={t("colorPreference")}>
        <div className={`grid gap-2 ${allowAny ? "grid-cols-5" : "grid-cols-4"}`}>
          {allowAny && (
            <button type="button" onClick={() => setColor(null)} aria-pressed={color === null} className={`h-12 rounded-2xl text-xs font-extrabold ${color === null ? "bg-white/20 ring-2 ring-white" : "bg-white/5"}`}>
              {t("colorAny")}
            </button>
          )}
          {COLORS.map((c) => {
            const taken = takenColors.includes(c);
            const s = PLAYER_STYLE[c];
            return (
              <button
                type="button"
                key={c}
                disabled={taken}
                onClick={() => setColor(c)}
                aria-pressed={color === c}
                data-testid={`color-${c}`}
                className={`flex h-12 flex-col items-center justify-center gap-0.5 rounded-2xl text-[10px] font-extrabold transition disabled:opacity-25 ${color === c ? "scale-105 ring-2 ring-[#ffcf4a]" : ""}`}
                style={{ background: `linear-gradient(180deg, ${s.light}, ${s.base})`, color: s.text }}
              >
                <ColorIcon color={c} size={14} className="drop-shadow" />
                {t(c)}
              </button>
            );
          })}
        </div>
      </Field>
    </div>
  );
}
