import { Directory, Filesystem } from "@capacitor/filesystem";
import { Capacitor, registerPlugin, type PluginListenerHandle } from "@capacitor/core";
import type { LocalVideo } from "./types";
import { formatBytes } from "./format-bytes";

export type VideoQuality = "original" | "balanced" | "smaller";

export type VideoProcessingErrorCode =
  | "unavailable"
  | "cancelled"
  | "space"
  | "native"
  | "readback"
  | "too-large";

export class VideoProcessingError extends Error {
  readonly code: VideoProcessingErrorCode;

  constructor(code: VideoProcessingErrorCode, message: string) {
    super(message);
    this.name = "VideoProcessingError";
    this.code = code;
  }
}

export interface VideoEditRequest {
  trimStartMs: number;
  trimEndMs?: number;
  quality: VideoQuality;
  framing?: "original" | "fill";
  crop?: { left: number; top: number; right: number; bottom: number };
}

export interface VideoTransformProgress {
  jobId: string;
  progress: number;
}

interface NativeVideoTransformerApi {
  isAvailable(): Promise<{ available: boolean }>;
  transform(options: {
    jobId: string;
    inputUri: string;
    fileName: string;
    mimeType: string;
    request: VideoEditRequest;
  }): Promise<{
    jobId: string;
    success: boolean;
    path: string;
    name: string;
    mimeType: string;
    size: number;
    width: number;
    height: number;
    durationMs: number;
    cancelled?: boolean;
  }>;
  cancel(options: { jobId: string }): Promise<void>;
  cleanup(options: { path: string }): Promise<void>;
  addListener(
    eventName: "progress",
    listenerFunc: (progress: VideoTransformProgress) => void,
  ): Promise<PluginListenerHandle>;
}

export const NativeVideoTransformer = registerPlugin<NativeVideoTransformerApi>(
  "VideoTransformer",
);

export async function canProcessVideoLocally(): Promise<boolean> {
  if (!Capacitor.isNativePlatform()) return false;
  try {
    return (await NativeVideoTransformer.isAvailable()).available;
  } catch {
    return false;
  }
}

export const MAX_VIDEO_BYTES = 15 * 1024 * 1024;

const fileToBase64 = async (file: File): Promise<string> => {
  const buffer = await file.arrayBuffer();
  let binary = "";
  const bytes = new Uint8Array(buffer);
  const chunkSize = 0x8000;
  for (let index = 0; index < bytes.length; index += chunkSize) {
    binary += String.fromCharCode(...bytes.subarray(index, index + chunkSize));
  }
  return btoa(binary);
};

const createJobId = () => {
  const randomUuid = globalThis.crypto?.randomUUID;
  return `video-job-${randomUuid ? randomUuid() : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`}`;
};

const createAbortError = () => {
  const error = new VideoProcessingError("cancelled", "Video editing was cancelled.");
  error.name = "AbortError";
  return error;
};

const nativeErrorCode = (reason: unknown) =>
  typeof reason === "object" && reason !== null && "code" in reason
    ? String((reason as { code?: unknown }).code || "")
    : "";

type ProcessOptions = {
  signal?: AbortSignal;
  onProgress?: (progress: number) => void;
};

export async function processLocalVideo(
  video: LocalVideo,
  request: VideoEditRequest,
  options: ProcessOptions = {},
): Promise<LocalVideo> {
  if (!video.file) throw new Error("Choose an uploaded video before editing it.");
  if (!(await canProcessVideoLocally())) {
    throw new VideoProcessingError(
      "unavailable",
      "Video optimization is not available in this browser yet. Your original video is still safe.",
    );
  }
  if (options.signal?.aborted) throw createAbortError();

  const jobId = createJobId();
  const stagedPath = `tiny-surprise-video-${jobId}-${video.name.replace(/[^A-Za-z0-9._-]/g, "_")}`;
  let progressListener: PluginListenerHandle | undefined;
  let started = false;
  let outputPath: string | undefined;
  let abortHandler: (() => void) | undefined;
  try {
    // A browser File has no portable native URI. Stage it once into the
    // Capacitor cache, then pass that URI through the transformer. The edit
    // bridge never receives or re-sends a base64 video payload.
    try {
      await Filesystem.writeFile({
        path: stagedPath,
        data: await fileToBase64(video.file),
        directory: Directory.Cache,
        recursive: true,
      });
    } catch {
      throw new VideoProcessingError(
        "space",
        "There is not enough free space to prepare this video.",
      );
    }
    if (options.signal?.aborted) throw createAbortError();
    const { uri: inputUri } = await Filesystem.getUri({
      path: stagedPath,
      directory: Directory.Cache,
    });
    progressListener = await NativeVideoTransformer.addListener("progress", (progress) => {
      if (progress.jobId === jobId) options.onProgress?.(Math.max(0, Math.min(100, progress.progress)));
    });
    abortHandler = () => {
      if (started) void NativeVideoTransformer.cancel({ jobId }).catch(() => undefined);
    };
    options.signal?.addEventListener("abort", abortHandler, { once: true });
    started = true;
    let result: Awaited<ReturnType<NativeVideoTransformerApi["transform"]>>;
    try {
      result = await NativeVideoTransformer.transform({
        jobId,
        inputUri,
        fileName: video.name,
        mimeType: video.mimeType,
        request,
      });
    } catch (reason) {
      if (options.signal?.aborted) throw createAbortError();
      const code = nativeErrorCode(reason);
      if (code === "VIDEO_STORAGE_UNAVAILABLE")
        throw new VideoProcessingError("space", "There is not enough free space to edit this video.");
      throw new VideoProcessingError(
        "native",
        "The video could not be prepared on this device.",
      );
    }
    if (options.signal?.aborted || result.cancelled) throw createAbortError();
    outputPath = result.path;
    if (!result.success)
      throw new VideoProcessingError(
        "native",
        "The video could not be prepared on this device.",
      );
    if (!result.path)
      throw new VideoProcessingError(
        "readback",
        "The processed video could not be read back from device storage.",
      );
    if (!result.size || result.size <= 0 || !/^video\//i.test(result.mimeType || ""))
      throw new VideoProcessingError(
        "readback",
        "The processed video could not be read back from device storage.",
      );
    const webPath = Capacitor.convertFileSrc(result.path);
    let response: Response;
    try {
      response = await fetch(webPath);
    } catch {
      throw new VideoProcessingError(
        "readback",
        "The processed video could not be read back from device storage.",
      );
    }
    if (!response.ok)
      throw new VideoProcessingError(
        "readback",
        "The processed video could not be read back from device storage.",
      );
    let blob: Blob;
    try {
      blob = await response.blob();
    } catch {
      throw new VideoProcessingError(
        "readback",
        "The processed video could not be read back from device storage.",
      );
    }
    if (!blob.size)
      throw new VideoProcessingError(
        "readback",
        "The processed video could not be read back from device storage.",
      );
    const file = new File([blob], result.name, { type: result.mimeType || "video/mp4" });
    return {
      ...video,
      id: `${video.id}-edited`,
      file,
      previewUrl: URL.createObjectURL(file),
      name: result.name,
      mimeType: file.type,
      size: file.size,
      source: "upload",
    };
  } finally {
    if (abortHandler) options.signal?.removeEventListener("abort", abortHandler);
    if (outputPath)
      await NativeVideoTransformer.cleanup({ path: outputPath }).catch(() => undefined);
    await progressListener?.remove().catch(() => undefined);
    await Filesystem.deleteFile({ path: stagedPath, directory: Directory.Cache }).catch(() => undefined);
  }
}

export const formatVideoSize = (bytes: number) =>
  formatBytes(bytes, bytes >= 1048576 ? 1 : 2);
