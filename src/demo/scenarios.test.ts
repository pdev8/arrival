import { cumulativeDistances, distanceM } from '../lib/geo';
import { SCENARIOS } from './data';
import { levelAt } from './simulation';

/** matches ON_ROUTE_TOLERANCE_M in simulation.ts — the pull-over trigger */
const ON_ROUTE_TOLERANCE_M = 300;

describe.each(Object.values(SCENARIOS).map((s) => [s.key, s] as const))('scenario %s', (_key, s) => {
  it('every member routeKey resolves to a real route', () => {
    for (const m of s.members) {
      expect(s.routes[m.routeKey]).toBeDefined();
      expect(s.routes[m.routeKey].length).toBeGreaterThanOrEqual(2);
    }
  });

  it('routes end near the destination (within the arrive radius + slack)', () => {
    for (const m of s.members) {
      const route = s.routes[m.routeKey];
      const end = route[route.length - 1];
      expect(distanceM(end, s.destination.pos)).toBeLessThanOrEqual(s.arriveRadiusM + 60);
    }
  });

  it('the scripted stop POI sits on the stopping member’s route (or the pull-over never fires)', () => {
    const member = s.members.find((m) => m.id === s.stopEvent.memberId)!;
    expect(member).toBeDefined();
    const route = s.routes[member.routeKey];
    const min = Math.min(...route.map((p) => distanceM(p, s.stopEvent.poi.pos)));
    expect(min).toBeLessThanOrEqual(ON_ROUTE_TOLERANCE_M);
  });

  it('the suggestion member and ally exist', () => {
    expect(s.members.some((m) => m.id === s.suggestEvent.memberId)).toBe(true);
    expect(s.members.some((m) => m.id === s.suggestEvent.allyVote.memberId)).toBe(true);
  });

  it('level spans are ordered, within [0,1], and non-overlapping per member', () => {
    for (const m of s.members) {
      const spans = m.levelSpans ?? [];
      for (const span of spans) {
        expect(span.fromFrac).toBeGreaterThanOrEqual(0);
        expect(span.toFrac).toBeLessThanOrEqual(1);
        expect(span.toFrac).toBeGreaterThan(span.fromFrac);
      }
      const sorted = [...spans].sort((a, b) => a.fromFrac - b.fromFrac);
      for (let i = 1; i < sorted.length; i++) {
        expect(sorted[i].fromFrac).toBeGreaterThanOrEqual(sorted[i - 1].toFrac);
      }
    }
  });
});

describe('mall scenario specifics', () => {
  const mall = SCENARIOS.mall;

  it('is indoor-scale — every route under a kilometer', () => {
    for (const m of mall.members) {
      const cum = cumulativeDistances(mall.routes[m.routeKey]);
      expect(cum[cum.length - 1]).toBeLessThan(1000);
      expect(cum[cum.length - 1]).toBeGreaterThan(100);
    }
  });

  it('every member has full-route level coverage (never "street level" inside the mall)', () => {
    for (const m of mall.members) {
      for (const frac of [0, 0.25, 0.5, 0.75, 1]) {
        expect(levelAt(m.levelSpans, frac).level).not.toBeNull();
      }
    }
  });

  it('everyone ends on the food-court level (F2)', () => {
    for (const m of mall.members) {
      expect(levelAt(m.levelSpans, 1).level).toBe(2);
    }
  });
});
