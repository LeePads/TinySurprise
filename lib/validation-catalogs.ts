/** Runtime value catalogs shared by draft and recipient-data validation. */
export const ANIMATION_INTENSITY_VALUES = [
  "reduced",
  "normal",
  "playful",
  "subtle",
  "medium",
  "energetic",
] as const;

export const BACKGROUND_STYLE_VALUES = [
  "soft",
  "gradient",
  "paper",
  "aurora",
  "starlight",
  "floating-hearts",
  "doodle",
  "pixel-grid",
  "scrapbook",
  "bokeh",
  "gingham",
  "film-grain",
] as const;

export const BACKGROUND_FILTER_VALUES = ["soft", "balanced", "strong"] as const;

export const FONT_PAIRING_VALUES = [
  "friendly",
  "classic",
  "playful",
  "handwritten",
  "romantic",
  "modern",
] as const;

export const EXPIRATION_VALUES = ["none", "24h", "3d", "7d"] as const;
