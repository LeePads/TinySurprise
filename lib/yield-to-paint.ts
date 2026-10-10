/**
 * Tiny scheduling helpers shared by the export paths.
 *
 * Export work (media reads, hashing, ZIP assembly, base64) starts in the same
 * task as the setState that turns the progress UI on, so without an explicit
 * yield React never gets to commit and paint — the screen just appears frozen
 * until the whole job finishes.
 */

/** One turn of the event loop. Enough to keep a long loop interruptible. */
export const yieldToEventLoop = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame === "function")
      requestAnimationFrame(() => resolve());
    else setTimeout(resolve, 0);
  });

/**
 * Resolves *after* the browser has painted the current frame. A single
 * requestAnimationFrame callback runs before paint, so one frame is not
 * enough to guarantee the spinner is actually on screen — the second frame is.
 */
export const yieldToPaint = () =>
  new Promise<void>((resolve) => {
    if (typeof requestAnimationFrame !== "function") {
      setTimeout(resolve, 0);
      return;
    }
    requestAnimationFrame(() => requestAnimationFrame(() => resolve()));
  });
