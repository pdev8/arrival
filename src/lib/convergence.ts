interface ConvergenceMember {
  state: string;
  etaMin: number;
  name: string;
}

/**
 * The one header line that answers "when are we all together?" —
 * "All in ~14 min · Noah last", or "Everyone's here" once they are.
 */
export function summarizeConvergence(members: ConvergenceMember[]): string {
  const enRoute = members.filter((m) => m.state !== 'arrived');
  if (!enRoute.length) return 'Everyone’s here';
  const straggler = enRoute.reduce((a, b) => (a.etaMin > b.etaMin ? a : b));
  return `All in ~${Math.max(1, Math.ceil(straggler.etaMin))} min · ${straggler.name} last`;
}
