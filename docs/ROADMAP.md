# Arrival — Launch Roadmap

**Source of truth: the live roadmap artifact** (see `reference-roadmap-artifact`
in project memory / ask Claude to reopen it). This file is its committed mirror —
regenerate it from the artifact when statuses change; don't hand-edit both.

Tasks are numbered by epic prefix (D1, V3, B4…) and ordered **low → high
priority: the bottom of this file ships first.** Every task is scoped as one PR.

> **The gate:** do not submit to the App Store before the live backend ships —
> a simulation-only build is a guideline 4.2 (minimal functionality) rejection.
> See `docs/REVIEW_NOTES.md`.

## D — Delight & depth (P3)

The layer that makes Arrival feel loved rather than shipped. None of it blocks launch; all of it builds retention. Pick these up between heavier PRs.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **D1** | `feat/footprints-v2` | Pre-rendered shoe-print PNGs (per member color, both feet) as Marker image props — no live glyph views. *⏸ Blocked on YOUR device soak test (roadmap T2) — old-arch dev build must prove stable first* | M | Blocked |
| **D2** | `feat/recap-share-card` | Branded card (mark, session, earned stats, crew facepile) captured via view-shot; share from live recap or any archived session. *✦ Shipped — PR #12 merged (iOS shares the PNG; Android text fallback until expo-sharing)* | M | **Shipped** (PR #12) |
| **D3** | `feat/feed-reactions` | Long-press a timeline row to react (👍❤️😂🎉); chips stack on the row, first arriver auto-celebrates later arrivals. *✦ Shipped — PR #13 merged (demo-local; Realtime replication rides the B-epic backend)* | M | **Shipped** (PR #13) |
| **D4** | `feat/live-activity` | Glanceable convoy status (ETAs, active stop) while the user navigates in another app. Config-plugin + widget extension. *⏸ Needs a dev-client/Xcode session — native widget extension can't ship from CI alone (eas.json is ready)* | L | Blocked |
| **D5** | `feat/leader-mode` | Owner pins an ordered set of waypoints pre-trip; members see the shared itinerary and "follow the leader" camera. | L | Open |

## V — Vertical Truth — own the z-axis (P2)

Every competitor’s map is 2D and lies indoors, underground, and on mountains. No mainstream tracker answers "which floor?" — this is Arrival’s wedge. The demo badge UI shipped in PR #3; these wire the real sensors.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **V1** | `feat/mall-scenario` | Hudson Yards food-court convergence from four floors, live level chips, scenario-integrity tests. *✦ Shipped — PR #7 merged* | M | **Shipped** (PR #7) |
| **V2** | `feat/baro-floor-engine` | Pressure on every position packet (CMAltimeter / TYPE_PRESSURE); cross-device bias calibration when members are co-located; per-member floor delta. Ships first — powers everything below. | M | Open |
| **V3** | `feat/floor-badge-live` | CLLocation.floor in venue-mapped buildings with floor-delta fallback; confidence-gated; desaturate pucks not on your floor. *✦ Demo badge UI merged (PR #3) + mall demo merged (PR #7); this task wires the real sensors — needs feat/baro-floor-engine* | S | In progress |
| **V4** | `feat/underground-state` | Fused detector (GPS accuracy collapse + baro descent + transit/parking POI proximity) pins the puck at last good fix: "entered P2 Garage, 3:41". Resurface event on fix recovery. | M | Open |
| **V5** | `feat/altitude-gated-arrivals` | Arrival confirmation requires horizontal geofence AND vertical agreement — kills the overpass / parking-deck false "arrived". | S | Open |
| **V6** | `feat/parked-car-pin` | Auto-drop a pin on the driving→walking activity transition; level from baro delta since garage entry; new parked_car stop kind with nav deep-link. | M | Open |
| **V7** | `feat/hike-mode` | Fused GPS+baro altitude per trail vertex: gain/loss stats, climb/descend badges, Tobler-adjusted ETAs, recap elevation profile, "400 ft above you" on member cards. | M | Open |

## G — Guardian Loop — kids & care (P2)

Converts a group toy into something a parent relies on. Detection runs on the kid’s device via OS primitives (geofences, activity recognition), not on a parent staring at a dot.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **G1** | `feat/battery-telemetry` | Battery % on position packets and rail chips; pushes at 20/10%; at 5% a durable last-known snapshot (position, floor, heading, activity). Dark pucks carry reason codes: died / underground / unshared / no signal. | S | Open |
| **G2** | `feat/watch-zones` | Parent-drawn zone syncs to the kid’s device; OS geofencing (CLCircularRegion / GeofencingClient) fires exit/enter while backgrounded; push to parent, local notice to kid. | S | Open |
| **G3** | `feat/smart-checkin` | Parent ping → time-sensitive push with lock-screen "I’m OK" action; auto-trigger on odd dwell (stopped >N min at a non-place); 2-min no-ack escalates to max-rate sampling + status panel. | M | Open |
| **G4** | `feat/unexpected-ride-alert` | Activity recognition detects a kid member entering a vehicle with no adult member co-moving within 30 m → high-priority push with the transition point pinned. Adult/kid roles on membership; expected-ride windows to mute it. *Only possible because sessions are group-scoped — single-user trackers can’t do this* | M | Open |
| **G5** | `feat/kid-sos` | Long-press-armed SOS + lock-screen widget: max sampling, DND-bypassing push to all adults, parent auto-follow mode, reassurance screen on the kid’s device; persists until a parent clears it. | S | Open |
| **G6** | `feat/pickup-choreography` | Promote any stop to a pickup point: kid-side geofence entry/exit events, "leave now" nudge timed to the kid’s walking ETA vs parent driving ETA, auto "reunited" on mutual geofence entry. | S | Open |
| **G7** | `feat/security-handoff-card` | Lost-kid moment: one-tap shareable image — photo, "wearing" note, last position + floor + heading + battery/underground context — via the OS share sheet; auto-arms SOS follow mode. | M | Open |

## C — Richer coordination (P2)

The features that make the map useful beyond watching dots move — finding places, getting told when things happen, and trusting ETAs.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **C1** | `feat/session-archive` | Auto-archive on completion; Home list; read-only decluttered map with all traces; NYC walk pre-seeded. *✦ Shipped — PR #8 merged* | M | **Shipped** (PR #8) |
| **C2** | `feat/place-search` | Google Places autocomplete behind a Supabase edge proxy (key never ships in the app); POI tap → place sheet. *Needs supabase-setup (P1)* | M | Open |
| **C3** | `feat/nav-deeplinks` | lib/nav-deeplinks.ts URL builders; Navigate action on destination, stops, and suggestions. *✦ Shipped — PR #2 merged (Navigate pill on stop cards + tappable destination)* | S | **Shipped** (PR #2) |
| **C4** | `feat/push-notifications` | expo-notifications + Expo Push: stop posted, suggestion confirmed, member arrived, session ending in 15 min. *Needs realtime backend (P1)* | M | Open |
| **C5** | `feat/arrival-geofences` | expo-location geofences on destination + confirmed stops; entering posts the feed event and flips member state. | M | Open |
| **C6** | `feat/eta-service` | Edge cron recomputes each moving member’s ETA every ~2 min with traffic; straight-line fallback offline. *Needs supabase-setup (P1)* | M | Open |
| **C7** | `feat/stale-members` | "Last seen 4m ago" badge past freshness thresholds; never silently drop a member from the map. | S | Open |

## A — Accounts & identity (P2)

Real people need real identities before strangers share their location: sign-in, profiles, and the trust furniture around them.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **A1** | `feat/auth` | Supabase Auth; Apple sign-in is an App Store requirement when offering third-party login. *Needs supabase-setup (P1)* | M | Open |
| **A2** | `feat/profiles` | Display name, photo upload to Supabase Storage with resize; avatar falls back to color initial. | M | Open |
| **A3** | `feat/session-history` | Past sessions on the home screen (name, date, members, your steps) reading from Postgres. | S | Open |
| **A4** | `feat/account-deletion` | Settings → delete account: removes auth user, memberships, profile media. Apple requires this for any app with accounts. | S | Open |

## H — Honest Map — trust when GPS fails (P1)

A live map people rely on in exactly the moments GPS quits: honest uncertainty during dropouts, and phone-to-phone convergence for the last hundred feet.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **H1** | `feat/backfill-staleness` | Ring buffer of samples during connectivity outages; batch upsert + trail splice on reconnect. Puck grows an uncertainty ring with age × last speed instead of sitting confidently wrong. *Prerequisite for underground/mountain trust; pairs with feat/underground-state* | S | Open |
| **H2** | `feat/last-100ft-finder` | Mutual "Find mode": session-scoped BLE advertise/scan → RSSI hot/cold proximity meter with baro floor hint; UWB tier (NISession / androidx.core.uwb) gives a distance + bearing arrow on capable phones. | L | Open |

## B — Live backend (M1) — sim becomes real (P1)

The core promise: two phones see each other move. Everything in this epic replaces the simulation with Supabase while keeping the UI you already have.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **B1** | `infra/supabase-setup` | SPEC §5.2 schema + RLS + join/create RPCs; CI applies migrations to real Postgres and smokes the RPCs on every PR. *✦ Shipped — PR #16 merged. YOUR turn: run the migration in the dashboard SQL editor, enable anonymous sign-ins, paste the project URL (docs/BACKEND.md)* | M | **Shipped** (PR #16) |
| **B2** | `feat/session-crud` | Create mints a server-side join code via create_trip; Home joins by code via join_trip; demo fallback behind the config gate; verify-backend script proves the whole flow + RLS. *✦ Shipped — PR #17 merged. Gate: your 2 dashboard clicks (migration SQL + anonymous sign-ins), then run node scripts/verify-backend.mjs* | M | **Shipped** (PR #17) |
| **B3** | `feat/invite-links` | Join codes, arrival.app universal links, join/[code] preview screen, 12-member cap, owner lock + regenerate (F1a). *feat/session-crud* | L | Open |
| **B4** | `feat/realtime-positions` | Private trip:{id} broadcast channel (RLS-authorized), GPS publish @3s + 30s snapshots, roster/feed via postgres_changes, live trails/ETAs/steps; verify-backend proves a 2-user realtime round-trip (10/10). *✦ Shipped — PR #19 merged. YOUR acceptance test: two phones, one link, walk around* | L | **Shipped** (PR #19) |
| **B5** | `feat/background-tracking` | expo-task-manager background updates; speed-adaptive sampling and the stationary low-power downshift (§5.4). *feat/realtime-positions, needs dev client* | L | Open |
| **B6** | `feat/stops-live` | Replace sim stop/vote/join mutations with Postgres writes + postgres_changes subscriptions. *infra/supabase-setup* | M | Open |

## S — App Store readiness (P0)

Location apps get extra review scrutiny. This epic is everything Apple and Google will actually check — none of it is optional, and half of it has lead time. Start the review-sensitive items early.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **S1** | `infra/eas-builds` | Build profiles (dev/preview/prod), dev client with newArchEnabled:false, TestFlight internal + Play internal testing tracks. *✦ eas.json profiles merged (PR #11); credentials + first builds need your Apple/Google accounts* | M | In progress |
| **S2** | `feat/permissions-disclosure` | Pre-permission explainer screen (why background location, session-scoped), NSLocation* strings, Play prominent-disclosure flow + declaration video (§7). | M | Open |
| **S3** | `legal/privacy` | Hosted privacy policy, App Privacy questionnaire (precise location, identifiers), Play Data Safety form; document last-known-only position retention. *✦ Draft policy merged (PR #11, docs/PRIVACY.md — needs legal review + hosting); labels/forms remain* | M | In progress |
| **S4** | `store/assets` | Screenshots (6.7" + 6.1" + iPad if supportsTablet stays true), preview video of the live map, descriptions, keywords. | M | Open |
| **S5** | `store/review-notes` | Reviewer-facing notes explaining session-scoped tracking, solo demo path, rejection playbook — docs/REVIEW_NOTES.md. *✦ Shipped — PR #11 merged* | S | **Shipped** (PR #11) |
| **S6** | `infra/crash-telemetry` | Sentry (expo plugin) with source maps via EAS; release health dashboard before public TestFlight. | S | Open |

## T — Stability & correctness — ships first (P0)

You said it yourself: it needs to work flawlessly. This epic locks in the marker-stability work, puts tests around the map, and makes regressions impossible to miss. Highest priority on the page.

| # | Slice | What | Size | Status |
|---|---|---|---|---|
| **T1** | `test/unit-foundation` | jest-expo; logic extracted to lib/ modules (format, trail, clusters, convergence, lights, archive); 84 tests. *✦ Shipped — PR #6 merged (convention: every logic PR ships tests)* | M | **Shipped** (PR #6) |
| **T2** | `fix/marker-stability-validation` | Dev build (old arch) soak test: 15 min of trails-on zoom churn across both scenarios; document results; decide if PROVIDER_GOOGLE fallback flag is needed. *Watch react-native-maps #5911 / PR #5938 for the real fix* | S | Open |
| **T3** | `perf/render-pass` | Markers/rail chips/ring dots/feed rows/stop cards memoized on exactly what they draw; tick 250ms → 1s once everyone arrives. *✦ Shipped — PR #10 merged (on-device FPS profiling still worth a pass with your soak test)* | M | **Shipped** (PR #10) |
| **T4** | `test/e2e-smoke` | Flows: create session → trails toggle → select member → retrace → recap; runs on simulator in CI. | M | Open |
| **T5** | `infra/ci` | GitHub Actions: tsc --noEmit, eslint (flat config), jest — one job on every PR and main push. *✦ Shipped — PRs #4 + #9 merged (E2E lane lives in test/e2e-smoke)* | S | **Shipped** (PRs #4 + #9) |
| **T6** | `fix/error-boundaries` | Screen-level boundaries with recovery UI; defined empty/loading states for every surface before real network data arrives. *✦ Root boundary + recovery screen merged (PR #5); designed empty states remain* | S | In progress |

---

## Acceptance criteria

Each task's acceptance criteria live in the artifact (expand the task) and in
the PR that shipped it; the PR is the record for shipped slices.
