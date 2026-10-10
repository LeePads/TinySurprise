import type { LocalImage, SurpriseData } from "./types";
import { collectLocalMediaRefs } from "./local-media";
import { embeddedRasterImageFile, rasterImageError, PHOTO_PUZZLE_IMAGE_MIME_TYPES } from "./raster-image-validation";
import { audioValidationMessage } from "./music";
import { normalizeHttpUrl, normalizeRenderableImageUrl, normalizeRenderableVideoUrl } from "./safe-url";

// Existing package media remains exportable; new authoring uploads keep their 5 MB limit.
export { MAX_PERSISTED_IMAGE_BYTES } from "./raster-image-validation";
const VIDEO_TYPES = new Set(["video/mp4", "video/webm", "video/ogg"]);

export async function persistedImageError(file: Blob, mime = file.type, requireDecode = true): Promise<string | undefined> {
  return rasterImageError(file, mime, requireDecode);
}

/** Pre-attachment accepts media/ references; the same gate checks bytes after attachment. */
export async function recipientMediaError(data: SurpriseData, requireDecode = true): Promise<string | undefined> {
  for (const { kind, media } of collectLocalMediaRefs(data)) {
    const label = media.name || "Uploaded media";
    const mime = media.mimeType.toLowerCase().split(";")[0];
    if ("source" in media && media.source === "url") {
      if (kind === "audio" || !normalizeHttpUrl(media.previewUrl)) return `${label}: use a complete http:// or https:// media link.`;
      continue;
    }
    if (media.unavailable) return `${label}: choose this unavailable media again before sharing.`;
    if (kind === "image" && !PHOTO_PUZZLE_IMAGE_MIME_TYPES.has(mime)) return `${label}: use a JPG, PNG, WebP, or GIF photo.`;
    if (kind === "video" && !VIDEO_TYPES.has(mime)) return `${label}: use an MP4, WebM, or Ogg video.`;
    if (media.file instanceof Blob) {
      if (!media.file.size) return `${label}: this media file is empty.`;
      if (kind === "image") {
        const error = await persistedImageError(media.file, mime, requireDecode);
        if (error) return `${label}: ${error}`;
      } else if (kind === "audio") {
        const error = audioValidationMessage(media.file);
        if (error) return `${label}: ${error}`;
      } else if (media.file.size > 15 * 1024 * 1024) return `${label}: choose a video no larger than 15 MB.`;
      continue;
    }
    if (media.previewUrl.startsWith("media/")) continue;
    const safe = kind === "image" ? normalizeRenderableImageUrl(media.previewUrl)
      : kind === "video" ? normalizeRenderableVideoUrl(media.previewUrl) : null;
    if (!safe?.startsWith("data:")) return `${label}: the original bytes are unavailable. Choose it again before sharing.`;
    try {
      if (kind === "image") {
        const error = await persistedImageError(embeddedRasterImageFile(media as LocalImage), mime, requireDecode);
        if (error) return `${label}: ${error}`;
        continue;
      }
      const comma = safe.indexOf(",");
      if (safe.length - comma - 1 > Math.ceil(15 * 1024 * 1024 / 3) * 4 + 1024) return `${label}: this embedded media exceeds the 15 MB limit.`;
      const binary = atob(safe.slice(comma + 1).replace(/\s/g, ""));
      const file = new File([Uint8Array.from(binary, c => c.charCodeAt(0))], media.name, { type: mime });
      if (!file.size || file.size > 15 * 1024 * 1024) return `${label}: use a non-empty video no larger than 15 MB.`;
    } catch (error) { return `${label}: ${error instanceof Error ? error.message : "This embedded media could not be read."}`; }
  }
  return undefined;
}
