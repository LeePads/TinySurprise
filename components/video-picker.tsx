"use client";

import { useEffect, useId, useRef, useState } from "react";
import { Film, Globe2, LoaderCircle, Play, Trash2, VideoOff } from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { createStableId, revokeLocalVideo } from "@/lib/local-media";
import { normalizeHttpUrl } from "@/lib/safe-url";
import type { LocalVideo } from "@/lib/types";
import { VideoEditorSheet } from "./video-editor-sheet";
import { canProcessVideoLocally, MAX_VIDEO_BYTES, formatVideoSize } from "@/lib/video-processing";

const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/ogg"]);
const formatVideoDuration = (seconds: number) => `${Math.floor(seconds / 60)}:${String(Math.round(seconds % 60)).padStart(2, "0")}`;

/** Check that this device can open a replacement before releasing the saved preview. */
function checkVideoPreview(url: string, signal: AbortSignal): Promise<void> {
  if (signal.aborted) return Promise.reject(new Error("Video selection cancelled."));
  return new Promise((resolve, reject) => {
    const video = document.createElement("video");
    const finish = (readable: boolean) => {
      window.clearTimeout(timeout);
      signal.removeEventListener("abort", cancel);
      video.onloadedmetadata = null;
      video.onerror = null;
      video.pause();
      video.removeAttribute("src");
      video.load();
      if (readable) resolve();
      else reject(new Error("This video could not be opened."));
    };
    const cancel = () => finish(false);
    const timeout = window.setTimeout(cancel, 10000);
    video.onloadedmetadata = () => finish(video.videoWidth > 0 && video.videoHeight > 0 && Number.isFinite(video.duration) && video.duration > 0);
    video.onerror = cancel;
    signal.addEventListener("abort", cancel, { once: true });
    video.preload = "metadata";
    video.src = url;
    video.load();
  });
}

export function VideoPicker({
  value,
  onChange,
  label = "Video",
  addLabel = "Upload a short video",
  hideLabel = false,
  compactEmpty = false,
  showUrlOption = true,
}: {
  value?: LocalVideo;
  onChange: (value?: LocalVideo) => void;
  label?: string;
  addLabel?: string;
  hideLabel?: boolean;
  compactEmpty?: boolean;
  showUrlOption?: boolean;
}) {
  const fileInput = useRef<HTMLInputElement>(null);
  const fileId = useId();
  const urlId = useId();
  const [urlValue, setUrlValue] = useState(
    value?.source === "url" ? value.previewUrl : "",
  );
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [pendingVideo, setPendingVideo] = useState<LocalVideo>();
  const valueRef = useRef(value);
  valueRef.current = value;
  const choiceRef = useRef(0);
  const pendingVideoRef = useRef<LocalVideo | undefined>(undefined);
  const previewCheckRef = useRef<AbortController | undefined>(undefined);

  useEffect(() => () => {
    choiceRef.current += 1;
    previewCheckRef.current?.abort();
    revokeLocalVideo(pendingVideoRef.current);
  }, []);

  useEffect(() => {
    if (value?.source === "url") setUrlValue(value.previewUrl);
    else if (!value) setUrlValue("");
  }, [value]);

  const replace = (next?: LocalVideo) => {
    if (value?.id === next?.id) {
      onChange(next);
      return;
    }
    onChange(next);
    revokeLocalVideo(value);
  };
  const discardPending = (keep?: LocalVideo) => {
    if (pendingVideoRef.current?.previewUrl !== keep?.previewUrl) revokeLocalVideo(pendingVideoRef.current);
    pendingVideoRef.current = undefined;
    setPendingVideo(undefined);
  };
  const choose = async (file?: File) => {
    if (!file) return;
    const choice = ++choiceRef.current;
    previewCheckRef.current?.abort();
    const controller = new AbortController();
    previewCheckRef.current = controller;
    const previous = valueRef.current;
    let next: LocalVideo | undefined;
    setBusy(true);
    try {
      if (!VIDEO_TYPES.has(file.type)) {
        setError("Choose an MP4, WebM, or Ogg video.");
        return;
      }
      if (!file.size) {
        setError("This video is empty. Choose another file. Your current video is unchanged.");
        return;
      }
      next = {
        id: createStableId("video"),
        file,
        previewUrl: URL.createObjectURL(file),
        name: file.name,
        mimeType: file.type,
        size: file.size,
        source: "upload",
      };
      if (file.size > MAX_VIDEO_BYTES) {
        const available = await canProcessVideoLocally();
        if (choiceRef.current !== choice || valueRef.current !== previous) return;
        if (!available) {
          setError("This video is too large. Choose a video under 15 MB. Video optimization is available in the Tiny Surprise Android app.");
          return;
        }
        discardPending();
        setError("");
        setUrlValue("");
        pendingVideoRef.current = next;
        setPendingVideo(next);
        next = undefined;
        setEditorOpen(true);
        return;
      }
      await checkVideoPreview(next.previewUrl, controller.signal);
      if (choiceRef.current !== choice || valueRef.current !== previous) return;
      setError("");
      setUrlValue("");
      discardPending();
      replace(next);
      next = undefined;
    } catch {
      if (choiceRef.current === choice) setError("We couldn't open this video. Choose another file. Your current video is unchanged.");
    } finally {
      revokeLocalVideo(next);
      if (previewCheckRef.current === controller) previewCheckRef.current = undefined;
      if (choiceRef.current === choice) {
        setBusy(false);
        if (fileInput.current) fileInput.current.value = "";
      }
    }
  };
  const useUrl = () => {
    const source = normalizeHttpUrl(urlValue);
    if (!source) {
      setError("Enter a complete public http:// or https:// video URL.");
      return;
    }
    const host = new URL(source).hostname.toLocaleLowerCase();
    if (
      host === "youtu.be" ||
      host.endsWith("youtube.com") ||
      host.endsWith("youtube-nocookie.com")
    ) {
      setError(
        "Use a direct MP4, WebM, or Ogg file URL here. YouTube is supported only through the existing music option.",
      );
      return;
    }
    let name = new URL(source).pathname.split("/").filter(Boolean).at(-1) || "Linked video";
    try { name = decodeURIComponent(name); } catch { /* Keep the URL's original filename. */ }
    setError("");
    replace({
      id: createStableId("linked-video"),
      previewUrl: source,
      name,
      mimeType: "video/remote",
      size: 0,
      source: "url",
    });
  };

  return (
    <div className="space-y-3">
      {!hideLabel && <label htmlFor={fileId} className="block text-sm font-medium">{label}</label>}
      {value ? (
        <VideoMediaCard
          value={value}
          busy={busy}
          onRemove={() => {
            replace();
            setUrlValue("");
            setError("");
          }}
          onReplace={() => fileInput.current?.click()}
          onEdit={!value.unavailable && value.source !== "url" && value.file ? () => setEditorOpen(true) : undefined}
        />
      ) : (
        <Button
          type="button"
          variant="outline"
          className={`${compactEmpty ? "min-h-12" : "min-h-20"} w-full border-dashed`}
          disabled={busy}
          onClick={() => fileInput.current?.click()}
        >
          {busy ? (
            <LoaderCircle className="mr-2 animate-spin" />
          ) : (
            <Film className="mr-2" />
          )}
          {addLabel}
        </Button>
      )}
      <input
        ref={fileInput}
        id={fileId}
        type="file"
        className="hidden"
        accept=".mp4,.webm,.ogv,video/mp4,video/webm,video/ogg"
        disabled={busy}
        onChange={(event) => choose(event.target.files?.[0])}
      />
      {showUrlOption && (!linkOpen ? (
        <button
          type="button"
          onClick={() => setLinkOpen(true)}
          className="text-xs font-semibold text-primary underline-offset-2 hover:underline"
        >
          More options
        </button>
      ) : (
        <div className="border-t pt-3">
          <label
            htmlFor={urlId}
            className="flex items-center gap-2 text-xs font-semibold text-muted-foreground"
          >
            <Globe2 className="h-3.5 w-3.5" />
            Or use a direct video URL
          </label>
          <div className="mt-2 flex gap-2">
            <Input
              id={urlId}
              inputMode="url"
              value={urlValue}
              placeholder="https://example.com/memory.mp4"
              onChange={(event) => setUrlValue(event.target.value)}
            />
            <Button
              type="button"
              variant="outline"
              disabled={busy || !urlValue.trim()}
              onClick={useUrl}
            >
              Use URL
            </Button>
          </div>
          <p className="mt-2 text-xs text-muted-foreground">
            Direct links need a public video URL. Upload the file if the host blocks access.
          </p>
        </div>
      ))}
      {error && <InlineFieldMessage message={error} />}
      {busy && <p role="status" className="text-xs text-muted-foreground">Preparing your video… Your current video stays unchanged until it’s ready.</p>}
      <VideoEditorSheet
        open={editorOpen}
        video={pendingVideo || (value?.source !== "url" && value?.file ? value : undefined)}
        oversizedSource={Boolean(pendingVideo)}
        onCancel={() => {
          discardPending();
          setEditorOpen(false);
        }}
        onChooseAnother={() => {
          discardPending();
          setEditorOpen(false);
          requestAnimationFrame(() => fileInput.current?.click());
        }}
        onDone={(edited) => {
          discardPending(edited);
          replace(edited);
          setEditorOpen(false);
        }}
      />
    </div>
  );
}

/**
 * Replaces the raw `<video controls>` element (which shows the browser's
 * own oversized scrubber and a blank/black frame until the user scrubs) with
 * a designed media card: a captured poster frame with `object-fit: cover`,
 * one centered Play button, filename below, and native controls only after
 * the recipient actually opens playback — matching the equivalent photo
 * card pattern already used elsewhere in the builder.
 */
function VideoMediaCard({
  value,
  busy,
  onRemove,
  onReplace,
  onEdit,
}: {
  value: LocalVideo;
  busy: boolean;
  onRemove: () => void;
  onReplace: () => void;
  onEdit?: () => void;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [poster, setPoster] = useState<string>();
  const [posterLoading, setPosterLoading] = useState(false);
  const [playing, setPlaying] = useState(false);
  const [unsupported, setUnsupported] = useState(false);
  const [duration, setDuration] = useState(0);
  const capturedFor = useRef<string | undefined>(undefined);

  useEffect(() => {
    videoRef.current?.pause();
    setPoster(undefined);
    setPlaying(false);
    setUnsupported(false);
    setDuration(0);
    // Cross-origin linked videos usually taint the canvas on capture
    // (no CORS access to pixel data) — for those we fall back to the
    // browser's own metadata-derived first frame instead of failing.
    setPosterLoading(value.source !== "url");
  }, [value.previewUrl, value.source]);

  useEffect(() => () => {
    videoRef.current?.pause();
  }, []);

  const captureFrame = () => {
    const video = videoRef.current;
    if (!video || capturedFor.current === value.previewUrl) return;
    try {
      const canvas = document.createElement("canvas");
      canvas.width = video.videoWidth || 320;
      canvas.height = video.videoHeight || 180;
      const context = canvas.getContext("2d");
      if (!context) throw new Error("no 2d context");
      context.drawImage(video, 0, 0, canvas.width, canvas.height);
      setPoster(canvas.toDataURL("image/jpeg", 0.75));
      capturedFor.current = value.previewUrl;
    } catch {
      // Tainted canvas (cross-origin) or a decode that hasn't produced a
      // frame yet — keep the video's own current frame visible instead.
    } finally {
      setPosterLoading(false);
    }
  };

  const openPlayback = () => {
    setPlaying(true);
    requestAnimationFrame(() => void videoRef.current?.play().catch(() => undefined));
  };

  if (value.unavailable || unsupported) {
    return (
      <div className="min-w-0 max-w-full rounded-xl border border-border bg-card p-3">
        <div className="flex min-h-32 flex-col items-center justify-center gap-1.5 rounded-lg bg-muted/60 text-center text-muted-foreground">
          <VideoOff className="h-6 w-6" aria-hidden="true" />
          <p className="px-3 text-xs">
            {value.unavailable ? "Video unavailable — choose it again" : "We couldn&apos;t open this video."}
          </p>
        </div>
      <VideoCardFooter name={value.name} meta="Video unavailable" busy={busy} onReplace={onReplace} onRemove={onRemove} />
      </div>
    );
  }

  return (
    <div className="min-w-0 max-w-full rounded-xl border border-border bg-card p-3">
      <div className="relative overflow-hidden rounded-lg bg-black">
        <video
          ref={videoRef}
          className={`aspect-video w-full ${playing ? "object-contain" : "object-cover"}`}
          src={value.previewUrl}
          muted={!playing}
          playsInline
          preload="metadata"
          controls={playing}
          poster={poster}
          onLoadedData={() => {
            if (!playing) captureFrame();
          }}
          onLoadedMetadata={(event) => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
          onSeeked={() => {
            if (!playing) captureFrame();
          }}
          onError={() => {
            setPosterLoading(false);
            setUnsupported(true);
          }}
          onPause={() => {
            if (videoRef.current?.ended) setPlaying(false);
          }}
        />
        {posterLoading && (
          <div className="absolute inset-0 grid place-items-center bg-black/40">
            <LoaderCircle className="h-5 w-5 animate-spin text-white" aria-hidden="true" />
          </div>
        )}
        {!playing && !posterLoading && (
          <button
            type="button"
            onClick={openPlayback}
            aria-label="Play video"
            className="absolute inset-0 grid place-items-center bg-black/15 transition hover:bg-black/25"
          >
            <span className="grid h-12 w-12 place-items-center rounded-full bg-white/90 text-black shadow-lg">
              <Play className="ml-0.5 h-5 w-5 fill-current" aria-hidden="true" />
            </span>
          </button>
        )}
      </div>
      <VideoCardFooter
        name={value.source === "url" ? "Linked video" : value.name}
        meta={value.source === "url" ? "Direct link" : `Ready to use · ${formatVideoSize(value.size)}${duration ? ` · ${formatVideoDuration(duration)}` : ""}`}
        busy={busy}
        onReplace={onReplace}
        onRemove={onRemove}
        onEdit={onEdit}
      />
    </div>
  );
}

function VideoCardFooter({
  name,
  meta,
  busy,
  onReplace,
  onRemove,
  onEdit,
}: {
  name: string;
  meta: string;
  busy: boolean;
  onReplace: () => void;
  onRemove: () => void;
  onEdit?: () => void;
}) {
  return (
    <div className="builder-image-card__footer mt-3 grid min-w-0 gap-3">
      <div className="builder-image-card__details min-w-0">
        <span className="builder-image-card__name block text-sm font-medium text-foreground [overflow-wrap:anywhere]" title={name}>{name}</span>
        <span className="mt-1 block text-xs text-muted-foreground">{meta}</span>
      </div>
      <div className="builder-image-card__actions flex min-w-0 flex-wrap gap-2">
        {onEdit && <Button className="h-auto min-h-9 min-w-0 whitespace-normal py-2" type="button" size="sm" variant="outline" disabled={busy} onClick={onEdit}>Edit video</Button>}
        <Button className="h-auto min-h-9 min-w-0 whitespace-normal py-2" type="button" size="sm" variant="outline" disabled={busy} onClick={onReplace}>
          Replace
        </Button>
        <Button className="h-auto min-h-9 min-w-0 whitespace-normal py-2" type="button" size="sm" variant="ghost" disabled={busy} onClick={onRemove}>
          <Trash2 className="mr-1 h-4 w-4" />
          Remove
        </Button>
      </div>
    </div>
  );
}
