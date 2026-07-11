/** Reactions on feed events: emoji → member ids. Pure helpers, tested. */

export type Reactions = Record<string, string[]>;

export const REACTION_EMOJIS = ['👍', '❤️', '😂', '🎉'] as const;

/** Toggle `memberId` on `emoji`; returns a new map, drops emptied emojis. */
export function toggleReaction(
  reactions: Reactions | undefined,
  emoji: string,
  memberId: string
): Reactions {
  const next: Reactions = { ...(reactions ?? {}) };
  const has = next[emoji]?.includes(memberId);
  if (has) {
    const rest = next[emoji].filter((id) => id !== memberId);
    if (rest.length) next[emoji] = rest;
    else delete next[emoji];
  } else {
    next[emoji] = [...(next[emoji] ?? []), memberId];
  }
  return next;
}

/** Cheap change signature for memo comparators: "👍2·🎉1(you)". */
export function reactionsSig(reactions: Reactions | undefined, viewerId = 'you'): string {
  if (!reactions) return '';
  return Object.entries(reactions)
    .map(([e, ids]) => `${e}${ids.length}${ids.includes(viewerId) ? '*' : ''}`)
    .sort()
    .join('·');
}
