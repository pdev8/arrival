# Arrival project state

Last reconciled: 2026-07-13, `main` at `412d7ae` (PR #43 merged).

This is the shared handoff for Claude, ChatGPT/Codex, and human contributors.
Read it before choosing the next task; update it when a milestone boundary or
major architectural decision changes.

## Product in one paragraph

Arrival is a temporary, session-scoped live map for groups traveling or
meeting up. Members join with one link, share location only for the session's
bounded lifetime, see the group converge, coordinate stops, and hand navigation
off to the device's maps app. It is a coordination layer, not a turn-by-turn
navigator or a persistent people tracker.

## Read these first — they are load-bearing

| File | Why |
|---|---|
| `.claude/skills/arrival-map/SKILL.md` | **The map rendering contract.** Everything inside `<MapView>`. Enforced by `src/map-contract.test.ts` — if that test fails you broke the map, and you must not "fix" the test. |
| `.claude/skills/arrival-live/SKILL.md` | The Supabase/GPS layer: realtime delivery, sensor lies, departure semantics, RLS rules. |
| `.claude/skills/arrival-ui/SKILL.md` | Everything else on screen. |
| `docs/ROADMAP.md` | What's shipped and what's next, per epic. Generated — edit `docs/roadmap.html` and run `node scripts/gen-roadmap.mjs`. |

**Expo is SDK 54.** Read the exact versioned docs
(https://docs.expo.dev/versions/v54.0.0/) before writing code.

## The one thing that will waste your week

**Marker bugs cannot be reproduced or validated in Expo Go.** Expo Go forces the
New Architecture, where react-native-maps #5911 lives (Apple Maps drops custom
marker views on any lifecycle event). Use a dev build with
`newArchEnabled: false`:

```
npx expo run:ios --device      # build
npx expo start --dev-client    # Metro, in the right mode
```

Two known build blockers, both already patched but both recurring after a clean
install: RN 0.81's pinned `fmt` fails on Xcode 26 (`consteval`) → set
`FMT_USE_CONSTEVAL 0` in `ios/Pods/fmt/include/fmt/base.h`; and `expo-font` must
be a **direct** dependency (autolinking only links declared deps — Expo Go hides
this).

## What works now

### Demo path (polished, self-contained, no backend)

- Three scenarios: NYC walking (the showcase, with real photos — reachable from
  the home screen), Lake Tahoe road trip, Hudson Yards mall meetup.
- Baked OSRM street routes, deterministic stoplight waits, scripted stops and
  suggestions, voting, feed reactions, arrival detection, recap sharing, local
  AsyncStorage archives.
- `demo/sensor.ts` synthesizes **noisy GPS** (speed jitter, `-1` course
  dropouts, junk fixes) and runs it through the same motion gate live does — so
  direction behaviour is testable on your desk. Positions are still rendered
  clean; position smoothing is unsolved and out of scope.

### Live path (Supabase)

- Anonymous sign-in, server-minted join codes, join-by-code, membership
  cap/lock/expiry, palette assignment.
- Private Realtime channel per trip (`trip:{uuid}`), authorized by
  `realtime.messages` RLS. Positions broadcast every 3 s; `trip_members`
  snapshot every 10 s; 15 s roster poll. **No single delivery path is trusted** —
  see the live skill.
- Free roam (a session with no destination), a destination any member can set
  mid-session, and leave-not-end (leaving marks *your* `left_at`; the session
  runs on and you can rejoin).
- Live members adapt into the same `Simulation` shape as the demo, so the session
  screen is backend-agnostic. Straight-line ETA, client-side trails/steps, 40 m
  arrival threshold are interim.
- `.env` holds the Supabase vars. Never print or commit them.

## Exact handoff point

**Branch `feat/direction-earned` is checked out with uncommitted changes,
awaiting Paul's device test.** It makes direction honest: `heading` becomes
`number | null`, a motion gate (`src/lib/motion.ts`) decides whether a course has
been *earned*, and the puck shows moving / paused / still. See roadmap **H3**.

Two open items from the last merge:

1. **Migration `0005_free_roam.sql` is NOT applied to the live project.** Demo
   mode works without it; a live session cannot set a destination until it is.
   Needs Paul's explicit go.
2. PR #43 (free roam / destination search / leave) was **merged untested**, at
   Paul's call. PR #41 (stop-pin pool) likewise.

Next planned slices, in order: **C8** (a meet time, so ETAs become early/late)
then **C9** (secondary locations — personal stops that explain your ETA). Both
are designed; see the roadmap.

## Architecture map

- `app/`: Expo Router screens (`index` → `session`, plus archives).
- `src/demo/`: scenario data, baked routes, deterministic simulation, and
  `sensor.ts` — the demo's stand-in for a GPS receiver.
- `src/live/`: Supabase/GPS adapter shaped like the demo `Simulation`.
- `src/components/`: map annotations and the rail/card/dock session surfaces.
- `src/lib/`: pure logic — geometry, **motion** (the direction gate), formatting,
  trails, places, convergence, roster, recap, archive, nav, Supabase.
- `supabase/migrations/`: schema/RLS/RPCs. Append-only; CI applies every one to a
  real Postgres.
- `scripts/verify-backend.mjs`: hosted-backend acceptance checks (20).
- `scripts/gen-roadmap.mjs`: regenerates `docs/ROADMAP.md` from `roadmap.html`.
- `scripts/fetch-routes.mjs`: OSRM route regeneration (follow the `regen-routes`
  skill when route inputs change).

The live/demo seam is `Simulation` in `src/demo/simulation.ts`. Keeping that
contract stable is what lets product UI stay backend-agnostic.

## Non-negotiable implementation rules

- **The map contract is enforced, not advisory** — `src/map-contract.test.ts`.
- **There is no clustering.** It was removed: mounting/unmounting members as
  facepiles re-formed is what dropped pucks. Don't bring it back.
- Trails are `Polyline` overlays, never clouds of `Marker`s. Visibility is driven
  by `coordinates`, never `strokeColor` (a colour change doesn't redraw).
- Direction means **course over ground**, never the compass. Never call
  `watchHeadingAsync`.
- Member colors identify people; `UI.brand` amber identifies session/group state.
  Non-map screens use `AmbientMap`; translucent panels use `Glass`.
- Put new logic in pure helpers and ship tests with every logic change.
- Preserve the Supabase-off demo fallback and the session-scoped privacy model.
- Migrations are append-only. Never edit an applied one.

## Verified baseline

On 2026-07-13, on `feat/direction-earned`:

- `npx jest`: **24 suites, 291 tests passed.**
- `npx tsc --noEmit`: passed.
- `npm run lint`: passed (2 pre-existing hook-dependency warnings, both
  deliberate).

Run all three before any product work. For backend changes also run
`node scripts/verify-backend.mjs`.

## Working-tree caution

Four Finder/cloud conflict duplicates are untracked and must never be committed
(CI once applied a migration twice because of one):

```
src/live/live-helpers 2.ts       src/live/useLiveTrip 2.ts
src/live/live-helpers.test 2.ts  supabase/migrations/0002_realtime_and_names 2.sql
```

**Never `git add -A` blind on a branch.**

## Known gaps

- `SPEC.md` §10 still describes the build as demo-only. Treat this file plus the
  skills plus current code as the combined truth until the spec is refreshed.
- Invite links are an iOS prompt; universal/deferred links are pending (**B3**).
- Real auth and profile photos are pending (**A epic**); live members have no
  avatar, only a colour initial.
- ETAs are straight-line, not routed (**C6**).
- Background tracking is not implemented (**B5**) — position updates stop when
  the app is backgrounded.
- Position smoothing is unsolved: a real puck will jitter with its GPS fix. Only
  *direction* has been made honest so far.
