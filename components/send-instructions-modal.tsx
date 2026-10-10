"use client";

import { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { Download, FileArchive, Paperclip, X } from "lucide-react";
import { Button } from "./ui/button";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { MOTION, MOTION_EASE } from "@/lib/motion";

interface SendInstructionsModalProps {
  open: boolean;
  fileName: string;
  zipBusy: boolean;
  notice?: string;
  error?: string;
  onClose: () => void;
  onDownload: () => void;
  onDownloadZip: () => void;
}

export function SendInstructionsModal({
  open,
  fileName,
  zipBusy,
  notice,
  error,
  onClose,
  onDownload,
  onDownloadZip,
}: SendInstructionsModalProps) {
  const closeButton = useRef<HTMLButtonElement>(null);
  const dialog = useRef<HTMLElement>(null);
  const reduceMotion = useReducedMotion();

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    const previousFocus = document.activeElement as HTMLElement | null;
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        onClose();
        return;
      }
      if (event.key !== "Tab" || !dialog.current) return;
      const focusable = Array.from(
        dialog.current.querySelectorAll<HTMLElement>(
          'button:not([disabled]), a[href], input:not([disabled]), summary, [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((element) => element.getClientRects().length > 0);
      if (!focusable.length) return;
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };
    document.body.style.overflow = "hidden";
    window.addEventListener("keydown", closeOnEscape);
    requestAnimationFrame(() => closeButton.current?.focus());
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", closeOnEscape);
      previousFocus?.focus();
    };
  }, [onClose, open]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[110] flex items-center justify-center bg-black/60 p-3 backdrop-blur-sm sm:p-5"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : MOTION.fast }}
          onMouseDown={(event) => {
            if (event.target === event.currentTarget) onClose();
          }}
        >
          <motion.section
            ref={dialog}
            role="dialog"
            aria-modal="true"
            aria-labelledby="send-guide-title"
            aria-describedby="send-guide-description"
            initial={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 24, scale: 0.96 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={reduceMotion ? { opacity: 0 } : { opacity: 0, y: 12, scale: 0.98 }}
            transition={{ duration: reduceMotion ? 0 : MOTION.overlay, ease: MOTION_EASE }}
            className="relative max-h-[calc(100svh-1.5rem)] w-full max-w-lg overflow-y-auto rounded-[var(--radius-dialog)] border bg-card p-5 text-card-foreground shadow-2xl sm:p-7"
          >
            <button
              ref={closeButton}
              type="button"
              aria-label="Close send instructions"
              className="android-touch-target absolute right-4 top-4 grid min-h-12 min-w-12 place-items-center rounded-full border bg-card hover:bg-secondary"
              onClick={onClose}
            >
              <X className="h-4 w-4" />
            </button>
            <span className="grid h-12 w-12 place-items-center rounded-2xl bg-primary/10 text-primary">
              <Paperclip className="h-5 w-5" />
            </span>
            <h2 id="send-guide-title" className="mt-4 text-balance text-2xl font-semibold">
              Send your Tiny Surprise
            </h2>
            <p
              id="send-guide-description"
              className="mt-2 text-sm leading-6 text-muted-foreground"
            >
              Send your surprise as an attachment. They can open it in a browser without installing Tiny Surprise. YouTube and external song links need internet.
            </p>

            <ol className="mt-5 space-y-3 text-sm leading-6">
              <GuideStep number="1">
                Download the HTML surprise file below. Wait for the
                download to finish.
              </GuideStep>
              <GuideStep number="2">
                Attach the downloaded file to a chat or email.
              </GuideStep>
              <GuideStep number="3">
                Ask the recipient to download the attachment, then open the
                surprise in a browser.
              </GuideStep>
            </ol>

            <div className="mt-6 grid gap-2">
              <Button type="button" className="h-auto min-h-12 min-w-0 whitespace-normal py-2.5" onClick={onDownload}>
                <Download className="mr-2 h-4 w-4" />
                Download surprise
              </Button>
            </div>
            <details className="mt-3">
              <summary className="flex min-h-12 cursor-pointer items-center text-sm font-semibold">Chat won&apos;t accept the file?</summary>
              <p className="mb-3 text-sm text-muted-foreground">Send a ZIP copy instead. Ask them to extract it, then open the .html file inside. Opening attachments varies by phone and chat app. If they use Tiny Surprise, you can also send an app copy.</p>
              <Button
                type="button"
                variant="outline"
                className="h-auto min-h-12 whitespace-normal text-center"
                disabled={zipBusy}
                onClick={onDownloadZip}
              >
                <FileArchive className="mr-2 h-4 w-4" />
                {zipBusy ? "Preparing ZIP copy…" : "Save a ZIP copy"}
              </Button>
            </details>
            <p className="mt-3 break-all text-xs text-muted-foreground">
              File: {fileName}
            </p>
            {error && <div className="mt-3"><InlineFieldMessage message={error} /></div>}
            {notice && !error && (
              <div className="mt-3">
                <InlineFieldMessage tone="success" message={notice} />
              </div>
            )}
            <Button
              type="button"
              variant="ghost"
              className="mt-4 w-full"
              onClick={onClose}
            >
              Close
            </Button>
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function GuideStep({
  number,
  children,
}: {
  number: string;
  children: React.ReactNode;
}) {
  return (
    <li className="flex items-start gap-3">
      <span
        className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-xs font-bold text-primary-foreground"
        aria-hidden="true"
      >
        {number}
      </span>
      <span className="pt-0.5 text-muted-foreground">{children}</span>
    </li>
  );
}
