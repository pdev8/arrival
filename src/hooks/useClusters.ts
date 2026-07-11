import { useMemo, useRef } from 'react';
import { Region } from 'react-native-maps';
import { SimMember } from '../demo/simulation';
import { ProximityGroup, centerOf, groupByProximity } from '../lib/clusters';

/** cluster regrouping cadence — membership flapping at the 4 Hz tick
 *  remounted photo facepiles constantly; splits/merges every couple of
 *  seconds read fine */
const REGROUP_MS = 2500;

/**
 * Members within ~6% of the visible map merge into a facepile cluster.
 * Membership is throttled (see REGROUP_MS); between regroups only the
 * centers track live positions, so facepile markers keep stable identity.
 */
export function useClusters(members: SimMember[], region: Region): ProximityGroup<SimMember>[] {
  const memo = useRef({ ids: [] as string[][], at: 0, thresholdM: 0 });
  return useMemo(() => {
    const thresholdM = region.latitudeDelta * 111_000 * 0.06;
    const now = Date.now();
    const m = memo.current;
    const thresholdMoved = Math.abs(thresholdM - m.thresholdM) > m.thresholdM * 0.25;
    if (now - m.at > REGROUP_MS || thresholdMoved) {
      m.ids = groupByProximity(members, thresholdM).map((g) => g.members.map((x) => x.id));
      m.at = now;
      m.thresholdM = thresholdM;
    }
    const byId = new Map(members.map((x) => [x.id, x]));
    return m.ids
      .map((ids) => ids.map((id) => byId.get(id)).filter((x): x is SimMember => !!x))
      .filter((g) => g.length > 0)
      .map((g) => ({ members: g, center: centerOf(g) }));
  }, [members, region]);
}
