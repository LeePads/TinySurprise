import type {
  OpeningStyle,
  TemplateConfig,
  TemplateType,
  Theme,
} from "./types";

export const TEMPLATES: Record<string, TemplateConfig> = {
  "catch-the-heart": {
    id: "catch-the-heart",
    name: "Catch the Heart",
    description: "Catch little hearts and uncover memories.",
    difficulty: "easy",
    isAvailable: true,
    category: ["love", "anniversary", "just-because"],
  },
  "photo-puzzle": {
    id: "photo-puzzle",
    name: "Photo Puzzle",
    description: "Piece a favorite photograph back together.",
    difficulty: "medium",
    isAvailable: true,
    category: ["birthday", "congratulations", "just-because"],
  },
  "open-when": {
    id: "open-when",
    name: "Letters for Every Moment",
    description: "Create little messages for moments they may need them.",
    difficulty: "easy",
    isAvailable: true,
    category: ["love", "friendship", "just-because"],
  },
  "choose-our-date": {
    id: "choose-our-date",
    name: "Choose Our Date",
    description: "Pick the next little adventure together.",
    difficulty: "easy",
    isAvailable: true,
    category: ["love", "anniversary"],
  },
  "memory-quiz": {
    id: "memory-quiz",
    name: "Memory Quiz",
    description: "See who remembers the little details.",
    difficulty: "hard",
    isAvailable: true,
    category: ["friendship", "anniversary", "just-because"],
  },
  "our-storybook": {
    id: "our-storybook",
    name: "Our Tiny Storybook",
    description: "Turn favorite moments into little chapters.",
    difficulty: "medium",
    isAvailable: true,
    category: ["love", "anniversary", "friendship"],
  },
  "cozy-playlist": {
    id: "cozy-playlist",
    name: "The Cozy Playlist",
    description: "Pair songs with the moments behind them.",
    difficulty: "easy",
    isAvailable: true,
    category: ["love", "friendship"],
  },
  "love-coupons": {
    id: "love-coupons",
    name: "Pocketful of Promises",
    description: "Open and redeem playful little coupons made just for them.",
    difficulty: "easy",
    isAvailable: false,
    category: ["love", "just-because"],
    preview: "/s/love-coupons-demo",
  },
  "memory-capsule": {
    id: "memory-capsule",
    name: "Memory Time Capsule",
    description:
      "Seal photos, notes, and wishes inside a tiny future keepsake.",
    difficulty: "medium",
    isAvailable: false,
    category: ["anniversary", "friendship", "just-because"],
    preview: "/s/memory-capsule-demo",
  },
  "treasure-hunt": {
    id: "treasure-hunt",
    name: "Our Little Treasure Hunt",
    description: "Follow charming clues through the moments only you two know.",
    difficulty: "medium",
    isAvailable: false,
    category: ["birthday", "love", "friendship"],
    preview: "/s/treasure-hunt-demo",
  },
};

/** Public creation surfaces only expose templates marked ready for release. */
export function getReleasedTemplateEntries() {
  return Object.entries(TEMPLATES).filter(([, template]) => template.isAvailable);
}

export const THEME_CONFIGS: Record<
  Theme,
  { primary: string; accent: string; background: string }
> = {
  "soft-rose": {
    primary: "#b85c6f",
    accent: "#d9a06f",
    background: "#fff8f3",
  },
  "peach-glow": {
    primary: "#c86f4a",
    accent: "#e0aa62",
    background: "#fff6ea",
  },
  "lavender-dream": {
    primary: "#896b8e",
    accent: "#d2a38f",
    background: "#faf5f2",
  },
  "sunny-day": {
    primary: "#ad7e2f",
    accent: "#d5b26b",
    background: "#fffaf0",
  },
  "blush-night": {
    primary: "#d38b91",
    accent: "#c7a26a",
    background: "#2a211f",
  },
  "sweet-sky": { primary: "#63806a", accent: "#d5a077", background: "#f4f7f1" },
  "cotton-candy": {
    primary: "#c75f9a",
    accent: "#69afc6",
    background: "#fff5fb",
  },
  "candy-pop": { primary: "#df5369", accent: "#6657d9", background: "#fff7e9" },
  "berry-cream": {
    primary: "#8f3f69",
    accent: "#dca25e",
    background: "#fff6f2",
  },
  "seaside-love": {
    primary: "#397f82",
    accent: "#e49a86",
    background: "#f1fbf8",
  },
  "doodle-love": {
    primary: "#356b5d",
    accent: "#e28c6d",
    background: "#fffdf3",
  },
  "pixel-love": {
    primary: "#d64f7c",
    accent: "#5c61d8",
    background: "#fff5fb",
  },
  "cherry-soda": {
    primary: "#d9355f",
    accent: "#ffd166",
    background: "#fff6f2",
  },
  "enchanted-forest": {
    primary: "#47745b",
    accent: "#d7a85c",
    background: "#f3f5ed",
  },
  "sunset-letter": {
    primary: "#d46f55",
    accent: "#77558f",
    background: "#fff4e8",
  },
  "moonlit-blue": {
    primary: "#7896db",
    accent: "#d5a5ca",
    background: "#171b36",
  },
  "strawberry-milk": { primary: "#e47d93", accent: "#f7c7a4", background: "#fff5f2" },
  "matcha-morning": { primary: "#6b8f71", accent: "#ddb878", background: "#f7f5e8" },
  "terracotta-sky": { primary: "#c96855", accent: "#6da5b6", background: "#fff1e6" },
  "violet-night": { primary: "#a278d0", accent: "#f2b4c5", background: "#211a36" },
};

export const THEME_LABELS: Record<Theme, string> = {
  "soft-rose": "Rosewood Love",
  "peach-glow": "Apricot Hearth",
  "lavender-dream": "Lavender Linen",
  "sunny-day": "Honey Cottage",
  "blush-night": "Cocoa Romance",
  "sweet-sky": "Sage & Linen",
  "cotton-candy": "Cotton Candy",
  "candy-pop": "Candy Pop",
  "berry-cream": "Berry & Cream",
  "seaside-love": "Seaside Love",
  "doodle-love": "Doodle Love",
  "pixel-love": "Pixel Hearts",
  "cherry-soda": "Cherry Soda",
  "enchanted-forest": "Enchanted Forest",
  "sunset-letter": "Sunset Letter",
  "moonlit-blue": "Moonlit Blue",
  "strawberry-milk": "Strawberry Milk",
  "matcha-morning": "Matcha Morning",
  "terracotta-sky": "Terracotta Sky",
  "violet-night": "Violet Night",
};

export const OPENING_STYLES: {
  value: OpeningStyle;
  label: string;
  description: string;
}[] = [
  {
    value: "gentle-fade",
    label: "Gentle Fade",
    description: "Softly fades into view.",
  },
  {
    value: "gift-unwrap",
    label: "Gift Unwrap",
    description: "Opens like a little present.",
  },
  {
    value: "envelope-reveal",
    label: "Envelope Reveal",
    description: "Unseals like a letter.",
  },
  {
    value: "sparkle-pop",
    label: "Sparkle Pop",
    description: "Appears with a tiny celebration.",
  },
  {
    value: "cinematic-curtain",
    label: "Cinematic Curtain",
    description: "A dramatic scene opens from the center.",
  },
  {
    value: "polaroid-drop",
    label: "Polaroid Drop",
    description: "The moment lands like a favorite photograph.",
  },
  {
    value: "heart-bloom",
    label: "Heart Bloom",
    description: "A heart grows into a soft romantic reveal.",
  },
  {
    value: "storybook-turn",
    label: "Storybook Turn",
    description: "Turns in like the first page.",
  },
];

export const TEMPLATE_PERSONALITY: Partial<
  Record<
    TemplateType,
    { eyebrow: string; prompt: string; empty: string; motif: string }
  >
> = {
  "catch-the-heart": {
    eyebrow: "A little love is floating by",
    prompt: "Catch each heart to uncover a note.",
    empty: "Your first little note will appear here.",
    motif: "sparkles",
  },
  "photo-puzzle": {
    eyebrow: "A memory, piece by piece",
    prompt: "Slide the pieces and bring this moment back together.",
    empty: "Add a photo to turn a memory into a puzzle.",
    motif: "tiles",
  },
  "open-when": {
    eyebrow: "A letter waiting for the right moment",
    prompt: "Open whichever little letter feels right today.",
    empty: "Your comforting letters will wait here.",
    motif: "paper",
  },
  "choose-our-date": {
    eyebrow: "A little adventure for two",
    prompt: "Choose the date that makes your heart happiest.",
    empty: "Your date ideas will wait here.",
    motif: "ribbon",
  },
  "memory-quiz": {
    eyebrow: "How well do you remember us?",
    prompt: "Answer, laugh, and uncover the story behind each question.",
    empty: "Your shared memories become the questions.",
    motif: "sparkles",
  },
  "our-storybook": {
    eyebrow: "Our little chapters",
    prompt: "Turn the pages and revisit the moments that made us.",
    empty: "Your first chapter is waiting.",
    motif: "paper",
  },
  "cozy-playlist": {
    eyebrow: "Songs that feel like us",
    prompt: "Press play on the memories behind each track.",
    empty: "Your cozy soundtrack is waiting.",
    motif: "sparkles",
  },
};

export const ANIMATION_PRESETS = {
  subtle: { duration: 0.5, delay: 0.1 },
  medium: { duration: 0.8, delay: 0.2 },
  energetic: { duration: 1.2, delay: 0.3 },
};

export const OCCASIONS = [
  { value: "birthday", label: "Birthday" },
  { value: "anniversary", label: "Anniversary" },
  { value: "congratulations", label: "Congratulations" },
  { value: "invitation", label: "Invitation" },
  { value: "just-because", label: "Just Because" },
  { value: "love", label: "Love" },
  { value: "friendship", label: "Friendship" },
];
