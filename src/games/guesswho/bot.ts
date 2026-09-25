import type { BotLevel, RandomSource } from "@/game-engine";
import { answerFor, GW_QUESTIONS } from "./cards";
import type { GwRound } from "./types";

export type GwBotMove = { kind: "ask"; questionId: string } | { kind: "guess"; cardId: string };

/** Board cards still possible for `playerId`, from the answers they received (public info only). */
export function candidatesFor(round: GwRound, playerId: string): string[] {
  const mine = round.log.filter((l) => l.askerId === playerId);
  return round.board.filter((cardId) =>
    mine.every((l) => {
      if (l.kind === "preset" && l.questionId && l.answer) return answerFor(cardId, l.questionId) === (l.answer === "yes");
      if (l.kind === "guess" && l.cardId) return l.cardId !== cardId;
      return true;
    }),
  );
}

/** Cards a player's answers rule out: used by bots and by the "flip the NO cards" helper. */
export function eliminatedBy(round: GwRound, playerId: string): string[] {
  const keep = new Set(candidatesFor(round, playerId));
  return round.board.filter((id) => !keep.has(id));
}

/** Picks the bot's move without ever looking at the opponent's secret. */
export function botMove(level: BotLevel, round: GwRound, botId: string, rng: RandomSource): GwBotMove {
  const candidates = candidatesFor(round, botId);
  const pick = <T>(xs: T[]) => xs[rng.int(0, xs.length - 1)];
  if (candidates.length <= 1) return { kind: "guess", cardId: candidates[0] ?? pick(round.board) };

  const asked = new Set(round.log.filter((l) => l.askerId === botId && l.questionId).map((l) => l.questionId));
  const splits = GW_QUESTIONS[round.category]
    .filter((q) => !asked.has(q.id))
    .map((q) => {
      const yes = candidates.filter((c) => answerFor(c, q.id)).length;
      return { q, yes, score: Math.abs(yes - candidates.length / 2) };
    })
    .filter((s) => s.yes > 0 && s.yes < candidates.length);
  if (splits.length === 0) return { kind: "guess", cardId: pick(candidates) };

  if (level === "easy") {
    if (candidates.length <= 2) return { kind: "guess", cardId: pick(candidates) };
    return { kind: "ask", questionId: pick(splits).q.id };
  }
  splits.sort((a, b) => a.score - b.score);
  if (level === "hard") return { kind: "ask", questionId: splits[0].q.id };
  // normal: one of the three best questions; gambles when down to two cards
  if (candidates.length === 2 && rng.int(1, 2) === 1) return { kind: "guess", cardId: pick(candidates) };
  return { kind: "ask", questionId: pick(splits.slice(0, 3)).q.id };
}
