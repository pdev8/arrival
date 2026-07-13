-- Free roam, and a destination you can decide on later.
--
-- A session no longer has to know where it's going. People go out, start
-- tracking, and pick the place once they've argued about it — so the
-- destination is trip state that any member can set or change mid-session,
-- and every member sees it immediately (trips joins the realtime publication).
--
-- A session without a destination can never "complete" by everyone arriving,
-- so it finishes the way every session does: its time runs out, or everyone
-- has left it.

-- destination columns already exist and are nullable (0001), so free roam
-- needs no schema change — only the ability to fill them in later.

create or replace function public.set_destination(
  p_trip_id uuid,
  p_name text,
  p_lat double precision,
  p_lng double precision
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old text;
begin
  if not public.is_trip_member(p_trip_id) then
    raise exception 'not a member of this trip';
  end if;

  select destination_name into v_old from public.trips where id = p_trip_id;

  update public.trips
     set destination_name = p_name,
         destination_lat = p_lat,
         destination_lng = p_lng
   where id = p_trip_id;

  -- the feed is the group's memory: record who chose, and whether it changed
  insert into public.trip_events (trip_id, type, actor_id, payload)
  values (
    p_trip_id,
    case when v_old is null then 'destination_set' else 'destination_changed' end,
    auth.uid(),
    jsonb_build_object('name', p_name, 'from', v_old)
  );
end;
$$;

-- (no explicit grant: Supabase's default privileges already let members call
-- public functions — every other RPC here relies on the same. An explicit
-- grant to `anon` also breaks CI, whose stub Postgres has no such role.)

-- NOTE: there is deliberately no end_trip RPC. Leaving is personal (it marks
-- left_at on YOUR row — 0004 — and the session runs on without you, so you can
-- rejoin with the same code). A session finishes on its own terms: its ends_at
-- passes, or every member has left. Archiving follows that, not a button.

-- the destination must reach everyone the moment it's chosen
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
     where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'trips'
  ) then
    alter publication supabase_realtime add table public.trips;
  end if;
end $$;
