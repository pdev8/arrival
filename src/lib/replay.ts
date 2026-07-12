import { LatLng, lerp, pointAlongRoute, routeSlice } from './geo';

/** Apple Maps drops 2-point polylines (react-native-maps #5285), so a chunk is
 *  only renderable once it has at least three points. */
export const MIN_POLYLINE_POINTS = 3;

export interface ReplayFrame {
  /** Where the member is at this instant — interpolated, so the puck glides. */
  head: LatLng | null;
  traveledM: number;
  totalM: number;
}

/** One fixed piece of a trail. `pts` NEVER changes once built. */
export interface ReplayChunk {
  pts: LatLng[];
  /** Distance along the trail at this chunk's far end. Once the member has
   *  travelled past it, the chunk is "walked" and switches to full color. */
  endM: number;
}

/**
 * A single instant of a retrace: where the member had got to at `progress` (0..1).
 */
export function replayFrameAt(trail: LatLng[], cum: number[], progress: number): ReplayFrame {
  const totalM = cum.length ? cum[cum.length - 1] : 0;
  if (trail.length < 2 || totalM <= 0) {
    return { head: trail[0] ?? null, traveledM: 0, totalM };
  }

  const clamped = Math.max(0, Math.min(1, progress));
  const traveledM = totalM * clamped;

  return { head: pointAlongRoute(trail, cum, traveledM).pos, traveledM, totalM };
}

/**
 * Cut a trail into `count` distance-equal chunks, once, up front.
 *
 * This is the whole trick behind the retrace. Animating a *growing* polyline
 * hands MapKit a new `coordinates` array on every tick, and it rebuilds the
 * overlay renderer each time — which never settles long enough to stroke the
 * dash pattern, so a dotted trail either fails to paint or paints all at once.
 *
 * Chunks sidestep that completely: the geometry is static and only each chunk's
 * *stroke color* flips from ghost to solid as the head passes it. A color change
 * doesn't touch the path, so the dots keep rendering exactly as they do on the
 * static trails elsewhere in the app — they just light up in sequence.
 */
export function buildReplayChunks(trail: LatLng[], cum: number[], count: number): ReplayChunk[] {
  const totalM = cum.length ? cum[cum.length - 1] : 0;
  if (trail.length < 2 || totalM <= 0 || count < 1) return [];

  const chunks: ReplayChunk[] = [];
  for (let i = 0; i < count; i++) {
    const fromM = (totalM * i) / count;
    const endM = (totalM * (i + 1)) / count;
    const pts = renderable(routeSlice(trail, cum, fromM, endM));
    if (pts.length) chunks.push({ pts, endM });
  }
  return chunks;
}

/** Whether a chunk has been walked at `traveledM` — i.e. should be lit up. */
export function isChunkWalked(chunk: ReplayChunk, traveledM: number): boolean {
  return chunk.endM <= traveledM;
}

/**
 * Keep a chunk renderable. A chunk that runs along a straight stretch of street
 * comes back from `routeSlice` as just its two endpoints, and Apple Maps refuses
 * to draw a 2-point polyline, so the midpoint is synthesized. A zero-length chunk
 * is dropped — three copies of one coordinate is a degenerate overlay, not a line.
 */
function renderable(pts: LatLng[]): LatLng[] {
  if (pts.length >= MIN_POLYLINE_POINTS) return pts;
  if (pts.length < 2) return [];

  const [start, end] = [pts[0], pts[pts.length - 1]];
  if (start.latitude === end.latitude && start.longitude === end.longitude) return [];
  return [start, lerp(start, end, 0.5), end];
}
