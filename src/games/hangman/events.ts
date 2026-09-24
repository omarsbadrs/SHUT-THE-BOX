import type { ConnectionStatus, PlayerColor, RoomPlayer } from "@/game-engine";
import type { HangmanSettings, HmCategoryChoice, HmMatchResult, HmRaceStatus, HmRoundResult, HmScore } from "./types";
import type { HmLanguage } from "./letters";

/**
 * Hangman events. Lobby events share names and shapes with SHUT10 so the
 * database projection (room_players) works for both games. Game events are
 * prefixed HM_. Secrets are never in events: the word appears only in
 * HM_ROUND_ENDED, and race events carry progress counts, not letters.
 */
export type HmEventBody =
  | { type: "ROOM_CREATED"; game: "hangman"; roomId: string; code: string; hostId: string; settings: HangmanSettings; createdAt: number }
  | { type: "PLAYER_JOINED"; player: RoomPlayer }
  | { type: "PLAYER_LEFT"; playerId: string; reason: "left" | "kicked" | "timeout" }
  | { type: "PLAYER_UPDATED"; playerId: string; nickname?: string; avatar?: string; color?: PlayerColor }
  | { type: "PLAYER_READY"; playerId: string; ready: boolean }
  | { type: "HOST_CHANGED"; hostId: string; previousHostId: string; reason: "transfer" | "migration" | "left" }
  | { type: "SETTINGS_UPDATED"; settings: HangmanSettings }
  | { type: "PLAYER_CONNECTION"; playerId: string; status: ConnectionStatus }
  | { type: "SPECTATOR_JOINED"; count: number }
  | { type: "ROOM_CLOSED"; reason: "empty" | "admin" | "host" }
  | { type: "HM_MATCH_STARTED"; matchId: string; number: number; settings: HangmanSettings; playerIds: string[]; totalRounds: number; phaseEndsAt: number }
  | {
      type: "HM_ROUND_STARTED";
      roundId: string;
      number: number;
      masterId: string | null;
      turnOrder: string[];
      /** Players sitting this round out (offline / left). */
      outIds: string[];
      category: HmCategoryChoice | "custom";
      language: HmLanguage;
      /** Race: separators-only skeleton of the (secret) word. */
      skeleton: Array<string | null> | null;
      phase: "HM_CHOOSING" | "HM_RACE";
      phaseEndsAt: number | null;
    }
  | {
      type: "HM_WORD_SET";
      skeleton: Array<string | null>;
      category: HmCategoryChoice | "custom";
      random: boolean;
      firstGuesserId: string;
      deadlineAt: number | null;
    }
  | {
      type: "HM_LETTER";
      playerId: string;
      letter: string;
      positions: number[];
      chars: string[];
      correct: boolean;
      /** Guess deadline for whoever guesses next (correct guess keeps the turn). */
      deadlineAt: number | null;
      auto: "bot" | null;
    }
  | { type: "HM_SOLVE_FAILED"; playerId: string; guess: string }
  | { type: "HM_TURN"; playerId: string; deadlineAt: number | null; reason: "wrong" | "timeout" | "disconnect" | "left" }
  | {
      type: "HM_RACE_PROGRESS";
      playerId: string;
      correct: boolean;
      revealed: number;
      wrong: number;
      guesses: number;
      status: HmRaceStatus;
      finishedAt: number | null;
      auto: "bot" | "timeup" | "out" | null;
    }
  | { type: "HM_ROUND_ENDED"; result: HmRoundResult; scores: Record<string, HmScore>; phaseEndsAt: number | null }
  | { type: "HM_MATCH_ENDED"; result: HmMatchResult }
  | { type: "HM_REMATCH" }
  | { type: "HM_RETURNED_TO_LOBBY" };

export type HmEvent = HmEventBody & { seq: number; at: number };
