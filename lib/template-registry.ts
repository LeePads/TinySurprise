/**
 * The product registry is deliberately small and explicit. Compatibility
 * templates remain readable without becoming discoverable creation options.
 */
export const ACTIVE_TEMPLATE_IDS = [
  "catch-the-heart",
  "photo-puzzle",
  "open-when",
  "choose-our-date",
  "memory-quiz",
  "our-storybook",
  "cozy-playlist",
] as const;

export type ActiveTemplateType = (typeof ACTIVE_TEMPLATE_IDS)[number];

export const COMPATIBILITY_TEMPLATE_IDS = ["wish-upon-a-star"] as const;

export type CompatibilityTemplateType =
  (typeof COMPATIBILITY_TEMPLATE_IDS)[number];

export type AcceptedTemplateType =
  | ActiveTemplateType
  | CompatibilityTemplateType;

export const ACCEPTED_TEMPLATE_IDS = [
  ...ACTIVE_TEMPLATE_IDS,
  ...COMPATIBILITY_TEMPLATE_IDS,
] as const;

const ACCEPTED_TEMPLATE_SET = new Set<string>(ACCEPTED_TEMPLATE_IDS);

export function isAcceptedTemplateType(
  value: unknown,
): value is AcceptedTemplateType {
  return typeof value === "string" && ACCEPTED_TEMPLATE_SET.has(value);
}
