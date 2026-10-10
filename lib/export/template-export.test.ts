import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  containsUnresolvedLocalReference,
  generateHtml,
} from "./html-generator";
import type { LocalImage, SurpriseData, TemplateType } from "../types";
import { appearanceVisual, CATCH_FIELD_BACKGROUND } from "../appearance";

class TestFileReader {
  result: string | null = null;
  onload: (() => void) | null = null;
  onerror: (() => void) | null = null;
  readAsDataURL(blob: Blob) {
    blob
      .arrayBuffer()
      .then((buffer) => {
        this.result = `data:${blob.type};base64,${Buffer.from(buffer).toString("base64")}`;
        this.onload?.();
      })
      .catch(() => this.onerror?.());
  }
}

const gif = (id: string): LocalImage => {
  const file = new File(
    ["GIF89a", new Uint8Array([1, 0, 1, 0])],
    `${id} ü.gif`,
    { type: "image/gif" },
  );
  return {
    id,
    file,
    previewUrl: `blob:${id}`,
    name: file.name,
    mimeType: file.type,
    size: file.size,
  };
};

const largeGif = (id: string): LocalImage => {
  const bytes = new Uint8Array(4 * 1024 * 1024);
  bytes.set(new TextEncoder().encode("GIF89a"));
  const file = new File([bytes], `${id}.gif`, { type: "image/gif" });
  return { id, file, previewUrl: `blob:${id}`, name: file.name, mimeType: file.type, size: file.size };
};

const base = (template: TemplateType): Omit<SurpriseData, "content"> => ({
  template,
  basics: {
    senderName: "Alex",
    recipientName: "Mía",
    openingMessage: "For you",
  },
  appearance: { theme: "soft-rose", animationIntensity: "normal" },
  delivery: { expiration: "none" },
});

describe("self-contained template exports", () => {
  beforeEach(() => vi.stubGlobal("FileReader", TestFileReader));
  afterEach(() => vi.unstubAllGlobals());

  it.each([
    ["soft", 0.25], ["balanced", 0.46], ["strong", 0.68],
  ] as const)("keeps the %s backdrop filter and transparent Catch field in the final CSS", async (filter, veil) => {
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      appearance: { theme: 'soft-rose', animationIntensity: 'normal', backgroundFilter: filter, backgroundImage: gif(`background-${filter}`) },
      content: { hearts: [{ id: 'h1', message: 'Keep this moment' }], finalMessage: 'All done', soundEffects: false },
    };
    const output = await generateHtml(data);
    expect(output.html).toContain(`rgba(20,16,22,${veil})`);
    expect(output.html).toContain(`--catch-field-background:${CATCH_FIELD_BACKGROUND}`);
    expect(output.html).toContain('.catch-field{background:var(--catch-field-background)}');
    expect(output.html).not.toContain('.catch-field{background:color-mix(in srgb,var(--canvas) 94%,transparent)}');
    expect(output.html).toContain('data:image/gif;base64,');
    expect(output.html).not.toContain(`blob:background-${filter}`);
    const visual = appearanceVisual(data.appearance);
    expect(visual.backdropOverlay).toContain(`rgba(20,16,22,${veil})`);
    expect(visual.tokens.surfaceForeground).toBe('#fffaf7');
  });

  it.each<SurpriseData>([
    {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      content: {
        hearts: [
          { id: "h1", message: "One", photo: gif("heart") },
          { id: "h2", message: "Two" },
          { id: "h3", message: "Three" },
        ],
        finalMessage: "All done",
        soundEffects: false,
      },
    },
    {
      ...base("photo-puzzle"),
      template: "photo-puzzle",
      content: {
        photo: gif("puzzle"),
        difficulty: "hard",
        completionMessage: "Solved",
        finalMessage: "Done",
      },
    },
    {
      ...base("open-when"),
      template: "open-when",
      content: {
        envelopes: [
          {
            id: "e1",
            title: "Open one",
            message: "One",
            photo: gif("envelope"),
          },
          { id: "e2", title: "Open two", message: "Two" },
          { id: "e3", title: "Open three", message: "Three" },
        ],
        finalMessage: "All open",
      },
    },
    {
      ...base("choose-our-date"),
      template: "choose-our-date",
      content: {
        introMessage: "Choose with me",
        rounds: [
          {
            id: "r1",
            question: "Mood?",
            options: [
              {
                id: "d1",
                title: "Picnic",
                details: "At sunset",
                photo: gif("date"),
              },
              { id: "d2", title: "Movie", details: "At home" },
            ],
          },
          {
            id: "r2",
            question: "Treat?",
            options: [
              { id: "d3", title: "Cake", details: "Chocolate" },
              { id: "d4", title: "Fruit", details: "Fresh" },
            ],
          },
        ],
        result: {
          title: "Our date",
          description: "Made by us",
          details: "At sunset",
          invitation: "It is a date",
        },
      },
    },
    {
      ...base("memory-quiz"),
      template: "memory-quiz",
      content: {
        questions: [
          {
            id: "q1",
            prompt: "Where?",
            answers: ["Here", "There"],
            correctIndex: 0,
            memoryNote: "A lovely day",
            photo: gif("quiz"),
          },
          {
            id: "q2",
            prompt: "When?",
            answers: ["Now", "Then"],
            correctIndex: 1,
            memoryNote: "",
          },
          {
            id: "q3",
            prompt: "What?",
            answers: ["This", "That"],
            correctIndex: 0,
            memoryNote: "",
          },
        ],
        finalMessage: "You remember us",
      },
    },
  ])(
    "exports $template with embedded images and no network dependency",
    async (data) => {
      const output = await generateHtml(data);
      expect(output.html).toContain("data:image/gif;base64,");
      expect(output.html).not.toContain("blob:");
      expect(output.html).not.toMatch(/https?:\/\//);
      expect(output.blob.type).toBe("text/html;charset=utf-8");
      const scripts = [
        ...output.html.matchAll(/<script>([\s\S]*?)<\/script>/g),
      ];
      expect(() => Function(scripts.at(-1)?.[1] || "")).not.toThrow();
    },
  );

  it("keeps the readable playful passphrase out of the exported file", async () => {
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      delight: {
        coverEnabled: true,
        coverMessage: "For your eyes only",
        openingStyle: "gift-unwrap",
        passphraseEnabled: true,
        passphrase: "strawberry moon",
        closingMessage: "Made just for you",
        signature: "With love, Alex",
      },
      content: {
        hearts: [
          { id: "h1", message: "One" },
          { id: "h2", message: "Two" },
          { id: "h3", message: "Three" },
        ],
        finalMessage: "All done",
        soundEffects: false,
      },
    };
    const output = await generateHtml(data);
    expect(output.html).not.toContain("strawberry moon");
    expect(output.html).toContain("passphraseHash");
    expect(output.html).toContain("gift-unwrap");
  });

  it("embeds an exact nine-photo batch with no browser-only references", async () => {
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      content: {
        hearts: Array.from({ length: 9 }, (_, i) => ({
          id: `h${i}`,
          message: `Memory ${i + 1}`,
          photo: gif(`photo-${i}`),
        })),
        finalMessage: "All nine",
        soundEffects: false,
      },
    };
    const output = await generateHtml(data);
    expect(output.html.match(/data:image\/gif;base64,/g) || []).toHaveLength(9);
    expect(output.mediaContributions.filter((item) => item.kind === "image")).toHaveLength(9);
    expect(containsUnresolvedLocalReference(output.html)).toBe(false);
    expect(output.html).toContain("All nine");
  });

  it("uses the falling-heart runtime instead of the legacy grid", async () => {
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      content: {
        hearts: [
          { id: "h1", message: "One" },
          { id: "h2", message: "Two" },
          { id: "h3", message: "Three" },
        ],
        finalMessage: "All done",
        soundEffects: false,
      },
    };
    const output = await generateHtml(data);
    expect(output.html).toContain("export-heart");
    expect(output.html).toContain("renderEnhancedCatch");
    expect(output.html).toContain("catch-experience");
    expect(output.html).toContain("catch-header-actions");
    expect(output.html).toContain("staticHearts");
    expect(output.html).toContain("animation:none");
    expect(output.html).toContain("activeHeartCount");
    expect(output.html).toContain("translateX(8px)");
    expect(output.html).toContain("rotate(6deg)");
    expect(output.html).toContain(".export-heart.caught");
    expect(output.html).toContain("pointer-events:none");
    expect(output.html).toContain('id="catch-replay"');
    expect(output.html).toContain("Catch them again");
    expect(output.html).toContain("renderTemplate()");
    expect(output.html.indexOf('id="catch-field"')).toBeLessThan(
      output.html.indexOf('id="catch-final"'),
    );
    expect(output.html).not.toContain("Try again");
  });

  it("enforces the final HTML ceiling after embedding and reports contributors", async () => {
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      content: {
        hearts: Array.from({ length: 7 }, (_, index) => ({
          id: `h${index}`,
          message: `Memory ${index + 1}`,
          photo: largeGif(`large-${index}`),
        })),
        finalMessage: "All done",
        soundEffects: false,
      },
    };
    await expect(generateHtml(data)).rejects.toThrow(
      /finished file is over 25 MB.*Heart [1-7]/,
    );
  });

  it("embeds the selected falling-heart artwork in the portable file", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(
        async () =>
          new Response(new Blob(["pixel-heart"], { type: "image/png" }), {
            status: 200,
          }),
      ),
    );
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      content: {
        hearts: [{ id: "h1", message: "One" }],
        finalMessage: "All done",
        soundEffects: false,
        heartStyle: "pixel",
      },
    };
    const output = await generateHtml(data);
    expect(output.html).toContain("data:image/png;base64,");
    expect(output.html).toContain("export-heart-art");
    expect(fetch).toHaveBeenCalledWith("/hearts/heart_pixel.png");
  });

  it("embeds uploaded audio and uses the opening tap for playback", async () => {
    const file = new File(["tiny audio"], "our-song.mp3", {
      type: "audio/mpeg",
    });
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      delight: {
        coverEnabled: false,
        coverMessage: "",
        openingStyle: "sparkle-pop",
        passphraseEnabled: false,
        passphrase: "",
        closingMessage: "",
        signature: "",
      },
      content: {
        hearts: [{ id: "h1", message: "One" }],
        finalMessage: "All done",
        soundEffects: false,
        songFile: {
          id: "song",
          file,
          previewUrl: "blob:song",
          name: file.name,
          mimeType: file.type,
          size: file.size,
        },
      },
    };
    const output = await generateHtml(data);
    expect(output.html).toContain("data:audio/mpeg;base64,");
    expect(output.html).not.toContain("blob:song");
    expect(output.html).toContain(
      "Your uploaded audio is included.",
    );
    expect(output.html).toContain("opening-flourish-sparkle-pop");
    expect(output.html).toContain("Opening moment");
  });

  it("embeds a custom appearance background and preserves the selected treatment", async () => {
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      appearance: {
        theme: "pixel-love",
        accentColor: "#12ab8f",
        backgroundStyle: "pixel-grid",
        backgroundFilter: "strong",
        backgroundImage: gif("scene"),
        fontPairing: "classic",
        animationIntensity: "reduced",
      },
      content: {
        hearts: [{ id: "h1", message: "One" }],
        finalMessage: "All done",
        soundEffects: false,
      },
    };
    const output = await generateHtml(data);
    expect(output.html).toContain("data:image/gif;base64,");
    expect(output.html).toContain("repeating-linear-gradient(90deg");
    expect(output.html).toContain("--brand:#12ab8f");
    expect(output.html).toContain("animation-duration:.01ms");
    expect(output.html).toContain("body::before,body::after");
    expect(output.html).toContain('background:url("data:image/gif;base64,');
  });

  it("opens YouTube externally without an embedded player or playback fallback", async () => {
    const data: SurpriseData = {
      ...base("catch-the-heart"),
      template: "catch-the-heart",
      content: {
        hearts: [{ id: "h1", message: "One" }],
        finalMessage: "All done",
        soundEffects: false,
        songUrl: "https://youtu.be/dQw4w9WgXcQ",
      },
    };
    const output = await generateHtml(data);
    expect(output.html).toContain("Open YouTube");
    expect(output.html).toContain("YouTube opens separately and needs internet.");
    expect(output.html).toContain("https://www.youtube.com/watch?v=dQw4w9WgXcQ");
    expect(output.html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(output.html).not.toContain("iframe_api");
    expect(output.html).not.toContain("youtube.com/embed/");
    expect(output.html).not.toContain("directYouTube");
    expect(output.html).not.toContain("YT.Player");
    expect(output.html).not.toContain("autoplay=1");
    expect(output.html).not.toContain('id="catch-music"');
    expect(output.html).not.toContain('id="music-toggle"');

  });

  it("exports all over-budget recipient text intact", async () => {
    const prose = "unbroken".repeat(1600) + "\n?? Final line";
    const data: SurpriseData = { ...base("catch-the-heart"), content: {
      hearts: [{ id: "long", message: prose }], finalMessage: prose, soundEffects: false,
    } };
    const output = await generateHtml(data);
    expect(output.html).toContain(JSON.stringify(prose).slice(1, -1));
    expect(output.html).toContain("overflow-wrap:anywhere");
    expect(output.html).toContain("catch-completion-description");
  });

  it("preserves quiz answer indexes and reveals its embedded photo", async () => {
    const data: SurpriseData = {
      ...base("memory-quiz"),
      template: "memory-quiz",
      content: {
        questions: [
          {
            id: "q1",
            prompt: "Which one?",
            answers: ["", "The right memory", "Another memory"],
            correctIndex: 1,
            memoryNote: "",
            photo: gif("quiz-index"),
          },
          {
            id: "q2",
            prompt: "Which other one?",
            answers: ["A memory", "The right memory", "Another memory"],
            correctIndex: 0,
            memoryNote: "A second memory.",
          },
          {
            id: "q3",
            prompt: "One more?",
            answers: ["Yes", "No", "Maybe"],
            correctIndex: 0,
            memoryNote: "A third memory.",
          },
        ],
        finalMessage: "Remembered",
      },
    };
    const output = await generateHtml(data);
    expect(output.html).toContain(
      ".map((answer,originalIndex)=>({answer,originalIndex}))",
    );
    expect(output.html).toContain(`data-i="'+item.originalIndex`);
    expect(output.html).toContain(
      "img(question.photo,'Shared quiz memory')",
    );
    expect(output.html).toContain("data:image/gif;base64,");
  });

  it("stops export instead of ever embedding a javascript: URL", async () => {
    // Per DECISIONS.md ("Network media"): a blocked or invalid remote
    // resource must stop export with guidance, never silently pass through.
    // normalizeHttpUrl rejects non-http(s) schemes before any fetch runs,
    // so this needs no network mocking to be deterministic.
    const data: SurpriseData = {
      ...base("cozy-playlist"),
      template: "cozy-playlist",
      content: {
        tracks: [
          {
            id: "t1",
            title: "A song",
            artist: "An artist",
            why: "A memory",
            link: "https://music.example.com/song",
            photo: {
              id: "remote",
              previewUrl: "javascript:alert(2)",
              name: "bad.jpg",
              mimeType: "image/remote",
              size: 0,
              source: "url",
            },
          },
          {
            id: "t2",
            title: "Another song",
            artist: "An artist",
            why: "Another memory",
            link: "https://music.example.com/another-song",
          },
        ],
        finalMessage: "Always",
      },
    };
    await expect(generateHtml(data)).rejects.toThrow(
      /enter a valid public http:\/\/ or https:\/\/ URL/,
    );
  });

  it("embeds a fetchable public image URL as a data URL (never as a live link)", async () => {
    // DECISIONS.md: "Export also fetches and embeds HTTP(S) image/video
    // URLs when browser CORS access permits." fetch is mocked so this is
    // deterministic and needs no live internet access.
    const gifBytes = new Uint8Array([
      ...new TextEncoder().encode("GIF89a"),
      1, 0, 1, 0,
    ]);
    const fetchMock = vi.fn(async (url: string | URL) => {
      expect(String(url)).toBe("https://images.example.com/memory.jpg");
      return new Response(gifBytes, {
        status: 200,
        headers: { "content-type": "image/gif" },
      });
    });
    vi.stubGlobal("fetch", fetchMock);

    const data: SurpriseData = {
      ...base("our-storybook"),
      template: "our-storybook",
      content: {
        pages: [
          {
            id: "p1",
            title: "First",
            body: "A beginning",
            photo: {
              id: "remote",
              previewUrl: "https://images.example.com/memory.jpg",
              name: "memory.jpg",
              mimeType: "image/remote",
              size: 0,
              source: "url",
            },
          },
          { id: "p2", title: "Next", body: "A forever" },
        ],
        finalMessage: "Always",
      },
    };
    const output = await generateHtml(data);
    expect(fetchMock).toHaveBeenCalledTimes(1);
    expect(output.html).toContain("data:image/gif;base64,");
    expect(output.html).not.toContain("images.example.com");
    expect(output.html).not.toContain("blob:");
  });

  it("fails export with guidance when a remote image URL can't be fetched", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new TypeError("Failed to fetch");
      }),
    );
    const data: SurpriseData = {
      ...base("our-storybook"),
      template: "our-storybook",
      content: {
        pages: [
          {
            id: "p1",
            title: "First",
            body: "A beginning",
            photo: {
              id: "remote",
              previewUrl: "https://blocked.example.com/memory.jpg",
              name: "memory.jpg",
              mimeType: "image/remote",
              size: 0,
              source: "url",
            },
          },
          { id: "p2", title: "Next", body: "A forever" },
        ],
        finalMessage: "Always",
      },
    };
    await expect(generateHtml(data)).rejects.toThrow(/Upload the file directly/);
  });

  // Unregistered legacy template identifiers intentionally have no export
  // coverage. The active registry is the product source of truth.

  it("detects unresolved local and internal references", () => {
    expect(containsUnresolvedLocalReference('<img src="blob:abc">')).toBe(true);
    expect(
      containsUnresolvedLocalReference(
        '<a href="http://localhost:3000/create/x">',
      ),
    ).toBe(true);
    expect(containsUnresolvedLocalReference('<img src="/_next/image">')).toBe(
      true,
    );
    expect(
      containsUnresolvedLocalReference(
        '<img src="data:image/png;base64,AA==">',
      ),
    ).toBe(false);
  });

  it("exports prose mentioning local hosts and framework names without treating it as an asset", async () => {
    const message = 'Our localhost story mentions react-dom, process.env, NEXT_PUBLIC_ and </script> safely.';
    const output = await generateHtml({
      ...base("catch-the-heart"), template: "catch-the-heart",
      content: { hearts: [{ id: "h", message }], finalMessage: message, soundEffects: false },
    });
    expect(output.html).toContain("localhost story");
    expect(output.html).toContain("\\u003c/script\\u003e");
    expect(containsUnresolvedLocalReference(output.html)).toBe(false);
  });

  it.each<SurpriseData>([
    {
      ...base("our-storybook"),
      template: "our-storybook",
      content: {
        pages: [
          { id: "p1", title: "First", body: "A beginning" },
          { id: "p2", title: "Next", body: "A forever" },
        ],
        finalMessage: "The end is another beginning",
      },
    },
    {
      ...base("wish-upon-a-star"),
      template: "wish-upon-a-star",
      content: {
        stars: [
          { id: "s1", wish: "A wish", message: "A note", color: "#f8c96a" },
          {
            id: "s2",
            wish: "Another wish",
            message: "Another note",
            color: "#f8c96a",
          },
          { id: "s3", wish: "Always", message: "Always", color: "#f8c96a" },
        ],
        finalMessage: "Our constellation",
      },
    },
    {
      ...base("cozy-playlist"),
      template: "cozy-playlist",
      content: {
        tracks: [
          { id: "t1", title: "First song", artist: "Us", why: "Because" },
          { id: "t2", title: "Second song", artist: "Us", why: "Forever" },
        ],
        finalMessage: "Press play on us",
      },
    },
  ])("exports the newer $template runtimes", async (data) => {
    const output = await generateHtml(data);
    expect(output.html).toContain("Start Surprise");
    expect(output.html).toContain(data.template);
    const scripts = [...output.html.matchAll(/<script>([\s\S]*?)<\/script>/g)];
    expect(() => Function(scripts.at(-1)?.[1] || "")).not.toThrow();
  });
});
