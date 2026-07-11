# Arrival — Road Trip Convoy Coordination

**Version:** 0.1 (Draft)
**Date:** 2026-07-11
**Platform:** iOS + Android via React Native / Expo

---

## 1. Problem Statement

Groups of friends often road-trip to the same destination in separate vehicles. Coordinating along the way is painful: group texts like "we're stopping at the next Buc-ee's" get buried, nobody knows where anyone else actually is, and impromptu stops (gas, food, bathroom) fragment the convoy.

**Arrival** is a shared live map for a **session**. Everyone who joins sees each other's real-time position — a color-coded avatar with a heading arrow showing which direction they're moving — can propose stops ("let's meet at this gas station"), and can broadcast their own stops ("stopping here for 15 min — food").

The same mechanic covers two situations:
- **Road trip** — separate vehicles heading to a shared destination; the destination anchors the session and everyone gets an ETA to it.
- **Hangout** — the group has split up in a city (festival, downtown, campus, theme park) and just wants to keep track of each other; no destination required.

Tracking is **position-based and session-scoped**: as long as you've joined an active session with sharing on, your position streams to the group — walking, driving, or stopped — and ends the moment you leave the session or it completes.

## 2. Target User & Core Scenario

- 2–12 members traveling separately to a shared destination (concert, campsite, beach house, tailgate), **or** a group of friends split up on foot in a city.
- Session duration: 1–12 hours.
- Users keep their preferred navigation app (Google Maps, Waze, Apple Maps) for turn-by-turn. Arrival is the *coordination layer*, not the navigator.

### Golden path
1. Sarah creates a trip "Lake Tahoe Weekend" with destination set via place search.
2. She shares an invite link; 3 friends join from their phones.
3. Everyone enables location sharing for the trip. The map shows 4 avatars moving along their routes with ETAs to the destination.
4. Mike is low on gas. He long-presses a gas station on the map (or taps a POI) and posts a **Stop**: "Stopping here for gas, ~10 min."
5. Sarah sees the stop card, taps **"I'll stop too"**. The stop shows who's in.
6. Jess proposes lunch: she selects a diner and posts a **Suggestion**. Others vote 👍/👎. It's promoted to a confirmed stop when the group agrees.
7. Everyone can deep-link any stop or the destination into their nav app in one tap.

## 3. Feature Scope

### 3.1 MVP (v1)

| # | Feature | Description |
|---|---------|-------------|
| F1 | **Sessions** | Create/join/leave a session. Two kinds: **road trip** (has a destination set via place search) and **hangout** (no destination — just mutual tracking). Name, optional start time, members, and a **session length** (preset 2h/4h/8h/12h/24h or custom; road trips default to ETA + buffer). Sessions auto-complete at expiry — see §5.6. |
| F1a | **Meet-style invite links** | Creating a session immediately mints a shareable link + short code (`arrival.app/j/kfx-mqvp-dhz`), Google Meet-style. The creator shares it via the OS share sheet; anyone opening it lands in the session (deep link if the app is installed, store + deferred deep link if not, so they still land in the right session after install). Link is live for the session's lifetime; the owner can regenerate (invalidating the old one) or lock the session once everyone's in. |
| F2 | **Live member map** | Full-screen map showing each member's live position as a **color-coded avatar marker with a heading arrow** indicating direction of movement, plus movement state (driving 🚗 / walking 🚶 / stopped ⏸, derived from speed). Each member is assigned a distinct color on join, used consistently everywhere they appear (marker, feed, member list, stop cards). Auto-fit camera to show all members (+ destination if set); tap an avatar to focus/follow. |
| F3 | **ETA per member** | Road-trip sessions only: each member's ETA and distance to the destination, computed via a routing API, shown on their marker callout and in the member list. Hangout sessions instead show distance between members ("Jess · 0.4 mi away"). |
| F4 | **Place selection** | Tap a POI on the map or long-press anywhere to select a location; search for places by name (autocomplete). Selection opens a place sheet with actions. |
| F5 | **Suggestions** | From the place sheet: "Suggest this stop" with optional note and category (gas ⛽, food 🍔, restroom 🚻, scenic 📸, other 📍). Members vote 👍/👎. Suggestions appear as distinct pins + cards in the trip feed. |
| F6 | **Stop announcements** | "I'm stopping here" — broadcasts a stop with category, optional note, and optional duration ("~15 min"). Member's marker switches to stopped state at that pin. Others can tap **"I'll stop too"** to join. Stops auto-clear when the member drives off or the timer lapses. |
| F7 | **Trip feed / activity sheet** | Bottom sheet listing chronological trip events: joins, suggestions, votes, stops, "X is 10 min out" arrival alerts. This doubles as lightweight chat-free coordination. |
| F8 | **Deep-link to nav** | Any pin (destination, stop, suggestion) has "Navigate" → opens Google Maps / Waze / Apple Maps with that lat/lng. |
| F9 | **Arrival detection** | Geofence around destination and confirmed stops; when a member enters, the feed posts "Sarah arrived at Lake Tahoe 🎉" and their status updates. |
| F10 | **Auth & profiles** | Lightweight auth (Apple / Google sign-in + email fallback). Profile = display name, avatar (photo or color/emoji). |
| F11 | **Position-based, session-scoped tracking** | Sharing runs while (and only while) the user has **joined an active session** with sharing on — no nav-app detection needed, identical behavior on iOS and Android. The tracker is adaptive (§5.4): it samples position and derives movement state (driving/walking/stopped) from speed, dialing frequency up when moving and down to low-power mode when stationary. Tracking ends immediately on leaving the session, toggling sharing off, or session completion. |

### 3.2 Explicitly out of scope for v1
- Turn-by-turn navigation or route rendering of *other members'* planned routes (we show positions + ETAs, not their route lines).
- In-app chat (the feed + stop notes cover coordination; chat is a v2 candidate).
- Friend graph / contacts sync (invite links only).
- Trip history/memories, photos, expense splitting.
- Android floating overlay & iOS Live Activities (v1.1 — see §9).
- Web client.

### 3.3 v1.1 / v2 candidates (design for, don't build)
- **iOS Live Activity / Dynamic Island**: glanceable convoy status (members' ETAs, active stops) while user navigates in another app.
- **Android overlay bubble** (`SYSTEM_ALERT_WINDOW`): floating convoy widget over Google Maps/Waze. *Note: requires a dev-client/native module; not Expo Go compatible — plan config plugin.*
- Waypoint planning before the trip (shared itinerary).
- In-app chat / voice notes.
- "Leader mode": follow one car's route.

## 4. UX Structure

```
┌─────────────────────────────────────┐
│  Trip switcher ▾        [avatar]    │  ← header
│ ┌─────────────────────────────────┐ │
│ │                                 │ │
│ │            MAP                  │ │  ← member avatars, destination flag,
│ │   🚗Mike   🚗Sarah              │ │     stop pins (⛽🍔), suggestion pins (❓)
│ │        ⛽(stop)                 │ │
│ │              🏁 Destination     │ │
│ │                                 │ │
│ │            [⊕ recenter] [🔍]    │ │
│ ├─────────────────────────────────┤ │
│ │ ═══ drag handle ═══             │ │  ← bottom sheet (3 detents)
│ │ Mike · 2:41 ETA · stopping ⛽   │ │     collapsed: member strip
│ │ Sarah · 2:12 ETA · driving      │ │     mid: member list + active stops
│ │ ──────────────────────────────  │ │     full: trip feed
│ │ 🍔 Jess suggested "In-N-Out"    │ │
│ │    👍 2  👎 0   [Navigate][Vote]│ │
│ └─────────────────────────────────┘ │
└─────────────────────────────────────┘
```

**Map camera — top-down view**

The default and primary presentation is a **flat, top-down (bird's-eye) map** — zero pitch/tilt, no 3D buildings, north-up by default. Opening a running session drops you straight onto this view with the camera auto-fit to every member (+ destination if set); it's the whole-group situational picture, not a first-person driving view.

- Camera auto-fits to the bounding box of all members + destination, re-fitting gently as people move (debounced so the map doesn't constantly swim).
- Any manual pan/zoom pauses auto-fit; the **recenter** button restores it.
- Tapping a member enters follow mode on them (still top-down); tapping elsewhere exits back to group fit.
- Heading is conveyed by each marker's rotating arrow — the map itself stays north-up so members' relative positions stay stable and comparable. (A compass/rotate-with-me mode is a settings toggle, off by default.)

**Screens**
1. **Onboarding/Auth** — sign in, set name + avatar, location permission education screen (critical: explain *why* background location, per-store-policy).
2. **Trip list** — active + past trips, create trip, join via link/code.
3. **Create session** — kind (road trip / hangout), name, destination search (road trip only), session length picker, then straight to the share sheet with the freshly minted invite link — the Meet flow: create → share → others trickle in.
4. **Trip map** (home, above) — map + bottom sheet.
5. **Place sheet** — appears on POI tap / long-press / search result: place name, address, distance-from-me, actions: *Suggest stop* / *I'm stopping here* / *Navigate*.
6. **Settings** — location sharing toggle per trip, precision (exact vs. approximate), battery saver mode, leave trip.

**Key interactions**
- Long-press map → drop pin → place sheet (reverse geocoded).
- Tap POI label → place sheet.
- Tap member avatar → follow mode + their card (ETA, speed, last update, active stop).
- Stop/suggestion pins are visually distinct from member markers (category emoji in colored pin vs. photo avatar in circle).

## 5. Technical Architecture

### 5.1 Stack

| Layer | Choice | Rationale |
|-------|--------|-----------|
| App framework | **Expo SDK (latest) + TypeScript**, `expo-router` | Cross-platform, file-based routing, OTA updates via EAS Update. Use a **custom dev client** from day one (maps + background location need native modules). |
| Maps | **`react-native-maps`** (Google provider on Android, Apple Maps on iOS) | Free at our scale, native feel per platform. *Alt: Mapbox (`@rnmapbox/maps`) if we want custom styling + one look across platforms — decision point D1.* |
| Location | `expo-location` (foreground + background tasks) + `expo-task-manager` | Background updates while trip is active; geofencing for arrival detection. |
| Backend | **Supabase** (Postgres + PostGIS, Realtime, Auth, Edge Functions, Storage) | Auth, relational trip data, and realtime pub/sub in one service; PostGIS for geo queries. Fastest path to MVP. |
| Realtime positions | Supabase **Realtime Broadcast** channels (ephemeral, per-trip) + periodic persistence to Postgres | Broadcast avoids hammering the DB with every 5-sec ping; persist snapshots every ~30–60s for reconnect/late-join hydration. |
| Places search/autocomplete + POIs | **Google Places API** (via edge function proxy to protect key) | Best POI coverage for gas/food. |
| Routing/ETA | **Google Routes API** (edge function, cached) | ETAs with traffic. Compute server-side per member every ~2 min or on significant deviation, not per position ping. |
| Push notifications | Expo Push (via `expo-notifications`) | Stop posted, suggestion posted, vote resolved, member arrived. |
| Builds/CI | EAS Build + EAS Update | |

### 5.2 Data model (Postgres)

```
users        id, display_name, avatar_url, created_at
trips        id, name, kind (roadtrip|hangout), join_code (unique, rotatable),
             join_locked bool,
             destination_place_id, destination_name,          -- nullable;
             destination_lat, destination_lng,                -- required iff roadtrip
             status (planning|active|completed), starts_at,
             duration_min, ends_at,                           -- session length (§5.6)
             created_by, created_at
trip_members trip_id, user_id, role (owner|member), color,   -- palette color, assigned on join
             sharing_enabled bool, last_lat, last_lng, last_heading,
             last_speed, last_updated_at, eta_seconds, distance_meters,
             state (idle|driving|walking|stopped|arrived), joined_at
             PK (trip_id, user_id)
stops        id, trip_id, created_by, kind (suggestion|announcement),
             status (proposed|confirmed|active|done|cancelled),
             category (gas|food|restroom|scenic|other),
             place_id, name, lat, lng, note, duration_min,
             created_at, resolved_at
stop_participants  stop_id, user_id, joined_at        -- "I'll stop too"
stop_votes         stop_id, user_id, vote (+1|-1)     -- suggestions only
trip_events  id, trip_id, type (member_joined|stop_posted|suggestion_posted|
             vote_cast|member_arrived|member_departed_stop|...),
             actor_id, payload jsonb, created_at       -- powers the feed
```

Row-level security: all trip data readable/writable only by members of that trip. Positions are the most sensitive data — RLS on `trip_members`, and no position history table in v1 (only last-known snapshot).

### 5.3 Location pipeline

The location watcher below runs **only while the user is in an active session with sharing on**, at the speed-adaptive rates defined in §5.4.

```
[Device]
  expo-location watcher
    foreground: every 5s or 25m distance
    background: every 15–30s (task manager), batched
        │
        ▼
  throttle/dedupe → Supabase Realtime broadcast (channel: trip:{id})
        │                       │
        │                       └──▶ other members' apps → animate markers
        ▼
  every 30–60s: upsert trip_members.last_* (snapshot for late joiners)

[Edge function cron ~2 min per active trip]
  → Google Routes API per moving member → update eta_seconds
  → broadcast eta_update

[Geofences] destination + confirmed stops (client-side expo-location geofencing)
  → on enter: POST /arrivals → trip_event + push to trip
```

**State derivation** (thresholds per §5.4): `driving` > ~6 m/s, `walking` ~0.5–6 m/s, `stopped` < ~0.5 m/s for > 3 min (or explicit stop announcement); `arrived` on destination geofence enter; auto-clear an announced stop when the member is `driving`/`walking` away for > 1 min afterward.

**Battery/privacy guardrails**
- Location sharing is **per-trip and only while trip status = active**; hard stop when trip completes or user toggles off.
- Background updates degrade gracefully: significant-change mode when battery < 20% or user enables battery saver.
- Both stores require prominent disclosure for background location — onboarding screen + App Store/Play declarations are a launch checklist item, not an afterthought.

### 5.4 Position-based tracking lifecycle (F11)

**Principle:** membership in an active session *is* the tracking consent and the tracking trigger. No nav-app detection, no activity-recognition gating — position itself drives everything. Identical behavior on iOS and Android.

```
        join session / sharing on
                 │
                 ▼
        ┌──── TRACKING ────────────────────────────────┐
        │                                              │
        │  MOVING (speed-adaptive sampling)            │
        │   driving  (> ~6 m/s):  every 5s / 25m       │
        │   walking  (~0.5–6 m/s): every 10s / 15m     │
        │        ▲                    │                │
        │        │ movement detected  │ speed < 0.5 m/s│
        │        │ (significant-      ▼   for > 3 min  │
        │  STATIONARY (low-power)                      │
        │   significant-change / geofence-exit mode;   │
        │   heartbeat ping every ~2 min                │
        │                                              │
        └──────────────────────────────────────────────┘
                 │
        leave session · sharing off · session completed
                 ▼
              OFF (zero location access — hard stop)
```

- **Movement state** (drives the marker badge and sampling rate) is derived from reported speed + recent displacement: `driving` / `walking` / `stopped`. An explicit stop announcement (F6) also forces `stopped` at that pin.
- **Heading arrow**: use GPS course when speed > ~1 m/s (reliable while moving); freeze the last good heading when stationary rather than jittering. Marker rotates to match; others see which way you're headed at a glance.
- **Battery**: the stationary → low-power downshift is what makes all-day city sessions viable. Target ≤ 6–8%/hr while moving, near-zero while parked at a bar for 2 hours.
- **Long-idle nudge**: stationary > 60 min triggers a local "Still out with the group?" notification with one-tap *keep sharing* / *stop sharing* — a privacy backstop against forgotten sessions, not an auto-disarm (in city mode, sitting still for an hour is normal).
- Members whose updates go stale (backgrounded + OS throttled, dead zone) stay on the map at last-known position with a "last seen Xm ago" badge — never silently dropped.

### 5.4a Member colors

- Each member is assigned a color from a curated 12-color palette on join (first unused). The session cap is also 12 (F1a), so **every member is guaranteed a unique color** — no collisions possible. Stored as `trip_members.color` so every client renders identically.
- Colors must be distinguishable from one another and legible on both light/dark map styles; the avatar marker is a colored ring around the profile photo/emoji with a matching heading arrow, so color-blind users still have the photo as the primary identifier.
- The member's color threads through the whole UI: map marker, feed entries, stop cards, member list — one glance ties "the orange dot" to "orange Jess suggested In-N-Out."

### 5.5 Realtime channel events (per trip)

| Event | Payload | Producer |
|-------|---------|----------|
| `pos` | user_id, lat, lng, heading, speed, ts | each client |
| `eta` | user_id, eta_seconds, distance_m | edge cron |
| `stop_posted` / `stop_updated` | stop row | client → DB → realtime (postgres_changes) |
| `vote` | stop_id, user_id, vote | same |
| `arrived` | user_id, target (destination\|stop_id) | client geofence |
| `presence` | join/leave/sharing on-off | Supabase presence |

### 5.6 Session lifetime & invite links (F1, F1a)

**Session length**
- Set at creation: presets **2h / 4h / 8h / 12h / 24h** or custom end time. Road trips default to the initial ETA + 2h buffer; hangouts default to 8h. Hard cap 24h per session (recreate for multi-day — keeps "forgotten session" exposure bounded).
- The owner can extend or shorten while active; extensions post to the feed ("Sarah extended the session to 11 pm").
- **15 minutes before expiry**, every member gets a local notification: "Session ends in 15 min" with one-tap *extend 2h* (owner) / *request extension* (member, pings the owner).
- **At expiry** the session flips to `completed` server-side (edge cron checks `ends_at`): all clients stop tracking immediately (§5.4 OFF state), the realtime channel closes, and the map freezes to a summary view. Expiry is the privacy backstop — nobody can be tracked past the window everyone saw when they joined.

**Invite links (Meet-style)**
- Minting: session creation generates a `join_code` — three groups of lowercase letters (`kfx-mqvp-dhz`, ~44 bits, unguessable at our scale) — wrapped in a universal link `https://arrival.app/j/{code}`.
- Join flow: link opens the app via iOS Universal Links / Android App Links → `join/[code]` route → preview card (session name, kind, who's in, time remaining, and exactly what sharing means) → **Join** creates the membership and assigns a color. If the app isn't installed: fall back to a web landing page with store buttons + deferred deep link so the session survives the install.
- Anyone with the link can join while the session is active (like Meet) up to the **12-member cap** (enforced server-side; the link shows "Session is full" beyond that); joining always requires the explicit preview-card confirmation — a link click alone never starts sharing.
- Owner controls: **regenerate link** (rotates `join_code`, old links 404) and **lock session** (`join_locked` — link stops admitting new members; existing members unaffected).
- Links die with the session: after `ends_at`, the link shows "This session has ended."

### 5.7 Project structure

```
arrival/
  app/                    # expo-router
    (auth)/sign-in.tsx
    (app)/index.tsx       # trip list
    (app)/trip/new.tsx
    (app)/trip/[id]/      # map home, settings
    join/[code].tsx       # invite deep link
  src/
    components/map/       # MemberMarker, StopPin, PlaceSheet, ...
    components/sheet/     # feed, member list, stop cards
    features/trips/       # queries + mutations (TanStack Query)
    features/location/    # watcher, background task, geofences
    features/tracking/    # lifecycle state machine (§5.4): moving/stationary, speed→state
    features/realtime/    # channel manager, marker interpolation
    lib/supabase.ts
    lib/colors.ts         # member color palette + assignment (§5.4a)
    lib/nav-deeplinks.ts  # google/waze/apple maps URL builders
  supabase/
    migrations/           # schema + RLS
    functions/            # places-proxy, routes-eta, cron
```

## 6. Non-Functional Requirements

- **Freshness:** member positions ≤ 10s stale in foreground, ≤ 45s in background; show "last seen Xm ago" beyond that.
- **Scale target (v1):** 12 members/session, 500 concurrent sessions — comfortably within Supabase Realtime limits.
- **Offline/dead zones:** queue position pings and stop posts; show members as stale, never drop them from the map. Reconcile on reconnect.
- **Battery:** ≤ ~6–8%/hr drain during active trip (measure on mid-tier Android).
- **Cost control:** Places/Routes calls proxied + cached server-side; ETA recompute interval adaptive (farther out = less frequent).

## 7. Permissions & Store Compliance Checklist

- [ ] iOS: `NSLocationWhenInUseUsageDescription`, `NSLocationAlwaysAndWhenInUseUsageDescription`, background mode `location`; App Review notes explaining trip-scoped sharing.
- [ ] Android: `ACCESS_FINE_LOCATION`, `ACCESS_BACKGROUND_LOCATION` (needs Play Console declaration + demo video), foreground service with visible notification during active trip.
- [ ] Prominent in-app disclosure screen before requesting background location (Play policy).
- [ ] Notification permission prompt deferred until first meaningful moment (joining an active session).

## 8. Milestones

| Milestone | Contents | Exit criteria |
|-----------|----------|---------------|
| **M0 — Skeleton** | Expo app + dev client, Supabase project, auth, schema + RLS, trip CRUD, invite links | Two phones can join the same trip |
| **M1 — Live map** | Foreground location → broadcast → animated markers, member list, destination pin, deep-link to nav | Two cars see each other move in real time |
| **M2 — Stops & suggestions** | Place search/POI tap/long-press → place sheet, suggest + vote, announce stop + "I'll stop too", trip feed, push notifications | Golden path (§2) demo-able end to end |
| **M3 — Road-ready** | Background location, adaptive tracking lifecycle (§5.4: moving/stationary downshift, long-idle nudge), geofenced arrivals, ETAs via Routes API, stale/offline handling, battery saver | Real 2-car road test **and** a 2-person on-foot city test pass; battery target met |
| **M4 — Ship** | Store assets, compliance checklist, EAS production builds, TestFlight/Play internal | Beta in testers' hands |

## 9. Open Decisions

| # | Decision | Options | Recommendation |
|---|----------|---------|----------------|
| D1 | Map SDK | `react-native-maps` (free, native look) vs. Mapbox (custom style, consistent x-platform, usage pricing) | Start `react-native-maps`; abstract marker/camera layer so Mapbox swap is contained |
| D2 | Places/Routing provider | Google (best data, $) vs. Mapbox/HERE (cheaper) vs. OSM/OSRM (free, weaker POIs) | Google behind an edge proxy with caching; revisit at scale |
| D3 | Backend | Supabase vs. Firebase vs. custom (Node + Postgres) | Supabase (SQL + RLS + realtime in one; PostGIS available) |
| D4 | Position transport | Realtime broadcast (ephemeral) vs. DB writes per ping | Broadcast + periodic snapshot (as specced) |
| D5 | ETA computation | Server-side per member (consistent, costs API calls) vs. client-side straight-line fallback | Server-side w/ adaptive interval; straight-line fallback offline |
