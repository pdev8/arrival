import { cumulativeDistances } from './geo';
import {
  MIN_POLYLINE_POINTS,
  buildReplayChunks,
  isChunkWalked,
  replayFrameAt,
} from './replay';

// A straight 3-leg run north, ~111 m per 0.001°.
const TRAIL = [
  { latitude: 40.73, longitude: -73.99 },
  { latitude: 40.731, longitude: -73.99 },
  { latitude: 40.732, longitude: -73.99 },
  { latitude: 40.733, longitude: -73.99 },
];
const CUM = cumulativeDistances(TRAIL);
const TOTAL = CUM[CUM.length - 1];

describe('replayFrameAt', () => {
  it('parks the head on the origin at the start', () => {
    const frame = replayFrameAt(TRAIL, CUM, 0);
    expect(frame.head).toEqual(TRAIL[0]);
    expect(frame.traveledM).toBe(0);
  });

  it('lands the head on the last point at the end', () => {
    const frame = replayFrameAt(TRAIL, CUM, 1);
    expect(frame.head!.latitude).toBeCloseTo(40.733, 6);
    expect(frame.traveledM).toBeCloseTo(frame.totalM, 6);
  });

  it('advances the head monotonically along the trail', () => {
    const quarter = replayFrameAt(TRAIL, CUM, 0.25);
    const half = replayFrameAt(TRAIL, CUM, 0.5);
    expect(half.traveledM).toBeGreaterThan(quarter.traveledM);
    expect(half.head!.latitude).toBeGreaterThan(quarter.head!.latitude);
  });

  it('interpolates the head mid-segment rather than snapping to waypoints', () => {
    // 1/6 of the way is halfway along the first of three equal legs.
    const frame = replayFrameAt(TRAIL, CUM, 1 / 6);
    expect(frame.head!.latitude).toBeCloseTo(40.7305, 4);
  });

  it('clamps progress outside 0..1', () => {
    expect(replayFrameAt(TRAIL, CUM, -2).traveledM).toBe(0);
    expect(replayFrameAt(TRAIL, CUM, 5).traveledM).toBeCloseTo(TOTAL, 6);
  });

  it('handles a member who never moved', () => {
    const still = [{ latitude: 40.73, longitude: -73.99 }];
    const frame = replayFrameAt(still, cumulativeDistances(still), 0.5);
    expect(frame.head).toEqual(still[0]);
    expect(frame.totalM).toBe(0);
  });
});

describe('buildReplayChunks', () => {
  it('covers the whole trail end to end', () => {
    const chunks = buildReplayChunks(TRAIL, CUM, 12);
    expect(chunks).toHaveLength(12);
    expect(chunks[chunks.length - 1].endM).toBeCloseTo(TOTAL, 6);
    expect(chunks[0].pts[0]).toEqual(TRAIL[0]);
  });

  it('is contiguous — each chunk starts where the last one ended', () => {
    const chunks = buildReplayChunks(TRAIL, CUM, 8);
    for (let i = 1; i < chunks.length; i++) {
      const previousEnd = chunks[i - 1].pts[chunks[i - 1].pts.length - 1];
      const start = chunks[i].pts[0];
      expect(start.latitude).toBeCloseTo(previousEnd.latitude, 9);
      expect(start.longitude).toBeCloseTo(previousEnd.longitude, 9);
    }
  });

  it('every chunk is renderable on Apple Maps', () => {
    // A chunk along a straight stretch comes back as 2 points; Apple Maps drops
    // 2-point polylines (#5285), so none may ever be shorter than 3.
    for (const count of [4, 16, 64, 120]) {
      for (const chunk of buildReplayChunks(TRAIL, CUM, count)) {
        expect(chunk.pts.length).toBeGreaterThanOrEqual(MIN_POLYLINE_POINTS);
      }
    }
  });

  it('has endM strictly increasing, so chunks light up in order', () => {
    const chunks = buildReplayChunks(TRAIL, CUM, 20);
    for (let i = 1; i < chunks.length; i++) {
      expect(chunks[i].endM).toBeGreaterThan(chunks[i - 1].endM);
    }
  });

  it('returns nothing for a member who never moved', () => {
    const still = [{ latitude: 40.73, longitude: -73.99 }];
    expect(buildReplayChunks(still, cumulativeDistances(still), 32)).toEqual([]);
  });

  it('returns nothing for a trail whose points are all identical', () => {
    const stuck = [
      { latitude: 40.73, longitude: -73.99 },
      { latitude: 40.73, longitude: -73.99 },
    ];
    expect(buildReplayChunks(stuck, cumulativeDistances(stuck), 32)).toEqual([]);
  });
});

describe('isChunkWalked', () => {
  const chunks = buildReplayChunks(TRAIL, CUM, 10);

  it('lights nothing up at the start', () => {
    expect(chunks.filter((c) => isChunkWalked(c, 0))).toHaveLength(0);
  });

  it('lights everything up at the end', () => {
    const { traveledM } = replayFrameAt(TRAIL, CUM, 1);
    expect(chunks.filter((c) => isChunkWalked(c, traveledM))).toHaveLength(chunks.length);
  });

  it('lights chunks up one at a time, in order, as the head passes them', () => {
    // The reveal must be a prefix of the trail at every instant — never a chunk
    // lit ahead of the head, never a gap behind it.
    let previous = 0;
    for (let step = 0; step <= 40; step++) {
      const { traveledM } = replayFrameAt(TRAIL, CUM, step / 40);
      const lit = chunks.map((c) => isChunkWalked(c, traveledM));
      const count = lit.filter(Boolean).length;

      expect(lit.slice(0, count).every(Boolean)).toBe(true); // a solid prefix
      expect(lit.slice(count).some(Boolean)).toBe(false); // nothing lit ahead
      expect(count).toBeGreaterThanOrEqual(previous); // never un-lights
      previous = count;
    }
    expect(previous).toBe(chunks.length);
  });
});
