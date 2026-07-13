import { DEFAULT_DURATION_MIN, DURATIONS, canStartSession, makeJoinCode } from './session-setup';

describe('makeJoinCode', () => {
  it('is three groups of three letters', () => {
    for (let i = 0; i < 200; i++) {
      expect(makeJoinCode()).toMatch(/^[a-z]{3}-[a-z]{3}-[a-z]{3}$/);
    }
  });

  it('never uses letters that are read back as digits (i, l, o)', () => {
    for (let i = 0; i < 200; i++) {
      expect(makeJoinCode()).not.toMatch(/[ilo]/);
    }
  });
});

describe('canStartSession', () => {
  it('needs a name', () => {
    expect(canStartSession('')).toBe(false);
    expect(canStartSession('   ')).toBe(false);
  });

  it('accepts anything with a character in it', () => {
    expect(canStartSession('Saturday walk')).toBe(true);
    expect(canStartSession('  a  ')).toBe(true);
  });
});

describe('DURATIONS', () => {
  it('offers the default length', () => {
    expect(DURATIONS.map((d) => d.min)).toContain(DEFAULT_DURATION_MIN);
  });

  it('is ordered shortest to longest', () => {
    const mins = DURATIONS.map((d) => d.min);
    expect([...mins].sort((a, b) => a - b)).toEqual(mins);
  });
});
