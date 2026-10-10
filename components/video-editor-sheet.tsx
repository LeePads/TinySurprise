"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { LoaderCircle, X } from "lucide-react";
import { Button } from "./ui/button";
import type { LocalVideo } from "@/lib/types";
import { revokeLocalVideo } from "@/lib/local-media";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { useFocusTrap } from "@/lib/use-focus-trap";
import {
  canProcessVideoLocally,
  formatVideoSize,
  MAX_VIDEO_BYTES,
  processLocalVideo,
  type VideoQuality,
  VideoProcessingError,
} from "@/lib/video-processing";

const QUALITY_OPTIONS: Array<{ value: VideoQuality; label: string; helper: string; ratio: number }> = [
  { value: "original", label: "Original", helper: "Keep the best quality", ratio: 1 },
  { value: "balanced", label: "Balanced", helper: "A good mix of quality and size", ratio: 0.55 },
  { value: "smaller", label: "Smaller file", helper: "Easier to share", ratio: 0.32 },
];

const formatTime = (seconds: number) => {
  const safeSeconds = Math.max(0, Math.round(seconds));
  return `${Math.floor(safeSeconds / 60)}:${String(safeSeconds % 60).padStart(2, "0")}`;
};

export function VideoEditorSheet({
  open,
  video,
  oversizedSource = false,
  onCancel,
  onChooseAnother,
  onDone,
}: {
  open: boolean;
  video?: LocalVideo;
  oversizedSource?: boolean;
  onCancel: () => void;
  onChooseAnother?: () => void;
  onDone: (video: LocalVideo) => void;
}) {
  const closeRef = useRef<HTMLButtonElement>(null);
  const panelRef = useRef<HTMLElement>(null);
  const abortRef = useRef<AbortController | null>(null);
  const editorVideoRef = useRef<HTMLVideoElement>(null);
  const progressRef = useRef({ value: 0, at: 0 });
  const [duration, setDuration] = useState(0);
  const [trimStart, setTrimStart] = useState(0);
  const [trimEnd, setTrimEnd] = useState(0);
  const [quality, setQuality] = useState<VideoQuality>("balanced");
  const [framing, setFraming] = useState<"original" | "fill">("original");
  const [available, setAvailable] = useState(false);
  const [checking, setChecking] = useState(false);
  const [busy, setBusy] = useState(false);
  const [progress, setProgress] = useState(0);
  const [intro, setIntro] = useState(false);
  const [previewError, setPreviewError] = useState(false);
  const [error, setError] = useState("");
  const dismissEditor = () => {
    if (abortRef.current) abortRef.current.abort();
    else onCancel();
  };
  useFocusTrap(open && Boolean(video), panelRef, closeRef, dismissEditor);
  useModalBackHandler(open && Boolean(video), dismissEditor);

  useEffect(() => {
    if (!open || !video) return;
    let disposed = false;
    setError("");
    setBusy(false);
    setProgress(0);
    setPreviewError(false);
    progressRef.current = { value: 0, at: 0 };
    setTrimStart(0);
    setTrimEnd(0);
    setDuration(0);
    setQuality("balanced");
    setFraming("original");
    setIntro(oversizedSource);
    setChecking(true);
    void canProcessVideoLocally().then((next) => {
      if (disposed) return;
      setAvailable(next);
      setChecking(false);
    });
    return () => {
      disposed = true;
      abortRef.current?.abort();
    };
  }, [open, oversizedSource, video]);

  useEffect(() => {
    if (!editorVideoRef.current || !duration) return;
    editorVideoRef.current.currentTime = trimStart;
  }, [duration, trimStart]);

  const estimatedSize = useMemo(() => {
    if (!video) return 0;
    const option = QUALITY_OPTIONS.find((item) => item.value === quality) || QUALITY_OPTIONS[1];
    const sourceDuration = duration || 1;
    const selectedDuration = trimEnd > trimStart ? trimEnd - trimStart : sourceDuration;
    return Math.max(1, Math.round(video.size * option.ratio * Math.min(1, selectedDuration / sourceDuration)));
  }, [duration, quality, trimEnd, trimStart, video]);

  if (!open || !video) return null;

  const hasChanges =
    quality !== "original" ||
    framing !== "original" ||
    trimStart > 0.05 ||
    (duration > 0 && trimEnd > 0 && trimEnd < duration - 0.05);

  const handleDone = async () => {
    if (!available || abortRef.current || busy || previewError) return;
    if (!hasChanges) {
      if (video.size > MAX_VIDEO_BYTES) {
        setError("This video is still too large. Choose Smaller file or trim it to stay under 15 MB.");
        return;
      }
      onDone(video);
      return;
    }
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true);
    setProgress(0);
    setError("");
    try {
      const edited = await processLocalVideo(
        video,
        {
          trimStartMs: Math.round(trimStart * 1000),
          trimEndMs: trimEnd > trimStart && duration > 0 ? Math.round(trimEnd * 1000) : undefined,
          quality,
          framing,
        },
        {
          signal: controller.signal,
          onProgress: (next) => {
            const now = performance.now();
            if (next >= 100 || now - progressRef.current.at > 180 || next - progressRef.current.value >= 2) {
              progressRef.current = { value: next, at: now };
              setProgress(next);
            }
          },
        },
      );
      if (controller.signal.aborted) {
        revokeLocalVideo(edited);
        return;
      }
      if (edited.size > MAX_VIDEO_BYTES) {
        revokeLocalVideo(edited);
        setError(
          `This edit is ${formatVideoSize(edited.size)}. Try Smaller file or trim a little more to stay under ${formatVideoSize(MAX_VIDEO_BYTES)}.`,
        );
        return;
      }
      onDone(edited);
    } catch (reason) {
      if (controller.signal.aborted || (reason instanceof Error && reason.name === "AbortError")) return;
      if (reason instanceof VideoProcessingError && reason.code === "space") {
        setError("Not enough free space to edit this video.");
      } else if (reason instanceof VideoProcessingError && reason.code === "unavailable") {
        setError("Video editing is not available here yet. Your original video is unchanged.");
      } else {
        setError("We couldn't edit this video. Your original video is unchanged.");
      }
    } finally {
      if (abortRef.current === controller) {
        abortRef.current = null;
        setBusy(false);
      }
    }
  };

  const handleCancel = () => {
    if (busy) {
      abortRef.current?.abort();
      onCancel();
      return;
    }
    onCancel();
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex items-end justify-center bg-black/55 p-0 backdrop-blur-sm sm:items-center sm:p-5"
      role="presentation"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel();
      }}
    >
      <section
        ref={panelRef}
        tabIndex={-1}
        className="max-h-[92dvh] w-full max-w-lg overflow-y-auto rounded-t-[2rem] border border-border bg-background p-5 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl sm:rounded-[2rem] sm:p-7"
        role="dialog"
        aria-modal="true"
        aria-labelledby="video-editor-title"
        aria-describedby="video-editor-description"
      >
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 id="video-editor-title" className="text-xl font-semibold">
              {intro ? "Make this video smaller" : "Edit video"}
            </h2>
            <p id="video-editor-description" className="mt-1 text-sm text-muted-foreground">
              {intro
                ? "Trim it or lower the quality so it’s easier to share."
                : "Create a local copy for this surprise. Your original stays untouched."}
            </p>
          </div>
          <Button ref={closeRef} type="button" size="icon" variant="ghost" disabled={busy} aria-label="Close video editor" onClick={onCancel}>
            <X className="h-5 w-5" />
          </Button>
        </div>

        <video
          ref={editorVideoRef}
          className="mt-5 aspect-video w-full rounded-2xl bg-black object-contain"
          src={video.previewUrl}
          controls
          playsInline
          preload="metadata"
          onLoadedMetadata={(event) => {
            const nextDuration = Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0;
            setDuration(nextDuration);
            setTrimEnd(nextDuration);
          }}
          onError={() => setPreviewError(true)}
        />

        {intro ? (
          <>
            {checking && <p className="mt-4 text-sm text-muted-foreground" role="status">Checking this device…</p>}
            {!checking && !available && (
              <p className="mt-4 rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">
                Video optimization is available in the Tiny Surprise Android app. This browser will keep your original video.
              </p>
            )}
            <div className="mt-6 grid gap-2 sm:grid-cols-2">
              <Button type="button" className="min-h-12" disabled={!available || checking} onClick={() => setIntro(false)}>
                Edit video
              </Button>
              <Button type="button" variant="outline" className="min-h-12" disabled={busy} onClick={onChooseAnother || onCancel}>
                Choose another video
              </Button>
            </div>
          </>
        ) : (
          <>
            <fieldset className="mt-5 space-y-3" disabled={busy || !available || previewError}>
              <legend className="text-sm font-semibold">Trim</legend>
              <p className="text-sm text-muted-foreground">
                Selected: {Math.max(1, Math.round(Math.max(0, (trimEnd || duration) - trimStart)))} sec
              </p>
              <label className="grid gap-2 text-sm">
                <span className="flex justify-between gap-3"><span>Start</span><strong>{formatTime(trimStart)}</strong></span>
                <input className="min-h-12 w-full accent-primary" type="range" min={0} max={duration || 1} step={0.1} value={trimStart} aria-label={`Trim start, ${formatTime(trimStart)}`} onChange={(event) => setTrimStart(Math.min(Number(event.target.value), Math.max(0, (trimEnd || duration) - 0.5)))} />
              </label>
              <label className="grid gap-2 text-sm">
                <span className="flex justify-between gap-3"><span>End</span><strong>{formatTime(trimEnd || duration)}</strong></span>
                <input className="min-h-12 w-full accent-primary" type="range" min={Math.min(duration || 1, trimStart + 0.5)} max={duration || 1} step={0.1} value={trimEnd || duration} aria-label={`Trim end, ${formatTime(trimEnd || duration)}`} onChange={(event) => setTrimEnd(Math.max(trimStart + 0.5, Math.min(duration || 1, Number(event.target.value))))} />
              </label>
            </fieldset>

            <fieldset className="mt-5 space-y-2" disabled={busy || !available || previewError}>
              <legend className="text-sm font-semibold">Quality</legend>
              {QUALITY_OPTIONS.map((option) => (
                <label key={option.value} className={`flex min-h-14 cursor-pointer items-center gap-3 rounded-xl border px-3 py-2 ${quality === option.value ? "border-primary bg-primary/10" : "border-border bg-card/60"}`}>
                  <input type="radio" name="video-quality" value={option.value} checked={quality === option.value} onChange={() => setQuality(option.value)} />
                  <span className="min-w-0"><span className="block font-semibold">{option.label}</span><span className="block text-xs text-muted-foreground">{option.helper}</span></span>
                </label>
              ))}
            </fieldset>

            <fieldset className="mt-5 space-y-2" disabled={busy || !available || previewError}>
              <legend className="text-sm font-semibold">Framing</legend>
              <div className="grid gap-2 sm:grid-cols-2">
                {(["original", "fill"] as const).map((option) => (
                  <label key={option} className={`flex min-h-12 cursor-pointer items-center gap-2 rounded-xl border px-3 text-sm ${framing === option ? "border-primary bg-primary/10" : "border-border bg-card/60"}`}>
                    <input type="radio" name="video-framing" checked={framing === option} onChange={() => setFraming(option)} />
                    {option === "original" ? "Original" : "Fill"}
                  </label>
                ))}
              </div>
            </fieldset>

            <p className="mt-4 text-sm text-muted-foreground" aria-live="polite">
              {formatVideoSize(video.size)} → about {formatVideoSize(estimatedSize)}
            </p>
            {estimatedSize > MAX_VIDEO_BYTES && (
              <p className="mt-3 rounded-xl bg-warning/10 p-3 text-sm text-foreground" role="status">
                This setting may still be larger than the {formatVideoSize(MAX_VIDEO_BYTES)} sharing limit. Trim further or choose Smaller file if needed.
              </p>
            )}
            {!available && <p className="mt-3 rounded-xl bg-secondary/40 p-3 text-sm text-muted-foreground">Video editing is not available here yet. Your original video will be kept.</p>}
            {previewError && <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">We couldn&apos;t open this video. Your original video is unchanged.</p>}
            {busy && <p className="mt-3 text-sm text-muted-foreground" role="status" aria-live="polite">{progress > 0 ? `Making it smaller… ${Math.round(progress)}%` : "Preparing your video…"}</p>}
            {error && <p className="mt-3 rounded-xl bg-destructive/10 p-3 text-sm text-destructive" role="alert">{error}</p>}
            <div className="mt-6 flex flex-col gap-2 sm:flex-row sm:justify-end">
              <Button type="button" variant="outline" className="min-h-12" disabled={false} onClick={handleCancel}>{busy ? "Cancel" : "Back"}</Button>
              <Button type="button" className="min-h-12" disabled={busy || !available || previewError} onClick={() => void handleDone()}>
                {busy && <LoaderCircle className="mr-2 h-4 w-4 animate-spin" />}
                {busy ? "Saving…" : "Save edited video"}
              </Button>
            </div>
          </>
        )}
      </section>
    </div>
  );
}
