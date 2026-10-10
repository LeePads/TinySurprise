"use client";

import { useEffect } from "react";

const FOCUSABLE_SELECTOR =
  "input, textarea, select, [contenteditable], [role='textbox']";

/**
 * Owns the two page-level side effects a keyboard-safe builder needs, both
 * keyed off the single `keyboard.visible` value the caller already has —
 * deliberately NOT inside use-keyboard.ts itself, since that hook is called
 * from several components at once and none of them should be mutating
 * shared/global state independently (see its own doc comment).
 *
 * 1. `scroll-padding-bottom` on the document while the keyboard is open, so
 *    every scrollIntoView() call in the builder — not just one screen's —
 *    keeps its target clear of the sticky footer.
 * 2. Scrolls whatever is actually focused (`document.activeElement`) into
 *    view after the keyboard opens, timed with a double
 *    requestAnimationFrame so it runs after the collapsed-preview layout
 *    has actually painted, not before — a plain setTimeout guess would
 *    either fire too early (scrolling against the still-tall layout) or
 *    add unnecessary delay.
 */
export function useKeyboardSafeScroll(active: boolean, visible: boolean): void {
  useEffect(() => {
    if (!active || !visible) return;
    const root = document.documentElement;
    const previousPadding = root.style.scrollPaddingBottom;
    root.style.scrollPaddingBottom = "calc(4.5rem + env(safe-area-inset-bottom))";

    let frame1 = 0;
    let frame2 = 0;
    frame1 = requestAnimationFrame(() => {
      frame2 = requestAnimationFrame(() => {
        const focused = document.activeElement;
        if (focused instanceof HTMLElement && focused.matches(FOCUSABLE_SELECTOR)) {
          const reduceMotion = window.matchMedia(
            "(prefers-reduced-motion: reduce)",
          ).matches;
          focused.scrollIntoView({
            block: "center",
            behavior: reduceMotion ? "auto" : "smooth",
          });
        }
      });
    });

    return () => {
      cancelAnimationFrame(frame1);
      cancelAnimationFrame(frame2);
      root.style.scrollPaddingBottom = previousPadding;
    };
  }, [active, visible]);
}
