import type { BotLevel, RandomSource } from "@/game-engine";
import { ALPHABET, isSeparator, normalizeLetter, type HmLanguage } from "./letters";
import { wordsFor } from "./words";

/** Letter frequency order used by NORMAL bots. */
const FREQUENCY: Record<HmLanguage, string[]> = {
  en: [..."EAOTINSRHLDCUMPGYBFWKVXZJQ"],
  ar: [..."الميونهرتبكعدسفقحجشصطةزخضذغثظء"],
};

/**
 * Picks a letter using only public information (the mask and the guessed
 * letters). HARD bots narrow built-in words by the revealed pattern — they
 * never see the secret word.
 */
export function botLetter(level: BotLevel, lang: HmLanguage, mask: ReadonlyArray<string | null>, guessed: ReadonlySet<string>, rng: RandomSource): string {
  const remaining = [...ALPHABET[lang]].filter((l) => !guessed.has(l));
  if (remaining.length === 0) return [...ALPHABET[lang]][0];
  if (level === "easy") return remaining[rng.int(0, remaining.length - 1)];

  if (level === "hard") {
    const wrong = new Set([...guessed].filter((l) => !mask.some((c) => c !== null && !isSeparator(c) && normalizeLetter(c, lang) === l)));
    const candidates = wordsFor(lang, "mixed").filter((w) => {
      const chars = [...w];
      if (chars.length !== mask.length) return false;
      return chars.every((ch, i) => {
        const m = mask[i];
        if (isSeparator(ch) || (m !== null && isSeparator(m))) return ch === m;
        const key = normalizeLetter(ch, lang);
        if (!key || wrong.has(key)) return false;
        if (m === null) return !guessed.has(key);
        return normalizeLetter(m, lang) === key;
      });
    });
    if (candidates.length) {
      const counts = new Map<string, number>();
      for (const w of candidates) {
        const seen = new Set<string>();
        for (const ch of w) {
          const key = normalizeLetter(ch, lang);
          if (key && !guessed.has(key) && !seen.has(key)) {
            seen.add(key);
            counts.set(key, (counts.get(key) ?? 0) + 1);
          }
        }
      }
      const best = [...counts.entries()].sort((a, b) => b[1] - a[1])[0];
      if (best) return best[0];
    }
  }
  // normal (and hard fallback): mostly frequency order, a little randomness
  if (rng.int(1, 10) <= 8) {
    const next = FREQUENCY[lang].find((l) => !guessed.has(l));
    if (next) return next;
  }
  return remaining[rng.int(0, remaining.length - 1)];
}
