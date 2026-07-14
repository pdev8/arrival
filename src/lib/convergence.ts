import { formatDistance } from './format';
import { punctuality, slackLabel, slackMin } from './schedule';

interface ConvergenceMember {
  state: string;
  /** null = free roam: no destination, so no convergence to summarize */
  etaMin: number | null;
  traveledM: number;
  name: string;
}

/**
 * The one header line that answers the group's actual question. Which question
 * that is depends on what the session knows:
 *
 *  - A TIME TO MEET → "is anyone going to be late?" This is the one people open
 *    the app for, so it wins whenever we can answer it. "Everyone's on time" is
 *    a genuinely calming sentence; "Dan is 8 min late" is an actionable one.
 *  - A destination, no time → "when are we all together?" ("All in ~14 min").
 *  - Neither (FREE ROAM) → there is nothing to converge on, so the honest
 *    headline is what the session actually IS: people moving, ground covered.
 */
export function summarizeConvergence(
  members: ConvergenceMember[],
  /** null = no time to be anywhere */
  meetAt: number | null = null,
  now: number = Date.now()
): string {
  if (!members.length) return 'Waiting for members…';

  if (members.every((m) => m.etaMin == null)) {
    const moving = members.filter((m) => m.state === 'walking' || m.state === 'driving').length;
    const covered = members.reduce((s, m) => s + m.traveledM, 0);
    const who = moving === 0 ? 'Nobody moving' : moving === 1 ? '1 on the move' : `${moving} on the move`;
    return covered > 0 ? `Free roam · ${who} · ${formatDistance(covered)} covered` : `Free roam · ${who}`;
  }

  const enRoute = members.filter((m) => m.state !== 'arrived' && m.etaMin != null);
  if (!enRoute.length) return 'Everyone’s here';

  if (meetAt != null) {
    const late = enRoute
      .map((m) => ({ m, slack: slackMin(m.etaMin, meetAt, now)! }))
      .filter((x) => punctuality(x.slack) === 'late')
      .sort((a, b) => a.slack - b.slack); // worst first — most negative

    if (!late.length) return 'Everyone’s on time';
    const worst = late[0];
    return late.length === 1
      ? `${worst.m.name} is ${slackLabel(worst.slack)}`
      : `${late.length} running late · ${worst.m.name} ${slackLabel(worst.slack)}`;
  }

  const straggler = enRoute.reduce((a, b) => ((a.etaMin ?? 0) > (b.etaMin ?? 0) ? a : b));
  return `All in ~${Math.max(1, Math.ceil(straggler.etaMin ?? 0))} min · ${straggler.name} last`;
}
