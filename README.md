# Arrival — demo build

Road-trip convoy coordination. Full product spec in [SPEC.md](SPEC.md).

This is the **M0 demo**: start a session, get a Meet-style invite link, and watch a
simulated 4-member group (you, Sarah, Mike, Jess) converge on a top-down map — complete
with a stop announcement, a suggestion you can vote on, arrival events, and a live feed.
No backend yet; members are simulated locally at accelerated speed so a session plays
out in ~3 minutes.

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

Scan the QR code with **Expo Go** (iOS: Camera app / Android: Expo Go app).

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
