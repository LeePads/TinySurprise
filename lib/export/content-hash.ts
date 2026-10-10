/**
 * Deterministic content fingerprinting for .tinysurprise packages. Used to
 * detect "this exact surprise is already saved" without comparing raw ZIP
 * bytes (ZIP entry order/timestamps can differ for identical content).
 */

/** Bump when the hashing algorithm or canonical shape changes, so a future
 * version can tell an old hash apart from a recomputed one instead of
 * comparing incompatible fingerprints as if they were the same scheme. */
export const HASH_VERSION = 1;
export const HASH_ALGORITHM = "SHA-256";

function sortKeysDeep(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sortKeysDeep);
  if (value && typeof value === "object") {
    const entries = Object.entries(value as Record<string, unknown>)
      .filter(([, v]) => v !== undefined)
      .sort(([a], [b]) => a.localeCompare(b));
    const result: Record<string, unknown> = {};
    for (const [key, val] of entries) result[key] = sortKeysDeep(val);
    return result;
  }
  return value;
}

/** Stable JSON serialization: object keys sorted recursively, arrays keep order. */
export function canonicalStringify(value: unknown): string {
  return JSON.stringify(sortKeysDeep(value));
}

function subtleCrypto(): SubtleCrypto {
  const subtle = globalThis.crypto?.subtle;
  if (!subtle) throw new Error("Web Crypto is unavailable in this environment.");
  return subtle;
}

export async function sha256Hex(bytes: Uint8Array): Promise<string> {
  const view = new Uint8Array(bytes); // copy: guards against a shared/detachable backing buffer
  const digest = await subtleCrypto().digest("SHA-256", view);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

/**
 * Combines canonical surprise data with already-computed, ordered per-media
 * checksums into one content fingerprint. Callers that already have
 * per-media hashes (e.g. from cachedFileChecksum below) should call this
 * directly instead of computeContentFingerprint, to avoid rehashing bytes
 * that were just hashed a moment ago.
 *
 * accessMode is folded into the canonical object (defaulting to "editable"
 * for every pre-Phase-8 caller that doesn't pass one) so that sending the
 * same surprise as view-only vs. editable produces two different
 * fingerprints — duplicate detection must never treat a permission change as
 * "nothing changed" (Phase 8, Section AB).
 */
export async function combineContentFingerprint(
  templateId: string,
  schemaVersion: number,
  data: unknown,
  orderedMediaHashes: string[],
  accessMode: "view-only" | "editable" = "editable",
): Promise<string> {
  const canonical = canonicalStringify({
    template: templateId,
    schemaVersion,
    accessMode,
    data,
  });
  const combined = new TextEncoder().encode(
    `${canonical}\n${orderedMediaHashes.join(",")}`,
  );
  return sha256Hex(combined);
}

/**
 * Combines canonical surprise data (media already replaced by stable
 * references, never raw bytes) with ordered per-media checksums into one
 * content fingerprint. `mediaEntries` must be pre-sorted by the caller so
 * the hash is stable regardless of ZIP/media collection order.
 */
export async function computeContentFingerprint(params: {
  templateId: string;
  schemaVersion: number;
  data: unknown;
  orderedMediaBytes: Uint8Array[];
  accessMode?: "view-only" | "editable";
}): Promise<string> {
  const mediaHashes = await Promise.all(
    params.orderedMediaBytes.map((bytes) => sha256Hex(bytes)),
  );
  return combineContentFingerprint(
    params.templateId,
    params.schemaVersion,
    params.data,
    mediaHashes,
    params.accessMode,
  );
}

const mediaChecksumCache = new WeakMap<File, Promise<string>>();

/**
 * Per-File checksum cache. Replacing media in the builder always produces a
 * new File/Blob object (see builder-step-customize-heart.tsx's
 * setYouTube/removeMusic and the image pickers), so File identity alone is a
 * safe invalidation signal — no separate dirty flag needed. Exporting the
 * same draft twice in a row (e.g. a duplicate-check preview immediately
 * followed by the real save) reuses the cached digest instead of re-reading
 * and re-hashing the same bytes.
 */
export function cachedFileChecksum(file: File): Promise<string> {
  let cached = mediaChecksumCache.get(file);
  if (!cached) {
    cached = file
      .arrayBuffer()
      .then((buffer) => sha256Hex(new Uint8Array(buffer)));
    mediaChecksumCache.set(file, cached);
  }
  return cached;
}
