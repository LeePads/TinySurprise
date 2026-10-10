import { collectLocalMediaRefs } from "./local-media";
import { normalizeLegacyMusic } from "./music";
import type { SurpriseData, CozyPlaylistContent } from "./types";

export interface PackageSummary {
  mediaCount: number;
  requiresInternetForYoutube: boolean;
  requiresInternetForExternalLinks: boolean;
  requiresInternetForExternalSongs: boolean;
}

/** Small info-panel summary for the /viewer route's .tinysurprise import preview — reuses the same counting/detection already used by export-summary.tsx rather than re-deriving it. */
export function summarizePackage(data: SurpriseData): PackageSummary {
  const canonical = normalizeLegacyMusic(data);
  const remoteMedia = collectLocalMediaRefs(canonical).some(({ media }) =>
    "source" in media && media.source === "url" && /^https?:\/\//i.test(media.previewUrl),
  ) || (canonical.template === "photo-puzzle" && !(canonical.content as import("./types").PhotoPuzzleContent).photo && /^https?:\/\//i.test((canonical.content as import("./types").PhotoPuzzleContent).photoUrl || ""));
  const externalSongs = Boolean(canonical.music?.youtubeUrl || (canonical.template === "cozy-playlist" && (canonical.content as CozyPlaylistContent).tracks.some(track => /^https?:\/\//i.test(track.link || ""))));
  return {
    mediaCount: collectLocalMediaRefs(canonical).length,
    requiresInternetForExternalLinks: remoteMedia || externalSongs,
    requiresInternetForExternalSongs: externalSongs,
    requiresInternetForYoutube: Boolean(canonical.music?.youtubeUrl || (canonical.template === "cozy-playlist" && (canonical.content as CozyPlaylistContent).tracks.some((track) => /(?:youtube.com|youtu.be)/i.test(track.link || "")))),
  };
}

/**
 * Filename extension decides most of the time; a small byte sniff (ZIP
 * magic "PK" vs an HTML doctype/tag) covers files with a missing, wrong, or
 * spoofed extension, so an import is never routed by trusting the filename
 * alone. Shared by the intent-received path (native-app-shell.tsx) and the
 * manual file-picker path (/viewer).
 */
export async function classifyImportBlob(
  name: string | undefined,
  blob: Blob,
): Promise<"tinysurprise" | "html"> {
  const head = new Uint8Array(await blob.slice(0, 16).arrayBuffer());
  if (head[0] === 0x50 && head[1] === 0x4b) return "tinysurprise"; // ZIP magic "PK"
  const text = new TextDecoder().decode(head).trim().toLowerCase();
  if (text.startsWith("<!doctype") || text.startsWith("<html")) return "html";
  const lower = (name || "").toLowerCase();
  if (lower.endsWith(".html") || lower.endsWith(".htm")) return "html";
  return "tinysurprise";
}
