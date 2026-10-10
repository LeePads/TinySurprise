import { formatBytes } from "../format-bytes";
import type { ExportMediaContribution } from "./types";

export function formatLargestMedia(items: ExportMediaContribution[]): string {
  return items
    .slice()
    .sort((a, b) => b.embeddedBytes - a.embeddedBytes)
    .slice(0, 3)
    .map(
      (item) =>
        `${item.label} · ${formatBytes(item.originalBytes, 2)} → ${formatBytes(item.embeddedBytes, 2)}`,
    )
    .join(", ");
}

export function findLargestContributor(
  items: ExportMediaContribution[],
): ExportMediaContribution | undefined {
  return items
    .slice()
    .sort((a, b) => b.embeddedBytes - a.embeddedBytes)[0];
}
