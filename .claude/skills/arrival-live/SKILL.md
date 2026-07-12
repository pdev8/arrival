---
name: arrival-live
description: How Arrival's live (Supabase) session layer works — realtime delivery, roster resilience, departure semantics, RLS/trigger rules, and the boundary translation to the sim-shaped UI. Read before touching src/live/, supabase/migrations/, or anything that swaps demo↔live.
---

# Arrival live layer

Hard-won rules from B1–B6 and the two-phone field tests. The demo hid every
one of these bugs; real hardware found them.

## Shape contract

- `useLiveTrip` returns the **same `Simulation` shape** as `useSimulation`, so
  `app/session.tsx` swaps sources with one conditional
  (`params.live === '1' && supabaseConfigured && !!params.tripId`). Never let
  live-only fields leak into components — extend `SimMember`/`Simulation` for
  both, or map at the boundary.
- **Boundary translation (`youify`)**: everywhere the UI sees an id (member
  ids, stop voters, reaction ids, feed actors), YOUR uuid becomes the literal
  `'you'`. The sim-era components key self-checks off that literal. Do this at
  the edge in `live-stops.ts`, never inside components.

## Realtime delivery is layered — no single path is trusted

The host-can't-see-the-joiner bug was one missing subscription. The rule now:
every piece of state has ≥2 delivery paths.

- positions: broadcast on the private `trip:{id}` channel (3 s) **+**
  `trip_members` snapshot upserts (10 s) **+** a 15 s roster poll.
- roster: postgres_changes on `trip_members` with `event: '*'` (INSERT **and**
  UPDATE — INSERT-only was the original bug) **+** the poll.
- unknown-sender recovery: a broadcast from an id we don't know triggers a
  roster reload, then re-applies the position.
- send failures surface **once** via `surfaceError` — silent failure is what
  made the original bug invisible.

**Fresher-wins merge** (`mergeSnapshot` in live-helpers): a snapshot is taken
only when it's all we have or newer than the last applied broadcast
(`lastAt`). Broadcasts always win (`applyBroadcast`). Arrival latches. These
are pure and tested — keep new merge rules there, not in the hook.

## Departure semantics — members never vanish

- Leaving **marks** `left_at` (+ `sharing_enabled: false`); it NEVER deletes
  the row. Migration 0004's `on_member_left` trigger emits the feed event.
- A departed member stays on the map frozen and dimmed at their last known
  position, shows "left" in the rail / "Left — last known position" on the
  card, is excluded from convergence and `allArrived`, and their trail flows
  into the archive.
- Same principle anywhere else state ends: prefer marking to deleting, so the
  last-known truth survives for the map, the feed, and the archive.

## Server rules live in the database

Consistency belongs in SECURITY DEFINER triggers/RPCs, not the client:
creator auto-join + auto-upvote on stop insert, 2-upvote confirm
(proposed → confirmed), feed events on every state change, `toggle_reaction`
(membership-gated, emoji-whitelisted). RLS via `is_trip_member()` is the
security boundary — the anon key is publishable by design.

## Non-negotiables

- **Migrations are append-only and CI-verified**: the `schema` job applies
  every migration to a real Postgres and smokes the RPCs. Bad SQL cannot
  merge. Never edit an applied migration; add a new numbered one.
- **Never `git add -A` blind on a branch**: Finder-duplicate files
  (`useLiveTrip 2.ts`, `0002_… 2.sql`) once got swept in and CI applied a
  migration twice.
- `scripts/verify-backend.mjs` is the live end-to-end proof (20 checks against
  the real project: auth, RPCs, RLS negatives, broadcast round-trip, the whole
  stop→vote→confirm→join flow, reaction toggle, departure). Run it after any
  backend change; extend it when you add server behavior.
- Secrets live in `.env` (gitignored): publishable anon key + a revocable
  `SUPABASE_ACCESS_TOKEN` for the Management API (needs a custom User-Agent;
  Cloudflare blocks python's default).

## Testing

Logic that can't run without a Supabase channel is logic you can't test.
Extract it: `live-helpers.ts` (motion/merge math) and `live-stops.ts` (wire →
UI mappers) are pure and covered. The hook should read as wiring.
