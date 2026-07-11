import { rowToTrip } from './live-session';

describe('rowToTrip', () => {
  it('maps snake_case rows and parses the expiry', () => {
    const t = rowToTrip({
      id: 'abc',
      name: 'Mall run',
      kind: 'mall',
      join_code: 'kfx-mqv-dhz',
      ends_at: '2026-07-11T20:00:00.000Z',
    });
    expect(t).toEqual({
      id: 'abc',
      name: 'Mall run',
      kind: 'mall',
      joinCode: 'kfx-mqv-dhz',
      endsAt: Date.parse('2026-07-11T20:00:00.000Z'),
    });
  });
});
