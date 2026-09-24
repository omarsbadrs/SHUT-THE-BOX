-- ============================================================================
-- SHUT10 schema
--
-- Authority model
--   * rooms.state holds the authoritative server state (including server-only
--     fields such as guest ids). Only the service role can read or write it.
--   * game_events is the append-only event log. Clients subscribe to it via
--     Supabase Realtime (postgres_changes). Events never contain secrets.
--   * Every mutation goes through shut10_commit(), which checks the room
--     version and appends events in ONE transaction (optimistic concurrency).
--   * A trigger projects events into the relational audit tables (players,
--     matches, rounds, turns, dice rolls, tile states, scores).
-- ============================================================================

-- ─────────────────────────────── Tables ───────────────────────────────

create table if not exists public.profiles (
  id uuid primary key,
  guest_id text unique,
  nickname text,
  avatar text,
  stats jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.rooms (
  id uuid primary key,
  code text not null unique check (code ~ '^[ABCDEFGHJKMNPQRSTUVWXYZ2-9]{6}$'),
  host_player_id uuid,
  status text not null default 'ROOM_LOBBY',
  mode text not null default 'faceoff',
  max_players int not null default 4 check (max_players between 2 and 4),
  round_count int not null default 0,
  settings jsonb not null default '{}'::jsonb,
  state jsonb not null,
  version int not null default 0,
  created_at timestamptz not null default now(),
  started_at timestamptz,
  updated_at timestamptz not null default now(),
  closed_at timestamptz
);
create index if not exists rooms_updated_idx on public.rooms (updated_at desc);

create table if not exists public.room_players (
  id uuid primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  user_id uuid,
  guest_id text,
  nickname text not null,
  avatar text not null default '',
  color text not null check (color in ('blue', 'green', 'red', 'yellow')),
  seat_position int not null check (seat_position between 0 and 3),
  is_host boolean not null default false,
  is_ready boolean not null default false,
  is_bot boolean not null default false,
  connection_status text not null default 'online'
    check (connection_status in ('online', 'reconnecting', 'offline', 'left')),
  joined_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  left_at timestamptz
);
-- One active player per color and per nickname in a room. The color rule is a
-- deferrable exclusion constraint so a rematch "shuffle colors" swap is legal
-- inside one transaction.
do $$
begin
  alter table public.room_players add constraint room_players_color_excl
    exclude using btree (room_id with =, color with =) where (left_at is null) deferrable initially deferred;
exception when duplicate_object or duplicate_table then null;
end $$;
create unique index if not exists room_players_nickname_uniq on public.room_players (room_id, lower(nickname)) where left_at is null;
create index if not exists room_players_room_idx on public.room_players (room_id);

create table if not exists public.matches (
  id uuid primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  number int not null,
  status text not null default 'in_progress' check (status in ('in_progress', 'completed')),
  settings jsonb not null default '{}'::jsonb,
  result jsonb,
  summary jsonb,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  unique (room_id, number)
);

create table if not exists public.match_players (
  id uuid primary key default gen_random_uuid(),
  match_id uuid not null references public.matches (id) on delete cascade,
  room_player_id uuid not null,
  color text not null,
  match_points int not null default 0,
  round_wins int not null default 0,
  perfect_rounds int not null default 0,
  cumulative_score int not null default 0,
  status text not null default 'playing',
  unique (match_id, room_player_id)
);

create table if not exists public.rounds (
  id uuid primary key,
  match_id uuid not null references public.matches (id) on delete cascade,
  number int not null,
  starter_player_id uuid,
  started_at timestamptz not null default now(),
  ended_at timestamptz,
  end_reason text,
  unique (match_id, number)
);

create table if not exists public.turns (
  id text primary key,
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null,
  turn_number int not null,
  die1 int check (die1 between 1 and 6),
  die2 int check (die2 between 1 and 6),
  total int,
  selected_tiles int[],
  status text not null check (status in ('WAITING', 'ROLLED', 'AWAITING_SELECTION', 'RESOLVED', 'BLOCKED', 'EXPIRED')),
  started_at timestamptz not null default now(),
  resolved_at timestamptz
);
create index if not exists turns_round_idx on public.turns (round_id);

create table if not exists public.dice_rolls (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  round_id uuid,
  turn_id text,
  player_id uuid not null,
  die1 int not null check (die1 between 1 and 6),
  die2 int check (die2 between 1 and 6),
  total int not null,
  is_double boolean not null default false,
  auto text,
  rolled_at timestamptz not null default now()
);
create index if not exists dice_rolls_room_idx on public.dice_rolls (room_id);

-- Current board per player per round (one row, updated in place; history lives in turns/game_events).
create table if not exists public.tile_states (
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null,
  open_tiles int[] not null,
  status text not null default 'active',
  updated_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

-- Immutable score audit.
create table if not exists public.round_scores (
  round_id uuid not null references public.rounds (id) on delete cascade,
  player_id uuid not null,
  open_tiles int[] not null,
  open_tile_sum int not null,
  placement int not null,
  perfect_box boolean not null,
  points int not null,
  created_at timestamptz not null default now(),
  primary key (round_id, player_id)
);

create table if not exists public.match_scores (
  match_id uuid not null references public.matches (id) on delete cascade,
  player_id uuid not null,
  rank int not null,
  round_wins int not null,
  match_points int not null,
  cumulative_score int not null,
  is_winner boolean not null,
  created_at timestamptz not null default now(),
  primary key (match_id, player_id)
);

create table if not exists public.game_events (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  seq int not null,
  type text not null,
  payload jsonb not null,
  created_at timestamptz not null default now(),
  unique (room_id, seq)
);

create table if not exists public.spectators (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  guest_id text not null,
  joined_at timestamptz not null default now(),
  unique (room_id, guest_id)
);

create table if not exists public.room_bans (
  id bigint generated always as identity primary key,
  room_id uuid not null references public.rooms (id) on delete cascade,
  guest_id text not null,
  banned_at timestamptz not null default now(),
  unique (room_id, guest_id)
);

create table if not exists public.analytics_events (
  id bigint generated always as identity primary key,
  name text not null,
  room_id uuid,
  props jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
create index if not exists analytics_name_idx on public.analytics_events (name, created_at desc);

create table if not exists public.error_events (
  id bigint generated always as identity primary key,
  source text not null,
  message text not null,
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

-- ─────────────────────────────── RLS ───────────────────────────────
-- Every table has RLS enabled and NO write policies: normal clients cannot
-- modify scores, tiles, dice, turns or hosts. The server uses the secret key.
-- The only client-readable table is game_events (public board-game info, no
-- secrets), required for Realtime delivery.

alter table public.profiles enable row level security;
alter table public.rooms enable row level security;
alter table public.room_players enable row level security;
alter table public.matches enable row level security;
alter table public.match_players enable row level security;
alter table public.rounds enable row level security;
alter table public.turns enable row level security;
alter table public.dice_rolls enable row level security;
alter table public.tile_states enable row level security;
alter table public.round_scores enable row level security;
alter table public.match_scores enable row level security;
alter table public.game_events enable row level security;
alter table public.spectators enable row level security;
alter table public.room_bans enable row level security;
alter table public.analytics_events enable row level security;
alter table public.error_events enable row level security;

drop policy if exists "game events are readable for realtime" on public.game_events;
create policy "game events are readable for realtime"
  on public.game_events for select
  to anon, authenticated
  using (created_at > now() - interval '2 days');

revoke all on all tables in schema public from anon, authenticated;
grant select on public.game_events to anon, authenticated;

-- Realtime delivery of new events.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime') then
    begin
      alter publication supabase_realtime add table public.game_events;
    exception when duplicate_object then null;
    end;
  end if;
end $$;

-- ─────────────────────────────── Helpers ───────────────────────────────

create or replace function public.shut10_ts(ms jsonb) returns timestamptz
language sql immutable as $$
  select case when ms is null or ms = 'null'::jsonb then null else to_timestamp((ms #>> '{}')::double precision / 1000.0) end
$$;

create or replace function public.shut10_int_array(j jsonb) returns int[]
language sql immutable as $$
  select coalesce(array(select (x #>> '{}')::int from jsonb_array_elements(coalesce(j, '[]'::jsonb)) x order by 1), '{}'::int[])
$$;

-- ─────────────────────────────── Projection ───────────────────────────────

create or replace function public.shut10_project_event() returns trigger
language plpgsql security definer set search_path = public as $$
declare
  e jsonb := new.payload;
  t text := new.type;
  ts timestamptz := public.shut10_ts(e -> 'at');
  room_state jsonb;
  v_match uuid;
  v_round uuid;
  pid text;
  entry jsonb;
begin
  select state into room_state from rooms where id = new.room_id;
  v_match := nullif(room_state #>> '{match,id}', '')::uuid;
  v_round := nullif(room_state #>> '{match,round,id}', '')::uuid;

  if t = 'PLAYER_JOINED' then
    insert into room_players (id, room_id, guest_id, nickname, avatar, color, seat_position, is_host, is_ready, is_bot,
                              connection_status, joined_at, last_seen_at)
    values ((e #>> '{player,id}')::uuid, new.room_id, room_state #>> array['private', 'guests', e #>> '{player,id}'],
            e #>> '{player,nickname}', e #>> '{player,avatar}', e #>> '{player,color}', (e #>> '{player,seat}')::int,
            (room_state ->> 'hostId') = (e #>> '{player,id}'), (e #>> '{player,isReady}')::boolean,
            (e #>> '{player,isBot}')::boolean, 'online', ts, ts)
    on conflict (id) do update set connection_status = 'online', left_at = null;

  elsif t = 'PLAYER_LEFT' then
    update room_players set connection_status = 'left', left_at = ts, is_ready = false
     where id = (e ->> 'playerId')::uuid;

  elsif t = 'PLAYER_UPDATED' then
    update room_players set
      nickname = coalesce(e ->> 'nickname', nickname),
      avatar = coalesce(e ->> 'avatar', avatar),
      color = coalesce(e ->> 'color', color),
      seat_position = case e ->> 'color' when 'blue' then 0 when 'green' then 1 when 'red' then 2 when 'yellow' then 3 else seat_position end
     where id = (e ->> 'playerId')::uuid;

  elsif t = 'PLAYER_READY' then
    update room_players set is_ready = (e ->> 'ready')::boolean where id = (e ->> 'playerId')::uuid;

  elsif t = 'HOST_CHANGED' then
    update room_players set is_host = (id = (e ->> 'hostId')::uuid) where room_id = new.room_id;

  elsif t = 'PLAYER_CONNECTION' then
    update room_players set connection_status = e ->> 'status'
     where id = (e ->> 'playerId')::uuid and connection_status <> 'left';

  elsif t = 'REMATCH_STARTED' and e -> 'colors' is not null and e -> 'colors' <> 'null'::jsonb then
    -- Colors are swapped as a set (the exclusion constraint is checked at commit).
    update room_players rp set
      color = c.value #>> '{}',
      seat_position = case c.value #>> '{}' when 'blue' then 0 when 'green' then 1 when 'red' then 2 else 3 end
      from jsonb_each(e -> 'colors') c
     where rp.id = c.key::uuid;

  elsif t = 'MATCH_STARTED' then
    insert into matches (id, room_id, number, status, settings, started_at)
    values ((e ->> 'matchId')::uuid, new.room_id, (e ->> 'number')::int, 'in_progress', e -> 'settings', ts)
    on conflict (id) do nothing;
    insert into match_players (match_id, room_player_id, color)
    select (e ->> 'matchId')::uuid, rp.id, rp.color
      from room_players rp
     where rp.id in (select (x #>> '{}')::uuid from jsonb_array_elements(e -> 'playerIds') x)
    on conflict do nothing;
    update rooms set started_at = coalesce(started_at, ts) where id = new.room_id;

  elsif t = 'ROUND_STARTED' then
    insert into rounds (id, match_id, number, starter_player_id, started_at)
    values ((e ->> 'roundId')::uuid, v_match, (e ->> 'number')::int, (e ->> 'starterId')::uuid, ts)
    on conflict (id) do nothing;
    insert into tile_states (round_id, player_id, open_tiles, status, updated_at)
    select (e ->> 'roundId')::uuid, (x #>> '{}')::uuid, '{1,2,3,4,5,6,7,8,9,10}'::int[],
           case when e -> 'outIds' ? (x #>> '{}') then 'out' else 'active' end, ts
      from jsonb_array_elements(e -> 'order') x
    on conflict do nothing;
    update rooms set round_count = round_count + 1 where id = new.room_id;

  elsif t = 'DICE_ROLLED' then
    insert into dice_rolls (room_id, round_id, turn_id, player_id, die1, die2, total, is_double, auto, rolled_at)
    values (new.room_id, v_round, e ->> 'turnId', (e ->> 'playerId')::uuid, (e ->> 'die1')::int,
            nullif(e ->> 'die2', '')::int, (e ->> 'total')::int, (e ->> 'isDouble')::boolean, e ->> 'auto', ts);
    insert into turns (id, round_id, player_id, turn_number, die1, die2, total, status, started_at)
    values (e ->> 'turnId', v_round, (e ->> 'playerId')::uuid,
            coalesce((room_state #>> '{match,round,turnNumber}')::int, 0),
            (e ->> 'die1')::int, nullif(e ->> 'die2', '')::int, (e ->> 'total')::int,
            case when (e ->> 'validCount')::int = 0 then 'BLOCKED' else 'AWAITING_SELECTION' end, ts)
    on conflict (id) do nothing;

  elsif t = 'TILES_CLOSED' then
    update turns set selected_tiles = public.shut10_int_array(e -> 'tiles'),
                     status = case when e ->> 'auto' = 'timeout' then 'EXPIRED' else 'RESOLVED' end,
                     resolved_at = ts
     where id = e ->> 'turnId';
    update tile_states set
      open_tiles = coalesce(array(select u from unnest(open_tiles) u
                                   where u <> all (public.shut10_int_array(e -> 'tiles')) order by u), '{}'::int[]),
      updated_at = ts
     where round_id = v_round and player_id = (e ->> 'playerId')::uuid;

  elsif t = 'TURN_SKIPPED' then
    update turns set status = 'EXPIRED', resolved_at = ts
     where round_id = v_round and player_id = (e ->> 'playerId')::uuid and status = 'AWAITING_SELECTION';

  elsif t = 'PLAYER_BLOCKED' then
    update tile_states set status = 'blocked', updated_at = ts
     where round_id = v_round and player_id = (e ->> 'playerId')::uuid;
    update turns set status = 'BLOCKED', resolved_at = ts
     where round_id = v_round and player_id = (e ->> 'playerId')::uuid and status = 'AWAITING_SELECTION';

  elsif t = 'PLAYER_SHUT_BOX' then
    update tile_states set status = 'shut', open_tiles = '{}'::int[], updated_at = ts
     where round_id = v_round and player_id = (e ->> 'playerId')::uuid;

  elsif t = 'TILES_CORRECTED' then
    update tile_states set open_tiles = public.shut10_int_array(e -> 'openTiles'), updated_at = ts
     where round_id = v_round and player_id = (e ->> 'playerId')::uuid;

  elsif t = 'ROUND_COMPLETED' then
    update rounds set ended_at = ts, end_reason = e #>> '{result,reason}'
     where id = (e #>> '{result,roundId}')::uuid;
    for entry in select * from jsonb_array_elements(e #> '{result,entries}') loop
      insert into round_scores (round_id, player_id, open_tiles, open_tile_sum, placement, perfect_box, points)
      values ((e #>> '{result,roundId}')::uuid, (entry ->> 'playerId')::uuid, public.shut10_int_array(entry -> 'openTiles'),
              (entry ->> 'openTileSum')::int, (entry ->> 'placement')::int, (entry ->> 'perfectBox')::boolean,
              (entry ->> 'points')::int)
      on conflict do nothing;
    end loop;

  elsif t = 'SCORE_UPDATED' then
    for pid, entry in select key, value from jsonb_each(e -> 'stats') loop
      update match_players set
        match_points = (entry ->> 'matchPoints')::int,
        round_wins = (entry ->> 'roundWins')::int,
        perfect_rounds = (entry ->> 'perfectRounds')::int,
        cumulative_score = (entry ->> 'cumulativeScore')::int
       where match_id = v_match and room_player_id = pid::uuid;
    end loop;

  elsif t = 'MATCH_COMPLETED' then
    update matches set status = 'completed', ended_at = ts, result = e -> 'result' where id = v_match;
    for entry in select * from jsonb_array_elements(e #> '{result,standings}') loop
      insert into match_scores (match_id, player_id, rank, round_wins, match_points, cumulative_score, is_winner)
      values (v_match, (entry ->> 'playerId')::uuid, (entry ->> 'rank')::int, (entry ->> 'roundWins')::int,
              (entry ->> 'matchPoints')::int, (entry ->> 'cumulativeScore')::int,
              (e #> '{result,winnerIds}') ? (entry ->> 'playerId'))
      on conflict do nothing;
    end loop;
    update match_players set status = 'finished' where match_id = v_match;

  elsif t = 'ROOM_CLOSED' then
    update rooms set closed_at = ts where id = new.room_id;
  end if;

  return new;
exception when others then
  -- Projections are an audit trail; they must never block gameplay commits.
  insert into error_events (source, message, context)
  values ('projection', sqlerrm, jsonb_build_object('type', t, 'seq', new.seq, 'room_id', new.room_id));
  return new;
end $$;

drop trigger if exists shut10_project_event on public.game_events;
create trigger shut10_project_event after insert on public.game_events
  for each row execute function public.shut10_project_event();

-- ─────────────────────────────── RPCs (service role only) ───────────────────────────────

create or replace function public.shut10_insert_events(p_room_id uuid, p_events jsonb) returns void
language plpgsql security definer set search_path = public as $$
declare ev jsonb;
begin
  -- One statement per event so projection triggers run strictly in order.
  for ev in select value from jsonb_array_elements(p_events) order by (value ->> 'seq')::int loop
    insert into game_events (room_id, seq, type, payload, created_at)
    values (p_room_id, (ev ->> 'seq')::int, ev ->> 'type', ev, public.shut10_ts(ev -> 'at'));
  end loop;
end $$;

create or replace function public.shut10_sync_private(p_room_id uuid, p_state jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into spectators (room_id, guest_id)
  select p_room_id, x #>> '{}' from jsonb_array_elements(coalesce(p_state #> '{private,spectators}', '[]'::jsonb)) x
  on conflict do nothing;
  insert into room_bans (room_id, guest_id)
  select p_room_id, x #>> '{}' from jsonb_array_elements(coalesce(p_state #> '{private,bans}', '[]'::jsonb)) x
  on conflict do nothing;
end $$;

create or replace function public.shut10_create_room(p_room_id uuid, p_code text, p_state jsonb, p_events jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
begin
  begin
    insert into rooms (id, code, host_player_id, status, mode, max_players, settings, state, version)
    values (p_room_id, p_code, nullif(p_state ->> 'hostId', '')::uuid, p_state ->> 'phase',
            p_state #>> '{settings,gameMode}', (p_state #>> '{settings,maxPlayers}')::int,
            p_state -> 'settings', p_state, (p_state ->> 'version')::int);
  exception when unique_violation then
    return false;
  end;
  perform public.shut10_insert_events(p_room_id, p_events);
  return true;
end $$;

-- Atomic, version-checked commit of a state transition and its events.
create or replace function public.shut10_commit(p_room_id uuid, p_expected_version int, p_state jsonb, p_events jsonb)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_count int := jsonb_array_length(p_events);
begin
  if (p_state ->> 'version')::int <> p_expected_version + v_count then
    raise exception 'version mismatch in payload';
  end if;
  update rooms set
    state = p_state,
    version = p_expected_version + v_count,
    status = p_state ->> 'phase',
    host_player_id = nullif(p_state ->> 'hostId', '')::uuid,
    mode = p_state #>> '{settings,gameMode}',
    max_players = (p_state #>> '{settings,maxPlayers}')::int,
    settings = p_state -> 'settings',
    updated_at = now()
  where id = p_room_id and version = p_expected_version;
  if not found then
    return false;
  end if;
  perform public.shut10_insert_events(p_room_id, p_events);
  perform public.shut10_sync_private(p_room_id, p_state);
  return true;
end $$;

create or replace function public.shut10_load_room(p_code text) returns jsonb
language sql stable security definer set search_path = public as $$
  select state from rooms where code = upper(p_code)
$$;

create or replace function public.shut10_events_since(p_room_id uuid, p_seq int, p_limit int) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_agg(payload order by seq), '[]'::jsonb)
    from (select payload, seq from game_events where room_id = p_room_id and seq > p_seq order by seq limit p_limit) s
$$;

create or replace function public.shut10_touch(p_room_id uuid, p_entries jsonb) returns void
language sql security definer set search_path = public as $$
  update room_players rp set last_seen_at = public.shut10_ts(x.value)
    from jsonb_each(p_entries) x
   where rp.room_id = p_room_id and rp.id = x.key::uuid
$$;

create or replace function public.shut10_presence(p_room_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select coalesce(jsonb_object_agg(id::text, floor(extract(epoch from last_seen_at) * 1000)::bigint), '{}'::jsonb)
    from room_players where room_id = p_room_id and left_at is null
$$;

create or replace function public.shut10_archive_match(p_summary jsonb) returns void
language plpgsql security definer set search_path = public as $$
begin
  insert into matches (id, room_id, number, status, settings, result, summary, started_at, ended_at)
  values ((p_summary ->> 'matchId')::uuid, (p_summary ->> 'roomId')::uuid, (p_summary ->> 'number')::int, 'completed',
          p_summary -> 'settings', p_summary -> 'result', p_summary,
          public.shut10_ts(p_summary -> 'startedAt'), public.shut10_ts(p_summary -> 'endedAt'))
  on conflict (id) do update set summary = excluded.summary, result = excluded.result,
                                 status = 'completed', ended_at = excluded.ended_at;
end $$;

create or replace function public.shut10_find_match(p_match_id uuid) returns jsonb
language sql stable security definer set search_path = public as $$
  select jsonb_build_object('code', r.code, 'summary', m.summary)
    from matches m join rooms r on r.id = m.room_id
   where m.id = p_match_id
$$;

create or replace function public.shut10_record_analytics(p_rows jsonb) returns void
language sql security definer set search_path = public as $$
  insert into analytics_events (name, room_id, props, created_at)
  select x ->> 'name', nullif(x ->> 'roomId', '')::uuid, coalesce(x -> 'props', '{}'::jsonb), public.shut10_ts(x -> 'at')
    from jsonb_array_elements(p_rows) x
$$;

create or replace function public.shut10_record_error(p_source text, p_message text, p_context jsonb) returns void
language sql security definer set search_path = public as $$
  insert into error_events (source, message, context) values (p_source, left(p_message, 2000), coalesce(p_context, '{}'::jsonb))
$$;

create or replace function public.shut10_link_profile(p_user_id uuid, p_guest_id text, p_nickname text, p_avatar text)
returns text
language plpgsql security definer set search_path = public as $$
declare v_guest text;
begin
  select guest_id into v_guest from profiles where id = p_user_id;
  if v_guest is not null then
    update profiles set updated_at = now(),
      nickname = coalesce(p_nickname, nickname), avatar = coalesce(p_avatar, avatar)
     where id = p_user_id;
    return v_guest;
  end if;
  insert into profiles (id, guest_id, nickname, avatar) values (p_user_id, p_guest_id, p_nickname, p_avatar)
  on conflict (id) do update set guest_id = coalesce(profiles.guest_id, excluded.guest_id), updated_at = now();
  select guest_id into v_guest from profiles where id = p_user_id;
  return v_guest;
end $$;

create or replace function public.shut10_admin_overview() returns jsonb
language sql stable security definer set search_path = public as $$
  with a as (select name, props from analytics_events where created_at > now() - interval '30 days'),
  started as (select count(*)::numeric c, coalesce(avg((props ->> 'players')::numeric), 0) avg_size from a where name = 'game_started'),
  completed as (select count(*)::numeric c, coalesce(avg((props ->> 'rounds')::numeric), 0) avg_rounds from a where name = 'game_completed'),
  round_stats as (select coalesce(avg((props ->> 'averageScore')::numeric), 0) avg_score from a where name = 'round_completed')
  select jsonb_build_object(
    'store', 'supabase',
    'activeRooms', coalesce((
      select jsonb_agg(jsonb_build_object(
        'roomId', r.id, 'code', r.code, 'phase', r.status, 'mode', r.mode,
        'players', (select count(*) from room_players rp where rp.room_id = r.id and rp.left_at is null),
        'version', r.version, 'updatedAt', r.updated_at) order by r.updated_at desc)
      from (select * from rooms where closed_at is null and updated_at > now() - interval '1 day'
            order by updated_at desc limit 100) r), '[]'::jsonb),
    'finishedMatches', coalesce((
      select jsonb_agg(jsonb_build_object(
        'matchId', m.id, 'code', r.code,
        'winner', coalesce((select rp.nickname from room_players rp
                             where rp.id::text = m.result #>> '{winnerIds,0}'), '—'),
        'rounds', (select count(*) from rounds x where x.match_id = m.id and x.ended_at is not null),
        'endedAt', m.ended_at) order by m.ended_at desc)
      from (select * from matches where status = 'completed' order by ended_at desc nulls last limit 50) m
      join rooms r on r.id = m.room_id), '[]'::jsonb),
    'stats', jsonb_build_object(
      'roomsCreated', (select count(*) from a where name = 'room_created'),
      'matchesStarted', (select c from started),
      'matchesCompleted', (select c from completed),
      'rematches', (select count(*) from a where name = 'rematch'),
      'averageRoomSize', (select avg_size from started),
      'averageRounds', (select avg_rounds from completed),
      'averageScore', (select avg_score from round_stats),
      'perfectBoxes', (select count(*) from a where name = 'perfect_box'),
      'completionRate', (select case when s.c = 0 then 0 else c.c / s.c end from started s, completed c),
      'rematchRate', (select case when c.c = 0 then 0 else (select count(*) from a where name = 'rematch') / c.c end from completed c)
    ),
    'errors', coalesce((
      select jsonb_agg(jsonb_build_object('source', source, 'message', message, 'at', created_at) order by created_at desc)
      from (select * from error_events order by created_at desc limit 50) e), '[]'::jsonb)
  )
$$;

-- Functions are callable only by the server (service role / secret key).
do $$
declare f text;
begin
  foreach f in array array[
    'shut10_project_event()',
    'shut10_insert_events(uuid, jsonb)',
    'shut10_sync_private(uuid, jsonb)',
    'shut10_create_room(uuid, text, jsonb, jsonb)',
    'shut10_commit(uuid, int, jsonb, jsonb)',
    'shut10_load_room(text)',
    'shut10_events_since(uuid, int, int)',
    'shut10_touch(uuid, jsonb)',
    'shut10_presence(uuid)',
    'shut10_archive_match(jsonb)',
    'shut10_find_match(uuid)',
    'shut10_record_analytics(jsonb)',
    'shut10_record_error(text, text, jsonb)',
    'shut10_link_profile(uuid, text, text, text)',
    'shut10_admin_overview()'
  ] loop
    execute format('revoke all on function public.%s from public', f);
    if exists (select 1 from pg_roles where rolname = 'anon') then
      execute format('revoke all on function public.%s from anon, authenticated', f);
    end if;
    if exists (select 1 from pg_roles where rolname = 'service_role') then
      execute format('grant execute on function public.%s to service_role', f);
    end if;
  end loop;
end $$;
