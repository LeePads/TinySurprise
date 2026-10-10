import type { AcceptedTemplateType, ActiveTemplateType } from "./template-registry";
import type { SurpriseData } from "./types";

export interface ExperienceCompletion {
  eyebrow: string;
  title: string;
  completionMessage?: string;
  finalMessage: string;
  closingMessage?: string;
  signature?: string;
  primaryAction: string;
  secondaryAction?: string;
}

export const DEFAULT_CLOSING_MESSAGE = "Made just for you";

const normalizeCopy = (value: string) =>
  value.toLocaleLowerCase().replace(/[\p{P}\p{S}\s]+/gu, "").trim();

function distinctClosing(finalMessage: string, closingMessage?: string): string | undefined {
  const closing = closingMessage?.trim();
  if (!closing || normalizeCopy(closing) === normalizeCopy(DEFAULT_CLOSING_MESSAGE)) return undefined;
  const final = normalizeCopy(finalMessage);
  const candidate = normalizeCopy(closing);
  if (!candidate) return undefined;
  if (!final || final === candidate || final.includes(candidate) || candidate.includes(final)) return undefined;
  return closing;
}

function finalMessageFor(template: AcceptedTemplateType, content: unknown): string {
  if (!content || typeof content !== "object" || Array.isArray(content)) return "";
  const value = content as Record<string, unknown>;
  const authored = typeof value.finalMessage === "string" ? value.finalMessage.trim() : "";
  if (authored) return authored;
  if (template === "photo-puzzle") {
    return typeof value.completionMessage === "string" ? value.completionMessage.trim() : "";
  }
  if (template === "choose-our-date") {
    const result = value.result;
    if (result && typeof result === "object" && !Array.isArray(result)) {
      return typeof (result as Record<string, unknown>).invitation === "string"
        ? String((result as Record<string, unknown>).invitation).trim()
        : "";
    }
  }
  return "";
}

function completionMessageFor(template: AcceptedTemplateType, content: unknown): string | undefined {
  if (template !== "photo-puzzle" || !content || typeof content !== "object" || Array.isArray(content)) return undefined;
  const value = content as Record<string, unknown>;
  return typeof value.completionMessage === "string"
    ? value.completionMessage.trim() || undefined
    : undefined;
}

const completionCopy: Record<AcceptedTemplateType, { eyebrow: string; title: string; primaryAction: string }> = {
  "catch-the-heart": { eyebrow: "Every memory found you", title: "All the little pieces are here", primaryAction: "Catch them again" },
  "photo-puzzle": { eyebrow: "The memory is back together", title: "You solved it", primaryAction: "Solve it again" },
  "open-when": { eyebrow: "Every letter found you", title: "One last note", primaryAction: "Read them again" },
  "choose-our-date": { eyebrow: "A tiny plan made for us", title: "It's a date", primaryAction: "Choose again" },
  "memory-quiz": { eyebrow: "The memories stayed with you", title: "The score was never the important part", primaryAction: "Remember them again" },
  "our-storybook": { eyebrow: "The story keeps unfolding", title: "The last page - for now", primaryAction: "Read it again" },
  "cozy-playlist": { eyebrow: "A soundtrack for us", title: "Keep this little playlist close", primaryAction: "Listen again" },
  "wish-upon-a-star": { eyebrow: "Our constellation is complete", title: "Every wish found its place", primaryAction: "Explore again" },
};

export function resolveExperienceCompletionParts(
  template: AcceptedTemplateType,
  content: unknown,
  closingMessage?: string,
  signature?: string,
): ExperienceCompletion {
  const copy = completionCopy[template];
  const finalMessage = finalMessageFor(template, content);
  return {
    ...copy,
    completionMessage: completionMessageFor(template, content),
    finalMessage,
    closingMessage: distinctClosing(finalMessage, closingMessage),
    signature: signature?.trim() || undefined,
  };
}

export function resolveExperienceCompletion(data: SurpriseData): ExperienceCompletion {
  return resolveExperienceCompletionParts(
    data.template as ActiveTemplateType,
    data.content,
    data.delight?.closingMessage,
    data.delight?.signature,
  );
}
