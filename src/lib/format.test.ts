import { compassDir, formatDistance, formatEtaClock, formatLevel, statusLine, timeAgo } from './format';

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
