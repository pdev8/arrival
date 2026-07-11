import { cumulativeDistances } from '../lib/geo';
import { WALK_ROUTES } from './routes';
import { findLights } from './lights';

const route = WALK_ROUTES.priya.map(([latitude, longitude]) => ({ latitude, longitude }));
const cum = cumulativeDistances(route);
const total = cum[cum.length - 1];

describe('findLights', () => {
  const lights = findLights(route, cum, 'priya');

  it('is deterministic for the same member', () => {
    expect(findLights(route, cum, 'priya')).toEqual(lights);
  });

  it('differs between members (seeded per id)', () => {
    const other = findLights(route, cum, 'noah');
    expect(other).not.toEqual(lights);
  });

  it('finds at least one light on a multi-block city route', () => {
    expect(lights.length).toBeGreaterThan(0);
  });

  it('keeps lights out of the start and arrival zones', () => {
    for (const l of lights) {
      expect(l.atM).toBeGreaterThanOrEqual(40);
      expect(l.atM).toBeLessThanOrEqual(total - 80);
    }
  });

  it('spaces lights at least a block apart', () => {
    for (let i = 1; i < lights.length; i++) {
      expect(lights[i].atM - lights[i - 1].atM).toBeGreaterThanOrEqual(90);
    }
  });

  it('bounds waits to the 4–13s design range', () => {
    for (const l of lights) {
      expect(l.waitSec).toBeGreaterThanOrEqual(4);
      expect(l.waitSec).toBeLessThanOrEqual(13);
    }
  });
});
