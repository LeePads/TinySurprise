"use client";

import { useEffect, useId, useRef, useState } from "react";
import Image from "next/image";
import { motion, useReducedMotion } from "framer-motion";
import {
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Dices,
  Heart,
  ImageIcon,
  Palette,
  Sparkles,
  WandSparkles,
} from "lucide-react";
import { ColorSheet } from "./color-sheet";
import { THEME_CONFIGS, THEME_LABELS } from "@/lib/config";
import { appearanceVisual, fontFamilyForPairing } from "@/lib/appearance";
import {
  BACKGROUND_STYLES,
  type BackgroundStyleOption,
} from "@/lib/background-styles";
import type {
  BackgroundStyle,
  SurpriseAppearance,
  Theme,
} from "@/lib/types";
import { ImagePicker } from "./image-picker";
import { PresentationImage } from "./presentation-image";
import { backgroundImagePresentation } from "@/lib/image-presentation";
import { useReviewField } from "@/lib/review-field";
import {
  AdaptiveSelect,
  type AdaptiveSelectOption,
} from "./ui/adaptive-select";
import { BuilderPreviewShell } from "./builder-preview-shell";
import { isNativePlatform } from "@/lib/platform";
import { useBuilderPreviewMode } from "@/lib/use-builder-preview-mode";
import { useMediaQuery } from "@/lib/use-media-query";

const feeling: Record<Theme, string> = {
  "soft-rose": "Rosewood, cream, and a handwritten love note",
  "peach-glow": "Apricot light in a warm, familiar kitchen",
  "lavender-dream": "Soft linen, dried flowers, and quiet affection",
  "sunny-day": "Honeyed wood and a cheerful cottage morning",
  "blush-night": "Cocoa, candlelight, and deep romantic warmth",
  "sweet-sky": "Sage leaves, natural linen, and a peaceful home",
  "cotton-candy": "Blush pink, powder blue, and cloud-soft sweetness",
  "candy-pop": "Cherry candy, violet fizz, and playful energy",
  "berry-cream": "Blackberry jam, warm cream, and golden pastry",
  "seaside-love": "Sea glass, coral shells, and a breezy love note",
  "doodle-love": "Notebook paper, hand-drawn hearts, and cozy inside jokes",
  "pixel-love": "Arcade colors, tiny pixels, and a playful high score",
  "cherry-soda": "Cherry red, golden fizz, and a bright retro date",
  "enchanted-forest": "Moss, warm lanterns, and a secret woodland promise",
  "sunset-letter": "Terracotta skies and a violet handwritten goodbye",
  "moonlit-blue": "Midnight blue, soft lilac, and silver-hour romance",
  "strawberry-milk": "Strawberry cream, soft apricot, and a sweet little crush",
  "matcha-morning": "Matcha leaves, oat linen, and a calm Sunday feeling",
  "terracotta-sky":
    "Sun-baked clay, blue skies, and a postcard from somewhere warm",
  "violet-night": "Violet dusk, pink stars, and a little after-dark magic",
};

const themeLooks: Record<Theme, { ink: string; wash: string; deep: string }> = {
  "soft-rose": {
    ink: "#542d34",
    wash: "linear-gradient(135deg,#fff9f4,#eac6bc 52%,#b85c6f)",
    deep: "#743b49",
  },
  "peach-glow": {
    ink: "#57301f",
    wash: "linear-gradient(135deg,#fff8eb,#efc285 52%,#c86f4a)",
    deep: "#87452e",
  },
  "lavender-dream": {
    ink: "#3e3342",
    wash: "linear-gradient(135deg,#fcf8f4,#d8c6ce 52%,#896b8e)",
    deep: "#5f4964",
  },
  "sunny-day": {
    ink: "#4f3918",
    wash: "linear-gradient(135deg,#fffaf0,#e8ce91 52%,#ad7e2f)",
    deep: "#76551f",
  },
  "blush-night": {
    ink: "#fff7f0",
    wash: "linear-gradient(135deg,#241c1a,#513733 52%,#9f6267)",
    deep: "#302321",
  },
  "sweet-sky": {
    ink: "#263d2d",
    wash: "linear-gradient(135deg,#f7f6ef,#c8d0bc 52%,#63806a)",
    deep: "#405646",
  },
  "cotton-candy": {
    ink: "#54304d",
    wash: "linear-gradient(135deg,#fff6fc,#f4bfdc 48%,#82c9dc)",
    deep: "#875070",
  },
  "candy-pop": {
    ink: "#44213f",
    wash: "linear-gradient(135deg,#fff3bd,#ff8ba0 48%,#8173e8)",
    deep: "#593e9c",
  },
  "berry-cream": {
    ink: "#4b2636",
    wash: "linear-gradient(135deg,#fff8ed,#e7b88c 50%,#8f3f69)",
    deep: "#612848",
  },
  "seaside-love": {
    ink: "#244549",
    wash: "linear-gradient(135deg,#f4fffb,#add8cc 50%,#e49a86)",
    deep: "#2f6265",
  },
  "doodle-love": {
    ink: "#28443c",
    wash: "repeating-linear-gradient(0deg,transparent 0 23px,#356b5d18 24px),linear-gradient(135deg,#fffdf3,#f4d8bd 55%,#e28c6d)",
    deep: "#356b5d",
  },
  "pixel-love": {
    ink: "#352651",
    wash: "repeating-linear-gradient(90deg,transparent 0 19px,#5c61d81c 20px),linear-gradient(135deg,#fff5fb,#b9b6f2)",
    deep: "#5c3f97",
  },
  "cherry-soda": {
    ink: "#4d1724",
    wash: "linear-gradient(135deg,#fff7de,#ff8a92 52%,#c82655)",
    deep: "#821c3b",
  },
  "enchanted-forest": {
    ink: "#173428",
    wash: "radial-gradient(circle at 80% 20%,#eacb7c99,transparent 22%),linear-gradient(135deg,#f4f2df,#90aa81 55%,#375945)",
    deep: "#294838",
  },
  "sunset-letter": {
    ink: "#4e2935",
    wash: "linear-gradient(135deg,#fff0d3,#e88e6d 52%,#745388)",
    deep: "#67405b",
  },
  "moonlit-blue": {
    ink: "#fff8ff",
    wash: "radial-gradient(circle at 75% 20%,#d5a5ca77,transparent 25%),linear-gradient(135deg,#151a35,#4f5d9b 55%,#9a6f9d)",
    deep: "#262d62",
  },
  "strawberry-milk": {
    ink: "#542d3d",
    wash: "radial-gradient(circle at 80% 18%,#f7c7a499,transparent 25%),linear-gradient(135deg,#fffaf4,#f6c8c7 55%,#e47d93)",
    deep: "#9b506d",
  },
  "matcha-morning": {
    ink: "#294333",
    wash: "linear-gradient(135deg,#fffced,#d7dfbd 55%,#6b8f71)",
    deep: "#3f6548",
  },
  "terracotta-sky": {
    ink: "#4d302d",
    wash: "linear-gradient(135deg,#fff4e9,#e6a27f 53%,#6da5b6)",
    deep: "#845047",
  },
  "violet-night": {
    ink: "#fff7ff",
    wash: "radial-gradient(circle at 20% 20%,#f2b4c555,transparent 22%),linear-gradient(135deg,#211a36,#624c93 55%,#a278d0)",
    deep: "#46326f",
  },
};

const backgrounds: {
  value: BackgroundStyle;
  label: string;
  description: string;
}[] = [
  {
    value: "gradient",
    label: "Glossy glow",
    description: "Layered light and a luminous center",
  },
  {
    value: "paper",
    label: "Pressed-flower paper",
    description: "Ruled stationery with a floral glow",
  },
  {
    value: "starlight",
    label: "Midnight starlight",
    description: "A dramatic twinkling night",
  },
  {
    value: "pixel-grid",
    label: "Pixel playground",
    description: "Retro grid with arcade energy",
  },
  {
    value: "gingham",
    label: "Picnic gingham",
    description: "A sweet woven check pattern",
  },
  {
    value: "film-grain",
    label: "Romance on film",
    description: "Moody color with analog texture",
  },
];

const filters: {
  value: NonNullable<SurpriseAppearance["backgroundFilter"]>;
  label: string;
  veil: number;
}[] = [
  { value: "soft", label: "Soft", veil: 0.25 },
  { value: "balanced", label: "Balanced", veil: 0.46 },
  { value: "strong", label: "Strong", veil: 0.68 },
];

const letteringOptions = [
  { value: "friendly", label: "Warm and friendly" },
  { value: "classic", label: "Storybook serif" },
  { value: "playful", label: "Playful letterpress" },
  { value: "handwritten", label: "Handwritten note" },
  { value: "romantic", label: "Romantic keepsake" },
  { value: "modern", label: "Modern love letter" },
] as const;

const curatedLooks: {
  label: string;
  note: string;
  theme: Theme;
  backgroundStyle: BackgroundStyle;
  fontPairing: NonNullable<SurpriseAppearance["fontPairing"]>;
}[] = [
  {
    label: "Love letter",
    note: "Warm, tactile, timeless",
    theme: "soft-rose",
    backgroundStyle: "paper",
    fontPairing: "classic",
  },
  {
    label: "Sunday morning",
    note: "Homey, fresh, unhurried",
    theme: "matcha-morning",
    backgroundStyle: "gingham",
    fontPairing: "friendly",
  },
  {
    label: "After-dark magic",
    note: "Romantic, cinematic, glowing",
    theme: "violet-night",
    backgroundStyle: "starlight",
    fontPairing: "classic",
  },
  {
    label: "Sweet arcade",
    note: "Playful, bright, nostalgic",
    theme: "pixel-love",
    backgroundStyle: "pixel-grid",
    fontPairing: "playful",
  },
];

function FeelingPreview({
  data,
  onRemovePhoto,
  tall,
}: {
  data: SurpriseAppearance;
  onRemovePhoto: () => void;
  /** Android's preview card is a fixed ~190px (within the 180-220px budget) so it stays clear of fields; web keeps its original small strip. */
  tall?: boolean;
}) {
  const prefersReducedMotion = useReducedMotion();
  const visual = appearanceVisual(data),
    playful = data.animationIntensity === "playful",
    gentle = data.animationIntensity === "reduced" || prefersReducedMotion;
  return (
    <div
      className={`relative overflow-hidden rounded-[1.35rem] border border-white/40 shadow-[0_14px_42px_rgba(62,31,44,.2)] ${tall ? "h-[190px]" : "h-24 sm:h-28 lg:h-32"}`}
      style={{
        background: visual.treatment,
        backgroundSize: "cover",
        color: visual.ink,
        fontFamily: visual.font,
      }}
    >
      {data.backgroundImage && (
        <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
          <PresentationImage
            image={data.backgroundImage}
            alt=""
            presentation={backgroundImagePresentation(data.backgroundImage.presentation)}
            frameClassName="!absolute inset-0 h-full w-full !bg-transparent"
          />
          <div className="absolute inset-0" style={{ background: visual.backdropOverlay }} />
        </div>
      )}
      <div
        aria-hidden
        className="absolute inset-0 bg-gradient-to-t from-black/25 via-transparent to-white/10"
      />
      {data.backgroundImage && (
        <button
          type="button"
          onClick={onRemovePhoto}
          className="absolute right-2 top-2 z-20 min-h-12 rounded-full border border-white/45 bg-black/55 px-3 text-xs font-bold text-white shadow-lg backdrop-blur transition hover:bg-black/75"
        >
          Remove photo
        </button>
      )}
      <motion.div
        className="absolute inset-0 z-10 flex flex-col items-center justify-center p-3 text-center sm:p-4"
        animate={
          gentle
            ? undefined
            : { scale: [1, playful ? 1.04 : 1.018, 1], y: [0, -4, 0] }
        }
        transition={{ duration: playful ? 1.8 : 3.4, repeat: Infinity }}
      >
        <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-white/40 bg-white/35 shadow-xl backdrop-blur sm:h-14 sm:w-14">
          <Heart
            className="h-7 w-7 fill-current sm:h-9 sm:w-9"
            style={{ color: visual.primary }}
          />
        </span>
        <h3 className="mt-2 text-base font-extrabold drop-shadow-[0_2px_7px_rgba(0,0,0,.28)] sm:text-xl">
          A little moment, just for you
        </h3>
        <p className="mt-1 hidden max-w-md rounded-full bg-black/30 px-4 py-1 text-[11px] font-semibold backdrop-blur sm:block">
          {feeling[data.theme]}
        </p>
      </motion.div>
    </div>
  );
}

export function StepAppearance({
  data,
  onUpdate,
  onOpenFullPreview,
  keyboardVisible,
}: {
  data: SurpriseAppearance;
  onUpdate: (value: Partial<SurpriseAppearance>) => void;
  onOpenFullPreview?: () => void;
  /** Lifted from the builder page's single useKeyboard() call — see that hook's own doc comment on why it's not called again in here. */
  keyboardVisible?: boolean;
}) {
  type BackgroundSource = "patterns" | "artwork" | "my-photo";
  const [backgroundTab, setBackgroundTab] = useState<BackgroundSource>(() => {
    if (data.backgroundImage && !data.backgroundStyleId) return "my-photo";
    return data.backgroundStyleId && data.backgroundImage ? "artwork" : "patterns";
  });
  const randomizeAppearance = () => {
    const themes = Object.keys(THEME_CONFIGS) as Theme[];
    const styles = backgrounds.map((item) => item.value);
    const theme = themes[Math.floor(Math.random() * themes.length)];
    const backgroundStyle = styles[Math.floor(Math.random() * styles.length)];
    onUpdate({
      theme,
      backgroundStyle,
      accentColor: THEME_CONFIGS[theme].primary,
      backgroundImage: undefined,
      backgroundStyleId: undefined,
    });
    setBackgroundTab("patterns");
  };
  const selectCuratedBackground = (style: BackgroundStyleOption) => {
    const origin =
      typeof window !== "undefined" ? window.location.origin : "";
    const customBackgroundImage =
      data.customBackgroundImage ||
      (data.backgroundImage?.source === "upload"
        ? data.backgroundImage
        : undefined);
    onUpdate({
      customBackgroundImage,
      backgroundStyleId: style.id,
      backgroundImage: {
        id: style.id,
        previewUrl: `${origin}${style.path}`,
        name: style.label,
        mimeType: "image/png",
        size: style.bytes,
        width: style.width,
        height: style.height,
        source: "url",
      },
    });
    setBackgroundTab("artwork");
  };
  const selectPattern = (value: BackgroundStyle) => {
    const customBackgroundImage =
      data.customBackgroundImage ||
      (data.backgroundImage?.source === "upload"
        ? data.backgroundImage
        : undefined);
    onUpdate({
      backgroundStyle: value,
      customBackgroundImage,
      backgroundImage: undefined,
      // Keep the last curated artwork id as an inactive local selection so
      // switching back does not make the user hunt for it again.
      backgroundStyleId: data.backgroundStyleId,
    });
    setBackgroundTab("patterns");
  };
  const removeBackgroundPhoto = () => {
    const activeIsCustom =
      data.backgroundImage &&
      data.customBackgroundImage?.id === data.backgroundImage.id;
    onUpdate({
      backgroundImage: undefined,
      ...(activeIsCustom ? { customBackgroundImage: undefined } : {}),
    });
  };
  const savedCustomBackground =
    data.customBackgroundImage ||
    (data.backgroundImage && !data.backgroundStyleId
      ? data.backgroundImage
      : undefined);
  const customBackgroundActive = Boolean(
    savedCustomBackground &&
      data.backgroundImage?.id === savedCustomBackground.id,
  );
  const activeBackgroundSource: BackgroundSource = customBackgroundActive
    ? "my-photo"
    : data.backgroundImage && data.backgroundStyleId
      ? "artwork"
      : "patterns";
  const chooseBackgroundSource = (source: BackgroundSource) => {
    setBackgroundTab(source);
    if (source === "patterns") {
      onUpdate({ backgroundImage: undefined });
      return;
    }
    if (source === "my-photo") {
      if (savedCustomBackground) {
        onUpdate({ backgroundImage: savedCustomBackground });
      }
      return;
    }
    const savedArtwork = BACKGROUND_STYLES.find(
      (style) => style.id === data.backgroundStyleId,
    );
    if (savedArtwork) selectCuratedBackground(savedArtwork);
  };

  const [native, setNative] = useState(false);
  useEffect(() => {
    setNative(isNativePlatform());
  }, []);
  const [colorSheetOpen, setColorSheetOpen] = useState(false);
  const accentSwatches = Array.from(
    new Set(
      Object.values(THEME_CONFIGS).flatMap((theme) => [
        theme.primary,
        theme.accent,
      ]),
    ),
  );
  const previewMode = useBuilderPreviewMode();
  const desktopWeb = useMediaQuery("(min-width: 1024px)");
  const mode = native ? previewMode : desktopWeb ? "wide" : "compact";
  const [manualCollapsed, setManualCollapsed] = useState(false);
  const [showAllThemes, setShowAllThemes] = useState(false);
  const [showBackgroundOptions, setShowBackgroundOptions] = useState(false);
  useReviewField(id => { if (id === "appearance-background") { setShowBackgroundOptions(true); setBackgroundTab("my-photo"); } });
  const appearanceId = useId();
  // "compact" mode auto-collapses while the keyboard is open unless the
  // user already collapsed it manually; "short-landscape" is always
  // collapsed by the shell itself (no inline-expanded state to track);
  // "wide" is never collapsed.
  const collapsed = mode === "compact" && (manualCollapsed || Boolean(keyboardVisible));
  const twoPane = mode === "wide";
  const allThemes = Object.keys(THEME_CONFIGS) as Theme[];
  const visibleThemes = showAllThemes
    ? allThemes
    : allThemes.slice(0, 6).includes(data.theme)
      ? allThemes.slice(0, 6)
      : [data.theme, ...allThemes.filter((theme) => theme !== data.theme).slice(0, 5)];

  return (
    <div className={`builder-workspace ${twoPane ? "builder-workspace--with-preview" : "builder-workspace--single"}`}>
    <div className="builder-workspace__editor space-y-7">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h3 className="font-semibold">Choose the feeling</h3>
          <p className="mt-1 text-sm text-muted-foreground">
            Choose a ready-made look, or adjust the details below.
          </p>
        </div>
        <button
          type="button"
          onClick={randomizeAppearance}
          className="inline-flex min-h-12 items-center gap-2 rounded-full border bg-card px-3 text-xs font-bold text-primary shadow-sm transition hover:-translate-y-0.5 hover:shadow-md"
        >
          <Dices className="h-4 w-4" />
          Surprise me
        </button>
      </div>
      {!twoPane && (
        <BuilderPreviewShell
          mode={mode}
          label="Preview"
          collapsed={collapsed}
          onToggleCollapse={() => setManualCollapsed((value) => !value)}
          onOpenFullPreview={onOpenFullPreview}
        >
          <FeelingPreview
            data={data}
            onRemovePhoto={removeBackgroundPhoto}
            tall={native}
          />
        </BuilderPreviewShell>
      )}

      <section className="rounded-3xl border border-primary/15 bg-gradient-to-br from-primary/[.08] via-card/80 to-card/60 p-4 shadow-sm sm:p-5">
        <div className="flex items-start gap-3">
          <span className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
            <WandSparkles className="h-5 w-5" aria-hidden="true" />
          </span>
          <div>
            <h3 className="font-semibold">Ready-made looks</h3>
            <p className="mt-0.5 text-sm text-muted-foreground">
              Your current look is ready to use. Choose another if you like.
            </p>
          </div>
        </div>
        <div className="mt-4 grid gap-2 sm:grid-cols-2">
          {curatedLooks.map((look) => {
            const active =
              data.theme === look.theme &&
              data.backgroundStyle === look.backgroundStyle &&
              data.fontPairing === look.fontPairing;
            return (
              <button
                key={look.label}
                type="button"
                aria-pressed={active}
                onClick={() =>
                  onUpdate({
                    theme: look.theme,
                    backgroundStyle: look.backgroundStyle,
                    fontPairing: look.fontPairing,
                    accentColor: THEME_CONFIGS[look.theme].primary,
                  })
                }
                className={`group flex min-h-16 items-center gap-3 rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 hover:shadow-md ${active ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "bg-card/80"}`}
              >
                <span
                  className="h-10 w-10 shrink-0 rounded-xl border border-white/60 shadow-inner"
                  style={{ background: themeLooks[look.theme].wash }}
                />
                <span className="min-w-0 flex-1">
                  <strong className="flex items-center gap-2 text-sm">
                    {look.label}
                    {active && <Check className="h-3.5 w-3.5 text-primary" />}
                  </strong>
                  <span className="mt-0.5 block text-xs text-muted-foreground">
                    {look.note}
                  </span>
                </span>
              </button>
            );
          })}
        </div>
      </section>

      <section className="appearance-disclosure" data-expanded={showBackgroundOptions}>
      <button
        type="button"
        id={`${appearanceId}-heading`}
        className="appearance-disclosure__trigger flex min-h-12 w-full items-center justify-between gap-4 px-4 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-expanded={showBackgroundOptions}
        aria-controls={`${appearanceId}-panel`}
        onClick={() => setShowBackgroundOptions((value) => !value)}
      >
        <span>
          <span className="block text-sm font-semibold">Customize appearance</span>
          <span className="mt-1 block text-xs text-muted-foreground">Colors, backgrounds &amp; lettering</span>
        </span>
        <ChevronDown aria-hidden="true" className="appearance-disclosure__chevron h-4 w-4 shrink-0 text-muted-foreground" />
      </button>

      <div className="appearance-disclosure__body" hidden={!showBackgroundOptions}>
      <div id={`${appearanceId}-panel`} role="region" aria-labelledby={`${appearanceId}-heading`} className="space-y-7 px-4 pb-5 pt-2">
      <HorizontalRail label="Palette" className="builder-palette-rail">
        {visibleThemes.map((theme) => {
          const selected = data.theme === theme,
            look = themeLooks[theme];
          return (
            <button
              key={theme}
              type="button"
              aria-pressed={selected}
              onClick={() =>
                onUpdate({ theme, accentColor: THEME_CONFIGS[theme].primary })
              }
              className={`group relative flex min-h-36 w-[min(76vw,255px)] shrink-0 snap-start flex-col overflow-hidden rounded-2xl border p-4 text-left shadow-sm transition hover:-translate-y-1 hover:shadow-lg ${selected ? "ring-2 ring-primary/40" : ""}`}
              style={{ background: look.wash, color: look.ink }}
            >
              <span className="relative z-10 flex items-start justify-between gap-2 font-extrabold">
                <span>{THEME_LABELS[theme]}</span>
                {selected && (
                  <span className="grid h-7 w-7 place-items-center rounded-full bg-black/70 text-white">
                    <Check className="h-4 w-4" />
                  </span>
                )}
              </span>
              <span className="relative z-10 mt-2 text-xs font-semibold leading-5 opacity-85">
                {feeling[theme]}
              </span>
              <span className="relative z-10 mt-auto flex gap-1.5 pt-3">
                {[
                  THEME_CONFIGS[theme].primary,
                  THEME_CONFIGS[theme].accent,
                  look.deep,
                ].map((color) => (
                  <i
                    key={color}
                    className="h-5 w-5 rounded-full border border-white/80"
                    style={{ background: color }}
                  />
                ))}
              </span>
            </button>
          );
        })}
      </HorizontalRail>

      <button
        type="button"
        className="min-h-12 w-fit rounded-xl border border-primary/25 bg-primary/[.06] px-4 text-sm font-semibold text-primary transition hover:bg-primary/[.1]"
        aria-expanded={showAllThemes}
        onClick={() => setShowAllThemes((value) => !value)}
      >
        {showAllThemes ? "Show fewer palettes" : "Browse all palettes"}
      </button>

      <div className="space-y-5">
      <section className="space-y-4 border-t border-border/70 pt-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
              <h3 className="font-semibold">Background style</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Choose a quiet pattern or a fuller scene for the opening.
              </p>
          </div>
          <div
            className="flex w-full min-w-0 overflow-x-auto rounded-xl border bg-background p-1 sm:w-auto"
            role="group"
            aria-label="Background source"
          >
            {(
              [
                ["patterns", "Patterns"],
                ["artwork", "Artwork"],
                ["my-photo", "My photo"],
              ] as const
            ).map(([source, label]) => (
              <button
                key={source}
                type="button"
                aria-pressed={backgroundTab === source}
                onClick={() => chooseBackgroundSource(source)}
                className={`min-h-12 min-w-[6rem] flex-1 whitespace-nowrap rounded-lg px-3 text-xs font-bold transition sm:flex-none ${backgroundTab === source ? "bg-primary text-primary-foreground shadow-sm" : "text-muted-foreground hover:text-foreground"}`}
              >
                {label}
              </button>
            ))}
          </div>
        </div>
        {backgroundTab === "patterns" ? (
          <HorizontalRail label="Background patterns">
            {backgrounds.map((item) => {
              const selected =
                  activeBackgroundSource === "patterns" &&
                  (data.backgroundStyle || "gradient") === item.value,
                candidate = {
                  ...data,
                  backgroundStyle: item.value,
                  backgroundImage: undefined,
                };
              return (
                <button
                  key={item.value}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectPattern(item.value)}
                  className={`w-[min(72vw,235px)] shrink-0 snap-start overflow-hidden rounded-2xl border p-3 text-left transition hover:-translate-y-0.5 ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/25" : "bg-card"}`}
                >
                  <span
                    className="mb-3 flex h-20 items-center justify-center rounded-xl border"
                    style={{ background: appearanceVisual(candidate).treatment }}
                  />
                  <strong className="flex items-center gap-2 text-sm">
                    {selected && <Check className="h-4 w-4 text-primary" />}
                    {item.label}
                  </strong>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {item.description}
                  </span>
                </button>
              );
            })}
          </HorizontalRail>
        ) : backgroundTab === "artwork" ? (
          <HorizontalRail label="Curated background artwork">
            {BACKGROUND_STYLES.map((style) => {
              const selected =
                activeBackgroundSource === "artwork" &&
                data.backgroundStyleId === style.id;
              return (
                <button
                  key={style.id}
                  type="button"
                  aria-pressed={selected}
                  onClick={() => selectCuratedBackground(style)}
                  className={`group relative w-[min(72vw,220px)] shrink-0 snap-start overflow-hidden rounded-2xl border text-left transition hover:-translate-y-0.5 ${selected ? "border-primary ring-2 ring-primary/25" : "border-border/70"}`}
                >
                  <span className="relative block h-28 w-full overflow-hidden bg-secondary">
                    <Image
                      src={style.path}
                      alt=""
                      aria-hidden="true"
                      fill
                      loading="lazy"
                      quality={45}
                      sizes="220px"
                      className="object-cover transition duration-500 ease-out group-hover:scale-105"
                    />
                    <span
                      aria-hidden="true"
                      className="pointer-events-none absolute inset-0 bg-[linear-gradient(to_top,rgba(8,5,9,.78)_0%,rgba(8,5,9,.15)_55%,transparent_85%)]"
                    />
                    {selected && (
                      <span className="absolute right-2 top-2 grid h-6 w-6 place-items-center rounded-full bg-primary text-primary-foreground shadow">
                        <Check className="h-3.5 w-3.5" />
                      </span>
                    )}
                    <span className="absolute inset-x-0 bottom-0 p-2.5 text-xs font-bold text-white [text-shadow:0_1px_6px_rgba(0,0,0,.65)]">
                      {style.label}
                    </span>
                  </span>
                  <span className="block bg-card p-2.5 text-xs leading-5 text-muted-foreground">
                    {style.description}
                    <span className="type-meta mt-1.5 flex items-center gap-1.5 font-semibold text-primary/80">
                      <span
                        aria-hidden="true"
                        className={`h-2.5 w-2.5 rounded-full border border-black/10 ${style.ink === "light" ? "bg-white" : "bg-[#2a2129]"}`}
                      />
                      {style.ink === "light" ? "Light lettering" : "Dark lettering"}{" "}
                      reads best
                    </span>
                  </span>
                </button>
              );
            })}
          </HorizontalRail>
        ) : null}
      </section>

      {backgroundTab === "my-photo" && <section className="grid gap-5 border-t border-border/70 pt-5 lg:grid-cols-[1.1fr_.9fr]">
        <div>
          <div className="mb-4 flex gap-3">
            <ImageIcon className="mt-0.5 h-5 w-5 text-primary" />
            <div>
              <h3 className="font-semibold">My photo</h3>
              <p className="text-sm text-muted-foreground">
                Add a personal backdrop. A soft veil keeps every word easy to read.
              </p>
            </div>
          </div>
          <ImagePicker
            focusId="appearance-background"
            label="Background photo"
            addLabel="Add background photo"
            metaLabel={customBackgroundActive ? "Using your photo" : "Saved on this device"}
            adjustLabel="Adjust background"
            frameAspect="16 / 9"
            value={savedCustomBackground}
            onChange={(backgroundImage) => {
              if (!backgroundImage && !customBackgroundActive) {
                onUpdate({ customBackgroundImage: undefined });
                return;
              }
              onUpdate({
                customBackgroundImage: backgroundImage,
                backgroundImage,
                backgroundStyleId: data.backgroundStyleId,
              });
            }}
            helperText="Landscape photos work best. Your words stay readable with a soft veil."
          />
          {savedCustomBackground && !customBackgroundActive && (
            <button
              type="button"
              onClick={() =>
                onUpdate({
                  backgroundImage: savedCustomBackground,
                })
              }
              className="mt-3 inline-flex min-h-12 items-center rounded-xl border border-primary/30 bg-primary/10 px-3 text-xs font-bold text-primary transition hover:bg-primary/15"
            >
              Use my photo
            </button>
          )}
        </div>
        <div className="space-y-5">
          {customBackgroundActive && <fieldset>
            <legend className="flex items-center gap-2 text-sm font-semibold">
              <Sparkles className="h-4 w-4 text-primary" />
              Photo readability filter
            </legend>
            <div className="mt-2 grid grid-cols-3 gap-2">
              {filters.map((filter) => {
                const selected =
                  (data.backgroundFilter || "balanced") === filter.value;
                return (
                  <button
                    key={filter.value}
                    type="button"
                    aria-pressed={selected}
                    onClick={() => onUpdate({ backgroundFilter: filter.value })}
                    className={`overflow-hidden rounded-xl border p-1.5 text-xs font-semibold disabled:opacity-40 ${selected ? "border-primary ring-2 ring-primary/25" : ""}`}
                  >
                    <span
                      className="mb-1.5 block h-12 rounded-lg bg-cover bg-center"
                      style={{
                        backgroundImage: savedCustomBackground
                          ? `linear-gradient(rgba(20,16,22,${filter.veil}),rgba(20,16,22,${filter.veil})),url("${savedCustomBackground.previewUrl}")`
                          : undefined,
                      }}
                    />
                    <span>{filter.label}</span>
                  </button>
                );
              })}
            </div>
          </fieldset>}
          <AccentColorControl
            native={native}
            value={data.accentColor || THEME_CONFIGS[data.theme].primary}
            swatches={accentSwatches}
            sheetOpen={colorSheetOpen}
            onSheetOpenChange={setColorSheetOpen}
            onChange={(accentColor) => onUpdate({ accentColor })}
          />
        </div>
      </section>}
      {backgroundTab !== "my-photo" && (
        <section className="border-t border-border/70 pt-5">
          <AccentColorControl
            native={native}
            value={data.accentColor || THEME_CONFIGS[data.theme].primary}
            swatches={accentSwatches}
            sheetOpen={colorSheetOpen}
            onSheetOpenChange={setColorSheetOpen}
            onChange={(accentColor) => onUpdate({ accentColor })}
          />
        </section>
      )}
      </div>
      <div>
        <FontPairingPicker
          theme={data.theme}
          value={data.fontPairing || "friendly"}
          onChange={(value) => onUpdate({ fontPairing: value })}
        />
      </div>
      </div>
      </div>
      </section>
    </div>
    {twoPane && (
      <aside className="builder-workspace__preview sticky top-[4.4rem] min-w-0 max-h-[calc(100dvh-6rem)] space-y-2 overflow-y-auto">
        <BuilderPreviewShell
          mode="wide"
          label="Preview"
          collapsed={false}
          onToggleCollapse={() => undefined}
          onOpenFullPreview={onOpenFullPreview}
        >
          <FeelingPreview data={data} onRemovePhoto={removeBackgroundPhoto} tall />
        </BuilderPreviewShell>
      </aside>
    )}
    </div>
  );
}

function AccentColorControl({
  native,
  value,
  swatches,
  sheetOpen,
  onSheetOpenChange,
  onChange,
}: {
  native: boolean;
  value: string;
  swatches: string[];
  sheetOpen: boolean;
  onSheetOpenChange: (open: boolean) => void;
  onChange: (color: string) => void;
}) {
  if (native) {
    return (
      <div>
        <span className="flex items-center gap-2 text-sm font-semibold">
          <Palette className="h-4 w-4 text-primary" />
          Accent color
        </span>
        <button
          type="button"
          onClick={() => onSheetOpenChange(true)}
          className="mt-2 flex min-h-12 items-center gap-3 rounded-xl border bg-card px-3"
        >
          <span
            className="h-7 w-7 shrink-0 rounded-full border-2 border-card shadow-sm"
            style={{ background: value }}
            aria-hidden="true"
          />
          <span className="font-mono text-xs text-muted-foreground">{value}</span>
        </button>
        <ColorSheet
          open={sheetOpen}
          onClose={() => onSheetOpenChange(false)}
          value={value}
          swatches={swatches}
          onApply={onChange}
          label="Accent color"
        />
      </div>
    );
  }
  return (
    <label className="block text-sm font-semibold" htmlFor="accent-color">
      <span className="flex items-center gap-2">
        <Palette className="h-4 w-4 text-primary" />
        Accent color
      </span>
      <span className="mt-2 flex items-center gap-3">
        <input
          id="accent-color"
          type="color"
          className="h-11 w-14 cursor-pointer rounded-xl border bg-card p-1"
          value={value}
          onChange={(event) => onChange(event.target.value)}
        />
        <span className="font-mono text-xs text-muted-foreground">{value}</span>
      </span>
    </label>
  );
}

function FontPairingPicker({
  theme,
  value,
  onChange,
}: {
  theme: Theme;
  value: NonNullable<SurpriseAppearance["fontPairing"]>;
  onChange: (value: NonNullable<SurpriseAppearance["fontPairing"]>) => void;
}) {
  return (
    <fieldset className="text-sm font-medium">
      <legend>Lettering style</legend>
      <div className="mt-2 grid gap-2 sm:grid-cols-2">
        {letteringOptions.map((option) => {
          const selected = option.value === value;
          return (
            <button
              key={option.value}
              type="button"
              aria-pressed={selected}
              onClick={() => onChange(option.value)}
              className={`flex min-h-20 items-center justify-between gap-3 rounded-xl border px-3 py-2.5 text-left transition ${selected ? "border-primary bg-primary/10 ring-2 ring-primary/20" : "bg-card hover:border-primary/35 hover:bg-muted/40"}`}
            >
              <span className="min-w-0">
                <span className="block truncate text-xs font-semibold text-muted-foreground">
                  {option.label}
                </span>
                <span
                  aria-hidden="true"
                  className="mt-1 block text-2xl leading-none"
                  style={{ fontFamily: fontFamilyForPairing(theme, option.value) }}
                >
                  Aa
                </span>
              </span>
              <span className="sr-only">
                {selected ? "Selected" : "Select"} {option.label}
              </span>
              {selected && <Check className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />}
            </button>
          );
        })}
      </div>
    </fieldset>
  );
}

function HorizontalRail({
  label,
  children,
  className,
}: {
  label: string;
  children: React.ReactNode;
  className?: string;
}) {
  const rail = useRef<HTMLDivElement>(null);
  const move = (direction: -1 | 1) =>
    rail.current?.scrollBy({
      left: direction * Math.min(520, rail.current.clientWidth * 0.82),
      behavior: "smooth",
    });

  return (
    <section role="region" aria-label={label} className={className}>
      <div className="mb-2 flex items-center justify-between gap-3 px-0.5">
        <p className="text-sm font-semibold text-muted-foreground">
          {label}
        </p>
        <div className="hidden items-center gap-1 sm:flex">
          <button
            type="button"
            onClick={() => move(-1)}
            className="grid min-h-12 min-w-12 place-items-center rounded-full border bg-card shadow-sm transition hover:border-primary/35 hover:text-primary"
            aria-label={`Scroll ${label} left`}
          >
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button
            type="button"
            onClick={() => move(1)}
            className="grid min-h-12 min-w-12 place-items-center rounded-full border bg-card shadow-sm transition hover:border-primary/35 hover:text-primary"
            aria-label={`Scroll ${label} right`}
          >
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div
        ref={rail}
        className="builder-horizontal-rail builder-horizontal-rail--mobile-grid -mx-2 overflow-x-auto px-2 pb-3 [scrollbar-color:var(--primary)_transparent] [scrollbar-width:thin]"
      >
        <div className="builder-horizontal-rail__items flex w-max max-w-none snap-x snap-mandatory gap-3 pr-3">
          {children}
        </div>
      </div>
    </section>
  );
}
function Control({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: AdaptiveSelectOption[];
}) {
  const id = `appearance-${label.toLowerCase().replace(/[^a-z0-9]+/g, "-")}`;
  return (
    <div className="text-sm font-medium">
      <label htmlFor={id}>{label}</label>
      <AdaptiveSelect
        id={id}
        label={label}
        value={value}
        onChange={onChange}
        options={options}
      />
    </div>
  );
}
