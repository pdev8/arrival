import { LatLng, distanceM } from './geo';

export interface ProximityGroup<T> {
  members: T[];
  center: LatLng;
}

/**
 * Greedy proximity grouping: items within `thresholdM` of a group's running
 * center merge into it. Pure — the session hook layers throttling on top so
 * membership doesn't flap at the simulation tick rate.
 */
export function groupByProximity<T extends { pos: LatLng }>(
  items: T[],
  thresholdM: number
): ProximityGroup<T>[] {
  const groups: ProximityGroup<T>[] = [];
  for (const item of items) {
    const g = groups.find((x) => distanceM(x.center, item.pos) < thresholdM);
    if (g) {
      g.members.push(item);
      g.center = centerOf(g.members);
    } else {
      groups.push({ members: [item], center: item.pos });
    }
  }
  return groups;
}

export function centerOf(items: { pos: LatLng }[]): LatLng {
  return {
    latitude: items.reduce((s, x) => s + x.pos.latitude, 0) / items.length,
    longitude: items.reduce((s, x) => s + x.pos.longitude, 0) / items.length,
  };
}
