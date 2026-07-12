# Backend setup (Supabase, M1)

The schema, RLS, and RPCs live in `supabase/migrations/` and are applied to
plain Postgres on every PR by the `schema` CI job — the SQL is always known-
good. To stand up the real thing:

## One-time setup (you)

1. **Create the project**: supabase.com → New project (free tier). Pick a
   region near your testers.
2. **Apply the migrations in order**: Dashboard → SQL Editor → run every file
   in `supabase/migrations/` by filename (`0001`, then `0002`, and so on).
   (Or with the CLI: `supabase link --project-ref <ref>` then `supabase db push`.)
3. **Enable anonymous sign-ins**: Dashboard → Authentication → Providers →
   Anonymous → enable. (M1 identity; Apple/Google upgrade in the A epic.)
4. **Schedule expiry**: Dashboard → Database → Extensions → enable `pg_cron`,
   then in SQL Editor:
   ```sql
   select cron.schedule('complete-expired-trips', '* * * * *',
                        $$select public.complete_expired_trips()$$);
   ```
5. **Wire the app**: create `.env` in the repo root (gitignored):
   ```
   EXPO_PUBLIC_SUPABASE_URL=https://<ref>.supabase.co
   EXPO_PUBLIC_SUPABASE_ANON_KEY=<anon key>
   ```
   For builds: `eas secret:create` for both (same names). The anon key is
   publishable — RLS is the security boundary.

Until those env vars exist, `supabaseConfigured` is false and the app runs
the demo simulation untouched.

## What the schema enforces server-side

- **Membership is the boundary**: every table's RLS routes through
  `is_trip_member()`; non-members can't see a trip exists.
- **Joining only via `join_trip(code)`**: active + unlocked + under the
  12-member cap, color assigned from the SPEC palette, idempotent.
- **Creating via `create_trip(...)`**: join code minted server-side
  (3×3 lowercase letters, ~44 bits).
- **Positions**: you can update only your own `trip_members` row; last-known
  snapshot only — no history table (privacy, SPEC §5.2).
- **Expiry**: `complete_expired_trips()` flips overdue sessions; clients
  hard-stop tracking on the status change (SPEC §5.6).

## Current implementation state

- **B2 complete**: session create/join is wired to the RPCs behind
  `supabaseConfigured`.
- **B4 complete**: private `trip:{id}` realtime broadcast carries foreground
  positions every 3 seconds; roster/events use `postgres_changes`; the client
  persists a last-known snapshot every 30 seconds.
- **Next intended slice: B6**: live stops, votes, participants, and reactions.
- **Still pending: B5** background/adaptive location tracking (dev build +
  physical-device validation required).

See `docs/PROJECT_STATE.md` for the complete handoff.
