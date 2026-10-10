"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, useReducedMotion } from "framer-motion";
import {
  AlertCircle,
  CalendarDays,
  Check,
  Copy,
  Eye,
  FileHeart,
  FolderOpen,
  Images,
  LoaderCircle,
  Pencil,
  User,
  Wifi,
} from "lucide-react";
import { Header } from "@/components/header";
import { Button } from "@/components/ui/button";
import { InlineFieldMessage } from "@/components/ui/inline-field-message";
import { FullScreenPreview } from "@/components/full-screen-preview";
import { HtmlViewer, type HtmlViewerSource } from "@/components/html-viewer";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { DuplicateConflictModal } from "@/components/duplicate-conflict-modal";
import { ProgressModal } from "@/components/progress-modal";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { getExperienceComponent } from "@/lib/render-experience";
import {
  peekPendingImport,
  subscribePendingImport,
  finishPendingImport,
  type PendingImport,
} from "@/lib/native/pending-import-store";
import {
  createEditableDraftFromReceived,
  importCreationFromPackage,
  restoreDraftBackup,
  replaceCreationContent,
  resolveImportConflict,
  ReceivedConflictError,
  NativeImportRecoveryError,
  type CreationRecord,
} from "@/lib/creations";
import { describeDuplicateState } from "@/lib/duplicate-classifier";
import { readTinySurprisePackageDetailed } from "@/lib/export/tinysurprise-package";
import { classifyImportBlob, summarizePackage } from "@/lib/viewer-summary";
import { collectDraftMediaBlobUrls, restoreDraftMedia } from "@/lib/builder-draft";
import { disposeDraftMedia } from "@/lib/local-media";
import { TEMPLATES } from "@/lib/config";
import { setLibraryNotice, setBuilderNotice } from "@/lib/library-notice";
import type { SurpriseData } from "@/lib/types";
import { formatBytes } from "@/lib/format-bytes";
import { fileOperationFailureMessage } from "@/lib/file-operation-error";

type TinysurpriseImport = Extract<PendingImport, { kind: "tinysurprise" }>;
type Mode = "loading" | "empty" | "tinysurprise" | "html";
/** Where the current import came from — decides whether losing it needs a confirmation. An intent-delivered file (a share/open from outside the app) is a one-shot handoff with no local copy to fall back on; a manually picked file is still sitting right where the user found it. */
type ImportOrigin = "intent" | "manual";
class ImportReleaseError extends Error {}
const saveFailureMessage = (reason: unknown) => reason instanceof ImportReleaseError
  ? "Your surprise is saved on this device. Try this action again to finish; it won’t add another copy."
  : reason instanceof ReceivedConflictError || reason instanceof NativeImportRecoveryError ? reason.message
  : fileOperationFailureMessage(reason, "We couldn't save this surprise. Your file is still here. Try again.");

const mb = (bytes: number) => formatBytes(bytes, 2);

/**
 * Built-in viewer for .tinysurprise and TinySurprise-generated HTML files —
 * reached either by opening/sharing a file into the app (native-app-shell.tsx
 * routes here instead of the old window.confirm()-driven import) or by
 * picking a file manually. .tinysurprise packages always go through the
 * same validation as every other import path (readTinySurprisePackageDetailed)
 * before anything is shown or saved; nothing here executes imported HTML —
 * that's HtmlViewer's sandboxed iframe.
 */
export default function ViewerPage() {
  const router = useRouter();
  const [backupIntent, setBackupIntent] = useState(false);
  useEffect(() => setBackupIntent(new URLSearchParams(window.location.search).get("purpose") === "backup"), []);
  const [mode, setMode] = useState<Mode>("loading");
  const [tsImport, setTsImport] = useState<TinysurpriseImport>();
  const [htmlSource, setHtmlSource] = useState<HtmlViewerSource>();
  const [importOrigin, setImportOrigin] = useState<ImportOrigin>();
  const [previewOpen, setPreviewOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [busyTitle, setBusyTitle] = useState("Saving your surprise");
  const setOperationBusy = useCallback((next: boolean, title = "Saving your surprise") => {
    busyRef.current = next;
    setBusy(next);
    if (next) setBusyTitle(title);
  }, []);
  const [error, setError] = useState("");
  const [discardIntent, setDiscardIntent] = useState<"cancel" | "back">();
  const [conflictAction, setConflictAction] = useState<"save" | "edit">();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const pageRef = useRef<HTMLElement>(null);
  // A successful IndexedDB write must not be repeated when only native
  // acknowledgement fails. Retain its result for this import's retry.
  const savedProgressRef = useRef<{
    source?: TinysurpriseImport;
    received?: CreationRecord;
    backup?: CreationRecord;
    edits: Map<string, CreationRecord>;
    replacements: Map<string, CreationRecord>;
  }>({ edits: new Map(), replacements: new Map() });
  const savedProgress = () => {
    if (savedProgressRef.current.source !== tsImport) {
      savedProgressRef.current = { source: tsImport, edits: new Map(), replacements: new Map() };
    }
    return savedProgressRef.current;
  };

  // One imported-media session for the whole time this page has an active
  // import: media is resolved into real blob: URLs exactly once (never
  // depending on IndexedDB/the original creation still existing), and those
  // URLs stay alive across rotation, modals, and the full-screen preview —
  // only revoked when the import session actually ends (Cancel, unmount, or
  // navigating away after a save).
  const sessionUrlsRef = useRef<string[]>([]);
  const revokeSessionUrls = useCallback(() => {
    sessionUrlsRef.current.forEach((url) => URL.revokeObjectURL(url));
    sessionUrlsRef.current = [];
  }, []);
  const hydrateImportMedia = useCallback(
    (value: TinysurpriseImport): TinysurpriseImport => {
      revokeSessionUrls();
      restoreDraftMedia(value.data);
      sessionUrlsRef.current = collectDraftMediaBlobUrls(value.data);
      return value;
    },
    [revokeSessionUrls],
  );

  const manualImportRef = useRef(false);
  const shownIntentRef = useRef<PendingImport | undefined>(undefined);
  const receivePending = useCallback(() => {
    if (manualImportRef.current || pageRef.current?.closest("[inert]")) return;
    const value = peekPendingImport();
    if (!value) { setMode(current => current === "loading" ? "empty" : current); return; }
    if (shownIntentRef.current === value) return;
    shownIntentRef.current = value;
    revokeSessionUrls();
    savedProgressRef.current = { edits: new Map(), replacements: new Map() };
    setPreviewOpen(false);
    setError("");
    setImportOrigin("intent");
    if (value.kind === "html") {
      setTsImport(undefined);
      setHtmlSource({ kind: "path", path: value.path, name: value.name });
      setMode("html");
    } else {
      setHtmlSource(undefined);
      setTsImport(hydrateImportMedia(value));
      setMode("tinysurprise");
    }
  }, [hydrateImportMedia, revokeSessionUrls]);
  useEffect(() => {
    receivePending();
    const unsubscribe = subscribePendingImport(receivePending);
    // An import error dialog can temporarily own the screen. Resume the
    // handoff after it releases this page instead of mounting a viewer beneath it.
    const observer = new MutationObserver(receivePending);
    if (pageRef.current) observer.observe(pageRef.current, { attributes: true, attributeFilter: ["inert"] });
    return () => { observer.disconnect(); unsubscribe(); shownIntentRef.current = undefined; revokeSessionUrls(); };
  }, [receivePending, revokeSessionUrls]);
  const consumeCurrentImport = async () => {
    manualImportRef.current = true;
    try {
      if (importOrigin === "intent" && shownIntentRef.current) await finishPendingImport(shownIntentRef.current);
    } catch {
      throw new ImportReleaseError("The received file could not be released. It is still available here; try again.");
    } finally { manualImportRef.current = false; }
  };

  const reset = useCallback(() => {
    revokeSessionUrls();
    savedProgressRef.current = { edits: new Map(), replacements: new Map() };
    setTsImport(undefined);
    setHtmlSource(undefined);
    setImportOrigin(undefined);
    setError("");
    setMode("empty");
    manualImportRef.current = false;
    shownIntentRef.current = undefined;
    queueMicrotask(receivePending);
  }, [revokeSessionUrls, receivePending]);
  const closePreview = useCallback(() => setPreviewOpen(false), []);

  // An intent-delivered import (received from outside the app) is a one-shot
  // handoff: discarding it means asking the sender to send it again, so
  // losing it — via Cancel or the hardware Back button — needs a real
  // confirmation. A manually picked file is still on the device right where
  // the user found it, so it keeps the old, instant behavior.
  const guardDiscard =
    importOrigin === "intent" && (mode === "tinysurprise" || mode === "html");

  const requestCancel = useCallback(() => {
    if (busyRef.current) return;
    if (guardDiscard) {
      setDiscardIntent("cancel");
      return;
    }
    reset();
  }, [guardDiscard, reset, importOrigin]);

  const armDiscardConfirm = useCallback(() => { if (!busyRef.current) setDiscardIntent("back"); }, []);
  useModalBackHandler(guardDiscard || busy, armDiscardConfirm);

  const confirmDiscard = async () => {
    if (busyRef.current) return;
    const intent = discardIntent;
    setOperationBusy(true, "Closing this file");
    try {
      await consumeCurrentImport();
      setDiscardIntent(undefined);
      reset();
      if (intent === "back") router.back();
    } finally { setOperationBusy(false); }
  };

  const handleFile = async (file: File) => {
    if (busyRef.current) return;
    setError("");
    setOperationBusy(true, "Opening your file");
    manualImportRef.current = true;
    let importedData: SurpriseData | undefined;
    let transferred = false;
    try {
      const kind = await classifyImportBlob(file.name, file);
      if (kind === "html") {
        setImportOrigin("manual");
        setHtmlSource({ kind: "file", file });
        setMode("html");
        return;
      }
      const result = await readTinySurprisePackageDetailed(file);
      importedData = result.data;
      const conflict = await resolveImportConflict(result.contentHash, result.sourceCreationId);
      setImportOrigin("manual");
      setTsImport(
        hydrateImportMedia({
          kind: "tinysurprise",
          ...result,
          suggestedName: file.name,
          approxBytes: file.size,
          conflict,
        }),
      );
      transferred = true;
      setMode("tinysurprise");
    } catch (reason) {
      manualImportRef.current = false;
      setError(
        fileOperationFailureMessage(reason, "This file couldn't be opened. Choose the original file or ask for a new copy. If it’s a ZIP copy, extract it and open the HTML file inside."),
      );
      queueMicrotask(receivePending);
    } finally {
      if (!transferred && importedData) disposeDraftMedia(importedData);
      setOperationBusy(false);
    }
  };

  const nativeImportId = () => importOrigin === "intent" ? shownIntentRef.current?.nativeId : undefined;
  const showSaveFailure = async (reason: unknown) => {
    if (reason instanceof ReceivedConflictError && tsImport) {
      try {
        const conflict = await resolveImportConflict(tsImport.contentHash, tsImport.sourceCreationId);
        setTsImport({ ...tsImport, conflict });
      } catch {
        setError("The latest saved version could not be checked. Your file is still here. Try again.");
        return;
      }
    }
    setError(saveFailureMessage(reason));
  };
  const importAsNew = async (allowDuplicate = false) => {
    if (!tsImport) throw new Error("We couldn't save this surprise. Try again.");
    const progress = savedProgress();
    if (progress.received) return progress.received;
    const received = await importCreationFromPackage(
      tsImport.data,
      tsImport.suggestedName,
      tsImport.contentHash,
      tsImport.hashVersion,
      tsImport.manifestVersion,
      tsImport.accessMode,
      tsImport.sourceCreationId,
      { nativeImportId: nativeImportId(), allowDuplicate },
    );
    progress.received = received;
    return received;
  };

  const finishAndGoToLibrary = async (record: CreationRecord, notice: string, outcome: "added" | "existing" | "replaced" = "added") => {
    await consumeCurrentImport();
    setLibraryNotice({ message: notice + (outcome === "added" ? " Added 1 received surprise; your existing drafts are unchanged." : outcome === "existing" ? " No new item added." : " Your other surprises are unchanged."), recordId: record.id, outcome, tab: "received" });
    if (peekPendingImport()) { shownIntentRef.current = undefined; receivePending(); }
    else router.push("/library");
  };

  const finishAndGoToEdit = async (received: CreationRecord, data: SurpriseData) => {
    const progress = savedProgress();
    const draft = progress.edits.get(received.id) || await createEditableDraftFromReceived(received, data, nativeImportId());
    progress.edits.set(received.id, draft);
    setBuilderNotice(`Made a draft you can edit: "${draft.title}". The received original stays unchanged.`);
    await consumeCurrentImport();
    router.push(`/create/${draft.templateId}?creation=${draft.id}`);
  };

  const requestSaveToReceived = () => {
    if (!tsImport || busyRef.current) return;
    if (
      tsImport.conflict.kind === "changed" ||
      (tsImport.conflict.kind === "created-collision" &&
        tsImport.conflict.existing)
    ) {
      setConflictAction("save");
      return;
    }
    void resolveSave();
  };

  const resolveSave = async () => {
    if (!tsImport || busyRef.current) return;
    setOperationBusy(true);
    setError("");
    try {
      const record = await importAsNew();
      if (record.reusedImport) {
        await finishAndGoToLibrary(
          record,
          `Opened existing "${record.title}" in Received.`, "existing",
        );
      } else {
        await finishAndGoToLibrary(record, `Saved "${record.title}" to Received.`);
      }
    } catch (reason) {
      await showSaveFailure(reason);
    } finally {
      setOperationBusy(false);
    }
  };

  /**
   * "Save and edit" — only ever reachable when accessMode is "editable" (see
   * the button's own guard below). Saves the received original first (or
   * reuses it if already saved), then always creates a brand-new draft to
   * actually edit — the received record's own id is never routed into the
   * builder.
   */
  const restoreBackup = async () => {
    if (!tsImport || busyRef.current || tsImport.purpose !== "draft-backup") return;
    setOperationBusy(true, "Restoring your backup"); setError("");
    try {
      const progress = savedProgress();
      const record = progress.backup || await restoreDraftBackup(tsImport.data, tsImport.step, nativeImportId());
      progress.backup = record;
      setBuilderNotice("Restored as a new draft. Existing surprises are unchanged.");
      await consumeCurrentImport();
      router.push("/create/" + record.templateId + "?creation=" + record.id);
    } catch (reason) { setError(reason instanceof ImportReleaseError ? "Your restored draft is saved on this device. Try Restore again to finish closing this file; another draft will not be created." : reason instanceof NativeImportRecoveryError ? reason.message : fileOperationFailureMessage(reason, "Your backup could not be restored. Your file is still here. Try again.")); }
    finally { setOperationBusy(false); }
  };

  const requestSaveAndEdit = () => {
    if (!tsImport || busyRef.current || tsImport.accessMode === "view-only") return;
    if (
      tsImport.conflict.kind === "changed" ||
      (tsImport.conflict.kind === "created-collision" &&
        tsImport.conflict.existing)
    ) {
      setConflictAction("edit");
      return;
    }
    void saveAndEdit();
  };

  const saveAndEdit = async () => {
    if (!tsImport || busyRef.current || tsImport.accessMode === "view-only") return;
    setOperationBusy(true);
    setError("");
    try {
      const received = await importAsNew();
      await finishAndGoToEdit(received, tsImport.data);
    } catch (reason) {
      await showSaveFailure(reason);
    } finally {
      setOperationBusy(false);
    }
  };

  const saveAsCopy = async () => {
    if (!tsImport || busyRef.current) return;
    setOperationBusy(true);
    setError("");
    try {
      const record = await importAsNew(true);
      await finishAndGoToLibrary(record, `Saved a separate copy of "${record.title}".`);
    } catch (reason) {
      await showSaveFailure(reason);
    } finally {
      setOperationBusy(false);
    }
  };

  // The only path that may ever overwrite an already-saved surprise —
  // reachable exclusively from the conflict modal below, after the person
  // has explicitly chosen "Replace existing" over "Save as new copy". The
  // modal always closes in `finally` (matching import-draft-button.tsx's
  // runConflictAction) so a failure becomes a visible page error instead of
  // staying hidden behind a still-open modal.
  const replaceExisting = async (target = tsImport?.conflict.existing) => {
    if (!tsImport || busyRef.current || !target) return;
    const intent = conflictAction;
    setOperationBusy(true);
    setError("");
    try {
      const progress = savedProgress();
      const updated = progress.replacements.get(target.id) || await replaceCreationContent(
        target.id,
        tsImport.data,
        tsImport.contentHash,
        tsImport.hashVersion,
        tsImport.manifestVersion,
        tsImport.accessMode,
        tsImport.sourceCreationId,
        { expected: target, nativeImportId: nativeImportId() },
      );
      if (!updated) throw new Error("We couldn't save this surprise. Try again.");
      progress.replacements.set(target.id, updated);
      if (intent === "edit") await finishAndGoToEdit(updated, tsImport.data);
      else await finishAndGoToLibrary(updated, `Replaced Received item "${updated.title}" with the new version.`, "replaced");
    } catch (reason) {
      await showSaveFailure(reason);
    } finally {
      setOperationBusy(false);
      setConflictAction(undefined);
    }
  };

  const saveAsCopyFromConflict = async () => {
    if (!tsImport || busyRef.current) return;
    const intent = conflictAction;
    setOperationBusy(true);
    setError("");
    try {
      const record = await importAsNew(true);
      if (intent === "edit") await finishAndGoToEdit(record, tsImport.data);
      else await finishAndGoToLibrary(record, `Saved a separate copy of "${record.title}".`);
    } catch (reason) {
      await showSaveFailure(reason);
    } finally {
      setOperationBusy(false);
      setConflictAction(undefined);
    }
  };

  const conflictCopy =
    tsImport && conflictAction
      ? describeDuplicateState(
          "import",
          tsImport.conflict.state,
          tsImport.conflict.existing?.title,
        )
      : undefined;

  return (
    <>
      <Header />
      <main
        ref={pageRef}
        className="site-container mx-auto min-h-svh max-w-2xl px-4 py-6"
        style={{ paddingBottom: "calc(1.5rem + env(safe-area-inset-bottom))" }}
      >
        <h1 className="text-2xl font-bold">{backupIntent ? "Restore a backup" : "Open a surprise"}</h1>
        {mode === "empty" && (
          <p className="mt-1 text-sm text-muted-foreground">
            {backupIntent ? "Restore unfinished work as a new draft. Your existing surprises stay unchanged." : "Open a Tiny Surprise file (.tinysurprise) or browser copy (.html). App copies can also be saved to My Surprises."}
          </p>
        )}

        <input
          ref={fileInputRef}
          type="file"
          aria-label="Choose a Tiny Surprise file or browser copy"
          accept=".tinysurprise,.html,.htm,application/zip,application/octet-stream"
          className="hidden"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void handleFile(file);
          }}
        />

        {error && (
          <div className="mt-4">
            <InlineFieldMessage message={error} />
          </div>
        )}

        {mode === "loading" && (
          <div
            className="mt-6 grid min-h-40 place-items-center gap-2 rounded-2xl border bg-card/70 text-muted-foreground"
            role="status"
          >
            <LoaderCircle className="h-6 w-6 animate-spin text-primary" />
            <p className="text-sm">Preparing your surprise…</p>
          </div>
        )}

        {mode === "empty" && (
          <div className="mt-6 grid gap-3 rounded-2xl border bg-card/70 p-8 text-center">
            <FolderOpen className="mx-auto h-7 w-7 text-primary" />
            <Button
              className="mx-auto w-fit"
              disabled={busy}
              onClick={() => fileInputRef.current?.click()}
            >
              {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : null}
              {backupIntent ? "Choose a backup" : "Open a file"}
            </Button>
          </div>
        )}

        {mode === "html" && <p className="mt-4 text-sm text-muted-foreground">Browser copies can be opened here, but aren’t saved to My Surprises.</p>}

        {mode === "tinysurprise" && tsImport && (
          <TinysurpriseImportPreview
            value={tsImport}
            busy={busy}
            onOpen={() => setPreviewOpen(true)}
            onSaveToLibrary={requestSaveToReceived}
            onSaveAndEdit={tsImport.purpose === "draft-backup" ? () => void restoreBackup() : requestSaveAndEdit}
            onSaveAsCopy={() => void saveAsCopy()}
            onCancel={requestCancel}
          />
        )}
      </main>
      <ProgressModal open={busy && !conflictAction && !discardIntent} title={busyTitle} stage="Keep this screen open until it finishes." />
      {tsImport && tsImport.purpose !== "draft-backup" && (
        <FullScreenPreview
          open={previewOpen}
          onClose={closePreview}
          data={tsImport.data}
          presentationMode="recipient-viewer"
        >
          {getExperienceComponent(tsImport.data)}
        </FullScreenPreview>
      )}
      {htmlSource && (
        <HtmlViewer
          open={mode === "html"}
          source={htmlSource}
          blocked={Boolean(discardIntent)}
          onClose={requestCancel}
        />
      )}
      <ConfirmationModal
        aboveViewer
        open={Boolean(discardIntent)}
        title="Discard this surprise?"
        message="You'd need the sender to send it again if you want to open it later."
        confirmLabel="Discard"
        onConfirm={confirmDiscard}
        onCancel={() => setDiscardIntent(undefined)}
      />
      <DuplicateConflictModal
        open={Boolean(conflictAction && conflictCopy)}
        title={conflictCopy?.title || ""}
        message={conflictCopy?.message || ""}
        actions={[
          {
            label: "Save as new copy",
            variant: "outline",
            onSelect: () => saveAsCopyFromConflict(),
          },
          ...(tsImport?.conflict.receivedMatches || []).map((record) => ({
            label: "Replace " + record.title + " (" + new Date(record.updatedAt).toLocaleString() + ")",
            variant: "outline" as const,
            onSelect: () => replaceExisting(record),
          })),
          ...(tsImport?.conflict.existing?.status === "imported"
            ? [
                {
                  label: "Replace existing",
                  variant: "default" as const,
                  onSelect: () => replaceExisting(),
                },
              ]
            : []),
        ]}
        onCancel={() => setConflictAction(undefined)}
      />
    </>
  );
}

function TinysurpriseImportPreview({
  value,
  busy,
  onOpen,
  onSaveToLibrary,
  onSaveAndEdit,
  onSaveAsCopy,
  onCancel,
}: {
  value: TinysurpriseImport;
  busy: boolean;
  onOpen: () => void;
  onSaveToLibrary: () => void;
  onSaveAndEdit: () => void;
  onSaveAsCopy: () => void;
  onCancel: () => void;
}) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const [saveOpen, setSaveOpen] = useState(false);
  const reduceMotion = useReducedMotion();
  const summary = summarizePackage(value.data);
  const editable = value.accessMode !== "view-only";
  const draftBackup = value.purpose === "draft-backup";
  const title = value.data.basics.recipientName
    ? `For ${value.data.basics.recipientName}`
    : value.suggestedName || "Untitled surprise";
  const isNew = value.conflict.state === "NEW";
  const stateCopy = describeDuplicateState(
    "import",
    value.conflict.state,
    value.conflict.existing?.title,
  );
  const conflictNote =
    draftBackup ? "Restore unfinished work as a new draft. Existing surprises stay unchanged." : stateCopy?.message || "This will be saved in Received.";

  return (
    <motion.div
      className="mt-6 space-y-4"
      initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
    >
      <div className="border-b border-border/70 pb-4">
        <div className="flex items-start gap-3">
          <span className="grid h-11 w-11 shrink-0 place-items-center rounded-2xl bg-primary/10 text-primary">
            <FileHeart className="h-5 w-5" />
          </span>
          <div className="min-w-0 flex-1">
            <p className="[overflow-wrap:anywhere] text-lg font-bold">{title}</p>
            <p className="mt-0.5 text-sm text-muted-foreground">
              {TEMPLATES[value.data.template]?.name || value.data.template}
              {value.data.basics.senderName && ` · From ${value.data.basics.senderName}`}
            </p>
            <span
              className={`mt-1.5 inline-flex rounded-full px-2 py-0.5 text-[.65rem] font-semibold uppercase tracking-wide ${editable ? "bg-primary/10 text-primary" : "bg-secondary text-muted-foreground"}`}
            >
              {editable ? "Editable copy" : "View only"}
            </span>
          </div>
        </div>
        <p
          className={`mt-3 flex items-start gap-2 rounded-xl border p-2.5 text-xs ${isNew ? "border-border/60 text-muted-foreground" : "border-amber-300/60 bg-amber-50/70 text-amber-800 dark:border-amber-800 dark:bg-amber-950/30 dark:text-amber-200"}`}
        >
          {isNew ? (
            <Check className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          ) : (
            <AlertCircle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
          )}
          {conflictNote}
        </p>
      </div>

      <div className="grid gap-2">
        {draftBackup ? <Button disabled={busy} onClick={onSaveAndEdit}>Restore as new draft</Button> : <>
        <Button disabled={busy} onClick={onOpen}>
          <Eye className="mr-2 h-4 w-4" />
          Open surprise
        </Button>
        <Button
          variant="ghost"
          disabled={busy}
          aria-expanded={saveOpen}
          aria-controls="import-save-options"
          onClick={() => setSaveOpen((open) => !open)}
        >
          {saveOpen ? "Hide save options" : "Save options"}
        </Button>
        {saveOpen && (
          <div id="import-save-options" className="grid gap-2 border-t border-border/70 pt-2">
            <Button variant="outline" disabled={busy} onClick={onSaveToLibrary}>
              {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <FileHeart className="mr-2 h-4 w-4" />}
            Save to My Surprises
            </Button>
            <p className="text-xs text-muted-foreground">You’ll find it in Received.</p>
            {value.conflict.kind !== "none" && (
              <Button variant="outline" className="h-auto min-h-12 whitespace-normal" disabled={busy} onClick={onSaveAsCopy}>
                <Copy className="mr-2 h-4 w-4" aria-hidden="true" />
                Save as a separate copy
              </Button>
            )}
            {editable && (
              <>
              <Button variant="outline" disabled={busy} onClick={onSaveAndEdit}>
                {busy ? <LoaderCircle className="mr-2 h-4 w-4 animate-spin" /> : <Pencil className="mr-2 h-4 w-4" />}
                Save a copy to edit
              </Button>
              <p className="text-xs text-muted-foreground">The received original stays unchanged.</p>
              </>
            )}
          </div>
        )}
        </>}
      </div>

      <div className="grid gap-2">
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setDetailsOpen((open) => !open)}
            aria-expanded={detailsOpen}
            aria-controls="import-file-details"
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl px-3 text-sm font-semibold text-muted-foreground transition hover:bg-secondary"
          >
            File details
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex min-h-12 flex-1 items-center justify-center rounded-xl border px-3 text-sm font-semibold text-muted-foreground transition hover:bg-secondary disabled:opacity-50"
          >
            Cancel
          </button>
        </div>
      </div>

      {detailsOpen && (
        <dl id="import-file-details" className="grid grid-cols-2 gap-3 border-t border-border/70 pt-4 text-xs">
          <InfoRow
            icon={CalendarDays}
            label="Created"
            value={new Date(value.exportedAt).toLocaleDateString()}
          />
          <InfoRow icon={FileHeart} label="Filename" value={value.suggestedName || "Received surprise file"} />
          <InfoRow icon={FileHeart} label="Purpose" value={draftBackup ? "Backup: restores a new draft" : "App copy: saves to Received"} />
          <InfoRow icon={Images} label="Media" value={`${summary.mediaCount} item${summary.mediaCount === 1 ? "" : "s"}`} />
          <InfoRow icon={Copy} label="File version" value={String(value.manifestVersion)} />
          <InfoRow icon={FileHeart} label="Size" value={mb(value.approxBytes)} />
          {summary.requiresInternetForExternalLinks && (
            <InfoRow icon={Wifi} label="Linked media" value="Linked photos, videos, and songs need internet" />
          )}
        </dl>
      )}
    </motion.div>
  );
}

function InfoRow({
  icon: Icon,
  label,
  value,
}: {
  icon: typeof User;
  label: string;
  value: string;
}) {
  return (
    <div className="flex items-start gap-1.5">
      <Icon className="mt-0.5 h-3.5 w-3.5 shrink-0 text-primary" aria-hidden="true" />
      <span>
        <span className="block text-muted-foreground">{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </span>
    </div>
  );
}
