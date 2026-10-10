"use client";

import { useEffect, useState } from "react";

/**
 * Live viewport height via visualViewport (falls back to window.innerHeight
 * where visualViewport isn't available). Used instead of a CSS media query
 * for the short-landscape/keyboard-aware layout decisions specifically
 * because visualViewport is the one signal that reliably reflects the
 * *actual* usable height after the on-screen keyboard opens and after
 * rotation, rather than a layout viewport that may not shrink.
 */
export function useViewportHeight(): number {
  const [height, setHeight] = useState<number>(() =>
    typeof window === "undefined"
      ? 800
      : (window.visualViewport?.height ?? window.innerHeight),
  );

  useEffect(() => {
    const viewport = window.visualViewport;
    const sync = () => setHeight(viewport?.height ?? window.innerHeight);
    sync();
    viewport?.addEventListener("resize", sync);
    window.addEventListener("resize", sync);
    return () => {
      viewport?.removeEventListener("resize", sync);
      window.removeEventListener("resize", sync);
    };
  }, []);

  return height;
}
