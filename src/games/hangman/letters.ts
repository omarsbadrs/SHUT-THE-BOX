/**
 * Letter handling for English and Arabic Hangman.
 *
 * Arabic: hamza/alef variants fold onto their base letter (أ إ آ ٱ → ا, ى → ي,
 * ؤ → و, ئ → ي) and tashkeel is stripped, so one key reveals every form.
 * The revealed characters keep their original spelling.
 */

export type HmLanguage = "en" | "ar";

export const KEYBOARDS: Record<HmLanguage, string[][]> = {
  en: [
    ["Q", "W", "E", "R", "T", "Y", "U", "I", "O", "P"],
    ["A", "S", "D", "F", "G", "H", "J", "K", "L"],
    ["Z", "X", "C", "V", "B", "N", "M"],
  ],
  ar: [
    ["ض", "ص", "ث", "ق", "ف", "غ", "ع", "ه", "خ", "ح"],
    ["ج", "ش", "س", "ي", "ب", "ل", "ا", "ت", "ن", "م"],
    ["ك", "ط", "ذ", "ء", "ر", "ة", "و", "ز", "ظ", "د"],
  ],
};

export const ALPHABET: Record<HmLanguage, Set<string>> = {
  en: new Set(KEYBOARDS.en.flat()),
  ar: new Set(KEYBOARDS.ar.flat()),
};

const TASHKEEL = /[ً-ٰٟـ]/g; // harakat, superscript alef, tatweel
const AR_FOLD: Record<string, string> = { "أ": "ا", "إ": "ا", "آ": "ا", "ٱ": "ا", "ى": "ي", "ؤ": "و", "ئ": "ي" };

/** Canonical key for a single character, or null if it isn't a guessable letter. */
export function normalizeLetter(ch: string, lang: HmLanguage): string | null {
  if (lang === "en") {
    const up = ch.toUpperCase();
    return ALPHABET.en.has(up) ? up : null;
  }
  const folded = AR_FOLD[ch] ?? ch;
  return ALPHABET.ar.has(folded) ? folded : null;
}

/** Characters that are always shown (never guessed). */
export function isSeparator(ch: string): boolean {
  return ch === " " || ch === "-";
}

export type WordCheck = { ok: true; display: string } | { ok: false; reason: "too_short" | "too_long" | "invalid_chars" };

export const MIN_LETTERS = 2;
export const MAX_CHARS = 24;

/** Cleans and validates a word or phrase for the chosen language. */
export function normalizeWord(raw: string, lang: HmLanguage): WordCheck {
  let s = raw.normalize("NFC").replace(TASHKEEL, "").replace(/\s+/g, " ").trim();
  if (lang === "en") s = s.toUpperCase();
  s = s.replace(/\s*-\s*/g, "-");
  if (s.length > MAX_CHARS) return { ok: false, reason: "too_long" };
  let letters = 0;
  for (const ch of s) {
    if (isSeparator(ch)) continue;
    if (normalizeLetter(ch, lang) === null) return { ok: false, reason: "invalid_chars" };
    letters++;
  }
  if (letters < MIN_LETTERS) return { ok: false, reason: "too_short" };
  return { ok: true, display: s };
}

/** Public mask: revealed characters, separators, and null for hidden letters. */
export function maskFor(display: string, guessed: ReadonlySet<string>, lang: HmLanguage): Array<string | null> {
  return [...display].map((ch) => {
    if (isSeparator(ch)) return ch;
    const key = normalizeLetter(ch, lang);
    return key && guessed.has(key) ? ch : null;
  });
}

/** Skeleton shown before any guess: separators only. */
export function skeletonFor(display: string): Array<string | null> {
  return [...display].map((ch) => (isSeparator(ch) ? ch : null));
}

export function isSolved(mask: ReadonlyArray<string | null>): boolean {
  return mask.every((c) => c !== null);
}

/** Positions of a guessed key in the word. */
export function positionsOf(display: string, key: string, lang: HmLanguage): number[] {
  const out: number[] = [];
  [...display].forEach((ch, i) => {
    if (!isSeparator(ch) && normalizeLetter(ch, lang) === key) out.push(i);
  });
  return out;
}

/**
 * Letter-only comparison key for "solve the word" guesses. Arabic is lenient
 * about taa marbuta: many people type ه for ة, so they compare equal here.
 */
export function solveKey(text: string, lang: HmLanguage): string {
  const clean = normalizeWord(text, lang);
  const src = clean.ok ? clean.display : text;
  const key = [...src].map((ch) => normalizeLetter(ch, lang) ?? "").join("");
  return lang === "ar" ? key.replace(/ة/g, "ه") : key;
}

export function letterCount(display: string): number {
  return [...display].filter((ch) => !isSeparator(ch)).length;
}
