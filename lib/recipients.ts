import { createStableId } from "./local-media";
import { TEXT_LIMITS } from "./text-limits";
import { RECIPIENTS_STORE, withNamedTinySurpriseStore } from "./builder-draft";

export interface RecipientRecord {
  id: string;
  displayName: string;
  nickname?: string;
  relationship?: string;
  lastUsedAt: string;
  useCount: number;
  createdAt: string;
  updatedAt: string;
}

/** Same normalization used everywhere else names are compared (recipient-preview.tsx's passphrase matching, content-hash.ts) — trim, lowercase, collapse whitespace. */
export const normalizeRecipientName = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");

export async function listRecipients(): Promise<RecipientRecord[]> {
  if (typeof indexedDB === "undefined") return [];
  const all = await withNamedTinySurpriseStore<RecipientRecord[]>(
    RECIPIENTS_STORE,
    "readonly",
    (store) => store.getAll(),
  );
  return all.sort((a, b) => b.lastUsedAt.localeCompare(a.lastUsedAt));
}

/** Recipients used at least once, most-recent first — for the picker's "Recent" row. */
export async function listRecentRecipients(limit = 6): Promise<RecipientRecord[]> {
  const all = await listRecipients();
  return all.slice(0, limit);
}

export async function findRecipientByName(
  displayName: string,
): Promise<RecipientRecord | undefined> {
  const target = normalizeRecipientName(displayName);
  if (!target) return undefined;
  const all = await listRecipients();
  return all.find((recipient) => normalizeRecipientName(recipient.displayName) === target);
}

/**
 * Creates a new saved recipient, or — if a recipient with the same
 * normalized name already exists — reuses it instead of creating a
 * duplicate (Section F: "Avoid duplicate recipients with normalized
 * matching"). Always bumps lastUsedAt/useCount, since this is called both
 * when explicitly saving a new recipient and when reusing one from Step 1.
 */
export async function touchRecipient(input: {
  displayName: string;
  nickname?: string;
  relationship?: string;
}): Promise<RecipientRecord> {
  validateRecipientFields(input);
  const displayName = input.displayName.trim();
  const now = new Date().toISOString();
  const existing = await findRecipientByName(displayName);
  const record: RecipientRecord = existing
    ? {
        ...existing,
        nickname: input.nickname?.trim() || existing.nickname,
        relationship: input.relationship?.trim() || existing.relationship,
        lastUsedAt: now,
        useCount: existing.useCount + 1,
        updatedAt: now,
      }
    : {
        id: createStableId("recipient"),
        displayName,
        nickname: input.nickname?.trim() || undefined,
        relationship: input.relationship?.trim() || undefined,
        lastUsedAt: now,
        useCount: 1,
        createdAt: now,
        updatedAt: now,
      };
  await withNamedTinySurpriseStore(RECIPIENTS_STORE, "readwrite", (store) =>
    store.put(record, record.id),
  );
  return record;
}

/** Records lastUsedAt/useCount for a recipient already selected from the picker, without changing their saved details. */
export async function markRecipientUsed(id: string): Promise<void> {
  const existing = await withNamedTinySurpriseStore<RecipientRecord | undefined>(
    RECIPIENTS_STORE,
    "readonly",
    (store) => store.get(id),
  );
  if (!existing) return;
  await withNamedTinySurpriseStore(RECIPIENTS_STORE, "readwrite", (store) =>
    store.put(
      {
        ...existing,
        lastUsedAt: new Date().toISOString(),
        useCount: existing.useCount + 1,
      },
      id,
    ),
  );
}

export async function updateRecipient(
  id: string,
  fields: Partial<Pick<RecipientRecord, "displayName" | "nickname" | "relationship">>,
): Promise<void> {
  validateRecipientFields(fields);
  const existing = await withNamedTinySurpriseStore<RecipientRecord | undefined>(
    RECIPIENTS_STORE,
    "readonly",
    (store) => store.get(id),
  );
  if (!existing) return;
  await withNamedTinySurpriseStore(RECIPIENTS_STORE, "readwrite", (store) =>
    store.put(
      { ...existing, ...fields, updatedAt: new Date().toISOString() },
      id,
    ),
  );
}

function validateRecipientFields(fields: { displayName?: string; nickname?: string; relationship?: string }) {
  if ((fields.displayName?.length || 0) > TEXT_LIMITS.name ||
      (fields.nickname?.length || 0) > TEXT_LIMITS.recipientDetail ||
      (fields.relationship?.length || 0) > TEXT_LIMITS.recipientDetail) {
    throw new Error("Use at most 60 character units for a name and 40 for a nickname or relationship. Your entered text is kept.");
  }
}

/**
 * Removing a saved recipient only deletes the picker entry — surprises
 * already made with them keep their own name snapshot (SurpriseIdentity)
 * and are completely unaffected (Section F: "Removing a saved recipient
 * must not delete existing surprises").
 */
export async function deleteRecipient(id: string): Promise<void> {
  await withNamedTinySurpriseStore(RECIPIENTS_STORE, "readwrite", (store) =>
    store.delete(id),
  );
}

export async function clearRecipients(): Promise<void> {
  await withNamedTinySurpriseStore(RECIPIENTS_STORE, "readwrite", (store) =>
    store.clear(),
  );
}
