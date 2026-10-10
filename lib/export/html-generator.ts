import type {
  CatchTheHeartContent,
  ChooseOurDateContent,
  MemoryQuizContent,
  OpenWhenContent,
  PhotoPuzzleContent,
  SurpriseData,
  OurStorybookContent,
  WishUponAStarContent,
  CozyPlaylistContent,
  LocalImage,
} from "../types";
import { normalizeBuilderStateForExperience } from "../experience-config";
import { embedImages } from "./image-conversion";
import { htmlShell } from "./html-shell";
import { sharedRuntime } from "./shared-runtime";
import { exportThemeCss } from "./theme-runtime";
import { enhancedExportCss } from "./enhanced-theme-runtime";
import { mobileAdaptationCss } from "./mobile-adaptation-runtime";
import { musicRuntimeCss } from "./music-runtime";
import { safeJson, sanitizeFilename } from "./sanitize";
import type {
  ExportEstimate,
  ExportBudgetEstimate,
  ExportBudgetConfidence,
  ExportMediaContribution,
  ExportResult,
  ImageConversionProgress,
} from "./types";
import { heartAssetPath } from "../design-assets";
import { appearanceVisual } from "../appearance";
import { youtubeWatchUrl } from "../youtube";
import { normalizeLegacyMusic } from "../music";
import {
  isPlayableMemoryQuizContent,
  normalizeMemoryQuizData,
} from "../memory-quiz";
import {
  isPlayableStorybookContent,
  normalizeStorybookData,
} from "../storybook";
import {
  isPlayableCozyPlaylistContent,
  normalizeCozyPlaylistData,
} from "../cozy-playlist";
import { collectLocalMediaRefs } from "../local-media";
import { backgroundImagePresentation } from "../image-presentation";
import { formatBytes } from "../format-bytes";
import { normalizePhotoPuzzlePackageData } from "../photo-puzzle-validation";
import { getImportedDataValidationError } from "../import-validation";

export const MAX_HTML_EXPORT_BYTES = 25 * 1024 * 1024;
export const HTML_ESTIMATE_OVERHEAD_BYTES = 100_000;

export function estimateExportSize(data: SurpriseData): ExportEstimate {
  data = normalizeCozyPlaylistData(normalizeLegacyMusic(data));
  let candidates: Array<{ image?: LocalImage; label: string }> = [];
  if (data.template === "catch-the-heart")
    candidates = (data.content as CatchTheHeartContent).hearts.map(
      (x, index) => ({ image: x.photo, label: `Heart ${index + 1}` }),
    );
  else if (data.template === "photo-puzzle")
    candidates = [
      { image: (data.content as PhotoPuzzleContent).photo, label: "Puzzle image" },
    ];
  else if (data.template === "open-when")
    candidates = (data.content as OpenWhenContent).envelopes.map(
      (x, index) => ({ image: x.photo, label: `Letter ${index + 1} photo` }),
    );
  else if (data.template === "choose-our-date")
    candidates = (data.content as ChooseOurDateContent).rounds.flatMap(
      (round, roundIndex) =>
        round.options.map((x, optionIndex) => ({
          image: x.photo,
          label: `Date round ${roundIndex + 1}, option ${optionIndex + 1}`,
        })),
    );
  else if (data.template === "memory-quiz")
    candidates = (data.content as MemoryQuizContent).questions.map(
      (x, index) => ({ image: x.photo, label: `Quiz memory ${index + 1}` }),
    );
  else if (data.template === "our-storybook")
    candidates = (data.content as OurStorybookContent).pages.map(
      (x, index) => ({ image: x.photo, label: `Story page ${index + 1}` }),
    );
  else if (data.template === "wish-upon-a-star")
    candidates = (data.content as WishUponAStarContent).stars.map(
      (x, index) => ({ image: x.photo, label: `Wish ${index + 1}` }),
    );
  else if (data.template === "cozy-playlist")
    candidates = (data.content as CozyPlaylistContent).tracks.map(
      (x, index) => ({ image: x.photo, label: `Playlist song ${index + 1}` }),
    );
  candidates.push(
    { image: data.appearance.backgroundImage, label: "Custom background" },
    { image: data.delight?.coverPhoto, label: "Cover photo" },
  );
  // Keep media accounting aligned with the normalized export traversal. Each
  // Cozy track occurrence is intentionally counted because HTML embeds each
  // track's audio payload separately; lifecycle-only deduplication belongs to
  // local-media.ts, not this export estimate.
  const mediaRefs = collectLocalMediaRefs(data);
  const photos = candidates.filter(
    (candidate): candidate is { image: LocalImage; label: string } =>
      Boolean(candidate.image),
  );
  const contributors: ExportMediaContribution[] = photos.map(({ image, label }) => ({
    kind: "image",
    label,
    name: image.name,
    originalBytes: image.size,
    // Before the async preflight resolves, use the exact source bytes as a
    // safe lower-bound payload. Images are only replaced with smaller
    // optimized blobs during the real conversion step.
    embeddedBytes: image.size,
  }));
  const videoLabels = new Map<string, string>();
  if (data.template === "open-when") {
    (data.content as OpenWhenContent).envelopes.forEach((envelope, index) => {
      if (envelope.video) videoLabels.set(envelope.video.id, `Letter ${index + 1} video`);
    });
  }
  for (const ref of mediaRefs.filter((item) => item.kind !== "image")) {
    contributors.push({
      kind: ref.kind,
      mediaId: ref.media.id,
      label: ref.kind === "audio" ? "Audio" : videoLabels.get(ref.media.id) || "Video",
      name: ref.media.name,
      originalBytes: ref.media.size,
      embeddedBytes: ref.media.size,
    });
  }
  const sourceBytes = contributors.reduce(
    (sum, contribution) => sum + contribution.originalBytes,
    0,
  );
  const estimatedBytes =
    HTML_ESTIMATE_OVERHEAD_BYTES +
    contributors.reduce(
      (sum, contribution) =>
        sum + 4 * Math.ceil(contribution.embeddedBytes / 3) + 96,
      0,
    );
  return {
    photoCount: photos.length,
    sourceBytes,
    estimatedBytes,
    contributors,
    level:
      estimatedBytes > 15000000
        ? "warning"
        : estimatedBytes > 5000000
          ? "large"
          : "good",
  };
}

const budgetState = (bytes: number): ExportBudgetEstimate["state"] => {
  const ratio = bytes / MAX_HTML_EXPORT_BYTES;
  if (ratio > 1) return "over-limit";
  if (ratio >= 0.8) return "near-limit";
  if (ratio >= 0.6) return "large";
  return "safe";
};

/**
 * Converts actual embedded payload bytes into the same base64 shape that the
 * HTML document will carry. It is occurrence-aware: repeated references are
 * intentionally repeated in the contribution list.
 */
export function estimateExportBudgetFromContributions(
  data: SurpriseData,
  contributions: ExportMediaContribution[],
  confidence: ExportBudgetConfidence = "approximate",
): ExportBudgetEstimate {
  const fallback = estimateExportSize(data);
  const embeddedPayload = contributions.reduce(
    (sum, contribution) =>
      sum + 4 * Math.ceil(contribution.embeddedBytes / 3) + 96,
    0,
  );
  const predictedBytes = HTML_ESTIMATE_OVERHEAD_BYTES + embeddedPayload;
  const conservativeBytes =
    predictedBytes + Math.max(256 * 1024, Math.ceil(embeddedPayload * 0.05));
  const state = budgetState(conservativeBytes);
  return {
    ...fallback,
    sourceBytes: contributions.reduce(
      (sum, contribution) => sum + contribution.originalBytes,
      0,
    ),
    estimatedBytes: predictedBytes,
    limitBytes: MAX_HTML_EXPORT_BYTES,
    originalBytes: contributions.reduce(
      (sum, contribution) => sum + contribution.originalBytes,
      0,
    ),
    predictedBytes,
    conservativeBytes,
    confidence,
    state,
    level: state === "safe" ? "good" : state === "large" ? "large" : "warning",
  };
}
export function containsBlobUrl(html: string) {
  return /(?:["'(=]|\b)blob:/i.test(html);
}
const exportReferenceKeys = new Set(["previewUrl", "photoUrl", "dataUrl", "heartAssetDataUrl", "url", "youtubeUrl", "songUrl", "link"]);
function unresolvedReference(value: string): boolean {
  return /^(?:blob:|file:|capacitor:|filesystem:|ionic:|\/(?:_next|create|s)\/)/i.test(value) ||
    /^(?:https?:\/\/)?(?:localhost|127\.0\.0\.1)(?::\d+)?(?:[/?#]|$)/i.test(value);
}
function hasUnresolvedConfigReference(value: unknown): boolean {
  if (Array.isArray(value)) return value.some(hasUnresolvedConfigReference);
  if (!value || typeof value !== "object") return false;
  return Object.entries(value).some(([key, child]) =>
    exportReferenceKeys.has(key) && typeof child === "string" ? unresolvedReference(child) : hasUnresolvedConfigReference(child));
}
/** Inspect references, not prose that happens to mention framework or host names. */
export function containsUnresolvedLocalReference(html: string) {
  const configuration = html.match(/window\.__TINY_SURPRISE__=([\s\S]*?)<\/script>/);
  if (configuration) {
    try { if (hasUnresolvedConfigReference(JSON.parse(configuration[1]))) return true; }
    catch { return true; }
  }
  const markup = html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  return Array.from(markup.matchAll(/(?:src|href)=["']([^"']*)["']/gi)).some((match) => unresolvedReference(match[1]));
}
export function obfuscatePassphrase(value: string) {
  let result = 2166136261;
  for (const character of value
    .trim()
    .toLocaleLowerCase()
    .replace(/\s+/g, " ")) {
    result ^= character.charCodeAt(0);
    result = Math.imul(result, 16777619);
  }
  return (result >>> 0).toString(36);
}

const audioToDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () =>
      typeof reader.result === "string"
        ? resolve(reader.result)
        : reject(new Error("Could not read audio data"));
    reader.onerror = () => reject(new Error("Could not read audio data"));
    reader.readAsDataURL(file);
  });
const publicAssetToDataUrl = async (path: string) => {
  const response = await fetch(path);
  if (!response.ok) throw new Error("asset");
  return audioToDataUrl(await response.blob());
};

function appearanceCss(data: Pick<SurpriseData, "appearance">) {
  const visual = appearanceVisual(data.appearance);
  const surface = visual.tokens.surface,
    soft = visual.dark ? visual.tokens.elevatedSurface : `${visual.primary}22`,
    border = visual.tokens.border;
  const motion =
    "html,body{min-height:100dvh}#app{min-height:100dvh}" +
    ":root{--motion-standard:.2s;--motion-ease:cubic-bezier(.16,1,.3,1)}button,.card,.notice,.date-choice,.letter-envelope{transition-duration:var(--motion-standard);transition-timing-function:var(--motion-ease)}" +
    (data.appearance.animationIntensity === "reduced"
      ? "*{animation-duration:.01ms!important;animation-iteration-count:1!important;transition-duration:.01ms!important}"
      : data.appearance.animationIntensity === "playful"
        ? ".card,.notice{transition:transform var(--motion-standard) var(--motion-ease),box-shadow var(--motion-standard) var(--motion-ease)}.card:hover{transform:translateY(-3px);box-shadow:0 28px 80px color-mix(in srgb,var(--brand) 28%,transparent)}"
        : "") +
    ".topline{justify-content:flex-end;margin-bottom:24px}.card{backdrop-filter:none}.date-round{max-width:760px;margin:22px auto 0;padding-top:4px}.playlist-grid{display:grid;gap:10px}.playlist-track{display:grid;width:100%;gap:6px;padding:14px;text-align:left;color:var(--text);background:color-mix(in srgb,var(--surface) 94%,transparent);border:1px solid var(--border);border-radius:16px;cursor:pointer}.playlist-track.selected{border-color:var(--brand);background:color-mix(in srgb,var(--brand) 12%,var(--surface))}.playlist-track .photo{width:100%;max-height:420px;object-fit:contain;border-radius:12px}.playlist-now audio{display:block;width:100%;margin:18px 0}.playlist-now .photo{width:100%;max-height:420px;object-fit:contain;border-radius:12px}";
  const image = data.appearance.backgroundImage?.previewUrl;
  const backgroundPresentation = backgroundImagePresentation(
    data.appearance.backgroundImage?.presentation,
  );
  const cssUrl = image?.replace(/["\\\n\r]/g, (character) => `\\${character}`);
  const semanticTokens = `:root{--surface-text:${visual.tokens.surfaceForeground};--surface-muted:${visual.tokens.surfaceMutedForeground};--elevated-surface:${visual.tokens.elevatedSurface};--elevated-text:${visual.tokens.elevatedSurfaceForeground};--elevated-muted:${visual.tokens.elevatedSurfaceMutedForeground};--primary-foreground:${visual.tokens.primaryForeground};--secondary-foreground:${visual.tokens.secondaryForeground};--muted-foreground:${visual.tokens.mutedSurfaceForeground};--experience-surface-foreground:${visual.tokens.surfaceForeground};--experience-surface-muted:${visual.tokens.surfaceMutedForeground};--experience-surface-elevated-foreground:${visual.tokens.elevatedSurfaceForeground};--experience-surface-elevated-muted:${visual.tokens.elevatedSurfaceMutedForeground}}.card,.cover-inner,.dialog,.date-change-dialog,.catch-final__panel,.date-choice,.playlist-track,.letter-envelope,.catch-chip{color:var(--surface-text)}.date-plan-item,.storybook-spread{color:var(--elevated-text)}.card .opening,.card .music-status,.card .notice,.cover-inner .opening,.cover-inner .music-status{color:var(--surface-muted)}.card button:not(.primary),.cover-inner button:not(.primary),.dialog button:not(.primary),.date-choice button:not(.primary){color:var(--surface-text)}.heart-dialog__progress,.heart-dialog__close,.heart-dialog__body .note--secondary{color:var(--surface-muted)}.heart-dialog__close:hover{color:var(--surface-text)}`;
  const custom = semanticTokens + (image
    ? `body::before,body::after,.opening-flourish::before,.opening-flourish::after{content:'';position:fixed;inset:0;pointer-events:none}body::before,.opening-flourish::before{z-index:0;background:url("${cssUrl}") ${backgroundPresentation.focalX * 100}% ${backgroundPresentation.focalY * 100}%/cover no-repeat;transform:scale(${backgroundPresentation.mode === "custom" ? backgroundPresentation.zoom : 1});transform-origin:${backgroundPresentation.focalX * 100}% ${backgroundPresentation.focalY * 100}%}body::after,.opening-flourish::after{z-index:1;background:${visual.backdropOverlay}}#app{z-index:2}`
    : "");
  return `:root{--canvas:${visual.tokens.canvas};--surface:${surface};--soft:${soft};--inset:${soft};--text:${visual.tokens.foreground};--muted:${visual.tokens.mutedForeground};--brand:${visual.primary};--accent:${visual.tokens.accent};--border:${border};--focus:${visual.tokens.focus};--overlay:${visual.tokens.overlay};--experience-canvas:${visual.tokens.canvas};--experience-foreground:${visual.tokens.foreground};--experience-muted:${visual.tokens.mutedForeground};--experience-surface:${visual.tokens.surface};--experience-surface-foreground:${visual.tokens.surfaceForeground};--experience-surface-muted:${visual.tokens.surfaceMutedForeground};--experience-surface-elevated:${visual.tokens.elevatedSurface};--experience-surface-elevated-foreground:${visual.tokens.elevatedSurfaceForeground};--experience-surface-elevated-muted:${visual.tokens.elevatedSurfaceMutedForeground};--experience-border:${visual.tokens.border};--experience-overlay:${visual.tokens.overlay};--experience-accent:${visual.tokens.accent};--experience-focus:${visual.tokens.focus};--experience-primary-foreground:${visual.tokens.primaryForeground};--experience-accent-foreground:${visual.tokens.accentForeground};--secondary-foreground:${visual.tokens.secondaryForeground};--muted-foreground:${visual.tokens.mutedSurfaceForeground};--shadow:0 24px 70px ${visual.primary}33;--scene-treatment:${visual.treatment}}html,body{font-family:${visual.font};color:var(--text)}body{position:relative;isolation:isolate;background:var(--scene-treatment);background-attachment:fixed;background-size:cover}#app{position:relative;z-index:0}.page{position:relative;z-index:1}.cover{background:transparent!important}.opening-flourish{background:var(--scene-treatment);background-size:cover;isolation:isolate;pointer-events:auto}.opening-flourish>*{position:relative;z-index:2}.card{backdrop-filter:none}button{min-height:48px}.field input{min-height:48px}.cover{min-height:100dvh;overflow:auto}.primary{color:var(--experience-primary-foreground)}a.primary{display:inline-flex;min-height:48px;align-items:center;justify-content:center;padding:11px 16px;border-radius:14px;text-decoration:none}a:focus-visible{outline:2px solid var(--focus);outline-offset:2px}${custom}${motion}`;
}

export async function generateHtml(
  data: SurpriseData,
  onProgress?: (progress: ImageConversionProgress) => void,
): Promise<ExportResult> {
  // Canonicalize before any validation, media embedding, or recipient
  // normalization so legacy Catch/Open When audio can never be serialized as
  // a second hidden payload at an export boundary.
  data = normalizeCozyPlaylistData(
    normalizeStorybookData(normalizeMemoryQuizData(normalizeLegacyMusic(data))),
  );
  data = normalizePhotoPuzzlePackageData(data);
  const validationError = await getImportedDataValidationError(data);
  if (validationError) throw new Error(validationError);
  if (
    data.template === "memory-quiz" &&
    !isPlayableMemoryQuizContent(data.content, "compatibility")
  ) {
    throw new Error("Complete the Memory Quiz before creating the file.");
  }
  if (
    data.template === "our-storybook" &&
    !isPlayableStorybookContent(data.content, "compatibility")
  ) {
    throw new Error("Complete the Storybook before creating the file.");
  }
  if (
    data.template === "cozy-playlist" &&
    !isPlayableCozyPlaylistContent(data.content, "compatibility")
  ) {
    throw new Error("Complete the Cozy Playlist before creating the file.");
  }
  if (
    data.template === "photo-puzzle" &&
    !(data.content as PhotoPuzzleContent).photo
  )
    throw new Error("Choose a photo for the puzzle before creating the file.");
  if (
    data.delight?.passphraseEnabled &&
    !(
      (data.delight.passphraseMode === "choice" &&
        data.delight.passphraseChoices?.[
          data.delight.passphraseCorrectChoiceIndex ?? 0
        ]?.trim()) ||
      data.delight.passphraseAnswers?.some((answer) => answer.trim()) ||
      data.delight.passphrase.trim()
    )
  )
    throw new Error(
      "Add the accepted answer for the playful secret question before creating the file.",
    );
  const mediaContributions: ExportMediaContribution[] = [];
  let embedded = await embedImages(data, onProgress, (contribution) => {
    mediaContributions.push(contribution);
  });
  if (data.template === "catch-the-heart") {
    const heartStyle =
      (data.content as CatchTheHeartContent).heartStyle || "classic";
    let heartAssetDataUrl = "";
    try {
      heartAssetDataUrl = await publicAssetToDataUrl(
        heartAssetPath(heartStyle),
      );
    } catch {}
    embedded = {
      ...embedded,
      content: { ...embedded.content, heartStyle, heartAssetDataUrl },
    } as typeof embedded;
  }
  const selectedChoice =
    embedded.delight?.passphraseMode === "choice"
      ? embedded.delight.passphraseChoices?.[
          embedded.delight.passphraseCorrectChoiceIndex ?? 0
        ]?.trim()
      : undefined;
  const answers = selectedChoice
    ? [selectedChoice]
    : embedded.delight?.passphraseAnswers?.filter((answer) => answer.trim()) ||
      (embedded.delight?.passphrase ? [embedded.delight.passphrase] : []);
  const delight = embedded.delight
    ? {
        ...embedded.delight,
        passphrase: "",
        passphraseAnswers: undefined,
        passphraseHash: undefined,
        passphraseHashes: embedded.delight.passphraseEnabled
          ? answers.map(obfuscatePassphrase)
          : undefined,
      }
    : undefined;
  const normalizedInput = {
    ...embedded,
    delight,
  };
  const baseNormalized = normalizeBuilderStateForExperience(normalizedInput);
  // Keep the original URL for authoring, but put a canonical watch URL in the
  // standalone file. This is important for `file://` exports: a youtu.be or
  // embed URL with an appended autoplay query is not consistently honored by
  // browsers when opened from a local document.
  const canonicalMusicUrl = baseNormalized.music.videoId
    ? youtubeWatchUrl(baseNormalized.music.videoId) ||
      baseNormalized.music.url
    : baseNormalized.music.url;
  const normalized = {
    ...baseNormalized,
    music: {
      ...baseNormalized.music,
      url: canonicalMusicUrl,
    },
  };
  if (hasUnresolvedConfigReference(normalized)) throw new Error("An image, audio file, or link still points to temporary local storage. Choose it again before exporting.");
  const json = safeJson(normalized);
  const title = `A TinySurprise for ${embedded.basics.recipientName.replace(/[<>&"]/g, "")}`;
  const runtime = sharedRuntime.replace("__YOUTUBE_WATCH__", normalized.music.videoId ? "https://www.youtube.com/watch?v=" : "");
  const html = htmlShell(
    title,
    json,
    exportThemeCss +
      enhancedExportCss +
      mobileAdaptationCss +
      musicRuntimeCss +
    appearanceCss({ appearance: normalized.appearance }),
    runtime,
  );
  if (containsUnresolvedLocalReference(html))
    throw new Error(
      "The downloaded file still contains a browser-only photo or internal link. Choose the affected photo again and retry.",
    );
  const blob = new Blob([html], { type: "text/html;charset=utf-8" });
  if (blob.size > MAX_HTML_EXPORT_BYTES)
    throw new Error(
      `The finished file is over 25 MB (${formatBytes(blob.size)}). Remove or replace the largest media: ${mediaContributions
        .slice()
        .sort((a, b) => b.embeddedBytes - a.embeddedBytes)
        .slice(0, 3)
        .map((item) => `${item.label} (${formatBytes(item.embeddedBytes)})`)
        .join(", ") || "embedded media"}.`,
    );
  return {
    html,
    blob,
    bytes: blob.size,
    filename: sanitizeFilename(embedded.basics.recipientName || ""),
    mediaContributions,
  };
}
