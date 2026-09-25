"use client";

import { applyEvent, nextWakeAt, type Command, type GameEvent, type RoomState } from "@/game-engine";
import { applyHmEvent, nextWakeHangman, type HangmanPersonal, type HangmanRoomState, type HmCommand, type HmEvent } from "@/games/hangman";
import { applyGwEvent, nextWakeGuessWho, type GuessWhoPersonal, type GuessWhoRoomState, type GwCommand, type GwEvent } from "@/games/guesswho";
import { applyC4Event, nextWakeConnect4, type C4Command, type C4Event, type Connect4RoomState } from "@/games/connect4";

/** Client-side game adapter: the same reducers the server uses, picked by `state.game`. */

export type AnyRoomState = RoomState | HangmanRoomState | GuessWhoRoomState | Connect4RoomState;
export type AnyClientEvent = GameEvent | HmEvent | GwEvent | C4Event;
export type AnyCommand = Command | HmCommand | GwCommand | C4Command;
/** Viewer-only data from the server; each game fills its own fields. */
export type AnyPersonal = Partial<HangmanPersonal> & Partial<GuessWhoPersonal>;

export function isHangman(state: AnyRoomState | null | undefined): state is HangmanRoomState {
  return !!state && (state as HangmanRoomState).game === "hangman";
}

export function isGuessWho(state: AnyRoomState | null | undefined): state is GuessWhoRoomState {
  return !!state && (state as GuessWhoRoomState).game === "guesswho";
}

export function isConnect4(state: AnyRoomState | null | undefined): state is Connect4RoomState {
  return !!state && (state as Connect4RoomState).game === "connect4";
}

export function applyAny(state: AnyRoomState, e: AnyClientEvent): AnyRoomState {
  if (isHangman(state)) return applyHmEvent(state, e as HmEvent);
  if (isGuessWho(state)) return applyGwEvent(state, e as GwEvent);
  if (isConnect4(state)) return applyC4Event(state, e as C4Event);
  return applyEvent(state as RoomState, e as GameEvent);
}

export function wakeAny(state: AnyRoomState, now: number): number | null {
  if (isHangman(state)) return nextWakeHangman(state, now);
  if (isGuessWho(state)) return nextWakeGuessWho(state, now);
  if (isConnect4(state)) return nextWakeConnect4(state, now);
  return nextWakeAt(state as RoomState, now);
}

/** Events after which this viewer's private data changed (e.g. a new secret card was dealt). */
export function refreshesPersonal(e: AnyClientEvent): boolean {
  return e.type === "GW_ROUND_STARTED";
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
    case "GW_ASKED":
    case "GW_FREE_ANSWERED":
      return 900; // the answer stamp lands
    case "GW_ROUND_ENDED":
      return 2400; // card reveal before results
    case "C4_MOVED":
      return 520; // the disc falls and bounces
    case "C4_ROUND_ENDED":
      return 1400; // the winning line lights up
    default:
      return 0;
  }
}
