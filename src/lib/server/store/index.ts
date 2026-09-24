import "server-only";
import { GameError } from "@/game-engine";
import { storeMode } from "../env";
import { MemoryStore } from "./memory";
import { SupabaseStore } from "./supabase";
import type { RoomStore } from "./types";

const g = globalThis as typeof globalThis & { __shut10Store?: RoomStore };

export function getStore(): RoomStore {
  const mode = storeMode();
  if (mode === "unconfigured") throw new GameError("NOT_CONFIGURED");
  if (!g.__shut10Store || g.__shut10Store.kind !== mode) {
    g.__shut10Store = mode === "supabase" ? new SupabaseStore() : new MemoryStore();
  }
  return g.__shut10Store;
}

export type { RoomStore } from "./types";
