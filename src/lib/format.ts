/** Display formatting — kept apart from the geometry math in geo.ts. */

/**
 * ETA as a live countdown clock: m:ss under an hour; past 59:59 it switches
 * to h:mm with an explicit "hr" unit ("1:15 hr") so it can't be misread as
 * minutes:seconds; past 24 hr it's just days ("5.1 days"). Full h:mm:ss was
 * too wide for the fixed-height member surfaces.
 */
export function formatEtaClock(minutes: number): string {
  const totalSec = Math.max(0, Math.round(minutes * 60));
  if (totalSec > 24 * 3600) return `${(totalSec / 86400).toFixed(1)} days`;
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)} hr` : `${m}:${pad(s)}`;
}

/** what every member surface reads to decide its headline number */
export interface Headline {
  etaMin: number | null;
  left?: boolean;
  state: string;
  traveledM: number;
}

/**
 * The headline number for a member, everywhere: an ETA when the group has a
 * destination, and DISTANCE COVERED when it doesn't (free roam — there is
 * nowhere to be, so the honest thing to show is what you've done, not what's
 * left). `coarse` is for map tags, which must not re-render every second.
 *
 * A session can carry a MEETING TIME (the header shows it), but nothing here
 * derives early-or-late from it. That was tried and backed out — see the note in
 * lib/schedule.
 */
export function memberHeadline(m: Headline, coarse = false): string {
  if (m.left) return 'left';
  if (m.etaMin == null) return formatDistance(m.traveledM); // free roam
  if (m.state === 'arrived') return 'here';
  return coarse ? formatEtaCoarse(m.etaMin) : formatEtaClock(m.etaMin);
}

/**
 * What the headline number should READ as. The components own the palette; this
 * owns the meaning — so a surface never has to re-derive "is this good news?"
 * from a pile of member fields.
 */
export type HeadlineTone = 'identity' | 'good' | 'muted';

export function headlineTone(m: Headline): HeadlineTone {
  if (m.left) return 'muted';
  if (m.state === 'arrived' && m.etaMin != null) return 'good';
  return 'identity';
}

/**
 * Is this member actively closing a gap right now?
 *
 * Drives the pulsing dot on the progress ring — the one that's about to fill.
 * A stopped member has nothing in progress, an arrived one has nothing left, and
 * FREE ROAM has no gap to close at all: a dot blinking toward a destination that
 * doesn't exist would be promising something the session never agreed to.
 */
export function isProgressing(m: { moving: boolean; state: string; etaMin: number | null }): boolean {
  return m.moving && m.state !== 'arrived' && m.etaMin != null;
}

/** what the headline number MEANS — the little label under it */
export function headlineLabel(m: Pick<Headline, 'etaMin' | 'state'>): string {
  if (m.etaMin == null) return 'covered';
  return m.state === 'arrived' ? '' : 'eta';
}

/**
 * ETA for the MAP TAG — coarse on purpose. A live m:ss countdown inside a
 * marker re-renders its custom view every second, and churning custom views
 * is what makes Apple Maps drop markers (#5911). Minutes change once a
 * minute, so the puck's view tree effectively never re-renders. The rail and
 * the member card keep the live countdown (formatEtaClock).
 */
export function formatEtaCoarse(minutes: number): string {
  const m = Math.max(0, Math.round(minutes));
  if (m < 1) return 'now';
  if (m < 60) return `${m}m`;
  const h = Math.floor(m / 60);
  if (h < 24) return `${h}h ${m % 60}m`;
  return `${(m / 1440).toFixed(1)} days`;
}

export function formatDistance(meters: number): string {
  const mi = meters / 1609.34;
  if (mi < 0.19) return `${Math.round(meters * 3.281)} ft`;
  return mi >= 10 ? `${Math.round(mi)} mi` : `${mi.toFixed(1)} mi`;
}

/** Floor relative to street as a compact chip label: -1 → "B1", 2 → "F2". */
export function formatLevel(level: number): string {
  return level < 0 ? `B${-level}` : `F${level}`;
}

/**
 * One-line status for the member card. Single line by contract — the card
 * has a fixed height (matches the rail), so nothing here may wrap; the
 * component truncates with numberOfLines={1}.
 */
export function statusLine(m: {
  state: string;
  left?: boolean;
  statusNote?: string;
  remainingM: number;
  /** null = free roam: there's no "distance out" to report */
  etaMin?: number | null;
  mode?: string;
  steps?: number;
}): string {
  const freeRoam = m.etaMin === null;
  let s = m.left
    ? 'Left — last known position'
    : m.state === 'arrived' && !freeRoam
      ? 'Arrived'
      : m.state === 'stopped'
        ? (m.statusNote ?? 'Stopped')
        : freeRoam
          ? (m.state === 'driving' ? 'Driving' : 'Walking')
          : `${formatDistance(m.remainingM)} out`;
  if (!m.left && m.mode === 'foot' && (m.steps ?? 0) > 0) s += ` · ${m.steps!.toLocaleString()} steps`;
  return s;
}

/** Bearing → 8-wind compass direction ("NE"), for "0.4 mi NE of you" lines. */
export function compassDir(bearing: number): string {
  const dirs = ['N', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW'];
  return dirs[Math.round((((bearing % 360) + 360) % 360) / 45) % 8];
}

/** Relative time for feed rows: "now", "3m", "1h". */
export function timeAgo(sec: number): string {
  if (sec < 45) return 'now';
  if (sec < 3600) return `${Math.round(sec / 60)}m`;
  return `${Math.floor(sec / 3600)}h`;
}
