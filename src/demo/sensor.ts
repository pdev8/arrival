import { LatLng, offsetM } from '../lib/geo';
import { Fix } from '../lib/motion';

/**
 * The demo's stand-in for a GPS receiver.
 *
 * The demo knows exactly where everyone is — which is precisely the problem. A
 * flawless position stream exercises none of the motion gate (lib/motion), so
 * the direction arrow would look perfect on this desk and fall apart on a
 * sidewalk. That is the Expo Go lesson wearing a different hat: an environment
 * that cannot reproduce the bug cannot prove the fix.
 *
 * So the demo lies to itself the way a real phone does. Speed jitters across
 * the walk/stop threshold. The course drops out when you slow down, and iOS
 * signals that with **-1**, not null, so we emit -1 and make the normalizer
 * earn its keep. Accuracy wanders, and every so often a fix is simply garbage —
 * a bus shelter, a canyon between towers — and the gate has to throw it away.
 *
 * Deterministic: seeded per member and per fix, so a glitch you catch at the
 * corner of Bleecker is the same glitch on the next run. A demo you can't
 * reproduce is a demo you can't debug.
 *
 * THE NOISE FEEDS THE GATE ONLY. The rendered puck still walks the clean route,
 * because position smoothing is a separate problem we have not solved, and
 * jittering the demo's pucks would bury the direction work underneath it.
 */

/** FNV-1a — a stable hash so a member's noise is theirs, run after run. */
function hash(s: string): number {
  let h = 2166136261;
  for (let i = 0; i < s.length; i++) h = Math.imul(h ^ s.charCodeAt(i), 16777619);
  return h >>> 0;
}

/** mulberry32 — small, fast, good enough to fake a receiver. */
function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** roughly one fix in twenty is junk — the gate must survive it */
const BAD_FIX_RATE = 0.05;
/** and one in twelve carries no speed at all */
const NO_SPEED_RATE = 0.08;
/** iOS withholds a course below ~1 m/s; it also just drops one now and then */
const NO_COURSE_RATE = 0.1;
const COURSE_CUTOFF_MPS = 1;

/**
 * One synthetic fix for `memberId`'s `n`th reading, given where they truly are,
 * which way they're truly facing, and how fast they're truly going.
 *
 * `speedMps === 0` means standing still — and a standing phone is exactly where
 * GPS lies hardest, so this is the case worth watching on device.
 */
export function sensedFix(
  memberId: string,
  n: number,
  truePos: LatLng,
  trueCourseDeg: number,
  trueSpeedMps: number,
  at: number
): Fix {
  const r = rng(hash(memberId) + Math.imul(n, 2654435761));
  const [junk, accRoll, jitterRoll, dirRoll, speedRoll, dropSpeed, dropCourse, courseRoll] = [
    r(), r(), r(), r(), r(), r(), r(), r(),
  ];

  const accuracy = junk < BAD_FIX_RATE ? 45 + accRoll * 40 : 5 + accRoll * 14;

  // Scatter the fix inside its own error circle. THIS is what makes a member
  // standing perfectly still look like they're drifting north-east at half a
  // metre a second, and why the gate has to out-travel its own error.
  const sensedPos = offsetM(truePos, dirRoll * 360, accuracy * 0.35 * (jitterRoll * 2 - 1));

  const noisySpeed = Math.max(0, trueSpeedMps + (speedRoll * 2 - 1) * 0.3);
  const speed = dropSpeed < NO_SPEED_RATE ? -1 : noisySpeed;
  const course =
    noisySpeed < COURSE_CUTOFF_MPS || dropCourse < NO_COURSE_RATE
      ? -1
      : (trueCourseDeg + (courseRoll * 2 - 1) * 14 + 360) % 360;

  return { pos: sensedPos, at, speed, course, accuracy };
}
