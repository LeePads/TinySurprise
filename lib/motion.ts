/** Shared timing for routine product motion. Recipient-specific reveals can
 * intentionally run longer, but dialogs, sheets, and builder continuity use
 * this small predictable set. */
export const MOTION = {
  fast: 0.16,
  standard: 0.2,
  overlay: 0.22,
  reveal: 0.4,
} as const;

export const MOTION_EASE = [0.16, 1, 0.3, 1] as const;
export const MOTION_EXIT_EASE = [0.4, 0, 1, 1] as const;
