"use client";

import { useCallback, useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { LoaderCircle } from "lucide-react";
import { MOTION, MOTION_EASE } from "@/lib/motion";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface ProgressModalProps {
  open: boolean;
  /** What's happening overall, e.g. "Creating your surprise". */
  title: string;
  /** The current step within that operation, e.g. "Preparing photos (2 of 5)". */
  stage?: string;
  /** Set when progress is measurable; omit for an indeterminate spinner. */
  progress?: { completed: number; total: number };
  /** Shown only while an operation must not be interrupted by leaving the app. */
  keepOpenNotice?: boolean;
  onCancel?: () => void;
}

/**
 * Blocking "please wait" overlay for slow export/backup/share operations.
 * Purely presentational — callers still own their own busy-state guards
 * against duplicate submissions; this only covers the perceived lag.
 */
export function ProgressModal({
  open,
  title,
  stage,
  progress,
  keepOpenNotice,
  onCancel,
}: ProgressModalProps) {
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLElement>(null);
  const cancelRef = useRef<HTMLButtonElement>(null);
  const consumeBack = useCallback(() => undefined, []);
  const handleEscape = useCallback(() => {
    if (onCancel) onCancel();
  }, [onCancel]);

  useFocusTrap(open, dialogRef, onCancel ? cancelRef : dialogRef, handleEscape);
  useModalBackHandler(open, onCancel ?? consumeBack);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const percent =
    progress && progress.total > 0
      ? Math.min(100, Math.round((progress.completed / progress.total) * 100))
      : undefined;

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[120] flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : MOTION.fast }}
        >
          <motion.section
            ref={dialogRef}
            role="alertdialog"
            aria-modal="true"
            aria-busy="true"
            tabIndex={-1}
            aria-labelledby="progress-modal-title"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.95, y: 12 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }
            }
            transition={{ duration: reduceMotion ? 0 : MOTION.standard, ease: MOTION_EASE }}
            className="relative w-full max-w-sm rounded-[var(--radius-dialog)] border bg-card p-6 text-center text-card-foreground shadow-2xl"
          >
            <span className="mx-auto grid h-12 w-12 place-items-center rounded-full bg-primary/10">
              <LoaderCircle
                className="h-6 w-6 animate-spin text-primary"
                aria-hidden="true"
              />
            </span>
            <h2
              id="progress-modal-title"
              className="mt-4 text-lg font-semibold"
            >
              {title}
            </h2>
            <p
              role="status"
              aria-live="polite"
              className="mt-1 min-h-5 text-sm text-muted-foreground"
            >
              {stage || "Working on it…"}
            </p>
            {percent !== undefined && (
              <div className="mt-4">
                <div className="h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-primary transition-[width] duration-300"
                    style={{ width: `${percent}%` }}
                  />
                </div>
                <p className="mt-1.5 text-xs font-bold tabular-nums text-muted-foreground">
                  {percent}%
                </p>
              </div>
            )}
            {keepOpenNotice && (
              <p className="mt-4 text-xs text-muted-foreground">
                Please keep Tiny Surprise open until this finishes.
              </p>
            )}
            {onCancel && (
              <button
                ref={cancelRef}
                type="button"
                onClick={onCancel}
                className="mt-5 min-h-12 w-full rounded-full border border-border/70 bg-card px-4 text-sm font-semibold text-foreground transition hover:bg-secondary/60"
              >
                Cancel
              </button>
            )}
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
