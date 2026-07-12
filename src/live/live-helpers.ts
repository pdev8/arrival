import { LatLng, distanceM } from '../lib/geo';
import { MemberState } from '../demo/simulation';

/** SPEC §5.3 thresholds: driving > ~6 m/s, walking 0.5–6, stopped below. */
export function stateFromSpeed(speedMps: number | null, arrived: boolean): MemberState {
  if (arrived) return 'arrived';
  if (speedMps == null || speedMps < 0.5) return 'stopped';
  return speedMps > 6 ? 'driving' : 'walking';
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
  heading: number;
  speed: number | null;
  trail: LatLng[];
  /** remaining distance at first fix — the denominator for progress */
  firstRemainingM: number | null;
  arrived: boolean;
  /** ms epoch of the freshest applied update (broadcast or snapshot) */
  lastAt: number;
}

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
 */
export function mergeSnapshot(
  existing: Tracked | undefined,
  snap: Snapshot,
  destPos: LatLng,
  arriveRadiusM: number
): Tracked {
  const useSnap = !!snap.pos && (!existing?.pos || snap.at > (existing?.lastAt ?? 0));
  const pos = useSnap ? snap.pos : (existing?.pos ?? null);
  return {
    pos,
    heading: useSnap ? (snap.heading ?? existing?.heading ?? 0) : (existing?.heading ?? snap.heading ?? 0),
    speed: useSnap ? (snap.speed ?? null) : (existing?.speed ?? snap.speed ?? null),
    trail: useSnap && snap.pos ? appendToTrail(existing?.trail ?? [], snap.pos) : (existing?.trail ?? []),
    firstRemainingM: existing?.firstRemainingM ?? (pos ? distanceM(pos, destPos) : null),
    arrived:
      (existing?.arrived ?? false) ||
      snap.arrivedState ||
      (!!pos && distanceM(pos, destPos) <= arriveRadiusM),
    lastAt: useSnap ? snap.at : (existing?.lastAt ?? 0),
  };
}

/** A live position broadcast applied to tracked motion. Broadcasts are the
 *  freshest source by definition, so they always win. */
export function applyBroadcast(
  m: Tracked,
  p: { lat: number; lng: number; heading: number | null; speed: number | null },
  destPos: LatLng,
  arriveRadiusM: number,
  now: number
): Tracked {
  const pos = { latitude: p.lat, longitude: p.lng };
  return {
    pos,
    heading: p.heading ?? m.heading,
    speed: p.speed,
    trail: appendToTrail(m.trail, pos),
    firstRemainingM: m.firstRemainingM ?? distanceM(pos, destPos),
    arrived: m.arrived || distanceM(pos, destPos) <= arriveRadiusM,
    lastAt: now,
  };
}

/**
 * Tracked motion → the Simulation-shape fields the UI reads (state, mode,
 * eta, steps, progress). Requires a position — callers filter posless
 * members out before mapping.
 */
export function simMotion(m: Tracked, destPos: LatLng) {
  const pos = m.pos!;
  const remainingM = Math.max(0, distanceM(pos, destPos));
  const traveledM = trailDistanceM(m.trail);
  const state = stateFromSpeed(m.speed, m.arrived);
  const mode = state === 'driving' ? ('car' as const) : ('foot' as const);
  const first = m.firstRemainingM ?? remainingM;
  return {
    state,
    mode,
    remainingM,
    traveledM,
    etaMin: m.arrived ? 0 : straightLineEtaMin(pos, destPos, m.speed),
    steps: mode === 'foot' ? Math.round(traveledM / STRIDE_M) : 0,
    progress: first > 0 ? Math.min(1, 1 - remainingM / first) : 1,
  };
}
