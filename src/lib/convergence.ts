import { formatDistance } from './format';

interface ConvergenceMember {
  state: string;
  /** null = free roam: no destination, so no convergence to summarize */
  etaMin: number | null;
  traveledM: number;
  name: string;
}

/**
 * The one header line that answers "when are we all together?" —
 * "All in ~14 min · Noah last", or "Everyone's here" once they are.
 *
 * FREE ROAM has no answer to that question, because there's nowhere to
 * converge on. The honest headline is what the session actually is: people
 * moving, and ground covered. (Set a destination and this becomes an ETA
 * line — that's the point of being able to add one mid-session.)
 */
export function summarizeConvergence(members: ConvergenceMember[]): string {
  if (!members.length) return 'Waiting for members…';

  if (members.every((m) => m.etaMin == null)) {
    const moving = members.filter((m) => m.state === 'walking' || m.state === 'driving').length;
    const covered = members.reduce((s, m) => s + m.traveledM, 0);
    const who = moving === 0 ? 'Nobody moving' : moving === 1 ? '1 on the move' : `${moving} on the move`;
    return covered > 0 ? `Free roam · ${who} · ${formatDistance(covered)} covered` : `Free roam · ${who}`;
  }

  const enRoute = members.filter((m) => m.state !== 'arrived' && m.etaMin != null);
  if (!enRoute.length) return 'Everyone’s here';
  const straggler = enRoute.reduce((a, b) => ((a.etaMin ?? 0) > (b.etaMin ?? 0) ? a : b));
  return `All in ~${Math.max(1, Math.ceil(straggler.etaMin ?? 0))} min · ${straggler.name} last`;
}
