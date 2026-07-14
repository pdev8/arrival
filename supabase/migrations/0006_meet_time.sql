-- A time to meet.
--
-- A destination tells you WHERE. It does not tell you whether anyone is going to
-- make it, and that is the question people actually open the app for. With a
-- meeting time, every ETA in the product turns into the number that matters: not
-- "12 minutes away" but "4 minutes early" — or "8 minutes late", which is the one
-- that makes you text the group.
--
-- Nullable on purpose, and in both directions. Plenty of sessions have nowhere to
-- be and no time to be there (free roam). Plenty have a time before they have a
-- place ("we're meeting at 8, we'll figure out where"). Both are first-class
-- states, not missing values.

alter table public.trips add column if not exists meet_at timestamptz;

create or replace function public.set_meet_time(p_trip_id uuid, p_meet_at timestamptz)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_old timestamptz;
begin
  if not public.is_trip_member(p_trip_id) then
    raise exception 'not a member of this trip';
  end if;

  select meet_at into v_old from public.trips where id = p_trip_id;

  update public.trips
     set meet_at = p_meet_at,
         -- A SESSION MUST OUTLIVE ITS OWN MEETING.
         --
         -- ends_at is what archives a trip. Start a one-hour session, agree to
         -- meet at eight, and without this line the session dies at seven —
         -- archiving everyone while they are still walking to the thing they just
         -- agreed to. So push the end out past the meeting, with room to actually
         -- be there.
         --
         -- greatest() ignores nulls, so clearing the meeting time leaves ends_at
         -- exactly where it was: un-setting a plan must not extend a session.
         ends_at = greatest(ends_at, p_meet_at + interval '2 hours')
   where id = p_trip_id;

  -- the feed is the group's memory: who decided, and whether it moved
  insert into public.trip_events (trip_id, type, actor_id, payload)
  values (
    p_trip_id,
    case
      when p_meet_at is null then 'meet_time_cleared'
      when v_old is null     then 'meet_time_set'
      else                        'meet_time_changed'
    end,
    auth.uid(),
    jsonb_build_object('at', p_meet_at, 'from', v_old)
  );
end;
$$;

-- (no explicit grant, and no publication change: Supabase's default privileges
--  already let members call public functions, and `trips` joined the realtime
--  publication in 0005 — so a meeting time reaches everyone the moment it's set.)
