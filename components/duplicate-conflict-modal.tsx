"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Copy, X } from "lucide-react";
import { Button } from "./ui/button";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { hapticTap } from "@/lib/native/haptics";
import { MOTION, MOTION_EASE } from "@/lib/motion";

export interface DuplicateConflictAction {
  label: string;
  onSelect: () => void | Promise<void>;
  /** "default" for the recommended/primary action, "outline" for secondary ones. */
  variant?: "default" | "outline";
}

interface DuplicateConflictModalProps {
  open: boolean;
  title: string;
  message: string;
  actions: DuplicateConflictAction[];
  onCancel: () => void;
  cancelLabel?: string;
}

/**
 * The one shared dialog for every backup/import duplicate conflict (Library
 * backup, builder "Back up", Import a draft, the built-in viewer's own
 * inline conflict copy uses the same wording source but stays a page, not a
 * dialog). Replaces window.confirm() call sites, which have no back-priority
 * handling and read as raw browser chrome inside the native shell. `title`/
 * `message` should come from lib/duplicate-classifier.ts's
 * describeDuplicateState so the wording matches across every screen; the
 * action set is passed in per call site since which actions are actually
 * available legitimately differs between backup and import contexts.
 */
export function DuplicateConflictModal({
  open,
  title,
  message,
  actions,
  onCancel,
  cancelLabel = "Cancel",
}: DuplicateConflictModalProps) {
  const cancelButtonRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const cancelRef = useRef(onCancel);
  cancelRef.current = onCancel;
  const busyRef = useRef(false);
  const [busyIndex, setBusyIndex] = useState<number>();
  const [failure, setFailure] = useState("");
  const reduceMotion = useReducedMotion();

  const cancelIfIdle = useCallback(() => {
    if (!busyRef.current) cancelRef.current();
  }, []);
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

  const runAction = async (action: DuplicateConflictAction, index: number) => {
    if (busyRef.current) return;
    void hapticTap();
    busyRef.current = true;
    setBusyIndex(index);
    setFailure("");
    try {
      await action.onSelect();
    } catch (reason) {
      setFailure(reason instanceof Error ? reason.message : "This operation could not finish. Try again.");
    } finally {
      busyRef.current = false;
      setBusyIndex(undefined);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : MOTION.fast }}
          onClick={cancelIfIdle}
        >
          <motion.section
            ref={panelRef}
            tabIndex={-1}
            role="alertdialog"
            aria-modal="true"
            aria-busy={busyIndex !== undefined}
            aria-labelledby="duplicate-conflict-title"
            aria-describedby="duplicate-conflict-message"
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
              aria-label="Close"
              className="android-touch-target absolute right-4 top-4 flex h-10 w-10 items-center justify-center rounded-full border bg-card transition hover:bg-muted"
              disabled={busyIndex !== undefined}
              onClick={cancelIfIdle}
            >
              <X className="h-4 w-4" />
            </button>
            <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Copy aria-hidden="true" />
            </span>
            <h2
              id="duplicate-conflict-title"
              className="mt-4 text-xl font-semibold"
            >
              {title}
            </h2>
            <p
              id="duplicate-conflict-message"
              className="mt-2 leading-7 text-muted-foreground"
            >
              {message}
            </p>
            {failure && <p role="alert" className="mt-3 text-sm text-destructive">{failure}</p>}
            <div className="mt-6 grid gap-2">
              {actions.map((action, index) => (
                <Button
                  key={action.label}
                  type="button"
                  variant={action.variant || "outline"}
                  className="h-auto min-h-12 whitespace-normal [overflow-wrap:anywhere]"
                  disabled={busyIndex !== undefined}
                  onClick={() => void runAction(action, index)}
                >
                  {busyIndex === index ? "Working…" : action.label}
                </Button>
              ))}
              <Button
                type="button"
                variant="ghost"
                disabled={busyIndex !== undefined}
                onClick={cancelIfIdle}
              >
                {cancelLabel}
              </Button>
            </div>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
