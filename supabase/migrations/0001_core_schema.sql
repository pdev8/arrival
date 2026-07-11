-- Arrival M1 core schema (SPEC §5.2) — sessions ("trips"), members, stops,
-- votes, events. RLS is the security boundary: every row is reachable only
-- by members of its trip. Join/create go through SECURITY DEFINER RPCs so
-- codes, caps, and colors are enforced server-side.

-- ---------------------------------------------------------------- profiles

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  display_name text not null default 'Someone'
    check (char_length(display_name) between 1 and 40),
  avatar_url text,
  created_at timestamptz not null default now()
);

-- ------------------------------------------------------------------- trips

create table public.trips (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 80),
  kind text not null check (kind in ('roadtrip', 'hangout', 'mall')),
  join_code text not null unique,
  join_locked boolean not null default false,
  destination_name text,
  destination_lat double precision,
  destination_lng double precision,
  status text not null default 'active'
    check (status in ('planning', 'active', 'completed')),
  starts_at timestamptz not null default now(),
  duration_min integer not null default 240 check (duration_min between 30 and 1440),
  ends_at timestamptz not null,
  created_by uuid not null references auth.users (id),
  created_at timestamptz not null default now()
);

create index trips_join_code_idx on public.trips (join_code) where status = 'active';
create index trips_ends_at_idx on public.trips (ends_at) where status = 'active';

-- ------------------------------------------------------------ trip_members

create table public.trip_members (
  trip_id uuid not null references public.trips (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role text not null default 'member' check (role in ('owner', 'member')),
  color text not null,
  sharing_enabled boolean not null default true,
  -- last-known snapshot only; no position history in v1 (privacy: SPEC §5.2)
  last_lat double precision,
  last_lng double precision,
  last_heading real,
  last_speed real,
  last_level smallint, -- floors relative to street (F14)
  last_updated_at timestamptz,
  eta_seconds integer,
  distance_meters integer,
  state text not null default 'idle'
    check (state in ('idle', 'driving', 'walking', 'stopped', 'arrived')),
  joined_at timestamptz not null default now(),
  primary key (trip_id, user_id)
);

create index trip_members_user_idx on public.trip_members (user_id);

-- ------------------------------------------------------------------- stops

create table public.stops (
  id uuid primary key default gen_random_uuid(),
  trip_id uuid not null references public.trips (id) on delete cascade,
  created_by uuid not null references auth.users (id),
  kind text not null check (kind in ('suggestion', 'announcement')),
  status text not null default 'proposed'
    check (status in ('proposed', 'confirmed', 'active', 'done', 'cancelled')),
  category text not null
    check (category in ('gas', 'coffee', 'food', 'restroom', 'scenic', 'other')),
  name text not null check (char_length(name) between 1 and 80),
  lat double precision not null,
  lng double precision not null,
  note text check (char_length(note) <= 140),
  duration_min integer,
  created_at timestamptz not null default now(),
  resolved_at timestamptz
);

create index stops_trip_idx on public.stops (trip_id);

create table public.stop_participants (
  stop_id uuid not null references public.stops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  joined_at timestamptz not null default now(),
  primary key (stop_id, user_id)
);

create table public.stop_votes (
  stop_id uuid not null references public.stops (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  vote smallint not null check (vote in (-1, 1)),
  primary key (stop_id, user_id)
);

-- ------------------------------------------------------------- trip_events

create table public.trip_events (
  id bigint generated always as identity primary key,
  trip_id uuid not null references public.trips (id) on delete cascade,
  type text not null,
  actor_id uuid references auth.users (id),
  payload jsonb not null default '{}'::jsonb,
  reactions jsonb not null default '{}'::jsonb, -- emoji -> user ids (D3)
  created_at timestamptz not null default now()
);

create index trip_events_trip_idx on public.trip_events (trip_id, id desc);

-- --------------------------------------------------------------- membership
-- SECURITY DEFINER so RLS policies can consult membership without recursing
-- into trip_members' own policies.

create or replace function public.is_trip_member(p_trip uuid)
returns boolean
language sql
security definer
set search_path = public
stable
as $$
  select exists (
    select 1 from public.trip_members
    where trip_id = p_trip and user_id = auth.uid()
  );
$$;

-- --------------------------------------------------------------------- RLS

alter table public.profiles enable row level security;
alter table public.trips enable row level security;
alter table public.trip_members enable row level security;
alter table public.stops enable row level security;
alter table public.stop_participants enable row level security;
alter table public.stop_votes enable row level security;
alter table public.trip_events enable row level security;

-- profiles: anyone signed in can read (names/avatars render for co-members);
-- only you can write yours
create policy profiles_read on public.profiles
  for select to authenticated using (true);
create policy profiles_write_own on public.profiles
  for insert to authenticated with check (id = auth.uid());
create policy profiles_update_own on public.profiles
  for update to authenticated using (id = auth.uid());

-- trips: members read; owner updates (extend/lock/regenerate/complete)
create policy trips_member_read on public.trips
  for select to authenticated using (public.is_trip_member(id));
create policy trips_owner_update on public.trips
  for update to authenticated using (created_by = auth.uid());

-- trip_members: members see the roster; you update only your own row
-- (position snapshots, sharing toggle); leaving = deleting your own row.
-- INSERT is NOT granted — joining goes through the join_trip RPC.
create policy members_member_read on public.trip_members
  for select to authenticated using (public.is_trip_member(trip_id));
create policy members_update_own on public.trip_members
  for update to authenticated using (user_id = auth.uid());
create policy members_delete_own on public.trip_members
  for delete to authenticated using (user_id = auth.uid());

-- stops + votes + participants: members only
create policy stops_member_read on public.stops
  for select to authenticated using (public.is_trip_member(trip_id));
create policy stops_member_insert on public.stops
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and created_by = auth.uid());
create policy stops_creator_update on public.stops
  for update to authenticated using (created_by = auth.uid());

create policy stop_participants_read on public.stop_participants
  for select to authenticated using (
    exists (select 1 from public.stops s
            where s.id = stop_id and public.is_trip_member(s.trip_id)));
create policy stop_participants_write_own on public.stop_participants
  for insert to authenticated with check (
    user_id = auth.uid() and
    exists (select 1 from public.stops s
            where s.id = stop_id and public.is_trip_member(s.trip_id)));
create policy stop_participants_delete_own on public.stop_participants
  for delete to authenticated using (user_id = auth.uid());

create policy stop_votes_read on public.stop_votes
  for select to authenticated using (
    exists (select 1 from public.stops s
            where s.id = stop_id and public.is_trip_member(s.trip_id)));
create policy stop_votes_upsert_own on public.stop_votes
  for insert to authenticated with check (
    user_id = auth.uid() and
    exists (select 1 from public.stops s
            where s.id = stop_id and public.is_trip_member(s.trip_id)));
create policy stop_votes_update_own on public.stop_votes
  for update to authenticated using (user_id = auth.uid());
create policy stop_votes_delete_own on public.stop_votes
  for delete to authenticated using (user_id = auth.uid());

-- trip_events: members read; inserts happen server-side (RPCs/triggers) or
-- by members for their own actions
create policy events_member_read on public.trip_events
  for select to authenticated using (public.is_trip_member(trip_id));
create policy events_member_insert on public.trip_events
  for insert to authenticated
  with check (public.is_trip_member(trip_id) and actor_id = auth.uid());

-- -------------------------------------------------------------------- RPCs

-- 12-color member palette (SPEC §5.4a) — first unused color on join.
create or replace function public.next_member_color(p_trip uuid)
returns text
language sql
security definer
set search_path = public
stable
as $$
  select c from unnest(array[
    '#5B8DEF','#E0885A','#D06A9C','#4CAF83','#8B7CF6','#D9A13B',
    '#3FA8A8','#D95757','#7080E0','#A08363','#52B48C','#8A94A6'
  ]) as c
  where c not in (select color from public.trip_members where trip_id = p_trip)
  limit 1;
$$;

-- Creates a trip + owner membership; join code minted server-side.
create or replace function public.create_trip(
  p_name text,
  p_kind text,
  p_duration_min integer,
  p_destination_name text default null,
  p_destination_lat double precision default null,
  p_destination_lng double precision default null
)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips;
  v_code text;
  letters constant text := 'abcdefghjkmnpqrstuvwxyz';
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select string_agg(part, '-') into v_code
  from (
    select string_agg(substr(letters, 1 + floor(random() * 23)::int, 1), '') as part
    from generate_series(1, 9) g
    group by (g - 1) / 3
  ) parts;

  insert into public.trips (name, kind, join_code, destination_name,
    destination_lat, destination_lng, duration_min, ends_at, created_by)
  values (p_name, p_kind, v_code, p_destination_name, p_destination_lat,
    p_destination_lng, p_duration_min,
    now() + make_interval(mins => p_duration_min), auth.uid())
  returning * into v_trip;

  insert into public.trip_members (trip_id, user_id, role, color)
  values (v_trip.id, auth.uid(), 'owner', public.next_member_color(v_trip.id));

  insert into public.trip_events (trip_id, type, actor_id)
  values (v_trip.id, 'session_started', auth.uid());

  return v_trip;
end;
$$;

-- Join by code: active, unlocked, under the 12 cap, idempotent for members.
create or replace function public.join_trip(p_code text)
returns public.trips
language plpgsql
security definer
set search_path = public
as $$
declare
  v_trip public.trips;
  v_count integer;
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  select * into v_trip from public.trips
    where join_code = lower(p_code) and status = 'active' and ends_at > now();
  if not found then
    raise exception 'session not found or ended';
  end if;
  if v_trip.join_locked then
    raise exception 'session is locked';
  end if;
  if exists (select 1 from public.trip_members
             where trip_id = v_trip.id and user_id = auth.uid()) then
    return v_trip; -- already in
  end if;
  select count(*) into v_count from public.trip_members where trip_id = v_trip.id;
  if v_count >= 12 then
    raise exception 'session is full';
  end if;

  insert into public.trip_members (trip_id, user_id, color)
  values (v_trip.id, auth.uid(), public.next_member_color(v_trip.id));

  insert into public.trip_events (trip_id, type, actor_id)
  values (v_trip.id, 'member_joined', auth.uid());

  return v_trip;
end;
$$;

-- Expiry sweep — call from pg_cron (dashboard: schedule every minute) or an
-- edge function: flips overdue trips to completed. The realtime channel dies
-- with the status flip; clients hard-stop tracking on it (SPEC §5.6).
create or replace function public.complete_expired_trips()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  v_count integer;
begin
  with done as (
    update public.trips set status = 'completed'
    where status = 'active' and ends_at <= now()
    returning id
  )
  insert into public.trip_events (trip_id, type)
  select id, 'session_completed' from done;
  get diagnostics v_count = row_count;
  return v_count;
end;
$$;
