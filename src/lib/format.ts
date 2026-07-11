/** Display formatting — kept apart from the geometry math in geo.ts. */

/** ETA as a live countdown clock: m:ss, or h:mm:ss beyond an hour. */
export function formatEtaClock(minutes: number): string {
  const totalSec = Math.max(0, Math.round(minutes * 60));
  const h = Math.floor(totalSec / 3600);
  const m = Math.floor((totalSec % 3600) / 60);
  const s = totalSec % 60;
  const pad = (n: number) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
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
