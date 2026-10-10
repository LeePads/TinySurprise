import type {
  CatchTheHeartContent,
  CozyPlaylistContent,
  LocalAudio,
  LocalImage,
  LocalVideo,
  OpenWhenContent,
  SurpriseData,
} from "../types";
import {
  collectLocalMediaRefs,
  assertMediaIdentityConsistency,
  materializeEmbeddedDraftMedia,
  normalizeLocalImagePresentations,
} from "../local-media";
import { isSurpriseDataRecord } from "../builder-draft";
import {
  getCollectionLimitErrors,
} from "../template-experience-definitions";
import { ACTIVE_TEMPLATE_IDS } from "../template-registry";
import { normalizeLegacyMusic } from "../music";
import { normalizeMemoryQuizData } from "../memory-quiz";
import {
  normalizeStorybookData,
} from "../storybook";
import {
  hasCanonicalCozyPlaylistIdentity,
  normalizeCozyPlaylistData,
} from "../cozy-playlist";
import {
  normalizePhotoPuzzlePackageData,
  photoPuzzlePackageMediaError,
} from "../photo-puzzle-validation";
import { getImportedDataValidationError } from "../import-validation";
import {
  createZipArchive,
  readZipArchive,
  ZipTruncatedError,
  type ZipEntry,
} from "./zip";
import {
  cachedFileChecksum,
  combineContentFingerprint,
  computeContentFingerprint,
  sha256Hex,
  HASH_ALGORITHM,
  HASH_VERSION,
} from "./content-hash";
import {
  createZipInWorker,
  PackageWorkerCancelledError,
} from "./package-worker-client";
import { formatBytes } from "../format-bytes";
import { fetchRemoteBlob } from "./image-conversion";
import { recipientMediaError } from "../media-validation";
import { embeddedRasterImageFile } from "../raster-image-validation";

export const TINYSURPRISE_PACKAGE_VERSION = 2;
export const DRAFT_BACKUP_VERSION = 3;
export type PackagePurpose = "surprise" | "draft-backup";
const MANIFEST_NAME = "manifest.json";
const MEDIA_PREFIX = "media/";

/**
 * Recipient-facing access mode for a shared .tinysurprise (Phase 8, Section
 * S). "view-only" is the only mode enforced app-side — the built-in viewer
 * and Library never offer "Save and edit"/"Continue editing" for it. This is
 * an application-level convention, not a cryptographic guarantee: the file
 * itself is still plain, locally-readable data (see Section U's explicit
 * "do not claim cryptographically impossible to modify").
 */
export type PackageAccessMode = "view-only" | "editable";
const VALID_ACCESS_MODES: PackageAccessMode[] = ["view-only", "editable"];
/** Section T: packages made before accessMode existed keep their original product behavior — editable. */
const LEGACY_ACCESS_MODE: PackageAccessMode = "editable";

// Size/shape limits. Generous enough for a real surprise (a dozen photos
// plus a song) while capping how much memory an untrusted file can force
// the WebView to allocate.
export const MAX_TINYSURPRISE_PACKAGE_BYTES = 30 * 1024 * 1024; // whole .tinysurprise file
const MAX_MANIFEST_BYTES = 2 * 1024 * 1024; // manifest.json alone
const MAX_MEDIA_ENTRY_BYTES = 15 * 1024 * 1024; // any single photo/video/audio
const MAX_ENTRIES = 300; // manifest + media files combined

const ALLOWED_MEDIA_MIME_PREFIXES = ["image/", "video/", "audio/"];
const BLOCKED_NAME_PATTERN =
  /\.(exe|bat|cmd|com|msi|sh|ps1|apk|dex|jar|js|mjs|cjs|html?|php|py|dll|so|scr|vbs|jsp|apps?script)$/i;
const UNSAFE_KEYS = new Set(["__proto__", "constructor", "prototype"]);

interface TinySurprisePackageManifest {
  package: "tinysurprise";
  version: number;
  purpose?: PackagePurpose;
  step?: number;
  exportedAt: string;
  /** Deterministic content fingerprint — see content-hash.ts. Absent on packages made before this field existed. */
  contentHash?: string;
  /** Hashing scheme version the contentHash was produced with — see content-hash.ts's HASH_VERSION. Absent on packages made before this field existed (treated as version 1). */
  hashVersion?: number;
  /** Digest algorithm name (e.g. "SHA-256"), informational — the actual algorithm used to *verify* is always this build's own, never trusted from the file. */
  hashAlgorithm?: string;
  /** Id of the My Surprises creation this backup came from, if any (lets a re-import onto the same device be matched even if content changed). */
  sourceCreationId?: string;
  /** Whether the recipient can create an editable copy — absent on packages made before this field existed, treated as LEGACY_ACCESS_MODE ("editable"). Never trusted for anything beyond UI gating; always re-validated against VALID_ACCESS_MODES on read. */
  accessMode?: PackageAccessMode;
  /**
   * Per-media-entry SHA-256, keyed by ZIP entry name — absent on packages
   * made before this field existed (those skip the check below). Lets a
   * read catch exactly which file was altered or cut short in transit
   * (e.g. by a chat app's own attachment handling) instead of only
   * discovering it later as a broken photo/audio/video, or not at all.
   */
  mediaChecksums?: Record<string, string>;
  data: SurpriseData;
}

/** Result of reading a package, including the metadata duplicate-detection needs. */
export interface TinySurprisePackageResult {
  purpose: PackagePurpose;
  step: number;
  data: SurpriseData;
  contentHash: string;
  hashVersion: number;
  sourceCreationId?: string;
  exportedAt: string;
  manifestVersion: number;
  accessMode: PackageAccessMode;
}

type MediaLike =
  | LocalImage
  | LocalAudio
  | LocalVideo
  | undefined;

/** Every field in SurpriseData that can carry a locally-stored Blob. Mirrors restoreDraftMedia's traversal. */
function collectMediaRefs(data: SurpriseData): MediaLike[] {
  const refs = collectLocalMediaRefs(data);
  // Preserve historic image-first entry order, but rewrite every occurrence.
  return [...refs.filter(ref => ref.kind === "image"), ...refs.filter(ref => ref.kind !== "image")].map(ref => ref.media);
}

/** Copy editable metadata while borrowing immutable Files for checksum caching. */
function packageSnapshot(data: SurpriseData): SurpriseData {
  const snapshot = structuredClone(data);
  const originals = collectLocalMediaRefs(data);
  collectLocalMediaRefs(snapshot).forEach((ref, index) => {
    const file = originals[index]?.media.file;
    if (file instanceof Blob) ref.media.file = file;
  });
  return snapshot;
}

const DIACRITICS = new RegExp("[̀-ͯ]", "g");

/** Strips the internal "media/0-" bookkeeping prefix so error text names a file the way the sender would recognize it. */
function friendlyMediaName(entryName: string): string {
  return entryName.replace(MEDIA_PREFIX, "").replace(/^\d+-/, "");
}

function sanitizeName(value: string): string {
  const clean = (value || "surprise")
    .normalize("NFD")
    .replace(DIACRITICS, "")
    .replace(/[^a-z0-9]+/gi, "-")
    .replace(/^-+|-+$/g, "")
    .toLowerCase();
  return clean || "surprise";
}

/**
 * Packages a builder draft (config + referenced photos/video/audio) into a
 * versioned .tinysurprise ZIP: manifest.json plus a media/ folder. This is
 * the *editable draft* format, distinct from the recipient-facing exported
 * HTML produced by html-generator.ts.
 */
export async function createTinySurprisePackage(
  data: SurpriseData,
  options?: { sourceCreationId?: string },
): Promise<File> {
  const result = await createTinySurprisePackageDetailed(data, options);
  return result.file;
}

export interface PackageCreationProgress {
  stage: "hashing" | "packing";
  completed?: number;
  total?: number;
}

/** Same as createTinySurprisePackage, but also returns the computed content fingerprint so callers can check for duplicates. */
export async function createTinySurprisePackageDetailed(
  data: SurpriseData,
  options?: {
    sourceCreationId?: string;
    purpose?: PackagePurpose;
    step?: number;
    onProgress?: (progress: PackageCreationProgress) => void;
    /** Called with a cancel function once a cancellable (worker-backed) operation actually starts, and with undefined again once it's no longer cancellable — a callback rather than a ref so React callers can drive cancel-button visibility from state instead of reading a ref during render. */
    onCancelAvailable?: (cancel: (() => void) | undefined) => void;
    /** Defaults to "editable" — right for the creator's own working backup. The recipient-facing "Send Tiny Surprise file" flow always passes this explicitly, defaulting to "view-only" at that call site instead (Section S: "Default to view-only every time"). */
    accessMode?: PackageAccessMode;
  },
): Promise<{ file: File; contentHash: string }> {
  const normalized = normalizeCozyPlaylistData(
    normalizeStorybookData(normalizeMemoryQuizData(normalizeLegacyMusic(packageSnapshot(data)))),
  );
  const canonical = normalizePhotoPuzzlePackageData(normalized);
  // Keep creation and read boundaries on the same canonical shape. The
  // reader also materializes default image-presentation metadata before it
  // recomputes a package fingerprint.
  normalizeLocalImagePresentations(canonical);
  const draftBackup = options?.purpose === "draft-backup";
  const version = draftBackup ? DRAFT_BACKUP_VERSION : TINYSURPRISE_PACKAGE_VERSION;
  const step = Math.min(6, Math.max(1, Math.trunc(options?.step || 1)));
  if (!isSurpriseDataRecord(canonical)) fail("This surprise contains invalid data.");
  const byteReservations = new Map<string, number>();
  const reserveBytes = (kind: string, id: string, size: number) => {
    const key = `${kind}:${id}`;
    byteReservations.set(key, Math.max(byteReservations.get(key) || 0, size));
    if ([...byteReservations.values()].reduce((sum, bytes) => sum + bytes, 0) > MAX_TINYSURPRISE_PACKAGE_BYTES) {
      fail("This package contains more than 30 MB of media. Choose a smaller file and try again.");
    }
  };
  for (const { kind, media } of collectLocalMediaRefs(canonical)) {
    if (media.file instanceof Blob) reserveBytes(kind, media.id, media.file.size);
    else if (/^data:(image|video)\//i.test(media.previewUrl)) {
      const encoded = media.previewUrl.slice(media.previewUrl.indexOf(",") + 1).replace(/\s/g, "");
      const bytes = Math.floor(encoded.length * 3 / 4) - (encoded.endsWith("==") ? 2 : encoded.endsWith("=") ? 1 : 0);
      reserveBytes(kind, media.id, Math.max(0, bytes));
    }
  }
  const validationError = draftBackup
    ? (isSurpriseDataRecord(canonical) ? undefined : "This draft contains invalid data.")
    : await getImportedDataValidationError(canonical, false);
  if (validationError) fail(validationError);
  if (canonical.template !== "wish-upon-a-star") {
    const limitError = getCollectionLimitErrors(canonical.template, canonical.content, "compatibility", draftBackup)[0];
    if (limitError) fail(limitError.message);
  }
  if (draftBackup && canonical.template === "photo-puzzle") {
    const content = canonical.content as import("../types").PhotoPuzzleContent;
    if ((content.photo && !content.photo.unavailable) || content.photoUrl) {
      const mediaError = await photoPuzzlePackageMediaError(content, true);
      if (mediaError) fail(mediaError);
    }
  }
  if (
    !draftBackup && canonical.template === "cozy-playlist" &&
    !hasCanonicalCozyPlaylistIdentity(canonical.content)
  ) {
    throw new Error("This Cozy Playlist must contain between 2 and 12 unique tracks.");
  }
  // Recipient packages carry bytes. Working backups keep linked authoring intent.
  const remoteFiles = new Map<string, File>();
  for (const { kind, media } of collectLocalMediaRefs(canonical)) {
    if (kind === "audio" || media.file) continue;
    if ("source" in media && media.source === "url") {
      if (draftBackup) continue;
      const key = `${kind}:${media.previewUrl}`;
      let file = remoteFiles.get(key);
      if (!file) {
        const blob = await fetchRemoteBlob(media.previewUrl, media.name, kind);
        file = new File([blob], media.name, { type: blob.type });
        remoteFiles.set(key, file);
      }
      media.file = file;
      media.mimeType = file.type;
      media.size = file.size;
      media.source = "upload";
      reserveBytes(kind, media.id, file.size);
    } else if (/^data:(image|video)\//i.test(media.previewUrl)) {
      if (!draftBackup && kind === "image") {
        media.file = embeddedRasterImageFile(media as import("../types").LocalImage);
        media.size = media.file.size;
        reserveBytes(kind, media.id, media.file.size);
        continue;
      }
      const comma = media.previewUrl.indexOf(",");
      if (media.previewUrl.length - comma - 1 > Math.ceil(MAX_MEDIA_ENTRY_BYTES / 3) * 4 + 1024) fail("Embedded media exceeds the 15 MB package limit.");
      const binary = atob(media.previewUrl.slice(comma + 1).replace(/\s/g, ""));
      media.file = new File([Uint8Array.from(binary, c => c.charCodeAt(0))], media.name, { type: media.mimeType });
      media.size = media.file.size;
      reserveBytes(kind, media.id, media.file.size);
    }
  }
  if (!draftBackup) {
    const mediaError = await recipientMediaError(canonical);
    if (mediaError) fail(mediaError);
  }
  await assertMediaIdentityConsistency(canonical);
  const clone = structuredClone(canonical);
  const refs = collectMediaRefs(clone);
  const originalRefs = collectMediaRefs(canonical);
  const mediaEntries: { name: string; data: Uint8Array; checksum: string }[] = [];
  const usedNames = new Set<string>();
  const kinds = new Map(collectLocalMediaRefs(canonical).map(ref => [ref.media, ref.kind]));
  const identities = new Map<string, { name: string; checksum: string }>();
  const totalEntries = new Set(collectLocalMediaRefs(canonical).filter(ref => ref.media.file instanceof Blob).map(ref => `${ref.kind}:${ref.media.id}`)).size;
  if (totalEntries + 1 > MAX_ENTRIES) fail("This backup contains too much media. Remove a large file and try again.");
  let mediaBytes = 0;

  for (let i = 0; i < refs.length; i++) {
    const ref = refs[i];
    const original = originalRefs[i];
    if (!ref || !original) continue;
    if (!original.file) {
      if (original.previewUrl.startsWith("blob:") || (!("source" in original) || original.source !== "url") && !original.unavailable)
        fail('Choose "' + original.name + '" again before backing up; its bytes are unavailable.');
      if (original.unavailable) ref.previewUrl = "";
      continue;
    }
    if (original.file.size > MAX_MEDIA_ENTRY_BYTES) fail("A media file exceeds the 15 MB package limit.");
    const identity = `${kinds.get(original)}:${original.id}`;
    const previous = identities.get(identity);
    // Identity consistency was checked above; every alias uses this same entry.
    if (previous) { ref.previewUrl = previous.name; delete ref.file; continue; }
    let mediaRef = `${MEDIA_PREFIX}${i}-${sanitizeName(ref.name || "file")}`;
    // sanitizeName can collapse distinct names to the same slug; keep entry
    // names unique so nothing is silently overwritten inside the archive.
    while (usedNames.has(mediaRef)) mediaRef = `${mediaRef}-${i}-x`;
    usedNames.add(mediaRef);
    // Read bytes and checksum from the same File once — the checksum is
    // cached by File identity so re-exporting the same unmodified draft
    // (e.g. a duplicate-check preview right before the real save) doesn't
    // re-hash media that was already hashed a moment ago.
    const [bytes, checksum] = await Promise.all([
      original.file.arrayBuffer().then((buffer) => new Uint8Array(buffer)),
      cachedFileChecksum(original.file),
    ]);
    mediaBytes += bytes.length;
    if (mediaBytes > MAX_TINYSURPRISE_PACKAGE_BYTES) fail("This backup contains too much media. Choose a smaller file and try again.");
    mediaEntries.push({ name: mediaRef, data: bytes, checksum });
    identities.set(identity, { name: mediaRef, checksum });
    ref.previewUrl = mediaRef;
    delete ref.file;
    options?.onProgress?.({
      stage: "hashing",
      completed: mediaEntries.length,
      total: totalEntries,
    });
  }

  const orderedMedia = [...mediaEntries].sort((a, b) =>
    a.name.localeCompare(b.name),
  );
  const packageAccessMode = draftBackup ? "editable" : options?.accessMode || "editable";
  const contentHash = await combineContentFingerprint(
    canonical.template,
    version,
    draftBackup ? { purpose: "draft-backup", step, data: clone } : clone,
    orderedMedia.map((entry) => entry.checksum),
    packageAccessMode,
  );

  const mediaChecksums = Object.fromEntries(
    mediaEntries.map((entry) => [entry.name, entry.checksum]),
  );
  const manifest: TinySurprisePackageManifest = {
    package: "tinysurprise",
    version,
    ...(draftBackup ? { purpose: "draft-backup" as const, step } : {}),
    exportedAt: new Date().toISOString(),
    contentHash,
    hashVersion: HASH_VERSION,
    hashAlgorithm: HASH_ALGORITHM,
    sourceCreationId: options?.sourceCreationId,
    accessMode: packageAccessMode,
    mediaChecksums,
    data: clone,
  };
  const manifestBytes = new TextEncoder().encode(JSON.stringify(manifest));
  const allEntries = [{ name: MANIFEST_NAME, data: manifestBytes }, ...mediaEntries];
  assertSafeEntries(allEntries);
  const totalMediaBytes = mediaEntries.reduce((sum, e) => sum + e.data.length, 0);

  // ZIP byte assembly (CRC32 + packing) is the one genuinely synchronous,
  // CPU-bound step here that scales with package size — hashing above is
  // already effectively non-blocking via crypto.subtle. Below a size
  // threshold it isn't worth the worker/postMessage overhead; above it, try
  // the worker and fall back to the exact same synchronous call on any
  // failure (worker unavailable, crashed, or cancelled by something other
  // than our own cancel token).
  const WORKER_THRESHOLD_BYTES = 2 * 1024 * 1024;
  let zipBytes: Uint8Array | undefined;
  if (typeof window !== "undefined" && totalMediaBytes > WORKER_THRESHOLD_BYTES) {
    const job = createZipInWorker(
      allEntries.map((entry) => ({
        name: entry.name,
        // Copies, not the original buffers — postMessage's transfer list
        // detaches whatever ArrayBuffer is handed to it, and the originals
        // must stay valid here for the synchronous fallback below.
        buffer: entry.data.slice().buffer,
      })),
      (progress) =>
        options?.onProgress?.({
          stage: "packing",
          completed: progress.completed,
          total: progress.total,
        }),
    );
    if (job) {
      options?.onCancelAvailable?.(job.cancel);
      try {
        zipBytes = new Uint8Array(await job.result);
      } catch (error) {
        // An explicit user cancellation must actually stop the operation,
        // not silently continue via the synchronous fallback — anything
        // else (worker crashed/unavailable) is safe to retry synchronously.
        if (error instanceof PackageWorkerCancelledError) throw error;
        zipBytes = undefined;
      } finally {
        options?.onCancelAvailable?.(undefined);
      }
    }
  }
  if (!zipBytes) zipBytes = createZipArchive(allEntries);

  const recipientSlug = sanitizeName(data.basics.recipientName);
  const filename = `tiny-surprise-${sanitizeName(data.template)}-${recipientSlug}.tinysurprise`;
  const file = new File([new Uint8Array(zipBytes)], filename, {
    type: "application/vnd.tinysurprise+zip",
  });
  if (file.size > MAX_TINYSURPRISE_PACKAGE_BYTES)
    fail(
      `This .tinysurprise package is over 30 MB (${formatBytes(file.size)}). Remove a large original photo, song, or video and try again.`,
    );
  return { file, contentHash };
}

export class TinySurprisePackageError extends Error {}

function fail(message: string): never {
  throw new TinySurprisePackageError(message);
}

/**
 * Structural/size checks on the raw ZIP entries, before any of it is
 * treated as trusted data. Every one of these can be triggered by a
 * maliciously (or just corrupted) crafted .tinysurprise file, so each gets
 * an explicit, user-legible rejection reason rather than an opaque crash.
 */
function assertSafeEntries(entries: ZipEntry[]): void {
  if (entries.length === 0) fail("This .tinysurprise package is empty.");
  if (entries.length > MAX_ENTRIES)
    fail("This .tinysurprise package contains too many files.");

  const seenNames = new Set<string>();
  for (const entry of entries) {
    const name = entry.name;
    if (seenNames.has(name))
      fail(`This .tinysurprise package has a duplicate file: "${name}".`);
    seenNames.add(name);

    if (name.startsWith("/") || name.startsWith("\\") || /^[a-zA-Z]:[/\\]/.test(name))
      fail(`This .tinysurprise package contains an absolute path: "${name}".`);
    if (name.split(/[/\\]/).includes(".."))
      fail(`This .tinysurprise package contains a path traversal entry: "${name}".`);
    if (name !== MANIFEST_NAME && !name.startsWith(MEDIA_PREFIX))
      fail(`This .tinysurprise package contains an unexpected file: "${name}".`);
    if (name.startsWith(MEDIA_PREFIX) && BLOCKED_NAME_PATTERN.test(name))
      fail(`This .tinysurprise package contains a disallowed file type: "${name}".`);

    const cap = name === MANIFEST_NAME ? MAX_MANIFEST_BYTES : MAX_MEDIA_ENTRY_BYTES;
    if (entry.data.length > cap)
      fail(`"${name}" in this .tinysurprise package is too large to import.`);
  }
}

/**
 * Rejects `__proto__`/`constructor`/`prototype` own keys anywhere in the
 * parsed manifest tree. JSON.parse itself cannot pollute Object.prototype,
 * but this blocks the payload from ever reaching any current or future code
 * path (e.g. a merge/assign helper) that could act on those keys unsafely.
 */
function assertNoUnsafeKeys(value: unknown, path = "manifest"): void {
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertNoUnsafeKeys(item, `${path}[${index}]`));
    return;
  }
  if (!value || typeof value !== "object") return;
  for (const key of Object.keys(value as Record<string, unknown>)) {
    if (UNSAFE_KEYS.has(key))
      fail(`This .tinysurprise package contains an unsafe field ("${key}").`);
    assertNoUnsafeKeys((value as Record<string, unknown>)[key], `${path}.${key}`);
  }
}

/**
 * Reads back a .tinysurprise package. The manifest is validated with the
 * same structural checks used for IndexedDB drafts (isSurpriseDataRecord),
 * plus package-specific size/shape/path checks below — nothing here is
 * ever interpreted as HTML/script, only plain JSON fields and raw media
 * bytes handed to <img>/<video>/<audio> as data.
 */
export async function readTinySurprisePackage(
  file: Blob,
): Promise<SurpriseData> {
  const result = await readTinySurprisePackageDetailed(file);
  return result.data;
}

/**
 * Same validation as readTinySurprisePackage, but also returns the content
 * fingerprint (recomputed for packages made before contentHash existed) and
 * package metadata needed for duplicate/conflict detection.
 */
export async function readTinySurprisePackageDetailed(
  file: Blob,
): Promise<TinySurprisePackageResult> {
  if (file.size > MAX_TINYSURPRISE_PACKAGE_BYTES)
    fail("This .tinysurprise file is too large to import.");

  let bytes: Uint8Array;
  try {
    bytes = new Uint8Array(await file.arrayBuffer());
  } catch {
    fail("This .tinysurprise file could not be read from your device.");
  }

  let entries: ZipEntry[];
  try {
    entries = readZipArchive(bytes, { maxEntries: MAX_ENTRIES, maxTotalBytes: MAX_TINYSURPRISE_PACKAGE_BYTES, maxEntryBytes: (name) => name === MANIFEST_NAME ? MAX_MANIFEST_BYTES : MAX_MEDIA_ENTRY_BYTES });
  } catch (zipError) {
    // A truncation/incompleteness error already carries a specific,
    // friendly message (e.g. "cut off while sending") — surface it as-is
    // instead of collapsing every ZIP-level failure into a generic
    // "invalid or corrupted data" message that gives the user no idea
    // whether the file was tampered with, cut short, or just the wrong
    // file entirely.
    fail(
      zipError instanceof ZipTruncatedError
        ? zipError.message
        : "This file is not a valid .tinysurprise package. It may be damaged, or it may not be a TinySurprise file at all.",
    );
  }
  assertSafeEntries(entries);

  const manifestEntry = entries.find((entry) => entry.name === MANIFEST_NAME);
  if (!manifestEntry)
    fail("This .tinysurprise package is missing its manifest.");

  let manifest: unknown;
  try {
    manifest = JSON.parse(new TextDecoder().decode(manifestEntry.data));
  } catch {
    fail("This .tinysurprise package could not be read.");
  }
  assertNoUnsafeKeys(manifest);

  if (
    !manifest ||
    typeof manifest !== "object" ||
    (manifest as Partial<TinySurprisePackageManifest>).package !== "tinysurprise"
  )
    fail("This file is not a .tinysurprise package.");

  const version = (manifest as Partial<TinySurprisePackageManifest>).version;
  if (
    typeof version !== "number" ||
    !Number.isInteger(version) ||
    version < 1 ||
    version > DRAFT_BACKUP_VERSION
  )
    fail(
      "This .tinysurprise package was made by a newer or incompatible version of TinySurprise.",
    );

  const declared = manifest as TinySurprisePackageManifest;
  const draftBackup = version === DRAFT_BACKUP_VERSION;
  if (draftBackup && (declared.purpose !== "draft-backup" || declared.accessMode !== "editable" || !Number.isInteger(declared.step) || Number(declared.step) < 1 || Number(declared.step) > 6))
    fail("This draft backup has invalid restore information.");
  if (!draftBackup && declared.purpose && declared.purpose !== "surprise") fail("Unsupported package purpose.");
  const step = draftBackup ? declared.step! : 1;
  const data = declared.data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const template = (data as { template?: unknown }).template;
    if (typeof template === "string" && (ACTIVE_TEMPLATE_IDS as readonly string[]).includes(template)) {
      const limitError = getCollectionLimitErrors(
        template as (typeof ACTIVE_TEMPLATE_IDS)[number],
        (data as { content?: unknown }).content,
        "compatibility", draftBackup,
      )[0];
      if (limitError) fail(limitError.message);
    }
  }
  const normalizedData = normalizeCozyPlaylistData(
    normalizeStorybookData(normalizeMemoryQuizData(data)),
  );
  if (!isSurpriseDataRecord(normalizedData))
    fail("This .tinysurprise package contains invalid or corrupted data.");
  // Preserve the historic fingerprint shape independently of additive playback
  // adapters. New packages already include those fields in their manifest.
  const fingerprintData = normalizePhotoPuzzlePackageData(
    normalizeLocalImagePresentations(normalizeLegacyMusic(structuredClone(normalizedData)), true),
  );
  if (normalizedData.template === "photo-puzzle" && !(normalizedData.content as import("../types").PhotoPuzzleContent).photo) {
    delete (fingerprintData.content as import("../types").PhotoPuzzleContent).photo;
  }
  const normalizedCanonicalData = normalizeLocalImagePresentations(
    normalizeLegacyMusic(normalizedData),
  );
  const canonicalData = normalizePhotoPuzzlePackageData(normalizedCanonicalData);
  const preAttachmentValidationError =
    draftBackup ? undefined : await getImportedDataValidationError(canonicalData, false);
  if (preAttachmentValidationError) fail(preAttachmentValidationError);

  const mediaEntries = entries.filter((entry) => entry.name.startsWith(MEDIA_PREFIX));
  // Per-file integrity check (packages made before mediaChecksums existed
  // skip this and fall back to the size/shape checks above only). Catches
  // exactly which photo/audio/video file was cut short or altered in
  // transit — a truncated or substituted media entry can otherwise still
  // pass every structural ZIP check above and only fail much later, deep
  // inside an <audio>/<video> element, as an unexplained "corrupted data"
  // experience.
  const declaredMediaChecksums = (manifest as TinySurprisePackageManifest)
    .mediaChecksums;
  if (declaredMediaChecksums) {
    const entryByName = new Map(mediaEntries.map((entry) => [entry.name, entry]));
    for (const [name, expected] of Object.entries(declaredMediaChecksums)) {
      const entry = entryByName.get(name);
      if (!entry)
        fail(
          `A file (${friendlyMediaName(name)}) is missing from this .tinysurprise package. It may have been cut off while it was sent — ask the sender to resend it, or try "Share compatible HTML copy" instead.`,
        );
      const actual = await sha256Hex(entry.data);
      if (actual !== expected)
        fail(
          `A file (${friendlyMediaName(name)}) in this .tinysurprise package doesn't match what was originally sent — it may have been altered or corrupted while it was shared. Ask the sender to resend it.`,
        );
    }
  }
  const hashVersion =
    (manifest as TinySurprisePackageManifest).hashVersion ?? 1;
  // Section T: "Do not trust imported accessMode until package validation
  // succeeds" — by this point the archive, manifest, and data shape have
  // all passed. Any value other than the two known modes (including a
  // tampered/unexpected string) falls back to the documented legacy
  // default rather than being trusted as-is. Resolved before hashing since
  // accessMode is itself part of the canonical fingerprint (Section AB).
  const declaredAccessMode = (manifest as TinySurprisePackageManifest).accessMode;
  const accessMode: PackageAccessMode = VALID_ACCESS_MODES.includes(
    declaredAccessMode as PackageAccessMode,
  )
    ? (declaredAccessMode as PackageAccessMode)
    : LEGACY_ACCESS_MODE;
  // Never trust a hash declared inside the package for duplicate-detection
  // purposes — a package with tampered or substituted content could declare
  // a stale/fake contentHash to make our classifier report "already have
  // this, nothing changed" for content that actually changed. Always
  // recompute independently from the package's own validated bytes; the
  // declared value (if present) is not read at all.
  const contentHash = await computeContentFingerprint({
    templateId: canonicalData.template,
    schemaVersion: version,
    data: draftBackup ? { purpose: "draft-backup", step, data: fingerprintData } : fingerprintData,
    orderedMediaBytes: [...mediaEntries]
      .sort((a, b) => a.name.localeCompare(b.name))
      .map((entry) => entry.data),
    accessMode,
  });

  const mediaMap = new Map(
    mediaEntries.map((entry) => [entry.name, entry.data] as const),
  );
  const attachedFiles = new Map<string, File>();
  collectMediaRefs(canonicalData).forEach((ref) => {
    if (ref) attachOne(ref, mediaMap, attachedFiles);
  });
  materializeEmbeddedDraftMedia(canonicalData);
  await assertMediaIdentityConsistency(canonicalData);
  const finalValidationError = draftBackup ? undefined : await getImportedDataValidationError(canonicalData);
  if (finalValidationError) fail(finalValidationError);
  if (draftBackup && canonicalData.template === "photo-puzzle") {
    const content = canonicalData.content as import("../types").PhotoPuzzleContent;
    if ((content.photo && !content.photo.unavailable) || content.photoUrl) {
      const mediaError = await photoPuzzlePackageMediaError(content, true);
      if (mediaError) fail(mediaError);
    }
  }
  // Deliberately does not call restoreDraftMedia()/URL.createObjectURL here:
  // both current callers persist this to IndexedDB and then (re)load the
  // page, which regenerates preview blob URLs from the attached File blobs.
  // Creating them here too would just leak unused blob: URLs for the
  // lifetime of the document. Callers that need to render this data
  // in-place before persisting should call restoreDraftMedia() themselves.
  return {
    data: canonicalData,
    purpose: draftBackup ? "draft-backup" : "surprise",
    step,
    contentHash,
    hashVersion,
    sourceCreationId: typeof declared.sourceCreationId === "string" && declared.sourceCreationId.length <= 256 ? declared.sourceCreationId : undefined,
    exportedAt: (manifest as TinySurprisePackageManifest).exportedAt,
    manifestVersion: version,
    accessMode,
  };
}

function attachOne(
  ref: LocalImage | LocalVideo | LocalAudio,
  mediaMap: Map<string, Uint8Array>,
  attachedFiles: Map<string, File>,
) {
  // Anything not pointing at an embedded media/ entry (e.g. a linked video
  // or a remote background URL) was never zipped in the first place —
  // nothing to attach, and its previewUrl is used as-is.
  if (!ref.previewUrl.startsWith(MEDIA_PREFIX)) return;
  const bytes = mediaMap.get(ref.previewUrl);
  // The manifest's own SurpriseData references this file, but no matching
  // ZIP entry was found for it. Left unchecked, `ref.file` simply never
  // gets set and `ref.previewUrl` stays a bare "media/…" package path —
  // which every <img>/<audio>/<video> tag would then try to load as a
  // real URL and silently fail to render, with no explanation. Fail loudly
  // here instead, while we still know exactly which file is missing.
  if (!bytes)
    fail(
      `"${ref.name}" is missing from this .tinysurprise package. It may have been cut off while it was sent — ask the sender to resend it, or try "Share compatible HTML copy" instead.`,
    );
  const mimeType = ref.mimeType || "application/octet-stream";
  if (!ALLOWED_MEDIA_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)))
    fail(`"${ref.name}" in this .tinysurprise package has an unsupported file type.`);
  const key = `${ref.previewUrl}:${mimeType}:${ref.name}`;
  const file = attachedFiles.get(key) || new File([new Uint8Array(bytes)], ref.name, { type: mimeType });
  attachedFiles.set(key, file);
  ref.file = file;
  ref.size = file.size;
}
