-- CI ONLY — never run against a real Supabase project.
-- Vanilla Postgres lacks Supabase's auth schema and roles; this stub provides
-- just enough (auth.users, auth.uid(), the authenticated role) for the real
-- migrations to apply and be validated on every PR.

create schema if not exists auth;

create table if not exists auth.users (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now()
);

create or replace function auth.uid()
returns uuid
language sql
stable
as $$
  select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
$$;

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'authenticated') then
    create role authenticated nologin;
  end if;
end
$$;
