# Games Hub — SHUT10 & Hangman

A mobile-first, server-authoritative multiplayer **games hub** for 2–4 phones (plus solo
practice), with two games:

- **SHUT10**: Shut the Box (Face-Off, Classic, Race and Tournament modes).
- **Hangman**: a chalkboard game with Word master and Race modes, in English and Arabic.

Stack: Next.js 16 (App Router) · React 19 · TypeScript strict · Tailwind v4 · Motion ·
Supabase Postgres + Realtime · Vercel · installable PWA · English + Arabic (RTL).

Both games share rooms, codes, invites, sessions, presence and reconnection, the atomic
event-sourced commit pipeline, and Realtime. Each game has its own pure rules engine
(`src/game-engine` for SHUT10, `src/games/hangman` for Hangman). `src/lib/server/games.ts`
routes each room's commands to its engine.

## Hangman

- **Word master**: players take turns as word master (1–3 times each). The master types a
  secret word (or picks a random one). Everyone else guesses letters in seat order on one
  shared chalkboard.
  - A correct letter scores +1 per occurrence, and the guesser keeps the turn.
  - A miss draws the next body part and passes the turn.
  - Solving the whole word scores +3, plus the number of letters still hidden.
  - If the guessers are hanged, the master scores +5.
- **Race**: everyone gets the same random word on their own private board. Solvers score
  3/2/1/1 in finishing order. An optional time limit applies.
- **Settings**: word language (English / Arabic), category (animals, countries, food,
  sports, jobs, home, nature, or mixed), lives (6 classic / 9 easy), guess timer, and bots
  (easy / normal / hard; hard narrows built-in words by the revealed pattern).
- **Arabic**: one key reveals every alef/hamza form (أ إ آ ٱ → ا, ى/ئ → ي, ؤ → و).
  Tashkeel is ignored, and whole-word guesses accept ه for ة.
- **Secrecy**: the event log is readable by browsers, so the word never appears in it
  before the round ends. The master receives their own word privately. In Race, public
  events carry progress counts only; each player's board comes back privately in the
  command response and in `GET /state` (`personal`). Unit and E2E tests check that
  guessers never receive the word.
- **Look**: a chalkboard with a wooden gallows. Each wrong guess draws the next part as an
  animated chalk stroke with a puff of dust. Hanged: the figure sways with ✕ eyes. Saved:
  the rope snaps and the figure drops and cheers.
- **Routes**: `/hangman/create`, `/hangman/practice`. Rooms use the same `/room/CODE` and
  `/join/CODE` as SHUT10.
- **Database**: no extra migration. Hangman state lives in `rooms.state` and its events in
  `game_events`. Lobby events share SHUT10's shapes, so `room_players` is projected for
  both games; game events are prefixed `HM_`.

---

# SHUT10 — Roll. Think. Shut.

---

## 1. Game rules

Each player owns a colored track of tiles **1–10** (Blue, Green, Red, Yellow) and two dice in
the same color. All tiles start **open**.

1. Roll two dice. The **total** is the target.
2. Close **one or more open tiles whose values sum exactly to the total** (e.g. 8 → `8`, `1+7`,
   `2+6`, `3+5`, `1+2+5`, `1+3+4`). A tile can't be used twice or reopened.
3. If no combination exists the player is **BLOCKED**. The server detects it automatically
   ("Checking moves…" → BLOCKED); their board freezes.
4. Closing every tile is **SHUT THE BOX**: an instant round win with score 0 (a *perfect round*).
5. Otherwise, when everyone is blocked, each player's **OPEN-TILE SCORE** is the sum of the open
   tiles. **Lower is better.**

**Ties** (host setting): fewer open tiles → lower highest remaining tile → (optional) server dice
roll-off, or "shared".

**Doubles**: *Extra Turn on Doubles* (default ON in Face-Off) grants another roll after resolving.

**One-die endgame** (optional, OFF by default): once every tile ≥ threshold (6/7/8) is closed, the
player may roll one die instead of two.

### Modes

| Mode | Turn structure |
|---|---|
| **Face Off** (default) | Dice pass after **every** roll, BLUE → GREEN → RED → YELLOW, skipping blocked players. |
| **Classic** | A player keeps rolling until blocked (or shut), then the next player plays their whole board. |
| **Race** | Everyone rolls simultaneously on their own board. First to shut the box wins. |
| **Tournament** | Face-Off turns, match-points scoring, fixed round count, standings after every round. |
| **Solo / Practice** | `/practice`: no room, instant start, local stats (best, average, perfect games, streak), optional strategy trainer. |

### Players, scoring and formats

* 2–4 players (unique color each), optional spectators, optional bots (easy / normal / hard).
* **Round score** = open-tile sum (0 = perfect).
* **Match scoring** (host): *Round wins* (default) · *Match points* (placement points
  `n − placement`: 4p → 3/2/1/0, 2p → 1/0) · *Lowest cumulative score*.
* **Formats**: one round, best of 3/5/7, first to 3/5 wins, custom 1–20 rounds, endless party
  (host ends it).
* First player: random in round 1, then rotates (or random every round).

---

## 2. Architecture

```
src/
  game-engine/          ← pure TypeScript rules, no React, shared by server and client
    types.ts            domain types (PlayerColor, TileState, DiceRoll, PlayerGameState, …)
    combinations.ts     getValidCombinations, isValidMove, checkMove, closeTiles, isBlocked
    dice.ts             rollDice, getDiceTotal, secureRandom (Web Crypto CSPRNG)
    scoring.ts          calculateOpenTileScore, isShutBox, rankRound (tie-breaks), match points
    rules.ts            settings defaults/normalisation, modes, one-die rule, timing constants
    turns.ts            getNextPlayer, turn order, turn ids
    round.ts            resolveRound, isRoundOver
    match.ts            statsAfterRound, isMatchOver, resolveMatch
    validators.ts       error codes, nickname/avatar sanitising
    events.ts           the event catalogue
    reducer.ts          applyEvent: the single state reducer (server + clients)
    engine.ts           executeCommand: the authoritative state machine
    strategy.ts         exact expected-value DP (hard bots, timeout moves, trainer)
    selectors.ts        UI helpers
  lib/server/           route-handler services (store, session, rate limits, analytics)
  lib/client/           API client, server clock, realtime feed, presentation queue, sound/haptics
  components/           game UI (tiles, dice, boards, overlays, lobby, results)
  app/                  routes (see §6)
supabase/migrations/    schema, RLS, RPCs, projection trigger
e2e/                    Playwright multiplayer tests
```

### Server authority (event-sourced)

```
phone ──intent──▶ POST /api/rooms/:code/command {command, commandId}
                    │ load room (state + version)
                    │ executeCommand(state, intent, {server clock, CSPRNG, actor})
                    │   → validates, emits events, folds them with applyEvent
                    │ shut10_commit(room, expectedVersion, newState, events)  ← one transaction
                    │   version mismatch → reload & re-validate (optimistic concurrency)
                    ▼
            game_events (append-only) ──Supabase Realtime──▶ every phone folds the same events
```

* Clients send **intents only** (`ROLL`, `CLOSE_TILES {turnId, tiles}`, `SET_READY`, …). Dice,
  turn owner, tiles, scores and winners are computed on the server. Dice come from a CSPRNG.
* Every command carries an **idempotency key** (`commandId`). Retries and double taps apply once;
  a second ROLL is rejected (`ALREADY_ROLLED`); a stale close is rejected (`STALE_TURN`).
* The **same reducer** runs on the server and on every phone, so all phones converge on identical
  state. Unit tests assert that folding the event log from scratch equals the server's public state
  for full matches in every mode.
* Realtime traffic is **deltas only** (e.g. `{type:"TILES_CLOSED", playerId, tiles:[3,5]}`).
  Clients detect `seq` gaps and fetch the missing events; heartbeats also report the version.

### State machine

Persisted phases: `ROOM_LOBBY → STARTING (3·2·1) → PLAYER_TURN ⇄ AWAITING_TILE_SELECTION →
ROUND_RESULTS (intermission) → ROUND_SETUP → … → MATCH_RESULTS → (REMATCH | lobby) … FINISHED`.
Transient phases (`DICE_ROLLING`, `RESOLVING_MOVE`, `PLAYER_BLOCKED`, `NEXT_PLAYER`,
`ROUND_COMPLETE`, `INTERMISSION`, `REMATCH`) happen inside one atomic transition and reach clients
as events. The client **presentation queue** replays them with short delays (dice tumble,
"Checking moves…", tile flip, BLOCKED stamp, celebration). Backlogs after a reconnect
fast-forward instantly.

### Time, timers and presence

There are no background workers (Vercel is serverless). The engine's **lazy clock** (`advanceTime`)
runs before every command, on heartbeats (every 8 s) and on client-scheduled ticks at the next
server deadline (`nextWakeAt`). All deadlines are **server timestamps**; the client shows
countdowns using a measured server-clock offset.

* **Roll / move timers** (off / 15 / 30 / 45 / 60 s): expiry auto-rolls or plays a legal move
  (turn status `EXPIRED`).
* **Presence**: heartbeat → `online`; no heartbeat for 15 s → `reconnecting`; past the grace
  period (60 s default) → `offline`. Supabase Presence drives the instant UI dots.
* **Disconnect on your turn** (host setting): *wait 30 s then skip* (default) · *skip* · *block*.
  Offline beyond grace → blocked for the round, "out" in later rounds. Players are never removed
  mid-match just for disconnecting.
* **Host migration**: a host offline past grace hands over to the longest-connected online player.
* **Reconnect**: identity is a signed guest token (httpOnly cookie, plus a localStorage fallback
  header). Returning restores seat, color, board, score, turn and match exactly.

### Storage modes

| Mode | When | Realtime |
|---|---|---|
| **Supabase** | `NEXT_PUBLIC_SUPABASE_URL` + `SUPABASE_SECRET_KEY` set | Supabase Realtime `postgres_changes` on `game_events` + Presence |
| **Memory** | Local dev / Playwright (no Supabase vars) | Server-Sent Events from the in-process bus |

On Vercel without Supabase the API refuses to run (`NOT_CONFIGURED`), because serverless
instances don't share memory and a silent fallback would break multiplayer.

---

## 3. Database (Supabase Postgres)

Migration: `supabase/migrations/20260924000000_shut10_schema.sql`.

| Table | Purpose |
|---|---|
| `rooms` | authoritative `state jsonb` + `version` (optimistic concurrency), code, host, status, settings |
| `game_events` | append-only event log, `unique(room_id, seq)`; the Realtime source |
| `room_players` | seats; partial unique color (deferrable exclusion) and nickname per room; `last_seen_at` presence |
| `matches`, `match_players` | match lifecycle, per-player points / wins / perfect rounds, archived summary |
| `rounds`, `turns`, `dice_rolls` | round lifecycle; every turn (`WAITING…EXPIRED`) and roll |
| `tile_states` | one row per player per round with `open_tiles int[]` |
| `round_scores`, `match_scores` | **immutable** score audit (open tiles, sum, placement, perfect box) |
| `spectators`, `room_bans`, `profiles` | spectators, bans, optional account ↔ guest link |
| `analytics_events`, `error_events` | product analytics and server/projection errors |

A trigger projects each event into the relational tables. Projection failures are logged to
`error_events` and never block gameplay commits.

**RPCs** (all `SECURITY DEFINER`, executable only by `service_role`): `shut10_create_room`,
`shut10_commit`, `shut10_load_room`, `shut10_events_since`, `shut10_touch`, `shut10_presence`,
`shut10_archive_match`, `shut10_find_match`, `shut10_record_analytics`, `shut10_record_error`,
`shut10_link_profile`, `shut10_admin_overview`.

### RLS / security

* RLS is enabled on **every** table and all privileges are revoked from `anon`/`authenticated`,
  so normal clients cannot modify scores, tiles, dice, turns or hosts.
* The only client-readable table is `game_events` (SELECT, last 2 days) so Realtime can deliver
  it. Events hold public game information only (never guest ids or tokens). Room ids are random
  UUIDs that are only revealed to seated players.
* Because events come from the database, a client cannot forge them.
* Server-only fields (guest ids, bans, idempotency keys, dev dice queue) live in `rooms.state`
  and are stripped before anything is sent to a client.
* Rate limits: Upstash sliding window when configured, otherwise per-instance memory.

---

## 4. Setup

```bash
npm install
cp .env.example .env.local      # fill in when using Supabase
npm run dev                     # http://localhost:3000 (in-memory mode if no Supabase vars)
npm run lint
npm run typecheck
npm run test                    # engine + scoring + SQL migration (PGlite) tests
npm run build
npm run test:e2e                # 4-browser Playwright test (needs `npm run build` first)
```

### Supabase

1. Create a project.
2. Run the migration: paste `supabase/migrations/20260924000000_shut10_schema.sql` into the SQL
   editor, or run `supabase db push` with the CLI. The migration is idempotent.
3. Check that **Realtime** is enabled for `game_events` (the migration adds it to the
   `supabase_realtime` publication).
4. Copy the project URL, **publishable** key and **secret** key into the env vars.
5. Optional accounts: enable the Email (magic link) provider and add
   `https://<your-domain>/profile` to the Auth redirect URLs.

### Vercel

1. Import the repo (framework preset: Next.js).
2. Set the environment variables:

| Variable | Required | Notes |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | yes | |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | yes | browser-safe |
| `SUPABASE_SECRET_KEY` | yes | server only |
| `NEXT_PUBLIC_APP_URL` | recommended | base for invite links / QR |
| `SESSION_SECRET` | recommended | HMAC key for guest tokens |
| `ADMIN_PASSWORD` | for `/admin` | admin disabled when unset |
| `UPSTASH_REDIS_REST_URL`, `UPSTASH_REDIS_REST_TOKEN` | optional | shared rate limiting |

3. Deploy, open the URL on two phones, create a room on one and join from the other.

---

## 5. Testing

* **Unit** (`src/game-engine/__tests__`): combinations (including brute-force equivalence over every
  subset), blocked detection, scoring, tie-breaks, match points / cumulative scoring, turn
  advancement, doubles, timers, pause, disconnect/wait/skip, host migration, idempotency,
  anti-cheat rejections, all modes, and full bot-played matches whose client fold must equal the
  server state.
* **SQL** (`supabase/migration.test.ts`): runs the real migration on PGlite (embedded Postgres)
  and checks atomic create/commit, version conflicts, projections, presence, rematch color swaps,
  RLS lockout and admin aggregates.
* **E2E** (`e2e/multiplayer.spec.ts`): four browser contexts create, join, ready and start. A
  rolls a forced 3+5 and every phone sees 8. A closes 3+5 and every phone updates. The turn moves
  to B (2+6 → 8), then to C. C's phone closes and reconnects with its board intact. The round
  finishes with identical scores on all four, then the match ends and a rematch reuses the room.
  A second test covers page refresh restoring state. `e2e/screenshots.ts` captures phone
  screenshots of the main screens.

### Dev tools

In development (or `SHUT10_DEV_TOOLS=1` on a local production build) the menu shows a **DEV**
tab: force dice, force turn, set/close tiles, block player, shut board, next round, simulate
disconnect, add fake players (bots). The server rejects these commands otherwise, and they are
always off when `VERCEL_ENV=production`.

---

## 6. Routes

| Route | |
|---|---|
| `/` | Home: PLAY WITH FRIENDS · JOIN ROOM · PRACTICE |
| `/create` | nickname, avatar, color, game options → room |
| `/join`, `/join/[code]` | code entry / invite link (no account needed) |
| `/room/[code]` | lobby (four-sided seat table, share, QR, ready, host settings) and live game |
| `/game/[matchId]` | resolves to the live room (the URL follows the match while playing) |
| `/results/[matchId]` | shareable final results |
| `/practice`, `/profile`, `/admin` | solo mode · preferences/stats/optional account · admin panel |

**Admin** (`/admin`, `ADMIN_PASSWORD`): active rooms (close), finished matches, aggregate stats
(average room size, rounds, completion and rematch rates, average score, perfect boxes) and error
events. No tokens or guest ids are exposed.

---

## 7. Feel

Hinged 3D tiles on a spring-driven `rotateX` (lift on select, fall forward to close, sequential
rise on reset). Colored dice that tumble and always land on the server result. Procedural Web
Audio sounds (dice shake/land, wood flip, turn chime, blocked, celebration, round win). Vibration
haptics where supported (iOS Safari has no Vibration API). Sound and haptics each have a toggle.
Colors are never the only cue: each color has its own shape (◆ ▲ ● ★) and name.

### Known limits

* iOS installed PWAs keep cookies separate from Safari, so a player who installs mid-game joins
  as a new guest (unless they sign in with the optional account).
* Race mode ignores the doubles rule by design; Classic treats a disconnect skip as a block.
