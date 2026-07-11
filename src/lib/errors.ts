/**
 * App-wide error surfacing: anything that fails where the user can't see it
 * calls surfaceError(context, err) instead of a silent catch. The ErrorToast
 * host subscribes and shows a dismissible banner naming what failed.
 */

export interface SurfacedError {
  id: number;
  context: string;
  message: string;
  at: number;
}

type Listener = (e: SurfacedError) => void;

const listeners = new Set<Listener>();
let seq = 0;

export function surfaceError(context: string, err: unknown): void {
  const message = messageOf(err);
  // always visible to developers even if no host is mounted
  console.warn(`[${context}]`, message);
  const surfaced: SurfacedError = { id: ++seq, context, message, at: Date.now() };
  listeners.forEach((l) => l(surfaced));
}

export function onSurfacedError(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

/** Best human-readable message from unknown throw values. Exported for tests. */
export function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  if (typeof err === 'string') return err;
  if (err && typeof err === 'object' && 'message' in err) return String((err as { message: unknown }).message);
  return 'Something went wrong';
}
