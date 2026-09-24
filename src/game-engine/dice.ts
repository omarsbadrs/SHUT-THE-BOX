import type { DiceRoll } from "./types";

/** Randomness is injected so the server can use a CSPRNG and tests can be deterministic. */
export interface RandomSource {
  /** Uniform integer in [min, max], inclusive. */
  int(min: number, max: number): number;
}

/** Cryptographically secure source (Web Crypto; available in Node 20+ and browsers). */
export const secureRandom: RandomSource = {
  int(min, max) {
    const range = max - min + 1;
    if (range <= 0 || range > 2 ** 32) throw new Error("invalid range");
    const limit = Math.floor(2 ** 32 / range) * range;
    const buf = new Uint32Array(1);
    // Rejection sampling avoids modulo bias.
    for (;;) {
      globalThis.crypto.getRandomValues(buf);
      if (buf[0] < limit) return min + (buf[0] % range);
    }
  },
};

/** Deterministic source for tests: replays a fixed list of values. */
export function sequenceRandom(values: number[]): RandomSource {
  let i = 0;
  return {
    int(min, max) {
      const v = values[i % values.length];
      i++;
      return Math.min(max, Math.max(min, v));
    },
  };
}

export function getDiceTotal(die1: number, die2: number | null): number {
  return die1 + (die2 ?? 0);
}

export function makeRoll(die1: number, die2: number | null): DiceRoll {
  return {
    die1,
    die2,
    total: getDiceTotal(die1, die2),
    isDouble: die2 !== null && die1 === die2,
    diceCount: die2 === null ? 1 : 2,
  };
}

export function rollDice(rng: RandomSource, count: 1 | 2 = 2): DiceRoll {
  const die1 = rng.int(1, 6);
  const die2 = count === 2 ? rng.int(1, 6) : null;
  return makeRoll(die1, die2);
}

export function isDieValue(n: unknown): n is number {
  return typeof n === "number" && Number.isInteger(n) && n >= 1 && n <= 6;
}
