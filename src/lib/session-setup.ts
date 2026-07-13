/**
 * Starting a session needs exactly two things: a name and a length.
 *
 * Kind and destination are NOT asked for — they're fixed to the walk scenario
 * until place search lands (M2). Keep the pure bits here so Home stays a view.
 */

export const DURATIONS = [
  { label: '2h', min: 120 },
  { label: '4h', min: 240 },
  { label: '8h', min: 480 },
  { label: '12h', min: 720 },
  { label: '24h', min: 1440 },
];

export const DEFAULT_DURATION_MIN = 240;

/**
 * Free roam has no clock. It still needs SOME end date on the row (the backend
 * expires trips), so it gets a long one — a week — and the only real way it
 * ends is someone pressing End. A session that quietly expires mid-walk is
 * worse than one that lingers in an archive.
 */
export const FREE_ROAM_MIN = 7 * 24 * 60;

/** the one scenario a new session runs; session.tsx falls back to it anyway */
export const DEFAULT_KIND = 'walk';

/** no i/l/o — they're read back as 1/0 when someone says a code out loud */
const CODE_LETTERS = 'abcdefghjkmnpqrstuvwxyz';

export function makeJoinCode(): string {
  const group = () =>
    Array.from(
      { length: 3 },
      () => CODE_LETTERS[Math.floor(Math.random() * CODE_LETTERS.length)]
    ).join('');
  return `${group()}-${group()}-${group()}`;
}

/** a session with no name isn't one — Start stays disabled until it has one */
export function canStartSession(name: string): boolean {
  return name.trim().length > 0;
}
