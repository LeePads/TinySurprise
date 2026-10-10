export interface YouTubeVideo {
  id: string;
  url: string;
}
const HOSTS = new Set([
  "youtube.com",
  "www.youtube.com",
  "m.youtube.com",
  "youtu.be",
  "www.youtu.be",
]);
const VIDEO_ID = /^[A-Za-z0-9_-]{6,20}$/;

/**
 * Build a canonical watch URL for a parsed video id.
 *
 * V1 opens this URL externally from a recipient gesture on every platform.
 * It never creates an embedded or background player.
 */
export function youtubeWatchUrl(
  videoId: string,
  autoplay = false,
): string | null {
  if (!VIDEO_ID.test(videoId)) return null;
  const params = new URLSearchParams({ v: videoId });
  if (autoplay) params.set("autoplay", "1");
  return `https://www.youtube.com/watch?${params.toString()}`;
}

export function parseYouTubeUrl(value?: string): YouTubeVideo | null {
  if (!value?.trim()) return null;
  try {
    const url = new URL(value.trim());
    if (url.protocol !== "https:" || !HOSTS.has(url.hostname.toLowerCase()))
      return null;
    let id = "";
    const host = url.hostname.toLowerCase();
    if (host.endsWith("youtu.be"))
      id = url.pathname.split("/").filter(Boolean)[0] || "";
    else if (url.pathname === "/watch") id = url.searchParams.get("v") || "";
    else if (url.pathname.startsWith("/shorts/"))
      id = url.pathname.split("/")[2] || "";
    else if (url.pathname.startsWith("/embed/"))
      id = url.pathname.split("/")[2] || "";
    if (!VIDEO_ID.test(id)) return null;
    return { id, url: url.toString() };
  } catch {
    return null;
  }
}
