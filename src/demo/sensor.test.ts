import { distanceM } from '../lib/geo';
import { Fix, motionFrom, pushFix, sensed } from '../lib/motion';
import { sensedFix } from './sensor';

const POS = { latitude: 40.73, longitude: -73.99 };

/** what the demo does every second: one reading, through the gate */
function replay(memberId: string, n: number, speedMps: number, courseDeg = 90): Fix[] {
  let fixes: Fix[] = [];
  for (let i = 0; i < n; i++) {
    // a walker covers ground; a stander doesn't
    const truePos = { latitude: POS.latitude, longitude: POS.longitude + (speedMps * i) / 84_000 };
    fixes = pushFix(fixes, sensedFix(memberId, i, truePos, courseDeg, speedMps, i * 1000));
  }
  return fixes;
}

describe('sensedFix', () => {
  it('is deterministic — the same member, the same reading, the same noise', () => {
    const a = sensedFix('ana', 7, POS, 90, 1.4, 7000);
    const b = sensedFix('ana', 7, POS, 90, 1.4, 7000);
    expect(a).toEqual(b);
  });

  it('gives different members different noise', () => {
    const ana = sensedFix('ana', 7, POS, 90, 1.4, 7000);
    const dan = sensedFix('dan', 7, POS, 90, 1.4, 7000);
    expect(ana.pos).not.toEqual(dan.pos);
  });

  it('scatters the fix, but inside a plausible error circle', () => {
    for (let i = 0; i < 200; i++) {
      const f = sensedFix('ana', i, POS, 90, 1.4, i * 1000);
      expect(distanceM(POS, f.pos)).toBeLessThan(30);
      expect(f.accuracy).toBeGreaterThan(0);
    }
  });

  it('reports -1 the way iOS does, not null — so the normalizer gets exercised', () => {
    const readings = Array.from({ length: 200 }, (_, i) => sensedFix('ana', i, POS, 90, 1.4, i * 1000));
    expect(readings.some((f) => f.speed === -1)).toBe(true);
    expect(readings.some((f) => f.course === -1)).toBe(true);
    // and -1 is a thing we know how to refuse
    expect(sensed(-1)).toBeNull();
  });

  it('withholds a course from someone standing still, exactly like the real thing', () => {
    const standing = Array.from({ length: 40 }, (_, i) => sensedFix('ana', i, POS, 90, 0, i * 1000));
    expect(standing.every((f) => f.course === -1)).toBe(true);
  });

  it('emits the occasional garbage fix, so the gate has something to throw away', () => {
    const readings = Array.from({ length: 300 }, (_, i) => sensedFix('ana', i, POS, 90, 1.4, i * 1000));
    expect(readings.some((f) => (f.accuracy ?? 0) > 40)).toBe(true);
  });
});

describe('the demo, run through the same gate as a real phone', () => {
  it('a walking member earns a direction', () => {
    const fixes = replay('ana', 12, 1.4, 90);
    const m = motionFrom(fixes, null, 11_000);
    expect(m.moving).toBe(true);
    expect(m.heading).not.toBeNull();
    expect(Math.abs(m.heading! - 90)).toBeLessThan(20); // noisy, but honest
  });

  it('a standing member does NOT — the demo has to be able to show this too', () => {
    // if the demo can't reproduce a directionless puck, it can't prove we fixed
    // the one that used to point north forever
    const m = motionFrom(replay('dan', 12, 0), null, 11_000);
    expect(m.moving).toBe(false);
    expect(m.heading).toBeNull();
  });
});
