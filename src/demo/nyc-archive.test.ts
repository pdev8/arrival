import AsyncStorage from '@react-native-async-storage/async-storage';
import { distanceM } from '../lib/geo';
import { listArchives } from '../lib/archive';
import { SCENARIOS } from './data';
import { buildNycArchive, seedNycArchive } from './nyc-archive';

beforeEach(() => AsyncStorage.clear());

describe('buildNycArchive', () => {
  const a = buildNycArchive(1_700_000_000_000);

  it('freezes all 7 walkers with full traces ending at the park', () => {
    expect(a.members).toHaveLength(7);
    for (const m of a.members) {
      expect(m.trail.length).toBeGreaterThan(2);
      const end = m.trail[m.trail.length - 1];
      expect(distanceM(end, SCENARIOS.walk.destination.pos)).toBeLessThan(80);
    }
  });

  it('records steps and distance for everyone', () => {
    for (const m of a.members) {
      expect(m.steps).toBeGreaterThan(0);
      expect(m.traveledM).toBeGreaterThan(100);
    }
  });

  it('orders arrivals by time-to-arrive', () => {
    expect(a.arrivalOrder).toHaveLength(7);
    expect(new Set(a.arrivalOrder).size).toBe(7);
    // shortest remaining walk (jess: ~530m route) beats the longest (noah: ~2.1km)
    expect(a.arrivalOrder.indexOf('jess')).toBeLessThan(a.arrivalOrder.indexOf('noah'));
  });
});

describe('seedNycArchive', () => {
  it('seeds once and never duplicates', async () => {
    await seedNycArchive();
    await seedNycArchive();
    const list = await listArchives();
    expect(list).toHaveLength(1);
    expect(list[0].name).toBe('Saturday in the Village');
  });
});
