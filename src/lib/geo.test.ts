import {
  LatLng,
  bearingDeg,
  cumulativeDistances,
  distanceM,
  lerp,
  pointAlongRoute,
  routeSlice,
} from './geo';

const A: LatLng = { latitude: 40.73, longitude: -73.99 };
const NORTH_OF_A: LatLng = { latitude: 40.74, longitude: -73.99 };
const EAST_OF_A: LatLng = { latitude: 40.73, longitude: -73.98 };

describe('distanceM', () => {
  it('is zero for identical points', () => {
    expect(distanceM(A, A)).toBe(0);
  });
  it('measures ~1112m per 0.01° of latitude', () => {
    expect(distanceM(A, NORTH_OF_A)).toBeGreaterThan(1100);
    expect(distanceM(A, NORTH_OF_A)).toBeLessThan(1125);
  });
  it('is symmetric', () => {
    expect(distanceM(A, EAST_OF_A)).toBeCloseTo(distanceM(EAST_OF_A, A), 6);
  });
});

describe('bearingDeg', () => {
  it('points north at 0°', () => {
    expect(bearingDeg(A, NORTH_OF_A)).toBeCloseTo(0, 0);
  });
  it('points east at 90°', () => {
    expect(bearingDeg(A, EAST_OF_A)).toBeCloseTo(90, 0);
  });
  it('points south at 180°', () => {
    expect(bearingDeg(NORTH_OF_A, A)).toBeCloseTo(180, 0);
  });
});

describe('lerp', () => {
  it('hits both endpoints and the midpoint', () => {
    expect(lerp(A, NORTH_OF_A, 0)).toEqual(A);
    expect(lerp(A, NORTH_OF_A, 1)).toEqual(NORTH_OF_A);
    expect(lerp(A, NORTH_OF_A, 0.5).latitude).toBeCloseTo(40.735, 6);
  });
});

describe('route helpers', () => {
  const route = [A, NORTH_OF_A, { latitude: 40.74, longitude: -73.98 }];
  const cum = cumulativeDistances(route);

  it('cumulativeDistances starts at 0 and is monotonic', () => {
    expect(cum[0]).toBe(0);
    expect(cum[1]).toBeGreaterThan(0);
    expect(cum[2]).toBeGreaterThan(cum[1]);
  });

  it('pointAlongRoute clamps to endpoints', () => {
    expect(pointAlongRoute(route, cum, -50).pos).toEqual(route[0]);
    expect(pointAlongRoute(route, cum, cum[2] + 100).pos.latitude).toBeCloseTo(40.74, 6);
  });

  it('pointAlongRoute interpolates mid-segment', () => {
    const mid = pointAlongRoute(route, cum, cum[1] / 2);
    expect(mid.pos.latitude).toBeCloseTo(40.735, 3);
    expect(mid.heading).toBeCloseTo(0, 0);
  });

  it('routeSlice returns exact interpolated endpoints and interior waypoints', () => {
    const slice = routeSlice(route, cum, cum[1] / 2, cum[1] + (cum[2] - cum[1]) / 2);
    expect(slice.length).toBe(3); // interpolated start, waypoint 1, interpolated end
    expect(slice[1]).toEqual(route[1]);
  });

  it('routeSlice clamps an inverted range to a point', () => {
    const slice = routeSlice(route, cum, 500, 100);
    expect(slice.length).toBe(2);
    expect(slice[0]).toEqual(slice[1]);
  });
});
