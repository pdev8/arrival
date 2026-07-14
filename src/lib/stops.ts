import { SessionStop } from '../demo/simulation';

/**
 * The stop a member is actually AT or committed to — the one you could join them
 * at. This is the live session's most useful act: someone stops for coffee, and
 * you get to say "me too" instead of watching their puck sit there wondering.
 *
 * A *proposal* is not joinable. It hasn't been agreed yet, so the act available
 * to you is a vote, not a join — and offering "Join" for something nobody has
 * committed to would quietly commit you to it.
 */
export function activeStopFor(memberId: string, stops: SessionStop[]): SessionStop | null {
  return (
    stops.find(
      (s) =>
        (s.status === 'active' || s.status === 'confirmed') &&
        (s.createdBy === memberId || s.participants.includes(memberId))
    ) ?? null
  );
}

/** Is there something here for ME to join, or am I already in it? */
export function canJoin(stop: SessionStop | null, youId = 'you'): boolean {
  return !!stop && !stop.participants.includes(youId);
}
