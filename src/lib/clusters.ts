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

/**
 * Which members hide behind facepiles, and the piles to draw. The selected
 * member always renders individually (carved out at render time so the
 * grouping itself stays stable across selection changes — regrouping on
 * every tap churned marker props, which Apple Maps + New Arch answers by
 * silently dropping marker views, rn-maps #5911). A pile needs ≥2 visible
 * members; a pile reduced to one by the carve-out renders that member solo.
 */
export function clusterVisibility<T extends { id: string; pos: LatLng }>(
  groups: ProximityGroup<T>[],
  selectedId: string | null
): { hiddenIds: Set<string>; piles: ProximityGroup<T>[] } {
  const hiddenIds = new Set<string>();
  const piles: ProximityGroup<T>[] = [];
  for (const g of groups) {
    const visible = g.members.filter((m) => m.id !== selectedId);
    if (visible.length > 1) {
      for (const m of visible) hiddenIds.add(m.id);
      piles.push({ members: visible, center: centerOf(visible) });
    }
  }
  return { hiddenIds, piles };
}

export function centerOf(items: { pos: LatLng }[]): LatLng {
  return {
    latitude: items.reduce((s, x) => s + x.pos.latitude, 0) / items.length,
    longitude: items.reduce((s, x) => s + x.pos.longitude, 0) / items.length,
  };
}
