"use client";

import type { BotLevel, PlayerColor } from "@/game-engine";
import {
  createConnect4Room,
  executeConnect4,
  nextWakeConnect4,
  toPublicConnect4,
  type C4Command,
  type Connect4RoomState,
  type Connect4ServerState,
  type Connect4Settings,
} from "@/games/connect4";
import { useLocalGame, type LocalAdapter } from "./local-game";

const adapter: LocalAdapter<Connect4ServerState, Connect4RoomState, C4Command> = {
  create: (p, ctx) => createConnect4Room({ ...p, settings: p.settings as Partial<Connect4Settings> }, ctx),
  execute: (s, c, ctx) => {
    const r = executeConnect4(s, c, ctx);
    return r.ok ? { ok: true, state: r.state, events: r.events, data: r.data } : { ok: false, state: r.state, events: r.events, error: r.error };
  },
  toPublic: toPublicConnect4,
  personal: () => null,
  nextWake: nextWakeConnect4,
};

/** Connect 4 vs the bot on this phone. */
export function useLocalConnect4() {
  const { room, start, stop } = useLocalGame(adapter);
  return {
    room,
    stop,
    start: (settings: Partial<Connect4Settings>, level: BotLevel, profile: { nickname: string; avatar: string; color: PlayerColor | null }) => start({ ...settings, turnTimer: 0 }, level, profile),
  };
}
