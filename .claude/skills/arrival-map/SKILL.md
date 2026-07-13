---
name: arrival-map
description: THE MAP RENDERING CONTRACT. Read before touching anything inside <MapView> — markers, trails, polylines, the camera, clustering, selection. These invariants are the product; violating one makes pucks vanish or flash. Enforced by src/map-contract.test.ts.
---

# The map rendering contract

The map IS Arrival. If pucks vanish, flash, or trails freeze, the product is
broken no matter what else works. This file is the hard-won contract; every
rule here cost a round of on-device testing to learn, and **three of them were
broken by "obviously safe" refactors**. Do not relax one because it looks
harmless.

Enforced automatically: `src/map-contract.test.ts` fails the build if the
forbidden patterns reappear. If that test fails, you broke the map — do not
"fix" the test.

## The platform truth (react-native-maps 1.20.x, Apple Maps / MapKit)

Read these once; every rule below follows from them. All verified in the
vendored source under `node_modules/react-native-maps/ios/AirMaps/`.

1. **Any change to MapView's child list re-adds EVERY marker annotation.**
   `AIRMap` doesn't override `didUpdateReactSubviews`, so it inherits RN's
   default (`UIView+React.m`), which calls `addSubview()` on every child — and
   `AIRMap.addSubview:` remaps a marker to `addAnnotation:`. Re-adding re-runs
   `mapView:viewForAnnotation:`; if that lands before a marker's react children
   are attached, `shouldUsePinView` is true and rn-maps returns an
   **`MKMarkerAnnotationView`** — a big coloured balloon ("the dot splatter") —
   or the custom view is lost entirely (the vanishing puck).
2. **A Polyline's renderer is created ONLY in `setCoordinates:`.** Every other
   setter mutates an already-rasterized `MKPolylineRenderer`, and nothing in
   the Apple provider ever calls `setNeedsDisplay`. **A `strokeColor` change
   does not redraw.**
3. **Every Polyline prop setter does `removeOverlay` + `addOverlay`.** Prop
   churn on overlays is expensive and superlinear in overlay count.
4. **Dash patterns are in screen points and re-rasterize on every zoom
   CHANGE.** Re-applying zoom on a tick re-scales every dashed line — dots
   render at the wrong size for a frame (blobs).
5. **`tracksViewChanges` is dead on Apple Maps** (Google-iOS only). It is not a
   lever. Neither is marker `zIndex` (it maps to `layer.zPosition`, which
   MapKit overwrites).
6. **#5911** (custom marker views dropped) is worst on the New Architecture.
   Expo Go **forces** New Arch, so **marker bugs cannot be validated in Expo
   Go** — use the dev build (`npx expo run:ios --device`, `newArchEnabled:
   false`). Debugging map rendering in Expo Go wastes days; ask first.

## The invariants

### 1. The child list of `<MapView>` is STATIC
Every marker and every polyline mounts once and stays mounted for the life of
the session. **No conditional rendering, no `.filter()`, no `&&`, no
clustering** inside MapView. Visibility is driven by DATA (coordinates), never
by mounting.
> Broke it: clustering (members mounted/unmounted as facepiles re-formed),
> and trails that mounted on the Trails toggle / on selection.

### 2. Markers render FIRST, trails LAST
Order in the children array is load-bearing (see platform truth #1).

### 3. Polyline visibility = `coordinates`, never `strokeColor`
Hidden ⇒ `coordinates={[]}`. Visible ⇒ its points. Never `'transparent'`.
> Broke it: a "display-only" strokeColor toggle that silently did nothing.

### 4. A marker's custom view must be STATIC
`<Marker>` takes the live `coordinate`; its child (`<Puck>`) is separately
memoized and **never sees position**. Everything the puck draws is quantized to
change rarely: heading to 5°, ETA to whole **minutes** (`formatEtaCoarse` — the
rail and card carry the live m:ss countdown). **Selection must not restyle the
puck** — it rebuilds the view and flashes the default pin.

### 5. Zoom is applied ONCE, on entering follow — never on the tick
The follow effect re-runs at the sim tick (members is a new array each tick).
Pass `zoom`/`altitude` only on the transition into follow; afterwards pass
`center` only, and only when the member has moved ≥ `RECENTER_M`.
> Broke it: `setCamera({center, zoom, altitude})` 4×/second while tracking —
> the cause of the splatter and the trail flicker (platform truth #4).

### 6. Trails have a LIVE HEAD
The settled body is memoized on a distance bucket; the final polyline is
redrawn to the member's **current position** (`headSegment` in lib/trail), and
must not depend on the body existing (a new member has travelled 0 m).
> Broke it: a 20 m bucket froze the trail for ~14 s at a time ("goes cold"),
> and a body-anchored head drew nothing at all for the first 15 m.

### 7. Trails are POLYLINES. Never markers.
Per-dot/per-footprint markers were the original #5911 trigger. Pre-rendered
image markers are the only acceptable revival, and only after #5911 is fixed.

### 8. The Trails toggle is authoritative
`visible = showTrails`. Selection must NOT force a trail on — the user then
can't turn off the trail they're looking at, which reads as a broken toggle.
Retrace turns the toggle on.

## Symptom → cause (start here when something regresses)

| Symptom | Cause |
|---|---|
| Big bright dot / balloon flash | Child list changed → annotation re-added → default pin (truth #1) |
| Puck vanishes for good | Same, or the marker's custom view re-rendered (invariants 1, 4) |
| Puck blank for 3–5 s, then returns | A marker remount — a fresh annotation doesn't paint until its next prop update. **Never remount markers as a "self-heal."** |
| Trail toggle does nothing | strokeColor-based visibility (invariant 3), or selection forcing it on (invariant 8) |
| Trail freezes / goes cold | No live head, or too coarse a bucket (invariant 6) |
| Only some members' trails appear | strokeColor visibility — only members whose coordinates changed got redrawn |
| Trails/dots flicker while tracking | Zoom re-applied on the tick (invariant 5) |

## Before you change map code

1. Read this file and `arrival-ui`'s marker section.
2. Ask: does my change mount/unmount anything under MapView, change a marker's
   child view, or touch the camera on a tick? If yes — it's wrong; find the
   data-driven way.
3. `npm test` (the contract test must pass).
4. **Validate on the dev build**, never in Expo Go (truth #6). Two phones for
   live sessions.
