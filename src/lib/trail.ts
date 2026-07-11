import { LatLng, cumulativeDistances, lerp, routeSlice } from './geo';

/** the trail is drawn in this many alpha steps, faint start → solid head */
export const TRAIL_PARTS = 3;
export const TRAIL_ALPHAS = [0.3, 0.55, 0.85];

/**
 * Split a trail into TRAIL_PARTS distance-equal chunks, each safe to render
 * as an Apple Maps polyline: 2-point polylines are silently dropped
 * (react-native-maps #5285), so short chunks get a midpoint injected.
 */
export function buildSegments(trail: LatLng[]): LatLng[][] {
  if (trail.length < 2) return [];
  const cum = cumulativeDistances(trail);
  const total = cum[cum.length - 1];
  if (total <= 1) return [];
  const segs: LatLng[][] = [];
  for (let p = 0; p < TRAIL_PARTS; p++) {
    const pts = routeSlice(trail, cum, (total * p) / TRAIL_PARTS, (total * (p + 1)) / TRAIL_PARTS);
    if (pts.length === 2) pts.splice(1, 0, lerp(pts[0], pts[1], 0.5));
    if (pts.length >= 3) segs.push(pts);
  }
  return segs;
}

/** 0..1 alpha → 2-digit hex suffix for #RRGGBBAA colors */
export const alphaHex = (a: number) =>
  Math.round(a * 255)
    .toString(16)
    .padStart(2, '0');
