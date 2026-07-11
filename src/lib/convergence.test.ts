import { summarizeConvergence } from './convergence';

const m = (name: string, state: string, etaMin: number) => ({ name, state, etaMin });

describe('summarizeConvergence', () => {
  it('celebrates when everyone arrived', () => {
    expect(summarizeConvergence([m('A', 'arrived', 0), m('B', 'arrived', 0)])).toBe('Everyone’s here');
  });

  it('names the straggler with a ceiling ETA', () => {
    expect(
      summarizeConvergence([m('A', 'walking', 3.2), m('B', 'walking', 13.4), m('C', 'arrived', 0)])
    ).toBe('All in ~14 min · B last');
  });

  it('never says 0 minutes while someone is en route', () => {
    expect(summarizeConvergence([m('A', 'walking', 0.01)])).toBe('All in ~1 min · A last');
  });

  it('counts stopped members as en route', () => {
    expect(summarizeConvergence([m('A', 'stopped', 9.5)])).toContain('A last');
  });
});
