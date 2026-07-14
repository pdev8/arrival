import { LatLng, bearingDeg, distanceM } from './geo';

/**
 * DIRECTION IS THE WAY YOU ARE MOVING — never the way the phone is pointing.
 *
 * A phone rides in a back pocket, a purse, a swinging hand. Its compass
 * (CLHeading — expo-location's `watchHeadingAsync`) reports where the DEVICE
 * faces, which in a back pocket is your backside, in a bag is wherever the bag
 * last swung, and in your hand is wherever you happen to be looking, which is
 * usually at the screen and not down the street. It is worse than useless on a
 * group map, and we never read it.
 *
 * What we read is COURSE OVER GROUND (CLLocation.course, which reaches us as
 * `coords.heading` from `watchPositionAsync`): the bearing between successive
 * fixes — the direction your BODY is travelling. Pocket, bag or hand, it is
 * the same number, because the body carries the phone and the body is what
 * moves. That is the whole reason it is the right sensor.
 *
 * Course has one honest property a compass doesn't: WHEN YOU STOP, IT CEASES
 * TO EXIST. iOS says so out loud — it reports -1. A stationary phone's GPS
 * still wanders a few metres a second, so anything that insists on a direction
 * while you stand still is showing noise dressed up as fact: a needle that
 * spins, or worse, a confident arrow pointing due north because some default
 * said `0`.
 *
 * So a direction is EARNED, and this module is the gate that decides whether
 * it has been. Demo and live both go through it — the demo synthesizes noisy
 * fixes (see demo/sensor.ts) for exactly that reason, because an environment
 * that can't reproduce the bug can't prove the fix.
 */

/** One position report — from a real GPS receiver, or the demo's stand-in. */
export interface Fix {
  pos: LatLng;
  /**
   * ms epoch, stamped by whoever RECEIVED it — never by the sender. Two phones'
   * clocks disagree by seconds or minutes, and this number divides into a
   * distance to make a speed.
   */
  at: number;
  /** m/s, if the platform offered one. iOS reports -1 for "I don't know". */
  speed?: number | null;
  /** course over ground in degrees. iOS reports -1 for "I don't know". */
  course?: number | null;
  /** horizontal accuracy in metres — bigger is worse. */
  accuracy?: number | null;
}

export interface Motion {
  /** genuinely travelling. Hysteretic, so it does not chatter at the threshold. */
  moving: boolean;
  /** m/s */
  speedMps: number;
  /**
   * Course over ground in degrees (0 = north), or NULL when we have no honest
   * answer. Null is not "north" and not "zero" — it means the puck must show no
   * direction at all, and the absence is itself the information: they are not
   * going anywhere.
   */
  heading: number | null;
  /** `at` of the fix `heading` came from — drives the hold-then-drop below */
  headingAt: number;
}

export const STILL: Motion = { moving: false, speedMps: 0, heading: null, headingAt: 0 };

/** Enter "moving". A slow walk is ~1.2 m/s; a stationary phone's GPS fakes ~0.3. */
export const START_MPS = 0.7;
/**
 * Leave "moving". The GAP between this and START_MPS is the entire anti-flicker
 * mechanism. A single threshold chatters every time a real walker's speed
 * crosses it — which at a crosswalk is several times a minute — and each flip
 * re-renders the marker's custom view, which is how Apple Maps loses pucks.
 */
export const STOP_MPS = 0.35;
/** ...and you must have actually gone somewhere. One bad fix can fake a speed. */
const MIN_SPAN_M = 8;
/** A fix this vague (indoors, a canyon between towers) can't tell us anything. */
const MAX_ACCURACY_M = 35;
/** how far back we look for displacement and course */
const WINDOW_MS = 10_000;
/** a bearing needs this much travel behind it to mean anything */
const COURSE_SPAN_M = 12;
/**
 * Someone waiting at a light is still "heading north", so we hold their course
 * across a pause. Past this, insisting on it is a lie — drop it.
 */
export const HEADING_HOLD_MS = 45_000;
/** what we assume when the provider won't say */
const ASSUMED_ACCURACY_M = 10;

const mean = (ns: number[]) => ns.reduce((a, b) => a + b, 0) / ns.length;

/**
 * The mean of a set of angles.
 *
 * You CANNOT average degrees arithmetically. The mean of 350° and 10° is 0° —
 * due north — but (350 + 10) / 2 is 180°, which is exactly backwards. Average
 * the unit vectors instead and take the angle of the result.
 */
export function circularMeanDeg(degs: number[]): number | null {
  if (degs.length === 0) return null;
  let x = 0;
  let y = 0;
  for (const d of degs) {
    const r = (d * Math.PI) / 180;
    x += Math.cos(r);
    y += Math.sin(r);
  }
  // Perfectly opposed samples cancel: there is no mean direction, and inventing
  // one would be fiction.
  if (Math.hypot(x, y) < 1e-9) return null;
  return ((Math.atan2(y, x) * 180) / Math.PI + 360) % 360;
}

/** Smallest angle between two bearings, 0–180. */
export function angleDeltaDeg(a: number, b: number): number {
  const d = Math.abs(((a - b) % 360) + 360) % 360;
  return d > 180 ? 360 - d : d;
}

/**
 * Bearing over the last `minSpanM` of travel.
 *
 * THE TRAIL *IS* THE DIRECTION — the path we already keep for every member is a
 * pre-smoothed, provider-independent course, and it works identically for you,
 * for a remote member three blocks away, and in the demo. It is the fallback
 * whenever the platform won't give us a course, and it needs no new wire field.
 */
export function bearingOverLast(fixes: Fix[], minSpanM: number): number | null {
  const last = fixes[fixes.length - 1];
  if (!last) return null;
  for (let i = fixes.length - 2; i >= 0; i--) {
    if (distanceM(fixes[i].pos, last.pos) >= minSpanM) return bearingDeg(fixes[i].pos, last.pos);
  }
  return null;
}

/** Keep just enough history for the gate's window; drop the rest. */
export function pushFix(fixes: Fix[], f: Fix, keepMs = 2 * WINDOW_MS, cap = 32): Fix[] {
  const next = [...fixes, f].filter((x) => x.at > f.at - keepMs);
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/**
 * The gate. Given recent fixes and what we believed a moment ago, decide
 * whether this person is travelling and — only if they are — which way.
 *
 * Pure, so the whole thing is testable without a phone: feed it a sequence and
 * assert what a walker, a stander, and a phone on a table each get.
 */
export function motionFrom(fixes: Fix[], prev: Motion | null, now: number): Motion {
  const usable = fixes.filter(
    (f) => f.at > now - WINDOW_MS && (f.accuracy == null || f.accuracy <= MAX_ACCURACY_M)
  );
  if (usable.length < 2) return decay(prev, now);

  const first = usable[0];
  const last = usable[usable.length - 1];
  const spanM = distanceM(first.pos, last.pos);
  const dtSec = (last.at - first.at) / 1000;

  const speeds = usable.map((f) => f.speed).filter((s): s is number => s != null && s >= 0);
  const speedMps = speeds.length ? mean(speeds) : dtSec > 0 ? spanM / dtSec : 0;

  const accs = usable.map((f) => f.accuracy).filter((a): a is number => a != null && a >= 0);
  const accuracyM = accs.length ? mean(accs) : ASSUMED_ACCURACY_M;

  // YOU MUST OUT-TRAVEL YOUR OWN ERROR — but only when your own error is the
  // thing you're measuring with. A phone lying on a table wanders several metres,
  // so if we're deriving speed by differencing noisy fixes, "how far you went"
  // has to clear "how wrong we might be" or you went nowhere.
  //
  // When the OS hands us a speed, though, it comes off Doppler, which stays
  // honest exactly where position doesn't — down a canyon between towers, where
  // accuracy reads 30 m and a pedestrian would otherwise NEVER clear the bar and
  // never get an arrow. Manhattan is made of that case.
  const needM = speeds.length ? MIN_SPAN_M : Math.max(MIN_SPAN_M, accuracyM);

  const moving = prev?.moving
    ? speedMps >= STOP_MPS && spanM >= needM * 0.4
    : speedMps >= START_MPS && spanM >= needM;

  if (!moving) return { ...decay(prev, now), speedMps };

  const fresh = sensedCourse(usable) ?? bearingOverLast(usable, COURSE_SPAN_M);
  if (fresh == null) {
    // Moving, but nothing yet says which way (a provider with no course, a
    // driver's first two fixes). Keep what we had rather than invent north.
    return { moving, speedMps, heading: prev?.heading ?? null, headingAt: prev?.headingAt ?? 0 };
  }
  return { moving, speedMps, heading: fresh, headingAt: last.at };
}

/**
 * Not moving. Hold the last course for a while — someone at a crosswalk is
 * still headed north — then let it go, because by then it isn't true any more.
 */
function decay(prev: Motion | null, now: number): Motion {
  if (!prev || prev.heading == null) return STILL;
  const stale = now - prev.headingAt > HEADING_HOLD_MS;
  return {
    moving: false,
    speedMps: 0,
    heading: stale ? null : prev.heading,
    headingAt: stale ? 0 : prev.headingAt,
  };
}

/**
 * The platform's own course, averaged over the window. Fixes taken below the
 * stop threshold are excluded: iOS keeps repeating the last course for a beat
 * after you stop, and that stale value would drag the mean.
 */
function sensedCourse(fixes: Fix[]): number | null {
  const courses = fixes
    .filter((f) => f.course != null && f.course >= 0 && (f.speed == null || f.speed >= STOP_MPS))
    .map((f) => f.course as number);
  return circularMeanDeg(courses);
}

/**
 * Normalize one raw platform reading. iOS reports **-1** — not null — for a
 * speed or course it cannot determine, and -1 sails straight through a
 * `!= null` check to become a real-looking number downstream.
 */
export function sensed(n: number | null | undefined): number | null {
  return n == null || n < 0 ? null : n;
}
