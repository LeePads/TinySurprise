"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import {
  ArrowUpDown,
  CheckCircle2,
  Copy,
  Eye,
  FileHeart,
  LoaderCircle,
  MoreHorizontal,
  Pencil,
  Search,
  Share2,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { Header } from "@/components/header";
import { LibraryToast } from "@/components/library-toast";
import { TEMPLATE_CARD_ART } from "@/lib/design-assets";
import { Input } from "@/components/ui/input";
import { TEXT_LIMITS } from "@/lib/text-limits";
import { Button } from "@/components/ui/button";
import { InlineFieldMessage } from "@/components/ui/inline-field-message";
import { AdaptiveSelect } from "@/components/ui/adaptive-select";
import { SortSheet } from "@/components/sort-sheet";
import { ConfirmationModal } from "@/components/confirmation-modal";
import { DuplicateConflictModal } from "@/components/duplicate-conflict-modal";
import { ProgressModal } from "@/components/progress-modal";
import { FullScreenPreview } from "@/components/full-screen-preview";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { getExperienceComponent } from "@/lib/render-experience";
import type { SurpriseData } from "@/lib/types";
import { disposeDraftMedia } from "@/lib/local-media";
import {
  classifyAgainstLibrary,
  createEditableDraftFromReceived,
  deleteCreation,
  getDraftDeletionGuard,
  getCreationDeletionGuard,
  type CreationDeletionGuard,
  DraftDeletionConflictError,
  ReceivedConflictError,
  type DraftDeletionGuard,
  duplicateCreation,
  listCreations,
  getCreationRecoveryDetails,
  listLegacyMigrationFailures,
  retryLegacyDraftMigration,
  type LegacyMigrationFailure,
  loadCreationDraft,
  recordBackupHash,
  renameCreation,
  recoverCreationAsDraft,
  searchCreations,
  setCreationStatus,
  sortCreations,
  type CreationRecord,
  type CreationSortKey,
} from "@/lib/creations";
import { describeDuplicateState } from "@/lib/duplicate-classifier";
import type { DuplicateClassification } from "@/lib/duplicate-classifier";
import { consumeLibraryNotice, setBuilderNotice } from "@/lib/library-notice";
import {
  createTinySurprisePackageDetailed,
  TINYSURPRISE_PACKAGE_VERSION,
  DRAFT_BACKUP_VERSION,
} from "@/lib/export/tinysurprise-package";
import type { PackageCreationProgress } from "@/lib/export/tinysurprise-package";
import { PackageWorkerCancelledError } from "@/lib/export/package-worker-client";
import { yieldToPaint } from "@/lib/yield-to-paint";
import { HASH_VERSION } from "@/lib/export/content-hash";
import { downloadFile } from "@/lib/download-file";
import { isNativePlatform } from "@/lib/platform";
import { useAndroidWideLayout, useMediaQuery } from "@/lib/use-media-query";
import { saveAndShareOnNative, saveOnNative } from "@/lib/export/native-share";
import { TEMPLATES } from "@/lib/config";

type LoadState = "loading" | "ready" | "error";
type LibraryTab = "all" | "drafts" | "completed" | "received";

const TAB_OPTIONS: { value: LibraryTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "drafts", label: "Drafts" },
  { value: "completed", label: "Completed" },
  { value: "received", label: "Received" },
];

function matchesTab(creation: CreationRecord, tab: LibraryTab): boolean {
  if (tab === "all") return true;
  if (tab === "drafts") return creation.status === "draft";
  if (tab === "completed") return creation.status === "completed";
  return creation.status === "imported";
}

/** "Updated today"/"Updated yesterday"/"Updated 3 days ago" — one short relative date instead of a full calendar date, for the compact native card. */
function relativeDateLabel(timestamp: number): string {
  const days = Math.floor((Date.now() - timestamp) / 86400000);
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 7) return `${days} days ago`;
  return new Date(timestamp).toLocaleDateString();
}

export default function LibraryPage() {
  const router = useRouter();
  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativePlatform());
  }, []);
  const wide = useAndroidWideLayout();
  const extraWide = useMediaQuery("(min-width: 900px)");
  const desktopMenu = useMediaQuery("(min-width: 768px) and (hover: hover) and (pointer: fine)");
  const [moreAnchor, setMoreAnchor] = useState<HTMLButtonElement | null>(null);
  const dense = native && wide;
  const [state, setState] = useState<LoadState>("loading");
  const [creations, setCreations] = useState<CreationRecord[]>([]);
  const [migrationFailures, setMigrationFailures] = useState<LegacyMigrationFailure[]>([]);
  const [query, setQuery] = useState("");
  const [templateFilter, setTemplateFilter] = useState("all");
  const [selecting, setSelecting] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [pendingBulk, setPendingBulk] = useState<{ record: CreationRecord; guard: DraftDeletionGuard }[]>();
  const [sortKey, setSortKey] = useState<CreationSortKey>("updated");
  const [busyId, setBusyId] = useState<string>();
  const busyRef = useRef(false);
  const [packageStage, setPackageStage] = useState<{
    text: string;
    progress?: { completed: number; total: number };
  }>();
  const packageCancelFnRef = useRef<() => void>(undefined);
  const [canCancelPackage, setCanCancelPackage] = useState(false);
  const [notice, setNotice] = useState("");
  const dismissNotice = useCallback(() => setNotice(""), []);
  const [bulkResult, setBulkResult] = useState("");
  const [highlightId, setHighlightId] = useState<string>();
  const [error, setError] = useState("");
  const [pendingDelete, setPendingDelete] = useState<CreationRecord>();
  const deletionGuardRef = useRef<CreationDeletionGuard | undefined>(undefined);
  const [quickPreview, setQuickPreview] = useState<SurpriseData>();
  useEffect(() => () => { if (quickPreview) disposeDraftMedia(quickPreview); }, [quickPreview]);
  const closeQuickPreview = useCallback(() => setQuickPreview(undefined), []);
  const [tab, setTab] = useState<LibraryTab>("all");
  const [sortSheetOpen, setSortSheetOpen] = useState(false);
  const [renaming, setRenaming] = useState<CreationRecord>();
  const [renameError, setRenameError] = useState("");
  const [duplicateBackup, setDuplicateBackup] = useState<{
    creation: CreationRecord;
    file: File;
    contentHash: string;
    classification: DuplicateClassification;
  }>();
  const [moreFor, setMoreFor] = useState<CreationRecord>();

  const refresh = useCallback(async () => {
    setState("loading");
    try {
      setCreations(await listCreations());
      try { setMigrationFailures(await listLegacyMigrationFailures()); }
      catch { setError("Your surprises are available, but older-draft recovery details could not be read. Reopen the Library to try again."); }
      setState("ready");
    } catch {
      setState("error");
    }
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  // Confirms a save/replace/duplicate outcome from the viewer — set once,
  // right before it navigates here, since the route change itself is no
  // confirmation that anything actually happened (see lib/library-notice.ts).
  useEffect(() => {
    const pending = consumeLibraryNotice();
    if (pending) { setNotice(pending.message); setHighlightId(pending.recordId); setTab(pending.tab); }
  }, []);

  useEffect(() => {
    if (state !== "ready" || !highlightId) return;
    const frame = requestAnimationFrame(() => document.getElementById("creation-" + highlightId)?.focus());
    return () => cancelAnimationFrame(frame);
  }, [state, highlightId]);
  useEffect(() => { setSelected(new Set()); setSelecting(false); }, [query, tab, templateFilter, sortKey]);
  const recoveryItems = creations.filter(record => record.recovery);
  const resume = creations.find(record => record.status === "draft" && !record.recovery);
  const tabbed = useMemo(
    () => creations.filter((creation) => !creation.recovery && matchesTab(creation, tab)),
    [creations, tab],
  );
  const visible = useMemo(
    () => sortCreations(searchCreations(tabbed.filter(record => templateFilter === "all" || record.templateId === templateFilter), query), sortKey),
    [tabbed, query, sortKey, templateFilter],
  );
  const tabCount = (value: LibraryTab) =>
    creations.filter(creation => !creation.recovery && (value === "all" || matchesTab(creation, value))).length;

  const openCreation = (creation: CreationRecord) =>
    router.push(`/create/${creation.templateId}?creation=${creation.id}`);

  const quickView = (creation: CreationRecord) =>
    withBusy(creation.id, async () => {
      const draft = await loadCreationDraft(creation.id);
      if (!draft) throw new Error("We couldn't find this surprise on your device. Try reopening it.");
      setQuickPreview(draft.data);
    });

  const withBusy = async (
    id: string,
    run: () => Promise<void>,
    /** Set for the two actions that build a .tinysurprise package, so the blocking progress modal opens before any work starts. */
    packaging = false,
  ) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusyId(id);
    setError("");
    setNotice("");
    if (packaging) setPackageStage({ text: "Preparing photos and music" });
    // Packaging starts synchronous work (ZIP assembly, base64) in the same
    // task as this setState, so without a yield the busy indicator never
    // reaches the screen and the app looks frozen.
    await yieldToPaint();
    try {
      await run();
    } catch (reason) {
      if (reason instanceof DOMException && reason.name === "AbortError") { setNotice("Sharing cancelled."); return; }
      if (reason instanceof PackageWorkerCancelledError) {
        setNotice("Cancelled.");
        return;
      }
      if (reason instanceof ReceivedConflictError) await refresh();
      setError(reason instanceof Error ? reason.message : "We couldn't complete that action. Try again.");
    } finally {
      busyRef.current = false;
      setBusyId(undefined);
      setPackageStage(undefined);
      setCanCancelPackage(false);
      packageCancelFnRef.current = undefined;
    }
  };

  /** Progress/cancel wiring shared by the two handlers that build a .tinysurprise package. */
  const packageProgressOptions = {
    onCancelAvailable: (cancel: (() => void) | undefined) => {
      packageCancelFnRef.current = cancel;
      setCanCancelPackage(Boolean(cancel));
    },
    onProgress: (progress: PackageCreationProgress) =>
      setPackageStage({
        text:
          progress.stage === "hashing"
            ? "Preparing photos and music"
            : "Preparing your surprise file",
        progress:
          progress.completed !== undefined && progress.total
            ? { completed: progress.completed, total: progress.total }
            : undefined,
      }),
  };

  const cancelPackage = useCallback(() => {
    if (!packageCancelFnRef.current) return;
    packageCancelFnRef.current();
  }, []);

  const handleDuplicate = (creation: CreationRecord) =>
    withBusy(creation.id, async () => {
      await duplicateCreation(creation.id);
      await refresh();
      setNotice(`Duplicated "${creation.title}".`);
    });

  const handleRename = (creation: CreationRecord) => {
    setRenameError("");
    setRenaming(creation);
  };

  const confirmRename = (nextTitle: string) =>
    withBusy(renaming!.id, async () => {
      const target = renaming!;
      const next = nextTitle.trim();
      if (!next || next === target.title) { setRenaming(undefined); return; }
      try {
        await renameCreation(target.id, next);
        setRenaming(undefined);
        await refresh();
        setNotice("Surprise renamed.");
      } catch (reason) {
        setRenameError(reason instanceof Error ? reason.message : "The name could not be saved. Try again.");
      }
    });

  const handleMarkCompleted = (creation: CreationRecord) =>
    withBusy(creation.id, async () => {
      await setCreationStatus(creation.id, "completed");
      await refresh();
      setNotice("Marked completed.");
    });

  const finishBackup = async (
    creation: CreationRecord,
    file: File,
    contentHash: string,
  ) => {
    if (isNativePlatform()) await saveOnNative(file);
    else if (!downloadFile(file)) throw new Error("The backup download could not start. Try again.");
    await recordBackupHash(
      creation.id,
      contentHash,
      HASH_VERSION,
      DRAFT_BACKUP_VERSION,
    );
    await refresh();
    setNotice(isNativePlatform() ? `Saved editable backup "${file.name}".` : `Download started for editable backup "${file.name}". Keep the file to restore your work.`);
  };

  const handleBackup = (creation: CreationRecord) =>
    withBusy(creation.id, async () => {
      const draft = await loadCreationDraft(creation.id);
      if (!draft) throw new Error("We couldn't find this surprise on your device. Try reopening it.");
      try {
        const { file, contentHash } = await createTinySurprisePackageDetailed(draft.data, {
          purpose: "draft-backup", step: draft.step,
          sourceCreationId: creation.id,
          ...packageProgressOptions,
        });
        setPackageStage({ text: "Saving to your device" });
        const classification = await classifyAgainstLibrary(contentHash, creation.id);
        if (
          classification.state === "NEW" ||
          classification.state === "INVALID_OR_UNVERIFIABLE"
        ) {
          await finishBackup(creation, file, contentHash);
          return;
        }
        setDuplicateBackup({ creation, file, contentHash, classification });
      } finally { disposeDraftMedia(draft.data); }
    }, true);

  const confirmDuplicateBackup = () =>
    withBusy(duplicateBackup!.creation.id, async () => {
      const pending = duplicateBackup!;
      setDuplicateBackup(undefined);
      await finishBackup(pending.creation, pending.file, pending.contentHash);
    }, true);

  const duplicateBackupCopy = duplicateBackup
    ? describeDuplicateState(
        "backup",
        duplicateBackup.classification.state,
        (duplicateBackup.classification.matchById ||
          duplicateBackup.classification.matchByContent)?.title,
      )
    : undefined;

  const handleShare = (creation: CreationRecord) =>
    withBusy(creation.id, async () => {
      const draft = await loadCreationDraft(creation.id);
      if (!draft) throw new Error("We couldn't find this surprise on your device. Try reopening it.");
      try {
        const { file } = await createTinySurprisePackageDetailed(draft.data, {
          sourceCreationId: creation.id,
          accessMode:
            creation.status === "imported" && creation.accessMode === "view-only"
              ? "view-only"
              : "editable",
          ...packageProgressOptions,
        });
        setPackageStage({ text: "Saving to your device" });
        if (isNativePlatform()) {
          const outcome = await saveAndShareOnNative(file, draft.data.basics.recipientName);
          setNotice(outcome === "shared" ? `Send options opened for "${creation.title}". Choose a chat or email app to send it.` : `Saved "${creation.title}" on this device. Sharing was cancelled.`);
          return;
        } else if (navigator.canShare?.({ files: [file] })) {
          await navigator.share({ files: [file], title: file.name });
        } else {
          if (!downloadFile(file)) throw new Error("The surprise download could not start. Try again.");
          setNotice(
            "Sharing isn't available in this browser. A download was started instead; wait for it to finish.",
          );
          return;
        }
        setNotice(`Send options opened for "${creation.title}". Choose a chat or email app to send it.`);
      } finally { disposeDraftMedia(draft.data); }
    }, true);

  const prepareBulkDelete = () => withBusy("bulk", async () => {
    const snapshots: { record: CreationRecord; guard: DraftDeletionGuard }[] = [];
    for (const record of visible.filter(record => selected.has(record.id) && record.status === "draft")) {
      snapshots.push({ record, guard: await getDraftDeletionGuard(record.id) });
    }
    if (snapshots.length) setPendingBulk(snapshots);
  });
  const confirmBulkDelete = () => withBusy("bulk", async () => {
    const targets = pendingBulk || [];
    setPendingBulk(undefined);
    let deleted = 0;
    const skipped: string[] = [], failed: string[] = [];
    for (const { record, guard } of targets) {
      try { await deleteCreation(record.id, guard); deleted++; }
      catch (reason) { (reason instanceof DraftDeletionConflictError ? skipped : failed).push(record.title); }
    }
    setSelected(new Set()); setSelecting(false);
    await refresh();
    setNotice(`Deleted ${deleted} ${deleted === 1 ? "draft" : "drafts"}.`);
    setBulkResult(skipped.length || failed.length ? `${deleted} deleted.${skipped.length ? ` Skipped changed drafts: ${skipped.join(", ")}.` : ""}${failed.length ? ` Could not delete: ${failed.join(", ")}.` : ""} These items remain in your Library. Review them before trying again.` : "");
  });

  const prepareDelete = (creation: CreationRecord) => withBusy(creation.id, async () => {
    const guard = await getCreationDeletionGuard(creation.id);
    if (guard.status !== creation.status || guard.updatedAt !== creation.updatedAt || guard.title !== creation.title) {
      await refresh();
      throw new DraftDeletionConflictError();
    }
    deletionGuardRef.current = guard;
    setPendingDelete(creation);
  });
  const confirmDelete = () =>
    withBusy(pendingDelete!.id, async () => {
      const target = pendingDelete!;
      const guard = deletionGuardRef.current;
      if (!guard) throw new DraftDeletionConflictError();
      setPendingDelete(undefined);
      deletionGuardRef.current = undefined;
      await deleteCreation(target.id, guard);
      await refresh();
      setNotice(`Deleted "${target.title}".`);
    });

  /** "Save and edit" from a Received card's More menu — never touches the received original (Section V/W). */
  const saveAndEditReceived = (creation: CreationRecord) =>
    withBusy(creation.id, async () => {
      const draft = await loadCreationDraft(creation.id);
      if (!draft) throw new Error("We couldn't find this surprise on your device. Try reopening it.");
      try {
        const derived = await createEditableDraftFromReceived(creation, draft.data);
        setBuilderNotice(`Created editable draft "${derived.title}". Received original "${creation.title}" is preserved.`);
        router.push(`/create/${derived.templateId}?creation=${derived.id}`);
      } finally { disposeDraftMedia(draft.data); }
    });

  return (
    <>
      <Header />
      <main
        className={`site-container mx-auto min-h-svh px-3 py-6 sm:px-4 sm:py-10 ${native ? "android-page" : "pb-28"} ${native ? (dense ? "max-w-6xl" : "max-w-5xl") : "max-w-6xl"}`}
      >
        <header>
          <h1 className="site-page-title">
            My Surprises
          </h1>
          <p className="site-supporting mt-3 max-w-[65ch] text-muted-foreground">
            Your surprises are saved on this device.
          </p>
          <details className="text-sm text-muted-foreground">
            <summary className="flex min-h-12 cursor-pointer items-center">About saved surprises and backups</summary>
            <p className="max-w-[65ch]">Your work doesn’t sync automatically. Other browsers, website addresses, and the Android app have separate libraries. Clearing browser or app storage can remove your saved work. Choose Save a backup from a surprise’s More actions menu to keep an editable file, then use Restore a backup to bring it back as a new draft.</p>
          </details>
        </header>

        {resume && <Link className="mt-3 inline-flex min-h-12 items-center font-semibold text-primary underline" href={`/create/${resume.templateId}?creation=${resume.id}`}>Continue your surprise: {resume.title}</Link>}
        <div className="mt-3 flex flex-wrap gap-3"><Link className="inline-flex min-h-12 items-center underline" href="/viewer">Open a surprise</Link><Link className="inline-flex min-h-12 items-center underline" href="/viewer?purpose=backup">Restore a backup</Link></div>
        {creations.length > 0 && <>
        <div
          className="mt-5 flex gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]"
          role="group"
          aria-label="Filter My Surprises"
        >
          {TAB_OPTIONS.map((option) => {
            const active = tab === option.value;
            const count = tabCount(option.value);
            return (
              <button
                key={option.value}
                type="button"
                aria-pressed={active}
                onClick={() => setTab(option.value)}
                className={`flex min-h-12 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-sm font-semibold transition ${active ? "border-primary bg-primary text-primary-foreground shadow-warm" : "bg-card/80 text-muted-foreground hover:text-foreground"}`}
              >
                {option.label}
                <span
                  className={`type-meta rounded-full px-1.5 ${active ? "bg-white/20" : "bg-secondary"}`}
                >
                  {count}
                </span>
              </button>
            );
          })}
        </div>

        <div
          className={
            native
              ? "mt-3 flex flex-wrap gap-2"
              : "mt-3 grid gap-2 md:grid-cols-[minmax(12rem,1fr)_12rem_14rem] md:items-center"
          }
        >
          <div className="relative min-w-0 flex-[1_1_60%]">
            <Search
              className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground"
              aria-hidden="true"
            />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search by title or template"
              className="min-h-12 w-full rounded-xl border bg-card pl-9 pr-3 text-sm outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              aria-label="Search My Surprises"
            />
          </div>
          {native ? (
            <>
              <button
                type="button"
                onClick={() => setSortKey("updated")}
                aria-pressed={sortKey === "updated"}
                className={`min-h-12 shrink-0 rounded-xl border px-3 text-sm font-semibold transition ${sortKey === "updated" ? "border-primary bg-primary/10 text-primary" : "bg-card text-muted-foreground"}`}
              >
                Recent
              </button>
              <button
                type="button"
                onClick={() => setSortSheetOpen(true)}
                aria-label="Sort"
                className="grid min-h-12 min-w-12 shrink-0 place-items-center rounded-xl border bg-card text-foreground"
              >
                <ArrowUpDown className="h-4 w-4" aria-hidden="true" />
              </button>
              <SortSheet
                open={sortSheetOpen}
                onClose={() => setSortSheetOpen(false)}
                value={sortKey}
                onSelect={setSortKey}
              />
            </>
          ) : (
            <AdaptiveSelect
              label="Sort My Surprises"
              value={sortKey}
              onChange={(value) => setSortKey(value as CreationSortKey)}
              className="mt-0 min-h-12 w-full rounded-xl border bg-card px-3 text-sm"
              options={[
                { value: "updated", label: "Recently updated" },
                { value: "oldest", label: "Oldest first" },
                { value: "title", label: "Title" },
                { value: "template", label: "Template" },
              ]}
            />
          )}
          <AdaptiveSelect label="Filter by template" value={templateFilter} onChange={setTemplateFilter}
            className="mt-0 min-h-12 w-full rounded-xl border bg-card px-3 text-sm"
            options={[{ value: "all", label: "All templates" }, ...Object.entries(TEMPLATES).filter(([, template]) => template.isAvailable).map(([id, template]) => ({ value: id, label: template.name }))]} />
        </div>

        </>}
        {migrationFailures.length > 0 && (
          <section className="mt-4 space-y-3" aria-label="Legacy draft recovery">
            <InlineFieldMessage tone="warning" message="Some older drafts couldn’t be opened. Their original data is kept, and your other surprises are available." />
            {migrationFailures.map(failure => (
              <div key={failure.templateId} className="space-y-2">
                <details className="text-sm [overflow-wrap:anywhere]"><summary className="flex min-h-12 cursor-pointer items-center">Recovery details: {TEMPLATES[failure.templateId]?.name || failure.templateId}</summary><p>{failure.reason}</p><p className="mt-2 text-muted-foreground">If storage access was interrupted, retry below. Damaged or conflicting media may need your original files or a saved backup. Retrying keeps the original data.</p></details>
                <Button variant="outline" className="h-auto min-h-12 max-w-full whitespace-normal" disabled={Boolean(busyId)} onClick={() => void withBusy(`legacy:${failure.templateId}`, async () => {
                  try { await retryLegacyDraftMigration(failure.templateId); }
                  finally { await refresh(); }
                })}>{busyId === `legacy:${failure.templateId}` ? "Retrying…" : `Retry ${TEMPLATES[failure.templateId]?.name || failure.templateId} draft`}</Button>
              </div>
            ))}
          </section>
        )}
        {bulkResult && <div className="mt-4"><InlineFieldMessage tone="warning" message={bulkResult} /><Button variant="ghost" onClick={() => setBulkResult("")}>Dismiss results</Button></div>}
        {state === "ready" && recoveryItems.length > 0 && (
          <section className="mt-4 space-y-3" aria-labelledby="library-recovery-title">
            <h2 id="library-recovery-title" className="text-lg font-semibold">Needs recovery ({recoveryItems.length})</h2>
            <p className="text-sm text-muted-foreground">These saved items couldn’t be opened. Their remaining data is kept unchanged. You can retry or restore a saved backup as a new draft.</p>
            <ul className="space-y-3">
              {recoveryItems.map(creation => (
                <li key={creation.id} id={"creation-" + creation.id} tabIndex={-1} className="space-y-2 [overflow-wrap:anywhere]">
                  <p className="font-semibold">{creation.title}</p>
                  <p className="text-sm text-muted-foreground">{TEMPLATES[creation.templateId]?.name || creation.templateId} · {creation.recovery === "missing-draft" ? "Saved content is missing." : "Saved content could not be read safely."}</p>
                  <div className="flex flex-wrap gap-2">
                    <Button variant="outline" disabled={Boolean(busyId)} onClick={() => void withBusy(creation.id, refresh)}>Retry opening</Button>
                    <Button variant="outline" disabled={Boolean(busyId)} onClick={() => void withBusy(creation.id, async () => {
                      const file = await getCreationRecoveryDetails(creation.id);
                      if (isNativePlatform()) await saveOnNative(file);
                      else if (!downloadFile(file)) throw new Error("Recovery details could not be downloaded. Try again.");
                      setNotice("Recovery details saved. Your original stored data is unchanged.");
                    })}>Save recovery details</Button>
                  </div>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">Recovery details describe the problem; they are not a backup and do not contain messages or media.</p>
            <Button asChild variant="outline"><Link href="/viewer?purpose=backup">Restore a saved backup</Link></Button>
          </section>
        )}
        {error && (
          <div className="mt-4">
            <InlineFieldMessage message={error} />
          </div>
        )}

        {creations.length > 0 && <div className="mt-2 flex min-h-12 flex-wrap items-center gap-2">
          <Button variant="ghost" disabled={Boolean(busyId) || !creations.some(record => record.status === "draft" && !record.recovery)} onClick={() => { setSelecting(!selecting); setSelected(new Set()); }}>{selecting ? "Cancel selection" : "Select drafts"}</Button>
          {(query || templateFilter !== "all" || tab !== "all" || sortKey !== "updated") && <Button variant="ghost" onClick={() => { setQuery(""); setTemplateFilter("all"); setTab("all"); setSortKey("updated"); }}>Reset filters</Button>}
          {selecting && <>
            <Button variant="outline" onClick={() => { const drafts = visible.filter(record => record.status === "draft"); setSelected(new Set(drafts.map(record => record.id))); setNotice(`${drafts.length} drafts selected.`); }}>Select visible drafts</Button>
            <Button variant="destructive" disabled={!selected.size || Boolean(busyId)} onClick={() => void prepareBulkDelete()}>Delete selected ({selected.size})</Button>
            <p className="basis-full text-sm text-muted-foreground">Only Created drafts can be selected. Use a draft’s More actions menu to save an editable backup before deleting.</p>
          </>}
        </div>}
        <div className="mt-6">
          {state === "loading" && (
            <div
              className="grid min-h-40 place-items-center rounded-2xl border bg-card/70 text-muted-foreground"
              role="status"
            >
              <LoaderCircle className="h-6 w-6 animate-spin" />
              <span className="sr-only">Loading your surprises</span>
            </div>
          )}
          {state === "error" && (
            <div className="space-y-2"><InlineFieldMessage message="Your surprises couldn’t be loaded. Try again to see your saved work." /><Button variant="outline" onClick={() => void refresh()}>Try again</Button></div>
          )}
          {state === "ready" && creations.length === 0 && (
            <div className="grid min-h-40 place-items-center gap-3 rounded-2xl border bg-card/70 p-8 text-center">
              <Sparkles className="mx-auto h-6 w-6 text-primary" />
              <p className="text-muted-foreground">
                No surprises yet. Start from a template to create your first
                one.
              </p>
              <Button asChild className="mx-auto w-fit">
                <Link href="/templates">Create your first surprise</Link>
              </Button>
              <p className="max-w-sm text-sm text-muted-foreground">
                A photo, a few words, or a song is enough to begin.
              </p>
            </div>
          )}
          {state === "ready" && creations.length > 0 && tabbed.length === 0 && (
            <p className="rounded-2xl border bg-card/70 p-6 text-center text-muted-foreground">
              {recoveryItems.some(creation => matchesTab(creation, tab)) ? "No available surprises in this tab. Items that need recovery are listed above." : tab === "drafts"
                ? "No unfinished surprises."
                : tab === "completed"
                  ? "No completed surprises yet."
                  : "Nothing received yet. Open a surprise file someone sent you to add it here."}
            </p>
          )}
          {state === "ready" && tabbed.length > 0 && visible.length === 0 && (
            <p className="rounded-2xl border bg-card/70 p-6 text-center text-muted-foreground">
              No surprises match these filters. Try another search or reset the filters.
            </p>
          )}
          {state === "ready" && visible.length > 0 && (
            <ul
              className={`grid gap-3 ${extraWide ? "sm:grid-cols-2 xl:grid-cols-3" : "sm:grid-cols-2"}`}
            >
              {visible.map((creation) => {
                const busy = busyId === creation.id;
                const received = creation.status === "imported";
                const editableReceived = received && creation.accessMode !== "view-only";
                return (
                  <li
                    key={creation.id}
                    id={"creation-" + creation.id}
                    tabIndex={-1}
                    data-imported={highlightId === creation.id || undefined}
                    className="relative rounded-2xl border bg-card/80 p-4 shadow-[var(--shadow-soft)]"
                  >
                    {selecting && creation.status === "draft" && <label className="absolute left-2 top-2 z-10 grid min-h-12 min-w-12 place-items-center rounded-xl border bg-card text-sm shadow-sm"><input type="checkbox" checked={selected.has(creation.id)} onChange={event => setSelected(previous => { const next = new Set(previous); if (event.target.checked) next.add(creation.id); else next.delete(creation.id); return next; })} /><span className="sr-only">Select {creation.title}</span></label>}
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex min-w-0 items-center gap-3">
                        {(creation.thumbnail || TEMPLATE_CARD_ART[creation.templateId]) && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img
                            src={creation.thumbnail || TEMPLATE_CARD_ART[creation.templateId]}
                            alt=""
                            aria-hidden="true"
                            loading="lazy"
                            decoding="async"
                            className="h-12 w-12 shrink-0 rounded-xl border object-cover"
                          />
                        )}
                        <div className="min-w-0">
                          <p className="[overflow-wrap:anywhere] font-semibold">{creation.title}</p>
                          {creation.title === `Untitled ${TEMPLATES[creation.templateId]?.name}` && creation.recipientContext && <p className="text-sm [overflow-wrap:anywhere] text-muted-foreground">For {creation.recipientContext}</p>}
                          <p className="type-meta text-muted-foreground">
                            {TEMPLATES[creation.templateId]?.name || creation.templateId}
                            {" · "}
                            <StatusLabel status={creation.status} />
                          </p>
                        </div>
                      </div>
                      {received && (
                        <span
                          className={`type-meta shrink-0 font-medium ${editableReceived ? "text-primary" : "text-muted-foreground"}`}
                        >
                          {editableReceived ? "Editable" : "View only"}
                        </span>
                      )}
                    </div>
                    {received && !native && creation.originalSenderName && <p className="mt-2 text-xs [overflow-wrap:anywhere] text-muted-foreground">Received from {creation.originalSenderName}</p>}
                    {creation.source === "received-editable" && <p className="mt-2 text-xs text-muted-foreground">Editable copy of a received surprise{creation.originalSenderName ? ` from ${creation.originalSenderName}` : ""}. Original preserved.</p>}
                    {!native && (
                      <div className="mt-3 flex gap-1.5">
                        <Button
                          size="sm"
                          className="h-auto min-h-9 min-w-0 flex-1 whitespace-normal py-2"
                          disabled={busy}
                          onClick={() =>
                            received
                              ? void quickView(creation)
                              : openCreation(creation)
                          }
                        >
                          {creation.status === "draft" ? "Continue editing" : "View"}
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-auto min-w-12 self-stretch"
                          aria-label={`More actions for ${creation.title}`}
                          aria-haspopup={desktopMenu ? "menu" : "dialog"}
                          aria-expanded={moreFor?.id === creation.id}
                          onClick={event => { setMoreAnchor(event.currentTarget); setMoreFor(creation); }}
                        >
                          <MoreHorizontal className="h-4 w-4" />
                        </Button>
                      </div>
                    )}
                    {native ? (
                      <>
                        <p className="mt-2 text-xs text-muted-foreground">
                          {received
                            ? `Received${creation.originalSenderName ? ` from ${creation.originalSenderName}` : ""}`
                            : `Updated ${relativeDateLabel(creation.updatedAt)}`}
                        </p>
                        <div className="mt-3 flex gap-1.5">
                          <Button
                            size="sm"
                            className="h-auto min-h-12 min-w-0 flex-1 whitespace-normal py-2"
                            disabled={busy}
                            onClick={() =>
                              received
                                ? void quickView(creation)
                                : openCreation(creation)
                            }
                          >
                            {busy ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : received ? (
                              "Open"
                            ) : creation.status === "draft" ? (
                              "Continue editing"
                            ) : (
                              "Open"
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="h-auto min-w-12 self-stretch"
                            aria-label={`More actions for ${creation.title}`}
                            aria-haspopup="dialog"
                            aria-expanded={moreFor?.id === creation.id}
                            onClick={event => { setMoreAnchor(event.currentTarget); setMoreFor(creation); }}
                          >
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    ) : (
                      <>
                        <p className="mt-2 text-xs text-muted-foreground">
                          Updated {new Date(creation.updatedAt).toLocaleDateString()}
                        </p>
                        <p className="mt-2 hidden text-xs text-muted-foreground">
                          Updated {new Date(creation.updatedAt).toLocaleDateString()}
                          {creation.lastBackedUpAt &&
                            ` · Backed up ${new Date(creation.lastBackedUpAt).toLocaleDateString()}`}
                          {creation.lastExportedAt &&
                            ` · Exported ${new Date(creation.lastExportedAt).toLocaleDateString()}`}
                        </p>
                        <div className="mt-3 hidden flex-wrap gap-1.5">
                          <Button
                            size="sm"
                            onClick={() =>
                              received
                                ? void quickView(creation)
                                : openCreation(creation)
                            }
                          >
                            {creation.status === "completed" ? "View" : "Continue editing"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void quickView(creation)}
                            aria-label="Quick preview"
                          >
                            {busy ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <Eye className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleDuplicate(creation)}
                            aria-label="Duplicate"
                          >
                            <Copy className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleRename(creation)}
                            aria-label="Rename"
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          {creation.status === "completed" && (
                            <Button size="sm" variant="outline" disabled={busy}
                              onClick={() => void withBusy(creation.id, async () => { await recoverCreationAsDraft(creation.id); await refresh(); setNotice("Recovered as an editable draft."); })}>
                              Mark as draft
                            </Button>
                          )}
                          {creation.status !== "completed" && (
                            <Button
                              size="sm"
                              variant="outline"
                              disabled={busy}
                              onClick={() => void handleMarkCompleted(creation)}
                              aria-label="Mark completed"
                            >
                              <CheckCircle2 className="h-4 w-4" />
                            </Button>
                          )}
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleBackup(creation)}
                            aria-label="Back up as .tinysurprise"
                          >
                            {busy ? (
                              <LoaderCircle className="h-4 w-4 animate-spin" />
                            ) : (
                              <FileHeart className="h-4 w-4" />
                            )}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void handleShare(creation)}
                            aria-label="Send app copy"
                          >
                            <Share2 className="h-4 w-4" />
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            disabled={busy}
                            onClick={() => void prepareDelete(creation)}
                            aria-label="Delete"
                            className="text-destructive"
                          >
                            <Trash2 className="h-4 w-4" />
                          </Button>
                        </div>
                      </>
                    )}
                  </li>
                );
              })}
            </ul>
          )}
        </div>
      </main>
      <LibraryToast message={notice} onDismiss={dismissNotice} blocked={Boolean(pendingDelete || pendingBulk || moreFor || renaming || packageStage || duplicateBackup || quickPreview)} />
      <ProgressModal
        open={Boolean(packageStage)}
        title="Preparing your surprise"
        stage={packageStage?.text}
        progress={packageStage?.progress}
        keepOpenNotice
        onCancel={canCancelPackage ? cancelPackage : undefined}
      />
      <ConfirmationModal open={Boolean(pendingBulk)} title={`Delete ${pendingBulk?.length || 0} selected drafts?`}
        message={`Permanently delete these drafts and their saved photos, videos, and music:\n${pendingBulk?.map(({ record }) => record.title).join("\n") || ""}\n\nDrafts changed or completed since selection will be skipped. To keep a copy first, go back and choose More actions → Save a backup.`}
        confirmLabel="Delete selected drafts" cancelLabel="Keep drafts" onCancel={() => setPendingBulk(undefined)} onConfirm={confirmBulkDelete} />
      <ConfirmationModal
        open={Boolean(pendingDelete)}
        title="Delete this surprise?"
        message={`"${pendingDelete?.title}" and its saved photos, videos, and music will be permanently removed from this device. Downloaded copies are kept.`}
        confirmLabel="Delete surprise"
        onCancel={() => setPendingDelete(undefined)}
        onConfirm={() => void confirmDelete()}
      />
      <MoreActionsSheet
        anchored={!native && desktopMenu}
        anchor={moreAnchor}
        creation={moreFor}
        busy={Boolean(moreFor) && busyId === moreFor?.id}
        onClose={() => setMoreFor(undefined)}
        onRename={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          handleRename(creation);
        }}
        onDuplicate={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          void handleDuplicate(creation);
        }}
        onQuickPreview={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          void quickView(creation);
        }}
        onShare={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          void handleShare(creation);
        }}
        onBackup={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          void handleBackup(creation);
        }}
        onRecover={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          void withBusy(creation.id, async () => { await recoverCreationAsDraft(creation.id); await refresh(); setNotice("Recovered as an editable draft."); });
        }}
        onMarkCompleted={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          void handleMarkCompleted(creation);
        }}
        onSaveAndEdit={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          void saveAndEditReceived(creation);
        }}
        onDelete={() => {
          const creation = moreFor!;
          setMoreFor(undefined);
          void prepareDelete(creation);
        }}
      />
      <DuplicateConflictModal
        open={Boolean(duplicateBackup && duplicateBackupCopy)}
        title={duplicateBackupCopy?.title || ""}
        message={duplicateBackupCopy?.message || ""}
        actions={[
          {
            label:
              duplicateBackup?.classification.state === "SAME_ID_CHANGED_CONTENT"
                ? "Save new backup"
                : "Create another copy",
            variant: "default",
            onSelect: () => confirmDuplicateBackup(),
          },
        ]}
        onCancel={() => {
          setDuplicateBackup(undefined);
          setNotice("No new backup was saved.");
        }}
      />
      <RenameSheet
        creation={renaming}
        error={renameError}
        busy={Boolean(renaming) && busyId === renaming?.id}
        onCancel={() => setRenaming(undefined)}
        onConfirm={(title) => void confirmRename(title)}
      />
      {quickPreview && (
        <FullScreenPreview
          open={Boolean(quickPreview)}
          onClose={closeQuickPreview}
          data={quickPreview}
          presentationMode="recipient-viewer"
        >
          {getExperienceComponent(quickPreview)}
        </FullScreenPreview>
      )}
    </>
  );
}

function StatusLabel({ status }: { status: CreationRecord["status"] }) {
  if (status === "completed") return <span>Completed</span>;
  if (status === "imported") return <span>Received</span>;
  return <span>Draft</span>;
}

/**
 * Android's "More" overflow — replaces the row of unlabeled icon buttons
 * with a text-labeled action list, filtered to what's actually valid for
 * this item's status/access mode (Section X/W). Delete is visually
 * separated from the ordinary actions above it.
 */
function MoreActionsSheet({
  anchored,
  anchor,
  creation,
  busy,
  onClose,
  onRename,
  onDuplicate,
  onQuickPreview,
  onShare,
  onBackup,
  onMarkCompleted,
  onRecover,
  onSaveAndEdit,
  onDelete,
}: {
  anchored: boolean;
  anchor: HTMLButtonElement | null;
  creation?: CreationRecord;
  busy: boolean;
  onClose: () => void;
  onRename: () => void;
  onDuplicate: () => void;
  onQuickPreview: () => void;
  onShare: () => void;
  onBackup: () => void;
  onMarkCompleted: () => void;
  onRecover: () => void;
  onSaveAndEdit: () => void;
  onDelete: () => void;
}) {
  const reduceMotion = useReducedMotion();
  const open = Boolean(creation);
  const dialogRef = useRef<HTMLElement>(null);
  const closeRef = useRef(onClose);
  useEffect(() => { closeRef.current = onClose; }, [onClose]);
  const [position, setPosition] = useState({ top: 8, left: 8 });
  useModalBackHandler(open, onClose);
  useFocusTrap(open && !anchored, dialogRef, undefined, onClose);

  useLayoutEffect(() => {
    if (!open || !anchored || !anchor) return;
    const menu = dialogRef.current;
    if (!menu) return;
    let restore = true;
    const place = () => {
      const trigger = anchor.getBoundingClientRect();
      const gutter = 8;
      const width = menu.offsetWidth, height = menu.offsetHeight;
      const below = trigger.bottom + 6;
      const top = below + height <= window.innerHeight - gutter ? below : trigger.top - height - 6;
      setPosition({ top: Math.max(gutter, Math.min(top, window.innerHeight - height - gutter)), left: Math.max(gutter, Math.min(trigger.right - width, window.innerWidth - width - gutter)) });
    };
    const buttons = () => Array.from(menu.querySelectorAll<HTMLButtonElement>('button[role="menuitem"]:not([disabled])'));
    place(); buttons()[0]?.focus({ preventScroll: true });
    const outside = (event: PointerEvent) => { if (!menu.contains(event.target as Node) && !anchor.contains(event.target as Node)) closeRef.current(); };
    const keys = (event: KeyboardEvent) => {
      if (event.key === "Escape") { event.preventDefault(); event.stopPropagation(); closeRef.current(); }
      if (event.key === "Tab") {
        // Continue the browser's tab order from the card trigger, rather than
        // from a menu item that is about to disappear.
        restore = false;
        anchor.focus({ preventScroll: true });
        closeRef.current();
        return;
      }
      if (!["ArrowDown", "ArrowUp", "Home", "End"].includes(event.key)) return;
      event.preventDefault();
      const items = buttons(); if (!items.length) return;
      const index = items.indexOf(document.activeElement as HTMLButtonElement);
      const next = event.key === "Home" ? 0 : event.key === "End" ? items.length - 1 : (index + (event.key === "ArrowDown" ? 1 : -1) + items.length) % items.length;
      items[next]?.focus();
    };
    document.addEventListener("pointerdown", outside, true);
    document.addEventListener("keydown", keys, true);
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      document.removeEventListener("pointerdown", outside, true); document.removeEventListener("keydown", keys, true);
      window.removeEventListener("resize", place); window.removeEventListener("scroll", place, true);
      if (restore) requestAnimationFrame(() => { if (anchor.isConnected && (!document.activeElement || document.activeElement === document.body || menu.contains(document.activeElement))) anchor.focus({ preventScroll: true }); });
    };
  }, [open, anchored, anchor]);

  useEffect(() => {
    if (!open || anchored) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open, anchored]);

  if (!creation) return null;
  const received = creation.status === "imported";
  const editableReceived = received && creation.accessMode !== "view-only";

  const actions: { label: string; icon: typeof Pencil; onSelect: () => void }[] = received
    ? [
        ...(editableReceived
          ? [{ label: "Save a copy to edit", icon: Pencil, onSelect: onSaveAndEdit }]
          : []),
        { label: "Send app copy", icon: Share2, onSelect: onShare },
      ]
    : [
        { label: "Quick preview", icon: Eye, onSelect: onQuickPreview },
        { label: "Rename", icon: Pencil, onSelect: onRename },
        { label: "Duplicate", icon: Copy, onSelect: onDuplicate },
        ...(creation.status !== "completed"
          ? [{ label: "Mark completed", icon: CheckCircle2, onSelect: onMarkCompleted }]
          : []),
        ...(creation.status === "completed" ? [{ label: "Mark as draft", icon: Pencil, onSelect: onRecover }] : []),
        { label: "Save a backup", icon: FileHeart, onSelect: onBackup },
        { label: "Send app copy", icon: Share2, onSelect: onShare },
      ];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={anchored ? "contents" : "fixed inset-0 z-[105] flex items-end justify-center bg-black/55 backdrop-blur-sm"}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={anchored ? undefined : onClose}
        >
          <motion.section
            ref={dialogRef}
            role={anchored ? "menu" : "dialog"}
            aria-modal={anchored ? undefined : true}
            aria-label={`More actions for ${creation.title}`}
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: anchored ? -4 : "100%" }}
            animate={{ opacity: 1, y: 0 }}
            exit={reduceMotion || anchored ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            style={anchored ? position : undefined}
            className={anchored ? "fixed z-[105] max-h-[calc(100dvh-1rem)] w-64 max-w-[calc(100vw-1rem)] overflow-y-auto rounded-2xl border border-border bg-card p-2 shadow-[var(--shadow-soft)]" : "android-sheet-panel w-full max-w-md rounded-t-[1.75rem] border border-border/70 bg-card p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"}
            onClick={(event) => event.stopPropagation()}
          >
            {!anchored && <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />}
            {!anchored && <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="truncate text-sm font-bold">{creation.title}</h2>
              <button
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid min-h-12 min-w-12 shrink-0 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>}
            <p className="px-3 pb-2 text-xs text-muted-foreground">{creation.status !== "imported" || creation.accessMode !== "view-only" ? "Send app copy lets them make their own copy to edit. Your original stays unchanged." : "Send app copy lets them open and keep it in Tiny Surprise. Editing stays off."}</p>
            <ul role={anchored ? "none" : undefined} className="space-y-0.5 px-1">
              {actions.map((action) => (
                <li key={action.label} role={anchored ? "none" : undefined}>
                  <button
                    type="button"
                    role={anchored ? "menuitem" : undefined}
                    disabled={busy}
                    onClick={() => { if (anchored) anchor?.focus({ preventScroll: true }); action.onSelect(); }}
                    className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium hover:bg-secondary disabled:opacity-50"
                  >
                    <action.icon className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                    {action.label}
                  </button>
                </li>
              ))}
            </ul>
            <div className="mt-1 border-t px-1 pt-1">
              <button
                type="button"
                role={anchored ? "menuitem" : undefined}
                disabled={busy}
                onClick={() => { if (anchored) anchor?.focus({ preventScroll: true }); onDelete(); }}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium text-destructive hover:bg-destructive/10 disabled:opacity-50"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Delete
              </button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Shared rename dialog for web and Android — keeps the same accessible,
 * branded interaction everywhere instead of falling back to browser chrome.
 *
 * The draft text is fully local state, initialized once when the dialog
 * opens for a given creation and never touched again until Save/Cancel —
 * it previously lived in the parent (LibraryPage) and was passed down as
 * value/onValueChange, which meant every keystroke re-rendered the entire
 * page and re-ran this component's open effect (including a
 * select()-on-open call keyed on the parent's inline onCancel reference),
 * effectively re-selecting all text after every character typed.
 */
function RenameSheet({
  creation,
  onCancel,
  onConfirm,
  busy,
  error,
}: {
  creation?: CreationRecord;
  onCancel: () => void;
  onConfirm: (title: string) => void;
  busy: boolean;
  error: string;
}) {
  const inputRef = useRef<HTMLInputElement>(null);
  const dialogRef = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();
  const open = Boolean(creation);
  const [draft, setDraft] = useState("");
  useModalBackHandler(open, onCancel);
  useFocusTrap(open, dialogRef, inputRef);

  useEffect(() => {
    if (creation) setDraft(creation.title);
  }, [creation]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    requestAnimationFrame(() => inputRef.current?.select());
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onCancel();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onCancel]);

  const templateName = creation ? TEMPLATES[creation.templateId]?.name : undefined;
  const candidateTitle = creation && templateName && creation.recipientContext &&
    creation.title === `Untitled ${templateName}`
    ? `${templateName} for ${creation.recipientContext}`
    : "";
  const suggestedTitle = candidateTitle.length <= TEXT_LIMITS.libraryTitle ? candidateTitle : "";

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.16 }}
          onClick={() => !busy && onCancel()}
        >
          <motion.section
            ref={dialogRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="rename-title"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 18 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }
            }
            className="w-full max-w-md rounded-[var(--radius-dialog)] border bg-card p-6 text-card-foreground shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <h2 id="rename-title" className="text-xl font-semibold">
              Rename this surprise
            </h2>
            {suggestedTitle && (
              <button
                type="button"
                disabled={busy}
                onClick={() => setDraft(suggestedTitle)}
                className="mt-3 min-h-12 text-left text-sm text-primary underline [overflow-wrap:anywhere]"
              >
                Use suggested title: {suggestedTitle}
              </button>
            )}
            <Input
              ref={inputRef}
              type="text"
              value={draft}
              onChange={(event) => setDraft(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && draft.trim() && !busy)
                  onConfirm(draft);
              }}
              textBudget={TEXT_LIMITS.libraryTitle}
              disabled={busy}
              className="mt-4 min-h-12 w-full rounded-xl border bg-background px-3 text-base outline-none focus-visible:ring-4 focus-visible:ring-primary/20"
              aria-label="Surprise title"
            />
            {error && <p role="alert" className="mt-3 text-sm text-destructive">{error}</p>}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={onCancel}
              >
                Cancel
              </Button>
              <Button
                type="button"
                disabled={busy || !draft.trim()}
                onClick={() => onConfirm(draft)}
              >
                {busy ? "Saving…" : "Save"}
              </Button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
