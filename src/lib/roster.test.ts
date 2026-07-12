import { rosterPile } from './roster';

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
