import { describe, expect, it } from "vitest";
import { readViewerExternalLink, withExternalLinkHandler } from "./html-viewer-links";

describe("isolated HTML external-link handoff", () => {
  const viewer = {} as Window;
  it("accepts only its own frame and a validated http(s) destination", () => {
    const data = { type: "tiny-external-link", url: "https://www.youtube.com/watch?v=dQw4w9WgXcQ" };
    expect(readViewerExternalLink({ source: viewer, data }, viewer)).toBe(data.url);
    expect(readViewerExternalLink({ source: {} as Window, data }, viewer)).toBeUndefined();
    expect(readViewerExternalLink({ source: null, data }, null)).toBeUndefined();
    for (const url of ["javascript:alert(1)", "file:///private", "intent://open", "data:text/html,x", "https://user:pass@example.com/", "not a URL", "https://example.com/" + "x".repeat(4096)]) {
      expect(readViewerExternalLink({ source: viewer, data: { ...data, url } }, viewer)).toBeUndefined();
    }
    expect(readViewerExternalLink({ source: viewer, data: { ...data, type: "storage-read" } }, viewer)).toBeUndefined();
  });
  it("installs the handoff before original scripts without changing their content", () => {
    const original = '<!doctype html><html><head><script>window.original=true</script></head><body>Surprise</body></html>';
    const wrapped = withExternalLinkHandler(original);
    const script = wrapped.match(/<script>([\s\S]*?)<\/script>/)?.[1];
    expect(script).toContain("parent.postMessage");
    expect(() => new Function(script!)).not.toThrow();
    expect(wrapped).toContain('<script>window.original=true</script>');
    expect(withExternalLinkHandler("<p>Hello</p>")).toMatch(/^<script>/);
  });
});
