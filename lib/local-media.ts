import type {
  CatchTheHeartContent,
  ChooseOurDateContent,
  CozyPlaylistContent,
  LocalAudio,
  LocalImage,
  LocalVideo,
  MemoryQuizContent,
  OpenWhenContent,
  OurStorybookContent,
  PhotoPuzzleContent,
  SurpriseData,
  WishUponAStarContent,
} from "./types";
import { normalizeImagePresentation } from "./image-presentation";

export type LocalMediaRef =
  | { kind: "image"; media: LocalImage }
  | { kind: "audio"; media: LocalAudio }
  | { kind: "video"; media: LocalVideo };

const revokedUrls = new Set<string>();

type PersistenceRecord = Record<string, unknown>;

function isPersistenceRecord(value: unknown): value is PersistenceRecord {
  return Boolean(value && typeof value === "object" && !Array.isArray(value));
}

function isPersistableMediaRecord(value: PersistenceRecord): boolean {
  return (
    typeof value.id === "string" &&
    typeof value.previewUrl === "string" &&
    typeof value.name === "string" &&
    typeof value.mimeType === "string" &&
    typeof value.size === "number" &&
    Number.isFinite(value.size) &&
    (value.source === undefined ||
      value.source === "upload" ||
      value.source === "url")
  );
}

/**
 * Create the lightweight form stored in drafts and edit sessions. Uploaded
 * bytes remain in the owner-scoped local-media store; object URLs are
 * recreated during hydration instead of being persisted or cloned.
 */
export function cloneDraftDataForPersistence(data: SurpriseData): SurpriseData {
  const cloneValue = (value: unknown): unknown => {
    if (typeof Blob !== "undefined" && value instanceof Blob) return undefined;
    if (Array.isArray(value)) return value.map(cloneValue);
    if (!isPersistenceRecord(value)) return value;

    const media = isPersistableMediaRecord(value);
    const result: PersistenceRecord = {};
    for (const [key, child] of Object.entries(value)) {
      if (typeof Blob !== "undefined" && child instanceof Blob) continue;
      if (media && key === "previewUrl" && value.source !== "url") {
        // Keep legacy inline bytes until they have an owned Blob. Invalid or
        // unavailable inline content must never disappear on an autosave.
        result[key] = !(value.file instanceof Blob) && typeof child === "string" && child.startsWith("data:") ? child : "";
        continue;
      }
      result[key] = cloneValue(child);
    }
    if (media && !Object.hasOwn(result, "previewUrl")) {
      result.previewUrl = value.source === "url" ? value.previewUrl : "";
    }
    return result;
  };

  return cloneValue(data) as SurpriseData;
}

export function createStableId(prefix: string): string {
  const id =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID()
      : `${Date.now().toString(36)}-${Math.random().toString(36).slice(2)}`;
  return `${prefix}-${id}`;
}

export function createLocalImage(file: File): LocalImage {
  return {
    id: createStableId("image"),
    file,
    previewUrl: URL.createObjectURL(file),
    name: file.name,
    mimeType: file.type,
    size: file.size,
    source: "upload",
  };
}

export async function createLocalImageWithMetadata(
  file: File,
): Promise<LocalImage> {
  const image = createLocalImage(file);
  if (typeof createImageBitmap !== "function") return image;
  try {
    const bitmap = await createImageBitmap(file, {
      imageOrientation: "from-image",
    }).catch(() => createImageBitmap(file));
    image.width = bitmap.width;
    image.height = bitmap.height;
    bitmap.close();
  } catch {
    // Dimensions are optional metadata; keep the valid preview if decoding fails.
  }
  return image;
}

export function revokeObjectUrl(url?: string): void {
  if (!url?.startsWith("blob:") || revokedUrls.has(url))
    return;
  URL.revokeObjectURL(url);
  revokedUrls.add(url);
}

function revokeLocalMedia(media: { previewUrl: string } | undefined): void {
  if (!media) return;
  revokeObjectUrl(media.previewUrl);
}

export function revokeLocalImage(image: LocalImage | undefined): void {
  revokeLocalMedia(image);
}

export function revokeLocalVideo(video: LocalVideo | undefined): void {
  revokeLocalMedia(video);
}

export function revokeLocalAudio(audio: LocalAudio | undefined): void {
  revokeLocalMedia(audio);
}

function pushImage(refs: LocalMediaRef[], image?: LocalImage): void {
  if (image) refs.push({ kind: "image", media: image });
}

function pushAudio(refs: LocalMediaRef[], audio?: LocalAudio): void {
  if (audio) refs.push({ kind: "audio", media: audio });
}

function pushVideo(refs: LocalMediaRef[], video?: LocalVideo): void {
  if (video) refs.push({ kind: "video", media: video });
}

/**
 * Returns every local-media field occurrence in data. This intentionally does
 * not deduplicate IDs: package and export callers may need occurrence order,
 * while lifecycle callers can use the unique helper below.
 */
export function collectLocalMediaRefs(data: SurpriseData): LocalMediaRef[] {
  const refs: LocalMediaRef[] = [];
  pushImage(refs, data.appearance.backgroundImage);
  pushImage(refs, data.appearance.customBackgroundImage);
  pushImage(refs, data.delight?.coverPhoto);

  if (data.template === "catch-the-heart") {
    const content = data.content as CatchTheHeartContent;
    content.hearts.forEach((heart) => pushImage(refs, heart.photo));
    // Legacy fields remain readable until normalized at a persistence/export
    // boundary. Keeping them here prevents imported old data losing media.
    pushAudio(refs, content.songFile);
  } else if (data.template === "photo-puzzle") {
    pushImage(refs, (data.content as PhotoPuzzleContent).photo);
  } else if (data.template === "open-when") {
    const content = data.content as OpenWhenContent;
    content.envelopes.forEach((envelope) => {
      pushImage(refs, envelope.photo);
      pushVideo(refs, envelope.video);
    });
    pushAudio(refs, content.musicFile);
  } else if (data.template === "choose-our-date") {
    const content = data.content as ChooseOurDateContent;
    const rounds = content.rounds || [];
    rounds.forEach((round) =>
      round.options.forEach((option) => pushImage(refs, option.photo)),
    );
    (content.options || []).forEach((option) => pushImage(refs, option.photo));
  } else if (data.template === "memory-quiz") {
    (data.content as MemoryQuizContent).questions.forEach((question) =>
      pushImage(refs, question.photo),
    );
  } else if (data.template === "wish-upon-a-star") {
    (data.content as WishUponAStarContent).stars.forEach((star) =>
      pushImage(refs, star.photo),
    );
  } else if (data.template === "our-storybook") {
    (data.content as OurStorybookContent).pages.forEach((page) =>
      pushImage(refs, page.photo),
    );
  } else if (data.template === "cozy-playlist") {
    const content = data.content as CozyPlaylistContent;
    content.tracks.forEach((track) => {
      pushImage(refs, track.photo);
      pushAudio(refs, track.audio);
    });
  }

  pushAudio(refs, data.music?.file);
  return refs;
}

function uniqueMedia<T extends { id: string }>(items: T[]): T[] {
  return [...new Map(items.map((item) => [item.id, item])).values()];
}

export function collectUniqueLocalMediaRefs(
  data: SurpriseData,
): LocalMediaRef[] {
  return [
    ...new Map(
      collectLocalMediaRefs(data).map((ref) => [
        `${ref.kind}:${ref.media.id}`,
        ref,
      ]),
    ).values(),
  ];
}

export function collectLocalImages(data: SurpriseData): LocalImage[] {
  return uniqueMedia(
    collectLocalMediaRefs(data)
      .filter((ref): ref is { kind: "image"; media: LocalImage } => ref.kind === "image")
      .map((ref) => ref.media),
  );
}

/** Additive read-boundary normalization for drafts and imported packages. */
export function normalizeLocalImagePresentations(data: SurpriseData, uniqueIdentitiesOnly = false): SurpriseData {
  // Historical fingerprints normalized one occurrence per ID.
  const refs = uniqueIdentitiesOnly ? collectUniqueLocalMediaRefs(data) : collectLocalMediaRefs(data);
  refs.forEach(({ kind, media }) => {
    if (kind !== "image") return;
    const image = media as LocalImage;
    image.presentation = normalizeImagePresentation(
      image.presentation,
      data.template === "photo-puzzle"
        ? (data.content as PhotoPuzzleContent).imageFit
        : undefined,
    );
  });
  return data;
}

/** Release only URLs belonging to this hydrated session, including repeated IDs. */
export function disposeDraftMedia(data: SurpriseData): void {
  collectLocalMediaRefs(data).forEach(({ media }) => revokeObjectUrl(media.previewUrl));
}

/** Recover legacy inline media without allocating past the package entry cap. */
export function materializeEmbeddedDraftMedia(data: SurpriseData): void {
  for (const { kind, media } of collectLocalMediaRefs(data)) {
    if (media.file instanceof Blob || ("source" in media && media.source === "url")) continue;
    const comma = media.previewUrl.indexOf(",");
    if (comma < 0) continue;
    const header = /^data:([a-z0-9.+-]+\/[a-z0-9.+-]+);base64$/i.exec(media.previewUrl.slice(0, comma));
    const mime = header?.[1]?.toLowerCase();
    if (!mime || !mime.startsWith(`${kind}/`) || mime !== media.mimeType.toLowerCase()) continue;
    if (kind === "image" && !/^image\/(jpeg|png|webp|gif)$/.test(mime)) continue;
    if (kind === "video" && !/^video\/(mp4|webm|ogg)$/.test(mime)) continue;
    const payload = media.previewUrl.slice(comma + 1);
    if (payload.length > Math.ceil(15 * 1024 * 1024 / 3) * 4 + 1024) continue;
    try {
      const binary = atob(payload.replace(/\s/g, ""));
      if (!binary.length || binary.length > 15 * 1024 * 1024) continue;
      media.file = new File([Uint8Array.from(binary, character => character.charCodeAt(0))], media.name, { type: mime });
      media.size = media.file.size;
      media.unavailable = false;
    } catch { /* Preserve malformed legacy content for explicit recovery. */ }
  }
}

/** A repeated identity may share bytes, but must never overwrite different bytes. */
export async function assertMediaIdentityConsistency(data: SurpriseData): Promise<void> {
  const files = new Map<string, Blob>();
  for (const { kind, media } of collectLocalMediaRefs(data)) {
    if (!(media.file instanceof Blob)) continue;
    const key = `${kind}:${media.id}`;
    const previous = files.get(key);
    if (!previous) { files.set(key, media.file); continue; }
    if (previous === media.file) continue;
    const fail = () => { throw new Error(`${media.name}: different files share a media ID. Your saved work was kept; choose this media again.`); };
    if (previous.size !== media.file.size || previous.type !== media.file.type) fail();
    for (let offset = 0; offset < previous.size; offset += 65536) {
      const [a, b] = await Promise.all([previous.slice(offset, offset + 65536).arrayBuffer(), media.file.slice(offset, offset + 65536).arrayBuffer()]);
      const left = new Uint8Array(a), right = new Uint8Array(b);
      if (left.some((byte, index) => byte !== right[index])) fail();
    }
  }
}

export function collectLocalVideos(data: SurpriseData): LocalVideo[] {
  return uniqueMedia(
    collectLocalMediaRefs(data)
      .filter((ref): ref is { kind: "video"; media: LocalVideo } => ref.kind === "video")
      .map((ref) => ref.media),
  );
}

export function collectLocalAudio(data: SurpriseData): LocalAudio[] {
  return uniqueMedia(
    collectLocalMediaRefs(data)
      .filter((ref): ref is { kind: "audio"; media: LocalAudio } => ref.kind === "audio")
      .map((ref) => ref.media),
  );
}

export function revokeImagesRemovedFromState(
  previous: SurpriseData,
  next: SurpriseData,
): void {
  const retainedIds = new Set(collectLocalImages(next).map((image) => image.id));
  collectLocalImages(previous).forEach((image) => {
    if (!retainedIds.has(image.id)) revokeLocalImage(image);
  });

  const retainedVideoIds = new Set(collectLocalVideos(next).map((video) => video.id));
  collectLocalVideos(previous).forEach((video) => {
    if (!retainedVideoIds.has(video.id)) revokeLocalVideo(video);
  });

  const retainedAudioIds = new Set(collectLocalAudio(next).map((audio) => audio.id));
  collectLocalAudio(previous).forEach((audio) => {
    if (!retainedAudioIds.has(audio.id)) revokeLocalAudio(audio);
  });
}
