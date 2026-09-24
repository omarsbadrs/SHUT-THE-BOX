import type { GameEvent } from "./events";
import { emptyStats } from "./match";
import { freshPlayerRound } from "./round";
import { DEFAULT_SETTINGS, isTurnBased, seatOf } from "./rules";
import type { HistoryEntry, PlayerRoundState, RoomState, RoundState } from "./types";

const HISTORY_LIMIT = 60;

export function emptyRoomState(): RoomState {
  return {
    roomId: "",
    code: "",
    createdAt: 0,
    hostId: "",
    phase: "ROOM_LOBBY",
    phaseEndsAt: null,
    settings: { ...DEFAULT_SETTINGS },
    players: [],
    match: null,
    matchCount: 0,
    paused: null,
    spectatorCount: 0,
    history: [],
    historyCounter: 0,
    version: 0,
  };
}

function pushHistory(s: RoomState, at: number, entry: Omit<HistoryEntry, "n" | "at" | "roundNumber">) {
  s.historyCounter += 1;
  s.history.push({ ...entry, n: s.historyCounter, at, roundNumber: s.match?.round?.number ?? 0 });
  if (s.history.length > HISTORY_LIMIT) s.history.splice(0, s.history.length - HISTORY_LIMIT);
}

function sortPlayers(s: RoomState) {
  s.players.sort((a, b) => a.seat - b.seat);
}

function roundOf(s: RoomState): RoundState | null {
  return s.match?.round ?? null;
}

function pr(s: RoomState, playerId: string): PlayerRoundState | null {
  return roundOf(s)?.players[playerId] ?? null;
}

/**
 * Pure event reducer, shared verbatim by server and clients. Unknown extra
 * fields on the state object (the server's `private` block) are preserved.
 */
export function applyEvent<S extends RoomState>(state: S, e: GameEvent): S {
  const s = structuredClone(state);
  s.version = e.seq;

  switch (e.type) {
    case "ROOM_CREATED": {
      Object.assign(s, emptyRoomState(), {
        roomId: e.roomId,
        code: e.code,
        hostId: e.hostId,
        settings: e.settings,
        createdAt: e.createdAt,
        version: e.seq,
      });
      break;
    }
    case "PLAYER_JOINED": {
      s.players = s.players.filter((p) => p.id !== e.player.id);
      s.players.push({ ...e.player });
      sortPlayers(s);
      break;
    }
    case "PLAYER_LEFT": {
      if (s.phase === "ROOM_LOBBY") {
        s.players = s.players.filter((p) => p.id !== e.playerId);
      } else {
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
    case "HOST_CHANGED": {
      s.hostId = e.hostId;
      break;
    }
    case "SETTINGS_UPDATED": {
      s.settings = e.settings;
      break;
    }
    case "PLAYER_CONNECTION": {
      const p = s.players.find((x) => x.id === e.playerId);
      if (p && p.connection !== "left") {
        p.connection = e.status;
        if (e.status === "online") {
          p.connectedAt = e.at;
          p.disconnectedAt = null;
        } else {
          p.disconnectedAt = p.disconnectedAt ?? e.at;
        }
      }
      break;
    }
    case "SPECTATOR_JOINED": {
      s.spectatorCount = e.count;
      break;
    }
    case "MATCH_STARTED": {
      const stats: Record<string, ReturnType<typeof emptyStats>> = {};
      for (const id of e.playerIds) {
        const p = s.players.find((x) => x.id === id);
        if (p) stats[id] = emptyStats(p);
      }
      s.match = {
        id: e.matchId,
        number: e.number,
        startedAt: e.at,
        settings: e.settings,
        playerIds: [...e.playerIds],
        stats,
        roundsPlayed: 0,
        round: null,
        history: [],
        result: null,
      };
      s.matchCount = e.number;
      s.phase = "STARTING";
      s.phaseEndsAt = e.phaseEndsAt;
      s.paused = null;
      s.history = [];
      s.historyCounter = 0;
      break;
    }
    case "ROUND_STARTED": {
      if (!s.match) break;
      const out = new Set(e.outIds);
      const players: Record<string, PlayerRoundState> = {};
      for (const id of e.order) players[id] = freshPlayerRound(id, out.has(id) ? "out" : "active");
      s.match.round = {
        id: e.roundId,
        number: e.number,
        starterId: e.starterId,
        order: [...e.order],
        currentPlayerId: null,
        turnNumber: 0,
        turnCounter: 0,
        startedAt: e.at,
        players,
        endedAt: null,
        result: null,
      };
      s.phase = e.phase;
      s.phaseEndsAt = e.phaseEndsAt;
      pushHistory(s, e.at, { kind: "round", playerId: e.starterId });
      break;
    }
    case "TURN_STARTED":
    case "TURN_CHANGED": {
      const round = roundOf(s);
      if (!round) break;
      round.turnNumber = e.turnNumber;
      s.phase = "PLAYER_TURN";
      s.phaseEndsAt = null;
      if (e.playerId === null) {
        for (const p of Object.values(round.players)) {
          if (p.status !== "active") continue;
          p.turnStartedAt = e.startedAt;
          p.deadlineAt = e.deadlineAt;
        }
      } else {
        if (round.currentPlayerId && round.currentPlayerId !== e.playerId) {
          const prev = round.players[round.currentPlayerId];
          if (prev) prev.deadlineAt = null;
        }
        round.currentPlayerId = e.playerId;
        const p = round.players[e.playerId];
        if (p) {
          p.turnStartedAt = e.startedAt;
          p.deadlineAt = e.deadlineAt;
        }
      }
      break;
    }
    case "DICE_ROLLED": {
      const round = roundOf(s);
      const p = pr(s, e.playerId);
      if (!round || !p || !s.match) break;
      p.pending = {
        turnId: e.turnId,
        die1: e.die1,
        die2: e.die2,
        total: e.total,
        isDouble: e.isDouble,
        diceCount: e.diceCount,
        rolledAt: e.at,
        validCount: e.validCount,
        auto: e.auto,
      };
      p.rolls += 1;
      p.deadlineAt = e.deadlineAt;
      round.turnCounter += 1;
      const st = s.match.stats[e.playerId];
      if (st) {
        st.diceRolls += 1;
        if (e.isDouble) st.doubles += 1;
      }
      s.phase = isTurnBased(s.match.settings.gameMode) ? "AWAITING_TILE_SELECTION" : "PLAYER_TURN";
      pushHistory(s, e.at, { kind: "roll", playerId: e.playerId, dice: [e.die1, e.die2], total: e.total, auto: e.auto });
      break;
    }
    case "TILES_CLOSED": {
      const p = pr(s, e.playerId);
      if (!p || !s.match) break;
      const closing = new Set(e.tiles);
      p.openTiles = p.openTiles.filter((t) => !closing.has(t));
      if (p.pending) {
        const { turnId, die1, die2, total, isDouble, diceCount } = p.pending;
        p.last = {
          turnId,
          die1,
          die2,
          total,
          isDouble,
          diceCount,
          closed: [...e.tiles],
          blocked: false,
          status: e.auto === "timeout" ? "EXPIRED" : "RESOLVED",
          at: e.at,
        };
      }
      p.pending = null;
      const race = !isTurnBased(s.match.settings.gameMode);
      p.deadlineAt = race ? e.nextDeadlineAt : null;
      if (race) p.turnStartedAt = e.at;
      const st = s.match.stats[e.playerId];
      if (st) st.tilesClosed += e.tiles.length;
      if (!race) s.phase = "PLAYER_TURN";
      pushHistory(s, e.at, { kind: "close", playerId: e.playerId, tiles: [...e.tiles], auto: e.auto });
      break;
    }
    case "HINT_USED": {
      const p = pr(s, e.playerId);
      if (p) p.hintsUsed += 1;
      pushHistory(s, e.at, { kind: "hint", playerId: e.playerId, tiles: [...e.tiles] });
      break;
    }
    case "PLAYER_BLOCKED": {
      const p = pr(s, e.playerId);
      if (!p) break;
      if (p.pending) {
        const { turnId, die1, die2, total, isDouble, diceCount } = p.pending;
        p.last = { turnId, die1, die2, total, isDouble, diceCount, closed: null, blocked: true, status: "BLOCKED", at: e.at };
      }
      p.status = "blocked";
      p.blockedReason = e.reason;
      p.finalScore = e.score;
      p.pending = null;
      p.deadlineAt = null;
      pushHistory(s, e.at, { kind: "blocked", playerId: e.playerId, reason: e.reason, total: e.score });
      break;
    }
    case "PLAYER_SHUT_BOX": {
      const p = pr(s, e.playerId);
      if (!p) break;
      p.status = "shut";
      p.finalScore = 0;
      p.deadlineAt = null;
      pushHistory(s, e.at, { kind: "shut", playerId: e.playerId });
      break;
    }
    case "TURN_SKIPPED": {
      const p = pr(s, e.playerId);
      if (!p) break;
      if (p.pending) {
        const { turnId, die1, die2, total, isDouble, diceCount } = p.pending;
        p.last = { turnId, die1, die2, total, isDouble, diceCount, closed: null, blocked: false, status: "EXPIRED", at: e.at };
      }
      p.pending = null;
      p.deadlineAt = null;
      pushHistory(s, e.at, { kind: "skip", playerId: e.playerId, reason: e.reason });
      break;
    }
    case "EXTRA_TURN": {
      pushHistory(s, e.at, { kind: "extra", playerId: e.playerId });
      break;
    }
    case "ROUND_COMPLETED": {
      const round = roundOf(s);
      if (!round || !s.match) break;
      round.result = e.result;
      round.endedAt = e.at;
      round.currentPlayerId = null;
      for (const p of Object.values(round.players)) {
        p.pending = null;
        p.deadlineAt = null;
        const entry = e.result.entries.find((x) => x.playerId === p.playerId);
        if (entry) p.finalScore = entry.openTileSum;
      }
      s.match.history.push(e.result);
      s.match.roundsPlayed += 1;
      s.phase = "ROUND_RESULTS";
      s.phaseEndsAt = e.phaseEndsAt;
      break;
    }
    case "SCORE_UPDATED": {
      if (s.match) s.match.stats = e.stats;
      break;
    }
    case "MATCH_COMPLETED": {
      if (!s.match) break;
      s.match.result = e.result;
      const round = s.match.round;
      if (round) {
        round.currentPlayerId = null;
        for (const p of Object.values(round.players)) {
          p.pending = null;
          p.deadlineAt = null;
        }
      }
      s.phase = "MATCH_RESULTS";
      s.phaseEndsAt = null;
      s.paused = null;
      break;
    }
    case "MATCH_PAUSED": {
      s.paused = { at: e.at, by: e.by };
      break;
    }
    case "MATCH_RESUMED": {
      s.paused = null;
      const d = e.shiftMs;
      if (s.phaseEndsAt !== null) s.phaseEndsAt += d;
      const round = roundOf(s);
      if (round) {
        for (const p of Object.values(round.players)) {
          if (p.deadlineAt !== null) p.deadlineAt += d;
          if (p.turnStartedAt !== null) p.turnStartedAt += d;
          if (p.pending) p.pending.rolledAt += d;
        }
      }
      for (const p of s.players) if (p.disconnectedAt !== null) p.disconnectedAt += d;
      break;
    }
    case "REMATCH_STARTED": {
      s.players = s.players.filter((p) => p.connection !== "left");
      if (e.colors) {
        for (const p of s.players) {
          const c = e.colors[p.id];
          if (c) {
            p.color = c;
            p.seat = seatOf(c);
          }
        }
        sortPlayers(s);
      }
      s.match = null;
      s.phase = "ROOM_LOBBY";
      s.phaseEndsAt = null;
      s.paused = null;
      break;
    }
    case "RETURNED_TO_LOBBY": {
      s.players = s.players.filter((p) => p.connection !== "left");
      for (const p of s.players) p.isReady = p.isBot || p.id === s.hostId;
      s.match = null;
      s.phase = "ROOM_LOBBY";
      s.phaseEndsAt = null;
      s.paused = null;
      s.history = [];
      s.historyCounter = 0;
      break;
    }
    case "TILES_CORRECTED": {
      const p = pr(s, e.playerId);
      if (p) p.openTiles = [...e.openTiles].sort((a, b) => a - b);
      break;
    }
    case "ROOM_CLOSED": {
      s.phase = "FINISHED";
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

export function applyEvents<S extends RoomState>(state: S, events: readonly GameEvent[]): S {
  return events.reduce((acc, e) => applyEvent(acc, e), state);
}
