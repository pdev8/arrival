/**
 * Facepile splitting for a capped avatar row.
 *
 * The rule a naive `slice(0, max)` gets wrong: the selected member must always be
 * in the pile, even when they sit past the cut, or focusing member #6 highlights
 * nobody and the pile looks broken.
 */
/**
 * Member surface ordering: you first, then active members fastest ETA first,
 * departed members last. In FREE ROAM there is no ETA, so the meaningful
 * ranking is who's covered the most ground. Sort is stable, so equal keys keep
 * their incoming order.
 */
export function sortMembers<T extends { id: string; etaMin: number | null; traveledM: number; left?: boolean }>(
  members: T[],
  youId: string
): T[] {
  const rank = (m: T) => (m.id === youId ? 0 : m.left ? 2 : 1);
  const key = (m: T) => (m.etaMin == null ? -m.traveledM : m.etaMin);
  return [...members].sort((a, b) => rank(a) - rank(b) || key(a) - key(b));
}

export function rosterPile<T extends { id: string }>(
  members: T[],
  selectedId: string | null,
  max: number
): { shown: T[]; hidden: T[] } {
  if (max <= 0) return { shown: [], hidden: [...members] };

  const head = members.slice(0, max);
  const selected = selectedId ? members.find((member) => member.id === selectedId) : undefined;
  const shown =
    selected && !head.some((member) => member.id === selected.id)
      ? [...head.slice(0, max - 1), selected]
      : head;
  const hidden = members.filter((member) => !shown.some((s) => s.id === member.id));

  return { shown, hidden };
}
