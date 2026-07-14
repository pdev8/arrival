import { filledDots } from './DotRing';

describe('filledDots — how many dots are COMPLETE', () => {
  it('fills none at 0 and all at 1', () => {
    expect(filledDots(0, 14)).toBe(0);
    expect(filledDots(1, 14)).toBe(14);
  });

  it('lights a dot only when its slice is actually covered — not when it is half covered', () => {
    // 16 dots, 10% of the route = 1.6 dots travelled.
    //   dot 0 is complete; dot 1 is 60% done; dot 2 has not been started.
    // Rounding said 2 — which called dot 1 finished and left the BLINKING dot
    // (index `filled`) sitting on a segment nobody had begun.
    expect(filledDots(0.1, 16)).toBe(1);
    expect(Math.round(0.1 * 16)).toBe(2); // what it used to say, for the record
  });

  it('the index it returns IS the dot in progress — the one that blinks', () => {
    // half a 16-dot ring: dots 0-7 complete, dot 8 in progress
    expect(filledDots(0.5, 16)).toBe(8);
    // a hair further in: still dot 8's turn, so the ring must not twitch
    expect(filledDots(0.53, 16)).toBe(8);
    // and it only hands over once dot 8's slice is genuinely covered
    expect(filledDots(0.5626, 16)).toBe(9);
  });

  it('never claims a dot the member has not finished', () => {
    for (let p = 0; p <= 1; p += 0.017) {
      expect(filledDots(p, 16)).toBeLessThanOrEqual(p * 16);
    }
  });

  it('clamps out-of-range progress', () => {
    expect(filledDots(-0.5, 12)).toBe(0);
    expect(filledDots(1.7, 12)).toBe(12);
  });

  it('is stable across tiny tick-level progress changes', () => {
    expect(filledDots(0.5001, 14)).toBe(filledDots(0.5049, 14));
  });
});
