import type { ActiveTemplateType } from "./template-registry";
import type { OpeningStyle } from "./types";
import type { BackgroundStyle, Theme } from "./types";
import { MAX_HEART_MEMORIES } from "./heart-memories";

export interface TemplateExperienceDefinition {
  id: ActiveTemplateType;
  limits: {
    recommendedMin?: number;
    recommendedMax?: number;
    compatibilityMax?: number;
    nested?: {
      rounds?: {
        recommendedMin?: number;
        recommendedMax?: number;
        compatibilityMax?: number;
      };
      optionsPerRound?: { min: number; max: number };
    };
    requiresPhoto?: boolean;
  };
  progress: {
    unit: string;
    activeLabel: string;
  };
  opening: {
    recommendedStyle: OpeningStyle;
    showCoverWithoutMusic: boolean;
  };
  defaultAppearance: {
    theme: Theme;
    backgroundStyle: BackgroundStyle;
  };
  capabilities: {
    backgroundMusic: boolean;
    localMedia: boolean;
    completion: boolean;
  };
}

export const TEMPLATE_EXPERIENCE_DEFINITIONS = {
  "catch-the-heart": {
    id: "catch-the-heart",
    limits: {
      recommendedMin: 1,
      recommendedMax: MAX_HEART_MEMORIES,
      compatibilityMax: MAX_HEART_MEMORIES,
    },
    progress: { unit: "memories", activeLabel: "{current} memories found" },
    opening: { recommendedStyle: "sparkle-pop", showCoverWithoutMusic: true },
    defaultAppearance: { theme: "soft-rose", backgroundStyle: "floating-hearts" },
    capabilities: { backgroundMusic: true, localMedia: true, completion: true },
  },
  "photo-puzzle": {
    id: "photo-puzzle",
    limits: { recommendedMin: 1, recommendedMax: 1, compatibilityMax: 1, requiresPhoto: true },
    progress: { unit: "puzzle", activeLabel: "Photo puzzle" },
    opening: { recommendedStyle: "gentle-fade", showCoverWithoutMusic: false },
    defaultAppearance: { theme: "sweet-sky", backgroundStyle: "soft" },
    capabilities: { backgroundMusic: false, localMedia: true, completion: true },
  },
  "open-when": {
    id: "open-when",
    limits: { recommendedMin: 2, recommendedMax: 6, compatibilityMax: 6 },
    progress: { unit: "letters", activeLabel: "{current} of {total} letters opened" },
    opening: { recommendedStyle: "envelope-reveal", showCoverWithoutMusic: true },
    defaultAppearance: { theme: "sunset-letter", backgroundStyle: "paper" },
    capabilities: { backgroundMusic: true, localMedia: true, completion: true },
  },
  "choose-our-date": {
    id: "choose-our-date",
    limits: {
      nested: {
        rounds: { recommendedMin: 2, recommendedMax: 3, compatibilityMax: 5 },
        optionsPerRound: { min: 2, max: 4 },
      },
    },
    progress: { unit: "rounds", activeLabel: "{remaining} little choices left" },
    opening: { recommendedStyle: "gift-unwrap", showCoverWithoutMusic: false },
    defaultAppearance: { theme: "peach-glow", backgroundStyle: "gradient" },
    capabilities: { backgroundMusic: true, localMedia: true, completion: true },
  },
  "memory-quiz": {
    id: "memory-quiz",
    limits: { recommendedMin: 3, recommendedMax: 6, compatibilityMax: 8 },
    progress: { unit: "questions", activeLabel: "Question {current} of {total}" },
    opening: { recommendedStyle: "sparkle-pop", showCoverWithoutMusic: false },
    defaultAppearance: { theme: "lavender-dream", backgroundStyle: "bokeh" },
    capabilities: { backgroundMusic: true, localMedia: true, completion: true },
  },
  "our-storybook": {
    id: "our-storybook",
    limits: { recommendedMin: 2, recommendedMax: 12, compatibilityMax: 20 },
    progress: { unit: "pages", activeLabel: "Page {current} of {total}" },
    opening: { recommendedStyle: "storybook-turn", showCoverWithoutMusic: true },
    defaultAppearance: { theme: "matcha-morning", backgroundStyle: "paper" },
    capabilities: { backgroundMusic: true, localMedia: true, completion: true },
  },
  "cozy-playlist": {
    id: "cozy-playlist",
    limits: { recommendedMin: 2, recommendedMax: 6, compatibilityMax: 12 },
    progress: { unit: "songs", activeLabel: "{current} songs explored" },
    opening: { recommendedStyle: "gentle-fade", showCoverWithoutMusic: true },
    defaultAppearance: { theme: "berry-cream", backgroundStyle: "scrapbook" },
    capabilities: { backgroundMusic: false, localMedia: true, completion: true },
  },
} satisfies Record<ActiveTemplateType, TemplateExperienceDefinition>;

export function getTemplateExperienceDefinition(
  template: ActiveTemplateType,
): TemplateExperienceDefinition {
  return TEMPLATE_EXPERIENCE_DEFINITIONS[template];
}

export type ContentLimitPolicy = "recommended" | "compatibility";

export interface CollectionLimitError {
  field: string;
  template: ActiveTemplateType;
  actual: number;
  maximum: number;
  message: string;
}

function count(value: unknown, key: string): number {
  if (!value || typeof value !== "object" || Array.isArray(value)) return 0;
  const collection = (value as Record<string, unknown>)[key];
  return Array.isArray(collection) ? collection.length : 0;
}

function countOptions(round: unknown): number {
  if (!round || typeof round !== "object" || Array.isArray(round)) return 0;
  const options = (round as Record<string, unknown>).options;
  return Array.isArray(options) ? options.length : 0;
}

export function getCollectionLimitErrors(
  template: ActiveTemplateType,
  content: unknown,
  policy: ContentLimitPolicy = "compatibility",
  allowIncomplete = false,
): CollectionLimitError[] {
  const definition = getTemplateExperienceDefinition(template);
  const limits = definition.limits;
  const maximum = policy === "recommended" ? limits.recommendedMax : limits.compatibilityMax;
  const errors: CollectionLimitError[] = [];
  const add = (field: string, actual: number, max: number | undefined, noun: string) => {
    if (max !== undefined && actual > max) {
      errors.push({
        field,
        template,
        actual,
        maximum: max,
        message: `This surprise contains ${actual} ${noun}. Tiny Surprise can safely open up to ${max}.`,
      });
    }
  };

  if (template === "choose-our-date") {
    const rounds = count(content, "rounds");
    const roundLimit = limits.nested?.rounds;
    add("rounds", rounds, policy === "recommended" ? roundLimit?.recommendedMax : roundLimit?.compatibilityMax, "date rounds");
    const optionsMax = limits.nested?.optionsPerRound?.max;
    const roundsValue = content && typeof content === "object" && !Array.isArray(content)
      ? (content as Record<string, unknown>).rounds
      : undefined;
    if (Array.isArray(roundsValue)) {
      roundsValue.forEach((round, index) => {
        const options = countOptions(round);
        const optionsMin = limits.nested?.optionsPerRound?.min;
        if (!allowIncomplete && optionsMin !== undefined && options < optionsMin) {
          errors.push({
            field: `rounds.${index}.options`,
            template,
            actual: options,
            maximum: optionsMin,
            message: `Round ${index + 1} needs at least ${optionsMin} choices before it can be shared.`,
          });
        } else if (optionsMax !== undefined && options > optionsMax) {
          errors.push({
            field: `rounds.${index}.options`,
            template,
            actual: options,
            maximum: optionsMax,
            message: `Round ${index + 1} contains ${options} choices. Tiny Surprise supports up to ${optionsMax} choices per round.`,
          });
        }
      });
    }
    return errors;
  }

  const collectionKey = {
    "catch-the-heart": ["hearts", "heart memories"],
    "photo-puzzle": ["photo", "photo"],
    "open-when": ["envelopes", "letters"],
    "memory-quiz": ["questions", "questions"],
    "our-storybook": ["pages", "pages"],
    "cozy-playlist": ["tracks", "playlist entries"],
  }[template] as [string, string];
  const actual = collectionKey[0] === "photo"
    ? content && typeof content === "object" && (content as Record<string, unknown>).photo ? 1 : 0
    : count(content, collectionKey[0]);
  add(collectionKey[0], actual, maximum, collectionKey[1]);
  return errors;
}

export function getRecommendedMinimum(
  template: ActiveTemplateType,
): number | undefined {
  return getTemplateExperienceDefinition(template).limits.recommendedMin ??
    getTemplateExperienceDefinition(template).limits.nested?.rounds?.recommendedMin;
}
