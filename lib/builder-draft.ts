import type {
  CatchTheHeartContent,
  LocalImage,
  LocalVideo,
  OpenWhenContent,
  SurpriseData,
  TemplateType,
} from "./types";
import {
  cloneDraftDataForPersistence,
  collectLocalMediaRefs,
  collectUniqueLocalMediaRefs,
  assertMediaIdentityConsistency,
  materializeEmbeddedDraftMedia,
  normalizeLocalImagePresentations,
} from "./local-media";
import { THEME_CONFIGS } from "./config";
import { normalizeLegacyMusic } from "./music";
import { normalizeMemoryQuizData, normalizeMemoryQuizDraftRecord } from "./memory-quiz";
import { normalizeStorybookData, normalizeStorybookDraftRecord } from "./storybook";
import {
  hasCanonicalCozyPlaylistIdentity,
  normalizeCozyPlaylistData,
  normalizeCozyPlaylistDraftRecord,
} from "./cozy-playlist";
import { isAcceptedTemplateType } from "./template-registry";
import { getCollectionLimitErrors } from "./template-experience-definitions";
import {
  ANIMATION_INTENSITY_VALUES,
  BACKGROUND_STYLE_VALUES,
} from "./validation-catalogs";

const DB_NAME = "tinysurprise-builder";
const STORE_NAME = "drafts";
export const LEGACY_DRAFTS_STORE = STORE_NAME;
// v2 adds the "My Surprises" library: creations (metadata, keyed by
// creation id) and creation-drafts (full SurpriseData, keyed by creation
// id). The legacy `drafts` store (keyed by TemplateType, one draft per
// template) stays untouched here — lib/creations.ts migrates its contents
// into the new stores lazily on first read, so upgrading never loses data.
export const CREATIONS_STORE = "creations";
export const CREATION_DRAFTS_STORE = "creation-drafts";
export const LOCAL_MEDIA_STORE = "local-media";
// v3 adds saved recipients (Phase 8: "Saved and Recent Recipients") — a
// small new store, additive only, so existing drafts/creations are
// untouched by the version bump.
export const RECIPIENTS_STORE = "recipients";
const DB_VERSION = 4;

export const BUILDER_DB_SCHEMA = {
  name: DB_NAME,
  version: DB_VERSION,
  stores: {
    drafts: { key: "TemplateType", recordVersion: 1 },
    creations: { key: "creation id", recordVersion: 1 },
    "creation-drafts": { key: "creation id", recordVersion: 1 },
    "local-media": { key: "owner:kind:media id", recordVersion: 1 },
    recipients: { key: "recipient id", recordVersion: 1 },
  },
} as const;

export interface BuilderDraft {
  data: SurpriseData;
  step: number;
  savedAt: number;
  version: 1;
}

type UnknownRecord = Record<string, unknown>;

const ANIMATION_INTENSITIES = new Set<string>(ANIMATION_INTENSITY_VALUES);
const BACKGROUND_STYLES = new Set<string>(BACKGROUND_STYLE_VALUES);
const OPENING_STYLES = new Set([
  "gentle-fade",
  "gift-unwrap",
  "envelope-reveal",
  "sparkle-pop",
  "cinematic-curtain",
  "polaroid-drop",
  "heart-bloom",
  "storybook-turn",
]);

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));
const isString = (value: unknown): value is string => typeof value === "string";
const isMediaPreview = (value: unknown, source: unknown) =>
  isString(value) && (source !== "url" || value.length > 0);
const isOptionalString = (value: unknown) =>
  value === undefined || isString(value);
const isStringArray = (value: unknown) =>
  Array.isArray(value) && value.every(isString);
const hasId = (value: unknown): value is UnknownRecord =>
  isRecord(value) && isString(value.id);

function isLocalImage(value: unknown): value is LocalImage {
  if (!isRecord(value)) return false;
  return Boolean(
    isString(value.id) &&
      isMediaPreview(value.previewUrl, value.source) &&
      isString(value.name) &&
      isString(value.mimeType) &&
      typeof value.size === "number" &&
      Number.isFinite(value.size) &&
      value.size >= 0 &&
      (value.source === undefined ||
        value.source === "upload" ||
        value.source === "url") &&
      (value.file === undefined || value.file instanceof Blob),
  );
}

function isOptionalImage(value: unknown) {
  return value === undefined || isLocalImage(value);
}

function isLocalVideo(value: unknown): value is LocalVideo {
  if (!isRecord(value)) return false;
  return Boolean(
    isString(value.id) &&
      isMediaPreview(value.previewUrl, value.source) &&
      isString(value.name) &&
      isString(value.mimeType) &&
      typeof value.size === "number" &&
      Number.isFinite(value.size) &&
      value.size >= 0 &&
      (value.source === undefined ||
        value.source === "upload" ||
        value.source === "url") &&
      (value.file === undefined || value.file instanceof Blob),
  );
}

function isOptionalVideo(value: unknown) {
  return value === undefined || isLocalVideo(value);
}

function isLocalAudio(value: unknown) {
  return (
    isRecord(value) &&
    isString(value.id) &&
    isMediaPreview(value.previewUrl, undefined) &&
    isString(value.name) &&
    isString(value.mimeType) &&
    typeof value.size === "number" &&
    value.size >= 0 &&
    (value.durationSeconds === undefined ||
      (typeof value.durationSeconds === "number" &&
        Number.isFinite(value.durationSeconds) &&
        value.durationSeconds >= 0)) &&
    // Optional, exactly like isLocalImage/isLocalVideo: a .tinysurprise
    // manifest is validated *before* its media blobs are re-attached
    // (readTinySurprisePackageDetailed validates the shape, then calls
    // attachOne), and the exporter deliberately strips `file` before
    // serializing. Requiring a live Blob here rejected every package
    // carrying local audio as "invalid or corrupted data". Media integrity
    // is still enforced by mediaChecksums, the canonical content hash, and
    // attachOne's missing/unsupported-entry failures.
    (value.file === undefined || value.file instanceof Blob)
  );
}

function isOptionalAudio(value: unknown) {
  return value === undefined || isLocalAudio(value);
}

function isBasics(value: unknown) {
  return (
    isRecord(value) &&
    isString(value.senderName) &&
    isString(value.recipientName) &&
    isString(value.openingMessage) &&
    isOptionalString(value.occasion)
  );
}

function isAppearance(value: unknown) {
  return (
    isRecord(value) &&
    isString(value.theme) &&
    Object.hasOwn(THEME_CONFIGS, value.theme) &&
    isString(value.animationIntensity) &&
    ANIMATION_INTENSITIES.has(value.animationIntensity) &&
    (value.accentColor === undefined ||
      (isString(value.accentColor) &&
        /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(value.accentColor))) &&
    (value.backgroundStyle === undefined ||
      (isString(value.backgroundStyle) &&
        BACKGROUND_STYLES.has(value.backgroundStyle))) &&
    (value.backgroundFilter === undefined ||
      ["soft", "balanced", "strong"].includes(String(value.backgroundFilter))) &&
    (value.fontPairing === undefined ||
      [
        "friendly",
        "classic",
        "playful",
        "handwritten",
        "romantic",
        "modern",
      ].includes(String(value.fontPairing))) &&
    isOptionalImage(value.backgroundImage) &&
    isOptionalImage(value.customBackgroundImage)
  );
}

function isMusic(value: unknown) {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    (value.file === undefined || isLocalAudio(value.file)) &&
    isOptionalString(value.youtubeUrl) &&
    isOptionalString(value.title) &&
    (value.durationSeconds === undefined ||
      (typeof value.durationSeconds === "number" &&
        Number.isFinite(value.durationSeconds) &&
        value.durationSeconds >= 0)) &&
    typeof value.loop === "boolean" &&
    typeof value.startMuted === "boolean" &&
    typeof value.volume === "number" &&
    Number.isFinite(value.volume) &&
    value.volume >= 0 &&
    value.volume <= 100
  );
}

function isDelivery(value: unknown) {
  return (
    isRecord(value) &&
    isString(value.expiration) &&
    ["none", "24h", "3d", "7d"].includes(value.expiration)
  );
}

function isDelight(value: unknown) {
  if (value === undefined) return true;
  return (
    isRecord(value) &&
    typeof value.coverEnabled === "boolean" &&
    isString(value.coverMessage) &&
    isString(value.openingStyle) &&
    OPENING_STYLES.has(value.openingStyle) &&
    typeof value.passphraseEnabled === "boolean" &&
    isString(value.passphrase) &&
    isString(value.closingMessage) &&
    isString(value.signature) &&
    isOptionalString(value.passphraseQuestion) &&
    (value.passphraseAnswers === undefined ||
      isStringArray(value.passphraseAnswers)) &&
    (value.passphraseMode === undefined ||
      value.passphraseMode === "text" ||
      value.passphraseMode === "choice") &&
    (value.passphraseChoices === undefined ||
      isStringArray(value.passphraseChoices)) &&
    (value.passphraseCorrectChoiceIndex === undefined ||
      (Number.isInteger(value.passphraseCorrectChoiceIndex) &&
        Number(value.passphraseCorrectChoiceIndex) >= 0 &&
        Number(value.passphraseCorrectChoiceIndex) <= 3)) &&
    isOptionalString(value.passphraseHash) &&
    isOptionalImage(value.coverPhoto)
  );
}

function isContent(template: TemplateType, value: unknown) {
  if (!isRecord(value)) return false;
  if (template === "catch-the-heart") {
    return (
      Array.isArray(value.hearts) &&
      value.hearts.every(
        (heart) =>
          isRecord(heart) &&
          (heart.id === undefined || isString(heart.id)) &&
          isString(heart.message) &&
          isOptionalImage(heart.photo),
      ) &&
      isString(value.finalMessage) &&
      typeof value.soundEffects === "boolean" &&
      isOptionalString(value.songTitle) &&
      isOptionalString(value.songUrl) &&
      // Shares isLocalAudio with music.file and open-when's musicFile — this
      // branch used to re-implement it inline and drifted out of sync.
      (value.songFile === undefined || isLocalAudio(value.songFile))
    );
  }
  if (template === "photo-puzzle") {
    return (
      ["easy", "medium", "hard"].includes(String(value.difficulty)) &&
      isString(value.completionMessage) &&
      isOptionalString(value.finalMessage) &&
      isOptionalString(value.photoUrl) &&
      isOptionalImage(value.photo)
    );
  }
  if (template === "open-when") {
    return (
      Array.isArray(value.envelopes) &&
      value.envelopes.every(
        (item) =>
          isRecord(item) &&
          isString(item.title) &&
          isString(item.message) &&
          isOptionalImage(item.photo) &&
          isOptionalVideo(item.video),
      ) &&
      (value.musicFile === undefined || isLocalAudio(value.musicFile)) &&
      isString(value.finalMessage)
    );
  }
  if (template === "choose-our-date") {
    return (
      isString(value.introMessage) &&
      Array.isArray(value.rounds) &&
      value.rounds.every(
        (round) =>
          isRecord(round) &&
          isString(round.question) &&
          Array.isArray(round.options) &&
          round.options.every(
            (option) =>
              isRecord(option) &&
              isString(option.title) &&
              isString(option.details) &&
              isOptionalImage(option.photo),
          ),
      ) &&
      isRecord(value.result) &&
      isString(value.result.title) &&
      isString(value.result.description) &&
      isString(value.result.details) &&
      isString(value.result.invitation)
    );
  }
  if (template === "memory-quiz") {
    return (
      Array.isArray(value.questions) &&
      value.questions.every(
        (question) =>
          hasId(question) &&
          isString(question.prompt) &&
          isStringArray(question.answers) &&
          Number.isInteger(question.correctIndex) &&
          Number(question.correctIndex) >= 0 &&
          Number(question.correctIndex) < question.answers.length &&
          isString(question.memoryNote) &&
          isOptionalImage(question.photo),
      ) &&
      isString(value.finalMessage)
    );
  }
  if (template === "our-storybook") {
    return (
      Array.isArray(value.pages) &&
      value.pages.every(
        (page) =>
          hasId(page) &&
          isString(page.title) &&
          isString(page.body) &&
          isOptionalImage(page.photo),
      ) &&
      isString(value.finalMessage)
    );
  }
  if (template === "wish-upon-a-star") {
    return (
      Array.isArray(value.stars) &&
      value.stars.every(
        (star) =>
          hasId(star) &&
          isString(star.wish) &&
          isString(star.message) &&
          isString(star.color) &&
          isOptionalImage(star.photo),
      ) &&
      isString(value.finalMessage)
    );
  }
  return (
    Array.isArray(value.tracks) &&
    value.tracks.every(
      (track) =>
        hasId(track) &&
        isString(track.title) &&
        isString(track.artist) &&
        isString(track.why) &&
        isOptionalString(track.link) &&
        isOptionalImage(track.photo) &&
        isOptionalAudio(track.audio),
    ) &&
    isString(value.finalMessage)
  );
}

export function isSurpriseDataRecord(
  value: unknown,
  expectedTemplate?: TemplateType,
): value is SurpriseData {
  if (!isRecord(value) || !isString(value.template)) return false;
  if (!isAcceptedTemplateType(value.template)) return false;
  const template = value.template as TemplateType;
  if (expectedTemplate && template !== expectedTemplate) return false;
  const structurallyValid = (
    isBasics(value.basics) &&
    isContent(template, value.content) &&
    isAppearance(value.appearance) &&
    isMusic(value.music) &&
    isDelivery(value.delivery) &&
    isDelight(value.delight)
  );
  if (!structurallyValid) return false;
  if (template === "wish-upon-a-star") return true;
  if (
    template === "cozy-playlist" &&
    !hasCanonicalCozyPlaylistIdentity(value.content)
  )
    return false;
  return getCollectionLimitErrors(template, value.content).length === 0;
}

export interface DurableLocalMediaRecord {
  ownerKey: string;
  kind: "image" | "audio" | "video";
  mediaId: string;
  name: string;
  mimeType: string;
  size: number;
  blob: Blob;
}

function openDraftDatabase(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB_NAME, DB_VERSION);
    request.onerror = () => reject(request.error);
    request.onblocked = () =>
      reject(
        new Error(
          "Draft storage is open in another tab. Close older TinySurprise tabs and retry.",
        ),
      );
    request.onupgradeneeded = () => {
      const db = request.result;
      for (const name of [
        STORE_NAME,
        CREATIONS_STORE,
        CREATION_DRAFTS_STORE,
        LOCAL_MEDIA_STORE,
        RECIPIENTS_STORE,
      ])
        if (!db.objectStoreNames.contains(name)) db.createObjectStore(name);
    };
    request.onsuccess = () => {
      request.result.onversionchange = () => request.result.close();
      resolve(request.result);
    };
  });
}

async function withNamedStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  const database = await openDraftDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(storeName, mode);
    let value: T;
    let request: IDBRequest<T>;
    try {
      request = run(transaction.objectStore(storeName));
    } catch (error) {
      database.close();
      reject(error);
      return;
    }
    request.onsuccess = () => {
      value = request.result;
    };
    request.onerror = () => reject(request.error);
    transaction.oncomplete = () => {
      database.close();
      resolve(value);
    };
    transaction.onerror = () => {
      database.close();
      reject(transaction.error);
    };
    transaction.onabort = () => {
      database.close();
      reject(transaction.error || new Error("Draft transaction was aborted."));
    };
  });
}

async function withStore<T>(
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return withNamedStore(STORE_NAME, mode, run);
}

/** Shared low-level accessor so lib/creations.ts uses the same DB connection/version as this module, instead of opening it a second, conflicting way. */
export function withNamedTinySurpriseStore<T>(
  storeName: string,
  mode: IDBTransactionMode,
  run: (store: IDBObjectStore) => IDBRequest<T>,
): Promise<T> {
  return withNamedStore(storeName, mode, run);
}

/**
 * Runs a lifecycle operation in one IndexedDB transaction spanning the named
 * stores. The optional resolver is useful when a read inside the transaction
 * determines which writes should be issued; it still resolves only after the
 * transaction commits.
 */
export function withNamedTinySurpriseStores<T = void>(
  storeNames: string[],
  mode: IDBTransactionMode,
  run: (
    stores: Record<string, IDBObjectStore>,
    transaction: IDBTransaction,
    resolve: (value: T) => void,
    abort: (error: Error) => void,
  ) => void,
): Promise<T> {
  return openDraftDatabase().then(
    (database) =>
      new Promise<T>((resolve, reject) => {
        let settled = false;
        let result: T | undefined;
        let abortReason: Error | undefined;
        const finish = (callback: () => void) => {
          if (settled) return;
          settled = true;
          database.close();
          callback();
        };
        let transaction: IDBTransaction | undefined;
        try {
          const activeTransaction = database.transaction(storeNames, mode);
          transaction = activeTransaction;
          const stores = Object.fromEntries(
            storeNames.map((name) => [name, activeTransaction.objectStore(name)]),
          ) as Record<string, IDBObjectStore>;
          run(stores, activeTransaction, (value) => {
            result = value;
          }, (error) => {
            abortReason = error;
            activeTransaction.abort();
          });
        } catch (error) {
          try {
            transaction?.abort();
          } catch {
            // The transaction may already have completed or aborted.
          }
          finish(() => reject(error));
          return;
        }
        if (!transaction) {
          finish(() => reject(new Error("Draft transaction could not be opened.")));
          return;
        }
        transaction.oncomplete = () =>
          finish(() => resolve(result as T));
        transaction.onerror = () =>
          finish(() => reject(transaction.error || new Error("Draft transaction failed.")));
        transaction.onabort = () =>
          finish(() =>
            reject(abortReason || transaction.error || new Error("Draft transaction was aborted.")),
          );
      }),
  );
}

export function isBuilderDraftRecord(
  value: unknown,
  template: TemplateType,
): value is BuilderDraft {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<BuilderDraft>;
  return Boolean(
    draft.version === 1 &&
      Number.isInteger(draft.step) &&
      Number(draft.step) >= 1 &&
      Number(draft.step) <= 6 &&
      typeof draft.savedAt === "number" &&
      Number.isFinite(draft.savedAt) &&
      draft.savedAt > 0 &&
      isSurpriseDataRecord(draft.data, template),
  );
}

export function restoreDraftMedia(data: SurpriseData): SurpriseData {
  materializeEmbeddedDraftMedia(data);
  normalizeLocalImagePresentations(data);
  const objectUrls = new Map<string, string>();
  collectLocalMediaRefs(data).forEach(({ kind, media }) => {
    const mediaKey = `${kind}:${media.id}`;
    if (
      "source" in media &&
      media.source === "url"
    ) {
      media.unavailable = false;
      return;
    }
    if (media.file instanceof Blob) {
      const objectUrl =
        objectUrls.get(mediaKey) || URL.createObjectURL(media.file);
      objectUrls.set(mediaKey, objectUrl);
      media.previewUrl = objectUrl;
      media.unavailable = false;
    } else {
      if (!media.previewUrl.startsWith("data:")) media.previewUrl = "";
      media.unavailable = true;
    }
  });
  return data;
}

const durableMediaKey = (ownerKey: string, kind: string, mediaId: string) =>
  `${ownerKey}:${kind}:${mediaId}`;

/** Writes immutable media payloads beside a draft without changing its wire shape. */
export function persistDraftMediaRecords(
  store: IDBObjectStore,
  ownerKey: string,
  data: SurpriseData,
): void {
  const retainedKeys = new Set<string>();
  collectLocalMediaRefs(data).forEach(({ kind, media }) => {
    if ("source" in media && media.source === "url") return;
    const key = durableMediaKey(ownerKey, kind, media.id);
    retainedKeys.add(key);
    if (!(media.file instanceof Blob)) {
      // Metadata-only saves must retain owned bytes, never delete them.
      const existing = store.get(key);
      existing.onsuccess = () => {
        if (!existing.result?.blob && !media.unavailable) store.transaction.abort();
      };
      return;
    }
    const record: DurableLocalMediaRecord = {
      ownerKey,
      kind,
      mediaId: media.id,
      name: media.name,
      mimeType: media.mimeType,
      size: media.size,
      blob: media.file,
    };
    store.put(record, key);
  });
  const existingKeysRequest = store.getAllKeys();
  existingKeysRequest.onsuccess = () => {
    existingKeysRequest.result.forEach((key) => {
      if (
        typeof key === "string" &&
        key.startsWith(`${ownerKey}:`) &&
        !retainedKeys.has(key)
      ) {
        store.delete(key);
      }
    });
  };
}

export function deleteDraftMediaRecords(
  store: IDBObjectStore,
  ownerKeys: string[],
): void {
  if (!ownerKeys.length) return;
  const prefixes = ownerKeys.map((ownerKey) => `${ownerKey}:`);
  const request = store.getAllKeys();
  request.onsuccess = () => {
    request.result.forEach((key) => {
      if (typeof key === "string" && prefixes.some((prefix) => key.startsWith(prefix)))
        store.delete(key);
    });
  };
}

async function readDurableMediaRecords(
  ownerKeys: string[],
): Promise<DurableLocalMediaRecord[]> {
  if (!ownerKeys.length || typeof indexedDB === "undefined") return [];
  const owners = new Set(ownerKeys);
  const records = await withNamedTinySurpriseStores<unknown[]>([LOCAL_MEDIA_STORE], "readonly", (stores, _transaction, resolve) => {
    const records: unknown[] = [];
    let remaining = owners.size;
    owners.forEach(owner => {
      // Every owned key starts with owner + ':'. ';' is its exclusive upper bound.
      const range = IDBKeyRange.bound(`${owner}:`, `${owner};`, false, true);
      const request = stores[LOCAL_MEDIA_STORE].getAll(range);
      request.onsuccess = () => {
        for (const record of request.result) records.push(record);
        if (--remaining === 0) resolve(records);
      };
    });
  });
  return records.filter(
    (value): value is DurableLocalMediaRecord =>
      isRecord(value) &&
      isString(value.ownerKey) &&
      owners.has(value.ownerKey) &&
      (value.kind === "image" || value.kind === "audio" || value.kind === "video") &&
      isString(value.mediaId) &&
      isString(value.name) &&
      isString(value.mimeType) &&
      typeof value.size === "number" &&
      value.blob instanceof Blob,
  );
}

/** Hydrates a draft from durable media, falling back to legacy nested blobs. */
export async function restoreDraftMediaFromStore(
  data: SurpriseData,
  ownerKey: string,
  fallbackOwnerKey?: string,
  fallbackData?: SurpriseData,
): Promise<SurpriseData> {
  materializeEmbeddedDraftMedia(data);
  const records = await readDurableMediaRecords(
    [ownerKey, fallbackOwnerKey].filter((value): value is string => Boolean(value)),
  );
  // The primary owner wins over a legacy/edit-session fallback.
  const byMedia = new Map<string, DurableLocalMediaRecord>();
  for (const owner of [fallbackOwnerKey, ownerKey]) {
    records.filter(record => record.ownerKey === owner).forEach(record => {
      byMedia.set(`${record.kind}:${record.mediaId}`, record);
    });
  }
  const files = new Map<string, File>();
  const legacyFiles = new Map((fallbackData ? collectLocalMediaRefs(fallbackData) : [])
    .filter(ref => ref.media.file instanceof Blob)
    .map(ref => [`${ref.kind}:${ref.media.id}`, ref.media.file!] as const));
  collectLocalMediaRefs(data).forEach(({ kind, media }) => {
    if (("source" in media && media.source === "url") || media.file instanceof Blob) return;
    const record = byMedia.get(`${kind}:${media.id}`);
    if (record) {
      const key = `${kind}:${media.id}`;
      const file = files.get(key) || new File([record.blob], record.name, { type: record.mimeType });
      files.set(key, file);
      media.file = file;
      media.name = record.name;
      media.mimeType = record.mimeType;
      media.size = record.size || record.blob.size;
      media.unavailable = false;
    } else {
      const file = legacyFiles.get(`${kind}:${media.id}`);
      if (file) { media.file = file; media.size = file.size; media.unavailable = false; }
    }
  });
  return restoreDraftMedia(data);
}

/**
 * Same field traversal as restoreDraftMedia, read-only — returns every
 * blob: URL currently on the data so a caller (the viewer's imported-media
 * session) can revoke exactly what it created once the session ends,
 * without restoreDraftMedia itself needing to change its long-established
 * signature/callers.
 */
export function collectDraftMediaBlobUrls(data: SurpriseData): string[] {
  const urls: string[] = [];
  const record = (url?: string) => {
    if (url?.startsWith("blob:")) urls.push(url);
  };
  collectLocalMediaRefs(data).forEach(({ media }) =>
    record(media.previewUrl),
  );
  return urls;
}

/** Copy legacy owned bytes without hydrating URLs or leaving the transaction. */
export function copyLegacyDraftMediaRecords(
  store: IDBObjectStore, sourceOwner: string, destinationOwner: string, data: SurpriseData,
): void {
  collectUniqueLocalMediaRefs(data).forEach(({ kind, media }) => {
    if ("source" in media && media.source === "url") return;
    const destinationKey = durableMediaKey(destinationOwner, kind, media.id);
    const source = store.get(durableMediaKey(sourceOwner, kind, media.id));
    source.onsuccess = () => {
      const blob = media.file instanceof Blob ? media.file : source.result?.blob;
      if (!(blob instanceof Blob)) {
        // Keep missing-media metadata and the original legacy value available
        // for recovery; hydration reports unavailable bytes to the builder.
        return;
      }
      store.put({ ownerKey: destinationOwner, kind, mediaId: media.id,
        name: media.name, mimeType: media.mimeType, size: blob.size, blob,
      } satisfies DurableLocalMediaRecord, destinationKey);
    };
  });
}

export async function loadBuilderDraft(
  template: TemplateType,
): Promise<BuilderDraft | undefined> {
  if (typeof indexedDB === "undefined") return undefined;
  const draft = await withStore<unknown>("readonly", (store) =>
    store.get(template),
  );
  if (draft === undefined) return undefined;
  const normalizedDraft = normalizeCozyPlaylistDraftRecord(
    normalizeStorybookDraftRecord(normalizeMemoryQuizDraftRecord(draft)),
  );
  if (!isBuilderDraftRecord(normalizedDraft, template)) {
    await clearBuilderDraft(template).catch(() => undefined);
    return undefined;
  }
  normalizedDraft.data = await restoreDraftMediaFromStore(
    normalizeLegacyMusic(
      normalizeCozyPlaylistData(normalizeStorybookData(normalizedDraft.data)),
    ),
    template,
  );
  return normalizedDraft;
}

export async function saveBuilderDraft(
  template: TemplateType,
  data: SurpriseData,
  step: number,
): Promise<number> {
  if (typeof indexedDB === "undefined")
    throw new Error("Draft storage is unavailable.");
  const canonicalData = normalizeCozyPlaylistData(
    normalizeStorybookData(normalizeMemoryQuizData(normalizeLegacyMusic(data))),
  );
  if (!isSurpriseDataRecord(canonicalData as unknown, template))
    throw new Error("This draft contains invalid or unsupported data.");
  const limitError = template !== "wish-upon-a-star"
    ? getCollectionLimitErrors(template, canonicalData.content)[0]
    : undefined;
  if (limitError) {
    throw new Error(
      limitError.message,
    );
  }
  const savedAt = Date.now();
  materializeEmbeddedDraftMedia(canonicalData);
  await assertMediaIdentityConsistency(canonicalData);
  const draft: BuilderDraft = {
    data: cloneDraftDataForPersistence(canonicalData),
    step: Math.min(5, Math.max(1, step)),
    savedAt,
    version: 1,
  };
  await withNamedTinySurpriseStores(
    [STORE_NAME, LOCAL_MEDIA_STORE],
    "readwrite",
    (stores) => {
      stores[STORE_NAME].put(draft, template);
      persistDraftMediaRecords(stores[LOCAL_MEDIA_STORE], template, canonicalData);
    },
  );
  return savedAt;
}

export async function clearBuilderDraft(template: TemplateType): Promise<void> {
  if (typeof indexedDB === "undefined") return;
  await withNamedTinySurpriseStores(
    [STORE_NAME, LOCAL_MEDIA_STORE],
    "readwrite",
    (stores) => {
      stores[STORE_NAME].delete(template);
      deleteDraftMediaRecords(stores[LOCAL_MEDIA_STORE], [template]);
    },
  );
}
