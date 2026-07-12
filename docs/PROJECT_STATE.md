# Arrival project state

Last reconciled: 2026-07-11 at `main` commit `b994e99` (merged PR #19).

This is the shared handoff for Claude, ChatGPT/Codex, and human contributors.
Read it before choosing the next task; update it when a milestone boundary or
major architectural decision changes.

## Product in one paragraph

Arrival is a temporary, session-scoped live map for groups traveling or
meeting up. Members join with one link, share location only for the session's
bounded lifetime, see the group converge, coordinate stops/suggestions, and
hand navigation off to the device's maps app. It is a coordination layer, not
a turn-by-turn navigator or persistent people tracker.

## What works now

### Demo path (polished and self-contained)

- Three scenarios exist in code: NYC walking, Lake Tahoe road trip, and Hudson
  Yards mall meetup. Create currently exposes mall and road trip; NYC is seeded
  as a read-only archive.
- Real/baked street routes, deterministic stoplight waits, scripted stops and
  suggestions, voting, feed reactions, arrival detection, recap sharing, and
  local AsyncStorage archives work without a backend.
- Session UI uses the v2 architecture: group header, member rail, focused
  member card/retrace, activity dock, trails, clustering, destination/stop
  markers, and long-press place actions.
- Vertical-awareness/floor values are simulated for the mall and selected
  route spans.

### Live path (Supabase-configured M1 slice)

- Anonymous sign-in, server-side session creation, server-minted join codes,
  join-by-code, membership cap/lock/expiry checks, and palette assignment.
- Private Supabase Realtime channel per trip (`trip:{uuid}`), authorized by
  `realtime.messages` RLS.
- Foreground GPS publishes every 3 seconds; the user's last-known row is
  snapshotted every 30 seconds. Roster joins and trip events arrive through
  `postgres_changes`.
- Live members adapt into the same `Simulation` interface as the demo, so the
  session screen shares its UI. Straight-line ETA, local trails/steps, and a
  40 m arrival threshold are present as interim behavior.
- The local `.env` has all required Supabase variables set. Never print or
  commit their values.

## Exact handoff point

PR #19 (`B4 — Realtime positions`) is the latest merged work. There are no
open GitHub issues or pull requests. Its PR description names **B6: live
stops/votes/reactions** as the next intended slice.

Live mode currently returns empty stops and placeholder actions that surface
"Live stops & votes arrive with the next backend PR (B6)." The schema already
contains `stops`, `stop_participants`, `stop_votes`, and `trip_events.reactions`.
A sensible B6 implementation should preserve the `Simulation` adapter boundary,
extract new business rules into pure tested helpers, subscribe to the relevant
tables/events, and keep demo behavior unchanged when Supabase is unavailable.

Background/adaptive tracking is also pending (called B5 in existing docs), as
are universal/deferred invite links, real auth/profiles, Places/Routes APIs,
push notifications, offline reconciliation, and store-readiness implementation.
Do not infer the B5/B6 ordering from their labels; PR #19 explicitly chose B6
next.

## Architecture map

- `app/`: Expo Router screens (`index` → `create` → `session`, plus archives).
- `src/demo/`: scenario data, baked routes, deterministic simulation, reactions.
- `src/live/`: live Supabase/GPS adapter shaped like the demo `Simulation`.
- `src/components/`: map annotations and the rail/card/dock session surfaces.
- `src/lib/`: pure geometry, formatting, clustering, trails, recap, archive,
  error, navigation, Supabase, and session helpers.
- `supabase/migrations/`: schema/RLS/RPCs followed by realtime/name support.
- `scripts/verify-backend.mjs`: hosted-backend acceptance checks.
- `scripts/fetch-routes.mjs`: OSRM route regeneration (follow the
  `regen-routes` skill when route inputs change).

The live/demo seam is `Simulation` from `src/demo/simulation.ts`. Keeping that
contract stable lets product UI remain backend-agnostic.

## Non-negotiable implementation rules

- Expo is SDK 54. Read the exact v54 docs before writing code.
- Read `.agents/skills/arrival-ui/SKILL.md` before UI, map, marker, trail, or
  animation changes.
- Trails are native dotted/dashed `Polyline` overlays, never clouds of
  `Marker` views. Dashes must not use `strokeColors`, and each segment keeps at
  least three points.
- Member photo markers stay mounted; clustering hides them with opacity.
  Cluster regrouping remains throttled. Validate marker stability in a dev
  build with New Architecture disabled, not Expo Go alone.
- Member colors identify people; `UI.brand` amber identifies session/group
  state. Non-map screens use `AmbientMap`; translucent panels use `Glass` with
  `systemUltraThinMaterialDark`.
- Camera modes are auto-fit, follow, and free. Panning/retrace must stop follow
  so per-tick camera updates do not fight the user.
- Put new logic in pure helpers and ship tests with every logic change.
- Preserve the Supabase-off demo fallback and session-scoped privacy model.

## Verified baseline

On 2026-07-11:

- `npm test -- --runInBand`: 16 suites, 114 tests passed.
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed with warnings only (existing hook dependency warnings
  and one unused eslint-disable).
- PR #19 reports the hosted backend verifier at 10/10, including a private
  realtime round trip between two anonymous users.

Before product work, run all three local checks again. For backend changes,
also run `node scripts/verify-backend.mjs` when network access and the local
Supabase environment are available.

## Working-tree caution

At this handoff, these untracked items exist and must not be accidentally
committed as product source without review:

- `.agents/` (contains useful local skills; decide deliberately whether to
  commit it).
- `src/live/live-helpers 2.ts`
- `src/live/live-helpers.test 2.ts`
- `src/live/useLiveTrip 2.ts`
- `supabase/migrations/0002_realtime_and_names 2.sql`

The four ` 2` files are byte-for-byte duplicates of their canonical files and
look like Finder/cloud conflict copies. Leave or remove them only deliberately.

## Known documentation/product gaps

- `SPEC.md` section 10 still describes the build as demo-only; code has advanced
  into the M1 live slice. Treat this file plus current code and this handoff as
  the combined truth until the spec is refreshed.
- The create screen comment that says movement waits for B4 is stale; B4 is
  merged.
- Join-by-code is an iOS prompt; Android and universal/deferred link flows are
  pending.
- The header's remaining-time seed comes from route params rather than the live
  trip's authoritative `ends_at`, and it does not itself drive a render timer.
- Live arrival order/archives, stale-member UI, channel lifecycle on server-side
  expiry, leaving/sharing controls, and real profile avatars are incomplete.

## Suggested next task

Implement B6 as a focused backend/UI-adapter slice:

1. Define/test pure row-to-domain and vote/participant/reaction helpers.
2. Load and subscribe to stops, participants, votes, and relevant events for
   the active trip under existing RLS.
3. Implement live announce/suggest/join/vote/react mutations without changing
   demo behavior.
4. Extend the backend verifier for two-member stop/vote/reaction round trips.
5. Validate typecheck, lint, all unit tests, schema CI, and a two-device flow.

Avoid mixing background tracking, universal links, or Places search into that
same change unless the scope is explicitly revised.
