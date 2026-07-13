import { LatLng, cumulativeDistances } from './geo';
import { TRAIL_PARTS, alphaHex, buildSegments, headSegment } from './trail';

const line = (n: number): LatLng[] =>
  Array.from({ length: n }, (_, i) => ({ latitude: 40.73 + i * 0.001, longitude: -73.99 }));

describe('buildSegments', () => {
  it('returns nothing for degenerate trails', () => {
    expect(buildSegments([])).toEqual([]);
    expect(buildSegments(line(1))).toEqual([]);
    // two identical points = zero length
    expect(buildSegments([line(1)[0], line(1)[0]])).toEqual([]);
  });

  it('splits a trail into TRAIL_PARTS segments', () => {
    expect(buildSegments(line(20))).toHaveLength(TRAIL_PARTS);
  });

  it('never emits a 2-point polyline (Apple Maps drops them, #5285)', () => {
    for (const trail of [line(2), line(3), line(4), line(30)]) {
      for (const seg of buildSegments(trail)) {
        expect(seg.length).toBeGreaterThanOrEqual(3);
      }
    }
  });

  it('covers the whole trail: first segment starts at the trail start, last ends at the head', () => {
    const trail = line(12);
    const segs = buildSegments(trail);
    expect(segs[0][0].latitude).toBeCloseTo(trail[0].latitude, 6);
    const lastSeg = segs[segs.length - 1];
    expect(lastSeg[lastSeg.length - 1].latitude).toBeCloseTo(trail[trail.length - 1].latitude, 6);
  });

  it('segments are distance-equal within tolerance', () => {
    const segs = buildSegments(line(30));
    const lengths = segs.map((s) => {
      const cum = cumulativeDistances(s);
      return cum[cum.length - 1];
    });
    const avg = lengths.reduce((a, b) => a + b, 0) / lengths.length;
    for (const l of lengths) {
      expect(Math.abs(l - avg) / avg).toBeLessThan(0.05);
    }
  });
});

describe('alphaHex', () => {
  it('converts 0..1 alpha to two hex digits', () => {
    expect(alphaHex(0)).toBe('00');
    expect(alphaHex(1)).toBe('ff');
    expect(alphaHex(0.5)).toBe('80');
  });
});

describe('headSegment (the live dot that follows a moving member)', () => {
  const a = { latitude: 37.75, longitude: -122.4 };
  const b = { latitude: 37.76, longitude: -122.4 };

  it('always returns 3 points — 2-point polylines vanish on Apple Maps (#5285)', () => {
    expect(headSegment(a, b)).toHaveLength(3);
  });
  it('ends exactly at the member, so the trail never lags behind them', () => {
    const seg = headSegment(a, b);
    expect(seg[seg.length - 1]).toEqual(b);
  });
  it('starts at the anchor and puts the injected point between them', () => {
    const [start, mid] = headSegment(a, b);
    expect(start).toEqual(a);
    expect(mid.latitude).toBeGreaterThan(a.latitude);
    expect(mid.latitude).toBeLessThan(b.latitude);
  });
  it('draws nothing without an anchor', () => {
    expect(headSegment(null, b)).toEqual([]);
  });
});
