import { compassDir, formatDistance, formatEtaClock, formatLevel, timeAgo } from './format';

describe('formatEtaClock', () => {
  it('renders minutes:seconds', () => {
    expect(formatEtaClock(5.5)).toBe('5:30');
  });
  it('renders hours past 60 minutes', () => {
    expect(formatEtaClock(75)).toBe('1:15:00');
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
