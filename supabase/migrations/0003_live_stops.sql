-- B6: stops, votes, participants and reactions go live. The rules the demo
-- sim enforced client-side become server-side triggers so every client sees
-- identical state: creators auto-join/auto-upvote their own stops, two
-- upvotes confirm a suggestion, and each beat lands in trip_events.
--
-- Trigger functions are SECURITY DEFINER on purpose: a voter's trigger must
-- flip stops.status even though RLS only lets the creator update the row.

-- ---------------------------------------------------------- posting a stop

create or replace function public.on_stop_posted()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.kind = 'announcement' then
    insert into public.stop_participants (stop_id, user_id)
    values (new.id, new.created_by)
    on conflict do nothing;
  else
    insert into public.stop_votes (stop_id, user_id, vote)
    values (new.id, new.created_by, 1)
    on conflict do nothing;
  end if;
  insert into public.trip_events (trip_id, type, actor_id, payload)
  values (new.trip_id, 'stop_posted', new.created_by, jsonb_build_object(
    'stop_id', new.id, 'name', new.name, 'kind', new.kind,
    'category', new.category, 'note', new.note));
  return new;
end;
$$;

create trigger stops_after_insert
  after insert on public.stops
  for each row execute function public.on_stop_posted();

-- ------------------------------------------------- votes confirm at two up

create or replace function public.on_stop_vote()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_stop public.stops;
  v_up integer;
begin
  select * into v_stop from public.stops where id = new.stop_id;
  if v_stop.kind = 'suggestion' and v_stop.status = 'proposed' then
    select count(*) into v_up
    from public.stop_votes where stop_id = new.stop_id and vote = 1;
    if v_up >= 2 then
      update public.stops set status = 'confirmed' where id = new.stop_id;
      insert into public.trip_events (trip_id, type, actor_id, payload)
      values (v_stop.trip_id, 'stop_confirmed', new.user_id, jsonb_build_object(
        'stop_id', v_stop.id, 'name', v_stop.name, 'votes', v_up));
    end if;
  end if;
  return new;
end;
$$;

create trigger stop_votes_after_write
  after insert or update on public.stop_votes
  for each row execute function public.on_stop_vote();

-- ------------------------------------------------------------ joining a stop

create or replace function public.on_stop_joined()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  -- the creator's auto-participation shouldn't spam the feed
  if not exists (
    select 1 from public.stops where id = new.stop_id and created_by = new.user_id
  ) then
    insert into public.trip_events (trip_id, type, actor_id, payload)
    select s.trip_id, 'stop_joined', new.user_id,
           jsonb_build_object('stop_id', s.id, 'name', s.name)
    from public.stops s where s.id = new.stop_id;
  end if;
  return new;
end;
$$;

create trigger stop_participants_after_insert
  after insert on public.stop_participants
  for each row execute function public.on_stop_joined();

-- --------------------------------------------------------------- reactions

create or replace function public.toggle_reaction(p_event_id bigint, p_emoji text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_event public.trip_events;
  v_ids jsonb;
  v_reactions jsonb;
  v_uid text := auth.uid()::text;
begin
  select * into v_event from public.trip_events where id = p_event_id;
  if not found or not public.is_trip_member(v_event.trip_id) then
    raise exception 'not a member of this trip';
  end if;
  if p_emoji not in ('👍', '❤️', '😂', '🎉') then
    raise exception 'unsupported reaction';
  end if;

  v_ids := coalesce(v_event.reactions -> p_emoji, '[]'::jsonb);
  if v_ids ? v_uid then
    select coalesce(jsonb_agg(x), '[]'::jsonb) into v_ids
    from jsonb_array_elements_text(v_ids) x where x <> v_uid;
  else
    v_ids := v_ids || to_jsonb(v_uid);
  end if;

  if v_ids = '[]'::jsonb then
    v_reactions := v_event.reactions - p_emoji;
  else
    v_reactions := jsonb_set(v_event.reactions, array[p_emoji], v_ids);
  end if;

  update public.trip_events set reactions = v_reactions where id = p_event_id;
  return v_reactions;
end;
$$;

-- ------------------------------------------- realtime changefeed coverage

alter publication supabase_realtime add table public.stops;
alter publication supabase_realtime add table public.stop_votes;
alter publication supabase_realtime add table public.stop_participants;
