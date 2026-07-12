import { eventText, mapEvent, mapReactions, mapStops } from './live-stops';

const YOU = 'uuid-you';

describe('mapStops', () => {
  const stops = [
    {
      id: 's1', trip_id: 't', created_by: YOU, kind: 'suggestion' as const,
      status: 'proposed' as const, category: 'food' as const, name: 'Shake Shack',
      lat: 40.75, lng: -74, note: 'Burgers?',
    },
    {
      id: 's2', trip_id: 't', created_by: 'uuid-bob', kind: 'announcement' as const,
      status: 'cancelled' as const, category: 'gas' as const, name: 'Shell', lat: 39, lng: -120, note: null,
    },
  ];
  const votes = [
    { stop_id: 's1', user_id: YOU, vote: 1 },
    { stop_id: 's1', user_id: 'uuid-bob', vote: -1 },
  ];
  const participants = [{ stop_id: 's1', user_id: 'uuid-bob' }];

  it('translates your uuid to the literal you the UI expects', () => {
    const [s] = mapStops(stops, votes, participants, YOU);
    expect(s.createdBy).toBe('you');
    expect(s.votesUp).toEqual(['you']);
    expect(s.votesDown).toEqual(['uuid-bob']);
    expect(s.participants).toEqual(['uuid-bob']);
    expect(s.note).toBe('Burgers?');
  });

  it('drops cancelled stops', () => {
    expect(mapStops(stops, [], [], YOU)).toHaveLength(1);
  });
});

describe('mapReactions', () => {
  it('translates uuids and drops empties', () => {
    expect(mapReactions({ '🎉': [YOU, 'uuid-bob'] }, YOU)).toEqual({ '🎉': ['you', 'uuid-bob'] });
    expect(mapReactions({}, YOU)).toBeUndefined();
    expect(mapReactions(null, YOU)).toBeUndefined();
  });
});

describe('eventText', () => {
  it.each([
    ['stop_posted', { kind: 'suggestion', name: 'Joe’s', note: 'Slice?' }, 'Sarah suggested Joe’s — “Slice?”'],
    ['stop_posted', { kind: 'announcement', name: 'Shell' }, 'Sarah is stopping at Shell'],
    ['stop_confirmed', { name: 'Joe’s', votes: 3 }, 'Joe’s confirmed — 3 in'],
    ['stop_joined', { name: 'Shell' }, 'Sarah is stopping at Shell too'],
    ['member_joined', {}, 'Sarah joined the session'],
  ])('%s', (type, payload, expected) => {
    expect(eventText(type, 'Sarah', payload)).toBe(expected);
  });
});

describe('mapEvent', () => {
  it('builds a FeedEvent with relative time and reactions', () => {
    const e = mapEvent(
      {
        id: 7, type: 'stop_confirmed', actor_id: 'uuid-bob',
        payload: { name: 'Joe’s', votes: 2 },
        reactions: { '👍': [YOU] },
        created_at: new Date(1_700_000_060_000).toISOString(),
      },
      'Bob', YOU, 1_700_000_000_000
    );
    expect(e).toEqual({
      id: '7', at: 60, memberId: 'uuid-bob',
      text: 'Joe’s confirmed — 2 in',
      reactions: { '👍': ['you'] },
    });
  });
});
