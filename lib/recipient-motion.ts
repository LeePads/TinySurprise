import { useReducedMotion } from "framer-motion";
import type { AnimationIntensity } from "./types";

export type RecipientMotionMode = "full" | "reduced";

/**
 * Recipient presentation follows one preference contract everywhere:
 * creator-selected reduced motion or the recipient's OS preference.
 * Other intensity values keep their existing template-specific meanings.
 */
export function resolveRecipientReducedMotion(
  animationIntensity: AnimationIntensity | undefined,
  prefersReducedMotion: boolean | null | undefined,
): boolean {
  return resolveRecipientMotionMode(animationIntensity, prefersReducedMotion) === "reduced";
}

export function resolveRecipientMotionMode(
  animationIntensity: AnimationIntensity | undefined,
  prefersReducedMotion: boolean | null | undefined,
): RecipientMotionMode {
  return animationIntensity === "reduced" || Boolean(prefersReducedMotion)
    ? "reduced"
    : "full";
}

export function useRecipientMotionMode(
  animationIntensity: AnimationIntensity | undefined,
): RecipientMotionMode {
  return resolveRecipientMotionMode(animationIntensity, useReducedMotion());
}

export function useRecipientReducedMotion(
  animationIntensity: AnimationIntensity | undefined,
): boolean {
  return useRecipientMotionMode(animationIntensity) === "reduced";
}
