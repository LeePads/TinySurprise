// Compatibility marker only: arbitrary HTML can copy it. The viewer always
// relies on its opaque-origin sandbox, never this marker, for isolation.
export const TINY_SURPRISE_HTML_MARKER = "tinysurprise-v1"

export function htmlShell(title: string, dataJson: string, css: string, runtime: string) {
  return `<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover"><meta name="color-scheme" content="light dark"><meta name="generator" content="${TINY_SURPRISE_HTML_MARKER}"><title>${title}</title><style>${css}</style></head><body><div id="app"><p class="loading">Opening your TinySurprise…</p></div><script>window.__TINY_SURPRISE__=${dataJson}</script><script>${runtime}</script></body></html>`
}
