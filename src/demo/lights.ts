import { LatLng, bearingDeg } from '../lib/geo';

/* Stoplights: walkers pause briefly at some corners and crossings. */
const LIGHT_MIN_WAIT_S = 4;
const LIGHT_WAIT_SPAN_S = 9; // waits land in 4–13s
const LIGHT_EVERY_M = 220; // candidate mid-block crossings between corners
const LIGHT_MIN_GAP_M = 90; // at most one light per block
const LIGHT_RED_PCT = 55; // odds a given light catches you

export interface Stoplight {
  atM: number;
  waitSec: number;
}

/**
 * Plausible stoplight positions along a walking route: every sharp turn (a
 * real street corner) plus periodic candidates for straight-through
 * crossings, deduped to one per block. A seeded hash decides which lights
 * catch this walker red and for how long, so the pattern is stable across
 * re-renders but differs per member.
 */
export function findLights(route: LatLng[], cum: number[], seedId: string): Stoplight[] {
  const total = cum[cum.length - 1];
  const seedH = seedId.split('').reduce((h, c) => h * 31 + c.charCodeAt(0), 7);
  const hash = (n: number) => {
    let h = (n * 2654435761 + seedH * 97) >>> 0;
    h ^= h >> 13;
    return h % 100;
  };

  const candidates: number[] = [];
  for (let i = 1; i < route.length - 1; i++) {
    const turn = Math.abs(
      ((bearingDeg(route[i], route[i + 1]) - bearingDeg(route[i - 1], route[i]) + 540) % 360) - 180
    );
    if (turn > 35) candidates.push(cum[i]);
  }
  for (let m = LIGHT_EVERY_M; m < total; m += LIGHT_EVERY_M) candidates.push(m);
  candidates.sort((a, b) => a - b);

  const lights: Stoplight[] = [];
  for (const atM of candidates) {
    if (atM < 40 || atM > total - 80) continue; // not right at the start or the arrival
    if (lights.length && atM - lights[lights.length - 1].atM < LIGHT_MIN_GAP_M) continue;
    const h = hash(Math.round(atM));
    if (h < LIGHT_RED_PCT) {
      lights.push({ atM, waitSec: LIGHT_MIN_WAIT_S + (h % LIGHT_WAIT_SPAN_S) });
    }
  }
  return lights;
}
