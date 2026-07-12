# Arrival — demo build

Road-trip convoy coordination. Full product spec in [SPEC.md](SPEC.md).

The app currently has two paths:

- A polished **M0 demo** with simulated members, scripted stops/votes, trails,
  arrival recap, and local session archives.
- An early **M1 live path** behind Supabase environment variables: anonymous
  identity, session create/join, private realtime foreground positions, roster
  updates, last-known snapshots, and a live event feed. Live stops/votes and
  background tracking are not implemented yet.

See [docs/PROJECT_STATE.md](docs/PROJECT_STATE.md) for the exact handoff point.

Two scenarios, picked by session kind on the create screen:
- **Hangout (default):** walking through Greenwich Village to Washington Square Park —
  Mike stops for coffee, Jess suggests Joe's Pizza.
- **Road trip:** two-highway convoy into South Lake Tahoe — Mike stops for gas,
  Jess suggests a burger stop in Truckee.

## Run it

```bash
npm install
npx expo start
```

For quick demo work, scan the QR code with **Expo Go** (iOS: Camera app /
Android: Expo Go app). Validate map-marker stability in a development build;
Expo Go cannot honor this project's `newArchEnabled: false` setting.

## Try in the demo

- **Create a session** — pick kind + session length, then the invite share sheet pops (F1a).
- Watch the **top-down auto-fit camera** track the whole convoy; pan to break out, tap **⊕ Everyone** to recenter.
- **Tap a member** (map or list) to follow them.
- ~20s in, **Mike stops for gas** — tap **"I'll stop too"** and your car will pull over when it reaches the station.
- ~25s in, **Jess suggests a burger stop** — vote 👍 and it confirms.
- **Long-press anywhere on the map** to drop a pin and announce/suggest your own stop.
- Pull up **Show activity** for the trip feed.

## Layout

- `app/` — expo-router screens (home → create → session map)
- `src/demo/` — simulated convoy: route data + tick engine
- `src/components/` — member markers (color ring + heading arrow), stop pins, session sheet
- `src/lib/` — geo math, member color palette
