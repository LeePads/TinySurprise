import "fake-indexeddb/auto";
import { IDBFactory } from "fake-indexeddb";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { initialData } from "./builder-defaults";
import { ACTIVE_TEMPLATE_IDS } from "./template-registry";
import { cloneDraftDataForPersistence } from "./local-media";
import { CREATION_DRAFTS_STORE, CREATIONS_STORE, LOCAL_MEDIA_STORE, withNamedTinySurpriseStore } from "./builder-draft";
import { deleteCreation, getDraftDeletionGuard, DraftDeletionConflictError, renameCreation, commitEditSession, createCreation, createOrLoadEditSession, discardEditSession, DraftConflictError, editSessionKey, getCreation, importCreationFromPackage, loadCreationDraft, loadEditSessionDraft, recoverCreationAsDraft, resolveImportConflict, restoreDraftBackup, saveCreationDraft, saveEditSessionDraft, setCreationStatus } from "./creations";
import { createTinySurprisePackageDetailed, readTinySurprisePackageDetailed } from "./export/tinysurprise-package";
import { createZipArchive, readZipArchive } from "./export/zip";
import { clearPendingImport, peekPendingImport, setPendingImport, subscribePendingImport } from "./native/pending-import-store";
import type { CatchTheHeartContent, SurpriseData } from "./types";

beforeEach(() => { indexedDB = new IDBFactory(); });

function completeHeart(): SurpriseData {
  return { ...initialData("catch-the-heart"),
    basics: { senderName: "Me", recipientName: "You", openingMessage: "Hello" },
    content: { hearts: [{ id: "heart", message: "A memory" }], finalMessage: "Always", soundEffects: false },
  };
}
function withMedia(): SurpriseData {
  const data = completeHeart();
  const photo = new File(["photo"], "memory.png", { type: "image/png" });
  const song = new File(["song"], "music.mp3", { type: "audio/mpeg" });
  (data.content as CatchTheHeartContent).hearts[0].photo = {
    id: "photo", file: photo, previewUrl: "blob:photo", name: photo.name, mimeType: photo.type, size: photo.size, source: "upload",
  };
  data.music = { file: { id: "song", file: song, previewUrl: "blob:song", name: song.name, mimeType: song.type, size: song.size }, loop: true, startMuted: false, volume: 60 };
  return data;
}
const mediaKeys = () => withNamedTinySurpriseStore(LOCAL_MEDIA_STORE, "readonly", (store) => store.getAllKeys());

describe("V1 persistence regressions", () => {
  it("retains photo bytes and the music.file container across metadata-only saves", async () => {
    const record = await createCreation("catch-the-heart");
    await saveCreationDraft(record.id, withMedia(), 3, { revision: 0 });
    const first = (await loadCreationDraft(record.id))!;
    expect(await first.data.music!.file!.file.text()).toBe("song");
    const metadata = cloneDraftDataForPersistence(first.data);
    expect(metadata.music!.file!.id).toBe("song");
    expect(metadata.music!.file!.file).toBeUndefined();
    await saveCreationDraft(record.id, metadata, 4, { revision: first.revision! });
    const restored = (await loadCreationDraft(record.id))!;
    expect(await restored.data.music!.file!.file.text()).toBe("song");
    expect(await (restored.data.content as CatchTheHeartContent).hearts[0].photo!.file!.text()).toBe("photo");
    expect(await mediaKeys()).toHaveLength(2);
  });

  it("aborts missing-byte writes without deleting the previous media", async () => {
    const record = await createCreation("catch-the-heart");
    await saveCreationDraft(record.id, withMedia(), 2, { revision: 0 });
    const metadata = cloneDraftDataForPersistence(withMedia());
    (metadata.content as CatchTheHeartContent).hearts[0].photo!.id = "missing";
    await expect(saveCreationDraft(record.id, metadata, 3, { revision: 1 })).rejects.toThrow();
    expect(await mediaKeys()).toHaveLength(2);
    expect((await loadCreationDraft(record.id))!.revision).toBe(1);
  });

  it("rejects a stale tab without overwriting the winning save", async () => {
    const record = await createCreation("catch-the-heart");
    const stale = (await loadCreationDraft(record.id))!;
    await saveCreationDraft(record.id, completeHeart(), 4, { revision: stale.revision! });
    await expect(saveCreationDraft(record.id, stale.data, 1, { revision: stale.revision! })).rejects.toBeInstanceOf(DraftConflictError);
    expect((await loadCreationDraft(record.id))!.data.basics.recipientName).toBe("You");
  });

  it("rejects incomplete completion and recovers an old mislabeled creator record", async () => {
    const record = await createCreation("memory-quiz");
    await expect(setCreationStatus(record.id, "completed")).rejects.toThrow();
    expect((await getCreation(record.id))!.status).toBe("draft");
    await withNamedTinySurpriseStore(CREATIONS_STORE, "readwrite", (store) => store.put({ ...record, status: "completed" }, record.id));
    expect(await loadCreationDraft(record.id)).toBeUndefined();
    await recoverCreationAsDraft(record.id);
    expect(await loadCreationDraft(record.id)).toBeDefined();
  });

  it("commits isolated edits, cleans session media and rejects stale session identities", async () => {
    const record = await createCreation("catch-the-heart");
    await saveCreationDraft(record.id, withMedia(), 6, { revision: 0 });
    await setCreationStatus(record.id, "completed");
    const session = await createOrLoadEditSession(record.id);
    expect(await mediaKeys()).toHaveLength(4);
    await saveEditSessionDraft(record.id, session.data, 3, session);
    await expect(commitEditSession(record.id, session.data, 6, "compatibility", session)).rejects.toBeInstanceOf(DraftConflictError);
    await commitEditSession(record.id, session.data, 6, "compatibility", { revision: session.revision + 1, sessionId: session.sessionId });
    expect((await mediaKeys()).some((key) => String(key).startsWith(editSessionKey(record.id)))).toBe(false);
    expect(await (await loadCreationDraft(record.id))!.data.music!.file!.file.text()).toBe("song");
    const replacement = await createOrLoadEditSession(record.id);
    await expect(saveEditSessionDraft(record.id, session.data, 2, session)).rejects.toBeInstanceOf(DraftConflictError);
    await expect(discardEditSession(record.id, session)).rejects.toBeInstanceOf(DraftConflictError);
    expect((await loadEditSessionDraft(record.id))!.sessionId).toBe(replacement.sessionId);
  });

  it("rejects a commit if its finalized source changed", async () => {
    const record = await createCreation("catch-the-heart");
    await saveCreationDraft(record.id, completeHeart(), 6, { revision: 0 });
    await setCreationStatus(record.id, "completed");
    const session = await createOrLoadEditSession(record.id);
    const draft = (await loadCreationDraft(record.id))!;
    await withNamedTinySurpriseStore(CREATION_DRAFTS_STORE, "readwrite", (store) => store.put({ ...draft, revision: draft.revision! + 1 }, record.id));
    await expect(commitEditSession(record.id, session.data, 6, "compatibility", session)).rejects.toBeInstanceOf(DraftConflictError);
    expect(await loadEditSessionDraft(record.id)).toBeDefined();
  });

  it("preserves Received origin matching and requires a target for multiple versions", async () => {
    const first = await importCreationFromPackage(completeHeart(), "first", "hash-a", 1, 2, "editable", "sender-id");
    expect((await resolveImportConflict("hash-b", "sender-id")).existing!.id).toBe(first.id);
    await importCreationFromPackage(completeHeart(), "copy", "hash-c", 1, 2, "editable", "sender-id");
    const conflict = await resolveImportConflict("hash-b", "sender-id");
    expect(conflict.state).toBe("MULTIPLE_RECEIVED_MATCHES");
    expect(conflict.existing).toBeUndefined();
    expect(conflict.receivedMatches).toHaveLength(2);
    await expect(recoverCreationAsDraft(first.id)).rejects.toThrow(/Received/);
  });
});

describe("working backups", () => {
  it.each(ACTIVE_TEMPLATE_IDS)("round-trips an unfinished %s as a separate draft", async (template) => {
    const data = initialData(template);
    const { file, contentHash } = await createTinySurprisePackageDetailed(data, { purpose: "draft-backup", step: 3 });
    const imported = await readTinySurprisePackageDetailed(file);
    expect(imported.purpose).toBe("draft-backup");
    expect(imported.manifestVersion).toBe(3);
    expect(imported.step).toBe(3);
    expect(imported.contentHash).toBe(contentHash);
    const first = await restoreDraftBackup(imported.data, imported.step);
    const second = await restoreDraftBackup(imported.data, imported.step);
    expect(first.status).toBe("draft");
    expect(second.id).not.toBe(first.id);
    expect((await loadCreationDraft(first.id))!.step).toBe(3);
    await expect(createTinySurprisePackageDetailed(data, { accessMode: "view-only" })).rejects.toThrow();
  });

  it("preserves uploaded media and distinguishes backup fingerprints from recipient files", async () => {
    const data = withMedia();
    const backup = await createTinySurprisePackageDetailed(data, { purpose: "draft-backup", step: 4 });
    const recipient = await createTinySurprisePackageDetailed(data);
    const imported = await readTinySurprisePackageDetailed(backup.file);
    expect(imported.contentHash).toBe(backup.contentHash);
    expect(imported.contentHash).not.toBe(recipient.contentHash);
    const record = await restoreDraftBackup(imported.data, imported.step);
    expect(await (await loadCreationDraft(record.id))!.data.music!.file!.file.text()).toBe("song");
    expect((await readTinySurprisePackageDetailed(recipient.file)).purpose).toBe("surprise");
  });
});

describe("untrusted ZIP allocation limits", () => {
  it("checks count and payload limits before allocating entries", () => {
    const bytes = createZipArchive([{ name: "manifest.json", data: new Uint8Array(32) }]);
    expect(() => readZipArchive(bytes, { maxEntryBytes: () => 8 })).toThrow(/budget/);
    expect(() => readZipArchive(bytes, { maxTotalBytes: 8 })).toThrow(/budget/);
    const view = new DataView(bytes.buffer);
    view.setUint16(bytes.length - 12, 301, true);
    expect(() => readZipArchive(bytes)).toThrow(/Too many/);
  });
  it("rejects overlapping entries referencing one payload", () => {
    const bytes = createZipArchive([{ name: "x", data: new Uint8Array(32) }, { name: "x", data: new Uint8Array(32) }]);
    const view = new DataView(bytes.buffer);
    const central = view.getUint32(bytes.length - 6, true);
    view.setUint32(central + 47 + 42, 0, true);
    expect(() => readZipArchive(bytes)).toThrow(/Overlapping/);
  });
});

it("notifies an already-mounted viewer without replacing an undecided intent", () => {
  while (peekPendingImport()) clearPendingImport();
  const listener = vi.fn();
  const unsubscribe = subscribePendingImport(listener);
  const first = { kind: "html" as const, path: "first.html" };
  const second = { kind: "html" as const, path: "second.html" };
  setPendingImport(first); setPendingImport(second);
  expect(peekPendingImport()).toBe(first);
  clearPendingImport();
  expect(peekPendingImport()).toBe(second);
  expect(listener).toHaveBeenCalledTimes(3);
  unsubscribe(); clearPendingImport();
});


describe("selected draft deletion", () => {
  it("skips a revised draft and preserves its owned media", async () => {
    const record = await createCreation("catch-the-heart");
    await saveCreationDraft(record.id, withMedia(), 2, { revision: 0 });
    const guard = await getDraftDeletionGuard(record.id);
    await saveCreationDraft(record.id, withMedia(), 3, { revision: 1 });
    await expect(deleteCreation(record.id, guard)).rejects.toBeInstanceOf(DraftDeletionConflictError);
    expect((await loadCreationDraft(record.id))?.step).toBe(3);
    expect(await mediaKeys()).toHaveLength(2);
    // A skipped deletion must not invalidate subsequent editing.
    await saveCreationDraft(record.id, withMedia(), 4, { revision: 2 });
  });
  it("skips a finalized or renamed record after confirmation", async () => {
    const record = await createCreation("catch-the-heart");
    await saveCreationDraft(record.id, completeHeart(), 6, { revision: 0 });
    const guard = await getDraftDeletionGuard(record.id);
    await renameCreation(record.id, "Keep this one");
    await expect(deleteCreation(record.id, guard)).rejects.toBeInstanceOf(DraftDeletionConflictError);
    const renamedGuard = await getDraftDeletionGuard(record.id);
    await setCreationStatus(record.id, "completed");
    await expect(deleteCreation(record.id, renamedGuard)).rejects.toBeInstanceOf(DraftDeletionConflictError);
    expect((await getCreation(record.id))?.status).toBe("completed");
  });
  it("deletes only the confirmed owner and keeps an independent copy's bytes", async () => {
    const first = await createCreation("catch-the-heart");
    const second = await createCreation("catch-the-heart");
    await saveCreationDraft(first.id, withMedia(), 2, { revision: 0 });
    await saveCreationDraft(second.id, withMedia(), 2, { revision: 0 });
    await deleteCreation(first.id, await getDraftDeletionGuard(first.id));
    expect(await getCreation(first.id)).toBeUndefined();
    expect(await mediaKeys()).toHaveLength(2);
    expect(await (await loadCreationDraft(second.id))!.data.music!.file!.file.text()).toBe("song");
  });
  it("checks a queued edit before deleting and never admits Received records", async () => {
    const record = await createCreation("catch-the-heart");
    const guard = await getDraftDeletionGuard(record.id);
    const saving = saveCreationDraft(record.id, completeHeart(), 2, { revision: 0 });
    const deleting = deleteCreation(record.id, guard);
    await saving;
    await expect(deleting).rejects.toBeInstanceOf(DraftDeletionConflictError);
    const received = await importCreationFromPackage(completeHeart());
    await expect(getDraftDeletionGuard(received.id)).rejects.toBeInstanceOf(DraftDeletionConflictError);
    await expect(deleteCreation(received.id, { ...guard, updatedAt: received.updatedAt, title: received.title })).rejects.toBeInstanceOf(DraftDeletionConflictError);
    expect(await getCreation(received.id)).toBeDefined();
  });
});


it("preserves over-budget draft text through save, backup, restore and reload", async () => {
  const data = completeHeart();
  data.basics.senderName = "??".repeat(45);
  (data.content as CatchTheHeartContent).hearts[0].message = "long-unbroken".repeat(1000) + "\nLast line ??";
  (data.content as CatchTheHeartContent).finalMessage = "line\n".repeat(400);
  const record = await createCreation(data.template);
  await saveCreationDraft(record.id, data, 2, { revision: 0 });
  const loaded = (await loadCreationDraft(record.id))!;
  const backup = await createTinySurprisePackageDetailed(loaded.data, { purpose: "draft-backup", step: 2 });
  const imported = await readTinySurprisePackageDetailed(backup.file);
  const restored = await restoreDraftBackup(imported.data, imported.step);
  const reloaded = (await loadCreationDraft(restored.id))!;
  expect(reloaded.data.basics.senderName).toBe(data.basics.senderName);
  expect(reloaded.data.content).toEqual(data.content);
  expect(restored.id).not.toBe(record.id);
});
