import { appendToTrail, stateFromSpeed, straightLineEtaMin, trailDistanceM } from './live-helpers';

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
