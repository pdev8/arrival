import { LatLng, offsetM } from './geo';
import {
  Fix,
  HEADING_HOLD_MS,
  Motion,
  angleDeltaDeg,
  bearingOverLast,
  circularMeanDeg,
  motionFrom,
  pushFix,
  sensed,
} from './motion';

const START: LatLng = { latitude: 40.73, longitude: -73.99 };

/** A stream of fixes: `n` readings `everyMs` apart, travelling `bearing` at `mps`. */
function stream(
  n: number,
  opts: {
    bearing?: number;
    mps?: number;
    everyMs?: number;
    /** undefined = the platform reports the true course; null = it reports none */
    course?: number | null;
    accuracy?: number | null;
    from?: LatLng;
    t0?: number;
  } = {}
): Fix[] {
  const { bearing = 0, mps = 1.4, everyMs = 1000, accuracy = 8, from = START, t0 = 0 } = opts;
  return Array.from({ length: n }, (_, i) => ({
    pos: offsetM(from, bearing, mps * (everyMs / 1000) * i),
    at: t0 + i * everyMs,
    speed: mps,
    course: 'course' in opts ? opts.course : bearing,
    accuracy,
  }));
}

const endOf = (fixes: Fix[]) => fixes[fixes.length - 1].at;
const run = (fixes: Fix[], prev: Motion | null = null) => motionFrom(fixes, prev, endOf(fixes));

/**
 * A phone lying still. GPS keeps wandering a few metres in random directions —
 * this is the signal that fools a naive gate into showing a spinning arrow, and
 * it is exactly what a person standing on a corner waiting for you looks like.
 */
function stationary(n: number, t0 = 0): Fix[] {
  return Array.from({ length: n }, (_, i) => ({
    pos: offsetM(START, (i * 137) % 360, 3 + (i % 3)), // wanders 3–5 m, no pattern
    at: t0 + i * 1000,
    speed: 0.25, // what a still phone actually reports
    course: -1, // iOS: "I don't know"
    accuracy: 8,
  }));
}

describe('circularMeanDeg', () => {
  it('averages 350° and 10° to due north, NOT to 180°', () => {
    // the classic. (350 + 10) / 2 = 180, which points exactly backwards.
    expect(circularMeanDeg([350, 10])).toBeCloseTo(0, 5);
  });
  it('averages a noisy walk to its true bearing', () => {
    expect(circularMeanDeg([88, 95, 82, 91])).toBeCloseTo(89, 0);
  });
  it('has no answer for perfectly opposed samples rather than inventing one', () => {
    expect(circularMeanDeg([0, 180])).toBeNull();
  });
  it('has no answer for no samples', () => {
    expect(circularMeanDeg([])).toBeNull();
  });
});

describe('angleDeltaDeg', () => {
  it('measures the short way round', () => {
    expect(angleDeltaDeg(350, 10)).toBe(20);
    expect(angleDeltaDeg(10, 350)).toBe(20);
    expect(angleDeltaDeg(0, 180)).toBe(180);
  });
});

describe('sensed', () => {
  it('turns iOS’s -1 into null — it means "I don’t know", not "minus one"', () => {
    expect(sensed(-1)).toBeNull();
  });
  it('keeps a real zero, which is a speed and a bearing (due north)', () => {
    expect(sensed(0)).toBe(0);
  });
  it('passes real readings through', () => {
    expect(sensed(1.4)).toBe(1.4);
    expect(sensed(null)).toBeNull();
    expect(sensed(undefined)).toBeNull();
  });
});

describe('bearingOverLast — the trail IS the direction', () => {
  it('reads the course off the path when the platform gives none', () => {
    expect(bearingOverLast(stream(10, { bearing: 90 }), 12)).toBeCloseTo(90, 0);
  });
  it('says nothing until enough ground is covered to mean something', () => {
    expect(bearingOverLast(stream(3, { mps: 1.4 }), 12)).toBeNull(); // only 2.8 m
  });
});

describe('motionFrom: a direction is earned', () => {
  it('a walker earns one', () => {
    const m = run(stream(10, { bearing: 90 }));
    expect(m.moving).toBe(true);
    expect(m.heading).toBeCloseTo(90, 0);
    expect(m.speedMps).toBeCloseTo(1.4, 1);
  });

  it('a phone on a table does NOT — and null is not north', () => {
    const m = run(stationary(10));
    expect(m.moving).toBe(false);
    // the bug this whole module exists to prevent: a confident arrow pointing
    // due north because some default said 0
    expect(m.heading).toBeNull();
    expect(m.heading).not.toBe(0);
  });

  it('a single fix says nothing — one point has no direction', () => {
    expect(run(stream(1)).heading).toBeNull();
  });

  it('reads the course off the trail when the platform withholds one', () => {
    const m = run(stream(10, { bearing: 215, course: null }));
    expect(m.moving).toBe(true);
    expect(m.heading).toBeCloseTo(215, 0);
  });

  it('smooths a noisy course instead of letting the arrow twitch', () => {
    const wobble = [352, 8, 3, 357, 11, 350, 2, 6]; // real GPS jitter around north
    const fixes = stream(8, { bearing: 0 }).map((f, i) => ({ ...f, course: wobble[i] }));

    // lands on north, within a couple of degrees
    expect(angleDeltaDeg(run(fixes).heading!, 0)).toBeLessThan(3);

    // and here is why that took a circular mean: averaging these as plain
    // numbers gives 136°, which is south-east. The arrow would point at nothing.
    const naive = wobble.reduce((a, b) => a + b, 0) / wobble.length;
    expect(angleDeltaDeg(naive, 0)).toBeGreaterThan(130);
  });

  it('throws away fixes too vague to mean anything', () => {
    // 60 m accuracy: indoors, or a canyon. Every fix is junk, so we know nothing.
    const m = run(stream(10, { accuracy: 60 }));
    expect(m.moving).toBe(false);
    expect(m.heading).toBeNull();
  });

  it('still tracks a walker down a canyon, where accuracy is bad but Doppler isn’t', () => {
    // 30 m accuracy would sink a pure displacement gate — a pedestrian covers
    // only ~13 m in the window. The OS's own speed rescues them. Manhattan is
    // made of this case.
    const m = run(stream(10, { bearing: 45, accuracy: 30 }));
    expect(m.moving).toBe(true);
    expect(m.heading).toBeCloseTo(45, 0);
  });
});

describe('motionFrom: hysteresis — the flicker fix', () => {
  const walking = run(stream(10, { bearing: 0 }));

  it('starts only above the higher bar', () => {
    // 0.5 m/s is over the STOP threshold but under START: a fresh dawdle is not
    // yet motion
    expect(run(stream(10, { mps: 0.5 }), null).moving).toBe(false);
  });

  it('but keeps a mover moving through the same 0.5 m/s', () => {
    // ...and this is the whole point. One threshold would flip here, and at a
    // crosswalk it flips several times a minute — each flip re-rendering the
    // marker's custom view, which is how Apple Maps loses a puck.
    expect(walking.moving).toBe(true);
    const dawdle = run(stream(10, { mps: 0.5, t0: 10_000 }), walking);
    expect(dawdle.moving).toBe(true);
  });

  it('lets go when they actually stop', () => {
    const stopped = run(stationary(10, 10_000), walking);
    expect(stopped.moving).toBe(false);
  });
});

describe('motionFrom: paused, then still', () => {
  const walking = run(stream(10, { bearing: 270 }));

  it('holds the course across a pause — someone at a light is still headed west', () => {
    const atTheLight = motionFrom(stationary(6, 10_000), walking, 16_000);
    expect(atTheLight.moving).toBe(false);
    expect(atTheLight.heading).toBeCloseTo(270, 0); // dimmed on the map, not gone
  });

  it('drops it once holding on would be a lie', () => {
    const longGone = motionFrom(
      stationary(6, 10_000),
      walking,
      walking.headingAt + HEADING_HOLD_MS + 1
    );
    expect(longGone.heading).toBeNull();
  });

  it('a member who goes silent loses their arrow as their fixes age out', () => {
    // no new fixes at all — four minutes later, the puck must not still be
    // pointing somewhere on the strength of a fix from before
    const silent = motionFrom(walking ? stream(10, { bearing: 270 }) : [], walking, 240_000);
    expect(silent.moving).toBe(false);
    expect(silent.heading).toBeNull();
  });
});

describe('pushFix', () => {
  it('keeps recent history and drops the rest', () => {
    let fixes: Fix[] = [];
    for (let i = 0; i < 100; i++) {
      fixes = pushFix(fixes, { pos: START, at: i * 1000 });
    }
    expect(fixes.length).toBeLessThanOrEqual(32);
    expect(fixes[fixes.length - 1].at).toBe(99_000);
    expect(fixes.every((f) => f.at > 99_000 - 20_000)).toBe(true);
  });
});
