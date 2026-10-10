import type { LocalImage, PhotoPuzzleContent, SurpriseData } from "./types";
import { normalizeHttpUrl, normalizeRenderableImageUrl } from "./safe-url";
import { embeddedRasterImageFile, hasRasterImageSignature, PHOTO_PUZZLE_IMAGE_MIME_TYPES, rasterImageError } from "./raster-image-validation";
export { hasRasterImageSignature, PHOTO_PUZZLE_IMAGE_MIME_TYPES } from "./raster-image-validation";

const MEDIA_PREFIX = "media/";

function normalizedPhotoUrl(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const normalized = normalizeRenderableImageUrl(value);
  if (!normalized || normalized.startsWith("blob:"))
    return undefined;
  return normalized;
}

function isSupportedMime(value: unknown): value is string {
  return (
    typeof value === "string" &&
    PHOTO_PUZZLE_IMAGE_MIME_TYPES.has(value.trim().toLowerCase())
  );
}

function dataUrlMime(value: string): string | undefined {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,/i.exec(value);
  return match?.[1]?.toLowerCase();
}

function decodeBase64DataUrl(value: string): Uint8Array | undefined {
  const match = /^data:(image\/[a-z0-9.+-]+);base64,([a-z0-9+/]*={0,2})$/i.exec(
    value,
  );
  const payload = match?.[2];
  if (!payload || payload.length % 4 === 1) return undefined;

  try {
    const padded = payload.padEnd(payload.length + ((4 - (payload.length % 4)) % 4), "=");
    const binary = atob(padded);
    if (!binary.length) return undefined;
    return Uint8Array.from(binary, (character) => character.charCodeAt(0));
  } catch {
    return undefined;
  }
}

async function localPhotoSignatureError(
  photo: LocalImage,
  mimeType: string,
  requireDecode: boolean,
): Promise<string | undefined> {
  if (!(photo.file instanceof Blob) || photo.file.size <= 0) return undefined;
  if (requireDecode) return rasterImageError(photo.file, mimeType);
  const bytes = new Uint8Array(await photo.file.slice(0, 12).arrayBuffer());
  return hasRasterImageSignature(mimeType, bytes)
    ? undefined
    : "The Photo Puzzle image bytes do not match the declared raster format.";
}

async function localPhotoError(photo: LocalImage, requireDecode: boolean): Promise<string | undefined> {
  const previewUrl = photo.previewUrl.trim();
  const mimeType = photo.mimeType.trim().toLowerCase();

  if (!previewUrl) return "The Photo Puzzle image is blank.";

  // Package-local media is replaced with a File only after the package's
  // manifest has passed this validation. The media entry is checked again by
  // the package reader before persistence.
  if (previewUrl.startsWith(MEDIA_PREFIX)) {
    const shapeError = (
      isSupportedMime(mimeType) &&
      photo.size > 0 &&
      (!(photo.file instanceof Blob) || photo.file.size > 0)
    )
      ? undefined
      : "The Photo Puzzle image is empty or uses an unsupported format. Use a non-empty JPG, PNG, WebP, or GIF.";
    if (shapeError) return shapeError;
    return localPhotoSignatureError(photo, mimeType, requireDecode);
  }

  // Linked images are an explicit authoring mode. Keep that mode limited to
  // normalized HTTP(S), and require its canonical source marker rather than
  // trusting a package-declared image/* MIME value.
  if (photo.source === "url") {
    return normalizeHttpUrl(previewUrl) && mimeType === "image/remote"
      ? undefined
      : "The Photo Puzzle image link must be a public http:// or https:// image URL.";
  }

  if (photo.file instanceof Blob) {
    const shapeError = (
      isSupportedMime(mimeType) &&
      photo.file.size > 0
    )
      ? undefined
      : "The Photo Puzzle image is not a supported local photo.";
    if (shapeError) return shapeError;
    return localPhotoSignatureError(photo, mimeType, requireDecode);
  }

  const normalized = normalizedPhotoUrl(previewUrl);
  if (!normalized) {
    return "The Photo Puzzle image is not a safe supported image URL.";
  }
  if (normalized.startsWith("http")) {
    return mimeType === "image/remote"
      ? undefined
      : "The Photo Puzzle linked image has an invalid media declaration.";
  }
  const embeddedMime = dataUrlMime(normalized);
  if (!embeddedMime || !isSupportedMime(mimeType) || embeddedMime !== mimeType)
    return "The Photo Puzzle embedded image must be a supported JPG, PNG, WebP, or GIF.";
  if (requireDecode) {
    try { return await rasterImageError(embeddedRasterImageFile(photo), mimeType); }
    catch (error) { return error instanceof Error ? error.message : "The Photo Puzzle image could not be read."; }
  }
  const bytes = decodeBase64DataUrl(normalized);
  return bytes && hasRasterImageSignature(mimeType, bytes)
    ? undefined
    : "The Photo Puzzle embedded image is malformed or its bytes do not match the declared raster format.";
}

/**
 * Canonicalizes the URL forms that are safe to persist. Invalid values are
 * deliberately left in place so the validator can return a useful error
 * instead of silently converting an incomplete package into a playable one.
 */
export function normalizePhotoPuzzlePackageData(data: SurpriseData): SurpriseData {
  if (data.template !== "photo-puzzle") return data;
  const content = data.content as PhotoPuzzleContent;
  // Add an image-shaped adapter; keep the original legacy URL and authored copy.
  const legacyUrl = content.photoUrl?.trim();
  const embeddedMime = legacyUrl ? dataUrlMime(legacyUrl) : undefined;
  const photo = content.photo || (legacyUrl && (normalizeHttpUrl(legacyUrl) || embeddedMime) ? {
    id: "legacy-puzzle-photo", previewUrl: legacyUrl,
    name: `puzzle-image.${embeddedMime?.split("/")[1] || "jpg"}`,
    mimeType: embeddedMime || "image/remote", size: 0,
    source: normalizeHttpUrl(legacyUrl) ? "url" as const : "upload" as const,
  } : undefined);
  const normalizedPhoto =
    photo?.source === "url"
      ? { ...photo, previewUrl: normalizeHttpUrl(photo.previewUrl) || photo.previewUrl }
      : photo;
  const safePhotoUrl = content.photoUrl
    ? normalizedPhotoUrl(content.photoUrl) || content.photoUrl
    : content.photoUrl;
  return {
    ...data,
    content: {
      ...content,
      photo: normalizedPhoto,
      photoUrl: safePhotoUrl,
    },
  } as SurpriseData;
}

/**
 * Recipient boundaries require decoding. Working backups opt into legacy URL
 * recovery and retain the existing signature-only check for unfinished images.
 */
export async function photoPuzzlePackageMediaError(
  content: PhotoPuzzleContent,
  allowUnresolvedLegacyUrl = false,
  requireDecode = !allowUnresolvedLegacyUrl,
): Promise<string | undefined> {
  if (!content.photo && !content.photoUrl?.trim()) {
    return "This .tinysurprise package contains an incomplete Photo Puzzle. A supported puzzle image is required.";
  }
  if (content.photoUrl !== undefined && !normalizedPhotoUrl(content.photoUrl)) {
    return "The Photo Puzzle contains an unsafe or malformed image URL.";
  }
  if (content.photo) return localPhotoError(content.photo, requireDecode);
  if (!allowUnresolvedLegacyUrl && content.photoUrl?.trim().startsWith("/")) {
    return "This legacy puzzle has a relative photo link without portable photo bytes. Choose the original photo again before sharing.";
  }
  // Some older creations only have photoUrl. Validate embedded bytes without
  // changing that saved representation; linked legacy images keep compatibility.
  const legacyUrl = content.photoUrl?.trim();
  const mime = legacyUrl && dataUrlMime(legacyUrl);
  if (requireDecode && legacyUrl && mime) return localPhotoError({
    id: "legacy-puzzle-photo", name: "Puzzle photo", previewUrl: legacyUrl,
    mimeType: mime, size: 0, source: "upload",
  }, true);
  return undefined;
}
