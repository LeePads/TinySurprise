import { describe, expect, it } from "vitest";
import { normalizeSiteTheme, SITE_THEME_VALUES } from "./site-theme";

describe("website theme persistence", () => {
  it("keeps every supported shell theme stable across reloads", () => {
    for (const theme of SITE_THEME_VALUES) {
      expect(normalizeSiteTheme(theme)).toBe(theme);
    }
  });

  it("migrates the legacy light and dark settings", () => {
    expect(normalizeSiteTheme("light")).toBe("warm-paper");
    expect(normalizeSiteTheme("dark")).toBe("evening-cocoa");
    expect(normalizeSiteTheme("forest")).toBe("evening-cocoa");
    expect(normalizeSiteTheme("pixel")).toBe("warm-paper");
  });

  it("falls back safely when storage contains an unknown value", () => {
    expect(normalizeSiteTheme("retired-theme")).toBe("follow-device");
    expect(normalizeSiteTheme(null)).toBe("follow-device");
  });
});
