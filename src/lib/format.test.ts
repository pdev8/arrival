import { compassDir, formatDistance, formatEtaClock, formatEtaCoarse, formatLevel, headlineLabel, headlineTone, isProgressing, memberHeadline, statusLine, timeAgo } from './format';

describe('formatEtaClock', () => {
  it('renders minutes:seconds', () => {
    expect(formatEtaClock(5.5)).toBe('5:30');
  });
  it('renders hours past 60 minutes', () => {
    expect(formatEtaClock(75)).toBe('1:15 hr');
  });
  it('flips to hr format only past 59:59', () => {
    expect(formatEtaClock(59.99)).toBe('59:59');
    expect(formatEtaClock(60)).toBe('1:00 hr');
  });
  it('shows days past 24 hr', () => {
    expect(formatEtaClock(24 * 60)).toBe('24:00 hr');
    expect(formatEtaClock(5.1 * 24 * 60)).toBe('5.1 days');
  });
  it('clamps negatives to zero', () => {
    expect(formatEtaClock(-3)).toBe('0:00');
  });
});

describe('formatDistance', () => {
  it('uses feet under ~0.19 mi', () => {
    expect(formatDistance(100)).toBe('328 ft');
  });
  it('uses one-decimal miles in the mid range', () => {
    expect(formatDistance(1609.34)).toBe('1.0 mi');
  });
  it('uses whole miles from 10 up', () => {
    expect(formatDistance(16093.4)).toBe('10 mi');
  });
});

describe('formatLevel', () => {
  it('renders basements as B-levels', () => {
    expect(formatLevel(-1)).toBe('B1');
    expect(formatLevel(-2)).toBe('B2');
  });
  it('renders floors as F-levels', () => {
    expect(formatLevel(2)).toBe('F2');
  });
});

describe('compassDir', () => {
  it.each([
    [0, 'N'],
    [45, 'NE'],
    [90, 'E'],
    [135, 'SE'],
    [180, 'S'],
    [225, 'SW'],
    [270, 'W'],
    [315, 'NW'],
  ])('%s° → %s', (deg, dir) => {
    expect(compassDir(deg)).toBe(dir);
  });
  it('wraps around 360 and negatives', () => {
    expect(compassDir(359)).toBe('N');
    expect(compassDir(-45)).toBe('NW');
  });
});

describe('timeAgo', () => {
  it('says now under 45s', () => {
    expect(timeAgo(10)).toBe('now');
  });
  it('rounds to minutes', () => {
    expect(timeAgo(150)).toBe('3m');
  });
  it('floors to hours', () => {
    expect(timeAgo(7300)).toBe('2h');
  });
});

describe('statusLine', () => {
  it('shows remaining distance while moving', () => {
    expect(statusLine({ state: 'walking', remainingM: 800, mode: 'foot', steps: 0 })).toBe('0.5 mi out');
  });
  it('appends steps on foot', () => {
    expect(statusLine({ state: 'walking', remainingM: 800, mode: 'foot', steps: 1200 })).toBe(
      '0.5 mi out · 1,200 steps'
    );
  });
  it('prefers the status note when stopped', () => {
    expect(statusLine({ state: 'stopped', statusNote: 'Coffee stop', remainingM: 500 })).toBe('Coffee stop');
  });
  it('says Arrived', () => {
    expect(statusLine({ state: 'arrived', remainingM: 0 })).toBe('Arrived');
  });
  it('departed members: last known position, no steps', () => {
    expect(statusLine({ state: 'walking', left: true, remainingM: 800, mode: 'foot', steps: 1200 })).toBe(
      'Left — last known position'
    );
  });
});

describe('formatEtaCoarse (map tags — must change rarely)', () => {
  it('rounds to whole minutes so the puck view stops re-rendering', () => {
    expect(formatEtaCoarse(12.4)).toBe('12m');
    expect(formatEtaCoarse(12.6)).toBe('13m');
  });
  it('says now under half a minute', () => {
    expect(formatEtaCoarse(0.4)).toBe('now');
  });
  it('hours past 60 minutes, days past a day', () => {
    expect(formatEtaCoarse(75)).toBe('1h 15m');
    expect(formatEtaCoarse(5.1 * 24 * 60)).toBe('5.1 days');
  });
  it('never goes negative', () => {
    expect(formatEtaCoarse(-9)).toBe('now');
  });
});

describe('memberHeadline — free roam shows what you DID, not what’s left', () => {
  const m = (over: Partial<{ etaMin: number | null; left: boolean; state: string; traveledM: number }> = {}) => ({
    etaMin: 12 as number | null,
    state: 'walking',
    traveledM: 1600,
    ...over,
  });

  it('shows an ETA when the group has a destination', () => {
    expect(memberHeadline(m({ etaMin: 12 }))).toBe('12:00');
  });
  it('shows distance covered when there is no destination', () => {
    expect(memberHeadline(m({ etaMin: null }))).toBe('1.0 mi');
  });
  it('coarse form (map tags) still shows distance covered in free roam', () => {
    expect(memberHeadline(m({ etaMin: null }), true)).toBe('1.0 mi');
  });
  it('coarse form rounds the ETA to minutes so marker views do not churn', () => {
    expect(memberHeadline(m({ etaMin: 12.4 }), true)).toBe('12m');
  });
  it('departed members read "left" regardless', () => {
    expect(memberHeadline(m({ left: true, etaMin: null }))).toBe('left');
  });
  it('arrived reads "here" — but only when there is somewhere to arrive', () => {
    expect(memberHeadline(m({ state: 'arrived' }))).toBe('here');
    expect(memberHeadline(m({ state: 'arrived', etaMin: null }))).toBe('1.0 mi');
  });
});

describe('headlineLabel', () => {
  it('labels the number "eta" with a destination, "covered" without one', () => {
    expect(headlineLabel({ etaMin: 5, state: 'walking' })).toBe('eta');
    expect(headlineLabel({ etaMin: null, state: 'walking' })).toBe('covered');
  });
  it('drops the label once someone has arrived', () => {
    expect(headlineLabel({ etaMin: 0, state: 'arrived' })).toBe('');
  });
});

describe('statusLine — free roam', () => {
  it('never claims a distance "out" when there is no destination', () => {
    expect(statusLine({ state: 'walking', etaMin: null, remainingM: 0, mode: 'foot', steps: 900 })).toBe(
      'Walking · 900 steps'
    );
  });
  it('still reports a stop note in free roam', () => {
    expect(statusLine({ state: 'stopped', etaMin: null, statusNote: 'Coffee', remainingM: 0 })).toBe('Coffee');
  });
});

describe('isProgressing — should the ring’s next dot breathe?', () => {
  const walking = { moving: true, state: 'walking', etaMin: 12 };

  it('yes while they are closing the gap', () => {
    expect(isProgressing(walking)).toBe(true);
  });
  it('no when they have stopped — a still ring is information too', () => {
    expect(isProgressing({ ...walking, moving: false, state: 'stopped' })).toBe(false);
  });
  it('no once they are there — nothing left to earn', () => {
    expect(isProgressing({ ...walking, state: 'arrived' })).toBe(false);
  });
  it('no in FREE ROAM — a dot blinking toward a destination that does not exist', () => {
    expect(isProgressing({ ...walking, etaMin: null })).toBe(false);
  });
});

describe('headlineTone — the meaning; the component owns the colour', () => {
  const base = { etaMin: 12, state: 'walking', traveledM: 800 };

  it('en route, a member keeps their OWN colour — it is what tells you whose number it is', () => {
    expect(headlineTone(base)).toBe('identity');
  });
  it('arriving is good news', () => {
    expect(headlineTone({ ...base, state: 'arrived' })).toBe('good');
  });
  it('leaving is neither good nor bad — it is just over', () => {
    expect(headlineTone({ ...base, left: true })).toBe('muted');
  });
  it('free roam has arrived at nothing, so arriving means nothing', () => {
    expect(headlineTone({ ...base, etaMin: null, state: 'arrived' })).toBe('identity');
  });
});
