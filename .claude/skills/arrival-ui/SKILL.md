---
name: arrival-ui
description: Design-system and map-performance conventions for Arrival's UI. Read before styling any surface, touching map markers/trails, or adding animations.
---

# Arrival UI conventions

Hard-won rules from building the M0 demo. SPEC.md §10 has the full design
record; this is what you must not regress.

## Glass (translucency)

- All panels use `src/components/Glass.tsx`. Its tint MUST stay
  `systemUltraThinMaterialDark` — the plain `dark` tint is itself ~80% opaque
  smoke, and it silently defeated every fill reduction until it was swapped.
- Translucency = TWO knobs: the fill alpha (`rgba(13,15,20,0.18)` base) AND the
  blur `intensity` (its material opacity scales with it). When the user asks for
  "X% more see-through", scale both, everywhere (grep `intensity={`).
- On-map chips that can't blur use the solid `UI.chip`.
- Android caveat: blur can't sample the map's SurfaceView; panels over the map
  render against black there. iOS is the demo target.
- Accent discipline: member palette colors = people; `UI.brand` (amber) =
  session-level signals (brand mark, convergence, recap). Never use a member
  color for group chrome or vice versa.
- Non-map screens sit on `AmbientMap` (live drifting map + scrim), not flat
  color — the glass must always blur something real.

## Member markers (`MemberMarker.tsx`)

- Anatomy: photo-filled teardrop (tip corner tight, others full radius) rotated
  `heading - mapHeading + 45`; photo counter-rotates. Colored "pencil lead"
  protrudes past the point. Idle relaxes to a circle. "You" looks like everyone
  else (halo retired). Paused = ❚❚ glyph inside the timer text (tag chip +
  rail ETA) — never rings or badges on the puck.
- LIVE sessions have NO clustering: every real member's puck mounts once at
  roster load and never unmounts, hides, or remounts. On Expo Go (New Arch,
  can't opt out) Apple Maps loses custom marker views on ANY lifecycle event
  — mount, visibility flip, or key-change remount (#5911), sometimes
  permanently. Facepiles are demo-only, where members are simulated and
  clustered members are conditionally RENDERED, never opacity-hidden, with
  the clustering INPUT stable across selection (`clusterVisibility` in
  lib/clusters). A `repaintTick` prop (5 s bucket) breaks each marker's memo
  periodically so any natively-lost view gets a repainting prop nudge.
  Never add a key-change remount as a "self-heal" — a freshly inserted
  marker often doesn't paint until its next prop update (that was the
  90%-reproducible blink-on-Close).
- Demo avatars are bundled local assets (`assets/avatars/`); don't switch back
  to remote URLs in markers.

## Trails (`TrailPath.tsx`) — markers are FORBIDDEN here

- Trails are dotted native **Polylines** (overlay renderer), never Markers.
  Root cause on record: mass trail-marker churn aggravated react-native-maps
  **#5911** (Apple Maps + New Arch drops custom marker views on zoom/pan
  reconciliation) — that was the flaky-profile bug. Do not reintroduce
  per-dot/per-print markers in any form; pre-rendered image markers are the
  only acceptable footprint revival, and only after #5911 is resolved.
- Apple Maps dash patterns are screen-point based and zoom-compensated:
  dot spacing is zoom-stable for free. NEVER set `strokeColors` on a dashed
  polyline (gradient renderer breaks dash scaling, doubles width) — the
  opacity ramp is 3 solid-alpha segments instead. Keep ≥3 points per
  polyline (#5285: 2-point polylines vanish on Apple Maps).
- `tracksViewChanges` is a NO-OP on Apple Maps (iOS-Google-only) — don't
  reach for it as a fix on this stack.

## Marker stability doctrine — settled by four rounds of device testing

The root pattern, learned the hard way: **on Expo Go's New Architecture,
Apple Maps loses custom marker views on ANY lifecycle event** — opacity flip,
mount, unmount, or key-change remount (rn-maps #5911). Every "fix" that just
moved the churn around failed on device. What actually works:

- **Zero lifecycle churn in live sessions.** No clustering there: each puck
  mounts once at roster load and never unmounts, hides, or remounts. Facepiles
  are demo-only (simulated members, never dropped).
- **Stable keys. Never remount as a "self-heal."** A `-sel` key suffix was
  added to repaint markers across selection — it caused a 90%-reproducible
  blink on every Close, because a freshly inserted marker doesn't paint until
  its NEXT prop update (which arrived with the 3 s position packet — hence
  "it comes back after 3-5 seconds").
- **`repaintTick` instead**: a prop that changes every 5 s breaks each marker's
  memo, guaranteeing a periodic prop nudge that repaints any view iOS lost
  anyway. Cheap at this member count; keep it.
- Selection may change only cheap props (border width). Keep the marker census
  small and IDs stable; never mass-mount/unmount markers in one commit.
- Cluster regrouping (demo) is throttled in session.tsx (2.5 s / >25% change)
  because 4 Hz membership flapping remounted facepile photos.
- `newArchEnabled: false` in app.json means **real dev builds don't have this
  bug class at all** — Expo Go can't opt out. `npx expo run:ios --device` is
  the definitive validation environment (roadmap T2).

## Bottom surfaces

- Sheets (invite, place) anchor **flush**: full-bleed, past the screen bottom,
  bottom corners squared — only the top corners round. **No backdrop dim**:
  the 30% dim WAS the "ghost panel" the user kept seeing above the sheet. The
  backdrop stays invisible and tap-to-close. The activity dock follows the
  same anchoring.
- The member surface has ONE fixed height (`MEMBER_SURFACE_H`, exported from
  MemberRail) shared by the rail chips and the full-width card, so swapping
  between them never shifts layout. No member state (departed, arrived, long
  name) may change the footprint — every text line is `numberOfLines={1}` and
  truncates. Sizing asks ("+10%") scale the spatial knobs, not the fonts.
- The card deck is a pager (`MemberPager`): order is you → fastest ETA →
  departed last (`sortMembers` in lib/roster), shared with the rail. The deck
  order FREEZES while open — live ETAs cross constantly and reordering pages
  mid-swipe is disorienting.

## Transforms & animation

- To translate in a rotated frame in RN, NEST views (parent rotates, child
  translates). A flat transform array applies translation in screen space and
  flipped the footprints' left/right feet once already.
- Pivot a limb at its joint by making the wrapper twice the limb's length with
  the limb in the bottom half (see `WalkingIcon` in `MemberCard.tsx`).
- Loop animations on the native driver; keep them subtle (the walking figure is
  the reference).

## Session IA (v2)

- Bottom architecture is rail → card → dock: `MemberRail` (chips + `DotRing`
  progress dots), `MemberCard` (relative bearing + Retrace), `ActivityDock`
  (ticker / stops / timeline / recap). Members do NOT belong in the dock.
- Camera state machine: auto-fit ⇄ follow(selected) ⇄ free. Retrace and pan
  must clear `follow` or the per-tick `setCamera` fights the user.

## Tests (non-negotiable going forward)

- `npm test` (jest-expo). Every PR that adds or changes logic ships tests.
- Keep logic PURE and out of components so it's testable without rendering:
  geometry in `lib/geo`, display strings in `lib/format`, trail segmentation
  in `lib/trail`, clustering math in `lib/clusters` (throttling lives in
  `hooks/useClusters`), convergence line in `lib/convergence`, stoplights in
  `demo/lights`, `levelAt` exported from `demo/simulation`.
- If you find yourself writing logic inline in a component, extract it first.

## Simulation

- Routes are real OSRM street geometry (see the `regen-routes` skill). No
  Chaikin smoothing on routes — corner-cutting goes through buildings.
- Walkers catch seeded stoplights (`findLights`); waits pause movement without
  changing state, badges, or feed entries.
- Anything shown per-member (trail, steps, mode) is computed in
  `buildSnapshot` — extend there, not in components.
