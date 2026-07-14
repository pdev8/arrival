/**
 * The meeting time: when the group has agreed to BE somewhere.
 *
 * This module formats it and parses it. It deliberately does NOT derive
 * early-or-late from it.
 *
 * That was built (PR #45) and backed out on sight. Every ETA in the product
 * became "8 late", and a map whose every surface is scolding you is a map that
 * has stopped telling you where anyone is. The meeting time earns its keep as a
 * plain fact in the header — "Joe's Pizza · 8:00 PM" — which is what a group
 * needs and nothing more. If lateness returns, it returns as something you look
 * at on purpose, not as the headline number everywhere.
 */

/**
 * "8:00 PM". Written out by hand rather than through `Intl`, which Hermes does
 * not reliably carry — and a time that renders as "Invalid Date" on someone's
 * phone is worse than no meeting time at all.
 */
export function formatClockTime(ms: number): string {
  const d = new Date(ms);
  const h = d.getHours();
  const suffix = h >= 12 ? 'PM' : 'AM';
  return `${h % 12 || 12}:${String(d.getMinutes()).padStart(2, '0')} ${suffix}`;
}

/** Whole days between two instants, by calendar date — not by 24-hour blocks. */
function dayDelta(from: number, to: number): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(0, 0, 0, 0);
  b.setHours(0, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

/** "8:00 PM", or "8:00 PM tomorrow" — a late session straddles midnight, and
 *  "8:00 PM" alone would then be a lie by twelve hours. */
export function formatMeetTime(ms: number, now: number): string {
  const clock = formatClockTime(ms);
  const days = dayDelta(now, ms);
  if (days === 0) return clock;
  if (days === 1) return `${clock} tomorrow`;
  if (days === -1) return `${clock} yesterday`;
  return days > 0 ? `${clock} +${days}d` : `${clock} −${-days}d`;
}

/** "in 25 min" · "in 1h 10m" · "now" — how far off the meeting is. */
export function untilLabel(ms: number, now: number): string {
  const mins = Math.round((ms - now) / 60_000);
  if (mins <= 0) return 'now';
  if (mins < 60) return `in ${mins} min`;
  const h = Math.floor(mins / 60);
  const m = mins % 60;
  return m ? `in ${h}h ${m}m` : `in ${h}h`;
}

/** A clock time broken into the three things a person actually types: 7, 30, PM. */
export function splitClock(ms: number): { hour12: number; minute: number; pm: boolean } {
  const d = new Date(ms);
  const h = d.getHours();
  return { hour12: h % 12 || 12, minute: d.getMinutes(), pm: h >= 12 };
}

/**
 * The instant someone MEANS when they type a time.
 *
 * A time that has already gone by today means TOMORROW. "We're meeting at 1:00"
 * typed at 11pm is not a request to meet twenty-two hours ago — but a naive
 * `setHours` puts it squarely in the past, where the meeting is unreachable and
 * every single member reads as infinitely late. It is the one part of a typed
 * time that's easy to get wrong and almost impossible to notice.
 *
 * Clamps rather than rejects: 13 o'clock is 1, and 75 minutes past is 59, because
 * a fat-fingered digit should never be able to produce a nonsense meeting.
 */
export function resolveMeetTime(hour12: number, minute: number, pm: boolean, now: number): number {
  const h12 = Math.min(12, Math.max(1, Math.floor(hour12) || 12));
  const min = Math.min(59, Math.max(0, Math.floor(minute) || 0));
  const d = new Date(now);
  d.setHours((h12 % 12) + (pm ? 12 : 0), min, 0, 0);
  if (d.getTime() <= now) d.setDate(d.getDate() + 1);
  return d.getTime();
}
