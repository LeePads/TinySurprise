import { MAX_AUDIO_FILE_BYTES, MAX_PLAYLIST_AUDIO_BYTES } from "./music";
import { normalizeHttpUrl } from "./safe-url";
import { getTemplateExperienceDefinition } from "./template-experience-definitions";

type UnknownRecord = Record<string, unknown>;

function isRecord(value: unknown): value is UnknownRecord {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function isNonBlankString(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function playlistMaximum(): number {
  return (
    getTemplateExperienceDefinition("cozy-playlist").limits.compatibilityMax ||
    12
  );
}

function repairedTrackId(index: number, reserved: Set<string>): string {
  const base = `playlist-track-repaired-${index + 1}`;
  let candidate = base;
  let suffix = 2;
  while (reserved.has(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

/**
 * Repairs only Playlist identity metadata. Existing unique IDs, order, text,
 * source fields, and media references are preserved. Missing IDs and later
 * duplicate occurrences receive stable collision-free replacements.
 */
export function normalizeCozyPlaylistContent<T>(content: T): T {
  if (!isRecord(content) || !Array.isArray(content.tracks)) return content;

  const reservedIds = new Set<string>();
  for (const track of content.tracks) {
    if (isRecord(track) && isNonBlankString(track.id))
      reservedIds.add(track.id);
  }

  const usedIds = new Set<string>();
  let changed = false;
  const tracks = content.tracks.map((track, index) => {
    if (!isRecord(track)) return track;
    const id = isNonBlankString(track.id) ? track.id : undefined;
    if (id && !usedIds.has(id)) {
      usedIds.add(id);
      return track;
    }

    const repairedId = repairedTrackId(index, reservedIds);
    reservedIds.add(repairedId);
    usedIds.add(repairedId);
    changed = true;
    return { ...track, id: repairedId };
  });

  return changed ? ({ ...content, tracks } as T) : content;
}

/** Normalize Playlist identity metadata inside a complete SurpriseData record. */
export function normalizeCozyPlaylistData<T>(value: T): T {
  if (!isRecord(value) || value.template !== "cozy-playlist") return value;
  const content = normalizeCozyPlaylistContent(value.content);
  return content === value.content ? value : ({ ...value, content } as T);
}

/** Normalize Playlist identity metadata inside a persisted builder record. */
export function normalizeCozyPlaylistDraftRecord<T>(value: T): T {
  if (!isRecord(value) || !isRecord(value.data)) return value;
  const data = normalizeCozyPlaylistData(value.data);
  return data === value.data ? value : ({ ...value, data } as T);
}

/**
 * The structural record guard still permits blank authored fields while a
 * draft is being edited. Count and identity are invariant even for drafts,
 * because they are used by keys, DOM IDs, and explored state.
 */
export function hasCanonicalCozyPlaylistIdentity(value: unknown): boolean {
  if (!isRecord(value) || !Array.isArray(value.tracks)) return false;
  if (value.tracks.length < 2 || value.tracks.length > playlistMaximum())
    return false;

  const ids = new Set<string>();
  return value.tracks.every((track) => {
    if (!isRecord(track) || !isNonBlankString(track.id)) return false;
    if (ids.has(track.id)) return false;
    ids.add(track.id);
    return true;
  });
}

export type CozyPlaylistValidationPolicy = "recommended" | "compatibility";

export interface CozyPlaylistValidationIssue {
  field: string;
  message: string;
}

function hasAudioPayload(value: unknown): value is UnknownRecord {
  if (!isRecord(value)) return false;
  return isNonBlankString(value.previewUrl) || isNonBlankString(value.dataUrl);
}

/**
 * Strict invariant for imported, received, rendered, or exported Playlist
 * content. Compatibility mode intentionally allows source-less legacy
 * interludes; recommended mode retains the current authoring source rule.
 */
export function getCozyPlaylistPlayableIssues(
  value: unknown,
  policy: CozyPlaylistValidationPolicy = "compatibility",
): CozyPlaylistValidationIssue[] {
  const issues: CozyPlaylistValidationIssue[] = [];
  if (!isRecord(value))
    return [
      {
        field: "tracks",
        message: "Add playable playlist songs before continuing.",
      },
    ];

  const tracks = value.tracks;
  const maximum = playlistMaximum();
  if (!Array.isArray(tracks) || tracks.length < 2 || tracks.length > maximum) {
    issues.push({
      field: "tracks",
      message: `Add between 2 and ${maximum} songs.`,
    });
  }

  const seenIds = new Set<string>();
  let audioBytes = 0;
  if (Array.isArray(tracks)) {
    tracks.forEach((track, index) => {
      const field = `tracks.${index}`;
      if (!isRecord(track)) {
        issues.push({ field, message: `Complete song ${index + 1}.` });
        return;
      }

      if (!isNonBlankString(track.id)) {
        issues.push({
          field: `${field}.id`,
          message: `Give song ${index + 1} a stable ID before continuing.`,
        });
      } else if (seenIds.has(track.id)) {
        issues.push({
          field: `${field}.id`,
          message: `Give song ${index + 1} a unique stable ID before continuing.`,
        });
      } else {
        seenIds.add(track.id);
      }

      if (!isNonBlankString(track.title))
        issues.push({
          field: `${field}.title`,
          message: `Add song ${index + 1} before continuing.`,
        });
      if (!isNonBlankString(track.artist))
        issues.push({
          field: `${field}.artist`,
          message: `Add the artist for song ${index + 1} before continuing.`,
        });
      if (!isNonBlankString(track.why))
        issues.push({
          field: `${field}.why`,
          message: `Add why song ${index + 1} belongs before continuing.`,
        });

      const hasLink = track.link !== undefined && track.link !== "";
      const validLink =
        typeof track.link === "string" && Boolean(normalizeHttpUrl(track.link));
      if (hasLink && !validLink)
        issues.push({
          field: `${field}.link`,
          message: `Use a complete http:// or https:// song link for song ${index + 1}.`,
        });

      if (track.audio !== undefined) {
        if (!hasAudioPayload(track.audio)) {
          issues.push({
            field: `${field}.audio`,
            message: `Song ${index + 1} has an invalid local audio source.`,
          });
        } else if (typeof track.audio.size === "number") {
          if (track.audio.size > MAX_AUDIO_FILE_BYTES)
            issues.push({
              field: `${field}.audio`,
              message: `Song ${index + 1} is larger than 10 MB.`,
            });
          audioBytes += Math.max(0, track.audio.size);
        }
      }

      if (
        policy === "recommended" &&
        track.audio === undefined &&
        !validLink
      ) {
        issues.push({
          field: `${field}.link`,
          message: `Add audio or a complete song link for song ${index + 1}.`,
        });
      }
    });
  }

  if (audioBytes > MAX_PLAYLIST_AUDIO_BYTES)
    issues.push({
      field: "tracks.audio",
      message: "Keep playlist audio under 12 MB so the surprise stays easy to share.",
    });

  if (!isNonBlankString(value.finalMessage))
    issues.push({
      field: "finalMessage",
      message: "Add the playlist closing message before continuing.",
    });

  return issues;
}

export function isPlayableCozyPlaylistContent(
  value: unknown,
  policy: CozyPlaylistValidationPolicy = "compatibility",
): boolean {
  return getCozyPlaylistPlayableIssues(value, policy).length === 0;
}
