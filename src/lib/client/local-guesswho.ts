"use client";

import type { BotLevel, PlayerColor } from "@/game-engine";
import {
  createGuessWhoRoom,
  executeGuessWho,
  guessWhoPersonal,
  nextWakeGuessWho,
  toPublicGuessWho,
  type GuessWhoRoomState,
  type GuessWhoServerState,
  type GuessWhoSettings,
  type GwCommand,
} from "@/games/guesswho";
import { useLocalGame, type LocalAdapter } from "./local-game";

const adapter: LocalAdapter<GuessWhoServerState, GuessWhoRoomState, GwCommand> = {
  create: (p, ctx) => createGuessWhoRoom({ ...p, settings: p.settings as Partial<GuessWhoSettings> }, ctx),
  execute: (s, c, ctx) => {
    const r = executeGuessWho(s, c, ctx);
    return r.ok ? { ok: true, state: r.state, events: r.events, data: r.data } : { ok: false, state: r.state, events: r.events, error: r.error };
  },
  toPublic: toPublicGuessWho,
  personal: guessWhoPersonal,
  nextWake: nextWakeGuessWho,
};

/** Guess Who vs the bot on this phone (no timer, ready-made questions only). */
export function useLocalGuessWho() {
  const { room, start, stop } = useLocalGame(adapter);
  return {
    room,
    stop,
    start: (settings: Partial<GuessWhoSettings>, level: BotLevel, profile: { nickname: string; avatar: string; color: PlayerColor | null }) =>
      start({ ...settings, turnTimer: 0, freeQuestions: false }, level, profile),
  };
}
