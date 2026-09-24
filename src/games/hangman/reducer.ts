import { seatOf, type RoomPlayer } from "@/game-engine";
import type { HmEvent } from "./events";
import { DEFAULT_HANGMAN_SETTINGS } from "./rules";
import type { HangmanRoomState, HmRacePlayer, HmScore } from "./types";

export function emptyHangmanState(): HangmanRoomState {
  return {
    game: "hangman",
    roomId: "",
    code: "",
    createdAt: 0,
    hostId: "",
    phase: "ROOM_LOBBY",
    phaseEndsAt: null,
    settings: { ...DEFAULT_HANGMAN_SETTINGS },
    players: [],
    match: null,
    matchCount: 0,
    spectatorCount: 0,
    version: 0,
  };
}

export function emptyScore(p: RoomPlayer): HmScore {
  return { playerId: p.id, nickname: p.nickname, avatar: p.avatar, color: p.color, points: 0, roundWins: 0, lettersFound: 0, wordsSolved: 0, wrongGuesses: 0, hangmen: 0 };
}

const sortPlayers = (s: HangmanRoomState) => s.players.sort((a, b) => a.seat - b.seat);

/** Pure reducer shared by server and clients (server-only `private` is preserved untouched). */
export function applyHmEvent<S extends HangmanRoomState>(state: S, e: HmEvent): S {
  const s = structuredClone(state);
  s.version = e.seq;
  const round = s.match?.round ?? null;

  switch (e.type) {
    case "ROOM_CREATED":
      Object.assign(s, emptyHangmanState(), { roomId: e.roomId, code: e.code, hostId: e.hostId, settings: e.settings, createdAt: e.createdAt, version: e.seq });
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
    case "HM_MATCH_STARTED": {
      const scores: Record<string, HmScore> = {};
      for (const id of e.playerIds) {
        const p = s.players.find((x) => x.id === id);
        if (p) scores[id] = emptyScore(p);
      }
      s.match = {
        id: e.matchId,
        number: e.number,
        startedAt: e.at,
        settings: e.settings,
        playerIds: [...e.playerIds],
        scores,
        roundsPlayed: 0,
        totalRounds: e.totalRounds,
        round: null,
        history: [],
        result: null,
      };
      s.matchCount = e.number;
      s.phase = "HM_STARTING";
      s.phaseEndsAt = e.phaseEndsAt;
      break;
    }
    case "HM_ROUND_STARTED": {
      if (!s.match) break;
      let race: Record<string, HmRacePlayer> | null = null;
      if (e.masterId === null) {
        const total = (e.skeleton ?? []).filter((c) => c === null).length;
        race = {};
        for (const id of s.match.playerIds) {
          race[id] = { revealed: 0, total, wrong: 0, guesses: 0, status: e.outIds.includes(id) ? "out" : "playing", finishedAt: null };
        }
      }
      s.match.round = {
        id: e.roundId,
        number: e.number,
        masterId: e.masterId,
        category: e.category,
        language: e.language,
        mask: e.skeleton ? [...e.skeleton] : null,
        guessed: [],
        wrong: [],
        lastGuess: null,
        lastSolveFail: null,
        turnOrder: [...e.turnOrder],
        currentGuesserId: null,
        turnStartedAt: null,
        deadlineAt: null,
        race,
        points: {},
        startedAt: e.at,
        endedAt: null,
        result: null,
      };
      s.phase = e.phase;
      s.phaseEndsAt = e.phaseEndsAt;
      break;
    }
    case "HM_WORD_SET": {
      if (!round) break;
      round.mask = [...e.skeleton];
      round.category = e.category;
      round.currentGuesserId = e.firstGuesserId;
      round.turnStartedAt = e.at;
      round.deadlineAt = e.deadlineAt;
      s.phase = "HM_GUESSING";
      s.phaseEndsAt = null;
      break;
    }
    case "HM_LETTER": {
      if (!round || !s.match) break;
      round.guessed.push(e.letter);
      const sc = s.match.scores[e.playerId];
      if (e.correct && round.mask) {
        e.positions.forEach((pos, i) => (round.mask![pos] = e.chars[i]));
        if (sc) {
          sc.points += e.positions.length;
          sc.lettersFound += e.positions.length;
        }
        round.points[e.playerId] = (round.points[e.playerId] ?? 0) + e.positions.length;
        round.turnStartedAt = e.at;
      } else {
        round.wrong.push(e.letter);
        if (sc) sc.wrongGuesses += 1;
      }
      round.lastGuess = { playerId: e.playerId, letter: e.letter, correct: e.correct, count: e.positions.length, at: e.at };
      round.deadlineAt = e.deadlineAt;
      break;
    }
    case "HM_SOLVE_FAILED": {
      if (!round || !s.match) break;
      round.wrong.push(e.guess);
      round.lastSolveFail = { playerId: e.playerId, guess: e.guess, at: e.at };
      const sc = s.match.scores[e.playerId];
      if (sc) sc.wrongGuesses += 1;
      break;
    }
    case "HM_TURN": {
      if (!round) break;
      round.currentGuesserId = e.playerId;
      round.turnStartedAt = e.at;
      round.deadlineAt = e.deadlineAt;
      break;
    }
    case "HM_RACE_PROGRESS": {
      const rp = round?.race?.[e.playerId];
      if (!rp || !s.match) break;
      rp.revealed = e.revealed;
      rp.wrong = e.wrong;
      rp.guesses = e.guesses;
      rp.status = e.status;
      rp.finishedAt = e.finishedAt;
      const sc = s.match.scores[e.playerId];
      if (sc && !e.correct && e.auto !== "timeup" && e.auto !== "out") sc.wrongGuesses += 1;
      break;
    }
    case "HM_ROUND_ENDED": {
      if (!round || !s.match) break;
      round.result = e.result;
      round.endedAt = e.at;
      round.mask = [...e.result.word]; // reveal the whole word
      round.currentGuesserId = null;
      round.deadlineAt = null;
      s.match.history.push(e.result);
      s.match.roundsPlayed += 1;
      s.match.scores = e.scores;
      s.phase = "HM_ROUND_RESULTS";
      s.phaseEndsAt = e.phaseEndsAt;
      break;
    }
    case "HM_MATCH_ENDED": {
      if (!s.match) break;
      s.match.result = e.result;
      if (s.match.round) {
        s.match.round.currentGuesserId = null;
        s.match.round.deadlineAt = null;
      }
      s.phase = "HM_MATCH_RESULTS";
      s.phaseEndsAt = null;
      break;
    }
    case "HM_REMATCH":
    case "HM_RETURNED_TO_LOBBY": {
      s.players = s.players.filter((p) => p.connection !== "left");
      if (e.type === "HM_RETURNED_TO_LOBBY") for (const p of s.players) p.isReady = p.isBot || p.id === s.hostId;
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

export function applyHmEvents<S extends HangmanRoomState>(state: S, events: readonly HmEvent[]): S {
  return events.reduce((acc, e) => applyHmEvent(acc, e), state);
}
