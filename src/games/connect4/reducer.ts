import { seatOf, type RoomPlayer } from "@/game-engine";
import type { C4Event } from "./events";
import { DEFAULT_CONNECT4_SETTINGS } from "./rules";
import type { C4Score, Connect4RoomState } from "./types";

export function emptyConnect4State(): Connect4RoomState {
  return {
    game: "connect4",
    roomId: "",
    code: "",
    createdAt: 0,
    hostId: "",
    phase: "ROOM_LOBBY",
    phaseEndsAt: null,
    settings: { ...DEFAULT_CONNECT4_SETTINGS },
    players: [],
    match: null,
    matchCount: 0,
    spectatorCount: 0,
    version: 0,
  };
}

export function emptyC4Score(p: RoomPlayer): C4Score {
  return { playerId: p.id, nickname: p.nickname, avatar: p.avatar, color: p.color, wins: 0, draws: 0, discs: 0, pops: 0, fastestWin: null };
}

const sortPlayers = (s: Connect4RoomState) => s.players.sort((a, b) => a.seat - b.seat);

/** Pure reducer shared by server and clients (server-only `private` is preserved untouched). */
export function applyC4Event<S extends Connect4RoomState>(state: S, e: C4Event): S {
  const s = structuredClone(state);
  s.version = e.seq;
  const round = s.match?.round ?? null;

  switch (e.type) {
    case "ROOM_CREATED":
      Object.assign(s, emptyConnect4State(), { roomId: e.roomId, code: e.code, hostId: e.hostId, settings: e.settings, createdAt: e.createdAt, version: e.seq });
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
    case "C4_MATCH_STARTED": {
      const scores: Record<string, C4Score> = {};
      for (const id of e.playerIds) {
        const p = s.players.find((x) => x.id === id);
        if (p) scores[id] = emptyC4Score(p);
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
      s.phase = "C4_STARTING";
      s.phaseEndsAt = e.phaseEndsAt;
      break;
    }
    case "C4_ROUND_STARTED": {
      if (!s.match) break;
      s.match.round = {
        id: e.roundId,
        number: e.number,
        cols: e.cols,
        rows: e.rows,
        connect: e.connect,
        mode: s.match.settings.gameMode,
        columns: Array.from({ length: e.cols }, () => []),
        starterId: e.firstId,
        currentId: e.firstId,
        turnStartedAt: e.at,
        deadlineAt: e.deadlineAt,
        moves: 0,
        lastMove: null,
        startedAt: e.at,
        result: null,
      };
      s.phase = "C4_PLAYING";
      s.phaseEndsAt = null;
      break;
    }
    case "C4_MOVED": {
      if (!round || !s.match) break;
      const n = round.moves + 1;
      const col = round.columns[e.column];
      if (e.kind === "drop") col.push({ p: e.playerId, n });
      else col.shift();
      round.moves = n;
      round.lastMove = { playerId: e.playerId, kind: e.kind, column: e.column, row: e.row, n, auto: e.auto, at: e.at };
      round.currentId = e.nextId;
      round.turnStartedAt = e.at;
      round.deadlineAt = e.deadlineAt;
      const sc = s.match.scores[e.playerId];
      if (sc) {
        if (e.kind === "drop") sc.discs += 1;
        else sc.pops += 1;
      }
      break;
    }
    case "C4_ROUND_ENDED": {
      if (!round || !s.match) break;
      round.result = e.result;
      round.currentId = null;
      round.deadlineAt = null;
      s.match.history.push(e.result);
      s.match.roundsPlayed += 1;
      s.match.scores = e.scores;
      s.phase = "C4_ROUND_RESULTS";
      s.phaseEndsAt = e.phaseEndsAt;
      break;
    }
    case "C4_MATCH_ENDED": {
      if (!s.match) break;
      s.match.result = e.result;
      if (s.match.round) {
        s.match.round.currentId = null;
        s.match.round.deadlineAt = null;
      }
      s.phase = "C4_MATCH_RESULTS";
      s.phaseEndsAt = null;
      break;
    }
    case "C4_REMATCH":
    case "C4_RETURNED_TO_LOBBY": {
      s.players = s.players.filter((p) => p.connection !== "left");
      if (e.type === "C4_RETURNED_TO_LOBBY") for (const p of s.players) p.isReady = p.isBot || p.id === s.hostId;
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

export function applyC4Events<S extends Connect4RoomState>(state: S, events: readonly C4Event[]): S {
  return events.reduce((acc, e) => applyC4Event(acc, e), state);
}
