export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface MapRegion extends LatLng {
  latitudeDelta: number;
  longitudeDelta: number;
}

export interface MapBounds {
  northEast: LatLng;
  southWest: LatLng;
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

/** Clamp the visible edges of a map region to a geographic boundary. */
export function constrainMapRegion(region: MapRegion, bounds: MapBounds): MapRegion {
  const halfLat = region.latitudeDelta / 2;
  const halfLng = region.longitudeDelta / 2;
  const minLatitude = bounds.southWest.latitude + halfLat;
  const maxLatitude = bounds.northEast.latitude - halfLat;
  const minLongitude = bounds.southWest.longitude + halfLng;
  const maxLongitude = bounds.northEast.longitude - halfLng;

  const latitude =
    minLatitude <= maxLatitude
      ? Math.max(minLatitude, Math.min(region.latitude, maxLatitude))
      : (bounds.southWest.latitude + bounds.northEast.latitude) / 2;
  const longitude =
    minLongitude <= maxLongitude
      ? Math.max(minLongitude, Math.min(region.longitude, maxLongitude))
      : (bounds.southWest.longitude + bounds.northEast.longitude) / 2;

  return { ...region, latitude, longitude };
}

/**
 * True once the viewport is meaningfully tighter than its boundary — i.e. the
 * user has zoomed past the default frame. Panning is a zoomed-in affordance
 * only: at the default frame the map is pinned, so there is nothing to pan to.
 * The tolerance absorbs the sub-percent jitter a settled camera reports.
 */
export function isZoomedInside(region: MapRegion, bounds: MapBounds, tolerance = 0.98): boolean {
  const latSpan = bounds.northEast.latitude - bounds.southWest.latitude;
  const lngSpan = bounds.northEast.longitude - bounds.southWest.longitude;
  if (latSpan <= 0 || lngSpan <= 0) return false;
  return region.latitudeDelta < latSpan * tolerance && region.longitudeDelta < lngSpan * tolerance;
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
