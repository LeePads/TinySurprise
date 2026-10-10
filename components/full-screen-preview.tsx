"use client";

import { useEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, Monitor, RotateCcw, Smartphone } from "lucide-react";
import { RecipientPreview } from "./recipient-preview";
import { hapticTap } from "@/lib/native/haptics";
import { enterImmersiveMode, exitImmersiveMode } from "@/lib/native/immersive-mode";
import { isNativePlatform } from "@/lib/platform";
import { useMediaQuery } from "@/lib/use-media-query";
import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { useRecipientReducedMotion } from "@/lib/recipient-motion";
import type { SurpriseData } from "@/lib/types";

/**
 * "builder-full-preview": the creator's own tool (Step 5, and the compact
 * preview's "Open full preview") — a Phone/Desktop toggle is meaningful
 * here since the creator is checking how it will look on different devices.
 * "recipient-viewer": what an actual recipient sees — opening a received
 * `.tinysurprise`, or "Open"/quick-preview from My Surprises. No device
 * toggle, no mobile-frame width cap, no builder chrome: the theme's own
 * background must cover the full viewport in both orientations. The two
 * modes are passed explicitly by the caller rather than guessed from
 * viewport size, since a recipient could easily be on a tablet or in
 * landscape.
 */
export type FullScreenPreviewMode = "builder-full-preview" | "recipient-viewer";

interface FullScreenPreviewProps {
  open: boolean;
  onClose: () => void;
  data: SurpriseData;
  children: React.ReactNode;
  title?: string;
  presentationMode?: FullScreenPreviewMode;
}

/**
 * Shared full-screen preview overlay with a permanent in-app toolbar —
 * replaces the browser Fullscreen API (unreliable in Android WebViews and
 * gives us no control over a back affordance). Rendered over the mounted
 * screen (builder, viewer) through a body portal so builder containment
 * cannot clip it, rather than navigating to a separate route. The
 * caller's state — step, form values, scroll position —
 * survives open/close for free. Android hardware Back closes this before
 * anything underneath it via useModalBackHandler.
 */
export function FullScreenPreview({
  open,
  onClose,
  data,
  children,
  title = "Preview",
  presentationMode = "builder-full-preview",
}: FullScreenPreviewProps) {
  const isRecipientViewer = presentationMode === "recipient-viewer";
  const [mode, setMode] = useState<"mobile" | "desktop">("mobile");
  // The 430px phone frame is a *desktop* tool: it only means anything when
  // the viewport is wider than the frame. On a real phone it just letterboxes
  // the preview and stops it reading as fullscreen, so the cap is dropped.
  const roomForPhoneFrame = useMediaQuery("(min-width: 560px)");

  const [previewKey, setPreviewKey] = useState(0);
  const [native, setNative] = useState(false);
  const [portalHost, setPortalHost] = useState<HTMLElement | null>(null);
  const overlayOpen = open && portalHost !== null;
  const phoneFramed = !native && !isRecipientViewer && mode === "mobile" && roomForPhoneFrame;

  const reduceMotion = useRecipientReducedMotion(data.appearance.animationIntensity);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);

  useRecipientOverlay({
    open: overlayOpen,
    containerRef: dialogRef,
    initialRef: closeButtonRef,
    onClose,
  });

  useEffect(() => {
    setNative(isNativePlatform());
    setPortalHost(document.body);
  }, []);

  useEffect(() => {
    if (!overlayOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    void enterImmersiveMode();
    return () => {
      document.body.style.overflow = previousOverflow;
      void exitImmersiveMode();
    };
  }, [overlayOpen, onClose]);

  return portalHost ? createPortal(
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-[150] flex h-[100dvh] flex-col overflow-hidden bg-background"
          initial={reduceMotion ? false : { opacity: 0 }}
          animate={reduceMotion ? undefined : { opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          <header
            className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-2 py-2 backdrop-blur-xl"
            style={{
              paddingTop: "calc(.5rem + env(safe-area-inset-top))",
              paddingInlineStart: "calc(.5rem + env(safe-area-inset-left))",
              paddingInlineEnd: "calc(.5rem + env(safe-area-inset-right))",
            }}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={() => {
                void hapticTap();
                onClose();
              }}
              aria-label="Back"
              className="flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary min-[380px]:px-3"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden min-[380px]:inline">Back</span>
            </button>
            {!isRecipientViewer && !native && (
              <div
                className="flex min-w-0 rounded-xl border bg-card p-1"
                role="group"
                aria-label="Preview viewport"
              >
                <button
                  type="button"
                  aria-label="Phone preview"
                  aria-pressed={mode === "mobile"}
                  onClick={() => setMode("mobile")}
                  className={`flex min-h-12 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${mode === "mobile" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  <Smartphone className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden min-[380px]:inline">Phone</span>
                </button>
                <button
                  type="button"
                  aria-label="Desktop preview"
                  aria-pressed={mode === "desktop"}
                  onClick={() => setMode("desktop")}
                  className={`flex min-h-12 items-center gap-1.5 rounded-lg px-2 text-xs font-semibold transition ${mode === "desktop" ? "bg-primary text-primary-foreground" : "text-muted-foreground"}`}
                >
                  <Monitor className="h-3.5 w-3.5" aria-hidden="true" />
                  <span className="hidden min-[380px]:inline">Desktop</span>
                </button>
              </div>
            )}
            <button
              type="button"
              onClick={() => {
                void hapticTap();
                setPreviewKey((key) => key + 1);
              }}
              aria-label="Restart preview"
              className="flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-full text-foreground transition hover:bg-secondary"
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
            </button>

          </header>

          <div
            className={`recipient-preview-viewport min-h-0 flex-1 overflow-auto ${phoneFramed ? "mx-auto w-full max-w-[430px]" : ""}`}
          >
            {/* The stable recipient frame fills this size container; only
                the pane scrolls, and its background includes the safe area. */}
            <div
              key={previewKey}
              className="flex min-h-full flex-col"
            >
              <RecipientPreview data={data} fillHeight presentationMode="viewport">
                {children}
              </RecipientPreview>
            </div>
          </div>
        </motion.div>
      )}
    </AnimatePresence>,
    portalHost,
  ) : null;
}
