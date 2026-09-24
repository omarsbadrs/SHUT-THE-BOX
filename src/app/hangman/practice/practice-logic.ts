import { secureRandom } from "@/game-engine";
import { categoryOf, wordsFor, type HmCategoryChoice, type HmLanguage } from "@/games/hangman";

export { CATEGORIES, isSolved, maskFor, normalizeLetter, positionsOf, solveKey } from "@/games/hangman";
export type { HmCategoryChoice, HmLanguage };

/** Random built-in word using the Web Crypto CSPRNG. */
export function secureRandomWord(lang: HmLanguage, category: HmCategoryChoice): { word: string; category: string } {
  const list = wordsFor(lang, category);
  const word = list[secureRandom.int(0, list.length - 1)];
  return { word, category: category === "mixed" ? (categoryOf(lang, word) ?? "mixed") : category };
}
