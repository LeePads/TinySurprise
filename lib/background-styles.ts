/**
 * Centralized catalog for the curated raster background artwork in
 * `public/background/styles/`. Selecting one of these in the Appearance step
 * stores it as a normal `appearance.backgroundImage` (see
 * `builder-step-appearance.tsx`), so the existing preview rendering
 * (`appearanceVisual` in `./appearance`) and export embedding
 * (`embedImages` in `./export/image-conversion`) already carry it through
 * without any renderer-specific handling. `backgroundStyleId` only tracks
 * which curated option (if any) is selected, for UI state and contrast
 * metadata—swapping in a custom upload clears it.
 */
export interface BackgroundStyleOption {
  id: string;
  label: string;
  description: string;
  /** Filename inside public/background/styles/. */
  file: string;
  /** Site-relative path usable directly in <img>/CSS. */
  path: string;
  width: number;
  height: number;
  /** Known file size in bytes, used for accurate export size estimates. */
  bytes: number;
  /**
   * Readable-text guidance for this artwork: whether light (white/cream) or
   * dark ink reads best over it before the app's readability veil is
   * applied. Drives picker-tile text styling instead of the site theme.
   */
  ink: "light" | "dark";
  /** Short mood tag used to pair styles with a template's tone. */
  mood: string;
}

const file = (name: string) => `/background/styles/${name}`;

export const BACKGROUND_STYLES: readonly BackgroundStyleOption[] = [
  {
    id: "romantic-pastel-glow",
    label: "Romantic Pastel Glow",
    description: "Soft blush light with a warm, dreamy haze.",
    file: "tinysurprise-background-01-romantic-pastel-glow.png",
    path: file("tinysurprise-background-01-romantic-pastel-glow.png"),
    width: 1536,
    height: 1024,
    bytes: 1582203,
    ink: "dark",
    mood: "romantic",
  },
  {
    id: "vintage-botanical-paper",
    label: "Vintage Botanical Paper",
    description: "Pressed flowers on aged, keepsake-style paper.",
    file: "tinysurprise-background-02-vintage-botanical-paper.png",
    path: file("tinysurprise-background-02-vintage-botanical-paper.png"),
    width: 1536,
    height: 1024,
    bytes: 2634074,
    ink: "dark",
    mood: "nostalgic",
  },
  {
    id: "midnight-starlight",
    label: "Midnight Starlight",
    description: "A deep night sky scattered with soft stars.",
    file: "tinysurprise-background-03-midnight-starlight.png",
    path: file("tinysurprise-background-03-midnight-starlight.png"),
    width: 1536,
    height: 1024,
    bytes: 1894639,
    ink: "light",
    mood: "cinematic",
  },
  {
    id: "cotton-candy-sky",
    label: "Cotton-Candy Sky",
    description: "Fluffy pink and blue clouds like spun sugar.",
    file: "tinysurprise-background-05-cotton-candy-sky.png",
    path: file("tinysurprise-background-05-cotton-candy-sky.png"),
    width: 1536,
    height: 1024,
    bytes: 1627486,
    ink: "dark",
    mood: "sweet",
  },
  {
    id: "pixel-adventure",
    label: "Pixel Adventure",
    description: "Retro 8-bit landscape with arcade energy.",
    file: "tinysurprise-background-06-pixel-adventure.png",
    path: file("tinysurprise-background-06-pixel-adventure.png"),
    width: 1536,
    height: 1024,
    bytes: 1574919,
    ink: "light",
    mood: "adventurous",
  },
  {
    id: "cartoon-daydream",
    label: "Cartoon Daydream",
    description: "Bright, storybook-cartoon color and whimsy.",
    file: "tinysurprise-background-07-cartoon-daydream.png",
    path: file("tinysurprise-background-07-cartoon-daydream.png"),
    width: 1536,
    height: 1024,
    bytes: 1935041,
    ink: "dark",
    mood: "cheerful",
  },
  {
    id: "blooming-garden",
    label: "Blooming Garden",
    description: "Lush florals in full, sunlit bloom.",
    file: "tinysurprise-background-08-blooming-garden.png",
    path: file("tinysurprise-background-08-blooming-garden.png"),
    width: 1536,
    height: 1024,
    bytes: 2118137,
    ink: "dark",
    mood: "fresh",
  },
  {
    id: "enchanted-forest",
    label: "Enchanted Forest",
    description: "Moody woodland with warm, magical lantern light.",
    file: "tinysurprise-background-09-enchanted-forest.png",
    path: file("tinysurprise-background-09-enchanted-forest.png"),
    width: 1536,
    height: 1024,
    bytes: 2510009,
    ink: "light",
    mood: "mysterious",
  },
  {
    id: "city-pop-night",
    label: "City-Pop Night",
    description: "Neon skyline with a retro-glam night-drive feel.",
    file: "tinysurprise-background-10-city-pop-night.png",
    path: file("tinysurprise-background-10-city-pop-night.png"),
    width: 1536,
    height: 1024,
    bytes: 2163979,
    ink: "light",
    mood: "electric",
  },
] as const;

const BACKGROUND_STYLE_MAP = new Map(
  BACKGROUND_STYLES.map((style) => [style.id, style]),
);

export function getBackgroundStyle(
  id: string | undefined,
): BackgroundStyleOption | undefined {
  return id ? BACKGROUND_STYLE_MAP.get(id) : undefined;
}

export function isKnownBackgroundStyleId(value: unknown): value is string {
  return typeof value === "string" && BACKGROUND_STYLE_MAP.has(value);
}
