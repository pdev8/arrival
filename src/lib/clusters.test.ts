import { centerOf, clusterVisibility, groupByProximity } from './clusters';

const at = (latitude: number, longitude: number) => ({ pos: { latitude, longitude } });

describe('groupByProximity', () => {
  it('groups items within the threshold', () => {
    // ~111m apart at 0.001° latitude
    const items = [at(40.73, -73.99), at(40.7301, -73.99), at(40.75, -73.99)];
    const groups = groupByProximity(items, 200);
    expect(groups).toHaveLength(2);
    expect(groups[0].members).toHaveLength(2);
    expect(groups[1].members).toHaveLength(1);
  });

  it('keeps everyone separate when far apart', () => {
    const items = [at(40.7, -74), at(40.8, -74), at(40.9, -74)];
    expect(groupByProximity(items, 100)).toHaveLength(3);
  });

  it('merges everyone with a huge threshold', () => {
    const items = [at(40.7, -74), at(40.71, -74), at(40.72, -74)];
    const groups = groupByProximity(items, 10_000);
    expect(groups).toHaveLength(1);
    expect(groups[0].members).toHaveLength(3);
  });

  it('centers a group at the member average', () => {
    const c = centerOf([at(40.7, -74), at(40.8, -74)]);
    expect(c.latitude).toBeCloseTo(40.75, 6);
    expect(c.longitude).toBeCloseTo(-74, 6);
  });

  it('handles an empty list', () => {
    expect(groupByProximity([], 100)).toEqual([]);
  });
});

describe('clusterVisibility', () => {
  const g = (ids: string[], lat = 40.73) => ({
    members: ids.map((id) => ({ id, pos: { latitude: lat, longitude: -74 } })),
    center: { latitude: lat, longitude: -74 },
  });

  it('hides members behind piles of two or more', () => {
    const { hiddenIds, piles } = clusterVisibility([g(['a', 'b']), g(['c'])], null);
    expect([...hiddenIds].sort()).toEqual(['a', 'b']);
    expect(piles).toHaveLength(1);
  });

  it('carves the selected member out of their pile', () => {
    const { hiddenIds, piles } = clusterVisibility([g(['a', 'b', 'c'])], 'b');
    expect(hiddenIds.has('b')).toBe(false);
    expect([...hiddenIds].sort()).toEqual(['a', 'c']);
    expect(piles[0].members.map((m) => m.id).sort()).toEqual(['a', 'c']);
  });

  it('dissolves a pair when one of them is selected — both render solo', () => {
    const { hiddenIds, piles } = clusterVisibility([g(['a', 'b'])], 'a');
    expect(hiddenIds.size).toBe(0);
    expect(piles).toHaveLength(0);
  });

  it('recenters the pile on its visible members', () => {
    const groups = [
      {
        members: [
          { id: 'a', pos: { latitude: 40.7, longitude: -74 } },
          { id: 'b', pos: { latitude: 40.8, longitude: -74 } },
          { id: 'sel', pos: { latitude: 41.5, longitude: -74 } },
        ],
        center: { latitude: 41, longitude: -74 },
      },
    ];
    const { piles } = clusterVisibility(groups, 'sel');
    expect(piles[0].center.latitude).toBeCloseTo(40.75, 6);
  });
});
