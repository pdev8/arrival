-- Members never vanish: leaving marks the row instead of deleting it, so
-- the last-known position survives for the map, the feed, and the archive.

alter table public.trip_members add column left_at timestamptz;

create or replace function public.on_member_left()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.left_at is not null and old.left_at is null then
    insert into public.trip_events (trip_id, type, actor_id)
    values (new.trip_id, 'member_left', new.user_id);
  end if;
  return new;
end;
$$;

create trigger trip_members_after_leave
  after update on public.trip_members
  for each row execute function public.on_member_left();
