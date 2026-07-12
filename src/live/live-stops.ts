import { FeedEvent, SessionStop } from '../demo/simulation';
import { Reactions } from '../demo/reactions';

/**
 * Boundary translation for live data: the UI's stop cards and reactions were
 * built against the demo sim, where the local user's id is literally 'you'
 * (StopCard checks `votesUp.includes('you')`, etc). Live rows carry uuids —
 * these mappers swap the signed-in user's uuid for 'you' at the edge so
 * every component works unchanged. Pure + tested.
 */

export interface StopRow {
  id: string;
  trip_id: string;
  created_by: string;
  kind: 'suggestion' | 'announcement';
  status: SessionStop['status'] | 'cancelled';
  category: SessionStop['category'];
  name: string;
  lat: number;
  lng: number;
  note: string | null;
}

export interface VoteRow {
  stop_id: string;
  user_id: string;
  vote: number;
}

export interface ParticipantRow {
  stop_id: string;
  user_id: string;
}

export const youify = (id: string, youId: string): string => (id === youId ? 'you' : id);

export function mapStops(
  stops: StopRow[],
  votes: VoteRow[],
  participants: ParticipantRow[],
  youId: string
): SessionStop[] {
  return stops
    .filter((s) => s.status !== 'cancelled')
    .map((s) => ({
      id: s.id,
      kind: s.kind,
      status: s.status as SessionStop['status'],
      category: s.category,
      name: s.name,
      note: s.note ?? undefined,
      pos: { latitude: s.lat, longitude: s.lng },
      createdBy: youify(s.created_by, youId),
      participants: participants
        .filter((p) => p.stop_id === s.id)
        .map((p) => youify(p.user_id, youId)),
      votesUp: votes
        .filter((v) => v.stop_id === s.id && v.vote === 1)
        .map((v) => youify(v.user_id, youId)),
      votesDown: votes
        .filter((v) => v.stop_id === s.id && v.vote === -1)
        .map((v) => youify(v.user_id, youId)),
    }));
}

/** Reactions jsonb (uuid arrays) → UI shape ('you' swapped in). */
export function mapReactions(
  reactions: Record<string, string[]> | null | undefined,
  youId: string
): Reactions | undefined {
  if (!reactions || Object.keys(reactions).length === 0) return undefined;
  return Object.fromEntries(
    Object.entries(reactions).map(([emoji, ids]) => [emoji, ids.map((id) => youify(id, youId))])
  );
}

export interface EventRow {
  id: number;
  type: string;
  actor_id: string | null;
  payload: Record<string, unknown>;
  reactions: Record<string, string[]> | null;
  created_at: string;
}

/** trip_events row → FeedEvent, with human text per event type. */
export function mapEvent(
  row: EventRow,
  actorName: string,
  youId: string,
  sessionStartMs: number
): FeedEvent {
  return {
    id: String(row.id),
    at: (Date.parse(row.created_at) - sessionStartMs) / 1000,
    memberId: row.actor_id ? youify(row.actor_id, youId) : undefined,
    text: eventText(row.type, actorName, row.payload),
    reactions: mapReactions(row.reactions, youId),
  };
}

export function eventText(type: string, name: string, payload: Record<string, unknown> = {}): string {
  const stop = typeof payload.name === 'string' ? payload.name : 'a stop';
  switch (type) {
    case 'session_started':
      return 'Session started';
    case 'member_joined':
      return `${name} joined the session`;
    case 'member_left':
      return `${name} left — last position stays on the map`;
    case 'session_completed':
      return 'Session ended';
    case 'stop_posted':
      return payload.kind === 'suggestion'
        ? `${name} suggested ${stop}${payload.note ? ` — “${payload.note}”` : ''}`
        : `${name} is stopping at ${stop}${payload.note ? ` — “${payload.note}”` : ''}`;
    case 'stop_confirmed':
      return `${stop} confirmed — ${payload.votes ?? 2} in`;
    case 'stop_joined':
      return `${name} is stopping at ${stop} too`;
    default:
      return `${name} · ${type.replace(/_/g, ' ')}`;
  }
}
