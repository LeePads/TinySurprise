import { getTemplateExperienceDefinition } from "./template-experience-definitions";

export type MemoryQuizValidationPolicy = "recommended" | "compatibility";

export interface MemoryQuizIssue {
  field: string;
  message: string;
}

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function memoryQuizMax(policy: MemoryQuizValidationPolicy): number {
  const limits = getTemplateExperienceDefinition("memory-quiz").limits;
  return limits[policy === "recommended" ? "recommendedMax" : "compatibilityMax"] ?? 8;
}

function repairedQuestionId(index: number, reserved: Set<string>): string {
  const base = `quiz-question-repaired-${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (reserved.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Repairs only the identity metadata needed to keep a quiz addressable.
 * Existing non-blank, unique IDs are preserved exactly for compatibility.
 * Missing and later duplicate IDs receive deterministic, collision-free IDs.
 */
export function normalizeMemoryQuizQuestionIds<T>(content: T): T {
  if (!isRecord(content) || !Array.isArray(content.questions)) return content;

  const questions = content.questions;
  const reserved = new Set<string>();
  for (const question of questions) {
    if (isRecord(question) && isNonBlankString(question.id)) {
      reserved.add(question.id);
    }
  }

  const used = new Set<string>();
  let changed = false;
  const normalizedQuestions = questions.map((question, index) => {
    if (!isRecord(question)) return question;
    const id = question.id;
    if (isNonBlankString(id) && !used.has(id)) {
      used.add(id);
      return question;
    }

    const repairedId = repairedQuestionId(index, reserved);
    reserved.add(repairedId);
    used.add(repairedId);
    changed = true;
    return { ...question, id: repairedId };
  });

  if (!changed) return content;
  return { ...content, questions: normalizedQuestions } as T;
}

/** Normalize Memory Quiz identity metadata inside a complete SurpriseData record. */
export function normalizeMemoryQuizData<T>(value: T): T {
  if (!isRecord(value) || value.template !== "memory-quiz") return value;
  return {
    ...value,
    content: normalizeMemoryQuizQuestionIds(value.content),
  } as T;
}

/** Normalize Memory Quiz identity metadata inside a persisted builder draft. */
export function normalizeMemoryQuizDraftRecord<T>(value: T): T {
  if (!isRecord(value)) return value;
  return {
    ...value,
    data: normalizeMemoryQuizData(value.data),
  } as T;
}

/**
 * Strict recipient/playability invariant. Drafts may remain incomplete while
 * being edited, but anything imported, rendered, or exported must satisfy it.
 */
export function getMemoryQuizPlayableIssues(
  value: unknown,
  policy: MemoryQuizValidationPolicy = "compatibility",
): MemoryQuizIssue[] {
  const issues: MemoryQuizIssue[] = [];
  if (!isRecord(value)) {
    return [{ field: "questions", message: "Add playable quiz questions before continuing." }];
  }

  const questions = value.questions;
  const max = memoryQuizMax(policy);
  if (!Array.isArray(questions) || questions.length < 3 || questions.length > max) {
    issues.push({
      field: "questions",
      message: `Add between 3 and ${max} questions.`,
    });
  }

  const seenIds = new Set<string>();
  if (Array.isArray(questions)) {
    questions.forEach((question, index) => {
      const field = `questions.${index}`;
      if (!isRecord(question)) {
        issues.push({ field, message: `Complete question ${index + 1}.` });
        return;
      }

      if (!isNonBlankString(question.id)) {
        issues.push({
          field: `${field}.id`,
          message: `Give question ${index + 1} a stable ID before continuing.`,
        });
      } else if (seenIds.has(question.id)) {
        issues.push({
          field: `${field}.id`,
          message: `Give question ${index + 1} a unique stable ID before continuing.`,
        });
      } else {
        seenIds.add(question.id);
      }

      if (!isNonBlankString(question.prompt)) {
        issues.push({
          field: `${field}.prompt`,
          message: `Add question ${index + 1} before continuing.`,
        });
      }

      const answers = question.answers;
      if (
        !Array.isArray(answers) ||
        answers.length < 2 ||
        answers.length > 12 ||
        answers.some((answer) => typeof answer !== "string")
      ) {
        issues.push({
          field: `${field}.answers`,
          message: `Add at least two answer choices for question ${index + 1}.`,
        });
      }

      const filledAnswers = Array.isArray(answers)
        ? answers.filter((answer): answer is string => isNonBlankString(answer))
        : [];
      if (filledAnswers.length < 2) {
        issues.push({
          field: `${field}.answers`,
          message: `Add at least two answer choices for question ${index + 1}.`,
        });
      }

      const correctIndex = question.correctIndex;
      const correctAnswer =
        Array.isArray(answers) && Number.isInteger(correctIndex)
          ? answers[Number(correctIndex)]
          : undefined;
      if (!isNonBlankString(correctAnswer)) {
        issues.push({
          field: `${field}.correctIndex`,
          message: `Mark the correct answer for question ${index + 1}.`,
        });
      }

      if (typeof question.memoryNote !== "string") {
        issues.push({
          field: `${field}.memoryNote`,
          message: `Complete the memory note for question ${index + 1}.`,
        });
      }
    });
  }

  if (!isNonBlankString(value.finalMessage)) {
    issues.push({
      field: "finalMessage",
      message: "Add the final quiz message before continuing.",
    });
  }
  return issues;
}

export function isPlayableMemoryQuizContent(
  value: unknown,
  policy: MemoryQuizValidationPolicy = "compatibility",
): boolean {
  return getMemoryQuizPlayableIssues(value, policy).length === 0;
}
