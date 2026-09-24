"use client";

import { applyEvent, nextWakeAt, type Command, type GameEvent, type RoomState } from "@/game-engine";
import { applyHmEvent, nextWakeHangman, type HangmanRoomState, type HmCommand, type HmEvent } from "@/games/hangman";

/** Client-side game adapter: the same reducers the server uses, picked by `state.game`. */

export type AnyRoomState = RoomState | HangmanRoomState;
export type AnyClientEvent = GameEvent | HmEvent;
export type AnyCommand = Command | HmCommand;

export function isHangman(state: AnyRoomState | null | undefined): state is HangmanRoomState {
  return !!state && (state as HangmanRoomState).game === "hangman";
}

export function applyAny(state: AnyRoomState, e: AnyClientEvent): AnyRoomState {
  return isHangman(state) ? applyHmEvent(state, e as HmEvent) : applyEvent(state, e as GameEvent);
}

export function wakeAny(state: AnyRoomState, now: number): number | null {
  return isHangman(state) ? nextWakeHangman(state, now) : nextWakeAt(state, now);
}

/** How long each event holds the presentation queue (animations breathe; backlogs fast-forward). */
export function displayDelay(e: AnyClientEvent, backlog: number): number {
  if (backlog > 10) return 0;
  switch (e.type) {
    case "DICE_ROLLED":
      return e.validCount === 0 ? 2100 : 950;
    case "PLAYER_BLOCKED":
      return 1500;
    case "TILES_CLOSED":
      return 550;
    case "PLAYER_SHUT_BOX":
      return 2800;
    case "EXTRA_TURN":
      return 900;
    case "TURN_SKIPPED":
      return 700;
    case "ROUND_COMPLETED":
      return 200;
    case "HM_LETTER":
      return e.correct ? 700 : 950; // chalk stroke draws the next body part
    case "HM_SOLVE_FAILED":
      return 950;
    case "HM_ROUND_ENDED":
      return 2600; // hanged sway / rescue animation before results
    default:
      return 0;
  }
}
