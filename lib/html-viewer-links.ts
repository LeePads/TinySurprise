/** Messages from an opaque-origin iframe are authenticated by window identity,
 * never by a claimed origin, filename, generator marker, or URL in the payload. */
export function readViewerExternalLink(event: Pick<MessageEvent, "source" | "data">, viewerWindow: Window | null): string | undefined {
  if (!viewerWindow || event.source !== viewerWindow || event.data?.type !== "tiny-external-link" ||
      typeof event.data.url !== "string" || event.data.url.length > 4096) return;
  try {
    const url = new URL(event.data.url);
    if (!["https:", "http:"].includes(url.protocol) || url.username || url.password) return;
    return url.href;
  } catch { return; }
}

export function readViewerKeyboardAction(event: Pick<MessageEvent, "source" | "data">, viewerWindow: Window | null): "forward" | "backward" | "escape" | undefined {
  if (!viewerWindow || event.source !== viewerWindow || event.data?.type !== "tiny-viewer-keyboard") return;
  const action = event.data.action;
  return action === "forward" || action === "backward" || action === "escape" ? action : undefined;
}

// Runs only inside the isolated iframe. Window identity authenticates both
// directions; the opaque origin stays isolated from app storage and native APIs.
const EXTERNAL_LINK_SCRIPT = `<script>(() => {
  const send = url => {
    try {
      const u = new URL(url);
      if (u.protocol !== "https:" && u.protocol !== "http:") return;
      parent.postMessage({ type: "tiny-external-link", url: u.href }, "*");
    } catch {}
  };
  window.open = url => { send(url); return null; };
  document.addEventListener("click", event => {
    const a = event.target?.closest?.("a[href]");
    if (a && /^https?:/i.test(a.href)) {
      event.preventDefault();
      event.stopImmediatePropagation();
      send(a.href);
    }
  }, true);

  const selector = 'a[href],button,iframe,summary,textarea,input,select,[contenteditable="true"],[tabindex]';
  const visible = element => !element.closest('[hidden],[inert],[aria-hidden="true"]') &&
    !element.disabled && getComputedStyle(element).visibility !== "hidden" &&
    getComputedStyle(element).display !== "none" && element.getClientRects().length > 0;
  const openDialog = () => Array.from(document.querySelectorAll('dialog[open],[role="dialog"][aria-modal="true"],[role="alertdialog"][aria-modal="true"]')).filter(visible).pop();
  const focusable = root => Array.from(root.querySelectorAll(selector)).filter(element => element.tabIndex >= 0 && visible(element));
  window.addEventListener("message", event => {
    if (event.source !== parent || event.data?.type !== "tiny-viewer-focus" ||
        (event.data.edge !== "first" && event.data.edge !== "last")) return;
    const items = focusable(openDialog() || document);
    const target = event.data.edge === "last" ? items[items.length - 1] : items[0];
    if (target) target.focus();
    else if (document.body) {
      if (!document.body.hasAttribute("tabindex")) document.body.tabIndex = -1;
      document.body.focus();
    }
  });
  document.addEventListener("DOMContentLoaded", () => {
    parent.postMessage({ type: "tiny-viewer-ready" }, "*");
  }, { once: true });
  // Bubble after the surprise's own handlers. Its dialogs own their keys.
  window.addEventListener("keydown", event => {
    if (event.key !== "Tab" && event.key !== "Escape") return;
    if (event.defaultPrevented || event.isComposing || event.altKey || event.ctrlKey || event.metaKey || openDialog()) return;
    let action;
    if (event.key === "Escape") action = "escape";
    else if (event.key === "Tab") {
      const items = focusable(document);
      const active = document.activeElement;
      if (!items.length || (event.shiftKey && (active === items[0] || !items.includes(active))) ||
          (!event.shiftKey && active === items[items.length - 1])) {
        action = event.shiftKey ? "backward" : "forward";
      }
    }
    if (action) {
      event.preventDefault();
      parent.postMessage({ type: "tiny-viewer-keyboard", action }, "*");
    }
  });
})()</script>`;

export function withExternalLinkHandler(html: string): string {
  return /<head(?:\s[^>]*)?>/i.test(html)
    ? html.replace(/<head(?:\s[^>]*)?>/i, head => head + EXTERNAL_LINK_SCRIPT)
    : EXTERNAL_LINK_SCRIPT + html;
}
