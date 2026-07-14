import { LatLng, distanceM } from '../lib/geo';
import { Fix, Motion, STILL, motionFrom, pushFix, sensed } from '../lib/motion';
import { MemberState } from '../demo/simulation';

/**
 * SPEC §5.3 thresholds, but the walking/stopped line is drawn by the motion
 * gate (lib/motion), not by a bare speed comparison. That matters: a single
 * threshold on raw GPS speed flips several times a minute at a crosswalk, and
 * every flip re-renders the marker's custom view — which is how Apple Maps
 * loses pucks. The gate's hysteresis is what makes this state stable enough to
 * put on the map.
 */
export function stateFromMotion(m: Motion, arrived: boolean): MemberState {
  if (arrived) return 'arrived';
  if (!m.moving) return 'stopped';
  return m.speedMps > 6 ? 'driving' : 'walking';
}

/** Straight-line ETA fallback (SPEC D5) until the Routes API lands (C5). */
export function straightLineEtaMin(pos: LatLng, dest: LatLng, speedMps: number | null): number {
  const remaining = distanceM(pos, dest);
  const speed = speedMps && speedMps > 0.5 ? speedMps : 1.4; // default walking pace
  return remaining / speed / 60;
}

/** Append a fix to a trail, skipping GPS jitter under `minStepM`; capped. */
export function appendToTrail(trail: LatLng[], pos: LatLng, minStepM = 4, cap = 600): LatLng[] {
  const last = trail[trail.length - 1];
  if (last && distanceM(last, pos) < minStepM) return trail;
  const next = [...trail, pos];
  return next.length > cap ? next.slice(next.length - cap) : next;
}

/** Total meters along a trail — steps and traveled distance derive from it. */
export function trailDistanceM(trail: LatLng[]): number {
  let sum = 0;
  for (let i = 1; i < trail.length; i++) sum += distanceM(trail[i - 1], trail[i]);
  return sum;
}

/** average walking stride, meters — live steps are derived, not sensed */
export const STRIDE_M = 0.75;

/** The motion state tracked per live member (identity fields live upstream). */
export interface Tracked {
  pos: LatLng | null;
  /**
   * What the gate makes of their recent fixes. Direction and speed live HERE
   * and nowhere else — there is no raw `heading` field to accidentally default
   * to 0, which is due north, which is a lie about someone who has never moved.
   */
  motion: Motion;
  /** their recent fixes, stamped on OUR clock — the gate's only input */
  fixes: Fix[];
  trail: LatLng[];
  /** remaining distance at first fix — the denominator for progress */
  firstRemainingM: number | null;
  arrived: boolean;
  /** ms epoch of the freshest applied update (broadcast or snapshot) */
  lastAt: number;
}

export const blankTracked = (): Tracked => ({
  pos: null,
  motion: STILL,
  fixes: [],
  trail: [],
  firstRemainingM: null,
  arrived: false,
  lastAt: 0,
});

export interface Snapshot {
  pos: LatLng | null;
  /** ms epoch of the snapshot row's last_updated_at (0 when absent) */
  at: number;
  heading: number | null;
  speed: number | null;
  /** the row's persisted state says arrived */
  arrivedState: boolean;
}

/**
 * Fresher-wins merge of a DB roster snapshot into locally tracked motion.
 * The snapshot wins when it's all we have or newer than the last applied
 * broadcast; otherwise live state stands. (This rule is why a host who
 * missed the join broadcast still sees the joiner: the 10s snapshot lands
 * and outranks nothing.) Arrival latches — once arrived, always arrived.
 *
 * The gate runs on EVERY call, snapshot used or not, because a member who has
 * gone quiet has to lose their direction: their fixes age out of the window and
 * the held course decays. A puck that keeps pointing somewhere on the strength
 * of a fix from four minutes ago is the exact lie we're here to prevent.
 */
export function mergeSnapshot(
  existing: Tracked | undefined,
  snap: Snapshot,
  /** null = free roam: nowhere to arrive, nothing to measure against */
  destPos: LatLng | null,
  arriveRadiusM: number,
  now: number
): Tracked {
  const useSnap = !!snap.pos && (!existing?.pos || snap.at > (existing?.lastAt ?? 0));
  const pos = useSnap ? snap.pos : (existing?.pos ?? null);

  // Snapshot fixes are stamped with OUR clock, not `last_updated_at` — that
  // timestamp comes off the Postgres server, and mixing two clocks in a series
  // we divide distances by would invent speeds out of nothing.
  const fixes =
    useSnap && snap.pos
      ? pushFix(existing?.fixes ?? [], {
          pos: snap.pos,
          at: now,
          speed: sensed(snap.speed),
          course: sensed(snap.heading),
          accuracy: null,
        })
      : (existing?.fixes ?? []);

  return {
    pos,
    fixes,
    motion: motionFrom(fixes, existing?.motion ?? null, now),
    trail: useSnap && snap.pos ? appendToTrail(existing?.trail ?? [], snap.pos) : (existing?.trail ?? []),
    firstRemainingM: existing?.firstRemainingM ?? (pos && destPos ? distanceM(pos, destPos) : null),
    arrived:
      (existing?.arrived ?? false) ||
      snap.arrivedState ||
      (!!pos && !!destPos && distanceM(pos, destPos) <= arriveRadiusM),
    lastAt: useSnap ? snap.at : (existing?.lastAt ?? 0),
  };
}

/** What one member's position broadcast carries. `heading` is COURSE OVER
 *  GROUND as the sender's OS reported it — raw, un-gated, possibly nonsense.
 *  Every receiver gates it themselves, so everyone judges everyone by the same
 *  rule and no one has to trust the sender's filtering. */
export interface PosWire {
  lat: number;
  lng: number;
  heading: number | null;
  speed: number | null;
  /** horizontal accuracy in metres. Absent from older clients — then unknown. */
  acc?: number | null;
}

/** A live position broadcast applied to tracked motion. Broadcasts are the
 *  freshest source by definition, so they always win. */
export function applyBroadcast(
  m: Tracked,
  p: PosWire,
  /** null = free roam */
  destPos: LatLng | null,
  arriveRadiusM: number,
  now: number
): Tracked {
  const pos = { latitude: p.lat, longitude: p.lng };
  const fixes = pushFix(m.fixes, {
    pos,
    at: now,
    speed: sensed(p.speed),
    course: sensed(p.heading),
    accuracy: sensed(p.acc),
  });
  return {
    pos,
    fixes,
    motion: motionFrom(fixes, m.motion, now),
    trail: appendToTrail(m.trail, pos),
    firstRemainingM: m.firstRemainingM ?? (destPos ? distanceM(pos, destPos) : null),
    arrived: m.arrived || (!!destPos && distanceM(pos, destPos) <= arriveRadiusM),
    lastAt: now,
  };
}

/**
 * Tracked motion → the Simulation-shape fields the UI reads (heading, moving,
 * state, mode, eta, steps, progress). Requires a position — callers filter
 * posless members out before mapping.
 */
export function simMotion(m: Tracked, destPos: LatLng | null) {
  const pos = m.pos!;
  const traveledM = trailDistanceM(m.trail);
  const state = stateFromMotion(m.motion, m.arrived);
  const mode = state === 'driving' ? ('car' as const) : ('foot' as const);
  const steps = mode === 'foot' ? Math.round(traveledM / STRIDE_M) : 0;
  // null heading reaches the UI as null. It is not 0, and 0 is not "unknown" —
  // it is due north, and a puck that confidently points north is worse than a
  // puck that admits it doesn't know.
  const heading = m.motion.heading;
  const moving = m.motion.moving;

  // FREE ROAM: nowhere to be. Distance-to-go, ETA and progress are not "zero",
  // they're meaningless — the UI reads etaMin == null and shows what the
  // session IS about instead: distance covered and steps.
  if (!destPos) {
    return { heading, moving, state, mode, remainingM: 0, traveledM, etaMin: null, steps, progress: 0 };
  }

  const remainingM = Math.max(0, distanceM(pos, destPos));
  const first = m.firstRemainingM ?? remainingM;
  return {
    heading,
    moving,
    state,
    mode,
    remainingM,
    traveledM,
    // the gate's smoothed speed, not the last raw fix — one bad sample used to
    // swing the ETA by minutes
    etaMin: m.arrived ? 0 : straightLineEtaMin(pos, destPos, moving ? m.motion.speedMps : null),
    steps,
    progress: first > 0 ? Math.min(1, 1 - remainingM / first) : 1,
  };
}
