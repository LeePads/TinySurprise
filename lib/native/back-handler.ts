/**
 * Centralized hardware-back-button interception. Screens that manage their
 * own internal "steps" (the builder wizard) push a handler here; the
 * Android back button consults the stack top-down before falling back to
 * router navigation / exiting the app. Kept as a plain module-level stack
 * (not React state) since NativeAppShell's listener and the builder page
 * mount independently and only one of them needs to react per press.
 */
export type BackHandler = () => boolean;

const stack: BackHandler[] = [];

/** Registers a handler; returns an unregister function for effect cleanup. */
export function registerBackHandler(handler: BackHandler): () => void {
  stack.push(handler);
  return () => {
    const index = stack.indexOf(handler);
    if (index !== -1) stack.splice(index, 1);
  };
}

/** Runs handlers newest-first; returns true if one of them handled the press. */
export function runBackHandlers(): boolean {
  for (let i = stack.length - 1; i >= 0; i--) {
    try {
      if (stack[i]()) return true;
    } catch {
      // A misbehaving handler shouldn't block the rest of the back-press pipeline.
    }
  }
  return false;
}
