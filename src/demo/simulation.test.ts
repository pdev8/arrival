import { levelAt } from './simulation';

const spans = [
  { fromFrac: 0.3, toFrac: 0.6, level: -1, label: 'subway' },
  { fromFrac: 0.8, toFrac: 1, level: 2, label: 'food court' },
];

describe('levelAt', () => {
  it('is street level with no spans', () => {
    expect(levelAt(undefined, 0.5)).toEqual({ level: null });
    expect(levelAt([], 0.5)).toEqual({ level: null });
  });

  it('picks the span containing the fraction', () => {
    expect(levelAt(spans, 0.45)).toEqual({ level: -1, levelLabel: 'subway' });
    expect(levelAt(spans, 0.9)).toEqual({ level: 2, levelLabel: 'food court' });
  });

  it('is street level between spans', () => {
    expect(levelAt(spans, 0.7)).toEqual({ level: null });
  });

  it('includes span boundaries', () => {
    expect(levelAt(spans, 0.3).level).toBe(-1);
    expect(levelAt(spans, 0.6).level).toBe(-1);
    expect(levelAt(spans, 1).level).toBe(2);
  });
});
