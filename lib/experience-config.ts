import type { ExportableData } from "./export/types";
import { isKnownBackgroundStyleId } from "./background-styles";
import {
  OPENING_STYLES as OPENING_STYLE_CONFIGS,
  THEME_CONFIGS,
} from "./config";
import {
  normalizeHttpUrl,
  normalizeRenderableImageUrl,
  normalizeRenderableVideoUrl,
} from "./safe-url";
import type {
  CozyPlaylistContent,
  PhotoPuzzleContent,
  SurpriseData,
  TemplateType,
} from "./types";
import { parseYouTubeUrl } from "./youtube";
import { normalizeImagePresentation } from "./image-presentation";
import {
  getCollectionLimitErrors,
  getTemplateExperienceDefinition,
} from "./template-experience-definitions";
import { resolveExperienceCompletionParts } from "./experience-completion";
import { normalizeCatchHeartIds } from "./heart-memories";
import { normalizeOpenWhenEnvelopeIds } from "./open-when";
import { normalizeChooseOurDateIds } from "./choose-our-date";
import {
  isPlayableMemoryQuizContent,
  normalizeMemoryQuizQuestionIds,
} from "./memory-quiz";
import {
  isPlayableStorybookContent,
  normalizeStorybookContent,
} from "./storybook";
import {
  isPlayableCozyPlaylistContent,
  normalizeCozyPlaylistContent,
} from "./cozy-playlist";
import { isAcceptedTemplateType } from "./template-registry";
import {
  ANIMATION_INTENSITY_VALUES,
  BACKGROUND_FILTER_VALUES,
  BACKGROUND_STYLE_VALUES,
  EXPIRATION_VALUES,
  FONT_PAIRING_VALUES,
} from "./validation-catalogs";

export interface RecipientExperienceConfig {
  template: TemplateType;
  sender: string;
  recipient: string;
  occasion?: string;
  openingMessage: string;
  cover: {
    enabled: boolean;
    message: string;
    photo?: { previewUrl: string };
    openingStyle: string;
  };
  passphraseHash?: string;
  passphraseHashes?: string[];
  passphraseQuestion?: string;
  passphraseMode?: "text" | "choice";
  passphraseChoices?: string[];
  appearance: SurpriseData["appearance"];
  music: {
    source?: "youtube" | "upload";
    url?: string;
    videoId?: string;
    dataUrl?: string;
    title?: string;
    durationSeconds?: number;
    loop: boolean;
    startMuted: boolean;
    volume: number;
  };
  content: ExportableData["content"] | SurpriseData["content"];
  closingMessage: string;
  signature: string;
  completion: import("./experience-completion").ExperienceCompletion;
  progress: { unit: string; activeLabel: string };
  expiration: SurpriseData["delivery"]["expiration"];
}

const UNSAFE_ATTRIBUTE_CHARACTERS = /[\u0000-\u001f\u007f"'<>`\\]/;
const MAX_RECOVERY_ITEMS = 20;
const MAX_RECOVERY_TEXT = 10_000;
const MAX_RECOVERY_AUDIO_DATA = 14 * 1024 * 1024;
const THEMES = new Set(Object.keys(THEME_CONFIGS));
const OPENING_STYLES = new Set<string>(
  OPENING_STYLE_CONFIGS.map((style) => style.value),
);
const BACKGROUND_STYLES = new Set<string>(BACKGROUND_STYLE_VALUES);
const BACKGROUND_FILTERS = new Set<string>(BACKGROUND_FILTER_VALUES);
const FONT_PAIRINGS = new Set<string>(FONT_PAIRING_VALUES);
const ANIMATION_INTENSITIES = new Set<string>(ANIMATION_INTENSITY_VALUES);
const EXPIRATIONS = new Set<string>(EXPIRATION_VALUES);

function safeImageUrl(value?: string): string | undefined {
  const normalized = normalizeRenderableImageUrl(value);
  return normalized && !UNSAFE_ATTRIBUTE_CHARACTERS.test(normalized)
    ? normalized
    : undefined;
}

function safeVideoUrl(value?: string): string | undefined {
  const normalized = normalizeRenderableVideoUrl(value);
  return normalized && !UNSAFE_ATTRIBUTE_CHARACTERS.test(normalized)
    ? normalized
    : undefined;
}

/**
 * Imported drafts are user-controlled plain data. Sanitize every image-shaped
 * object once before it reaches an HTML-string runtime. Invalid image objects
 * are omitted instead of leaving a broken or executable URL behind.
 */
function sanitizeRenderableImages(value: unknown, depth = 0): unknown {
  if (depth > 8) return undefined;
  if (Array.isArray(value))
    return value
      .slice(0, MAX_RECOVERY_ITEMS)
      .map((item) => sanitizeRenderableImages(item, depth + 1))
      .filter((item) => item !== undefined);
  if (!value || typeof value !== "object") return value;

  const prototype = Object.getPrototypeOf(value);
  if (prototype !== Object.prototype && prototype !== null) return value;

  const record = value as Record<string, unknown>;
  if ("previewUrl" in record) {
    const previewValue =
      typeof record.previewUrl === "string" ? record.previewUrl : undefined;
    const previewUrl =
      typeof record.mimeType === "string" &&
      record.mimeType.startsWith("video/")
        ? safeVideoUrl(previewValue)
        : safeImageUrl(previewValue);
    if (!previewUrl) return undefined;
    const sanitized = Object.fromEntries(
      Object.entries(record)
        .slice(0, 64)
        .filter(([key]) => key !== "file" && key !== "previewUrl")
        .map(([key, nested]) => [
          key,
          sanitizeRenderableImages(nested, depth + 1),
        ])
        .filter((entry) => entry[1] !== undefined)
        .concat([["previewUrl", previewUrl]]),
    );
    if (
      typeof record.mimeType === "string" &&
      record.mimeType.startsWith("image/")
    ) {
      (sanitized as Record<string, unknown>).presentation =
        normalizeImagePresentation(
          record.presentation as Partial<import("./types").ImagePresentation> | undefined,
          record.imageFit === "contain" || record.imageFit === "cover"
            ? record.imageFit
            : undefined,
        );
    }
    return sanitized;
  }

  return Object.fromEntries(
    Object.entries(record)
      .slice(0, 64)
      .map(([key, nested]) => [
        key,
        sanitizeRenderableImages(nested, depth + 1),
      ])
      .filter((entry) => entry[1] !== undefined),
  );
}

function sanitizeContent(
  template: TemplateType,
  content: ExportableData["content"] | SurpriseData["content"],
) {
  const sanitized = sanitizeRenderableImages(content) as typeof content;
  if (template === "catch-the-heart")
    return normalizeCatchHeartIds(sanitized) as typeof content;
  if (template === "open-when")
    return normalizeOpenWhenEnvelopeIds(sanitized) as typeof content;
  if (template === "choose-our-date")
    return normalizeChooseOurDateIds(sanitized) as typeof content;
  if (template === "memory-quiz")
    return normalizeMemoryQuizQuestionIds(sanitized) as typeof content;
  if (template === "our-storybook")
    return normalizeStorybookContent(sanitized) as typeof content;
  if (template === "photo-puzzle") {
    const puzzle = sanitized as PhotoPuzzleContent;
    return {
      ...puzzle,
      photo: puzzle.photo
        ? {
            ...puzzle.photo,
            presentation: normalizeImagePresentation(
              puzzle.photo.presentation,
              puzzle.imageFit,
            ),
          }
        : undefined,
    } as typeof content;
  }
  if (template !== "cozy-playlist") return sanitized;

  const playlist = normalizeCozyPlaylistContent(sanitized) as CozyPlaylistContent;
  return {
    ...playlist,
    tracks: Array.isArray(playlist.tracks)
      ? playlist.tracks.map((track) => ({
          ...track,
          link: normalizeHttpUrl(track.link) || "",
        }))
      : [],
  } as typeof content;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) return false;
  const prototype = Object.getPrototypeOf(value);
  return prototype === Object.prototype || prototype === null;
}

function normalizeAppearance(value: unknown): SurpriseData["appearance"] {
  const appearance = isRecord(value) ? value : {};
  const theme = THEMES.has(appearance.theme as string)
    ? appearance.theme
    : "soft-rose";
  const animationIntensity = ANIMATION_INTENSITIES.has(
    appearance.animationIntensity as string,
  )
    ? appearance.animationIntensity
    : "normal";
  const accentColor =
    typeof appearance.accentColor === "string" &&
    /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(appearance.accentColor)
      ? appearance.accentColor
      : undefined;
  const backgroundStyle = BACKGROUND_STYLES.has(
    appearance.backgroundStyle as string,
  )
    ? appearance.backgroundStyle
    : undefined;
  const backgroundFilter = BACKGROUND_FILTERS.has(
    appearance.backgroundFilter as string,
  )
    ? appearance.backgroundFilter
    : undefined;
  const fontPairing = FONT_PAIRINGS.has(appearance.fontPairing as string)
    ? appearance.fontPairing
    : undefined;
  const backgroundImage = sanitizeRenderableImages(
    appearance.backgroundImage,
  ) as SurpriseData["appearance"]["backgroundImage"];
  const backgroundStyleId = isKnownBackgroundStyleId(
    appearance.backgroundStyleId,
  )
    ? appearance.backgroundStyleId
    : undefined;

  return {
    theme: theme as SurpriseData["appearance"]["theme"],
    animationIntensity:
      animationIntensity as SurpriseData["appearance"]["animationIntensity"],
    ...(accentColor ? { accentColor } : {}),
    ...(backgroundStyle
      ? {
          backgroundStyle:
            backgroundStyle as SurpriseData["appearance"]["backgroundStyle"],
        }
      : {}),
    ...(backgroundFilter
      ? {
          backgroundFilter:
            backgroundFilter as SurpriseData["appearance"]["backgroundFilter"],
        }
      : {}),
    ...(fontPairing
      ? {
          fontPairing:
            fontPairing as SurpriseData["appearance"]["fontPairing"],
        }
      : {}),
    ...(backgroundImage ? { backgroundImage } : {}),
    ...(backgroundStyleId ? { backgroundStyleId } : {}),
  };
}

function boundedText(value: unknown, fallback = ""): string {
  return typeof value === "string"
    ? value.slice(0, MAX_RECOVERY_TEXT)
    : fallback;
}

function boundedImportedValue(
  value: unknown,
  key = "",
  depth = 0,
): unknown {
  if (depth > 8) return undefined;
  if (typeof value === "string") {
    if (key === "dataUrl")
      return value.length <= MAX_RECOVERY_AUDIO_DATA &&
        /^data:audio\/(?:mpeg|mp3|wav|x-wav|ogg|mp4|x-m4a);base64,[a-z0-9+/=\s]+$/i.test(
          value,
        )
        ? value
        : undefined;
    if (key === "heartAssetDataUrl") return undefined;
    return boundedText(value);
  }
  if (
    value === null ||
    typeof value === "boolean" ||
    (typeof value === "number" && Number.isFinite(value))
  )
    return value;
  if (Array.isArray(value))
    return value
      .map((item) => boundedImportedValue(item, key, depth + 1))
      .filter((item) => item !== undefined);
  if (!isRecord(value)) return undefined;
  return Object.fromEntries(
    Object.entries(value)
      .slice(0, 64)
      .map(([nestedKey, nested]) => [
        nestedKey,
        boundedImportedValue(nested, nestedKey, depth + 1),
      ])
      .filter((entry) => entry[1] !== undefined),
  );
}

function isString(value: unknown): value is string {
  return typeof value === "string";
}

function recordsIn(
  content: Record<string, unknown>,
  key: string,
  minimum = 1,
  maximum = MAX_RECOVERY_ITEMS,
): Array<Record<string, unknown>> | null {
  const items = content[key];
  if (
    !Array.isArray(items) ||
    items.length < minimum ||
    items.length > maximum ||
    !items.every(isRecord)
  )
    return null;
  return items;
}

function compatibilityMax(template: TemplateType, fallback: number): number {
  if (template === "wish-upon-a-star") return fallback;
  return getTemplateExperienceDefinition(template).limits.compatibilityMax ?? fallback;
}

function progressDefinition(template: TemplateType): { unit: string; activeLabel: string } {
  if (template === "wish-upon-a-star")
    return { unit: "wishes", activeLabel: "{current} wishes discovered" };
  return getTemplateExperienceDefinition(template).progress;
}

function hasRequiredStrings(
  items: Array<Record<string, unknown>>,
  keys: string[],
) {
  return items.every((item) => keys.every((key) => isString(item[key])));
}

function contentIsRecoverable(
  template: TemplateType,
  value: unknown,
): value is RecipientExperienceConfig["content"] {
  if (!isRecord(value)) return false;

  if (template === "catch-the-heart") {
    const hearts = recordsIn(value, "hearts", 1, compatibilityMax(template, 20));
    return Boolean(
      hearts &&
        hasRequiredStrings(hearts, ["id", "message"]) &&
        isString(value.finalMessage) &&
        typeof value.soundEffects === "boolean" &&
        (value.heartStyle === undefined ||
          ["classic", "doodle", "pixel"].includes(String(value.heartStyle))),
    );
  }
  if (template === "photo-puzzle")
    return (
      isString(value.difficulty) &&
      ["easy", "medium", "hard"].includes(value.difficulty) &&
      isString(value.completionMessage) &&
      (value.finalMessage === undefined || isString(value.finalMessage)) &&
      (value.imageFit === undefined ||
        value.imageFit === "contain" ||
        value.imageFit === "cover")
    );
  if (template === "open-when") {
    const envelopes = recordsIn(value, "envelopes", 2, compatibilityMax(template, 6));
    return Boolean(
      envelopes &&
        hasRequiredStrings(envelopes, ["id", "title", "message"]) &&
        isString(value.finalMessage),
    );
  }
  if (template === "choose-our-date") {
    const rounds = recordsIn(value, "rounds", 2, compatibilityMax(template, 5));
    if (!rounds || !isRecord(value.result)) return false;
    return (
      rounds.every((round) => {
        const options = recordsIn(round, "options", 2, 4);
        return Boolean(
          isString(round.id) &&
            isString(round.question) &&
            options &&
            hasRequiredStrings(options, ["id", "title", "details"]),
        );
      }) &&
      hasRequiredStrings([value.result], [
        "title",
        "description",
        "details",
        "invitation",
      ])
    );
  }
  if (template === "memory-quiz") {
    return isPlayableMemoryQuizContent(value, "compatibility");
  }
  if (template === "our-storybook") {
    const pages = recordsIn(value, "pages", 2, compatibilityMax(template, 20));
    return Boolean(
      pages &&
        hasRequiredStrings(pages, ["id", "title", "body"]) &&
      isString(value.finalMessage),
    );
  }
  if (template === "cozy-playlist")
    return isPlayableCozyPlaylistContent(value, "compatibility");
  if (template === "wish-upon-a-star") {
    const stars = recordsIn(value, "stars", 3, 9);
    return Boolean(
      stars &&
        hasRequiredStrings(stars, [
          "id",
          "wish",
          "message",
          "color",
        ]) &&
        stars.every((star) =>
          /^#[0-9a-f]{6}(?:[0-9a-f]{2})?$/i.test(String(star.color)),
        ) &&
        isString(value.finalMessage),
    );
  }
  return false;
}

/**
 * Parse an exported experience before restoring it into the builder.
 *
 * The return value is deliberately normalized rather than being a simple
 * boolean type guard: imported JSON can be structurally plausible while still
 * containing oversized arrays, unsupported themes, or unsafe URLs.
 */
export function parseRecipientExperienceConfig(
  value: unknown,
): RecipientExperienceConfig | null {
  if (!isRecord(value) || !isAcceptedTemplateType(value.template))
    return null;
  if (
    !isRecord(value.cover) ||
    !isRecord(value.appearance) ||
    !isRecord(value.music)
  )
    return null;

  const template = value.template as TemplateType;
  if (template !== "wish-upon-a-star") {
    const limitError = getCollectionLimitErrors(
      template,
      value.content,
    )[0];
    if (limitError) return null;
  }
  const boundedContent = boundedImportedValue(
    sanitizeRenderableImages(value.content),
  );
  const sanitizedContent =
    template === "catch-the-heart"
      ? normalizeCatchHeartIds(boundedContent)
      : template === "open-when"
        ? normalizeOpenWhenEnvelopeIds(boundedContent)
        : template === "choose-our-date"
          ? normalizeChooseOurDateIds(boundedContent)
        : template === "memory-quiz"
            ? normalizeMemoryQuizQuestionIds(boundedContent)
          : template === "our-storybook"
            ? normalizeStorybookContent(boundedContent)
          : template === "cozy-playlist"
            ? normalizeCozyPlaylistContent(boundedContent)
        : boundedContent;
  if (
    template === "our-storybook" &&
    !isPlayableStorybookContent(sanitizedContent, "compatibility")
  )
    return null;
  if (
    template === "cozy-playlist" &&
    !isPlayableCozyPlaylistContent(sanitizedContent, "compatibility")
  )
    return null;
  if (!contentIsRecoverable(template, sanitizedContent)) return null;

  const appearance = normalizeAppearance(value.appearance);
  const coverPhoto = sanitizeRenderableImages(value.cover.photo) as
    | { previewUrl: string }
    | undefined;
  const youtubeUrl = normalizeHttpUrl(
    typeof value.music.url === "string" ? value.music.url : undefined,
  );
  const dataUrl = boundedImportedValue(value.music.dataUrl, "dataUrl");
  const validDataUrl = typeof dataUrl === "string" ? dataUrl : undefined;
  const youtube = validDataUrl
    ? null
    : parseYouTubeUrl(youtubeUrl || undefined);
  const volume = Number(value.music.volume);
  const durationSeconds = Number(value.music.durationSeconds);
  const content = sanitizeContent(template, sanitizedContent);
  const completion = resolveExperienceCompletionParts(
    template,
    content,
    boundedText(value.closingMessage),
    boundedText(value.signature),
  );
  const openingStyle = OPENING_STYLES.has(value.cover.openingStyle as string)
    ? value.cover.openingStyle
    : "gentle-fade";
  const expiration = EXPIRATIONS.has(value.expiration as string)
    ? value.expiration
    : "none";
  const passphraseHashes = Array.isArray(value.passphraseHashes)
    ? value.passphraseHashes
        .filter(isString)
        .slice(0, 20)
        .map((hash) => hash.slice(0, 128))
    : undefined;

  return {
    template,
    sender: boundedText(value.sender),
    recipient: boundedText(value.recipient),
    occasion: boundedText(value.occasion) || undefined,
    openingMessage: boundedText(value.openingMessage),
    cover: {
      enabled: Boolean(value.cover.enabled || youtube || validDataUrl),
      message: boundedText(value.cover.message),
      photo: coverPhoto,
      openingStyle: openingStyle as string,
    },
    passphraseHash: boundedText(value.passphraseHash) || undefined,
    passphraseHashes,
    passphraseQuestion: boundedText(value.passphraseQuestion) || undefined,
    passphraseMode:
      value.passphraseMode === "choice" ? "choice" : "text",
    passphraseChoices: Array.isArray(value.passphraseChoices)
      ? value.passphraseChoices
          .filter(isString)
          .slice(0, 4)
          .map((choice) => boundedText(choice))
      : undefined,
    appearance,
    music: {
      source: dataUrl ? "upload" : youtube ? "youtube" : undefined,
      url: youtube?.url,
      videoId: youtube?.id,
      dataUrl: validDataUrl,
      title: boundedText(value.music.title) || undefined,
      durationSeconds:
        Number.isFinite(durationSeconds) && durationSeconds >= 0
          ? durationSeconds
          : undefined,
      loop: Boolean(value.music.loop),
      startMuted: Boolean(value.music.startMuted),
      volume: Number.isFinite(volume)
        ? Math.min(100, Math.max(0, volume))
        : 60,
    },
    content,
    closingMessage: boundedText(value.closingMessage),
    signature: boundedText(value.signature),
    completion,
    progress: progressDefinition(template),
    expiration:
      expiration as SurpriseData["delivery"]["expiration"],
  };
}

export function normalizeBuilderStateForExperience(
  data: SurpriseData | ExportableData,
): RecipientExperienceConfig {
  const rawMusic = data.content as {
    songUrl?: string;
    songTitle?: string;
    songFile?: { dataUrl?: string };
    loopSong?: boolean;
    startMuted?: boolean;
    initialVolume?: number;
  };
  const sharedMusic = data.music as
    | {
        file?: { dataUrl?: string; name?: string };
        youtubeUrl?: string;
        title?: string;
        durationSeconds?: number;
        loop?: boolean;
        startMuted?: boolean;
        volume?: number;
      }
    | undefined;
  const suppressBackgroundMusic = data.template === "cozy-playlist";
  const delight = data.delight as typeof data.delight & {
    passphraseHashes?: string[];
  };
  const coverPhoto = sanitizeRenderableImages(data.delight?.coverPhoto) as
    | { previewUrl: string }
    | undefined;
  const appearance = normalizeAppearance(data.appearance);
  const content = sanitizeContent(data.template, data.content);
  if (
    data.template === "our-storybook" &&
    !isPlayableStorybookContent(content, "compatibility")
  ) {
    throw new Error("This Storybook is incomplete or unsupported.");
  }
  if (
    data.template === "cozy-playlist" &&
    !isPlayableCozyPlaylistContent(content, "compatibility")
  ) {
    throw new Error("This Cozy Playlist is incomplete or unsupported.");
  }
  const uploadedAudio = suppressBackgroundMusic
    ? undefined
    : sharedMusic?.file?.dataUrl || rawMusic.songFile?.dataUrl;
  const youtube = suppressBackgroundMusic || uploadedAudio
    ? null
    : parseYouTubeUrl(sharedMusic?.youtubeUrl || rawMusic.songUrl);

  return {
    template: data.template,
    sender: data.basics.senderName,
    recipient: data.basics.recipientName,
    occasion: data.basics.occasion || undefined,
    openingMessage: data.basics.openingMessage,
    cover: {
      enabled: Boolean(
        (data.delight?.coverEnabled ?? true) || youtube || uploadedAudio,
      ),
      message:
        data.delight?.coverMessage || data.basics.openingMessage,
      photo: coverPhoto,
      openingStyle: data.delight?.openingStyle || "gentle-fade",
    },
    passphraseHash: data.delight?.passphraseHash,
    passphraseHashes:
      delight?.passphraseHashes ||
      (data.delight?.passphraseHash
        ? [data.delight.passphraseHash]
        : undefined),
    passphraseQuestion: data.delight?.passphraseQuestion,
    passphraseMode:
      data.delight?.passphraseMode === "choice" ? "choice" : "text",
    passphraseChoices: data.delight?.passphraseChoices
      ?.filter((choice) => choice.trim())
      .slice(0, 4),
    appearance,
    music: {
      source: uploadedAudio ? "upload" : youtube ? "youtube" : undefined,
      url: youtube?.url,
      videoId: youtube?.id,
      dataUrl: uploadedAudio,
      title: sharedMusic?.title || sharedMusic?.file?.name || rawMusic.songTitle,
      durationSeconds: sharedMusic?.durationSeconds,
      loop: sharedMusic?.loop ?? Boolean(rawMusic.loopSong),
      startMuted: sharedMusic?.startMuted ?? Boolean(rawMusic.startMuted),
      volume: Math.min(
        100,
        Math.max(0, sharedMusic?.volume ?? rawMusic.initialVolume ?? 60),
      ),
    },
    content,
    closingMessage: data.delight?.closingMessage || "",
    signature: data.delight?.signature || "",
    completion: resolveExperienceCompletionParts(
      data.template,
      content,
      data.delight?.closingMessage,
      data.delight?.signature,
    ),
    progress: progressDefinition(data.template),
    expiration: data.delivery.expiration,
  };
}
