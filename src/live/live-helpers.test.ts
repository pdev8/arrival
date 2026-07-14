import { LatLng, offsetM } from '../lib/geo';
import { STILL } from '../lib/motion';
import {
  Snapshot,
  Tracked,
  appendToTrail,
  applyBroadcast,
  blankTracked,
  mergeSnapshot,
  simMotion,
  stateFromMotion,
  straightLineEtaMin,
  trailDistanceM,
} from './live-helpers';

const P = (latitude: number, longitude = -74) => ({ latitude, longitude });

const DEST = { latitude: 37.79, longitude: -122.4 };
const FAR = { latitude: 37.75, longitude: -122.42 };
const NEAR = { latitude: 37.7901, longitude: -122.4001 };

/** how a broadcast cadence actually feels: one every 3 s */
const TICK = 3000;

/**
 * `n` broadcasts of someone walking `bearing` at `mps`, exactly as they'd
 * arrive off the wire. This is the only honest way to build a live member now:
 * their direction is not a field you can set, it is something they earn by
 * moving (lib/motion).
 */
function walked(
  n: number,
  opts: { bearing?: number; mps?: number; from?: LatLng; course?: number | null; dest?: LatLng | null } = {}
): Tracked {
  const { bearing = 0, mps = 1.4, from = FAR, course = bearing, dest = DEST } = opts;
  let m = blankTracked();
  for (let i = 0; i < n; i++) {
    const pos = offsetM(from, bearing, mps * (TICK / 1000) * i);
    m = applyBroadcast(
      m,
      { lat: pos.latitude, lng: pos.longitude, heading: course, speed: mps, acc: 8 },
      dest,
      40,
      i * TICK
    );
  }
  return m;
}

describe('stateFromMotion', () => {
  it('maps SPEC thresholds off the gate, not off a raw sample', () => {
    expect(stateFromMotion(STILL, false)).toBe('stopped');
    expect(stateFromMotion({ ...STILL, moving: true, speedMps: 1.4 }, false)).toBe('walking');
    expect(stateFromMotion({ ...STILL, moving: true, speedMps: 6.1 }, false)).toBe('driving');
  });
  it('not moving is stopped, whatever the speedometer says', () => {
    // a phantom speed on a stationary phone must not read as walking
    expect(stateFromMotion({ ...STILL, moving: false, speedMps: 3 }, false)).toBe('stopped');
  });
  it('arrived wins regardless', () => {
    expect(stateFromMotion({ ...STILL, moving: true, speedMps: 10 }, true)).toBe('arrived');
  });
});

describe('straightLineEtaMin', () => {
  it('uses reported speed when moving', () => {
    // ~1112m at 2 m/s ≈ 9.3 min
    const eta = straightLineEtaMin(P(40.73), P(40.74), 2);
    expect(eta).toBeGreaterThan(8.5);
    expect(eta).toBeLessThan(10);
  });
  it('falls back to walking pace when stationary', () => {
    const eta = straightLineEtaMin(P(40.73), P(40.74), 0);
    expect(eta).toBeGreaterThan(12); // 1112m / 1.4 ≈ 13.2 min
  });
});

describe('appendToTrail', () => {
  it('skips jitter below the minimum step', () => {
    const trail = [P(40.73)];
    expect(appendToTrail(trail, P(40.730001))).toBe(trail);
  });
  it('appends real movement and caps length', () => {
    let trail = [P(40.73)];
    trail = appendToTrail(trail, P(40.7305));
    expect(trail).toHaveLength(2);
    const long = Array.from({ length: 700 }, (_, i) => P(40.7 + i * 0.001));
    expect(appendToTrail(long, P(41.5)).length).toBeLessThanOrEqual(600);
  });
});

describe('trailDistanceM', () => {
  it('sums segment distances', () => {
    const d = trailDistanceM([P(40.73), P(40.74), P(40.75)]);
    expect(d).toBeGreaterThan(2200);
    expect(d).toBeLessThan(2250);
  });
  it('is zero for trivial trails', () => {
    expect(trailDistanceM([])).toBe(0);
    expect(trailDistanceM([P(40.73)])).toBe(0);
  });
});

describe('applyBroadcast', () => {
  it('a member who has walked has a direction', () => {
    const m = walked(6, { bearing: 90 });
    expect(m.pos!.longitude).toBeGreaterThan(FAR.longitude); // went east
    expect(m.motion.moving).toBe(true);
    expect(m.motion.heading).toBeCloseTo(90, 0);
    expect(m.lastAt).toBe(5 * TICK);
  });

  it('a member on their FIRST fix has none — and none is not north', () => {
    const m = walked(1);
    expect(m.motion.heading).toBeNull();
    expect(m.motion.moving).toBe(false);
  });

  it('derives a course from the path when the sender’s OS gives none', () => {
    // an Android, an indoor fix, a phone that just woke up: heading null on the
    // wire. The trail still knows which way they went.
    const m = walked(6, { bearing: 180, course: null });
    expect(m.motion.heading).toBeCloseTo(180, 0);
  });

  it('never trusts iOS’s -1 as a real reading', () => {
    let m = walked(6, { bearing: 90 });
    const at = 6 * TICK;
    m = applyBroadcast(m, { lat: 37.76, lng: -122.41, heading: -1, speed: -1, acc: -1 }, DEST, 40, at);
    // -1 must not become a bearing of minus one degree or a speed of -1 m/s
    expect(m.motion.heading).toBeGreaterThanOrEqual(0);
    expect(m.motion.speedMps).toBeGreaterThanOrEqual(0);
  });

  it('seeds firstRemainingM on the first fix, then leaves it alone', () => {
    const first = walked(1);
    expect(first.firstRemainingM).toBeGreaterThan(0);
    const second = walked(6);
    expect(second.firstRemainingM).toBe(first.firstRemainingM);
  });

  it('arrival latches', () => {
    const m = applyBroadcast(
      blankTracked(),
      { lat: NEAR.latitude, lng: NEAR.longitude, heading: null, speed: 1.4 },
      DEST,
      40,
      1
    );
    expect(m.arrived).toBe(true);
    const away = applyBroadcast(m, { lat: FAR.latitude, lng: FAR.longitude, heading: null, speed: 1.4 }, DEST, 40, 2);
    expect(away.arrived).toBe(true);
  });
});

describe('mergeSnapshot', () => {
  const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
    pos: NEAR,
    at: 2000,
    heading: 10,
    speed: 2,
    arrivedState: false,
    ...over,
  });

  it('adopts the snapshot when nothing is tracked yet', () => {
    const m = mergeSnapshot(undefined, snap(), DEST, 40, 2000);
    expect(m.pos).toEqual(NEAR);
    expect(m.lastAt).toBe(2000);
    expect(m.trail).toEqual([NEAR]);
  });

  it('adopts a snapshot fresher than the last broadcast', () => {
    const live = walked(4);
    const m = mergeSnapshot(live, snap({ at: live.lastAt + 5000 }), DEST, 40, 20_000);
    expect(m.pos).toEqual(NEAR);
  });

  it('keeps live state when the snapshot is stale', () => {
    const live = walked(6, { bearing: 90 });
    const m = mergeSnapshot(live, snap({ at: 1 }), DEST, 40, live.lastAt);
    expect(m.pos).toEqual(live.pos);
    expect(m.motion.heading).toBeCloseTo(90, 0);
    expect(m.lastAt).toBe(live.lastAt);
  });

  it('a member who has gone quiet loses their direction as their fixes age out', () => {
    // THE LIE THIS PREVENTS: a puck still pointing north-east four minutes after
    // the last thing we heard from them.
    const live = walked(6, { bearing: 45 });
    expect(live.motion.heading).toBeCloseTo(45, 0);
    const later = mergeSnapshot(live, snap({ pos: null, at: 0 }), DEST, 40, live.lastAt + 240_000);
    expect(later.motion.heading).toBeNull();
    expect(later.motion.moving).toBe(false);
    expect(later.pos).toEqual(live.pos); // but we still know where they were
  });

  it('keeps the original firstRemainingM as the progress denominator', () => {
    const live = walked(4);
    const m = mergeSnapshot(live, snap({ at: 99_999 }), DEST, 40, 99_999);
    expect(m.firstRemainingM).toBe(live.firstRemainingM);
  });

  it('arrives inside the radius, and honours the persisted arrived state', () => {
    expect(mergeSnapshot(undefined, snap({ pos: NEAR }), DEST, 40, 1).arrived).toBe(true);
    expect(mergeSnapshot(undefined, snap({ pos: FAR, arrivedState: true }), DEST, 40, 1).arrived).toBe(true);
    expect(mergeSnapshot(undefined, snap({ pos: FAR }), DEST, 40, 1).arrived).toBe(false);
  });

  it('a posless snapshot never clobbers a tracked position', () => {
    const live = walked(4);
    const m = mergeSnapshot(live, snap({ pos: null, at: 9999 }), DEST, 40, 9999);
    expect(m.pos).toEqual(live.pos);
  });
});

describe('simMotion', () => {
  it('walking on foot derives steps from the trail', () => {
    const m = simMotion(walked(8), DEST);
    expect(m.state).toBe('walking');
    expect(m.mode).toBe('foot');
    expect(m.steps).toBeGreaterThan(0);
    expect(m.moving).toBe(true);
    expect(m.heading).not.toBeNull();
  });

  it('driving reports no steps', () => {
    const m = simMotion(walked(8, { mps: 20 }), DEST);
    expect(m.state).toBe('driving');
    expect(m.mode).toBe('car');
    expect(m.steps).toBe(0);
  });

  it('hands the UI a null heading rather than a fake one', () => {
    const m = simMotion(walked(1), DEST); // one fix: nothing earned yet
    expect(m.heading).toBeNull();
    expect(m.moving).toBe(false);
    expect(m.state).toBe('stopped');
  });

  it('arrived pins eta to zero', () => {
    const arrived = { ...walked(4), arrived: true };
    expect(simMotion(arrived, DEST).etaMin).toBe(0);
  });

  it('free roam has no ETA and no progress — there is nowhere to be', () => {
    const m = simMotion(walked(8, { dest: null }), null);
    expect(m.etaMin).toBeNull();
    expect(m.progress).toBe(0);
    expect(m.traveledM).toBeGreaterThan(0); // but distance covered still counts
    expect(m.heading).not.toBeNull(); // and direction still works without a destination
  });

  it('progress runs 0 → 1 against the first remaining distance', () => {
    const start = simMotion(walked(1), DEST);
    expect(start.progress).toBe(0);
    // walk most of the way to the destination
    const nearly = { ...walked(8), pos: NEAR, firstRemainingM: 4400 };
    expect(simMotion(nearly, DEST).progress).toBeGreaterThan(0.9);
  });

  it('progress clamps at 1 past the destination', () => {
    const past = { ...walked(4), pos: DEST, firstRemainingM: 4400 };
    expect(simMotion(past, DEST).progress).toBe(1);
  });
});
