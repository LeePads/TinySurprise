import type { LocalImage } from "./types";
import { normalizeRenderableImageUrl } from "./safe-url";

export const MAX_PERSISTED_IMAGE_BYTES = 15 * 1024 * 1024;
export const PHOTO_PUZZLE_IMAGE_MIME_TYPES = new Set(["image/jpeg", "image/png", "image/webp", "image/gif"]);
// Bound decoded source memory before asking the browser to decode. Working
// drafts/backups do not use this recipient-only limit and retain original bytes.
const MAX_SOURCE_PIXELS = 64 * 1024 * 1024;
const MAX_DECODE_SIDE = 1600;
const DECODE_TIMEOUT_MS = 10000;
const INVALID_IMAGE = "This photo has no readable image content. Choose the original photo or a newly saved copy; your saved draft is kept.";
const decodeCache = new WeakMap<Blob, Map<string, Promise<string | undefined>>>();
const embeddedFiles = new WeakMap<LocalImage, { url: string; mime: string; name: string; file: File }>();
let decodeQueue: Promise<unknown> = Promise.resolve();

/** Inexpensive initial format check; it does not establish decodability. */
export function hasRasterImageSignature(mimeType: string, bytes: Uint8Array): boolean {
  const mime = mimeType.trim().toLowerCase();
  const jpeg = bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff;
  const png = bytes.length >= 8 && [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a].every((value, index) => bytes[index] === value);
  const gif = bytes.length >= 6 && ["GIF89a", "GIF87a"].includes(String.fromCharCode(...bytes.slice(0, 6)));
  const webp = bytes.length >= 12 && String.fromCharCode(...bytes.slice(0, 4)) === "RIFF" && String.fromCharCode(...bytes.slice(8, 12)) === "WEBP";
  return (mime === "image/jpeg" && jpeg) || (mime === "image/png" && png) || (mime === "image/gif" && gif) || (mime === "image/webp" && webp);
}

/** Header dimensions only; the browser still verifies the encoded image. */
function dimensions(bytes: Uint8Array, mime: string): [number, number] | undefined {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (mime === "image/png" && bytes.length >= 24 && String.fromCharCode(...bytes.slice(12, 16)) === "IHDR")
    return [view.getUint32(16), view.getUint32(20)];
  if (mime === "image/gif" && bytes.length >= 10) return [view.getUint16(6, true), view.getUint16(8, true)];
  if (mime === "image/jpeg") {
    let offset = 2;
    const frames = new Set([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf]);
    while (offset + 1 < bytes.length) {
      if (bytes[offset++] !== 0xff) return;
      while (offset < bytes.length && bytes[offset] === 0xff) offset++;
      const marker = bytes[offset++];
      if (marker === 0xd9 || marker === 0xda) return;
      if (marker === 0x01 || (marker >= 0xd0 && marker <= 0xd7)) continue;
      if (offset + 2 > bytes.length) return;
      const length = view.getUint16(offset);
      if (length < 2 || offset + length > bytes.length) return;
      if (frames.has(marker) && length >= 8) return [view.getUint16(offset + 5), view.getUint16(offset + 3)];
      offset += length;
    }
  }
  if (mime === "image/webp") {
    const u24 = (offset: number) => bytes[offset] | (bytes[offset + 1] << 8) | (bytes[offset + 2] << 16);
    for (let offset = 12; offset + 8 <= bytes.length;) {
      const kind = String.fromCharCode(...bytes.slice(offset, offset + 4));
      const length = view.getUint32(offset + 4, true), start = offset + 8;
      if (start + length > bytes.length) return;
      if (kind === "VP8X" && length >= 10) return [u24(start + 4) + 1, u24(start + 7) + 1];
      if (kind === "VP8L" && length >= 5 && bytes[start] === 0x2f) {
        const packed = view.getUint32(start + 1, true);
        return [(packed & 0x3fff) + 1, ((packed >>> 14) & 0x3fff) + 1];
      }
      if (kind === "VP8 " && length >= 10 && bytes[start + 3] === 0x9d && bytes[start + 4] === 0x01 && bytes[start + 5] === 0x2a)
        return [view.getUint16(start + 6, true) & 0x3fff, view.getUint16(start + 8, true) & 0x3fff];
      offset = start + length + (length & 1);
    }
  }
}

function decodeImage(file: Blob, width: number, height: number): Promise<string | undefined> {
  return new Promise(resolve => {
    let settled = false;
    let image: HTMLImageElement | undefined;
    let url: string | undefined;
    const finish = (error?: string) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      if (image) { image.onload = null; image.onerror = null; image.removeAttribute("src"); }
      if (url) URL.revokeObjectURL(url);
      resolve(error);
    };
    const timer = setTimeout(() => finish("This photo took too long to decode. Try a smaller copy; the original is kept."), DECODE_TIMEOUT_MS);
    const decodeWithImage = () => {
      if (settled) return;
      if (typeof Image === "undefined") { finish(INVALID_IMAGE); return; }
      try {
        image = new Image();
        image.onload = () => {
          const loaded = image!;
          const complete = () => finish(loaded.naturalWidth > 0 && loaded.naturalHeight > 0 ? undefined : INVALID_IMAGE);
          // decode() also covers browsers that defer pixel decoding until paint.
          if (typeof loaded.decode === "function") {
            try { void loaded.decode().then(complete, () => finish(INVALID_IMAGE)); }
            catch { finish(INVALID_IMAGE); }
          } else complete();
        };
        image.onerror = () => finish(INVALID_IMAGE);
        url = URL.createObjectURL(file);
        image.src = url;
      } catch { finish("Image validation is unavailable. Reopen this file in a browser that can display photos."); }
    };
    if (typeof createImageBitmap === "function") {
      try {
        // The validation bitmap is bounded and never used as exported content.
        const scale = Math.min(1, MAX_DECODE_SIDE / Math.max(width, height));
        void createImageBitmap(file, {
          resizeWidth: Math.max(1, Math.round(width * scale)),
          resizeHeight: Math.max(1, Math.round(height * scale)),
        }).then(bitmap => {
          const valid = bitmap.width > 0 && bitmap.height > 0;
          bitmap.close(); // Also close a bitmap that arrives after timeout.
          finish(valid ? undefined : INVALID_IMAGE);
        }, decodeWithImage);
      } catch { decodeWithImage(); }
    } else if (typeof Image !== "undefined") {
      decodeWithImage();
    } else {
      finish("Image validation is unavailable. Open this surprise in a browser before sharing it.");
    }
  });
}

export async function rasterImageError(file: Blob, mime = file.type, requireDecode = true): Promise<string | undefined> {
  const type = mime.trim().toLowerCase().split(";")[0];
  if (!PHOTO_PUZZLE_IMAGE_MIME_TYPES.has(type)) return "Use a JPG, PNG, WebP, or GIF photo.";
  if (!file.size || file.size > MAX_PERSISTED_IMAGE_BYTES) return "Use a non-empty photo no larger than 15 MB.";
  let header: Uint8Array;
  try { header = new Uint8Array(await file.slice(0, 12).arrayBuffer()); }
  catch { return "This photo could not be read. Choose its original file again; your saved draft is kept."; }
  if (!hasRasterImageSignature(type, header)) return "The photo bytes do not match its declared format. Choose the photo again.";
  if (!requireDecode) return;
  let byMime = decodeCache.get(file);
  if (!byMime) { byMime = new Map(); decodeCache.set(file, byMime); }
  const previous = byMime.get(type);
  if (previous) return previous;
  const operation = decodeQueue.catch(() => undefined).then(async () => {
    const size = dimensions(new Uint8Array(await file.arrayBuffer()), type);
    if (!size || !size[0] || !size[1]) return INVALID_IMAGE;
    if (size[0] * size[1] > MAX_SOURCE_PIXELS)
      return "This photo is too large to decode safely. Choose a smaller copy; the original is kept.";
    return decodeImage(file.type === type ? file : file.slice(0, file.size, type), size[0], size[1]);
  }).catch(() => "This photo could not be read. Choose its original file again; your saved draft is kept.");
  byMime.set(type, operation);
  decodeQueue = operation;
  void operation.then(error => { if (error && byMime!.get(type) === operation) byMime!.delete(type); });
  return operation;
}

/** Reuse original inline bytes across recipient checks without altering the draft. */
export function embeddedRasterImageFile(image: LocalImage): File {
  const mime = image.mimeType.trim().toLowerCase().split(";")[0];
  const cached = embeddedFiles.get(image);
  if (cached?.url === image.previewUrl && cached.mime === mime && cached.name === image.name) return cached.file;
  const safe = normalizeRenderableImageUrl(image.previewUrl);
  const match = safe && /^data:(image\/(?:jpeg|png|webp|gif));base64,([a-z0-9+/=\s]+)$/i.exec(safe);
  if (!match || match[1].toLowerCase() !== mime) throw new Error("This embedded photo has an invalid image format.");
  if (match[2].length > Math.ceil(MAX_PERSISTED_IMAGE_BYTES / 3) * 4 + 1024) throw new Error("This embedded photo exceeds the 15 MB limit.");
  const binary = atob(match[2].replace(/\s/g, ""));
  if (!binary.length || binary.length > MAX_PERSISTED_IMAGE_BYTES) throw new Error("Use a non-empty photo no larger than 15 MB.");
  const file = new File([Uint8Array.from(binary, character => character.charCodeAt(0))], image.name, { type: mime });
  embeddedFiles.set(image, { url: image.previewUrl, mime, name: image.name, file });
  return file;
}
