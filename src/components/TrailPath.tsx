import React, { useMemo, useRef } from 'react';
import { Polyline } from 'react-native-maps';
import { SimMember } from '../demo/simulation';
import { LatLng, cumulativeDistances, lerp, routeSlice } from '../lib/geo';

/** the trail is drawn in this many alpha steps, faint start → solid head */
const PARTS = 3;
const ALPHAS = [0.3, 0.55, 0.85];
/** rebuild the polylines only every this many meters of new travel — trails
 *  are breadcrumbs, not a live wire; this keeps overlay churn off the 4 Hz tick */
const UPDATE_M = 20;

/**
 * A member's trail as dotted native polylines — drawn by the map's overlay
 * renderer, NOT the annotation (marker) system. This is deliberate: hundreds
 * of churning trail markers aggravated an Apple Maps + New Architecture bug
 * (react-native-maps #5911) that drops OTHER markers' custom views — the
 * profile pucks. Overlays can't touch that path.
 *
 * Apple Maps dash patterns are specified in screen points and zoom-
 * compensated by MapKit, so dot size/spacing stay constant at every zoom —
 * the zoom-adaptive thinning the marker version hand-rolled comes for free.
 *
 * The faint-start → solid-head opacity ramp is approximated with PARTS
 * solid-alpha segments. Never add strokeColors here: the gradient renderer
 * (AIRMapPolylineRenderer) breaks dash scaling and doubles stroke width.
 */
export function TrailPath({ member }: { member: SimMember }) {
  // quantize updates: recompute segments only after ~UPDATE_M of new travel
  const bucket = Math.floor(member.traveledM / UPDATE_M);
  const trailRef = useRef(member.trail);
  trailRef.current = member.trail;
  const segs = useMemo(
    () => buildSegments(trailRef.current),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [bucket, member.id]
  );

  const foot = member.mode === 'foot';
  return (
    <>
      {segs.map((pts, i) => (
        <Polyline
          key={`${member.id}-seg-${i}`}
          coordinates={pts}
          strokeColor={`${member.color}${alphaHex(ALPHAS[i] ?? 0.85)}`}
          strokeWidth={foot ? 5 : 3.5}
          lineCap="round"
          lineJoin="round"
          // foot: near-zero dash + round cap = a dot every 11pt on screen
          lineDashPattern={foot ? [0.1, 11] : [8, 6]}
          zIndex={4}
        />
      ))}
    </>
  );
}

const alphaHex = (a: number) =>
  Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');

/** Split the trail into PARTS distance-equal chunks, each safe to render:
 *  Apple Maps silently drops 2-point polylines (#5285), so pad with a midpoint. */
function buildSegments(trail: LatLng[]): LatLng[][] {
  if (trail.length < 2) return [];
  const cum = cumulativeDistances(trail);
  const total = cum[cum.length - 1];
  if (total <= 1) return [];
  const segs: LatLng[][] = [];
  for (let p = 0; p < PARTS; p++) {
    const pts = routeSlice(trail, cum, (total * p) / PARTS, (total * (p + 1)) / PARTS);
    if (pts.length === 2) pts.splice(1, 0, lerp(pts[0], pts[1], 0.5));
    if (pts.length >= 3) segs.push(pts);
  }
  return segs;
}
