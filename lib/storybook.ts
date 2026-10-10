import { getTemplateExperienceDefinition } from "./template-experience-definitions";
import type {
  OurStorybookContent,
  StoryPage,
  StoryPageComposition,
} from "./types";

type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

const isNonBlankString = (value: unknown): value is string =>
  typeof value === "string" && value.trim().length > 0;

const STORY_PAGE_COMPOSITIONS = new Set<StoryPageComposition>([
  "auto",
  "photo-note",
  "photo-led",
  "note-focused",
  "split",
]);

export type StorybookValidationPolicy = "recommended" | "compatibility";

export interface StorybookValidationIssue {
  field: string;
  message: string;
}

function storybookMaximum(policy: StorybookValidationPolicy): number {
  const limits = getTemplateExperienceDefinition("our-storybook").limits;
  return limits[policy === "recommended" ? "recommendedMax" : "compatibilityMax"] ?? 20;
}

export function isStoryPageComposition(value: unknown): value is StoryPageComposition {
  return typeof value === "string" && STORY_PAGE_COMPOSITIONS.has(value as StoryPageComposition);
}

export function normalizeStoryPageComposition(value: unknown): StoryPageComposition {
  return isStoryPageComposition(value)
    ? (value as StoryPageComposition)
    : "auto";
}

/**
 * Repairs only Storybook identity/layout metadata. Existing unique IDs and
 * page order/content are preserved; blank/missing IDs and later duplicates
 * receive deterministic collision-free replacements. Invalid explicit
 * compositions become the existing automatic layout contract.
 */
export function normalizeStorybookContent<T>(content: T): T {
  if (!isRecord(content) || !Array.isArray(content.pages)) return content;

  const reservedIds = new Set<string>();
  for (const page of content.pages) {
    if (isRecord(page) && isNonBlankString(page.id))
      reservedIds.add(page.id);
  }

  const usedIds = new Set<string>();
  let changed = false;
  const pages = content.pages.map((page, index) => {
    if (!isRecord(page)) return page;

    let normalizedPage = page;
    const id = isNonBlankString(page.id) ? page.id : undefined;
    if (id && !usedIds.has(id)) {
      usedIds.add(id);
    } else {
      const base = `storybook-page-repaired-${index + 1}`;
      let repairedId = base;
      let suffix = 2;
      while (reservedIds.has(repairedId) || usedIds.has(repairedId))
        repairedId = `${base}-${suffix++}`;
      usedIds.add(repairedId);
      normalizedPage = { ...normalizedPage, id: repairedId };
      changed = true;
    }

    if (
      page.composition !== undefined &&
      normalizeStoryPageComposition(page.composition) !== page.composition
    ) {
      normalizedPage = {
        ...normalizedPage,
        composition: "auto",
      };
      changed = true;
    }

    return normalizedPage;
  });

  return changed ? ({ ...content, pages } as T) : content;
}

/** Normalize Storybook content inside a complete SurpriseData-shaped value. */
export function normalizeStorybookData<T>(value: T): T {
  if (!isRecord(value) || value.template !== "our-storybook") return value;
  const content = normalizeStorybookContent(value.content);
  return content === value.content ? value : ({ ...value, content } as T);
}

/** Normalize Storybook content inside a persisted builder-draft record. */
export function normalizeStorybookDraftRecord<T>(value: T): T {
  if (!isRecord(value) || !isRecord(value.data)) return value;
  const data = normalizeStorybookData(value.data);
  return data === value.data ? value : ({ ...value, data } as T);
}

/**
 * Strict compatibility invariant for any Storybook that can be rendered,
 * received, imported, or exported. Drafts may remain incomplete while being
 * edited; those paths must not use this predicate until they are playable.
 */
export function getStorybookPlayableIssues(
  value: unknown,
  policy: StorybookValidationPolicy = "compatibility",
): StorybookValidationIssue[] {
  const issues: StorybookValidationIssue[] = [];
  if (!isRecord(value))
    return [{ field: "pages", message: "Add playable Storybook pages before continuing." }];

  const pages = value.pages;
  const maximum = storybookMaximum(policy);
  if (!Array.isArray(pages) || pages.length < 2 || pages.length > maximum) {
    issues.push({
      field: "pages",
      message: `Add between 2 and ${maximum} Storybook pages.`,
    });
  }

  const seenIds = new Set<string>();
  if (Array.isArray(pages)) {
    pages.forEach((page, index) => {
      const field = `pages.${index}`;
      if (!isRecord(page)) {
        issues.push({ field, message: `Complete Storybook page ${index + 1}.` });
        return;
      }
      if (!isNonBlankString(page.id)) {
        issues.push({
          field: `${field}.id`,
          message: `Give Storybook page ${index + 1} a stable ID before continuing.`,
        });
      } else if (seenIds.has(page.id)) {
        issues.push({
          field: `${field}.id`,
          message: `Give Storybook page ${index + 1} a unique stable ID before continuing.`,
        });
      } else {
        seenIds.add(page.id);
      }
      if (!isNonBlankString(page.title)) {
        issues.push({
          field: `${field}.title`,
          message: `Add a title for Storybook page ${index + 1}.`,
        });
      }
      if (!isNonBlankString(page.body)) {
        issues.push({
          field: `${field}.body`,
          message: `Add the story for Storybook page ${index + 1}.`,
        });
      }
      if (page.composition !== undefined && !isStoryPageComposition(page.composition)) {
        issues.push({
          field: `${field}.composition`,
          message: `Choose a supported composition for Storybook page ${index + 1}.`,
        });
      }
    });
  }

  if (!isNonBlankString(value.finalMessage)) {
    issues.push({
      field: "finalMessage",
      message: "Add the final Storybook message before continuing.",
    });
  }
  return issues;
}

export function isPlayableStorybookContent(
  value: unknown,
  policy: StorybookValidationPolicy = "compatibility",
): boolean {
  return getStorybookPlayableIssues(value, policy).length === 0;
}

export function resolveStoryPageComposition(page: StoryPage): Exclude<StoryPageComposition, "auto"> {
  const selected = normalizeStoryPageComposition(page.composition);
  if (selected !== "auto") return selected;
  if (!page.photo) return "note-focused";
  if (page.body.trim().length < 150) return "photo-led";
  if (page.body.trim().length > 420) return "photo-note";
  return "split";
}
