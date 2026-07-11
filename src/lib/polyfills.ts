/**
 * Hermes (React Native's JS engine) lacks structuredClone, which
 * @supabase/auth-js calls on every session operation — without this,
 * the first sign-in throws "Property 'structuredClone' doesn't exist".
 * JSON round-trip is sufficient for the plain session objects auth-js clones.
 * Import this before anything touches supabase (first import in _layout).
 */
if (typeof globalThis.structuredClone !== 'function') {
  globalThis.structuredClone = (value: unknown) =>
    value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}

export {};
