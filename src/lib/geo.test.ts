import {
  LatLng,
  bearingDeg,
  constrainMapRegion,
  cumulativeDistances,
  distanceM,
  isZoomedInside,
  lerp,
  offsetM,
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

describe('constrainMapRegion', () => {
  const bounds = {
    northEast: { latitude: 10, longitude: 20 },
    southWest: { latitude: 0, longitude: 0 },
  };

  it('leaves an in-bounds close-up unchanged', () => {
    const region = { latitude: 5, longitude: 10, latitudeDelta: 2, longitudeDelta: 4 };
    expect(constrainMapRegion(region, bounds)).toEqual(region);
  });

  it('moves an out-of-bounds viewport to the nearest valid edge', () => {
    const constrained = constrainMapRegion(
      { latitude: 9.8, longitude: 0.2, latitudeDelta: 2, longitudeDelta: 4 },
      bounds
    );
    expect(constrained.latitude).toBe(9);
    expect(constrained.longitude).toBe(2);
  });

  it('centers a viewport that is larger than the boundary', () => {
    const constrained = constrainMapRegion(
      { latitude: 9, longitude: 19, latitudeDelta: 12, longitudeDelta: 24 },
      bounds
    );
    expect(constrained.latitude).toBe(5);
    expect(constrained.longitude).toBe(10);
  });
});

describe('isZoomedInside', () => {
  const bounds = {
    northEast: { latitude: 10, longitude: 20 },
    southWest: { latitude: 0, longitude: 0 },
  };

  it('is false at the default frame, so the map stays pinned', () => {
    const atDefault = { latitude: 5, longitude: 10, latitudeDelta: 10, longitudeDelta: 20 };
    expect(isZoomedInside(atDefault, bounds)).toBe(false);
  });

  it('is false for sub-percent camera jitter around the default frame', () => {
    const jittered = { latitude: 5, longitude: 10, latitudeDelta: 9.95, longitudeDelta: 19.9 };
    expect(isZoomedInside(jittered, bounds)).toBe(false);
  });

  it('is true once the viewport is genuinely tighter than the boundary', () => {
    const zoomed = { latitude: 5, longitude: 10, latitudeDelta: 4, longitudeDelta: 8 };
    expect(isZoomedInside(zoomed, bounds)).toBe(true);
  });

  it('requires both axes to be tighter, not just one', () => {
    const onlyLatTighter = { latitude: 5, longitude: 10, latitudeDelta: 4, longitudeDelta: 20 };
    expect(isZoomedInside(onlyLatTighter, bounds)).toBe(false);
  });

  it('is false for a degenerate boundary', () => {
    const degenerate = {
      northEast: { latitude: 5, longitude: 10 },
      southWest: { latitude: 5, longitude: 10 },
    };
    const region = { latitude: 5, longitude: 10, latitudeDelta: 1, longitudeDelta: 1 };
    expect(isZoomedInside(region, degenerate)).toBe(false);
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

describe('offsetM', () => {
  it('is the inverse of distanceM and bearingDeg — walk 100 m at 42°, end up 100 m away at 42°', () => {
    const b = offsetM(A, 42, 100);
    expect(distanceM(A, b)).toBeCloseTo(100, 0);
    expect(bearingDeg(A, b)).toBeCloseTo(42, 0);
  });

  it('goes the right way round the compass', () => {
    expect(offsetM(A, 0, 100).latitude).toBeGreaterThan(A.latitude); // north
    expect(offsetM(A, 180, 100).latitude).toBeLessThan(A.latitude); // south
    expect(offsetM(A, 90, 100).longitude).toBeGreaterThan(A.longitude); // east
    expect(offsetM(A, 270, 100).longitude).toBeLessThan(A.longitude); // west
  });

  it('going nowhere leaves you where you were', () => {
    expect(distanceM(A, offsetM(A, 123, 0))).toBeCloseTo(0, 5);
  });
});
