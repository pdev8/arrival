export interface LatLng {
  latitude: number;
  longitude: number;
}

const R = 6371000; // earth radius, meters
const toRad = (d: number) => (d * Math.PI) / 180;
const toDeg = (r: number) => (r * 180) / Math.PI;

export function distanceM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLng = toRad(b.longitude - a.longitude);
  const s =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(s));
}

/** Bearing from a to b in degrees, 0 = north, clockwise. */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const dλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(dλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(dλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

export function lerp(a: LatLng, b: LatLng, t: number): LatLng {
  return {
    latitude: a.latitude + (b.latitude - a.latitude) * t,
    longitude: a.longitude + (b.longitude - a.longitude) * t,
  };
}

/** Cumulative distance (meters) at each waypoint of a route. */
export function cumulativeDistances(route: LatLng[]): number[] {
  const cum = [0];
  for (let i = 1; i < route.length; i++) {
    cum.push(cum[i - 1] + distanceM(route[i - 1], route[i]));
  }
  return cum;
}

/** Position + segment heading at `atM` meters along a route. */
export function pointAlongRoute(
  route: LatLng[],
  cum: number[],
  atM: number
): { pos: LatLng; heading: number } {
  const total = cum[cum.length - 1];
  const m = Math.max(0, Math.min(atM, total));
  let i = 1;
  while (i < cum.length - 1 && cum[i] < m) i++;
  const segLen = cum[i] - cum[i - 1] || 1;
  const t = (m - cum[i - 1]) / segLen;
  return {
    pos: lerp(route[i - 1], route[i], t),
    heading: bearingDeg(route[i - 1], route[i]),
  };
}

/**
 * Chaikin corner-cutting: rounds sharp polyline corners into smooth curves
 * while preserving endpoints. Two iterations ≈ visually continuous turns.
 */
export function chaikinSmooth(route: LatLng[], iterations = 2): LatLng[] {
  let pts = route;
  for (let it = 0; it < iterations; it++) {
    const out: LatLng[] = [pts[0]];
    for (let i = 0; i < pts.length - 1; i++) {
      out.push(lerp(pts[i], pts[i + 1], 0.25), lerp(pts[i], pts[i + 1], 0.75));
    }
    out.push(pts[pts.length - 1]);
    pts = out;
  }
  return pts;
}

/**
 * The stretch of a route between `fromM` and `toM` meters: every waypoint in
 * between, with exact interpolated endpoints. Used for breadcrumb trails.
 */
export function routeSlice(route: LatLng[], cum: number[], fromM: number, toM: number): LatLng[] {
  const total = cum[cum.length - 1];
  const a = Math.max(0, Math.min(fromM, total));
  const b = Math.max(a, Math.min(toM, total));
  const pts: LatLng[] = [pointAlongRoute(route, cum, a).pos];
  for (let i = 0; i < route.length; i++) {
    if (cum[i] > a && cum[i] < b) pts.push(route[i]);
  }
  pts.push(pointAlongRoute(route, cum, b).pos);
  return pts;
}

/**
 * Heading via central difference: bearing from a point slightly behind to a
 * point slightly ahead, so the arrow sweeps smoothly through turns instead
 * of snapping segment to segment.
 */
export function headingAlongRoute(route: LatLng[], cum: number[], atM: number, lookM: number): number {
  const total = cum[cum.length - 1];
  const behind = pointAlongRoute(route, cum, Math.max(0, atM - lookM)).pos;
  const ahead = pointAlongRoute(route, cum, Math.min(total, atM + lookM)).pos;
  return bearingDeg(behind, ahead);
}

/** Floor relative to street as a compact chip label: -1 → "B1", 2 → "F2". */
export function formatLevel(level: number): string {
  return level < 0 ? `B${-level}` : `F${level}`;
}

/** Bearing → 8-wind compass direction ("NE"), for "0.4 mi NE of you" lines. */
export function compassDir(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/** ETA as a live countdown clock: m:ss, or h:mm:ss beyond an hour. */
export function formatEtaClock(minutes: number): string {
  const totalSec = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function formatDistance(meters: number): string {
  const mi = meters / 1609.34;
  if (mi < 0.19) return `${Math.round(meters * 3.281)} ft`;
  return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
}
