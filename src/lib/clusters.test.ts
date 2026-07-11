import { centerOf, groupByProximity } from './clusters';

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
