import type { SurpriseData, TemplateType } from "./types";
import { TEMPLATES } from "./config";
import { cloneDraftDataForPersistence, createStableId, disposeDraftMedia, assertMediaIdentityConsistency, materializeEmbeddedDraftMedia } from "./local-media";
import { initialData } from "./builder-defaults";
import { classifyDuplicate, type DuplicateState } from "./duplicate-classifier";
import type { PackageAccessMode } from "./export/tinysurprise-package";
import {
  CREATIONS_STORE,
  CREATION_DRAFTS_STORE,
  LEGACY_DRAFTS_STORE,
  LOCAL_MEDIA_STORE,
  RECIPIENTS_STORE,
  isBuilderDraftRecord,
  isSurpriseDataRecord,
  restoreDraftMediaFromStore,
  persistDraftMediaRecords,
  copyLegacyDraftMediaRecords,
  deleteDraftMediaRecords,
  withNamedTinySurpriseStores,
  withNamedTinySurpriseStore,
} from "./builder-draft";
import { isAcceptedTemplateType } from "./template-registry";
import { getCollectionLimitErrors } from "./template-experience-definitions";
import {
  validateAppearance,
  validateBasics,
  validateContent,
  validateDelight,
  validateMusic,
} from "./validation";
import { normalizeLegacyMusic } from "./music";
import {
  isPlayableMemoryQuizContent,
  normalizeMemoryQuizData,
  normalizeMemoryQuizDraftRecord,
} from "./memory-quiz";
import {
  isPlayableStorybookContent,
  normalizeStorybookData,
  normalizeStorybookDraftRecord,
} from "./storybook";
import {
  isPlayableCozyPlaylistContent,
  normalizeCozyPlaylistData,
  normalizeCozyPlaylistDraftRecord,
} from "./cozy-playlist";
import {
  normalizePhotoPuzzlePackageData,
} from "./photo-puzzle-validation";
import { getImportedDataValidationError } from "./import-validation";

export type CreationStatus = "draft" | "completed" | "imported";

export interface CreationRecord {
  id: string;
  title: string;
  templateId: TemplateType;
  status: CreationStatus;
  createdAt: number;
  updatedAt: number;
  lastOpenedAt?: number;
  lastExportedAt?: number;
  lastBackedUpAt?: number;
  /** Small data: URL — only ever set from an already-embedded image, never a remote fetch. */
  thumbnail?: string;
  /** Content fingerprint of the last successful backup/export/import — see lib/export/content-hash.ts. Used for duplicate/conflict detection, not set until the first backup. */
  contentHash?: string;
  /** Hashing scheme version contentHash was computed with (lib/export/content-hash.ts's HASH_VERSION). Records saved before this field existed are treated as version 1 wherever it's read, never blocked or rehashed at startup. */
  hashVersion?: number;
  /** .tinysurprise manifest schema version this record's data last came from/went into (TINYSURPRISE_PACKAGE_VERSION). Informational only. */
  packageVersion?: number;
  /** ISO timestamp of the original import, distinct from createdAt/updatedAt which change on every edit. Only set for status "imported". */
  importedAt?: number;
  /** Recipient-facing access mode this Received item came in with — see lib/export/tinysurprise-package.ts. Only set for status "imported"; drives whether Library/viewer offer "Save and edit" at all. */
  accessMode?: PackageAccessMode;
  /** Set only on a draft created via "Save and edit" from a Received item — the id of that (untouched) Received record, never reused as this draft's own id. */
  importSourceCreationId?: string;
  derivedFromCreationId?: string;
  /** "received-editable" marks a draft created by "Save and edit"; absent for ordinary Created drafts. */
  source?: "received-editable";
  /** Sender name captured from the received package at the moment "Save and edit" ran, kept for reference even if the recipient later edits the draft's own sender field. */
  originalSenderName?: string;
  /** Read-only Library context derived from the saved draft, never persisted. */
  recipientContext?: string;
  /** Derived from a Library snapshot; never persisted as creation metadata. */
  recovery?: "missing-draft" | "invalid-draft";
  /** Import result only; not persisted in a creation. */
  reusedImport?: boolean;
}

export interface CreationDraftRecord {
  data: SurpriseData;
  step: number;
  revision?: number;
  baseRevision?: number;
  kind?: "edit-session";
  sourceCreationId?: string;
  sessionId?: string;
}

export class DraftConflictError extends Error {
  constructor() { super("This surprise changed in another tab. Reload it or save your work as a new draft."); }
}
export class ReceivedConflictError extends Error {
  constructor() { super("This saved surprise changed. Review the latest version before continuing."); }
}
export class NativeImportRecoveryError extends Error {}
export type ReceivedVersionGuard = Pick<CreationRecord, "updatedAt" | "contentHash" | "templateId">;
export interface DraftWriteGuard { revision: number; sessionId?: string }
function assertWriteGuard(guard: DraftWriteGuard, edit = false): void {
  if (!guard || !Number.isSafeInteger(guard.revision) || guard.revision < 0 || (edit && !guard.sessionId)) throw new DraftConflictError();
}
const revisionOf = (draft: unknown): number => {
  const value = (draft as Partial<CreationDraftRecord> | undefined)?.revision;
  return Number.isSafeInteger(value) && Number(value) >= 0 ? Number(value) : 0;
};

const MIGRATION_MARKER_ID = "__migration_v2_complete__";
const MIGRATION_CHECKPOINT_PREFIX = "__migration_v2_checkpoint__:";
const NATIVE_IMPORT_RECEIPT_PREFIX = "__native_import_result__:";
export interface LegacyMigrationFailure { templateId: TemplateType; reason: string }
// Also retain failures when storage is too full to write a failure checkpoint.
// A Library refresh never retries an unchanged failed item in this session.
const legacyMigrationFailures = new Map<TemplateType, LegacyMigrationFailure>();
const isReservedId = (id: string) =>
  id === MIGRATION_MARKER_ID || id.startsWith(MIGRATION_CHECKPOINT_PREFIX) || id.startsWith(NATIVE_IMPORT_RECEIPT_PREFIX);
const EDIT_SESSION_PREFIX = "edit:";
export const editSessionKey = (creationId: string) =>
  `${EDIT_SESSION_PREFIX}${creationId}`;

export type BuilderEntryMode = "new" | "draft" | "edit-created";

type CreationWriteState = {
  generation: number;
  queue: Promise<void>;
};

const creationWriteStates = new Map<string, CreationWriteState>();
let destructiveClearInProgress = false;
let writeEpoch = 0;

function getWriteState(key: string): CreationWriteState {
  const existing = creationWriteStates.get(key);
  if (existing) return existing;
  const created: CreationWriteState = {
    generation: 0,
    queue: Promise.resolve(),
  };
  creationWriteStates.set(key, created);
  return created;
}

function invalidateWrites(key: string): number {
  const state = getWriteState(key);
  state.generation += 1;
  return state.generation;
}

function queueOrderedWrite(
  key: string,
  work: (generation: number) => Promise<void>,
): Promise<void> {
  const state = getWriteState(key);
  const generation = state.generation;
  const epoch = writeEpoch;
  const run = state.queue
    .catch(() => undefined)
    .then(() => {
      if (destructiveClearInProgress || epoch !== writeEpoch)
        throw new Error("Tiny Surprise data is being cleared.");
      return work(generation);
    });
  state.queue = run.catch(() => undefined);
  return run;
}

function assertCurrentWrite(key: string, generation: number) {
  if (getWriteState(key).generation !== generation)
    throw new Error("This saved change is no longer current.");
}

function normalizeCreationData(data: SurpriseData): SurpriseData {
  return normalizeCozyPlaylistData(
    normalizeStorybookData(normalizeMemoryQuizData(normalizeLegacyMusic(data))),
  );
}

function normalizeImportedPackageData(data: SurpriseData): SurpriseData {
  const canonical = normalizePhotoPuzzlePackageData(normalizeCreationData(structuredClone(data)));
  materializeEmbeddedDraftMedia(canonical);
  return canonical;
}

async function assertImportedPackagePlayable(data: SurpriseData): Promise<void> {
  const validationError = await getImportedDataValidationError(data);
  if (validationError) throw new Error(validationError);
}

function cloneCreationData(data: SurpriseData): SurpriseData {
  const clone = structuredClone(normalizeCreationData(data));
  materializeEmbeddedDraftMedia(clone);
  return clone;
}

function assertStructurallyValidCreationData(data: SurpriseData, templateId: TemplateType) {
  const canonicalData = normalizeCreationData(data);
  if (!isSurpriseDataRecord(canonicalData, templateId))
    throw new Error("This surprise contains invalid or unsupported data.");
  const limitError =
    templateId !== "wish-upon-a-star"
      ? getCollectionLimitErrors(templateId, canonicalData.content, "compatibility", true)[0]
      : undefined;
  if (limitError) throw new Error(limitError.message);
  return canonicalData;
}

export function assertFinalizedCreationData(
  data: SurpriseData,
  policy: "recommended" | "compatibility" = "recommended",
): SurpriseData {
  const canonicalData = assertStructurallyValidCreationData(data, data.template);
  const checks = [
    validateBasics(canonicalData.basics),
    validateContent(canonicalData.template, canonicalData.content, policy),
    validateAppearance(canonicalData.appearance),
    validateDelight(canonicalData.delight),
    validateMusic(canonicalData.music),
  ];
  const errors = checks.flatMap((check) => check.errors);
  if (errors.length) throw new Error(errors.map((error) => error.message).join(" "));
  return canonicalData;
}

function isCreationRecord(value: unknown): value is CreationRecord {
  if (!value || typeof value !== "object") return false;
  const record = value as Partial<CreationRecord>;
  return Boolean(
    typeof record.id === "string" &&
      record.id.length > 0 &&
      typeof record.title === "string" &&
      isAcceptedTemplateType(record.templateId) &&
      (record.status === "draft" ||
        record.status === "completed" ||
        record.status === "imported") &&
      typeof record.createdAt === "number" &&
      Number.isFinite(record.createdAt) &&
      record.createdAt > 0 &&
      typeof record.updatedAt === "number" &&
      Number.isFinite(record.updatedAt) &&
      record.updatedAt > 0,
  );
}

function isStoredCreationDraft(
  value: unknown,
  templateId: TemplateType,
): value is CreationDraftRecord {
  if (!value || typeof value !== "object") return false;
  const draft = value as Partial<CreationDraftRecord>;
  let normalizedData: SurpriseData | undefined;
  try {
    normalizedData =
      draft.data && typeof draft.data === "object"
        ? normalizeCreationData(draft.data as SurpriseData)
        : undefined;
  } catch {
    return false;
  }
  return Boolean(
    Number.isInteger(draft.step) &&
      Number(draft.step) >= 1 &&
      Number(draft.step) <= 6 &&
      normalizedData &&
      isSurpriseDataRecord(normalizedData, templateId),
  );
}

function templateLabel(templateId: TemplateType): string {
  return TEMPLATES[templateId]?.name || templateId;
}

/**
 * One-time migration of the legacy "one draft per template" store into the
 * multi-creation library. The completion marker remains the fast path for
 * already-migrated databases, while each new migration item also gets a
 * deterministic destination and checkpoint so interruption cannot duplicate
 * work that already committed.
 */
async function migrateLegacyDraftsOnce(retryTemplate?: TemplateType): Promise<void> {
  const marker = await withNamedTinySurpriseStore<unknown>(
    CREATIONS_STORE,
    "readonly",
    (store) => store.get(MIGRATION_MARKER_ID),
  );
  if (marker && !retryTemplate) return;

  const keys = await withNamedTinySurpriseStore<IDBValidKey[]>(
    LEGACY_DRAFTS_STORE,
    "readonly",
    (store) => store.getAllKeys(),
  );
  let checkpointsRecorded = true;

  for (const key of keys) {
    const templateId = String(key);
    if (!isAcceptedTemplateType(templateId)) continue;
    if (retryTemplate && templateId !== retryTemplate) continue;
    if (!retryTemplate && legacyMigrationFailures.has(templateId)) { checkpointsRecorded = false; continue; }
    const checkpointId = `${MIGRATION_CHECKPOINT_PREFIX}${templateId}`;
    try {
      const checkpoint = await withNamedTinySurpriseStore<unknown>(
        CREATIONS_STORE,
        "readonly",
        (store) => store.get(checkpointId),
      );
      // Existing migrated/unknown checkpoints keep their historic skip semantics.
      // Only an explicit retry may revisit an invalid or failed checkpoint.
      if (checkpoint && !(retryTemplate && typeof checkpoint === "object" &&
          ["invalid", "failed"].includes(String((checkpoint as { status?: unknown }).status)))) {
        if ((checkpoint as { status?: unknown }).status === "migrated") legacyMigrationFailures.delete(templateId);
        continue;
      }

      const template = templateId as TemplateType;
      const raw = await withNamedTinySurpriseStore<unknown>(
        LEGACY_DRAFTS_STORE, "readonly", store => store.get(key),
      );
      const normalizedRaw = normalizeCozyPlaylistDraftRecord(
        normalizeStorybookDraftRecord(normalizeMemoryQuizDraftRecord(raw)),
      );
      if (!isBuilderDraftRecord(normalizedRaw, template)) {
        throw new Error("This legacy draft contains incomplete or damaged saved data.");
      }

      // The legacy store has one stable key per template, so the destination
      // key can be stable too. This is what makes a retry idempotent.
      materializeEmbeddedDraftMedia(normalizedRaw.data);
      await assertMediaIdentityConsistency(normalizedRaw.data);
      const id = `legacy:${templateId}`;
      const now = Date.now();
      const record: CreationRecord = {
        id,
        title: `Untitled ${templateLabel(templateId)}`,
        templateId: template,
        status: "draft",
        createdAt: now,
        updatedAt: normalizedRaw.savedAt || now,
      };
      await withNamedTinySurpriseStores(
        [LEGACY_DRAFTS_STORE, CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
        "readwrite",
        (stores, transaction) => {
          const existingCreationRequest = stores[CREATIONS_STORE].get(id);
          const existingDraftRequest = stores[CREATION_DRAFTS_STORE].get(id);
          const legacyRequest = stores[LEGACY_DRAFTS_STORE].get(templateId);
          let existingCreation: unknown;
          let existingDraft: unknown;
          let completeReads = 0;
          const commit = () => {
            completeReads += 1;
            if (completeReads !== 3) return;
            if (legacyRequest.result?.savedAt !== normalizedRaw.savedAt) {
              transaction.abort();
              return;
            }
            if (!isCreationRecord(existingCreation))
              stores[CREATIONS_STORE].put(record, id);
            if (!isStoredCreationDraft(existingDraft, template)) {
              stores[CREATION_DRAFTS_STORE].put(
                { data: cloneDraftDataForPersistence(normalizedRaw.data), step: normalizedRaw.step },
                id,
              );
              copyLegacyDraftMediaRecords(stores[LOCAL_MEDIA_STORE], templateId, id, normalizedRaw.data);
            }
            stores[CREATIONS_STORE].put(
              {
                id: checkpointId,
                sourceKey: templateId,
                destinationId: id,
                status: "migrated",
                recordedAt: Date.now(),
              },
              checkpointId,
            );
          };
          existingCreationRequest.onsuccess = () => {
            existingCreation = existingCreationRequest.result;
            commit();
          };
          existingDraftRequest.onsuccess = () => {
            existingDraft = existingDraftRequest.result;
            commit();
          };
          legacyRequest.onsuccess = commit;
          // Keep TypeScript aware that this transaction is intentionally held
          // by the three request callbacks above.
          void transaction;
        },
      );
      legacyMigrationFailures.delete(template);
    } catch (error) {
      const failure: LegacyMigrationFailure = {
        templateId,
        reason: error instanceof Error ? error.message : "This legacy draft could not be restored safely.",
      };
      legacyMigrationFailures.set(templateId, failure);
      try {
        await withNamedTinySurpriseStores([CREATIONS_STORE], "readwrite", (stores) => {
          const request = stores[CREATIONS_STORE].get(checkpointId);
          request.onsuccess = () => {
            // A concurrent tab may have committed this item successfully.
            if (request.result?.status === "migrated") { legacyMigrationFailures.delete(templateId); return; }
            stores[CREATIONS_STORE].put({ id: checkpointId, sourceKey: templateId,
              status: "failed", reason: failure.reason, recordedAt: Date.now() }, checkpointId);
          };
        });
      } catch {
        // Failure reporting must not block access to unrelated saved creations.
        checkpointsRecorded = false;
      }
    }
  }

  // The marker records completion of this pass, not success of failed items.
  // Failed checkpoints remain discoverable and explicitly retryable.
  if (retryTemplate || !checkpointsRecorded) return;
  const doneMarker: CreationRecord = {
    id: MIGRATION_MARKER_ID,
    title: "",
    templateId: "catch-the-heart",
    status: "draft",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
  await withNamedTinySurpriseStore(CREATIONS_STORE, "readwrite", (store) =>
    store.put(doneMarker, MIGRATION_MARKER_ID),
  ).catch(() => undefined); // Per-item checkpoints still make the next pass idempotent.
}

export async function listLegacyMigrationFailures(): Promise<LegacyMigrationFailure[]> {
  if (typeof indexedDB === "undefined") return [];
  const failures = new Map<TemplateType, LegacyMigrationFailure>();
  const legacyKeys = new Set((await withNamedTinySurpriseStore<IDBValidKey[]>(
    LEGACY_DRAFTS_STORE, "readonly", store => store.getAllKeys(),
  )).map(String));
  const values = await withNamedTinySurpriseStore<unknown[]>(CREATIONS_STORE, "readonly", store => store.getAll());
  for (const value of values) {
    if (!value || typeof value !== "object") continue;
    const item = value as { id?: unknown; sourceKey?: unknown; status?: unknown; reason?: unknown };
    if (typeof item.id === "string" && item.id.startsWith(MIGRATION_CHECKPOINT_PREFIX) &&
        typeof item.sourceKey === "string" && isAcceptedTemplateType(item.sourceKey) && legacyKeys.has(item.sourceKey) &&
        (item.status === "failed" || item.status === "invalid")) {
      failures.set(item.sourceKey, { templateId: item.sourceKey,
        reason: typeof item.reason === "string" ? item.reason : "This legacy draft could not be restored safely." });
    }
    if (typeof item.id === "string" && item.id.startsWith(MIGRATION_CHECKPOINT_PREFIX) &&
        typeof item.sourceKey === "string" && isAcceptedTemplateType(item.sourceKey) && item.status === "migrated") {
      legacyMigrationFailures.delete(item.sourceKey);
    }
  }
  legacyMigrationFailures.forEach((failure, template) => {
    if (legacyKeys.has(template)) failures.set(template, failure);
    else legacyMigrationFailures.delete(template);
  });
  return [...failures.values()];
}

/** One user-requested attempt; never deletes source data or a failure checkpoint first. */
export async function retryLegacyDraftMigration(templateId: TemplateType): Promise<void> {
  if (!isAcceptedTemplateType(templateId)) throw new Error("This legacy template is unsupported.");
  await migrateLegacyDraftsOnce(templateId);
  const failure = (await listLegacyMigrationFailures()).find(item => item.templateId === templateId);
  if (failure) throw new Error(`${failure.reason} The original legacy draft is still kept for recovery.`);
}

function readLibrarySnapshot(
  stores: Record<string, IDBObjectStore>,
  complete: (records: CreationRecord[]) => void,
): void {
  const drafts = new Map<string, unknown>();
  let all: unknown[] = [];
  let remaining = 2;
  const finish = () => {
    if (--remaining !== 0) return;
    complete(all.filter(isCreationRecord).filter(record => !isReservedId(record.id)).map(record => {
      const draft = drafts.get(record.id);
      return isStoredCreationDraft(draft, record.templateId)
        ? { ...record, recipientContext: draft.data.basics.recipientName, recovery: undefined }
        : { ...record, recovery: draft === undefined ? "missing-draft" as const : "invalid-draft" as const };
    }));
  };
  const metadata = stores[CREATIONS_STORE].getAll();
  metadata.onsuccess = () => { all = metadata.result; finish(); };
  const cursor = stores[CREATION_DRAFTS_STORE].openCursor();
  cursor.onsuccess = () => {
    if (!cursor.result) { finish(); return; }
    drafts.set(String(cursor.result.key), cursor.result.value);
    cursor.result.continue();
  };
}

export async function listCreations(): Promise<CreationRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  await migrateLegacyDraftsOnce();
  const records = await withNamedTinySurpriseStores<CreationRecord[]>(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE], "readonly",
    (stores, _transaction, resolve) => readLibrarySnapshot(stores, resolve),
  );
  return records.sort((a, b) => b.updatedAt - a.updatedAt);
}

/** Diagnostic details only: never rewrites the damaged draft or includes device paths. */
export async function getCreationRecoveryDetails(id: string): Promise<File> {
  const details = await withNamedTinySurpriseStores<unknown>(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE], "readonly", (stores, _transaction, resolve, abort) => {
      const metadata = stores[CREATIONS_STORE].get(id);
      metadata.onsuccess = () => {
        const record = metadata.result;
        if (!isCreationRecord(record) || isReservedId(id)) { abort(new Error("This saved item could not be found.")); return; }
        const draft = stores[CREATION_DRAFTS_STORE].get(id);
        const media = stores[LOCAL_MEDIA_STORE].count(IDBKeyRange.bound(`${id}:`, `${id};`, false, true));
        let remaining = 2;
        const finish = () => {
          if (--remaining) return;
          resolve({
            purpose: "Tiny Surprise recovery details", version: 1,
            note: "These details are not a restorable backup and do not include messages, photos or audio. Original stored data has not been changed.",
            creation: { id: record.id, title: record.title, templateId: record.templateId, status: record.status, createdAt: record.createdAt, updatedAt: record.updatedAt },
            draftState: draft.result === undefined ? "missing" : isStoredCreationDraft(draft.result, record.templateId) ? "recognized" : "unrecognized",
            ownedMediaRecords: media.result,
          });
        };
        draft.onsuccess = finish;
        media.onsuccess = finish;
      };
    },
  );
  return new File([JSON.stringify(details, null, 2)], `tiny-surprise-recovery-${Date.now()}.json`, { type: "application/json" });
}

export async function getCreation(
  id: string,
): Promise<CreationRecord | undefined> {
  if (typeof indexedDB === "undefined" || isReservedId(id)) return undefined;
  const value = await withNamedTinySurpriseStore<unknown>(
    CREATIONS_STORE,
    "readonly",
    (store) => store.get(id),
  );
  return isCreationRecord(value) && value.id === id ? value : undefined;
}

async function updateCreation(
  id: string,
  update: (record: CreationRecord) => CreationRecord,
): Promise<void> {
  await withNamedTinySurpriseStores(
    [CREATIONS_STORE],
    "readwrite",
    (stores) => {
      const request = stores[CREATIONS_STORE].get(id);
      request.onsuccess = () => {
        const existing = request.result;
        if (isCreationRecord(existing))
          stores[CREATIONS_STORE].put(update(existing), id);
      };
    },
  );
}

export async function createCreation(
  templateId: TemplateType,
  title?: string,
): Promise<CreationRecord> {
  const id = createStableId("creation");
  const now = Date.now();
  const record: CreationRecord = {
    id,
    title: title?.trim() || `Untitled ${templateLabel(templateId)}`,
    templateId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
  };
  await withNamedTinySurpriseStores(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
    "readwrite",
    (stores) => {
      stores[CREATIONS_STORE].put(record, id);
      stores[CREATION_DRAFTS_STORE].put(
        { data: cloneCreationData(initialData(templateId)), step: 1 },
        id,
      );
    },
  );
  return record;
}

async function writeCreationDraft(
  id: string, canonicalData: SurpriseData, step: number, generation: number,
  guard: DraftWriteGuard,
): Promise<number> {
  const updatedAt = Date.now();
  assertCurrentWrite(id, generation);
  await withNamedTinySurpriseStores(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE], "readwrite",
    (stores, transaction, _resolve, abort) => {
      const recordRequest = stores[CREATIONS_STORE].get(id);
      recordRequest.onsuccess = () => {
        const existing = recordRequest.result;
        if (!isCreationRecord(existing) || existing.status !== "draft") {
          abort(new Error("This draft is no longer available for editing.")); return;
        }
        const draftRequest = stores[CREATION_DRAFTS_STORE].get(id);
        draftRequest.onsuccess = () => {
          const revision = revisionOf(draftRequest.result);
          if (guard && guard.revision !== revision) { abort(new DraftConflictError()); return; }
          if (getWriteState(id).generation !== generation) { transaction.abort(); return; }
          stores[CREATION_DRAFTS_STORE].put({
            data: cloneDraftDataForPersistence(canonicalData),
            step: Math.min(6, Math.max(1, step)), revision: revision + 1,
          }, id);
          persistDraftMediaRecords(stores[LOCAL_MEDIA_STORE], id, canonicalData);
          stores[CREATIONS_STORE].put({ ...existing, updatedAt }, id);
        };
      };
    },
  );
  return updatedAt;
}

export async function saveCreationDraft(
  id: string, data: SurpriseData, step: number, guard: DraftWriteGuard,
): Promise<number> {
  assertWriteGuard(guard);
  if (typeof indexedDB === "undefined" || isReservedId(id)) throw new Error("Draft storage is unavailable.");
  const canonicalData = cloneCreationData(assertStructurallyValidCreationData(data, data.template));
  let savedAt = 0;
  await queueOrderedWrite(id, async (generation) => {
    await assertMediaIdentityConsistency(canonicalData);
    savedAt = await writeCreationDraft(id, canonicalData, step, generation, guard);
  });
  return savedAt;
}

export async function resetCreationDraft(
  id: string, data: SurpriseData, step: number, guard: DraftWriteGuard,
): Promise<number> {
  invalidateWrites(id);
  return saveCreationDraft(id, data, step, guard);
}

function normalizeLoadedData(data: SurpriseData, templateId: TemplateType) {
  let normalizedData: SurpriseData;
  try {
    normalizedData = normalizeCreationData(data);
  } catch {
    return undefined;
  }
  if (!isSurpriseDataRecord(normalizedData, templateId)) return undefined;
  return normalizedData;
}

function isCompatibilityPlayable(data: SurpriseData, status: CreationStatus) {
  if (status === "draft") return true;
  if (
    data.template === "memory-quiz" &&
    !isPlayableMemoryQuizContent(data.content, "compatibility")
  )
    return false;
  if (
    data.template === "our-storybook" &&
    !isPlayableStorybookContent(data.content, "compatibility")
  )
    return false;
  if (
    data.template === "cozy-playlist" &&
    !isPlayableCozyPlaylistContent(data.content, "compatibility")
  )
    return false;
  return true;
}

function restoreStoredDraft(
  raw: unknown,
  creation: CreationRecord,
): CreationDraftRecord | undefined {
  if (!raw || typeof raw !== "object") return undefined;
  const draft = raw as CreationDraftRecord;
  const normalizedData = normalizeLoadedData(draft.data, creation.templateId);
  if (
    !normalizedData ||
    !Number.isInteger(draft.step) ||
    Number(draft.step) < 1 ||
    Number(draft.step) > 6 ||
    !isCompatibilityPlayable(normalizedData, draft.kind === "edit-session" ? "draft" : creation.status)
  )
    return undefined;
  return {
    data: normalizedData,
    step: Number(draft.step),
    revision: revisionOf(draft),
    baseRevision: draft.baseRevision,
    ...(draft.kind === "edit-session"
      ? {
          kind: "edit-session" as const,
          sourceCreationId: draft.sourceCreationId,
          sessionId: draft.sessionId,
        }
      : {}),
  };
}

export async function loadCreationDraft(
  id: string,
): Promise<CreationDraftRecord | undefined> {
  if (typeof indexedDB === "undefined" || isReservedId(id)) return undefined;
  const raw = await withNamedTinySurpriseStore<unknown>(
    CREATION_DRAFTS_STORE,
    "readonly",
    (store) => store.get(id),
  );
  const creation = await getCreation(id);
  const restored = creation ? restoreStoredDraft(raw, creation) : undefined;
  if (!restored) return undefined;
  // Older successful checkpoints may predate transfer of owner-scoped bytes.
  // Read through to the retained legacy owner; never rewrite an edited draft.
  const legacyOwner = creation && id === `legacy:${creation.templateId}` ? creation.templateId : undefined;
  const rawLegacy = legacyOwner ? await withNamedTinySurpriseStore<unknown>(
    LEGACY_DRAFTS_STORE, "readonly", store => store.get(legacyOwner),
  ) : undefined;
  const legacy = normalizeCozyPlaylistDraftRecord(normalizeStorybookDraftRecord(normalizeMemoryQuizDraftRecord(rawLegacy)));
  const legacyData = legacyOwner && isBuilderDraftRecord(legacy, legacyOwner) ? legacy.data : undefined;
  restored.data = await restoreDraftMediaFromStore(restored.data, id, legacyOwner, legacyData);
  return restored;
}

export interface EditSessionDraft {
  revision: number;
  baseRevision: number;
  data: SurpriseData;
  step: number;
  sourceCreationId: string;
  sessionId: string;
  created: boolean;
}

export async function createOrLoadEditSession(
  sourceCreationId: string,
): Promise<EditSessionDraft> {
  const creation = await getCreation(sourceCreationId);
  if (!creation || creation.status !== "completed")
    throw new Error("This completed surprise is no longer available for editing.");
  const finalized = await loadCreationDraft(sourceCreationId);
  if (!finalized)
    throw new Error("This surprise could not be restored safely for editing.");
  try {
    const key = editSessionKey(sourceCreationId);
    const result = await withNamedTinySurpriseStores<EditSessionDraft>(
      [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
      "readwrite",
      (stores, transaction, resolve, abort) => {
        const sourceRequest = stores[CREATIONS_STORE].get(sourceCreationId);
        const sessionRequest = stores[CREATION_DRAFTS_STORE].get(key);
        const finalizedRequest = stores[CREATION_DRAFTS_STORE].get(sourceCreationId);
        let currentFinalized: unknown;
        let source: unknown;
        let session: unknown;
        let reads = 0;
        const finish = () => {
          reads += 1;
          if (reads !== 3) return;
          if (revisionOf(currentFinalized) !== revisionOf(finalized)) { abort(new DraftConflictError()); return; }
          if (
            !isCreationRecord(source) ||
            source.status !== "completed" ||
            source.templateId !== finalized.data.template
          ) {
            transaction.abort();
            return;
          }
          if (session !== undefined) {
            const restored = restoreStoredDraft(session, source);
            const rawSession = session as Partial<CreationDraftRecord>;
            if (
              !restored ||
              rawSession.kind !== "edit-session" ||
              rawSession.sourceCreationId !== sourceCreationId ||
              typeof rawSession.sessionId !== "string"
            ) {
              transaction.abort();
              return;
            }
            resolve({
              data: restored.data,
              step: restored.step,
              sourceCreationId,
              sessionId: rawSession.sessionId,
              revision: revisionOf(rawSession),
              baseRevision: rawSession.baseRevision ?? 0,
              created: false,
            });
            return;
          }
          const sessionId = createStableId("edit-session");
          const data = cloneDraftDataForPersistence(finalized.data);
          stores[CREATION_DRAFTS_STORE].put(
            {
              data,
              step: finalized.step,
              kind: "edit-session",
              sourceCreationId,
              sessionId,
              revision: 0,
              baseRevision: revisionOf(finalized),
            } as CreationDraftRecord,
            key,
          );
          persistDraftMediaRecords(
            stores[LOCAL_MEDIA_STORE],
            key,
            finalized.data,
          );
          resolve({
            data,
            step: finalized.step,
            sourceCreationId,
            sessionId,
            revision: 0,
            baseRevision: revisionOf(finalized),
            created: true,
          });
        };
        sourceRequest.onsuccess = () => {
          source = sourceRequest.result;
          finish();
        };
        finalizedRequest.onsuccess = () => { currentFinalized = finalizedRequest.result; finish(); };
        sessionRequest.onsuccess = () => {
          session = sessionRequest.result;
          finish();
        };
      },
    );
    result.data = await restoreDraftMediaFromStore(
      result.data,
      key,
      sourceCreationId,
    );
    return result;
  } finally {
    disposeDraftMedia(finalized.data);
  }
}

export async function loadEditSessionDraft(
  sourceCreationId: string,
): Promise<EditSessionDraft | undefined> {
  const creation = await getCreation(sourceCreationId);
  if (!creation || creation.status !== "completed") return undefined;
  const raw = await withNamedTinySurpriseStore<unknown>(
    CREATION_DRAFTS_STORE,
    "readonly",
    (store) => store.get(editSessionKey(sourceCreationId)),
  );
  if (!raw || typeof raw !== "object") return undefined;
  const restored = restoreStoredDraft(raw, creation);
  const session = raw as Partial<CreationDraftRecord>;
  if (
    !restored ||
    session.kind !== "edit-session" ||
    session.sourceCreationId !== sourceCreationId ||
    typeof session.sessionId !== "string"
  )
    return undefined;
  const data = await restoreDraftMediaFromStore(
    restored.data,
    editSessionKey(sourceCreationId),
    sourceCreationId,
  );
  return {
    data,
    step: restored.step,
    sourceCreationId,
    sessionId: session.sessionId,
    revision: revisionOf(session),
    baseRevision: session.baseRevision ?? 0,
    created: false,
  };
}

export async function saveEditSessionDraft(
  sourceCreationId: string,
  data: SurpriseData,
  step: number,
  guard: DraftWriteGuard,
): Promise<number> {
  assertWriteGuard(guard, true);
  const creation = await getCreation(sourceCreationId);
  if (!creation || creation.status !== "completed")
    throw new Error("This edit session is no longer available.");
  const canonicalData = cloneCreationData(
    assertStructurallyValidCreationData(data, creation.templateId),
  );
  const key = editSessionKey(sourceCreationId);
  const updatedAt = Date.now();
  await queueOrderedWrite(key, async (generation) => {
    await assertMediaIdentityConsistency(canonicalData);
    assertCurrentWrite(key, generation);
    await withNamedTinySurpriseStores(
      [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
      "readwrite",
      (stores, transaction, _resolve, abort) => {
        const sourceRequest = stores[CREATIONS_STORE].get(sourceCreationId);
        const sessionRequest = stores[CREATION_DRAFTS_STORE].get(key);
        let source: unknown;
        let session: unknown;
        let reads = 0;
        const finish = () => {
          reads += 1;
          if (reads !== 2) return;
          if (
            !isCreationRecord(source) ||
            source.status !== "completed" ||
            !session ||
            typeof session !== "object" ||
            (session as Partial<CreationDraftRecord>).kind !== "edit-session"
          ) {
            transaction.abort();
            return;
          }
          if (getWriteState(key).generation !== generation) {
            transaction.abort();
            return;
          }
          const sessionRecord = session as CreationDraftRecord;
          if (guard && (guard.revision !== revisionOf(sessionRecord) || guard.sessionId !== sessionRecord.sessionId)) {
            abort(new DraftConflictError()); return;
          }
          stores[CREATION_DRAFTS_STORE].put(
            {
              ...sessionRecord,
              revision: revisionOf(sessionRecord) + 1,
              data: cloneDraftDataForPersistence(canonicalData),
              step: Math.min(6, Math.max(1, step)),
            },
            key,
          );
          persistDraftMediaRecords(stores[LOCAL_MEDIA_STORE], key, canonicalData);
        };
        sourceRequest.onsuccess = () => {
          source = sourceRequest.result;
          finish();
        };
        sessionRequest.onsuccess = () => {
          session = sessionRequest.result;
          finish();
        };
      },
    );
  });
  return updatedAt;
}

export async function resetEditSessionDraft(
  sourceCreationId: string,
  data: SurpriseData,
  step: number,
  guard: DraftWriteGuard,
): Promise<number> {
  invalidateWrites(editSessionKey(sourceCreationId));
  return saveEditSessionDraft(sourceCreationId, data, step, guard);
}

export async function commitEditSession(
  sourceCreationId: string,
  data: SurpriseData,
  step: number,
  policy: "recommended" | "compatibility" = "recommended",
  guard: DraftWriteGuard,
): Promise<number> {
  assertWriteGuard(guard, true);
  const source = await getCreation(sourceCreationId);
  if (!source || source.status !== "completed")
    throw new Error("This finalized surprise is no longer available.");
  const canonicalData = cloneCreationData(assertFinalizedCreationData(data, policy));
  await assertMediaIdentityConsistency(canonicalData);
  if (canonicalData.template !== source.templateId)
    throw new Error("This edit belongs to a different template.");
  const key = editSessionKey(sourceCreationId);
  invalidateWrites(key);
  const updatedAt = Date.now();
  await queueOrderedWrite(key, async (generation) => {
    assertCurrentWrite(key, generation);
    await withNamedTinySurpriseStores(
      [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
      "readwrite",
      (stores, transaction, _resolve, abort) => {
        const sourceRequest = stores[CREATIONS_STORE].get(sourceCreationId);
        const sessionRequest = stores[CREATION_DRAFTS_STORE].get(key);
        let currentSource: unknown;
        let session: unknown;
        let reads = 0;
        const finish = () => {
          reads += 1;
          if (reads !== 2) return;
          if (
            !isCreationRecord(currentSource) ||
            currentSource.status !== "completed" ||
            !session ||
            typeof session !== "object" ||
            (session as Partial<CreationDraftRecord>).kind !== "edit-session"
          ) {
            transaction.abort();
            return;
          }
          if (getWriteState(key).generation !== generation) {
            transaction.abort();
            return;
          }
          const sessionRecord = session as CreationDraftRecord;
          if (guard && (guard.revision !== revisionOf(sessionRecord) || guard.sessionId !== sessionRecord.sessionId)) {
            abort(new DraftConflictError()); return;
          }
          const finalRequest = stores[CREATION_DRAFTS_STORE].get(sourceCreationId);
          finalRequest.onsuccess = () => {
          if ((sessionRecord.baseRevision ?? 0) !== revisionOf(finalRequest.result)) {
            abort(new DraftConflictError()); return;
          }
          stores[CREATIONS_STORE].put(
            { ...(currentSource as CreationRecord), updatedAt },
            sourceCreationId,
          );
          stores[CREATION_DRAFTS_STORE].put(
            {
              data: cloneDraftDataForPersistence(canonicalData),
              step: Math.min(6, Math.max(1, step)),
              revision: revisionOf(finalRequest.result) + 1,
            },
            sourceCreationId,
          );
          persistDraftMediaRecords(
            stores[LOCAL_MEDIA_STORE],
            sourceCreationId,
            canonicalData,
          );
          stores[CREATION_DRAFTS_STORE].delete(key);
          deleteDraftMediaRecords(stores[LOCAL_MEDIA_STORE], [key]);
          };
        };
        sourceRequest.onsuccess = () => {
          currentSource = sourceRequest.result;
          finish();
        };
        sessionRequest.onsuccess = () => {
          session = sessionRequest.result;
          finish();
        };
      },
    );
  });
  return updatedAt;
}

export async function discardEditSession(sourceCreationId: string, guard: DraftWriteGuard): Promise<void> {
  assertWriteGuard(guard, true);
  const key = editSessionKey(sourceCreationId);
  invalidateWrites(key);
  await queueOrderedWrite(key, async (generation) => {
    assertCurrentWrite(key, generation);
    await withNamedTinySurpriseStores(
      [CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
      "readwrite",
      (stores, _transaction, _resolve, abort) => {
        const request = stores[CREATION_DRAFTS_STORE].get(key);
        request.onsuccess = () => {
          if (guard && (guard.sessionId !== request.result?.sessionId || guard.revision !== revisionOf(request.result))) {
            abort(new DraftConflictError()); return;
          }
          stores[CREATION_DRAFTS_STORE].delete(key);
          deleteDraftMediaRecords(stores[LOCAL_MEDIA_STORE], [key]);
        };
      },
    );
  });
}

export interface CreationDeletionGuard { status: CreationStatus; revision: number; updatedAt: number; title: string; editSessionRevision?: number; editSessionId?: string }
export interface DraftDeletionGuard extends CreationDeletionGuard { status: "draft" }
export class DraftDeletionConflictError extends Error {
  constructor() { super("This surprise changed after selection. Review it again before deleting; it was kept."); }
}

export async function getCreationDeletionGuard(id: string): Promise<CreationDeletionGuard> {
  return withNamedTinySurpriseStores<CreationDeletionGuard>(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE], "readonly",
    (stores, _transaction, resolve, abort) => {
      const record = stores[CREATIONS_STORE].get(id);
      const draft = stores[CREATION_DRAFTS_STORE].get(id);
      const session = stores[CREATION_DRAFTS_STORE].get(editSessionKey(id));
      session.onsuccess = () => {
        if (!isCreationRecord(record.result) || !draft.result) { abort(new DraftDeletionConflictError()); return; }
        resolve({ status: record.result.status, revision: revisionOf(draft.result),
          updatedAt: record.result.updatedAt, title: record.result.title,
          editSessionRevision: session.result ? revisionOf(session.result) : undefined,
          editSessionId: session.result?.sessionId });
      };
    },
  );
}

/** Read metadata only; do not hydrate media just to prepare a deletion. */
export async function getDraftDeletionGuard(id: string): Promise<DraftDeletionGuard> {
  return withNamedTinySurpriseStores<DraftDeletionGuard>(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE], "readonly",
    (stores, _transaction, resolve, abort) => {
      const record = stores[CREATIONS_STORE].get(id);
      const draft = stores[CREATION_DRAFTS_STORE].get(id);
      draft.onsuccess = () => {
        if (!isCreationRecord(record.result) || record.result.status !== "draft" || !draft.result) {
          abort(new DraftDeletionConflictError()); return;
        }
        resolve({ status: "draft", revision: revisionOf(draft.result), updatedAt: record.result.updatedAt, title: record.result.title });
      };
    },
  );
}

export async function deleteCreation(id: string, expected?: CreationDeletionGuard): Promise<void> {
  if (isReservedId(id)) return;
  if (!expected) {
    invalidateWrites(id);
    invalidateWrites(editSessionKey(id));
  }
  await queueOrderedWrite(id, async (generation) => {
    assertCurrentWrite(id, generation);
    await withNamedTinySurpriseStores(
      [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
      "readwrite",
      (stores, _transaction, _resolve, abort) => {
        const remove = () => {
          if (expected) {
            invalidateWrites(id);
            invalidateWrites(editSessionKey(id));
          }
          stores[CREATIONS_STORE].delete(id);
          stores[CREATION_DRAFTS_STORE].delete(id);
          stores[CREATION_DRAFTS_STORE].delete(editSessionKey(id));
          deleteDraftMediaRecords(stores[LOCAL_MEDIA_STORE], [id, editSessionKey(id)]);
        };
        if (!expected) { remove(); return; }
        const record = stores[CREATIONS_STORE].get(id);
        const draft = stores[CREATION_DRAFTS_STORE].get(id);
        const session = stores[CREATION_DRAFTS_STORE].get(editSessionKey(id));
        session.onsuccess = () => {
          if (!isCreationRecord(record.result) || record.result.status !== expected.status ||
              (session.result ? revisionOf(session.result) : undefined) !== expected.editSessionRevision || session.result?.sessionId !== expected.editSessionId ||
              !draft.result || revisionOf(draft.result) !== expected.revision || record.result.updatedAt !== expected.updatedAt || record.result.title !== expected.title) {
            abort(new DraftDeletionConflictError()); return;
          }
          remove();
        };
      },
    );
  });
  // The edit-session key has its own queue because autosave and final
  // Save/Discard intentionally never target the finalized creation key.
  await queueOrderedWrite(editSessionKey(id), async (generation) => {
    assertCurrentWrite(editSessionKey(id), generation);
    await withNamedTinySurpriseStore(
      LOCAL_MEDIA_STORE,
      "readwrite",
      (store) => {
        deleteDraftMediaRecords(store, [editSessionKey(id)]);
        return store.get(editSessionKey(id));
      },
    );
  });
}

/**
 * Destructively clears every app-owned surprise record, including the legacy
 * one-draft-per-template store that migration intentionally retains for
 * recovery. The write epoch and queue invalidation prevent an already queued
 * autosave/edit-session write from recreating data after this transaction.
 * Profile, theme, haptics, and first-run preferences live outside these
 * content stores and are intentionally preserved by the Settings contract.
 */
export async function clearAllLocalSurpriseData(): Promise<void> {
  if (typeof indexedDB === "undefined") return;

  destructiveClearInProgress = true;
  writeEpoch += 1;
  const pendingWrites = Array.from(creationWriteStates.entries());
  pendingWrites.forEach(([key]) => invalidateWrites(key));

  try {
    await Promise.all(
      pendingWrites.map(([, state]) => state.queue.catch(() => undefined)),
    );
    await withNamedTinySurpriseStores(
      [
        LEGACY_DRAFTS_STORE,
        CREATIONS_STORE,
        CREATION_DRAFTS_STORE,
        LOCAL_MEDIA_STORE,
        RECIPIENTS_STORE,
      ],
      "readwrite",
      (stores) => {
        stores[LEGACY_DRAFTS_STORE].clear();
        stores[CREATIONS_STORE].clear();
        stores[CREATION_DRAFTS_STORE].clear();
        stores[LOCAL_MEDIA_STORE].clear();
        stores[RECIPIENTS_STORE].clear();
      },
    );
  } finally {
    destructiveClearInProgress = false;
  }
}

export async function renameCreation(
  id: string,
  title: string,
): Promise<void> {
  const trimmed = title.trim();
  if (!trimmed) return;
  await updateCreation(id, (existing) => ({
    ...existing,
    title: trimmed,
    updatedAt: Date.now(),
  }));
}

export async function setCreationStatus(id: string, status: CreationStatus): Promise<void> {
  let validatedRevision: number | undefined;
  if (status === "completed") {
    const snapshot = await loadCreationDraft(id);
    if (!snapshot) throw new Error("This draft could not be restored safely. Open My Surprises for recovery options.");
    try {
      const finalized = assertFinalizedCreationData(snapshot.data, "compatibility");
      const mediaError = await getImportedDataValidationError(normalizePhotoPuzzlePackageData(finalized));
      if (mediaError) throw new Error(mediaError);
      validatedRevision = revisionOf(snapshot);
    } finally { disposeDraftMedia(snapshot.data); }
  }
  await withNamedTinySurpriseStores([CREATIONS_STORE, CREATION_DRAFTS_STORE], "readwrite",
    (stores, _transaction, _resolve, abort) => {
      const request = stores[CREATIONS_STORE].get(id);
      request.onsuccess = () => {
        const record = request.result;
        if (!isCreationRecord(record) || record.id !== id) { abort(new Error("This saved item is no longer available. Reopen My Surprises.")); return; }
        if (record.status === "imported" || status === "imported") {
          abort(new Error("Received surprises cannot change ownership.")); return;
        }
        const draftRequest = stores[CREATION_DRAFTS_STORE].get(id);
        draftRequest.onsuccess = () => {
          try {
            if (!isStoredCreationDraft(draftRequest.result, record.templateId)) throw new Error("This draft could not be restored safely.");
            if (status === "completed" && revisionOf(draftRequest.result) !== validatedRevision) throw new DraftConflictError();
            stores[CREATIONS_STORE].put({ ...record, status, updatedAt: Date.now() }, id);
          } catch (error) { abort(error instanceof Error ? error : new Error("Complete the required fields first.")); }
        };
      };
    });
}

/** Explicit recovery never changes a Received record or drops existing content. */
export async function recoverCreationAsDraft(id: string): Promise<void> {
  await setCreationStatus(id, "draft");
}

async function touch(
  id: string,
  field: "lastOpenedAt" | "lastExportedAt" | "lastBackedUpAt",
): Promise<void> {
  await updateCreation(id, (existing) => ({ ...existing, [field]: Date.now() }));
}

export const touchLastOpened = (id: string) => touch(id, "lastOpenedAt");
export const touchLastExported = (id: string) => touch(id, "lastExportedAt");
export const touchLastBackedUp = (id: string) => touch(id, "lastBackedUpAt");

/** Records that a backup/export with this exact content just succeeded, for future duplicate detection. */
export async function recordBackupHash(
  id: string,
  contentHash: string,
  hashVersion?: number,
  packageVersion?: number,
): Promise<void> {
  await updateCreation(id, (existing) => ({
    ...existing,
    contentHash,
    hashVersion,
    packageVersion,
    lastBackedUpAt: Date.now(),
  }));
}

/**
 * Runs the shared classifier (lib/duplicate-classifier.ts) against every
 * saved creation. Every backup/import screen goes through this one function
 * rather than comparing hashes itself.
 */
export async function classifyAgainstLibrary(
  contentHash: string | undefined,
  candidateId?: string,
  candidateDomain: "created" | "incoming-package" = "created",
): Promise<import("./duplicate-classifier").DuplicateClassification> {
  const existing = (await listCreations()).filter(record => !record.recovery);
  return classifyDuplicate({ contentHash, candidateId, candidateDomain, existing });
}

/**
 * Finds an existing creation (any status/origin) whose last recorded backup
 * has this exact content fingerprint. Used before creating a new backup so
 * we don't silently pile up identical files, and before saving an import so
 * an already-saved surprise isn't duplicated. Delegates to
 * classifyDuplicate — kept as a narrow helper for callers that only need a
 * yes/no answer, not the full duplicate state.
 */
export async function findDuplicateByContentHash(
  contentHash: string,
  excludeId?: string,
): Promise<CreationRecord | undefined> {
  const existing = (await listCreations()).filter(record => !record.recovery);
  const result = classifyDuplicate({
    contentHash,
    existing: excludeId
      ? existing.filter((creation) => creation.id !== excludeId)
      : existing,
  });
  return result.state === "EXACT_DUPLICATE" ||
    result.state === "SAME_CONTENT_DIFFERENT_ID"
    ? result.matchByContent
    : undefined;
}

export type ImportConflictKind =
  | "none"
  | "duplicate"
  | "changed"
  | "created-collision";

export interface ImportConflict {
  receivedMatches?: CreationRecord[];
  kind: ImportConflictKind;
  /** The full classification — prefer this over `kind` for new UI. */
  state: DuplicateState;
  /** The already-saved creation involved — the exact duplicate, or (for "changed") the one sharing the package's sourceCreationId. */
  existing?: CreationRecord;
}

/**
 * Decides whether an incoming .tinysurprise package is a brand-new item, an
 * exact duplicate of something already saved, or a changed version of a
 * creation that produced an earlier backup of this same package (matched by
 * the manifest's sourceCreationId, since packages have no id of their own).
 * `kind` is kept for existing callers that only distinguish the broad
 * conflict families; `state` exposes the full classification.
 */
export async function resolveImportConflict(
  contentHash: string,
  sourceCreationId?: string,
): Promise<ImportConflict> {
  const result = await classifyAgainstLibrary(
    contentHash,
    sourceCreationId,
    "incoming-package",
  );
  const existing =
    result.state === "CREATED_ID_COLLISION"
      ? result.matchByReceivedId || result.matchByCreatedId
      : result.state === "CREATED_CONTENT_COLLISION"
        ? result.matchByReceivedContent || result.matchByCreatedContent
        : result.matchById || result.matchByContent;
  const kind: ImportConflictKind =
    result.state === "NEW" || result.state === "INVALID_OR_UNVERIFIABLE"
      ? "none"
      : result.state === "CREATED_ID_COLLISION" ||
          result.state === "CREATED_CONTENT_COLLISION"
        ? "created-collision"
      : result.state === "SAME_ID_CHANGED_CONTENT" || result.state === "MULTIPLE_RECEIVED_MATCHES"
        ? "changed"
        : "duplicate";
  return { kind, state: result.state, existing, receivedMatches: result.receivedMatches };
}

type NativeImportAction = "received" | "backup" | "edit" | "replace";

function nativeReceiptPrefix(artifactId: string): string {
  if (!artifactId || artifactId.length > 128) throw new Error("This received file has an invalid identity. Choose it again.");
  return `${NATIVE_IMPORT_RECEIPT_PREFIX}${encodeURIComponent(artifactId)}:`;
}

/** The retry receipt and its result are committed in the same transaction. */
function withNativeImportResult(
  stores: Record<string, IDBObjectStore>, artifactId: string | undefined, action: NativeImportAction,
  resolve: (record: CreationRecord) => void, abort: (error: Error) => void,
  write: (finish: (record: CreationRecord) => void) => void,
): void {
  const key = artifactId ? nativeReceiptPrefix(artifactId) + action : undefined;
  const finish = (record: CreationRecord) => {
    if (key) stores[CREATIONS_STORE].put({ kind: "native-import-result", recordId: record.id }, key);
    resolve(record);
  };
  const begin = () => {
    try { write(finish); }
    catch (error) { abort(error instanceof Error ? error : new Error("This surprise could not be saved.")); }
  };
  if (!key) { begin(); return; }
  const receipt = stores[CREATIONS_STORE].get(key);
  receipt.onsuccess = () => {
    if (receipt.result === undefined) { begin(); return; }
    if (receipt.result?.kind !== "native-import-result" || typeof receipt.result.recordId !== "string") {
      abort(new NativeImportRecoveryError("The saved import details could not be read. Open My Surprises before retrying.")); return;
    }
    const saved = stores[CREATIONS_STORE].get(receipt.result.recordId);
    saved.onsuccess = () => {
      const record = saved.result;
      if (!isCreationRecord(record) || isReservedId(record.id)) {
        abort(new NativeImportRecoveryError("This file was already saved, but that item is no longer available. Open My Surprises before retrying.")); return;
      }
      const draft = stores[CREATION_DRAFTS_STORE].get(record.id);
      draft.onsuccess = () => {
        if (!isStoredCreationDraft(draft.result, record.templateId)) {
          abort(new NativeImportRecoveryError("This file was already saved, but its item needs recovery. Open My Surprises before retrying.")); return;
        }
        resolve({ ...record, reusedImport: true });
      };
    };
  };
}

/** Called only after the native owner has acknowledged its artifact. */
export async function forgetNativeImportResults(artifactId: string): Promise<void> {
  const prefix = nativeReceiptPrefix(artifactId);
  await withNamedTinySurpriseStores([CREATIONS_STORE], "readwrite", stores => {
    const cursor = stores[CREATIONS_STORE].openCursor(IDBKeyRange.bound(prefix, prefix + "\uffff"));
    cursor.onsuccess = () => { if (cursor.result) { cursor.result.delete(); cursor.result.continue(); } };
  });
}

/** Overwrites Received content only after explicit, version-guarded confirmation. */
export async function replaceCreationContent(
  id: string,
  data: SurpriseData,
  contentHash: string,
  hashVersion?: number,
  packageVersion?: number,
  accessMode?: PackageAccessMode,
  importSourceCreationId?: string,
  options?: { expected: ReceivedVersionGuard; nativeImportId?: string },
): Promise<CreationRecord | undefined> {
  const existing = await getCreation(id);
  if (!existing) return undefined;
  if (existing.status !== "imported")
    throw new Error("Only a Received surprise can be replaced.");
  const expected = options?.expected || existing;
  const canonicalData = normalizeImportedPackageData(data);
  await assertImportedPackagePlayable(canonicalData);
  if (!isSurpriseDataRecord(canonicalData as unknown, existing.templateId))
    throw new Error("This imported surprise contains invalid data.");
  const limitError = canonicalData.template !== "wish-upon-a-star"
    ? getCollectionLimitErrors(canonicalData.template, canonicalData.content)[0]
    : undefined;
  if (canonicalData.template !== existing.templateId || limitError) {
    throw new Error(
      limitError?.message || "This imported surprise contains invalid data.",
    );
  }
  return withNamedTinySurpriseStores<CreationRecord | undefined>(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
    "readwrite",
    (stores, _transaction, resolve, abort) => {
      withNativeImportResult(stores, options?.nativeImportId, "replace", resolve, abort, finish => {
      const request = stores[CREATIONS_STORE].get(id);
      request.onsuccess = () => {
        const current = request.result;
        if (
          !isCreationRecord(current) ||
          current.status !== "imported" ||
          current.templateId !== existing.templateId
        ) {
          abort(new ReceivedConflictError());
          return;
        }
        if (current.updatedAt !== expected.updatedAt || current.contentHash !== expected.contentHash || current.templateId !== expected.templateId) {
          abort(new ReceivedConflictError()); return;
        }
        const updated: CreationRecord = {
          ...current,
          status: "imported",
          contentHash,
          hashVersion,
          packageVersion,
          accessMode,
          importSourceCreationId,
          originalSenderName: canonicalData.basics.senderName,
          importedAt: current.importedAt ?? Date.now(),
          updatedAt: Math.max(Date.now(), current.updatedAt + 1),
        };
        stores[CREATION_DRAFTS_STORE].put(
          { data: cloneDraftDataForPersistence(canonicalData), step: 1 },
          id,
        );
        persistDraftMediaRecords(stores[LOCAL_MEDIA_STORE], id, canonicalData);
        stores[CREATIONS_STORE].put(updated, id);
        finish(updated);
      };
      });
    },
  );
}

export async function duplicateCreation(
  id: string,
): Promise<CreationRecord | undefined> {
  const existing = await getCreation(id);
  const draft = await loadCreationDraft(id);
  if (!draft) return undefined;
  try {
    if (!existing) return undefined;
    const newId = createStableId("creation");
    const now = Date.now();
    const record: CreationRecord = {
      ...existing,
      id: newId,
      title: `${existing.title} (copy)`,
      status: existing.status === "completed" ? "draft" : existing.status,
      createdAt: now,
      updatedAt: now,
      lastOpenedAt: undefined,
      lastExportedAt: undefined,
      lastBackedUpAt: undefined,
    };
    // Keep the draft lightweight while copying the hydrated media into the new
    // owner-scoped store records below.
    const clonedData = cloneDraftDataForPersistence(draft.data);
    await withNamedTinySurpriseStores(
      [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
      "readwrite",
      (stores) => {
        stores[CREATIONS_STORE].put(record, newId);
        stores[CREATION_DRAFTS_STORE].put(
          { data: clonedData, step: draft.step },
          newId,
        );
        persistDraftMediaRecords(stores[LOCAL_MEDIA_STORE], newId, draft.data);
      },
    );
    return record;
  } finally { disposeDraftMedia(draft.data); }
}

/** Rechecks import decisions atomically; explicit copies never overwrite an existing item. */
export async function importCreationFromPackage(
  data: SurpriseData,
  suggestedTitle?: string,
  contentHash?: string,
  hashVersion?: number,
  packageVersion?: number,
  accessMode?: PackageAccessMode,
  importSourceCreationId?: string,
  options?: { nativeImportId?: string; allowDuplicate?: boolean },
): Promise<CreationRecord> {
  const canonicalData = normalizeImportedPackageData(data);
  await assertImportedPackagePlayable(canonicalData);
  const id = createStableId("creation");
  const now = Date.now();
  const record: CreationRecord = {
    id,
    title:
      canonicalData.basics?.recipientName?.trim() ||
      suggestedTitle?.replace(/\.tinysurprise$/i, "").trim() ||
      `Imported ${templateLabel(canonicalData.template)}`,
    templateId: canonicalData.template,
    status: "imported",
    createdAt: now,
    updatedAt: now,
    contentHash,
    hashVersion,
    packageVersion,
    importedAt: now,
    accessMode,
    importSourceCreationId,
    originalSenderName: canonicalData.basics.senderName,
  };
  return withNamedTinySurpriseStores<CreationRecord>(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
    "readwrite",
    (stores, _transaction, resolve, abort) => {
      withNativeImportResult(stores, options?.nativeImportId, "received", resolve, abort, finish => {
        const insert = () => {
          stores[CREATIONS_STORE].put(record, id);
          stores[CREATION_DRAFTS_STORE].put({ data: cloneDraftDataForPersistence(canonicalData), step: 1, revision: 0 }, id);
          persistDraftMediaRecords(stores[LOCAL_MEDIA_STORE], id, canonicalData);
          finish(record);
        };
        if (options?.allowDuplicate || !contentHash) { insert(); return; }
        readLibrarySnapshot(stores, existing => {
          const classification = classifyDuplicate({ contentHash, candidateId: importSourceCreationId, candidateDomain: "incoming-package", existing: existing.filter(item => !item.recovery) });
          if (classification.state === "SAME_ID_CHANGED_CONTENT" || classification.state === "MULTIPLE_RECEIVED_MATCHES") {
            abort(new ReceivedConflictError()); return;
          }
          const duplicate = classification.matchByReceivedContent ||
            (classification.matchByContent?.status === "imported" ? classification.matchByContent : undefined);
          if (duplicate) { finish({ ...duplicate, reusedImport: true }); return; }
          insert();
        });
      });
    },
  );
}

/**
 * "Save and edit" (Section V) — creates a brand-new local draft from an
 * editable Received item, without ever touching the received original.
 * Always a new creation id, never derived.status carried over as
 * "imported"; the derived draft is an ordinary editable "draft" that
 * happens to remember where it came from.
 */
export async function createEditableDraftFromReceived(
  received: CreationRecord,
  data: SurpriseData,
  nativeImportId?: string,
): Promise<CreationRecord> {
  // Permission/version checks belong to the write below: a previously committed
  // native retry must still find its own draft if the Received original changed.
  const id = createStableId("creation");
  const now = Date.now();
  const canonicalData = cloneCreationData(assertStructurallyValidCreationData(data, received.templateId));
  await assertMediaIdentityConsistency(canonicalData);
  const record: CreationRecord = {
    id,
    title: received.title,
    templateId: received.templateId,
    status: "draft",
    createdAt: now,
    updatedAt: now,
    derivedFromCreationId: received.id,
    source: "received-editable",
    originalSenderName: data.basics?.senderName,
  };
  // structuredClone so the derived draft's media/File references don't
  // alias the received record's own draft data.
  return withNamedTinySurpriseStores<CreationRecord>(
    [CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE],
    "readwrite",
    (stores, _transaction, resolve, abort) => {
      withNativeImportResult(stores, nativeImportId, "edit", resolve, abort, finish => {
        const source = stores[CREATIONS_STORE].get(received.id);
        source.onsuccess = () => {
          const current = source.result;
          if (!isCreationRecord(current) || current.status !== "imported" || current.accessMode === "view-only" || current.updatedAt !== received.updatedAt || current.contentHash !== received.contentHash || current.templateId !== received.templateId) {
            abort(new ReceivedConflictError()); return;
          }
          stores[CREATIONS_STORE].put(record, id);
          stores[CREATION_DRAFTS_STORE].put({ data: cloneDraftDataForPersistence(canonicalData), step: 1, revision: 0 }, id);
          persistDraftMediaRecords(stores[LOCAL_MEDIA_STORE], id, canonicalData);
          finish(record);
        };
      });
    },
  );
}

export type CreationSortKey = "updated" | "oldest" | "title" | "template";

export function sortCreations(
  creations: CreationRecord[],
  sortKey: CreationSortKey,
): CreationRecord[] {
  const copy = [...creations];
  if (sortKey === "title")
    return copy.sort((a, b) => a.title.localeCompare(b.title));
  if (sortKey === "template")
    return copy.sort((a, b) =>
      templateLabel(a.templateId).localeCompare(templateLabel(b.templateId)),
    );
  if (sortKey === "oldest")
    return copy.sort((a, b) => a.updatedAt - b.updatedAt);
  return copy.sort((a, b) => b.updatedAt - a.updatedAt);
}

export function searchCreations(
  creations: CreationRecord[],
  query: string,
): CreationRecord[] {
  const q = query.trim().toLowerCase();
  if (!q) return creations;
  return creations.filter(
    (creation) =>
      creation.title.toLowerCase().includes(q) ||
      templateLabel(creation.templateId).toLowerCase().includes(q),
  );
}

/** Restore working backups atomically as new drafts; never target an existing identity. */
export async function restoreDraftBackup(data: SurpriseData, step: number, nativeImportId?: string): Promise<CreationRecord> {
  const canonical = cloneCreationData(assertStructurallyValidCreationData(data, data.template));
  await assertMediaIdentityConsistency(canonical);
  const id = createStableId("creation");
  const now = Date.now();
  const record: CreationRecord = { id, title: canonical.basics.recipientName?.trim() || "Restored draft", templateId: canonical.template, status: "draft", createdAt: now, updatedAt: now };
  return withNamedTinySurpriseStores<CreationRecord>([CREATIONS_STORE, CREATION_DRAFTS_STORE, LOCAL_MEDIA_STORE], "readwrite", (stores, _transaction, resolve, abort) => {
    withNativeImportResult(stores, nativeImportId, "backup", resolve, abort, finish => {
      stores[CREATIONS_STORE].put(record, id);
      stores[CREATION_DRAFTS_STORE].put({ data: cloneDraftDataForPersistence(canonical), step: Math.min(6, Math.max(1, step)), revision: 0 }, id);
      persistDraftMediaRecords(stores[LOCAL_MEDIA_STORE], id, canonical);
      finish(record);
    });
  });
}
