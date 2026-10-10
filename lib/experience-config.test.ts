import { describe, expect, it } from "vitest";
import {
  normalizeBuilderStateForExperience,
  parseRecipientExperienceConfig,
} from "./experience-config";
import type { SurpriseData } from "./types";

const base = (
  content: SurpriseData["content"],
  template: SurpriseData["template"] = "catch-the-heart",
): SurpriseData => ({
  template,
  basics: {
    senderName: "Alex",
    recipientName: "Mia",
    openingMessage: "For you",
  },
  content,
  appearance: { theme: "soft-rose", animationIntensity: "normal" },
  delivery: { expiration: "none" },
  delight: {
    coverEnabled: true,
    coverMessage: "A little gift",
    openingStyle: "gift-unwrap",
    passphraseEnabled: false,
    passphrase: "",
    closingMessage: "Close",
    signature: "Alex",
  },
});

describe("recipient experience normalization", () => {
  it("keeps preview and export-facing values in one shape", () => {
    const data = base({
      hearts: [
        { id: "h1", message: "Hello" },
        { id: "h2", message: "Again" },
        { id: "h3", message: "Always" },
      ],
      finalMessage: "Love",
      soundEffects: false,
      songUrl: "https://youtu.be/dQw4w9WgXcQ",
      loopSong: true,
    });
    const config = normalizeBuilderStateForExperience(data);
    expect(config.recipient).toBe("Mia");
    expect(config.music.loop).toBe(true);
    expect(config.cover.openingStyle).toBe("gift-unwrap");
    expect(config.content).toStrictEqual(data.content);
  });

  it("sanitizes playlist links and recovered image URLs", () => {
    const data = base(
      {
        tracks: [
          { id: "t2", title: "Another song", artist: "Someone", why: "Another memory", link: "https://example.com/song" },
          {
            id: "t1",
            title: "Our song",
            artist: "Someone",
            why: "A memory",
            link: "javascript:alert(1)",
            photo: {
              id: "bad",
              previewUrl: "javascript:alert(2)",
              name: "bad",
              mimeType: "image/remote",
              size: 0,
            },
          },
        ],
        finalMessage: "Always",
      },
      "cozy-playlist",
    );
    const config = normalizeBuilderStateForExperience(data);
    const track = (
      config.content as Extract<
        SurpriseData["content"],
        { tracks: unknown }
      >
    ).tracks[1];
    expect(track.link).toBe("");
    expect(track.photo).toBeUndefined();
  });

  it("normalizes bounded exported Storybook data before recovery", () => {
    const data = base(
      {
        pages: Array.from({ length: 60 }, (_, index) => ({
          id: `p${index}`,
          title: `Chapter ${index + 1}`,
          body: "A memory",
        })),
        finalMessage: "Always",
      },
      "our-storybook",
    );
    const exported = normalizeBuilderStateForExperience(data);
    const imported = {
      ...exported,
      appearance: {
        ...exported.appearance,
        theme: "not-a-theme",
        accentColor: "#fff;}</style><script>alert(1)</script>",
        backgroundStyle: "url(javascript:alert(1))",
        backgroundFilter: "strong",
        fontPairing: "serif;}</style>",
        backgroundImage: {
          previewUrl: "javascript:alert(1)",
        },
      },
      cover: {
        ...exported.cover,
        openingStyle: "not-an-opening",
      },
    };
    const parsed = parseRecipientExperienceConfig(imported);
    expect(parsed).not.toBeNull();
    expect(parsed?.appearance.theme).toBe("soft-rose");
    expect(parsed?.appearance.accentColor).toBeUndefined();
    expect(parsed?.appearance.backgroundStyle).toBeUndefined();
    expect(parsed?.appearance.backgroundFilter).toBe("strong");
    expect(parsed?.appearance.fontPairing).toBeUndefined();
    expect(parsed?.appearance.backgroundImage).toBeUndefined();
    expect(parsed?.cover.openingStyle).toBe("gentle-fade");
    expect(
      (parsed?.content as Extract<
        SurpriseData["content"],
        { pages: unknown }
      >).pages,
    ).toHaveLength(20);
  });

  it("rejects structurally incomplete imported experiences", () => {
    expect(
      parseRecipientExperienceConfig({
        template: "our-storybook",
        cover: {},
        appearance: {},
        music: {},
        content: { pages: [] },
      }),
    ).toBeNull();
  });
});
