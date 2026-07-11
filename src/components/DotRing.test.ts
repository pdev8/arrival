import { filledDots } from './DotRing';

describe('filledDots', () => {
  it('fills none at 0 and all at 1', () => {
    expect(filledDots(0, 14)).toBe(0);
    expect(filledDots(1, 14)).toBe(14);
  });
  it('rounds to the nearest dot', () => {
    expect(filledDots(0.5, 14)).toBe(7);
    expect(filledDots(0.49, 12)).toBe(6);
  });
  it('clamps out-of-range progress', () => {
    expect(filledDots(-0.5, 12)).toBe(0);
    expect(filledDots(1.7, 12)).toBe(12);
  });
  it('is stable across tiny tick-level progress changes', () => {
    expect(filledDots(0.5001, 14)).toBe(filledDots(0.5049, 14));
  });
});
