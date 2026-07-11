import { ArchivedSession, hasArchive, saveArchive } from '../lib/archive';
import { cumulativeDistances, routeSlice } from '../lib/geo';
import { SCENARIOS } from './data';

const NYC_ARCHIVE_ID = 'archived-nyc-walk';
/** demo stride, mirrors simulation.ts */
const STRIDE_M = 0.75;

/**
 * The NYC walking hangout lives on as a pre-archived session: full traces,
 * steps, arrival order — so the archive has something to open on first run.
 * (It was the live demo before the mall scenario replaced it in Create.)
 */
export function buildNycArchive(endedAt: number): ArchivedSession {
  const walk = SCENARIOS.walk;
  const members = walk.members.map((seed) => {
    const route = walk.routes[seed.routeKey];
    const cum = cumulativeDistances(route);
    const totalM = cum[cum.length - 1];
    const startM = totalM * seed.startFrac;
    const traveledM = Math.round(totalM - startM);
    return {
      id: seed.id,
      name: seed.name,
      color: seed.color,
      avatarKey: seed.id,
      mode: 'foot' as const,
      steps: Math.round(traveledM / STRIDE_M),
      traveledM,
      trail: routeSlice(route, cum, startM, totalM),
      // time to arrive, for a plausible arrival order
      etaSec: (totalM - startM) / seed.cruiseMps,
    };
  });
  const arrivalOrder = [...members].sort((a, b) => a.etaSec - b.etaSec).map((m) => m.id);
  const longest = Math.max(...members.map((m) => m.etaSec));
  return {
    id: NYC_ARCHIVE_ID,
    name: 'Saturday in the Village',
    kind: 'walk',
    endedAt,
    // ~15% over pure walking time for lights and the coffee stop
    durationSec: Math.round(longest * 1.15),
    destination: walk.destination,
    members: members.map(({ etaSec: _etaSec, ...m }) => m),
    arrivalOrder,
  };
}

/** Idempotent: seeds the NYC record once, never overwrites a re-run. */
export async function seedNycArchive(): Promise<void> {
  if (await hasArchive(NYC_ARCHIVE_ID)) return;
  await saveArchive(buildNycArchive(Date.now()));
}
