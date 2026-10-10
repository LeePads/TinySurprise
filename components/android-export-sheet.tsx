"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import {
  ArrowLeft,
  Check,
  Download,
  Eye,
  FileArchive,
  FileHeart,
  Image as ImageIcon,
  LoaderCircle,
  RefreshCw,
  Send,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { hapticTap } from "@/lib/native/haptics";
import { useFocusTrap } from "@/lib/use-focus-trap";
import type { PackageAccessMode } from "@/lib/export/tinysurprise-package";
import { formatBytes } from "@/lib/format-bytes";

interface AndroidExportSheetProps {
  open: boolean;
  onClose: () => void;
  fileName: string;
  filenameDraft: string;
  onFilenameDraftChange: (value: string) => void;
  fileBytes: number;
  templateName: string;
  requiresInternetForYoutube: boolean;
  coverPhotoAvailable: boolean;
  shareBusy: boolean;
  backupShareBusy: boolean;
  previewImageBusy: boolean;
  zipBusy: boolean;
  regenerateBusy: boolean;
  notice?: string;
  error?: string;
  onShareHtml: () => void;
  onShareBackup: (accessMode: PackageAccessMode) => void;
  onSaveToDevice: () => void;
  onSharePreviewImage: () => void;
  onOpenViewer: () => void;
  onDownloadZip: () => void;
  onShareCompatibleCopy: () => void;
  onRegenerate: () => void;
}

type Stage = "main" | "access-mode";

const mb = (bytes: number) => formatBytes(bytes, 2);

/**
 * Android's generation-complete screen — replaces SendInstructionsModal on
 * native. The primary action sends the browser copy. App sharing is a
 * secondary option that asks about editing permission. Every action reuses
 * the exact generation/share/save
 * functions already in export-summary.tsx (passed in as props); this
 * component is presentation only.
 */
export function AndroidExportSheet({
  open,
  onClose,
  fileName,
  filenameDraft,
  onFilenameDraftChange,
  fileBytes,
  templateName,
  requiresInternetForYoutube,
  coverPhotoAvailable,
  shareBusy,
  backupShareBusy,
  previewImageBusy,
  zipBusy,
  regenerateBusy,
  notice,
  error,
  onShareHtml,
  onShareBackup,
  onSaveToDevice,
  onSharePreviewImage,
  onOpenViewer,
  onDownloadZip,
  onShareCompatibleCopy,
  onRegenerate,
}: AndroidExportSheetProps) {
  const busyStatus = shareBusy
    ? "Opening sharing options…"
    : backupShareBusy
      ? "Preparing your surprise…"
      : previewImageBusy
        ? "Preparing cover photo…"
        : zipBusy
          ? "Preparing a ZIP copy…"
          : regenerateBusy
            ? "Recreating the surprise…"
            : "";
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const [moreOpen, setMoreOpen] = useState(false);
  const [stage, setStage] = useState<Stage>("main");
  const [accessMode, setAccessMode] = useState<PackageAccessMode>("view-only");
  const accessGroup = useId();
  const previousStage = useRef(stage);

  useEffect(() => {
    const changed = previousStage.current !== stage;
    previousStage.current = stage;
    if (!open || !changed) return;
    const frame = requestAnimationFrame(() => panelRef.current?.querySelector<HTMLElement>("h2")?.focus());
    return () => cancelAnimationFrame(frame);
  }, [open, stage]);

  const tap = (action: () => void) => () => {
    void hapticTap();
    action();
  };

  const close = () => {
    onClose();
    setStage("main");
    setMoreOpen(false);
    setAccessMode("view-only");
  };

  const handleTransientBack = () => {
    if (stage === "main") close();
    else setStage("main");
  };

  useModalBackHandler(open, handleTransientBack);
  useFocusTrap(open, panelRef, closeButtonRef, handleTransientBack);

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 100 || info.velocity.y > 500) close();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-end justify-center bg-black/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={close}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-labelledby="android-export-title"
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="android-sheet-panel max-h-[85dvh] w-full max-w-lg overflow-y-auto rounded-t-[1.75rem] border border-border/70 bg-card p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />

            {stage === "main" && (
              <>
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <h2 id="android-export-title" tabIndex={-1} className="text-xl font-semibold">
                      Your surprise is ready
                    </h2>
                    <p role="status" aria-live="polite" className="min-h-4 text-xs text-muted-foreground">
                      {busyStatus}
                    </p>
                  </div>
                  <button
                    ref={closeButtonRef}
                    type="button"
                    aria-label="Close"
                    onClick={close}
                    className="grid min-h-12 min-w-12 shrink-0 place-items-center rounded-full hover:bg-secondary"
                  >
                    <X className="h-4 w-4" />
                  </button>
                </div>

                <div className="mt-4 grid gap-2">
                  <Button
                    size="lg"
                    className="h-auto min-h-12 min-w-0 justify-start whitespace-normal py-2.5 text-left"
                    disabled={shareBusy}
                    onClick={tap(() => { onShareHtml(); close(); })}
                  >
                    <Send className="h-5 w-5 shrink-0" />
                    <span className="min-w-0 text-left">
                      <span className="flex items-center gap-1.5">
                        Send surprise
                      </span>
                      <span className="block text-xs font-normal opacity-80">
                        Opens in a browser without installing Tiny Surprise
                      </span>
                    </span>
                  </Button>
                  <Button
                    size="lg"
                    variant="outline"
                    className="h-auto min-h-12 min-w-0 justify-start whitespace-normal py-2.5 text-left"
                    onClick={tap(onSaveToDevice)}
                  >
                    <Download className="h-5 w-5 shrink-0" />
                    Save a copy to my phone
                  </Button>
                </div>
                <p className="mt-3 text-xs text-muted-foreground">Ask them to download the attachment, then open it in a browser. Opening files varies by phone and chat app.</p>
                {requiresInternetForYoutube && <p className="mt-2 flex gap-1.5 text-xs text-muted-foreground"><Wifi className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />YouTube and external song links need internet.</p>}

                <button
                  type="button"
                  onClick={() => setMoreOpen((value) => !value)}
                  aria-expanded={moreOpen}
                  className="mt-4 inline-flex min-h-12 items-center text-xs font-bold text-primary"
                >
                  {moreOpen ? "Hide more options" : "More options"}
                </button>
                {moreOpen && (
                  <div className="mt-2 grid gap-1.5">
                    <Button variant="outline" className="h-auto min-h-12 justify-start whitespace-normal" onClick={tap(() => { setAccessMode("view-only"); setStage("access-mode"); })}>
                      <FileHeart className="mr-2 h-4 w-4" />
                      Send an app copy (.tinysurprise)
                    </Button>
                    <div className="space-y-1.5 px-1 pb-1">
                      <label
                        htmlFor="android-export-filename"
                        className="text-xs font-bold text-muted-foreground"
                      >
                        File name
                      </label>
                      <Input
                        id="android-export-filename"
                        value={filenameDraft}
                        onChange={(event) =>
                          onFilenameDraftChange(event.target.value)
                        }
                      />
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={!coverPhotoAvailable || previewImageBusy}
                      onClick={tap(onSharePreviewImage)}
                      className="h-auto min-h-12 w-full justify-start whitespace-normal"
                    >
                      {previewImageBusy ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <ImageIcon className="mr-2 h-4 w-4" />
                      )}
                      Share cover photo
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={tap(onOpenViewer)}
                      className="h-auto min-h-12 w-full justify-start whitespace-normal"
                    >
                      <Eye className="mr-2 h-4 w-4" />
                      Open surprise
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={zipBusy}
                      onClick={tap(onShareCompatibleCopy)}
                      className="h-auto min-h-12 w-full justify-start whitespace-normal"
                    >
                      {zipBusy ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileArchive className="mr-2 h-4 w-4" />
                      )}
                       Send a ZIP copy
                    </Button>
                    <p className="px-1 text-[.7rem] text-muted-foreground">
                       If a chat blocks the file, send this copy. They must extract it, then open the .html file inside.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={zipBusy}
                      onClick={tap(onDownloadZip)}
                      className="h-auto min-h-12 w-full justify-start whitespace-normal"
                    >
                      {zipBusy ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <FileArchive className="mr-2 h-4 w-4" />
                      )}
                       Save a ZIP copy
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={regenerateBusy}
                      onClick={tap(onRegenerate)}
                      className="h-auto min-h-12 w-full justify-start whitespace-normal"
                    >
                      {regenerateBusy ? (
                        <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                      ) : (
                        <RefreshCw className="mr-2 h-4 w-4" />
                      )}
                       Create a new copy
                    </Button>
                  </div>
                )}

                <details className="mt-4 rounded-xl border bg-secondary/30 p-3 text-xs text-muted-foreground">
                  <summary className="flex min-h-12 cursor-pointer items-center font-semibold">File details</summary>
                  <p className="break-all font-semibold text-foreground">{fileName}</p>
                  <p className="mt-1">
                    {templateName} · {mb(fileBytes)}
                  </p>
                </details>

                {error && <div className="mt-3"><InlineFieldMessage message={error} /></div>}
                {notice && !error && (
                  <div className="mt-3">
                    <InlineFieldMessage tone="success" message={notice} />
                  </div>
                )}
              </>
            )}

            {stage === "access-mode" && (
              <>
                <SheetHeader
                  title="Can they make an editable copy?"
                  onBack={() => setStage("main")}
                  onClose={close}
                />
                <p className="mt-3 text-sm text-muted-foreground">They’ll need Tiny Surprise to open this app copy.</p>
                <div className="mt-4 grid gap-2" role="radiogroup" aria-label="Can they make an editable copy?">
                  <AccessModeOption
                    name={accessGroup}
                    value="view-only"
                    selected={accessMode === "view-only"}
                    onSelect={() => setAccessMode("view-only")}
                    title="No, just open and enjoy"
                    badge="Recommended"
                    description="They can open and keep it, but cannot change it."
                  />
                  <AccessModeOption
                    name={accessGroup}
                    value="editable"
                    selected={accessMode === "editable"}
                    onSelect={() => setAccessMode("editable")}
                    title="Yes, allow an editable copy"
                    description="They can make their own copy to edit. The received original stays unchanged."
                  />
                </div>
                <Button
                  size="lg"
                  className="mt-4 w-full"
                  disabled={backupShareBusy}
                  onClick={tap(() => {
                    onShareBackup(accessMode);
                    close();
                  })}
                >
                  {backupShareBusy ? (
                    <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />
                  ) : null}
                  Continue
                </Button>
              </>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function SheetHeader({
  title,
  onBack,
  onClose,
}: {
  title: string;
  onBack: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <button
        type="button"
        aria-label="Back"
        onClick={onBack}
        className="grid min-h-12 min-w-12 shrink-0 place-items-center rounded-full hover:bg-secondary"
      >
        <ArrowLeft className="h-4 w-4" />
      </button>
      <h2 id="android-export-title" tabIndex={-1} className="flex-1 text-center text-lg font-semibold">{title}</h2>
      <button
        type="button"
        aria-label="Close"
        onClick={onClose}
        className="grid min-h-12 min-w-12 shrink-0 place-items-center rounded-full hover:bg-secondary"
      >
        <X className="h-4 w-4" />
      </button>
    </div>
  );
}

function AccessModeOption({
  name,
  value,
  selected,
  onSelect,
  title,
  badge,
  description,
}: {
  name: string;
  value: PackageAccessMode;
  selected: boolean;
  onSelect: () => void;
  title: string;
  badge?: string;
  description: string;
}) {
  return (
    <label
      className={`flex min-h-14 w-full cursor-pointer items-start gap-3 rounded-2xl border p-3 text-left transition focus-within:ring-2 focus-within:ring-ring ${selected ? "border-primary bg-primary/[.06]" : "border-border/70 bg-card"}`}
    >
      <input type="radio" name={name} value={value} checked={selected} onChange={onSelect} className="sr-only" />
      <span
        className={`mt-0.5 grid h-5 w-5 shrink-0 place-items-center rounded-full border-2 ${selected ? "border-primary bg-primary text-primary-foreground" : "border-muted-foreground/40"}`}
        aria-hidden="true"
      >
        {selected && <Check className="h-3 w-3" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5 font-semibold">
          {title}
          {badge && (
            <span className="rounded-full bg-primary/10 px-1.5 py-0.5 text-[.6rem] font-bold uppercase tracking-wide text-primary">
              {badge}
            </span>
          )}
        </span>
        <span className="mt-0.5 block text-xs text-muted-foreground">
          {description}
        </span>
      </span>
    </label>
  );
}
