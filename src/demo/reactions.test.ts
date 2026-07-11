import { reactionsSig, toggleReaction } from './reactions';

describe('toggleReaction', () => {
  it('adds a first reaction', () => {
    expect(toggleReaction(undefined, '👍', 'you')).toEqual({ '👍': ['you'] });
  });

  it('stacks members on the same emoji', () => {
    const r = toggleReaction({ '👍': ['sarah'] }, '👍', 'you');
    expect(r['👍']).toEqual(['sarah', 'you']);
  });

  it('removes on second toggle and drops emptied emojis', () => {
    const r = toggleReaction({ '👍': ['you'] }, '👍', 'you');
    expect(r).toEqual({});
  });

  it('keeps other members when you remove yours', () => {
    const r = toggleReaction({ '👍': ['sarah', 'you'] }, '👍', 'you');
    expect(r['👍']).toEqual(['sarah']);
  });

  it('does not mutate the input', () => {
    const input = { '👍': ['sarah'] };
    toggleReaction(input, '👍', 'you');
    expect(input['👍']).toEqual(['sarah']);
  });
});

describe('reactionsSig', () => {
  it('is empty for none', () => {
    expect(reactionsSig(undefined)).toBe('');
  });
  it('encodes counts and your participation (order-independent)', () => {
    const sig = reactionsSig({ '👍': ['you', 'sarah'], '🎉': ['mike'] });
    expect(sig).toContain('👍2*');
    expect(sig).toContain('🎉1');
    expect(sig).toBe(reactionsSig({ '🎉': ['mike'], '👍': ['you', 'sarah'] }));
  });
  it('changes when a count changes', () => {
    const a = reactionsSig({ '👍': ['sarah'] });
    const b = reactionsSig({ '👍': ['sarah', 'mike'] });
    expect(a).not.toBe(b);
  });
});
