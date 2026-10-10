import type {
  CatchTheHeartContent,
  LocalAudio,
  OpenWhenContent,
  SurpriseData,
  SurpriseMusic,
} from "./types";
import { normalizeCatchHeartIds } from "./heart-memories";
import { normalizeOpenWhenEnvelopeIds } from "./open-when";
import { normalizeChooseOurDateIds } from "./choose-our-date";
import { revokeObjectUrl } from "./local-media";

export const MAX_AUDIO_FILE_BYTES = 10 * 1024 * 1024;
export const MAX_PLAYLIST_AUDIO_BYTES = 12 * 1024 * 1024;

export const AUDIO_ACCEPT =
  ".mp3,.wav,.ogg,.m4a,.mp4,.aac,.opus,.webm,.flac,audio/mpeg,audio/mp3,audio/wav,audio/wave,audio/x-wav,audio/ogg,audio/mp4,audio/x-m4a,audio/aac,audio/x-aac,audio/opus,audio/webm,audio/flac,audio/x-flac";

const AUDIO_MIME_TYPES = new Set([
  "audio/mpeg",
  "audio/mp3",
  "audio/wav",
  "audio/wave",
  "audio/x-wav",
  "audio/ogg",
  "audio/mp4",
  "audio/x-m4a",
  "audio/aac",
  "audio/x-aac",
  "audio/opus",
  "audio/webm",
  "video/webm",
  "audio/flac",
  "audio/x-flac",
]);

const AUDIO_EXTENSIONS = new Set(["mp3", "wav", "ogg", "m4a", "mp4", "aac", "opus", "webm", "flac"]);

export function audioMimeType(file: File): string {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const mime = file.type.toLowerCase().split(";")[0];
  if (extension === "opus" || mime === "audio/opus") return 'audio/ogg; codecs="opus"';
  const aliases: Record<string, string> = { "audio/mp3": "audio/mpeg", "audio/x-wav": "audio/wav", "audio/wave": "audio/wav", "audio/x-m4a": "audio/mp4", "audio/x-aac": "audio/aac", "audio/x-flac": "audio/flac", "video/webm": "audio/webm" };
  if (file.type) return aliases[mime] || file.type;
  return extension === "mp3"
    ? "audio/mpeg"
    : extension === "wav"
      ? "audio/wav"
      : extension === "ogg"
        ? "audio/ogg"
        : extension === "m4a" || extension === "mp4"
          ? "audio/mp4"
          : extension === "aac" ? "audio/aac"
          : extension === "opus" ? "audio/ogg; codecs=opus"
          : extension === "webm" ? "audio/webm"
          : extension === "flac" ? "audio/flac"
          : "audio/mpeg";
}

export function audioValidationMessage(file: File): string | undefined {
  if (file.size > MAX_AUDIO_FILE_BYTES)
    return "Choose an audio file no larger than 10 MB.";

  const mime = file.type.toLowerCase().split(";")[0];
  const extension = file.name.split(".").pop()?.toLowerCase() || "";
  if (!AUDIO_EXTENSIONS.has(extension) || (mime && !AUDIO_MIME_TYPES.has(mime)))
    return "Choose MP3, WAV, Ogg, M4A, MP4 audio, AAC, Opus, WebM audio, or FLAC. Playback support varies by browser.";

  return undefined;
}

export const AUDIO_COMPATIBILITY_NOTE = "Up to 10 MB per song. MP3 or AAC in M4A is usually the most portable. AAC, Opus, WebM and FLAC depend on the recipient’s browser. Original files are included without conversion.";

/** Checks the selected file using this device's media decoder before replacing
 * a saved song. A successful local decode is not a cross-browser guarantee. */
export async function prepareLocalAudio(file: File, prefix = "audio"): Promise<LocalAudio> {
  const message = audioValidationMessage(file);
  if (message) throw new Error(message);
  if (typeof document === "undefined") throw new Error("Choose music in a browser that can play audio.");
  const audio = document.createElement("audio");
  const mime = audioMimeType(file);
  if (!audio.canPlayType(mime)) throw new Error("This browser cannot play that audio format. Convert a copy to MP3 or M4A, then choose it again. Your existing song is kept.");
  const source = URL.createObjectURL(file);
  const duration = await new Promise<number | undefined>((resolve, reject) => {
    let settled = false;
    const finish = (error?: string) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timer);
      const duration = Number.isFinite(audio.duration) ? audio.duration : undefined;
      audio.onloadeddata = null; audio.onerror = null;
      audio.removeAttribute("src"); audio.load(); revokeObjectUrl(source);
      if (error) reject(new Error(error)); else resolve(duration);
    };
    const timer = window.setTimeout(() => finish("This file could not be decoded in time. Try a smaller MP3 or M4A copy. Your existing song is kept."), 8000);
    audio.preload = "auto";
    audio.onloadeddata = () => finish();
    audio.onerror = () => finish("This audio could not be decoded. It may be damaged or use an unsupported codec. Choose an MP3 or M4A copy; your existing song is kept.");
    audio.src = source;
    audio.load();
  });
  return { ...createLocalAudio(file, prefix), durationSeconds: duration };
}

export function createLocalAudio(file: File, prefix = "audio"): LocalAudio {
  return {
    id: `${prefix}-${crypto.randomUUID?.() || `${Date.now()}-${Math.random()}`}`,
    file,
    previewUrl: URL.createObjectURL(file),
    name: file.name,
    mimeType: audioMimeType(file),
    size: file.size,
  };
}

export function revokeAudioPreview(audio?: LocalAudio): void {
  revokeObjectUrl(audio?.previewUrl);
}

export function hydrateAudioMetadata(audio: LocalAudio): Promise<LocalAudio> {
  if (typeof document === "undefined") return Promise.resolve(audio);
  const source = URL.createObjectURL(audio.file);
  const element = document.createElement("audio");
  element.preload = "metadata";

  return new Promise((resolve) => {
    let settled = false;
    const finish = (durationSeconds?: number) => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeout);
      element.removeAttribute("src");
      element.load();
      revokeObjectUrl(source);
      resolve(
        durationSeconds === undefined
          ? audio
          : { ...audio, durationSeconds },
      );
    };
    const timeout = window.setTimeout(() => finish(), 3000);
    element.onloadedmetadata = () => {
      const duration = element.duration;
      finish(Number.isFinite(duration) && duration >= 0 ? duration : undefined);
    };
    element.onerror = () => finish();
    element.src = source;
  });
}

export function formatAudioDuration(seconds?: number): string | undefined {
  if (seconds === undefined || !Number.isFinite(seconds) || seconds < 0)
    return undefined;
  const wholeSeconds = Math.round(seconds);
  return `${Math.floor(wholeSeconds / 60)}:${String(wholeSeconds % 60).padStart(2, "0")}`;
}

export function defaultSurpriseMusic(
  value?: Partial<SurpriseMusic>,
): SurpriseMusic {
  return {
    loop: true,
    startMuted: false,
    volume: 60,
    ...value,
  };
}

function stripLegacyMusicFields(data: SurpriseData): SurpriseData["content"] {
  if (data.template === "catch-the-heart") {
    const {
      songFile: _songFile,
      songUrl: _songUrl,
      songTitle: _songTitle,
      loopSong: _loopSong,
      startMuted: _startMuted,
      initialVolume: _initialVolume,
      ...content
    } = data.content as CatchTheHeartContent;
    return content;
  }
  if (data.template === "open-when") {
    const { musicFile: _musicFile, ...content } =
      data.content as OpenWhenContent;
    return content;
  }
  return data.content;
}

/**
 * Converts the two pre-shared-music template fields into the canonical music
 * object. This deliberately stays additive and tolerant so old IndexedDB
 * drafts and v1 packages remain readable.
 */
export function normalizeLegacyMusic(data: SurpriseData): SurpriseData {
  const canonicalData =
    data.template === "catch-the-heart"
      ? { ...data, content: normalizeCatchHeartIds(data.content) }
      : data.template === "open-when"
        ? { ...data, content: normalizeOpenWhenEnvelopeIds(data.content) }
        : data.template === "choose-our-date"
          ? { ...data, content: normalizeChooseOurDateIds(data.content) }
      : data;
  const content = canonicalData.content as CatchTheHeartContent & OpenWhenContent;
  const legacyFile =
    canonicalData.template === "catch-the-heart"
      ? (content as CatchTheHeartContent).songFile
      : canonicalData.template === "open-when"
        ? (content as OpenWhenContent).musicFile
        : undefined;
  const legacyUrl =
    canonicalData.template === "catch-the-heart"
      ? (content as CatchTheHeartContent).songUrl
      : undefined;
  const legacyTitle =
    canonicalData.template === "catch-the-heart"
      ? (content as CatchTheHeartContent).songTitle
      : undefined;

  if (!legacyFile && !legacyUrl && !canonicalData.music) return canonicalData;

  const music = defaultSurpriseMusic(canonicalData.music);
  if (!music.file && legacyFile) music.file = legacyFile;
  if (!music.youtubeUrl && legacyUrl) music.youtubeUrl = legacyUrl;
  if (!music.title && (legacyTitle || legacyFile?.name))
    music.title = legacyTitle || legacyFile?.name;
  if (canonicalData.template === "catch-the-heart") {
    music.loop = canonicalData.music?.loop ?? content.loopSong ?? music.loop;
    music.startMuted =
      canonicalData.music?.startMuted ?? content.startMuted ?? music.startMuted;
    music.volume =
      canonicalData.music?.volume ?? content.initialVolume ?? music.volume;
  }

  // The authoring UI treats a local upload and a YouTube URL as alternatives.
  // Keep that same deterministic local-first precedence at every tolerant
  // legacy/import/export boundary so malformed data cannot reach one renderer
  // as two competing sources.
  if (music.file) music.youtubeUrl = undefined;

  return {
    ...canonicalData,
    content: stripLegacyMusicFields(canonicalData),
    music,
  };
}
