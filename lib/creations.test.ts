import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  createCreation,
  deleteCreation,
  duplicateCreation,
  findDuplicateByContentHash,
  getCreation,
  importCreationFromPackage,
  listCreations,
  loadCreationDraft,
  recordBackupHash,
  renameCreation,
  replaceCreationContent,
  resolveImportConflict,
  saveCreationDraft,
  searchCreations,
  setCreationStatus,
  sortCreations,
  touchLastBackedUp,
  touchLastExported,
  touchLastOpened,
} from "./creations";
import { saveBuilderDraft } from "./builder-draft";
import type { SurpriseData } from "./types";

// Each test gets a clean fake IndexedDB so migration/idempotency behavior
// is deterministic and never depends on run order.
beforeEach(() => {
  indexedDB = new IDBFactory();
});
afterEach(() => {
  indexedDB = new IDBFactory();
});

describe("My Surprises library", () => {
  it("creates a creation with sensible defaults and loads its initial draft", async () => {
    const record = await createCreation("catch-the-heart");
    expect(record.status).toBe("draft");
    expect(record.templateId).toBe("catch-the-heart");
    expect(record.title).toContain("Catch the Heart");

    const draft = await loadCreationDraft(record.id);
    expect(draft?.step).toBe(1);
    expect(draft?.data.template).toBe("catch-the-heart");
  });

  it("keeps two creations of the same template independent", async () => {
    const a = await createCreation("catch-the-heart", "For Sam");
    const b = await createCreation("catch-the-heart", "For Alex");
    await saveCreationDraft(
      a.id,
      { ...(await loadCreationDraft(a.id))!.data, basics: { senderName: "", recipientName: "Sam", openingMessage: "" } },
      2,
      { revision: 0 },
    );
    const draftA = await loadCreationDraft(a.id);
    const draftB = await loadCreationDraft(b.id);
    expect(draftA?.data.basics.recipientName).toBe("Sam");
    expect(draftB?.data.basics.recipientName).toBe("");
    expect(draftA?.step).toBe(2);
    expect(draftB?.step).toBe(1);
  });

  it("lists creations newest-updated first and supports search/sort", async () => {
    const first = await createCreation("catch-the-heart", "Alpha");
    await new Promise((resolve) => setTimeout(resolve, 2));
    const second = await createCreation("photo-puzzle", "Beta");
    const all = await listCreations();
    expect(all[0].id).toBe(second.id);
    expect(all[1].id).toBe(first.id);

    const found = searchCreations(all, "alpha");
    expect(found).toHaveLength(1);
    expect(found[0].id).toBe(first.id);

    const byTitle = sortCreations(all, "title");
    expect(byTitle[0].title).toBe("Alpha");
  });

  it("renames, marks completed, and touches timestamps without crashing on unknown ids", async () => {
    const record = await createCreation("catch-the-heart");
    const draft = (await loadCreationDraft(record.id))!;
    await saveCreationDraft(record.id, { ...draft.data,
      basics: { senderName: "Me", recipientName: "You", openingMessage: "Hello" },
      content: { hearts: [{ id: "h1", message: "A memory" }], finalMessage: "Always", soundEffects: false },
    }, 6, { revision: draft.revision ?? 0 });
    await renameCreation(record.id, "Our Anniversary");
    await setCreationStatus(record.id, "completed");
    await touchLastOpened(record.id);
    await touchLastExported(record.id);
    await touchLastBackedUp(record.id);
    const updated = await getCreation(record.id);
    expect(updated?.title).toBe("Our Anniversary");
    expect(updated?.status).toBe("completed");
    expect(updated?.lastOpenedAt).toBeTypeOf("number");
    expect(updated?.lastExportedAt).toBeTypeOf("number");
    expect(updated?.lastBackedUpAt).toBeTypeOf("number");

    // Unknown id: every mutator should be a safe no-op, not a throw.
    await expect(renameCreation("missing", "x")).resolves.toBeUndefined();
    await expect(setCreationStatus("missing", "draft")).resolves.toBeUndefined();
    await expect(touchLastOpened("missing")).resolves.toBeUndefined();
  });

  it("duplicates a creation with independent media and resets its lifecycle timestamps", async () => {
    const original = await createCreation("catch-the-heart", "Original");
    await touchLastExported(original.id);
    const copy = await duplicateCreation(original.id);
    expect(copy?.title).toBe("Original (copy)");
    expect(copy?.lastExportedAt).toBeUndefined();
    expect(copy?.id).not.toBe(original.id);
  });

  it("deletes a creation and its draft together", async () => {
    const record = await createCreation("catch-the-heart");
    await deleteCreation(record.id);
    expect(await getCreation(record.id)).toBeUndefined();
    expect(await loadCreationDraft(record.id)).toBeUndefined();
  });

  it("imports a package as a brand-new creation, never overwriting an existing one", async () => {
    const existing = await createCreation("catch-the-heart", "Existing");
    const imported: SurpriseData = {
      template: "catch-the-heart",
      basics: { senderName: "Me", recipientName: "Imported Person", openingMessage: "" },
      content: {
        hearts: [{ id: "heart-imported", message: "A real memory" }],
        finalMessage: "Always",
        soundEffects: false,
      },
      appearance: { theme: "soft-rose", animationIntensity: "normal" },
      delivery: { expiration: "none" },
    };
    const record = await importCreationFromPackage(imported);
    expect(record.status).toBe("imported");
    expect(record.id).not.toBe(existing.id);
    const all = await listCreations();
    expect(all.some((c) => c.id === existing.id)).toBe(true);
    expect(all.some((c) => c.id === record.id)).toBe(true);
  });

  it("rejects saving a draft under a reserved/invalid id", async () => {
    await expect(
      saveCreationDraft("__migration_v2_complete__", {} as SurpriseData, 1, { revision: 0 }),
    ).rejects.toThrow();
  });

  it("migrates a legacy per-template draft into the library exactly once", async () => {
    const legacy: SurpriseData = {
      template: "photo-puzzle",
      basics: { senderName: "Me", recipientName: "Legacy", openingMessage: "" },
      content: { difficulty: "easy", completionMessage: "", finalMessage: "" },
      appearance: { theme: "soft-rose", animationIntensity: "normal" },
      delivery: { expiration: "none" },
    };
    await saveBuilderDraft("photo-puzzle", legacy, 3);

    const firstList = await listCreations();
    expect(firstList).toHaveLength(1);
    expect(firstList[0].templateId).toBe("photo-puzzle");
    expect(firstList[0].title).toContain("Photo Puzzle");

    // Calling listCreations again must not duplicate the migrated entry.
    const secondList = await listCreations();
    expect(secondList).toHaveLength(1);
    expect(secondList[0].id).toBe(firstList[0].id);
  });

  it("finds a duplicate by content hash, excluding the creation itself", async () => {
    const a = await createCreation("catch-the-heart", "A");
    const b = await createCreation("catch-the-heart", "B");
    await recordBackupHash(a.id, "hash-1");
    expect((await findDuplicateByContentHash("hash-1"))?.id).toBe(a.id);
    expect(await findDuplicateByContentHash("hash-1", a.id)).toBeUndefined();
    await recordBackupHash(b.id, "hash-1");
    const dup = await findDuplicateByContentHash("hash-1", b.id);
    expect(dup?.id).toBe(a.id);
    expect(await findDuplicateByContentHash("hash-1", a.id)).toMatchObject({ id: b.id });
    expect(await findDuplicateByContentHash("no-match")).toBeUndefined();
  });

  it("resolves import conflicts: none and creator-domain collisions", async () => {
    const none = await resolveImportConflict("fresh-hash");
    expect(none.kind).toBe("none");

    const existing = await createCreation("catch-the-heart", "Existing");
    await recordBackupHash(existing.id, "matching-hash");
    const duplicate = await resolveImportConflict("matching-hash");
    expect(duplicate.kind).toBe("created-collision");
    expect(duplicate.state).toBe("CREATED_CONTENT_COLLISION");
    expect(duplicate.existing?.id).toBe(existing.id);

    const idCollision = await resolveImportConflict("different-hash", existing.id);
    expect(idCollision.kind).toBe("created-collision");
    expect(idCollision.state).toBe("CREATED_ID_COLLISION");
    expect(idCollision.existing?.id).toBe(existing.id);
  });

  it("replaces an existing creation's content only when explicitly requested", async () => {
    const replacementData: SurpriseData = {
      template: "catch-the-heart",
      basics: { senderName: "Me", recipientName: "Updated", openingMessage: "" },
      content: {
        hearts: [{ id: "heart-replacement", message: "An updated memory" }],
        finalMessage: "Still always",
        soundEffects: false,
      },
      appearance: { theme: "soft-rose", animationIntensity: "normal" },
      delivery: { expiration: "none" },
    };
    const record = await importCreationFromPackage(replacementData, "Original");
    const updated = await replaceCreationContent(record.id, replacementData, "new-hash");
    expect(updated?.contentHash).toBe("new-hash");
    const draft = await loadCreationDraft(record.id);
    expect(draft?.data.basics.recipientName).toBe("Updated");

    expect(await replaceCreationContent("missing", replacementData, "x")).toBeUndefined();

    const created = await createCreation("catch-the-heart", "Creator-owned");
    await expect(
      replaceCreationContent(created.id, replacementData, "blocked-hash"),
    ).rejects.toThrow("Only a Received surprise can be replaced.");
  });

  it("persists the contentHash reported at import time", async () => {
    const imported: SurpriseData = {
      template: "catch-the-heart",
      basics: { senderName: "Me", recipientName: "Imported Person", openingMessage: "" },
      content: {
        hearts: [{ id: "heart-hash", message: "A saved memory" }],
        finalMessage: "Always",
        soundEffects: false,
      },
      appearance: { theme: "soft-rose", animationIntensity: "normal" },
      delivery: { expiration: "none" },
    };
    const record = await importCreationFromPackage(imported, undefined, "import-hash");
    expect(record.contentHash).toBe("import-hash");
    expect((await findDuplicateByContentHash("import-hash"))?.id).toBe(record.id);
  });

  it("does not crash when a stored draft record is corrupted", async () => {
    const record = await createCreation("catch-the-heart");
    // Simulate corruption by writing an invalid draft shape directly.
    const { withNamedTinySurpriseStore, CREATION_DRAFTS_STORE } = await import(
      "./builder-draft"
    );
    await withNamedTinySurpriseStore(CREATION_DRAFTS_STORE, "readwrite", (store) =>
      store.put({ data: { not: "valid" }, step: 1 }, record.id),
    );
    await expect(loadCreationDraft(record.id)).resolves.toBeUndefined();
  });
});
