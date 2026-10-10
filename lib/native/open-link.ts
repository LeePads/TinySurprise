import { isNativePlatform } from "../platform";

// Schemes this app will ever hand off to an external app/tab. Anything else
// (javascript:, data:, intent:, file:, custom app schemes, …) is refused —
// this is defense-in-depth on top of callers already validating with
// lib/safe-url.ts before rendering a link at all.
const ALLOWED_SCHEMES = new Set(["https:", "http:", "mailto:", "tel:"]);

function isSafeUrl(url: string): boolean {
  try {
    return ALLOWED_SCHEMES.has(new URL(url).protocol);
  } catch {
    return false;
  }
}

/**
 * Opens an external URL. On the web this is a no-op (the caller's normal
 * <a target="_blank"> handles it); on native it prevents the default
 * anchor navigation and hands the URL to an in-app Chrome Custom Tab via
 * @capacitor/browser instead, since a WebView has no real "new tab".
 * mailto:/tel: links are handed to the OS directly since Chrome Custom Tabs
 * can't render them.
 */
export async function openExternalLink(
  url: string,
  event?: { preventDefault: () => void },
): Promise<boolean> {
  if (!url || !isSafeUrl(url)) { event?.preventDefault(); return false; }
  if (!isNativePlatform()) return true;
  event?.preventDefault();
  const scheme = new URL(url).protocol;
  if (scheme === "mailto:" || scheme === "tel:") {
    window.location.href = url;
    return true;
  }
  try {
    const { Browser } = await import("@capacitor/browser");
    await Browser.open({ url });
    return true;
  } catch {
    window.open(url, "_blank", "noopener,noreferrer");
    return false;
  }
}
