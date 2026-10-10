"use client";

import { useMediaQuery } from "./use-media-query";
import { useViewportHeight } from "./use-viewport-height";

export type PreviewViewport = "available" | "mobile" | "desktop";

export type BuilderPreviewMode = "compact" | "short-landscape" | "wide";

// Below this live viewport height, a landscape screen is treated as "short"
// — too short for a real two-pane layout — regardless of width. Chosen so
// every phone landscape size in the test matrix (740x360, 844x390, 915x412)
// falls here, while landscape/portrait tablets (1024x768, 768x1024 is
// portrait so never reaches this check at all) land in "wide".
const SHORT_LANDSCAPE_MAX_HEIGHT = 520;

/**
 * Three explicit builder preview layout modes, replacing the old single
 * width-driven "twoPane" boolean that silently gave short landscape phones
 * (740-915px wide, always <520px tall) the exact same "collapsible preview
 * above the form" treatment as portrait — no distinct default-collapsed
 * state, so the preview still rendered at full width above the fields on
 * every landscape phone size.
 *
 * Deliberately NOT based on width alone (`min-width` media query): a
 * landscape query is used for orientation, but the short/wide split uses
 * the *live* visualViewport height (useViewportHeight), not a static CSS
 * breakpoint — so it also correctly reacts when the on-screen keyboard
 * eats enough of a tablet's height to make two-pane no longer viable, and
 * updates immediately on rotation.
 */
export function useBuilderPreviewMode(): BuilderPreviewMode {
  const isLandscape = useMediaQuery("(orientation: landscape)");
  const viewportHeight = useViewportHeight();

  if (!isLandscape) return "compact";
  return viewportHeight < SHORT_LANDSCAPE_MAX_HEIGHT ? "short-landscape" : "wide";
}
