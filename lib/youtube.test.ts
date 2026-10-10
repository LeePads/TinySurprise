import { describe, expect, it } from "vitest";
import { parseYouTubeUrl, youtubeWatchUrl } from "./youtube";

describe("YouTube URL parsing", () => {
  it.each([
    "https://www.youtube.com/watch?v=dQw4w9WgXcQ&t=10s",
    "https://youtu.be/dQw4w9WgXcQ?si=abc",
    "https://youtube.com/shorts/dQw4w9WgXcQ",
    "https://www.youtube.com/embed/dQw4w9WgXcQ?autoplay=1",
  ])("accepts %s", (url) =>
    expect(parseYouTubeUrl(url)?.id).toBe("dQw4w9WgXcQ"),
  );
  it.each([
    "https://vimeo.com/123",
    "https://youtube.com/playlist?list=abc",
    "not-a-url",
    "javascript:alert(1)",
  ])("rejects %s", (url) => expect(parseYouTubeUrl(url)).toBeNull());

  it("builds a canonical autoplay watch URL for exported files", () => {
    expect(youtubeWatchUrl("dQw4w9WgXcQ", true)).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ&autoplay=1",
    );
    expect(youtubeWatchUrl("dQw4w9WgXcQ")).toBe(
      "https://www.youtube.com/watch?v=dQw4w9WgXcQ",
    );
    expect(youtubeWatchUrl("bad!id", true)).toBeNull();
  });
});
