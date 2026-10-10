import type {
  ActiveTemplateType,
  CompatibilityTemplateType,
} from "./template-registry";

export type TemplateType = ActiveTemplateType | CompatibilityTemplateType;
export type Occasion =
  | "birthday"
  | "anniversary"
  | "congratulations"
  | "invitation"
  | "just-because"
  | "love"
  | "friendship";
export type Difficulty = "easy" | "medium" | "hard";
export type Theme =
  | "soft-rose"
  | "peach-glow"
  | "lavender-dream"
  | "sunny-day"
  | "blush-night"
  | "sweet-sky"
  | "cotton-candy"
  | "candy-pop"
  | "berry-cream"
  | "seaside-love"
  | "doodle-love"
  | "pixel-love"
  | "cherry-soda"
  | "enchanted-forest"
  | "sunset-letter"
  | "moonlit-blue"
  | "strawberry-milk"
  | "matcha-morning"
  | "terracotta-sky"
  | "violet-night";
export type AnimationIntensity =
  "reduced" | "normal" | "playful" | "subtle" | "medium" | "energetic";
export type BackgroundStyle =
  | "soft"
  | "gradient"
  | "paper"
  | "aurora"
  | "starlight"
  | "floating-hearts"
  | "doodle"
  | "pixel-grid"
  | "scrapbook"
  | "bokeh"
  | "gingham"
  | "film-grain";
export type ExpirationOption = "none" | "24h" | "3d" | "7d";
export type OpeningStyle =
  | "gentle-fade"
  | "gift-unwrap"
  | "envelope-reveal"
  | "sparkle-pop"
  | "cinematic-curtain"
  | "polaroid-drop"
  | "heart-bloom"
  | "storybook-turn";
export type HeartStyle = "classic" | "doodle" | "pixel";

export interface TemplateConfig {
  id: string;
  name: string;
  description: string;
  difficulty: Difficulty;
  isAvailable: boolean;
  category: Occasion[];
  preview?: string;
}
export type ImagePresentationMode = "fit" | "fill" | "custom";

export interface ImagePresentation {
  mode: ImagePresentationMode;
  focalX?: number;
  focalY?: number;
  zoom?: number;
}
export interface LocalImage {
  id: string;
  file?: File;
  previewUrl: string;
  name: string;
  mimeType: string;
  size: number;
  width?: number;
  height?: number;
  source?: "upload" | "url";
  presentation?: ImagePresentation;
  unavailable?: boolean;
}
export interface LocalAudio {
  id: string;
  file: File;
  previewUrl: string;
  name: string;
  mimeType: string;
  size: number;
  durationSeconds?: number;
  unavailable?: boolean;
}
export interface LocalVideo {
  id: string;
  file?: File;
  previewUrl: string;
  name: string;
  mimeType: string;
  size: number;
  source?: "upload" | "url";
  unavailable?: boolean;
}
export interface SurpriseBasics {
  senderName: string;
  recipientName: string;
  occasion?: Occasion | "";
  openingMessage: string;
  /**
   * Canonical identity snapshot (Phase 8's SurpriseIdentity). senderName/
   * recipientName above remain the single source of truth for display —
   * these are additive references back to a saved sender profile/recipient
   * record, present only when the identity step actually used one. A saved
   * record being edited or deleted later never changes an existing
   * surprise, since the display values are already captured above.
   */
  recipientId?: string;
  recipientNickname?: string;
  recipientRelationship?: string;
  senderProfileId?: string;
  senderSignOff?: string;
}
export interface HeartItem {
  id: string;
  message: string;
  photo?: LocalImage;
}
export interface EnvelopeItem {
  id: string;
  title: string;
  message: string;
  photo?: LocalImage;
  video?: LocalVideo;
}
export interface CatchTheHeartContent {
  hearts: HeartItem[];
  finalMessage: string;
  soundEffects: boolean;
  heartStyle?: HeartStyle;
  heartAssetDataUrl?: string;
  songTitle?: string;
  songUrl?: string;
  songFile?: LocalAudio;
  loopSong?: boolean;
  startMuted?: boolean;
  initialVolume?: number;
}
export interface PhotoPuzzleContent {
  photo?: LocalImage;
  photoUrl?: string;
  difficulty: Difficulty;
  imageFit?: "contain" | "cover";
  completionMessage: string;
  finalMessage?: string;
}
export interface OpenWhenContent {
  envelopes: EnvelopeItem[];
  musicFile?: LocalAudio;
  finalMessage: string;
}
export interface DateOption {
  id: string;
  title: string;
  details: string;
  photo?: LocalImage;
  /** Lets the recipient supply this part of the date instead of selecting a preset. */
  kind?: "choice" | "recipient-decides";
}
export interface DateRound {
  id: string;
  question: string;
  options: DateOption[];
}
export interface DateResult {
  title: string;
  description: string;
  details: string;
  invitation: string;
}
export interface ChooseOurDateContent {
  introMessage: string;
  rounds: DateRound[];
  result: DateResult;
  options?: DateOption[];
  revealMessage?: string;
}
export interface QuizQuestion {
  id: string;
  prompt: string;
  answers: string[];
  correctIndex: number;
  memoryNote: string;
  photo?: LocalImage;
}
export interface MemoryQuizContent {
  questions: QuizQuestion[];
  finalMessage: string;
}
export interface StoryPage {
  id: string;
  title: string;
  body: string;
  photo?: LocalImage;
  composition?: StoryPageComposition;
}
export type StoryPageComposition =
  | "auto"
  | "photo-note"
  | "photo-led"
  | "note-focused"
  | "split";
export interface OurStorybookContent {
  pages: StoryPage[];
  finalMessage: string;
}
export interface StarWish {
  id: string;
  wish: string;
  message: string;
  color: string;
  photo?: LocalImage;
}
export interface WishUponAStarContent {
  stars: StarWish[];
  finalMessage: string;
}
export interface PlaylistTrack {
  id: string;
  title: string;
  artist: string;
  why: string;
  link?: string;
  photo?: LocalImage;
  audio?: LocalAudio;
}
export interface CozyPlaylistContent {
  tracks: PlaylistTrack[];
  finalMessage: string;
}
export type TemplateContent = (
  | CatchTheHeartContent
  | PhotoPuzzleContent
  | OpenWhenContent
  | ChooseOurDateContent
  | MemoryQuizContent
  | OurStorybookContent
  | WishUponAStarContent
  | CozyPlaylistContent
) & { template?: never };
export interface SurpriseAppearance {
  theme: Theme;
  accentColor?: string;
  backgroundStyle?: BackgroundStyle;
  backgroundImage?: LocalImage;
  /** Preserves an uploaded photo while a pattern or curated artwork is active. */
  customBackgroundImage?: LocalImage;
  /** Selected curated artwork id; it may remain stored while another source is active. */
  backgroundStyleId?: string;
  backgroundFilter?: "soft" | "balanced" | "strong";
  fontPairing?:
    | "friendly"
    | "classic"
    | "playful"
    | "handwritten"
    | "romantic"
    | "modern";
  animationIntensity: AnimationIntensity;
}
export interface SurpriseDelivery {
  expiration: ExpirationOption;
}
export interface SurpriseDelight {
  coverEnabled: boolean;
  coverMessage: string;
  coverPhoto?: LocalImage;
  openingStyle: OpeningStyle;
  passphraseEnabled: boolean;
  passphrase: string;
  passphraseQuestion?: string;
  passphraseAnswers?: string[];
  passphraseMode?: "text" | "choice";
  passphraseChoices?: string[];
  passphraseCorrectChoiceIndex?: number;
  passphraseHash?: string;
  closingMessage: string;
  signature: string;
}
export interface SurpriseMusic {
  file?: LocalAudio;
  youtubeUrl?: string;
  title?: string;
  durationSeconds?: number;
  loop: boolean;
  startMuted: boolean;
  volume: number;
}
export interface SurpriseData {
  template: TemplateType;
  basics: SurpriseBasics;
  content: TemplateContent;
  appearance: SurpriseAppearance;
  music?: SurpriseMusic;
  delivery: SurpriseDelivery;
  delight?: SurpriseDelight;
  id?: string;
  createdAt?: Date;
  expiresAt?: Date | string;
  expirationDays?: 1 | 3 | 7;
}
