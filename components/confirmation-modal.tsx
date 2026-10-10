"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, X } from "lucide-react";
import { Button } from "./ui/button";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { hapticTap } from "@/lib/native/haptics";
import { MOTION, MOTION_EASE } from "@/lib/motion";

interface ConfirmationModalProps {
  open: boolean;
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  aboveViewer?: boolean;
  onConfirm: () => void | Promise<void>;
  onCancel: () => void;
}

export function ConfirmationModal({
  open,
  title,
  message,
  confirmLabel = "Confirm",
  cancelLabel = "Keep editing",
  aboveViewer = false,
  onConfirm,
  onCancel,
}: ConfirmationModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const confirmingRef = useRef(false);
  const [confirming, setConfirming] = useState(false);
  const [failure, setFailure] = useState("");
  const reduceMotion = useReducedMotion();

  const cancelIfIdle = useCallback(() => {
    if (!confirmingRef.current) onCancel();
  }, [onCancel]);
  useRecipientOverlay({ open, containerRef: panelRef, initialRef: cancelButtonRef, onClose: cancelIfIdle });

  useEffect(() => {
    if (!open) return;
    setFailure("");
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const confirm = async () => {
    if (confirmingRef.current) return;
    void hapticTap("heavy");
    confirmingRef.current = true;
    setConfirming(true);
    setFailure("");
    try {
      await onConfirm();
    } catch (reason) {
      setFailure(reason instanceof Error ? reason.message : "This operation could not finish. Try again.");
    } finally {
      confirmingRef.current = false;
      setConfirming(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className={`recipient-dialog-overlay fixed inset-0 ${aboveViewer ? "z-[160]" : "z-[100]"} flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm`}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : MOTION.fast }}
          onClick={() => !confirming && onCancel()}
        >
          <motion.section
            ref={panelRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-busy={confirming}
            aria-labelledby="confirmation-title"
            aria-describedby="confirmation-message"
            initial={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.94, y: 18 }
            }
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={
              reduceMotion ? { opacity: 0 } : { opacity: 0, scale: 0.97, y: 8 }
            }
            transition={{ duration: reduceMotion ? 0 : MOTION.standard, ease: MOTION_EASE }}
            className="relative max-h-[calc(100dvh-2rem)] overflow-y-auto w-full max-w-md rounded-[var(--radius-dialog)] border bg-card p-6 text-card-foreground shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <button
              ref={cancelButtonRef}
              type="button"
              aria-label="Close confirmation"
              className="android-touch-target absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border bg-card transition hover:bg-muted"
              disabled={confirming}
              onClick={onCancel}
            >
              <X className="h-4 w-4" />
            </button>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
              <AlertTriangle aria-hidden="true" />
            </span>
            <h2 id="confirmation-title" className="mt-4 text-xl font-semibold">
              {title}
            </h2>
            <p
              id="confirmation-message"
              className="mt-2 whitespace-pre-wrap [overflow-wrap:anywhere] leading-7 text-muted-foreground"
            >
              {message}
            </p>
            {failure && <p role="alert" className="mt-3 text-sm text-destructive">{failure}</p>}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button
                type="button"
                variant="outline"
                disabled={confirming}
                onClick={onCancel}
              >
                {cancelLabel}
              </Button>
              <Button
                type="button"
                variant="destructive"
                disabled={confirming}
                onClick={() => void confirm()}
              >
                {confirming ? "Working…" : confirmLabel}
              </Button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
