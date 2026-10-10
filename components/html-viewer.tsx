"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { AlertTriangle, ArrowLeft, LoaderCircle, Share2 } from "lucide-react";
import { Button } from "./ui/button";
import { isNativePlatform } from "@/lib/platform";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { hapticTap } from "@/lib/native/haptics";
import { enterImmersiveMode, exitImmersiveMode } from "@/lib/native/immersive-mode";
import { TINY_SURPRISE_HTML_MARKER } from "@/lib/export/html-shell";
import { openExternalLink } from "@/lib/native/open-link";
import { readViewerExternalLink, readViewerKeyboardAction, withExternalLinkHandler } from "@/lib/html-viewer-links";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { assertHtmlImportSize } from "@/lib/bounded-file-read";
import { base64ToBlob } from "@/lib/native/tinysurprise-import-plugin";

export type HtmlViewerSource =
  | { kind: "file"; file: File }
  | { kind: "path"; path: string; name?: string };

interface HtmlViewerProps {
  open: boolean;
  source: HtmlViewerSource;
  onClose: () => void;
  blocked?: boolean;
}

// Recognition is a compatibility hint, not authentication or a safety check.
function isRecognizedTinySurpriseHtml(html: string): boolean {
  return (
    html.includes(`content="${TINY_SURPRISE_HTML_MARKER}"`) ||
    html.includes("__TINY_SURPRISE__")
  );
}

/**
 * Dedicated, isolated viewer for a Tiny Surprise (or arbitrary) HTML file.
 * Renders in a sandboxed <iframe srcDoc> — no allow-same-origin, no
 * allow-top-navigation — inside the existing app rather than a native
 * WebView Activity, so the opened document can never reach window.Capacitor,
 * app storage, or the parent frame. Used both for files opened from outside
 * the app (source.kind === "path", copied to temp storage by the caller)
 * and for previewing a just-generated export in memory
 * (source.kind === "file", from the export sheet's "Open in viewer").
 */
export function HtmlViewer({ open, source, onClose, blocked = false }: HtmlViewerProps) {
  const [html, setHtml] = useState<string>();
  const [error, setError] = useState("");
  const [fileName, setFileName] = useState("");
  const [needsConfirmation, setNeedsConfirmation] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [shareBusy, setShareBusy] = useState(false);
  const shareBusyRef = useRef(false);
  const [readAttempt, setReadAttempt] = useState(0);
  const [shareFailed, setShareFailed] = useState(false);
  const [shareMessage, setShareMessage] = useState("");
  const [externalUrl, setExternalUrl] = useState<string>();
  const sourceFile = source.kind === "file" ? source.file : undefined;
  const sourcePath = source.kind === "path" ? source.path : undefined;
  const sourceName = source.kind === "path" ? source.name : undefined;
  const frameRef = useRef<HTMLIFrameElement>(null);
  const frameReadyRef = useRef(false);
  const frameEntryRef = useRef<"first" | "last" | undefined>(undefined);
  const externalDialogRef = useRef<HTMLDivElement>(null);
  const externalCancelRef = useRef<HTMLButtonElement>(null);
  const dismissExternal = () => setExternalUrl(undefined);
  useModalBackHandler(Boolean(externalUrl) && !blocked, dismissExternal);
  useFocusTrap(Boolean(externalUrl) && !blocked, externalDialogRef, externalCancelRef, dismissExternal);
  useEffect(() => {
    setExternalUrl(undefined);
    if (!open) { setExternalUrl(undefined); return; }
    const receive = (event: MessageEvent) => {
      if (blocked || dialogRef.current?.closest("[inert]")) return;
      const url = readViewerExternalLink(event, frameRef.current?.contentWindow ?? null);
      if (url) setExternalUrl(current => current || url);
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [open, sourceFile, sourcePath, blocked]);
  const reduceMotion = useReducedMotion();
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const sendButtonRef = useRef<HTMLButtonElement>(null);
  const dismissViewer = useCallback(() => { if (!shareBusyRef.current) onClose(); }, [onClose]);
  useModalBackHandler(open && !externalUrl && !blocked, dismissViewer);
  useFocusTrap(open && !externalUrl && !blocked, dialogRef, closeButtonRef, dismissViewer);

  useEffect(() => {
    if (!open || blocked || externalUrl) return;
    const receive = (event: MessageEvent) => {
      const frame = frameRef.current;
      if (!frame || event.source !== frame.contentWindow || frame.closest("[inert]")) return;
      if (event.data?.type === "tiny-viewer-ready") {
        frameReadyRef.current = true;
        const edge = frameEntryRef.current;
        if (edge && document.activeElement === frame) {
          frame.contentWindow?.postMessage({ type: "tiny-viewer-focus", edge }, "*");
        }
        frameEntryRef.current = undefined;
        return;
      }
      if (document.activeElement !== frame || shareBusyRef.current) return;
      const action = readViewerKeyboardAction(event, frame.contentWindow);
      if (action === "escape") dismissViewer();
      else if (action === "forward") closeButtonRef.current?.focus();
      else if (action === "backward") sendButtonRef.current?.focus();
    };
    window.addEventListener("message", receive);
    return () => window.removeEventListener("message", receive);
  }, [open, blocked, externalUrl, dismissViewer]);

  const focusFrameEdge = (edge: "first" | "last") => {
    const frame = frameRef.current;
    if (!frame) return;
    frameEntryRef.current = edge;
    frame.focus();
    if (frameReadyRef.current) {
      frame.contentWindow?.postMessage({ type: "tiny-viewer-focus", edge }, "*");
      frameEntryRef.current = undefined;
    }
  };

  useEffect(() => {
    if (!open) return;

    void enterImmersiveMode();
    return () => {

      void exitImmersiveMode();
    };
  }, [open, onClose]);

  useEffect(() => {
    if (!open) return;
    let disposed = false;
    frameReadyRef.current = false;
    frameEntryRef.current = undefined;
    setHtml(undefined);
    setFileName(sourceFile?.name || sourceName || sourcePath?.split("/").pop() || "surprise.html");
    setError("");
    setNeedsConfirmation(false);
    setConfirmed(false);
    setShareMessage("");
    setShareFailed(false);
    void (async () => {
      try {
        let text: string;
        let name: string;
        if (sourceFile) {
          assertHtmlImportSize(sourceFile.size);
          text = await sourceFile.text();
          name = sourceFile.name;
        } else if (sourcePath !== undefined) {
          const { Filesystem, Encoding } = await import("@capacitor/filesystem");
          const stat = await Filesystem.stat({ path: sourcePath });
          assertHtmlImportSize(stat.size);
          const result = await Filesystem.readFile({
            path: sourcePath,
            encoding: Encoding.UTF8,
          });
          text = typeof result.data === "string" ? result.data : "";
          name = sourceName || sourcePath?.split("/").pop() || "surprise.html";
        } else {
          throw new Error("Choose this browser copy again to open it.");
        }
        if (disposed) return;
        setFileName(name);
        if (!text.trim()) {
          setError("This browser copy is empty. Close the viewer and choose another file, or ask the sender for a new copy.");
          return;
        }
        setHtml(text);
        setNeedsConfirmation(!isRecognizedTinySurpriseHtml(text));
      } catch (reason) {
        if (!disposed) setError(reason instanceof Error ? reason.message : "We couldn't open this browser copy. Try another file or ask the sender to send it again.");
      }
    })();
    return () => {
      disposed = true;
    };
  }, [open, sourceFile, sourcePath, sourceName, readAttempt]);

  // Native files belong to the pending import, not this viewer's mount.

  const share = async () => {
    if (!html || shareBusyRef.current) return;
    shareBusyRef.current = true;
    void hapticTap();
    setShareBusy(true);
    setShareMessage("");
    setShareFailed(false);
    try {
      let file: File;
      if (source.kind === "file") file = source.file;
      else {
        const { Filesystem } = await import("@capacitor/filesystem");
        assertHtmlImportSize((await Filesystem.stat({ path: source.path })).size);
        const original = await Filesystem.readFile({ path: source.path });
        if (typeof original.data !== "string") throw new Error("This browser copy could not be prepared for sharing.");
        // Share the original artifact, preserving its encoding and bytes.
        file = new File([base64ToBlob(original.data)], fileName || "tiny-surprise.html", { type: "text/html" });
      }
      if (isNativePlatform()) {
        const { saveAndShareHtmlOnNative } = await import("@/lib/export/native-share");
        const outcome = await saveAndShareHtmlOnNative(file, "");
        setShareMessage(outcome === "shared" ? "Opened the share sheet. Delivery is not confirmed." : "Sharing was cancelled. The browser copy was saved in the app's Documents folder.");
      } else {
        const { shareSurpriseFile } = await import("@/lib/export/share");
        const outcome = await shareSurpriseFile(file, "");
        setShareMessage(outcome === "cancelled" ? "Sharing was cancelled." : "Opened the share sheet. Delivery is not confirmed.");
      }
    } catch (reason) {
      setShareFailed(true);
      setShareMessage(isNativePlatform()
        ? reason instanceof Error ? reason.message : "Sharing couldn't open. Try Send again; your file is still here."
        : "Sharing couldn't open. Try Send again, or close this viewer and attach the original file to a chat or email.");
    } finally {
      shareBusyRef.current = false;
      setShareBusy(false);
    }
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          ref={dialogRef}
          inert={blocked}
          aria-hidden={blocked || undefined}
          role="dialog"
          aria-modal="true"
          aria-label="Browser copy viewer"
          className="fixed inset-0 z-[150] flex flex-col bg-background"
          onKeyDown={(event) => {
            if (event.key !== "Tab" || event.altKey || event.ctrlKey || event.metaKey || blocked || externalUrl || shareBusyRef.current || !frameRef.current) return;
            if ((!event.shiftKey && event.target === sendButtonRef.current) ||
                (event.shiftKey && event.target === closeButtonRef.current)) {
              event.preventDefault();
              event.stopPropagation();
              focusFrameEdge(event.shiftKey ? "last" : "first");
            }
          }}
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
        >
          {externalUrl && <div ref={externalDialogRef} role="dialog" aria-modal="true" aria-labelledby="external-link-title" className="absolute inset-0 z-20 flex items-center justify-center bg-black/60 p-4"><div className="max-h-full w-full max-w-lg overflow-auto rounded-2xl bg-background p-5"><h2 id="external-link-title" className="text-lg font-semibold">Open this website?</h2><p className="my-4 break-all">{externalUrl}</p><div className="flex flex-wrap gap-3"><Button ref={externalCancelRef} variant="outline" onClick={dismissExternal}>Stay here</Button><a className="inline-flex min-h-12 items-center rounded-xl border px-4 font-semibold" href={externalUrl} target="_blank" rel="noopener noreferrer" onClick={(event) => { void openExternalLink(externalUrl, event); dismissExternal(); }}>Open website</a></div></div></div>}
          <header
            inert={Boolean(externalUrl)}
            className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 bg-background/85 px-2 py-2 backdrop-blur-xl"
            style={{ paddingTop: "calc(.5rem + env(safe-area-inset-top))" }}
          >
            <button
              ref={closeButtonRef}
              type="button"
              onClick={dismissViewer}
              disabled={shareBusy}
              aria-label="Back"
              className="flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary min-[380px]:px-3"
            >
              <ArrowLeft className="h-4 w-4" aria-hidden="true" />
              <span className="hidden min-[380px]:inline">Close</span>
            </button>
            <span className="min-w-0 flex-1 truncate px-2 text-center text-xs font-semibold text-muted-foreground">
              {fileName}
            </span>
            <button
              ref={sendButtonRef}
              type="button"
              onClick={() => void share()}
              disabled={!html || shareBusy}
              aria-label="Send"
              className="flex min-h-12 min-w-12 shrink-0 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm font-semibold text-foreground transition hover:bg-secondary disabled:opacity-40 min-[380px]:px-3"
            >
              {shareBusy ? (
                <LoaderCircle className="h-4 w-4 animate-spin" aria-hidden="true" />
              ) : (
                <Share2 className="h-4 w-4" aria-hidden="true" />
              )}
              <span className="hidden min-[380px]:inline">Send</span>
            </button>
          </header>
          {shareBusy && <p role="status" className="shrink-0 border-b px-4 py-2 text-sm">Preparing this file and opening sharing options…</p>}
          {shareMessage && <p role={shareFailed ? "alert" : "status"} className="shrink-0 border-b px-4 py-2 text-sm">{shareMessage}</p>}
          <div className="min-h-0 flex-1 bg-background pb-[env(safe-area-inset-bottom)]">
            {error ? (
              <div className="grid h-full place-items-center overflow-y-auto p-6 text-center text-sm text-muted-foreground">
                <div className="max-w-md space-y-4">
                  <p role="alert">{error}</p>
                  <Button variant="outline" onClick={() => setReadAttempt(attempt => attempt + 1)}>Try opening again</Button>
                </div>
              </div>
            ) : !html ? (
              <div role="status" className="grid h-full place-items-center">
                <LoaderCircle className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
                <span className="sr-only">Opening your browser copy…</span>
              </div>
            ) : needsConfirmation && !confirmed ? (
              <div className="h-full overflow-y-auto overscroll-contain p-4 sm:p-6">
                <div className="flex min-h-full items-center justify-center">
                  <div className="w-full min-w-0 max-w-sm rounded-2xl border bg-card p-5 text-center shadow-lg">
                    <AlertTriangle className="mx-auto h-6 w-6 text-amber-600" aria-hidden="true" />
                    <p className="mt-3 text-sm font-semibold">
                      This doesn&apos;t look like a Tiny Surprise file.
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      Preview it anyway? It will open in an isolated viewer with
                      no access to this app&apos;s data.
                    </p>
                    <div className="mt-4 grid gap-2 min-[380px]:grid-cols-2">
                      <Button className="h-auto min-h-12 min-w-0 whitespace-normal" disabled={shareBusy} onClick={dismissViewer}>
                        Cancel
                      </Button>
                      <Button variant="outline" className="h-auto min-h-12 min-w-0 whitespace-normal" onClick={() => setConfirmed(true)}>
                        Preview anyway
                      </Button>
                    </div>
                  </div>
                </div>
              </div>
            ) : (
              // The embedded page's own CSS is unknown and typically assumes
              // a white canvas — bg-white stays scoped to the iframe itself
              // (not the states above it) so dark theme doesn't flash white
              // while loading or confirming.
              <iframe
                ref={frameRef}
                tabIndex={0}
                inert={Boolean(externalUrl)}
                title={fileName || "Browser-friendly surprise"}
                sandbox="allow-scripts allow-popups"
                srcDoc={withExternalLinkHandler(html)}
                onLoad={() => {
                  frameReadyRef.current = true;
                  const edge = frameEntryRef.current;
                  if (edge && document.activeElement === frameRef.current) focusFrameEdge(edge);
                  else frameEntryRef.current = undefined;
                }}
                className="h-full w-full border-0 bg-white"
              />
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
