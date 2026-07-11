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
