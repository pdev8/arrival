import { SessionStop } from '../demo/simulation';
import { activeStopFor, canJoin } from './stops';

const stop = (over: Partial<SessionStop> = {}): SessionStop => ({
  id: 's1',
  kind: 'announcement',
  status: 'active',
  category: 'coffee',
  name: 'Think Coffee',
  pos: { latitude: 40.73, longitude: -73.99 },
  createdBy: 'ana',
  participants: ['ana'],
  votesUp: [],
  votesDown: [],
  ...over,
});

describe('activeStopFor — what you could join someone at', () => {
  it('finds the stop they pulled over at', () => {
    expect(activeStopFor('ana', [stop()])?.name).toBe('Think Coffee');
  });

  it('finds one they joined but did not create', () => {
    const dansStop = stop({ createdBy: 'dan', participants: ['dan', 'ana'] });
    expect(activeStopFor('ana', [dansStop])).toBe(dansStop);
  });

  it('ignores a PROPOSAL — nobody has committed, so the act available is a vote', () => {
    // offering "Join" here would quietly commit you to something the group
    // hasn't agreed to
    expect(activeStopFor('ana', [stop({ kind: 'suggestion', status: 'proposed' })])).toBeNull();
  });

  it('takes a confirmed suggestion, which the group HAS agreed to', () => {
    expect(activeStopFor('ana', [stop({ kind: 'suggestion', status: 'confirmed' })])).not.toBeNull();
  });

  it('ignores a stop that is over', () => {
    expect(activeStopFor('ana', [stop({ status: 'done' })])).toBeNull();
  });

  it('ignores everyone else’s stops', () => {
    expect(activeStopFor('mia', [stop()])).toBeNull();
  });

  it('is null when nothing is happening', () => {
    expect(activeStopFor('ana', [])).toBeNull();
  });
});

describe('canJoin', () => {
  it('you can join what you are not already in', () => {
    expect(canJoin(stop())).toBe(true);
  });
  it('you cannot join twice', () => {
    expect(canJoin(stop({ participants: ['ana', 'you'] }))).toBe(false);
  });
  it('there is nothing to join when there is no stop', () => {
    expect(canJoin(null)).toBe(false);
  });
  it('your own stop is not a thing you join', () => {
    expect(canJoin(stop({ createdBy: 'you', participants: ['you'] }))).toBe(false);
  });
});
