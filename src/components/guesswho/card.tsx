"use client";

import { motion } from "motion/react";
import { cardById, cardImage } from "@/games/guesswho";
import type { Lang } from "@/lib/i18n/dictionaries";

/** Gold Eye of Horus, drawn for the card backs and the hub art. */
export function EyeOfHorus({ className = "", stroke = "#f2c14e" }: { className?: string; stroke?: string }) {
  return (
    <svg viewBox="0 0 64 40" className={className} fill="none" stroke={stroke} strokeWidth={3} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M4 14C14 4 38 2 58 12" />
      <path d="M10 22c10-10 30-10 40 0-10 8-30 8-40 0z" />
      <circle cx="30" cy="21" r="5" fill={stroke} />
      <path d="M50 22h10" />
      <path d="M26 28l-4 10" />
      <path d="M34 29c2 6 8 9 14 7" />
    </svg>
  );
}

export function CardName({ cardId, lang, size = "sm" }: { cardId: string; lang: Lang; size?: "sm" | "lg" }) {
  const card = cardById(cardId);
  const name = card ? (lang === "ar" ? card.ar : card.en) : "?";
  // Sized against the tile's own width (cqw), so the longest word ("Tutankhamun") always fits.
  const longest = Math.max(1, ...name.split(/\s+/).map((w) => [...w].length));
  return (
    <div
      className={`papyrus kufi mx-auto max-w-full text-center font-bold ${size === "lg" ? "cartouche truncate px-3 py-1 text-base leading-tight" : "line-clamp-2 rounded-[5px] border border-[#c9962b] px-[2px] py-[1px] leading-[1.08]"}`}
      style={size === "sm" ? { fontSize: `max(5.5px, min(${lang === "ar" ? "8.5px" : "11px"}, calc((100cqw - 10px) / ${(longest * (lang === "ar" ? 0.72 : 0.6)).toFixed(2)})))` } : undefined}
      dir={lang === "ar" ? "rtl" : "ltr"}
      lang={lang}
    >
      {name}
    </div>
  );
}

/** Just the photo + name, for reveals and results. */
export function CardFace({ cardId, lang, className = "", nameSize = "sm" }: { cardId: string; lang: Lang; className?: string; nameSize?: "sm" | "lg" }) {
  return (
    <div className={`gold-frame relative overflow-hidden rounded-[10px] p-[3px] [container-type:inline-size] ${className}`}>
      <div className="relative h-full w-full overflow-hidden rounded-[8px] bg-[#1a347a]">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={cardImage(cardId)} alt="" loading="lazy" decoding="async" draggable={false} className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-[3px] bottom-[3px]">
          <CardName cardId={cardId} lang={lang} size={nameSize} />
        </div>
      </div>
    </div>
  );
}

export function CardBack({ className = "" }: { className?: string }) {
  return (
    <div className={`gold-frame overflow-hidden rounded-[10px] p-[3px] ${className}`}>
      <div className="lapis relative flex h-full w-full flex-col items-center justify-center overflow-hidden rounded-[8px]">
        <div className="hiero-band absolute inset-x-0 top-0 h-[14%] opacity-70" />
        <EyeOfHorus className="w-[62%]" />
        <div className="hiero-band absolute inset-x-0 bottom-0 h-[14%] opacity-70" />
      </div>
    </div>
  );
}

/**
 * A board card that flips down (back showing) like the plastic flaps of the
 * real game. `mode` tints it for guessing / hints.
 */
export function GwCardTile({
  cardId,
  lang,
  down,
  onTap,
  mode = "normal",
  disabled = false,
}: {
  cardId: string;
  lang: Lang;
  down: boolean;
  onTap?: () => void;
  mode?: "normal" | "guess";
  disabled?: boolean;
}) {
  const slug = cardId.split("/")[1];
  return (
    <button
      type="button"
      onClick={onTap}
      disabled={disabled}
      data-testid={`gw-card-${slug}`}
      data-down={down ? "yes" : "no"}
      className="relative h-full w-full min-w-0 [perspective:600px] disabled:cursor-default"
      aria-label={cardById(cardId)?.[lang] ?? slug}
    >
      <motion.div className="preserve-3d relative h-full w-full" initial={false} animate={{ rotateX: down ? 180 : 0 }} transition={{ type: "spring", stiffness: 260, damping: 22 }}>
        <div className="backface-hidden absolute inset-0">
          <CardFace cardId={cardId} lang={lang} className={`h-full w-full ${mode === "guess" && !down ? "ring-2 ring-[#ffcf4a] ring-offset-1 ring-offset-transparent" : ""}`} />
        </div>
        <div className="backface-hidden absolute inset-0 [transform:rotateX(180deg)]">
          <CardBack className="h-full w-full" />
        </div>
      </motion.div>
    </button>
  );
}
