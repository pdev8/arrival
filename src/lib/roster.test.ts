import { rosterPile, sortMembers } from './roster';

const members = ['a', 'b', 'c', 'd', 'e', 'f', 'g'].map((id) => ({ id }));

describe('rosterPile', () => {
  it('shows everyone when the roster fits under the cap', () => {
    const { shown, hidden } = rosterPile(members.slice(0, 3), null, 5);
    expect(shown.map((m) => m.id)).toEqual(['a', 'b', 'c']);
    expect(hidden).toEqual([]);
  });

  it('caps the pile and reports the rest as hidden', () => {
    const { shown, hidden } = rosterPile(members, null, 5);
    expect(shown.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(hidden.map((m) => m.id)).toEqual(['f', 'g']);
  });

  it('leaves the pile alone when the selected member is already visible', () => {
    const { shown, hidden } = rosterPile(members, 'b', 5);
    expect(shown.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
    expect(hidden.map((m) => m.id)).toEqual(['f', 'g']);
  });

  it('pulls a selected member from past the cut into the pile', () => {
    const { shown, hidden } = rosterPile(members, 'g', 5);
    expect(shown.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'g']);
    expect(shown).toHaveLength(5);
    expect(hidden.map((m) => m.id)).toEqual(['e', 'f']);
  });

  it('treats a zero cap as everyone hidden', () => {
    const { shown, hidden } = rosterPile(members, 'a', 0);
    expect(shown).toEqual([]);
    expect(hidden).toHaveLength(members.length);
  });

  it('ignores a selected id that is not in the roster', () => {
    const { shown } = rosterPile(members, 'zzz', 5);
    expect(shown.map((m) => m.id)).toEqual(['a', 'b', 'c', 'd', 'e']);
  });
});

describe('sortMembers', () => {
  const m = (id: string, etaMin: number, left?: boolean) => ({ id, etaMin, left });
  it('puts you first, fastest next, departed last', () => {
    const order = sortMembers(
      [m('a', 9), m('you', 20), m('b', 3, true), m('c', 5), m('d', 1)],
      'you'
    ).map((x) => x.id);
    expect(order).toEqual(['you', 'd', 'c', 'a', 'b']);
  });
  it('you stays first even when slowest', () => {
    expect(sortMembers([m('a', 1), m('you', 99)], 'you')[0].id).toBe('you');
  });
  it('multiple departed keep eta order at the end', () => {
    const order = sortMembers([m('a', 5, true), m('b', 2, true), m('c', 3)], 'you').map((x) => x.id);
    expect(order).toEqual(['c', 'b', 'a']);
  });
});
