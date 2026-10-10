"use client";

import { useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import { Camera, FileText, Images, Link2, X } from "lucide-react";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { hapticTap } from "@/lib/native/haptics";
import { useFocusTrap } from "@/lib/use-focus-trap";

interface PhotoSourceSheetProps {
  open: boolean;
  onClose: () => void;
  onChoosePhoto: (file?: File) => void;
  onChooseFile: (file?: File) => void;
  onTakePhoto: (file?: File) => void;
  onAddFromLink: () => void;
}

/**
 * Android's "Add photo" action sheet (Phase: mobile-first image input) —
 * replaces the always-visible dashed upload box + inline URL field with one
 * compact entry point. "Choose from photos" and "Choose from files" both
 * ultimately trigger a native <input type="file"> (there is no web API to
 * force Android's system chooser to skip straight to a specific source
 * app), but request different Android picker affordances via `accept`/
 * `capture` so the OS still shows the right default tab where it can.
 */
export function PhotoSourceSheet({
  open,
  onClose,
  onChoosePhoto,
  onChooseFile,
  onTakePhoto,
  onAddFromLink,
}: PhotoSourceSheetProps) {
  const reduceMotion = useReducedMotion();
  const panelRef = useRef<HTMLElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const photoInputRef = useRef<HTMLInputElement>(null);
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  useModalBackHandler(open, onClose);
  useFocusTrap(open, panelRef, closeButtonRef, onClose);

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
  };

  const tap = (action: () => void) => {
    void hapticTap();
    action();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[115] flex items-end justify-center bg-black/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Add photo"
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="android-sheet-panel w-full max-w-md rounded-t-[1.75rem] border border-border/70 bg-card p-3 pb-[calc(1rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-center justify-between px-1 pb-2">
              <h2 className="text-sm font-bold">Add photo</h2>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid min-h-12 min-w-12 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
            <ul className="space-y-0.5 px-1">
              <li>
                <button
                  type="button"
                  onClick={() => tap(() => photoInputRef.current?.click())}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium hover:bg-secondary"
                >
                  <Images className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Choose from photos
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => tap(() => cameraInputRef.current?.click())}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium hover:bg-secondary"
                >
                  <Camera className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Take a photo
                </button>
              </li>
              <li>
                <button
                  type="button"
                  onClick={() => tap(() => fileInputRef.current?.click())}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium hover:bg-secondary"
                >
                  <FileText className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
                  Choose from files
                </button>
              </li>
            </ul>
            <div className="mt-1 border-t px-1 pt-1">
              <button
                type="button"
                onClick={() => tap(onAddFromLink)}
                className="flex min-h-12 w-full items-center gap-3 rounded-xl px-2 text-left text-sm font-medium text-muted-foreground hover:bg-secondary"
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                Add from link
              </button>
            </div>

            <input
              ref={photoInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                onChoosePhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="sr-only"
              onChange={(event) => {
                onTakePhoto(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="sr-only"
              onChange={(event) => {
                onChooseFile(event.target.files?.[0]);
                event.target.value = "";
              }}
            />
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
