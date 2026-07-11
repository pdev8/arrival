-- B4: private realtime channels + member display names.
--
-- Realtime broadcast channels are named trip:{trip_id}. Marking them private
-- routes authorization through RLS on realtime.messages — only members of
-- the trip can send or receive on its channel.

create policy "trip members receive" on realtime.messages
  for select to authenticated
  using (
    split_part(realtime.topic(), ':', 1) = 'trip'
    and public.is_trip_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

create policy "trip members send" on realtime.messages
  for insert to authenticated
  with check (
    split_part(realtime.topic(), ':', 1) = 'trip'
    and public.is_trip_member(split_part(realtime.topic(), ':', 2)::uuid)
  );

-- M1 identity is anonymous; a display name still travels with create/join so
-- rosters read "Paul" instead of "Someone". The A epic replaces this with
-- real profiles.

create or replace function public.upsert_display_name(p_name text)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'not signed in';
  end if;
  insert into public.profiles (id, display_name)
  values (auth.uid(), left(coalesce(nullif(trim(p_name), ''), 'Someone'), 40))
  on conflict (id) do update set display_name = excluded.display_name;
end;
$$;

-- postgres_changes (roster joins, feed events) requires the tables in the
-- realtime publication; RLS still gates who receives each row.
alter publication supabase_realtime add table public.trip_members;
alter publication supabase_realtime add table public.trip_events;
