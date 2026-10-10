import type { PhotoPuzzleContent, SurpriseData } from "./types";
import { isSurpriseDataRecord } from "./builder-draft";
import {
  isPlayableMemoryQuizContent,
} from "./memory-quiz";
import { isPlayableStorybookContent } from "./storybook";
import { isPlayableCozyPlaylistContent } from "./cozy-playlist";
import { photoPuzzlePackageMediaError } from "./photo-puzzle-validation";
import { validateImportedContent, validateDelight, validateMusic } from "./validation";
import { recipientMediaError } from "./media-validation";
import { assertMediaIdentityConsistency } from "./local-media";

/**
 * Single compatibility/playability gate for finalized package data.
 *
 * Drafts intentionally do not use this predicate: the builder may autosave
 * incomplete work. Imported/package data, replacement data, and Received
 * persistence must pass it before any conflict or write decision is made.
 * Package pre-attachment checks may defer image decoding until original bytes
 * are attached; all finalized/persistence callers use the default full check.
 */
export async function getImportedDataValidationError(
  data: SurpriseData,
  requireDecodeImages = true,
): Promise<string | undefined> {
  if (!isSurpriseDataRecord(data)) {
    return "This imported surprise contains invalid or corrupted data.";
  }

  if (data.template !== "photo-puzzle") {
    const contentResult = validateImportedContent(data.template, data.content);
    if (!contentResult.valid) return contentResult.errors[0]?.message;
  }
  const delight = data.delight?.passphraseQuestion === undefined
    ? { ...data.delight, passphraseQuestion: "A little secret, just for you" } : data.delight;
  const settingsError = [...validateDelight(delight).errors, ...validateMusic(data.music).errors][0];
  if (settingsError) return settingsError.message;
  const mediaError = await recipientMediaError(data, requireDecodeImages);
  if (mediaError) return mediaError;
  try { await assertMediaIdentityConsistency(data); }
  catch (error) { return error instanceof Error ? error.message : "Conflicting media identities were found."; }

  if (
    data.template === "memory-quiz" &&
    !isPlayableMemoryQuizContent(data.content, "compatibility")
  ) {
    return "This imported surprise contains an incomplete Memory Quiz.";
  }
  if (
    data.template === "our-storybook" &&
    !isPlayableStorybookContent(data.content, "compatibility")
  ) {
    return "This imported surprise contains an incomplete Storybook.";
  }
  if (
    data.template === "cozy-playlist" &&
    !isPlayableCozyPlaylistContent(data.content, "compatibility")
  ) {
    return "This imported surprise contains an incomplete Cozy Playlist.";
  }

  if (data.template === "photo-puzzle") {
    const content = data.content as PhotoPuzzleContent;
    // Older puzzles intentionally use completionMessage as their final note.
    if (!content.completionMessage.trim()) return "Add the puzzle completion message before sharing.";
    return photoPuzzlePackageMediaError(content, false, requireDecodeImages);
  }

  return undefined;
}
