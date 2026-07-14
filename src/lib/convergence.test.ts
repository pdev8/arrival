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

describe('the group line once there is a time to be somewhere', () => {
  const at = (h: number, m = 0) => new Date(2026, 6, 14, h, m).getTime();
  const SEVEN = at(19);
  const NOW = at(18, 30); // half an hour to go
  const walker = (name: string, etaMin: number) => ({ name, etaMin, state: 'walking', traveledM: 500 });

  it('asks the question people actually opened the app for', () => {
    // everyone can make 7:00 from 6:30 — this is a genuinely calming sentence
    const calm = [walker('Ana', 10), walker('Dan', 20)];
    expect(summarizeConvergence(calm, SEVEN, NOW)).toBe('Everyone’s on time');
  });

  it('names the one who will not make it', () => {
    const late = [walker('Ana', 10), walker('Dan', 45)];
    expect(summarizeConvergence(late, SEVEN, NOW)).toBe('Dan is 15 min late');
  });

  it('counts them when it is more than one, and leads with the worst', () => {
    const bad = [walker('Ana', 40), walker('Dan', 50), walker('Mia', 5)];
    expect(summarizeConvergence(bad, SEVEN, NOW)).toBe('2 running late · Dan 20 min late');
  });

  it('is not fooled by someone who is merely slow but still fine', () => {
    // 28 min out with 30 to go: two minutes of slack. That is on time, not late.
    expect(summarizeConvergence([walker('Ana', 28)], SEVEN, NOW)).toBe('Everyone’s on time');
  });

  it('falls back to plain convergence when the group has no time to be anywhere', () => {
    const members = [walker('Ana', 10), walker('Dan', 20)];
    expect(summarizeConvergence(members, null, NOW)).toBe('All in ~20 min · Dan last');
  });

  it('free roam is untouched — no destination, no ETA, nobody late', () => {
    const roamers = [
      { name: 'Ana', etaMin: null, state: 'walking', traveledM: 1609 },
      { name: 'Dan', etaMin: null, state: 'stopped', traveledM: 0 },
    ];
    expect(summarizeConvergence(roamers, SEVEN, NOW)).toContain('Free roam');
  });

  it('once everyone is there, lateness is moot', () => {
    const here = [
      { name: 'Ana', etaMin: 0, state: 'arrived', traveledM: 900 },
      { name: 'Dan', etaMin: 0, state: 'arrived', traveledM: 900 },
    ];
    expect(summarizeConvergence(here, SEVEN, at(19, 30))).toBe('Everyone’s here');
  });
});
