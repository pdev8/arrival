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
  mode?: string;
  steps?: number;
}): string {
  let s = m.left
    ? 'Left — last known position'
    : m.state === 'arrived'
      ? 'Arrived'
      : m.state === 'stopped'
        ? (m.statusNote ?? 'Stopped')
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
