"use client";

import { useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./ui/button";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { hapticTap } from "@/lib/native/haptics";
import { formatBytes } from "@/lib/format-bytes";

export interface ImportErrorDetails {
  name?: string;
  bytes?: number;
  technical?: string;
}

interface ImportErrorDialogProps {
  open: boolean;
  busy?: boolean;
  title?: string;
  message: string;
  details?: ImportErrorDetails;
  remainingFiles?: number;
  onRetry?: () => void;
  onChooseAnother?: () => void;
  onClose: () => void;
}

/**
 * Replaces window.alert() for import/share failures (Section 2 of the
 * Android release-blocker pass) with the app's own dialog system: a
 * friendly title/message, Retry and Choose another file when the caller can
 * offer them, Close always, and the raw technical detail tucked under a
 * "File details" disclosure rather than shown up front. Android hardware
 * Back dismisses this before anything underneath (useModalBackHandler).
 */
export function ImportErrorDialog({
  open,
  busy = false,
  title = "We couldn't open this file",
  message,
  details,
  remainingFiles = 0,
  onRetry,
  onChooseAnother,
  onClose,
}: ImportErrorDialogProps) {
  const [detailsOpen, setDetailsOpen] = useState(false);
  const dialogRef = useRef<HTMLElement>(null);
  const overlayRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const reduceMotion = useReducedMotion();
  const dismissIfIdle = () => { if (!busy) onClose(); };
  useRecipientOverlay({ open, containerRef: overlayRef, initialRef: closeButtonRef, onClose: dismissIfIdle });

  const mb = (bytes: number) => formatBytes(bytes, 2);
  const displayName = details?.name?.split(/[\\/]/).pop()?.slice(0, 120);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={overlayRef}
          tabIndex={-1}
          className="fixed inset-0 z-[170] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.18 }}
          onClick={dismissIfIdle}
        >
          <motion.section
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-busy={busy}
            aria-labelledby="import-error-title"
            aria-describedby="import-error-message"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 14 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }
            }
            transition={{ duration: reduceMotion ? 0 : 0.18 }}
            className="relative max-h-[calc(100dvh-env(safe-area-inset-top)-env(safe-area-inset-bottom)-2rem)] w-full max-w-md overflow-y-auto rounded-[var(--radius-dialog)] border bg-card p-6 text-card-foreground shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={closeButtonRef}
              type="button"
              aria-label="Close"
              onClick={dismissIfIdle}
              disabled={busy}
              className="android-touch-target absolute right-4 top-4 grid h-10 w-10 place-items-center rounded-full border bg-card transition hover:bg-muted"
            >
              <X className="h-4 w-4" />
            </button>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle aria-hidden="true" />
            </span>
            <h2 id="import-error-title" className="mt-4 text-xl font-semibold">
              {title}
            </h2>
            {(displayName || remainingFiles > 0) && <p role="status" className="mt-2 break-words text-sm text-muted-foreground">
              {displayName && <>File: {displayName}. </>}
              {remainingFiles > 0 && `${remainingFiles} more ${remainingFiles === 1 ? "file is" : "files are"} waiting for review.`}
            </p>}
            <p
              id="import-error-message"
              aria-live="polite"
              aria-atomic="true"
              className="mt-2 leading-7 text-muted-foreground"
            >
              {message}
            </p>
            {busy && <p role="status" className="mt-3 text-sm text-muted-foreground">Working on this file…</p>}
            <div className="mt-6 grid gap-2">
              {onRetry && (
                <Button
                  type="button"
                  disabled={busy}
                  onClick={() => {
                    void hapticTap();
                    onRetry();
                  }}
                >
                  Retry
                </Button>
              )}
              {onChooseAnother && (
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => {
                    void hapticTap();
                    onChooseAnother();
                  }}
                >
                  Choose another file
                </Button>
              )}
              <Button type="button" variant="ghost" disabled={busy} onClick={dismissIfIdle}>
                Close
              </Button>
            </div>
            {details && (details.name || details.technical || typeof details.bytes === "number") && (
              <div className="mt-4">
                <button
                  type="button"
                  onClick={() => setDetailsOpen((value) => !value)}
                  aria-expanded={detailsOpen}
                  className="min-h-12 px-2 text-xs font-semibold text-muted-foreground underline-offset-2 hover:underline"
                >
                  {detailsOpen ? "Hide file details" : "File details"}
                </button>
                {detailsOpen && (
                  <dl className="mt-2 space-y-1.5 rounded-xl border bg-secondary/30 p-3 text-xs">
                    {details.name && (
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-muted-foreground">File</dt>
                        <dd className="min-w-0 truncate text-right font-medium">
                          {details.name}
                        </dd>
                      </div>
                    )}
                    {typeof details.bytes === "number" && (
                      <div className="flex justify-between gap-3">
                        <dt className="shrink-0 text-muted-foreground">Size</dt>
                        <dd className="text-right font-medium">{mb(details.bytes)}</dd>
                      </div>
                    )}
                    {details.technical && (
                      <div>
                        <dt className="text-muted-foreground">Details</dt>
                        <dd className="mt-0.5 break-words font-mono text-[.65rem] leading-4 text-foreground/80">
                          {details.technical}
                        </dd>
                      </div>
                    )}
                  </dl>
                )}
              </div>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
