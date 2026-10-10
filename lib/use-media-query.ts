"use client";

import { useEffect, useState } from "react";

/** SSR-safe media query hook — defaults to false until mounted, then syncs live. */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState(false);

  useEffect(() => {
    const media = window.matchMedia(query);
    setMatches(media.matches);
    const listener = () => setMatches(media.matches);
    media.addEventListener("change", listener);
    return () => media.removeEventListener("change", listener);
  }, [query]);

  return matches;
}

// Shared "landscape phone or tablet" breakpoint: bottom nav / select sheets /
// the Appearance step's single-column layout all switch to their wide
// variant together, so the rule lives in one place instead of being
// duplicated per component.
const ANDROID_WIDE_LAYOUT_QUERY = "(orientation: landscape), (min-width: 600px)";

export function useAndroidWideLayout(): boolean {
  return useMediaQuery(ANDROID_WIDE_LAYOUT_QUERY);
}
