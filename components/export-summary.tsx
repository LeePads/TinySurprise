"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  CheckCircle2,
  Download,
  FileHeart,
  Gift,
  LoaderCircle,
  RefreshCw,
  Send,
  ShieldCheck,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { ConfirmationModal } from "./confirmation-modal";
import { SendInstructionsModal } from "./send-instructions-modal";
import { AndroidExportSheet } from "./android-export-sheet";
import { HtmlViewer } from "./html-viewer";
import { ProgressModal } from "./progress-modal";
import { DuplicateConflictModal } from "./duplicate-conflict-modal";
import { countPhotos } from "@/lib/export/image-conversion";
import { collectLocalAudio, collectUniqueLocalMediaRefs } from "@/lib/local-media";
import { builderFieldTarget, mediaFieldTarget, type ReviewSection } from "@/lib/builder-field-target";
import { AUDIO_COMPATIBILITY_NOTE } from "@/lib/music";
import { generateHtml } from "@/lib/export/html-generator";
import { MediaBudgetMeter } from "@/components/media-budget-meter";
import {
  createSurpriseFile,
  createSurpriseZip,
  shareSurpriseFile,
} from "@/lib/export/share";
import {
  defaultShortHtmlFilename,
  sanitizeUserHtmlFilename,
} from "@/lib/export/sanitize";
import { THEME_LABELS, TEMPLATES } from "@/lib/config";
import { isNativePlatform } from "@/lib/platform";
import {
  saveAndShareHtmlOnNative,
  saveAndShareOnNative,
  saveOnNative,
  NativeShareError,
} from "@/lib/export/native-share";
import { hapticTap } from "@/lib/native/haptics";
import {
  createTinySurprisePackageDetailed,
  TINYSURPRISE_PACKAGE_VERSION,
  DRAFT_BACKUP_VERSION,
  type PackageAccessMode,
} from "@/lib/export/tinysurprise-package";
import { HASH_VERSION } from "@/lib/export/content-hash";
import { PackageWorkerCancelledError } from "@/lib/export/package-worker-client";
import { downloadFile } from "@/lib/download-file";
import { yieldToPaint } from "@/lib/yield-to-paint";
import { classifyAgainstLibrary, recordBackupHash, touchLastExported } from "@/lib/creations";
import { describeDuplicateState } from "@/lib/duplicate-classifier";
import type { DuplicateClassification } from "@/lib/duplicate-classifier";
import {
  validateAppearance,
  validateBasics,
  validateContent,
  validateDelight,
  validateMusic,
} from "@/lib/validation";
import type { ContentLimitPolicy } from "@/lib/template-experience-definitions";
import type { ExportBudgetEstimate, ExportResult, ImageConversionProgress } from "@/lib/export/types";
import type { SurpriseData } from "@/lib/types";
import { formatBytes } from "@/lib/format-bytes";
import {
  findLargestContributor,
  formatLargestMedia,
} from "@/lib/export/summary-format";

type State = "idle" | "generating" | "success" | "error";
type CachedExport = ExportResult & {
  file: File;
  zip?: File;
  /** Base filename (no extension) the cached zip was built with — lets us tell it's stale after a rename. */
  zipBaseName?: string;
};
const mb = (n: number) => formatBytes(n, 2);

import { summarizePackage } from "@/lib/viewer-summary";
import { getAuthoringTextIssues } from "@/lib/text-limits";
import { fileOperationFailureMessage } from "@/lib/file-operation-error";

export function ExportSummary({
  data,
  onStartOver,
  onPreviewAgain,
  onEditText,
  onBeforeGenerate,
  creationId,
  exportBudget,
  validationPolicy,
  onReturnToBuilder,
  onOptimizeVideo,
}: {
  data: SurpriseData;
  onStartOver: () => void;
  onPreviewAgain?: () => void;
  onEditText?: (issue: { step: number; inputId?: string }) => void;
  onBeforeGenerate?: () => Promise<boolean>;
  creationId?: string;
  exportBudget: ExportBudgetEstimate;
  validationPolicy: ContentLimitPolicy;
  onReturnToBuilder?: () => void;
  onOptimizeVideo?: (mediaId?: string) => void;
}) {
  const textIssues = getAuthoringTextIssues(data);
  const readiness = useMemo(() => {
    const checks: { section: ReviewSection; errors: { field: string; message: string }[] }[] = [
      { section: "basics", errors: validateBasics(data.basics).errors },
      { section: "content", errors: validateContent(data.template, data.content, validationPolicy).errors },
      { section: "appearance", errors: validateAppearance(data.appearance).errors },
      { section: "delight", errors: validateDelight(data.delight).errors },
      { section: "music", errors: validateMusic(data.music).errors },
    ];
    return checks.flatMap(({ section, errors }) => errors.map(issue => ({ key: section + issue.field, message: issue.message, target: builderFieldTarget(data, section, issue.field) })));
  }, [data, validationPolicy]);
  const unavailableMedia = collectUniqueLocalMediaRefs(data).filter(({ media }) => media.unavailable || !media.previewUrl);
  const hasUploadedAudio = collectLocalAudio(data).length > 0;
  const estimate = exportBudget;
  const largest = findLargestContributor(estimate.contributors);
  const estimatedOverLimit = Math.max(0, estimate.predictedBytes - estimate.limitBytes);
  const estimateIsOverLimit = estimate.state === "over-limit" || estimatedOverLimit > 0;
  const [state, setState] = useState<State>("idle");
  const [result, setResult] = useState<CachedExport>();
  const sizeNeedsAttention = estimateIsOverLimit || estimate.state === "near-limit" || estimate.state === "unknown" ||
    (result?.bytes ?? estimate.conservativeBytes) >= estimate.limitBytes * 0.8;
  const [filenameDraft, setFilenameDraft] = useState("");
  const [showExportDetails, setShowExportDetails] = useState(false);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState<ImageConversionProgress>({
    completed: 0,
    total: countPhotos(data),
  });
  const [confirmStartOver, setConfirmStartOver] = useState(false);
  const [zipBusy, setZipBusy] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const [saveBusy, setSaveBusy] = useState(false);
  const fileActionInFlight = useRef(false);
  const [downloadNotice, setDownloadNotice] = useState("");
  const [sendGuideOpen, setSendGuideOpen] = useState(false);
  const closeSendGuide = useCallback(() => setSendGuideOpen(false), [setSendGuideOpen]);
  const [backupBusy, setBackupBusy] = useState(false);
  const [backupShareBusy, setBackupShareBusy] = useState(false);
  const [previewImageBusy, setPreviewImageBusy] = useState(false);
  const [viewerOpen, setViewerOpen] = useState(false);
  const closeViewer = useCallback(() => setViewerOpen(false), [setViewerOpen]);
  const [native, setNative] = useState(false);
  const generatedDataRef = useRef(data);
  const generationInFlight = useRef(false);
  // Synchronous double-tap guard. The busy *state* can't stop a second tap
  // that lands in the same tick, and the sheet closes immediately on the
  // first one, so its own disabled prop never gets a chance to apply.
  const packageInFlight = useRef(false);
  // Shared by backupDraft ("Save editable copy") and shareBackup ("Send Tiny
  // Surprise file") — both build a package the same way and are mutually
  // exclusive, so they drive one progress/cancel surface.
  const [backupStage, setBackupStage] = useState<{
    text: string;
    progress?: { completed: number; total: number };
  }>();
  const backupCancelFnRef = useRef<() => void>(undefined);
  const [canCancelBackup, setCanCancelBackup] = useState(false);
  const [backupCancelling, setBackupCancelling] = useState(false);

  useEffect(() => {
    setNative(isNativePlatform());
  }, []);
  useEffect(() => {
    if (!result || generatedDataRef.current === data) return;
    generatedDataRef.current = data;
    setResult(undefined);
    setState("idle");
  }, [data, result]);

  /**
   * "Send Tiny Surprise file" (Section S) — bakes the sender's chosen
   * access mode into the package before sharing, defaulting to view-only
   * (never remembered as "editable" between sends — the sheet always
   * starts back at view-only, see android-export-sheet.tsx's own state).
   */
  const shareBackup = async (accessMode: PackageAccessMode) => {
    if (packageInFlight.current) return;
    packageInFlight.current = true;
    setBackupShareBusy(true);
    setBackupCancelling(false);
    setBackupStage({ text: "Preparing photos and music" });
    setError("");
    setDownloadNotice("");
    // Let the progress modal actually reach the screen before the first
    // synchronous block (media reads → ZIP assembly → base64) begins.
    await yieldToPaint();
    try {
      const { file: packageFile, contentHash } = await createTinySurprisePackageDetailed(
        data,
        {
          sourceCreationId: creationId,
          accessMode,
          onCancelAvailable: (cancel) => {
            backupCancelFnRef.current = cancel;
            setCanCancelBackup(Boolean(cancel));
          },
          onProgress: (progress) =>
            setBackupStage({
              text:
                progress.stage === "hashing"
                  ? "Preparing photos and music"
                  : "Preparing your surprise",
              progress:
                progress.completed !== undefined && progress.total
                  ? { completed: progress.completed, total: progress.total }
                  : undefined,
            }),
        },
      );
      setCanCancelBackup(false);
      backupCancelFnRef.current = undefined;
      setBackupStage({ text: "Saving to your device" });
      const outcome = await saveAndShareOnNative(packageFile, data.basics.recipientName);
      setDownloadNotice(
        outcome === "shared"
          ? "Send options opened. Choose a chat or email app to send your surprise."
          : `Saved ${packageFile.name}. Sharing was cancelled, but the surprise is still on your device.`,
      );
      if (creationId)
        await recordBackupHash(
          creationId,
          contentHash,
          HASH_VERSION,
          TINYSURPRISE_PACKAGE_VERSION,
        ).catch(() => undefined);
    } catch (reason) {
      if (reason instanceof PackageWorkerCancelledError) {
        setDownloadNotice("Preparation cancelled.");
        return;
      }
      setError(fileOperationFailureMessage(reason, "The app copy couldn't be prepared or shared. Try again, or save the browser copy to your device."));
    } finally {
      packageInFlight.current = false;
      setBackupShareBusy(false);
      setBackupCancelling(false);
      setBackupStage(undefined);
      setCanCancelBackup(false);
      backupCancelFnRef.current = undefined;
    }
  };

  const coverPhoto = data.delight?.coverPhoto;
  const sharePreviewImage = async () => {
    if (!coverPhoto?.file || fileActionInFlight.current) return;
    fileActionInFlight.current = true;
    setPreviewImageBusy(true);
    setError("");
    await yieldToPaint();
    try {
      await saveAndShareOnNative(coverPhoto.file, data.basics.recipientName);
    } catch (reason) {
      setError(reason instanceof NativeShareError ? reason.message : "The cover photo couldn't be prepared or shared. Try again.");
    } finally {
      fileActionInFlight.current = false;
      setPreviewImageBusy(false);
    }
  };

  const [backupConflict, setBackupConflict] = useState<{
    classification: DuplicateClassification;
    file: File;
    contentHash: string;
  }>();
  const finishBackup = async (file: File, contentHash: string) => {
    if (isNativePlatform()) await saveOnNative(file);
    else if (!downloadFile(file)) throw new Error("The backup download could not start. Try again.");
    if (creationId)
      await recordBackupHash(
        creationId,
        contentHash,
        HASH_VERSION,
        DRAFT_BACKUP_VERSION,
      ).catch(() => undefined);
    setDownloadNotice(
      isNativePlatform() ? `Saved editable backup ${file.name}. Restore it with this version of Tiny Surprise or newer.` : `Download started for editable backup ${file.name}. Keep the completed file to restore your work.`,
    );
  };

  const backupDraft = async () => {
    if (packageInFlight.current) return;
    packageInFlight.current = true;
    setBackupBusy(true);
    setBackupCancelling(false);
    setBackupStage({ text: "Preparing photos and music" });
    setError("");
    await yieldToPaint();
    try {
      const { file: packageFile, contentHash } = await createTinySurprisePackageDetailed(
        data,
        {
          sourceCreationId: creationId,
          purpose: "draft-backup", step: 6,
          onCancelAvailable: (cancel) => {
            backupCancelFnRef.current = cancel;
            setCanCancelBackup(Boolean(cancel));
          },
          onProgress: (progress) =>
            setBackupStage({
              text:
                progress.stage === "hashing"
                  ? "Preparing photos and music"
                  : "Saving your file",
              progress:
                progress.completed !== undefined && progress.total
                  ? { completed: progress.completed, total: progress.total }
                  : undefined,
            }),
        },
      );
      const classification = await classifyAgainstLibrary(contentHash, creationId);
      if (
        classification.state === "NEW" ||
        classification.state === "INVALID_OR_UNVERIFIABLE"
      ) {
        await finishBackup(packageFile, contentHash);
      } else {
        setBackupConflict({ classification, file: packageFile, contentHash });
      }
    } catch (reason) {
      if (reason instanceof PackageWorkerCancelledError) {
        setDownloadNotice("Backup cancelled.");
        return;
      }
      setError(fileOperationFailureMessage(reason, "The editable backup couldn't be saved. Keep this page open and try again."));
    } finally {
      packageInFlight.current = false;
      setBackupBusy(false);
      setBackupCancelling(false);
      setBackupStage(undefined);
      setCanCancelBackup(false);
      backupCancelFnRef.current = undefined;
    }
  };

  const cancelBackup = useCallback(() => {
    if (!backupCancelFnRef.current || backupCancelling) return;
    setBackupCancelling(true);
    backupCancelFnRef.current();
  }, [backupCancelling]);

  const backupConflictCopy = backupConflict
    ? describeDuplicateState(
        "backup",
        backupConflict.classification.state,
        (backupConflict.classification.matchById ||
          backupConflict.classification.matchByContent)?.title,
      )
    : undefined;
  const confirmBackupConflict = async () => {
    if (!backupConflict) return;
    try {
      await finishBackup(backupConflict.file, backupConflict.contentHash);
    } catch {
      setError("The editable backup couldn't be saved. Try again.");
    } finally {
      setBackupConflict(undefined);
    }
  };
  const backupConflictActions = backupConflict
    ? [
        {
          label:
            backupConflict.classification.state === "SAME_ID_CHANGED_CONTENT"
              ? "Save new backup"
              : "Create another copy",
          variant: "default" as const,
          onSelect: confirmBackupConflict,
        },
      ]
    : [];

  const generate = async () => {
    if (generationInFlight.current) return;
    generationInFlight.current = true;
    setState("generating");
    setError("");
    setDownloadNotice("");
    setProgress({ completed: 0, total: countPhotos(data) });
    try {
      if (onBeforeGenerate && !(await onBeforeGenerate()))
        throw new Error(
          "Your latest changes could not be saved. Keep this tab open and try again before preparing the surprise.",
        );
      const checks = [
        validateBasics(data.basics),
        validateContent(data.template, data.content, validationPolicy),
        validateAppearance(data.appearance),
        validateDelight(data.delight),
        validateMusic(data.music),
      ];
      const failures = checks.flatMap((check) => check.errors);
      if (failures.length)
        throw new Error(
          `${failures.length} required ${failures.length === 1 ? "detail is" : "details are"} incomplete: ${failures.map((item) => item.message).join(" ")}`,
        );
      const output = await generateHtml(data, setProgress);
      const file = createSurpriseFile(output.blob, output.filename);
      generatedDataRef.current = data;
      setResult({ ...output, file });
      setFilenameDraft(defaultShortHtmlFilename(data.basics.recipientName));
      setState("success");
      setSendGuideOpen(isNativePlatform());
      void hapticTap("medium");
      if (creationId) await touchLastExported(creationId).catch(() => undefined);
    } catch (reason) {
      setError(
        reason instanceof Error
          ? reason.message
          : "We couldn't finish your surprise. Your work is still here, so you can try again.",
      );
      setState("error");
    } finally {
      generationInFlight.current = false;
    }
  };
  // Reflects filenameDraft onto result.file without re-generating anything —
  // File.name is read-only, so this builds a new File over the same bytes.
  const namedHtmlFile = useMemo(() => {
    if (!result) return undefined;
    const name = sanitizeUserHtmlFilename(filenameDraft, result.file.name);
    return name === result.file.name
      ? result.file
      : new File([result.file], name, { type: result.file.type });
  }, [result, filenameDraft]);
  const download = (file: File): boolean => {
    if (downloadFile(file)) return true;
    setError(
      "The download couldn't start. Try again and check that your browser allows downloads. Your prepared surprise is still here.",
    );
    return false;
  };
  const downloadHtml = async () => {
    if (!result || !namedHtmlFile || fileActionInFlight.current) return;
    fileActionInFlight.current = true;
    setError("");
    setDownloadNotice("");
    if (isNativePlatform()) {
      setSaveBusy(true);
      try {
        await saveOnNative(namedHtmlFile);
        setDownloadNotice(
          `Saved ${namedHtmlFile.name} to your device's Tiny Surprise folder.`,
        );
      } catch (reason) {
        setError(reason instanceof NativeShareError ? reason.message : "The file could not be saved on this device. Check available storage and try again; your prepared surprise is still here.");
      } finally {
        fileActionInFlight.current = false;
        setSaveBusy(false);
      }
      return;
    }
    if (download(namedHtmlFile))
      setDownloadNotice(
        `Download started for ${namedHtmlFile.name}. Wait for it to finish before attaching or opening it.`,
      );
    fileActionInFlight.current = false;
  };
  const zipBaseName = namedHtmlFile?.name.replace(/\.html?$/i, "");
  const downloadZip = async () => {
    if (!result || !namedHtmlFile || fileActionInFlight.current) return;
    fileActionInFlight.current = true;
    setZipBusy(true);
    setError("");
    setDownloadNotice("");
    try {
      const zip =
        result.zip && result.zipBaseName === zipBaseName
          ? result.zip
          : await createSurpriseZip(
              namedHtmlFile,
              data.basics.recipientName,
              zipBaseName,
            );
      if (!result.zip || result.zipBaseName !== zipBaseName)
        setResult({ ...result, zip, zipBaseName });
      if (isNativePlatform()) {
        await saveOnNative(zip);
        setDownloadNotice(
          `Saved ${zip.name} to your device's Tiny Surprise folder.`,
        );
      } else if (download(zip))
        setDownloadNotice(
          `A ZIP copy is downloading as ${zip.name}. Wait for it to finish before opening or sending it.`,
        );
    } catch (reason) {
      setError(reason instanceof NativeShareError ? reason.message : "The ZIP copy couldn't be saved. Try again, or save the browser copy instead.");
    } finally {
      fileActionInFlight.current = false;
      setZipBusy(false);
    }
  };
  /**
   * "Share compatible HTML copy" (More options) — some chat apps that
   * happily accept a .tinysurprise file reject a bare .html attachment.
   * Reuses the existing ZIP-wrapped export (same bytes as the "Compatible
   * ZIP transport copy") but through the Sharesheet instead of saving to disk, so
   * it lands in the same chat the creator is already sending from.
   */
  const shareCompatibleCopy = async () => {
    if (!result || !namedHtmlFile || fileActionInFlight.current) return;
    fileActionInFlight.current = true;
    setZipBusy(true);
    setError("");
    setDownloadNotice("");
    try {
      const zip =
        result.zip && result.zipBaseName === zipBaseName
          ? result.zip
          : await createSurpriseZip(
              namedHtmlFile,
              data.basics.recipientName,
              zipBaseName,
            );
      if (!result.zip || result.zipBaseName !== zipBaseName)
        setResult({ ...result, zip, zipBaseName });
      const outcome = await saveAndShareOnNative(zip, data.basics.recipientName);
      setDownloadNotice(
        outcome === "shared"
          ? "Send options opened. Choose a chat or email app to send the ZIP copy."
          : `Saved ${zip.name}. Sharing was cancelled, but the file is still on your device.`,
      );
    } catch (reason) {
      setError(reason instanceof NativeShareError ? reason.message : "The ZIP copy couldn't be prepared or shared. Save the browser copy to your device and attach it to a chat or email.");
    } finally {
      fileActionInFlight.current = false;
      setZipBusy(false);
    }
  };
  const shareHtml = async () => {
    if (!result || !namedHtmlFile || fileActionInFlight.current) return;
    fileActionInFlight.current = true;
    setShareBusy(true);
    setError("");
    setDownloadNotice("");
    try {
      if (isNativePlatform()) {
        const outcome = await saveAndShareHtmlOnNative(
          namedHtmlFile,
          data.basics.recipientName,
        );
        setDownloadNotice(
          outcome === "shared"
            ? "Send options opened. Choose a chat or email app to send your surprise."
            : `Saved ${namedHtmlFile.name}. Sharing was cancelled, but the file is still on your device.`,
        );
        return;
      }
      const outcome = await shareSurpriseFile(
        namedHtmlFile,
        data.basics.recipientName,
      );
      setDownloadNotice(
        outcome === "cancelled"
          ? "Sharing cancelled. Your surprise is still ready to download."
          : "Send options opened. Choose a chat or email app to send your surprise.",
      );
    } catch (reason) {
      setError(reason instanceof NativeShareError ? reason.message : "Sharing couldn't open. Download the surprise and attach it to a chat or email.");
    } finally {
      fileActionInFlight.current = false;
      setShareBusy(false);
    }
  };
  const musicContent = data.content as {
    songUrl?: string;
    youtubeUrl?: string;
    songFile?: { name: string };
    musicFile?: { name: string };
  };
  const uploadedMusic =
    data.music?.file || musicContent.songFile || musicContent.musicFile;
  const localAudio = collectLocalAudio(data)[0];
  const music = Boolean(
    data.music?.youtubeUrl ||
      musicContent.youtubeUrl ||
      musicContent.songUrl ||
      uploadedMusic ||
      localAudio,
  );
  const stage =
    progress.total && progress.completed < progress.total
      ? "Preparing photos and music"
      : progress.total
        ? "Preparing your surprise"
        : "Preparing your surprise";

  const progressModal =
    saveBusy
      ? { title: "Saving your surprise", stage: "Saving the browser copy to your device" }
      : state === "generating"
      ? {
          title: "Preparing your surprise",
          stage,
          progress: progress.total ? progress : undefined,
        }
      : backupBusy
        ? {
            title: backupCancelling ? "Cancelling…" : "Creating backup",
            stage: backupStage?.text || "Preparing photos and music",
            progress: backupStage?.progress,
          }
        : backupShareBusy
          ? {
              title: backupCancelling ? "Cancelling…" : "Preparing your surprise",
              stage: backupStage?.text || "Preparing photos and music",
              progress: backupStage?.progress,
            }
          : shareBusy
            ? { title: "Getting ready to send", stage: "Preparing your surprise and opening sharing options" }
            : zipBusy
              ? { title: "Preparing a ZIP copy", stage: "Putting your surprise in a ZIP file" }
              : previewImageBusy
                ? { title: "Getting ready to share", stage: "Preparing the preview image" }
                : undefined;
  const progressModalCancel =
    (backupBusy || backupShareBusy) && canCancelBackup && !backupCancelling
      ? cancelBackup
      : undefined;

  const musicSummary = uploadedMusic
    ? uploadedMusic.name
    : localAudio
      ? localAudio.name
    : music
      ? "YouTube"
      : "None";

  return (
    <div className="builder-export-summary space-y-6">
      {(readiness.length > 0 || unavailableMedia.length > 0) && <section className="space-y-3 rounded-2xl border border-border bg-card p-4" aria-label="Export readiness">
        <h2 className="font-semibold">Finish these details before sending</h2>
        <ul className="space-y-3 text-sm">
          {readiness.map(issue => <li key={issue.key}><p>{issue.message}</p>{onEditText && <Button variant="link" onClick={() => onEditText(issue.target)}>Go to this field</Button>}</li>)}
          {unavailableMedia.map(({ media }) => <li key={media.id}><p>{media.name || "Uploaded media"} is unavailable. Choose it again or remove it.</p>{onEditText && <Button variant="link" onClick={() => onEditText(mediaFieldTarget(data, media.id))}>Review this media</Button>}</li>)}
        </ul>
      </section>}
      {hasUploadedAudio && <p className="text-sm text-muted-foreground">{AUDIO_COMPATIBILITY_NOTE}</p>}
      {estimate.contributors.length > 0 && (sizeNeedsAttention ? (
        <MediaBudgetMeter estimate={estimate} actualBytes={state === "success" ? result?.bytes : undefined} />
      ) : (
        <details>
          <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-muted-foreground">Surprise size</summary>
          <MediaBudgetMeter estimate={estimate} actualBytes={state === "success" ? result?.bytes : undefined} />
        </details>
      ))}
      {native ? (
        state !== "success" && (
          <div className="rounded-2xl border bg-card/80 p-4">
            <h2 className="text-xl font-semibold">Ready for {data.basics.recipientName || "them"}?</h2>
            <p className="mt-1 text-sm text-muted-foreground">{readiness.length || unavailableMedia.length ? "Review the details above before sending." : "Prepare your surprise, then choose where to send it."}</p>
            <dl className="mt-3 space-y-2 text-sm">
              <CompactRow label="Recipient" value={data.basics.recipientName || "Not set"} />
              <CompactRow label="Photos" value={String(countPhotos(data))} />
              <CompactRow label="Music" value={musicSummary} />
            </dl>
            <p className="mt-3 text-xs text-muted-foreground">
              Stays on your device.
            </p>
            <Button size="lg" className="mt-4 w-full" disabled={state === "generating"} onClick={() => void generate()}>
              {state === "generating" ? <LoaderCircle className="mr-2 animate-spin" /> : <Gift className="mr-2" />}
              {state === "generating" ? "Preparing your surprise…" : state === "error" ? "Try again" : "Prepare to send"}
            </Button>
          </div>
        )
      ) : (
        <>
          <div className="flex gap-4">
            <FileHeart className="h-7 w-7 shrink-0 text-primary" />
            <div>
              <h2 className="builder-step-title">
                Review your surprise.
              </h2>
              <p className="text-muted-foreground">
                Send it when you&apos;re ready.
              </p>
            </div>
          </div>
          <button
            type="button"
            className="min-h-12 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground"
            aria-expanded={showExportDetails}
            aria-controls="export-file-details"
            onClick={() => setShowExportDetails((value) => !value)}
          >
            {showExportDetails ? "Hide details" : state === "success" ? "File details" : "Review details"}
          </button>
          {showExportDetails && (
          <div id="export-file-details" className="space-y-3">
          <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-3">
            <Summary
              label="Recipient"
              value={data.basics.recipientName || "Not set"}
            />
            <Summary label="Template" value={TEMPLATES[data.template].name} />
            <Summary label="Theme" value={THEME_LABELS[data.appearance.theme]} />
            <Summary label="Photo count" value={String(countPhotos(data))} />
            <Summary
              label="Original photos and media"
              value={mb(estimate.sourceBytes)}
            />
            <Summary
              label="Estimated surprise size"
              value={mb(estimate.estimatedBytes)}
            />
            <Summary
              label="Music"
              value={
                uploadedMusic
                  ? `Uploaded · ${uploadedMusic.name}`
                  : music
                    ? "YouTube · recipient chooses"
                    : "None"
              }
            />
            {state === "success" && result && (
              <Summary label="Ready-to-send file size" value={mb(result.bytes)} />
            )}
            {(state === "success" && result?.mediaContributions.length ? result.mediaContributions : estimate.contributors).length > 0 && (
              <Summary
                label="Largest media"
                value={formatLargestMedia(state === "success" && result ? result.mediaContributions : estimate.contributors)}
              />
            )}
          </dl>
          {state === "success" && result && <p className="text-xs text-muted-foreground [overflow-wrap:anywhere]">
            Prepared file: {namedHtmlFile?.name || result.file.name}. This is the
            browser copy for viewing. To change it, edit your saved surprise and prepare a new file.
          </p>}
          </div>
          )}
          <div className="flex gap-3 rounded-2xl border border-border/70 bg-card/70 p-4 text-sm">
            <ShieldCheck className="h-5 w-5 shrink-0 text-primary" />
            <p>
              <strong>Private by default.</strong> Your surprise stays on this
              device unless you choose to send or back it up.
            </p>
          </div>
        </>
      )}
      {estimateIsOverLimit && (
        <section className="space-y-3 rounded-2xl border border-destructive/35 bg-destructive/5 p-4" aria-label="Export size recovery">
          <div>
            <h2 className="font-semibold">This surprise is a little too large</h2>
            <p className="mt-1 text-sm text-muted-foreground">
              {mb(estimate.predictedBytes)} · {mb(estimatedOverLimit)} over the limit
            </p>
          </div>
          <p className="text-sm text-foreground">
            {largest?.kind === "video"
              ? "Your video is the biggest item. Making it smaller should help."
              : largest
                ? `${largest.label} is the biggest item. Replacing it with a smaller file should help.`
                : "A smaller media file should help bring this surprise under the sharing limit."}
          </p>
          <div className="flex flex-col gap-2 sm:flex-row">
            {largest?.kind === "video" && (onOptimizeVideo || onReturnToBuilder) ? (
              <Button type="button" className="min-h-12" onClick={() => onOptimizeVideo ? onOptimizeVideo(largest.mediaId) : onReturnToBuilder?.()}>
                Make video smaller
              </Button>
            ) : (
              <Button type="button" className="min-h-12" onClick={onReturnToBuilder}>
                Go back
              </Button>
            )}
            {onReturnToBuilder && largest?.kind === "video" && (
              <Button type="button" variant="outline" className="min-h-12" onClick={onReturnToBuilder}>
                Go back
              </Button>
            )}
          </div>
          <details className="rounded-xl border border-border/60 bg-card/50 px-3 py-2">
            <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">Details</summary>
            <dl className="mt-3 grid gap-2 text-xs text-muted-foreground sm:grid-cols-2">
              <div><dt>Source media</dt><dd className="font-semibold text-foreground">{mb(estimate.originalBytes)}</dd></div>
              <div><dt>Estimated recipient copy</dt><dd className="font-semibold text-foreground">{mb(estimate.predictedBytes)}</dd></div>
              <div><dt>Largest item</dt><dd className="font-semibold text-foreground">{largest ? `${largest.label} · ${mb(largest.embeddedBytes)}` : "None"}</dd></div>
              <div><dt>Limit</dt><dd className="font-semibold text-foreground">{mb(estimate.limitBytes)}</dd></div>
            </dl>
          </details>
        </section>
      )}
      {/* estimate notice */}
      <p
        role="status"
        aria-live="polite"
        className="min-h-5 text-sm text-muted-foreground"
      >
        {state === "generating" ? stage : ""}
      </p>
      <p className="text-sm text-muted-foreground">Photos and uploaded media are included. YouTube and external song links need internet. They can open the surprise in a browser without installing Tiny Surprise.</p>
      {textIssues.length > 0 && <section className="space-y-2 rounded-xl border p-4" aria-label="Text review"><h3 className="font-semibold">Review your text</h3><ul className="space-y-2">{textIssues.map((issue) => <li key={issue.field} className="text-sm"><p>{issue.message}</p>{issue.inputId && onEditText && <Button variant="link" onClick={() => onEditText(issue)}>Edit {issue.field.toLowerCase()}</Button>}</li>)}</ul></section>}
      {error && <InlineFieldMessage message={error} />} {/* generation error */}
      {state === "success" && result ? (
        native ? (
          <section className="space-y-3 rounded-2xl border border-primary/25 bg-primary/10 p-4">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
              <h3 className="font-semibold">Your surprise is ready</h3>
            </div>
            <Button className="w-full" onClick={() => setSendGuideOpen(true)}>
              <Send className="mr-2 h-4 w-4" />
              Send surprise
            </Button>
            {downloadNotice && (
              <InlineFieldMessage tone="success" message={downloadNotice} />
            )}
          </section>
        ) : (
          <section className="space-y-5 rounded-2xl border border-primary/25 bg-primary/10 p-4 sm:p-5">
            <div className="flex items-center gap-3">
              <CheckCircle2 className="h-6 w-6 shrink-0 text-primary" />
              <div>
                <h3 className="font-semibold">
                  Your surprise is ready to send.
                </h3>
                <p className="text-sm text-muted-foreground">
                  Download the HTML file, then attach it to a chat or email.
                </p>
              </div>
            </div>
            <div className="grid gap-2">
              <Button
                size="lg"
                className="h-auto min-h-12 whitespace-normal py-3 text-center leading-5"
                disabled={zipBusy}
                onClick={() => void downloadHtml()}
              >
                <Download className="h-5 w-5" />
                Download surprise
              </Button>
            </div>
            <Button
              type="button"
              variant="ghost"
              className="h-auto min-h-12 whitespace-normal"
              onClick={() => setSendGuideOpen(true)}
            >
              How to send it
            </Button>
            {downloadNotice && (
              <InlineFieldMessage tone="success" message={downloadNotice} />
            )}
          </section>
        )
      ) : !native ? (
        <Button
          size="lg"
          className="w-full sm:w-auto"
          disabled={state === "generating"}
          onClick={() => void generate()}
        >
          {state === "generating" ? (
            <LoaderCircle className="mr-2 animate-spin" />
          ) : (
            <Gift className="mr-2" />
          )}
          {state === "generating"
            ? "Preparing your surprise…"
            : state === "error"
              ? "Try again"
              : "Prepare to send"}
        </Button>
      ) : null}
      {!native && (
        <details className="space-y-2">
          <summary className="min-h-12 cursor-pointer list-none py-3 text-sm font-semibold text-muted-foreground underline decoration-border underline-offset-4 hover:text-foreground">
            Keep a backup for editing later
          </summary>
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            disabled={backupBusy}
            onClick={() => void backupDraft()}
          >
            {backupBusy ? (
              <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <FileHeart className="mr-2 h-4 w-4" />
            )}
            Save a backup
          </Button>
          <p className="text-xs text-muted-foreground">
            Restores this surprise as a new draft, including unfinished work. Keep the downloaded file or move it to another device, then choose Restore a backup in this version of Tiny Surprise or newer.
          </p>
        </details>
      )}
      <details><summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold text-muted-foreground">More options</summary>
      <div className="grid gap-3 sm:flex sm:flex-wrap">
        {!native && state === "success" && onPreviewAgain && (
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={onPreviewAgain}
          >
            Preview again
          </Button>
        )}
        {!native && state === "success" && (
          <Button
            className="w-full sm:w-auto"
            variant="outline"
            onClick={() => void generate()}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            Prepare file again
          </Button>
        )}
        <Button
          className="w-full sm:w-auto"
          variant="outline"
          disabled={state === "generating"}
          onClick={() => setConfirmStartOver(true)}
        >
          {state === "success" ? "Create another surprise" : "Start over"}
        </Button>
      </div>
      </details>
      <ProgressModal
        open={Boolean(progressModal)}
        title={progressModal?.title || ""}
        stage={progressModal?.stage}
        progress={progressModal?.progress}
        onCancel={progressModalCancel}
        keepOpenNotice={isNativePlatform()}
      />
      <ConfirmationModal
        open={confirmStartOver}
        title="Start a new surprise?"
        message="Your current builder inputs will be cleared when you return to the templates."
        confirmLabel="Start over"
        onCancel={() => setConfirmStartOver(false)}
        onConfirm={() => {
          setConfirmStartOver(false);
          onStartOver();
        }}
      />
      <DuplicateConflictModal
        open={Boolean(backupConflict && backupConflictCopy)}
        title={backupConflictCopy?.title || ""}
        message={backupConflictCopy?.message || ""}
        actions={backupConflictActions}
        onCancel={() => {
          setBackupConflict(undefined);
          setDownloadNotice("No new backup was saved.");
        }}
      />
      {result && (native ? (
        <AndroidExportSheet
          open={sendGuideOpen}
          onClose={closeSendGuide}
          fileName={namedHtmlFile?.name || result.file.name}
          filenameDraft={filenameDraft}
          onFilenameDraftChange={setFilenameDraft}
          fileBytes={result.bytes}
          templateName={TEMPLATES[data.template].name}
          requiresInternetForYoutube={summarizePackage(data).requiresInternetForExternalSongs}
          coverPhotoAvailable={Boolean(coverPhoto?.file)}
          shareBusy={shareBusy}
          backupShareBusy={backupShareBusy}
          previewImageBusy={previewImageBusy}
          zipBusy={zipBusy}
          regenerateBusy={state === "generating"}
          notice={downloadNotice}
          error={error}
          onShareHtml={() => void shareHtml()}
          onShareBackup={(accessMode) => void shareBackup(accessMode)}
          onSaveToDevice={() => void downloadHtml()}
          onSharePreviewImage={() => void sharePreviewImage()}
          onOpenViewer={() => setViewerOpen(true)}
          onDownloadZip={() => void downloadZip()}
          onShareCompatibleCopy={() => void shareCompatibleCopy()}
          onRegenerate={() => void generate()}
        />
      ) : (
        <SendInstructionsModal
          open={sendGuideOpen}
          fileName={namedHtmlFile?.name || result.file.name}
          zipBusy={zipBusy}
          notice={downloadNotice}
          error={error}
          onClose={closeSendGuide}
          onDownload={() => void downloadHtml()}
          onDownloadZip={() => void downloadZip()}
        />
      ))}
      {result && (
        <HtmlViewer
          open={viewerOpen}
          source={{ kind: "file", file: namedHtmlFile ?? result.file }}
          onClose={closeViewer}
        />
      )}
    </div>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="min-w-0 border-t border-border/60 py-3">
      <dt className="type-meta text-muted-foreground">{label}</dt>
      <dd className="mt-1 break-words text-sm font-semibold">{value}</dd>
    </div>
  );
}

/** One line per value (Android review summary) instead of one card per value — Section N: "Do not use one large card per value." */
function CompactRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3">
      <dt className="shrink-0 text-muted-foreground">{label}</dt>
      <dd className="min-w-0 truncate text-right font-semibold">{value}</dd>
    </div>
  );
}
