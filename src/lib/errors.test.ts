import { messageOf, onSurfacedError, surfaceError } from './errors';

describe('messageOf', () => {
  it('unwraps Errors, strings, and message-shaped objects', () => {
    expect(messageOf(new Error('boom'))).toBe('boom');
    expect(messageOf('plain')).toBe('plain');
    expect(messageOf({ message: 'from supabase' })).toBe('from supabase');
  });
  it('falls back for junk values', () => {
    expect(messageOf(undefined)).toBe('Something went wrong');
    expect(messageOf(42)).toBe('Something went wrong');
  });
});

describe('surfaceError', () => {
  it('notifies subscribers with context + message and unsubscribes cleanly', () => {
    const seen: string[] = [];
    const off = onSurfacedError((e) => seen.push(`${e.context}: ${e.message}`));
    surfaceError('Create session', new Error('network down'));
    off();
    surfaceError('Ignored', new Error('after unsubscribe'));
    expect(seen).toEqual(['Create session: network down']);
  });
});
