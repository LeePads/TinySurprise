import type { ActiveTemplateType } from "./template-registry";
import { getTemplateExperienceDefinition } from "./template-experience-definitions";

export interface ExperienceProgress {
  current: number;
  total: number;
  label: string;
  complete: boolean;
  announce?: string;
}

export function createExperienceProgress(
  template: ActiveTemplateType,
  current: number,
  total: number,
  options?: { complete?: boolean; announce?: string },
): ExperienceProgress {
  const safeTotal = Math.max(0, total);
  const safeCurrent = Math.max(0, Math.min(current, safeTotal || current));
  const complete = options?.complete ?? (safeTotal > 0 && safeCurrent >= safeTotal);
  const definition = getTemplateExperienceDefinition(template);
  const remaining = Math.max(0, safeTotal - safeCurrent);
  const label = template === "choose-our-date"
    ? remaining === 1
      ? "One little choice left"
      : `${remaining} little choices left`
    : definition.progress.activeLabel
    .replaceAll("{current}", String(safeCurrent))
    .replaceAll("{total}", String(safeTotal))
    .replaceAll("{remaining}", String(remaining));
  return {
    current: safeCurrent,
    total: safeTotal,
    label,
    complete,
    announce: options?.announce || label,
  };
}
