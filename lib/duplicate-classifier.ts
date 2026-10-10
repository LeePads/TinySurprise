import type { CreationRecord } from "./creations";

/**
 * The one shared duplicate/conflict classification used by every backup and
 * import surface (Library backup, builder "Back up", Import a draft, the
 * built-in viewer, and native VIEW/SEND intent handling) — see
 * lib/creations.ts's resolveImportConflict/findDuplicateByContentHash, both
 * of which now delegate to classifyDuplicate() rather than each screen
 * comparing hashes itself.
 */
export type DuplicateState =
  | "MULTIPLE_RECEIVED_MATCHES"
  | "NEW"
  | "EXACT_DUPLICATE"
  | "SAME_ID_SAME_CONTENT"
  | "SAME_ID_CHANGED_CONTENT"
  | "SAME_CONTENT_DIFFERENT_ID"
  | "CREATED_ID_COLLISION"
  | "CREATED_CONTENT_COLLISION"
  | "INVALID_OR_UNVERIFIABLE";

export interface DuplicateClassification {
  state: DuplicateState;
  receivedMatches?: CreationRecord[];
  /** The existing record sharing `candidateId`, when one was given and found. */
  matchById?: CreationRecord;
  /** An incoming package's untrusted ID matched creator-owned data. */
  matchByCreatedId?: CreationRecord;
  /** An incoming package's ID matched a Received record. */
  matchByReceivedId?: CreationRecord;
  /** An incoming package's content matched creator-owned data. */
  matchByCreatedContent?: CreationRecord;
  /** An incoming package's content matched Received data. */
  matchByReceivedContent?: CreationRecord;
  /** The existing record sharing the content hash (may be the same record as matchById). */
  matchByContent?: CreationRecord;
}

/**
 * Pure classification — callers fetch `existing` once (usually via
 * listCreations()) rather than this function touching storage itself, so it
 * stays trivially testable and reusable from both IndexedDB-backed screens
 * and (in a worker, where IndexedDB isn't reliably available) a plain array
 * handed over from the main thread.
 */
export function classifyDuplicate(params: {
  contentHash?: string;
  /** The creation id this content is *for*, if any: a library item's own id when backing it up, or a package's manifest sourceCreationId when importing. */
  candidateId?: string;
  /** Incoming package IDs are hints only and may target Received records, never Created records. */
  candidateDomain?: "created" | "incoming-package";
  existing: CreationRecord[];
}): DuplicateClassification {
  const {
    contentHash,
    candidateId,
    candidateDomain = "created",
    existing,
  } = params;
  if (!contentHash) return { state: "INVALID_OR_UNVERIFIABLE" };

  const matchByCreatedContent =
    candidateDomain === "incoming-package"
      ? existing.find(
          (creation) =>
            creation.contentHash === contentHash &&
            creation.status !== "imported",
        )
      : undefined;
  const matchByReceivedContent =
    candidateDomain === "incoming-package"
      ? existing.find(
          (creation) =>
            creation.contentHash === contentHash &&
            creation.status === "imported",
        )
      : undefined;
  const matchByContent =
    candidateDomain === "incoming-package"
      ? matchByReceivedContent || matchByCreatedContent
      : existing.find((creation) => creation.contentHash === contentHash);
  const matchByCreatedId =
    candidateDomain === "incoming-package" && candidateId
      ? existing.find(
          (creation) =>
            creation.id === candidateId && creation.status !== "imported",
        )
      : undefined;
  const receivedMatches = candidateDomain === "incoming-package" && candidateId
    ? existing.filter((creation) => creation.status === "imported" && (creation.importSourceCreationId === candidateId || creation.id === candidateId)) : [];
  const matchByReceivedId = receivedMatches.length === 1 ? receivedMatches[0] : undefined;
  if (receivedMatches.length > 1 && !matchByReceivedContent) return { state: "MULTIPLE_RECEIVED_MATCHES", receivedMatches };
  const matchById =
    candidateId && candidateDomain !== "incoming-package"
      ? existing.find((creation) => creation.id === candidateId)
      : matchByReceivedId;

  // A Created collision is a cross-domain collision, not a replaceable
  // same-record conflict. If a Received record happens to share the same ID,
  // prefer that Received record for the ordinary replace flow while keeping
  // the Created match attached for static/UI evidence.
  if (matchByCreatedId && !matchByReceivedId) {
    return {
      state: "CREATED_ID_COLLISION",
      matchByCreatedId,
      matchByCreatedContent,
      matchByContent,
    };
  }

  if (
    candidateDomain === "incoming-package" &&
    matchByCreatedContent &&
    !matchByReceivedContent &&
    !matchById
  ) {
    return {
      state: "CREATED_CONTENT_COLLISION",
      matchByCreatedContent,
      matchByContent,
    };
  }

  if (matchById) {
    return matchById.contentHash === contentHash
      ? {
          state: "SAME_ID_SAME_CONTENT",
          matchById,
          matchByReceivedId,
          matchByCreatedId,
          matchByReceivedContent,
          matchByCreatedContent,
          matchByContent,
        }
      : {
          state: "SAME_ID_CHANGED_CONTENT",
          matchById,
          matchByReceivedId,
          matchByCreatedId,
          matchByReceivedContent,
          matchByCreatedContent,
          matchByContent,
        };
  }
  if (matchByContent) {
    return candidateId
      ? { state: "SAME_CONTENT_DIFFERENT_ID", matchByContent }
      : { state: "EXACT_DUPLICATE", matchByContent };
  }
  return { state: "NEW" };
}

/**
 * One shared copy source for every backup/import conflict surface (Library,
 * builder "Back up", Import a draft, the built-in viewer) — so the wording
 * from Sections E/F of a duplicate-handling spec stays consistent instead of
 * each screen inventing its own phrasing for the same state.
 */
export function describeDuplicateState(
  mode: "backup" | "import",
  state: DuplicateState,
  existingTitle?: string,
): { title: string; message: string } | undefined {
  const name = existingTitle ? `"${existingTitle}"` : "this surprise";
  if (mode === "backup") {
    switch (state) {
      case "EXACT_DUPLICATE":
      case "SAME_ID_SAME_CONTENT":
        return {
          title: "This surprise is already backed up",
          message: `Nothing has changed since the last backup of ${name}.`,
        };
      case "SAME_ID_CHANGED_CONTENT":
        return {
          title: "This surprise has changed since its last backup",
          message: `${name} has changed since the last backup was made.`,
        };
      case "SAME_CONTENT_DIFFERENT_ID":
        return {
          title: "An identical backup already exists",
          message: `The content matches ${name}, saved separately.`,
        };
      case "CREATED_ID_COLLISION":
        return {
          title: "Your own surprise will stay unchanged",
          message: `${name} is a surprise you made. This file will be restored separately in Received. Your own surprise stays unchanged.`,
        };
      case "CREATED_CONTENT_COLLISION":
        return {
          title: "This matches a surprise you made",
          message: `${name} is a surprise you made. This file will be restored as a separate Received surprise.`,
        };
      case "INVALID_OR_UNVERIFIABLE":
        return {
          title: "We couldn't verify this backup",
          message: "The file may be incomplete or from an unsupported version.",
        };
      default:
        return undefined;
    }
  }
  switch (state) {
    case "MULTIPLE_RECEIVED_MATCHES":
      return { title: "Several saved versions match", message: "Choose a Received version to replace, or save a separate copy. Your created surprises are protected." };
    case "EXACT_DUPLICATE":
    case "SAME_ID_SAME_CONTENT":
      return {
        title: "You already have this surprise",
        message: `It matches ${name}, which is already saved on this device.`,
      };
    case "SAME_ID_CHANGED_CONTENT":
      return {
        title: "You already have another version of this surprise",
        message: `${name} has some differences from this version.`,
      };
    case "SAME_CONTENT_DIFFERENT_ID":
      return {
        title: "You already have an identical surprise",
        message: `The content matches ${name}, saved separately.`,
      };
    case "CREATED_ID_COLLISION":
      return {
        title: "Your own surprise will stay unchanged",
        message: `${name} is a surprise you made. This file will be saved separately in Received. Your own surprise stays unchanged.`,
      };
    case "CREATED_CONTENT_COLLISION":
      return {
        title: "This matches a surprise you made",
        message: `${name} is a surprise you made. This file will be saved as a separate Received surprise.`,
      };
    case "INVALID_OR_UNVERIFIABLE":
      return {
        title: "We couldn't verify this Tiny Surprise file",
        message: "It may be incomplete, changed, or from an unsupported version.",
      };
    default:
      return undefined;
  }
}
