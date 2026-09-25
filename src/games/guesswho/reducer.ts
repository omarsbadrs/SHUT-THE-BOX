import { seatOf, type RoomPlayer } from "@/game-engine";
import type { GwEvent } from "./events";
import { DEFAULT_GUESSWHO_SETTINGS } from "./rules";
import type { GuessWhoRoomState, GwLogEntry, GwScore } from "./types";

export function emptyGuessWhoState(): GuessWhoRoomState {
  return {
    game: "guesswho",
    roomId: "",
    code: "",
    createdAt: 0,
    hostId: "",
    phase: "ROOM_LOBBY",
    phaseEndsAt: null,
    settings: { ...DEFAULT_GUESSWHO_SETTINGS },
    players: [],
    match: null,
    matchCount: 0,
    spectatorCount: 0,
    version: 0,
  };
}

export function emptyGwScore(p: RoomPlayer): GwScore {
  return { playerId: p.id, nickname: p.nickname, avatar: p.avatar, color: p.color, wins: 0, questions: 0, rightGuesses: 0, wrongGuesses: 0 };
}

const sortPlayers = (s: GuessWhoRoomState) => s.players.sort((a, b) => a.seat - b.seat);

/** Pure reducer shared by server and clients (server-only `private` is preserved untouched). */
export function applyGwEvent<S extends GuessWhoRoomState>(state: S, e: GwEvent): S {
  const s = structuredClone(state);
  s.version = e.seq;
  const round = s.match?.round ?? null;
  const log = (entry: Omit<GwLogEntry, "n" | "at">) => {
    if (round) round.log.push({ ...entry, n: round.log.length + 1, at: e.at });
  };
  const bump = (id: string, key: "questions" | "rightGuesses" | "wrongGuesses") => {
    const sc = s.match?.scores[id];
    if (sc) sc[key] += 1;
  };

  switch (e.type) {
    case "ROOM_CREATED":
      Object.assign(s, emptyGuessWhoState(), { roomId: e.roomId, code: e.code, hostId: e.hostId, settings: e.settings, createdAt: e.createdAt, version: e.seq });
      break;
    case "PLAYER_JOINED":
      s.players = s.players.filter((p) => p.id !== e.player.id);
      s.players.push({ ...e.player });
      sortPlayers(s);
      break;
    case "PLAYER_LEFT": {
      if (s.phase === "ROOM_LOBBY") s.players = s.players.filter((p) => p.id !== e.playerId);
      else {
        const p = s.players.find((x) => x.id === e.playerId);
        if (p) {
          p.connection = "left";
          p.isReady = false;
          p.disconnectedAt = p.disconnectedAt ?? e.at;
        }
      }
      break;
    }
    case "PLAYER_UPDATED": {
      const p = s.players.find((x) => x.id === e.playerId);
      if (p) {
        if (e.nickname !== undefined) p.nickname = e.nickname;
        if (e.avatar !== undefined) p.avatar = e.avatar;
        if (e.color !== undefined) {
          p.color = e.color;
          p.seat = seatOf(e.color);
        }
        sortPlayers(s);
      }
      break;
    }
    case "PLAYER_READY": {
      const p = s.players.find((x) => x.id === e.playerId);
      if (p) p.isReady = e.ready;
      break;
    }
    case "HOST_CHANGED":
      s.hostId = e.hostId;
      break;
    case "SETTINGS_UPDATED":
      s.settings = e.settings;
      break;
    case "PLAYER_CONNECTION": {
      const p = s.players.find((x) => x.id === e.playerId);
      if (p && p.connection !== "left") {
        p.connection = e.status;
        if (e.status === "online") {
          p.connectedAt = e.at;
          p.disconnectedAt = null;
        } else p.disconnectedAt = p.disconnectedAt ?? e.at;
      }
      break;
    }
    case "SPECTATOR_JOINED":
      s.spectatorCount = e.count;
      break;
    case "ROOM_CLOSED":
      s.phase = "FINISHED";
      s.phaseEndsAt = null;
      break;
    case "GW_MATCH_STARTED": {
      const scores: Record<string, GwScore> = {};
      for (const id of e.playerIds) {
        const p = s.players.find((x) => x.id === id);
        if (p) scores[id] = emptyGwScore(p);
      }
      s.match = {
        id: e.matchId,
        number: e.number,
        startedAt: e.at,
        settings: e.settings,
        playerIds: [...e.playerIds],
        scores,
        roundsPlayed: 0,
        target: e.target,
        round: null,
        history: [],
        result: null,
      };
      s.matchCount = e.number;
      s.phase = "GW_STARTING";
      s.phaseEndsAt = e.phaseEndsAt;
      break;
    }
    case "GW_ROUND_STARTED": {
      if (!s.match) break;
      s.match.round = {
        id: e.roundId,
        number: e.number,
        category: e.category,
        board: [...e.board],
        currentId: e.firstId,
        turnStartedAt: e.at,
        deadlineAt: e.deadlineAt,
        flipped: Object.fromEntries(s.match.playerIds.map((id) => [id, []])),
        log: [],
        pending: null,
        startedAt: e.at,
        result: null,
      };
      s.phase = "GW_PLAYING";
      s.phaseEndsAt = null;
      break;
    }
    case "GW_ASKED": {
      if (!round) break;
      log({ askerId: e.askerId, kind: "preset", questionId: e.questionId, answer: e.answer });
      bump(e.askerId, "questions");
      round.currentId = e.nextId;
      round.turnStartedAt = e.at;
      round.deadlineAt = e.deadlineAt;
      break;
    }
    case "GW_FREE_ASKED": {
      if (!round) break;
      round.pending = { askerId: e.askerId, answererId: e.answererId, text: e.text, askedAt: e.at, deadlineAt: e.deadlineAt };
      round.deadlineAt = null;
      break;
    }
    case "GW_FREE_ANSWERED": {
      if (!round) break;
      log({ askerId: e.askerId, kind: "free", text: round.pending?.text ?? "", answer: e.answer });
      bump(e.askerId, "questions");
      round.pending = null;
      round.currentId = e.nextId;
      round.turnStartedAt = e.at;
      round.deadlineAt = e.deadlineAt;
      break;
    }
    case "GW_FREE_EXPIRED": {
      if (!round) break;
      round.pending = null;
      round.turnStartedAt = e.at;
      round.deadlineAt = e.deadlineAt;
      break;
    }
    case "GW_FLIPPED": {
      if (!round) break;
      const mine = new Set(round.flipped[e.playerId] ?? []);
      for (const id of e.cardIds) {
        if (e.down) mine.add(id);
        else mine.delete(id);
      }
      round.flipped[e.playerId] = round.board.filter((id) => mine.has(id));
      break;
    }
    case "GW_WRONG_GUESS": {
      if (!round) break;
      log({ askerId: e.guesserId, kind: "guess", cardId: e.cardId, correct: false });
      bump(e.guesserId, "wrongGuesses");
      const mine = new Set(round.flipped[e.guesserId] ?? []);
      mine.add(e.cardId);
      round.flipped[e.guesserId] = round.board.filter((id) => mine.has(id));
      round.currentId = e.nextId;
      round.turnStartedAt = e.at;
      round.deadlineAt = e.deadlineAt;
      break;
    }
    case "GW_TURN": {
      if (!round) break;
      round.currentId = e.playerId;
      round.turnStartedAt = e.at;
      round.deadlineAt = e.deadlineAt;
      round.pending = null;
      break;
    }
    case "GW_ROUND_ENDED": {
      if (!round || !s.match) break;
      if (e.result.guesserId && e.result.guessCardId) {
        log({ askerId: e.result.guesserId, kind: "guess", cardId: e.result.guessCardId, correct: e.result.outcome === "guessed" });
      }
      round.result = e.result;
      round.currentId = null;
      round.deadlineAt = null;
      round.pending = null;
      s.match.history.push(e.result);
      s.match.roundsPlayed += 1;
      s.match.scores = e.scores;
      s.phase = "GW_ROUND_RESULTS";
      s.phaseEndsAt = e.phaseEndsAt;
      break;
    }
    case "GW_MATCH_ENDED": {
      if (!s.match) break;
      s.match.result = e.result;
      if (s.match.round) {
        s.match.round.currentId = null;
        s.match.round.deadlineAt = null;
        s.match.round.pending = null;
      }
      s.phase = "GW_MATCH_RESULTS";
      s.phaseEndsAt = null;
      break;
    }
    case "GW_REMATCH":
    case "GW_RETURNED_TO_LOBBY": {
      s.players = s.players.filter((p) => p.connection !== "left");
      if (e.type === "GW_RETURNED_TO_LOBBY") for (const p of s.players) p.isReady = p.isBot || p.id === s.hostId;
      s.match = null;
      s.phase = "ROOM_LOBBY";
      s.phaseEndsAt = null;
      break;
    }
    default: {
      const never: never = e;
      void never;
    }
  }
  return s;
}

export function applyGwEvents<S extends GuessWhoRoomState>(state: S, events: readonly GwEvent[]): S {
  return events.reduce((acc, e) => applyGwEvent(acc, e), state);
}
