import { summarizeConvergence } from './convergence';

const m = (name: string, state: string, etaMin: number) => ({ name, state, etaMin, traveledM: 100 });

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

describe('summarizeConvergence — free roam (no destination)', () => {
  const roam = (name: string, state: string, traveledM: number) => ({ name, state, etaMin: null, traveledM });

  it('reports movement and ground covered instead of an ETA', () => {
    const line = summarizeConvergence([roam('You', 'walking', 800), roam('Sarah', 'stopped', 400)]);
    expect(line).toMatch(/^Free roam · 1 on the move · /);
  });
  it('never claims a convergence time when there is nowhere to converge', () => {
    expect(summarizeConvergence([roam('You', 'walking', 500)])).not.toMatch(/All in/);
  });
  it('handles nobody moving yet', () => {
    expect(summarizeConvergence([roam('You', 'stopped', 0)])).toBe('Free roam · Nobody moving');
  });
  it('says so when there is no one at all', () => {
    expect(summarizeConvergence([])).toBe('Waiting for members…');
  });
});
