import { Snapshot, Tracked, appendToTrail, applyBroadcast, mergeSnapshot, simMotion, stateFromSpeed, straightLineEtaMin, trailDistanceM } from './live-helpers';

const P = (latitude: number, longitude = -74) => ({ latitude, longitude });

describe('stateFromSpeed', () => {
  it('maps SPEC thresholds', () => {
    expect(stateFromSpeed(null, false)).toBe('stopped');
    expect(stateFromSpeed(0.2, false)).toBe('stopped');
    expect(stateFromSpeed(1.4, false)).toBe('walking');
    expect(stateFromSpeed(6.1, false)).toBe('driving');
  });
  it('arrived wins regardless of speed', () => {
    expect(stateFromSpeed(10, true)).toBe('arrived');
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

describe('mergeSnapshot', () => {
  const dest = { latitude: 37.79, longitude: -122.4 };
  const far = { latitude: 37.75, longitude: -122.42 };
  const near = { latitude: 37.7901, longitude: -122.4001 };
  const tracked = (over: Partial<Tracked> = {}): Tracked => ({
    pos: far,
    heading: 90,
    speed: 1.2,
    trail: [far],
    firstRemainingM: 5000,
    arrived: false,
    lastAt: 1000,
    ...over,
  });
  const snap = (over: Partial<Snapshot> = {}): Snapshot => ({
    pos: near,
    at: 2000,
    heading: 10,
    speed: 2,
    arrivedState: false,
    ...over,
  });

  it('adopts the snapshot when nothing is tracked yet', () => {
    const m = mergeSnapshot(undefined, snap(), dest, 40);
    expect(m.pos).toEqual(near);
    expect(m.lastAt).toBe(2000);
    expect(m.trail).toEqual([near]);
  });
  it('adopts a snapshot fresher than the last broadcast', () => {
    const m = mergeSnapshot(tracked({ lastAt: 1000 }), snap({ at: 2000 }), dest, 40);
    expect(m.pos).toEqual(near);
    expect(m.speed).toBe(2);
  });
  it('keeps live state when the snapshot is stale', () => {
    const m = mergeSnapshot(tracked({ lastAt: 5000 }), snap({ at: 2000 }), dest, 40);
    expect(m.pos).toEqual(far);
    expect(m.speed).toBe(1.2);
    expect(m.lastAt).toBe(5000);
  });
  it('keeps the original firstRemainingM as the progress denominator', () => {
    const m = mergeSnapshot(tracked({ firstRemainingM: 5000 }), snap(), dest, 40);
    expect(m.firstRemainingM).toBe(5000);
  });
  it('arrival latches once set', () => {
    const m = mergeSnapshot(tracked({ arrived: true }), snap({ pos: far, at: 9000 }), dest, 40);
    expect(m.arrived).toBe(true);
  });
  it('arrives inside the radius, and honours the persisted arrived state', () => {
    expect(mergeSnapshot(undefined, snap({ pos: near }), dest, 40).arrived).toBe(true);
    expect(mergeSnapshot(undefined, snap({ pos: far, arrivedState: true }), dest, 40).arrived).toBe(true);
    expect(mergeSnapshot(undefined, snap({ pos: far }), dest, 40).arrived).toBe(false);
  });
  it('a posless snapshot never clobbers a tracked position', () => {
    const m = mergeSnapshot(tracked(), snap({ pos: null, at: 9999 }), dest, 40);
    expect(m.pos).toEqual(far);
  });
});

describe('applyBroadcast', () => {
  const dest = { latitude: 37.79, longitude: -122.4 };
  const base: Tracked = {
    pos: { latitude: 37.75, longitude: -122.42 },
    heading: 90,
    speed: 1,
    trail: [{ latitude: 37.75, longitude: -122.42 }],
    firstRemainingM: null,
    arrived: false,
    lastAt: 1,
  };
  it('always wins and stamps lastAt', () => {
    const m = applyBroadcast(base, { lat: 37.76, lng: -122.42, heading: 5, speed: 3 }, dest, 40, 777);
    expect(m.pos).toEqual({ latitude: 37.76, longitude: -122.42 });
    expect(m.heading).toBe(5);
    expect(m.speed).toBe(3);
    expect(m.lastAt).toBe(777);
  });
  it('seeds firstRemainingM on the first fix, then leaves it alone', () => {
    const first = applyBroadcast(base, { lat: 37.76, lng: -122.42, heading: null, speed: null }, dest, 40, 1);
    expect(first.firstRemainingM).toBeGreaterThan(0);
    const second = applyBroadcast(first, { lat: 37.785, lng: -122.4, heading: null, speed: null }, dest, 40, 2);
    expect(second.firstRemainingM).toBe(first.firstRemainingM);
  });
  it('keeps the old heading when the payload omits one', () => {
    const m = applyBroadcast(base, { lat: 37.76, lng: -122.42, heading: null, speed: 2 }, dest, 40, 1);
    expect(m.heading).toBe(90);
  });
});

describe('simMotion', () => {
  const dest = { latitude: 37.79, longitude: -122.4 };
  const start = { latitude: 37.75, longitude: -122.4 };
  const half = { latitude: 37.77, longitude: -122.4 };
  const tracked = (over: Partial<Tracked> = {}): Tracked => ({
    pos: half,
    heading: 0,
    speed: 1.4,
    trail: [start, half],
    firstRemainingM: null,
    arrived: false,
    lastAt: 0,
    ...over,
  });

  it('walking on foot derives steps from the trail', () => {
    const m = simMotion(tracked(), dest);
    expect(m.state).toBe('walking');
    expect(m.mode).toBe('foot');
    expect(m.steps).toBeGreaterThan(0);
  });
  it('driving reports no steps', () => {
    const m = simMotion(tracked({ speed: 20 }), dest);
    expect(m.state).toBe('driving');
    expect(m.mode).toBe('car');
    expect(m.steps).toBe(0);
  });
  it('arrived pins eta to zero', () => {
    expect(simMotion(tracked({ arrived: true }), dest).etaMin).toBe(0);
  });
  it('progress runs 0 -> 1 against the first remaining distance', () => {
    const atStart = simMotion(tracked({ pos: start, trail: [start], firstRemainingM: null }), dest);
    expect(atStart.progress).toBe(0);
    const midway = simMotion(tracked({ firstRemainingM: 4400 }), dest);
    expect(midway.progress).toBeGreaterThan(0.4);
    expect(midway.progress).toBeLessThan(0.6);
  });
  it('progress clamps at 1 past the destination', () => {
    expect(simMotion(tracked({ pos: dest, firstRemainingM: 4400 }), dest).progress).toBe(1);
  });
});
