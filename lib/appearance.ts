import { THEME_CONFIGS } from "./config";
import type { SurpriseAppearance, Theme } from "./types";
import { normalizeImagePresentation } from "./image-presentation";

export interface RecipientThemeTokens {
  canvas: string;
  foreground: string;
  mutedForeground: string;
  mutedSurfaceForeground: string;
  secondaryForeground: string;
  surface: string;
  surfaceForeground: string;
  surfaceMutedForeground: string;
  elevatedSurface: string;
  elevatedSurfaceForeground: string;
  elevatedSurfaceMutedForeground: string;
  border: string;
  overlay: string;
  accent: string;
  focus: string;
  primaryForeground: string;
  accentForeground: string;
}

const safeCssUrl = (value: string) =>
  value.replace(/["\\\n\r]/g, (character) => `\\${character}`);

const DARK_CONTROL_FOREGROUND = "#21172c";
const LIGHT_CONTROL_FOREGROUND = "#fffaf7";
const BLACK_FALLBACK = "#000000";
const WHITE_FALLBACK = "#ffffff";

/** Keep the atmospheric playfield transparent without weakening reading panels. */
export const CATCH_FIELD_BACKGROUND = "linear-gradient(color-mix(in srgb, var(--experience-surface) 28%, transparent), color-mix(in srgb, var(--experience-surface) 42%, transparent))";

export function fontFamilyForPairing(
  theme: Theme,
  pairing: NonNullable<SurpriseAppearance["fontPairing"]> = "friendly",
) {
  if (theme === "doodle-love") return '"Comic Sans MS","Segoe Print",cursive';
  if (pairing === "handwritten")
    return '"Segoe Print","Bradley Hand","Comic Sans MS",cursive';
  if (pairing === "romantic")
    return 'Palatino,"Palatino Linotype","Book Antiqua",Georgia,serif';
  if (pairing === "modern") return '"Trebuchet MS",Avenir,system-ui,sans-serif';
  if (theme === "pixel-love" || pairing === "playful")
    return "ui-monospace,SFMono-Regular,monospace";
  if (pairing === "classic") return 'Georgia,"Times New Roman",serif';
  return 'ui-rounded,system-ui,-apple-system,"Segoe UI",sans-serif';
}

function parseHexColor(value: string): [number, number, number] | undefined {
  const match = value.trim().match(/^#([0-9a-f]{6})(?:[0-9a-f]{2})?$/i);
  if (!match) return undefined;
  return [
    Number.parseInt(match[1].slice(0, 2), 16),
    Number.parseInt(match[1].slice(2, 4), 16),
    Number.parseInt(match[1].slice(4, 6), 16),
  ];
}

function mixHexColors(
  first: string,
  second: string,
  firstWeight: number,
): string | undefined {
  const firstRgb = parseHexColor(first);
  const secondRgb = parseHexColor(second);
  if (!firstRgb || !secondRgb) return undefined;
  const weight = Math.min(1, Math.max(0, firstWeight));
  const channels = firstRgb.map((channel, index) =>
    Math.round(channel * weight + secondRgb[index] * (1 - weight)),
  );
  return `#${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`;
}

function linearChannel(channel: number): number {
  const normalized = channel / 255;
  return normalized <= 0.03928
    ? normalized / 12.92
    : ((normalized + 0.055) / 1.055) ** 2.4;
}

export function relativeLuminance(value: string): number {
  const rgb = parseHexColor(value);
  if (!rgb) return 0;
  return (
    0.2126 * linearChannel(rgb[0]) +
    0.7152 * linearChannel(rgb[1]) +
    0.0722 * linearChannel(rgb[2])
  );
}

export function contrastRatio(first: string, second: string): number {
  const firstLuminance = relativeLuminance(first);
  const secondLuminance = relativeLuminance(second);
  const lighter = Math.max(firstLuminance, secondLuminance);
  const darker = Math.min(firstLuminance, secondLuminance);
  return (lighter + 0.05) / (darker + 0.05);
}

/** Choose a readable semantic foreground for a creator-selected color. */
export function resolveContrastForeground(background: string): string {
  const darkRatio = contrastRatio(background, DARK_CONTROL_FOREGROUND);
  const lightRatio = contrastRatio(background, LIGHT_CONTROL_FOREGROUND);
  const preferred = darkRatio >= lightRatio
    ? DARK_CONTROL_FOREGROUND
    : LIGHT_CONTROL_FOREGROUND;

  // The two warm semantic candidates cover the supported palette. Keep the
  // arbitrary color input safe as well when an extreme imported/custom hex
  // falls below the normal-text floor with both candidates.
  if (contrastRatio(background, preferred) >= 4.5) return preferred;
  return contrastRatio(background, BLACK_FALLBACK) >= contrastRatio(background, WHITE_FALLBACK)
    ? BLACK_FALLBACK
    : WHITE_FALLBACK;
}

function resolveFocusColor(primary: string, surface: string): string {
  return contrastRatio(primary, surface) >= 3
    ? primary
    : resolveContrastForeground(surface);
}

export function appearanceVisual(appearance: SurpriseAppearance) {
  const theme = THEME_CONFIGS[appearance.theme];
  const primary = appearance.accentColor || theme.primary;
  const accent = theme.accent;
  const style = appearance.backgroundStyle || "gradient";
  const dark =
    appearance.theme === "blush-night" ||
    style === "starlight" ||
    appearance.theme === "moonlit-blue" ||
    appearance.theme === "violet-night";
  const deep = dark ? "#21172c" : primary;
  const treatment =
    style === "soft"
      ? `linear-gradient(145deg,${theme.background},${primary}88)`
      : style === "paper"
        ? `radial-gradient(circle at 88% 16%,${accent}66 0 7%,transparent 22%),repeating-linear-gradient(0deg,transparent 0 31px,${primary}22 32px),linear-gradient(90deg,transparent 0 9%,${primary}30 9% 9.3%,transparent 9.3%),${theme.background}`
        : style === "doodle"
          ? `radial-gradient(circle at 12% 15%,transparent 0 20px,${accent}55 21px 23px,transparent 24px),repeating-linear-gradient(0deg,transparent 0 30px,${primary}22 31px),${theme.background}`
          : style === "pixel-grid"
            ? `repeating-linear-gradient(90deg,transparent 0 31px,${primary}28 32px),repeating-linear-gradient(0deg,transparent 0 31px,${accent}28 32px),linear-gradient(135deg,${theme.background},${primary}55)`
            : style === "scrapbook"
              ? `linear-gradient(11deg,transparent 0 67%,${accent}38 68% 72%,transparent 73%),linear-gradient(-8deg,transparent 0 12%,#fff8 13% 31%,transparent 32%),radial-gradient(circle at 84% 18%,${primary}55 0 8%,transparent 8.5%),repeating-linear-gradient(0deg,transparent 0 27px,${primary}18 28px),linear-gradient(145deg,${theme.background},${accent}2b)`
              : style === "bokeh"
                ? `radial-gradient(circle at 16% 24%,#fff9 0 7%,transparent 8%),radial-gradient(circle at 70% 16%,${accent}99 0 10%,transparent 11%),radial-gradient(circle at 84% 76%,${primary}88 0 15%,transparent 16%),linear-gradient(145deg,${theme.background},${primary}66)`
                : style === "gingham"
                  ? `repeating-linear-gradient(90deg,${primary}20 0 16px,transparent 16px 32px),repeating-linear-gradient(0deg,${primary}20 0 16px,transparent 16px 32px),${theme.background}`
                  : style === "film-grain"
                    ? `repeating-radial-gradient(circle at 20% 30%,#fff2 0 1px,transparent 1px 4px),linear-gradient(125deg,${deep},${primary}aa,${accent}99)`
                    : style === "aurora"
                      ? `radial-gradient(circle at 12% 88%,${accent}cc,transparent 38%),radial-gradient(circle at 86% 8%,${primary}cc,transparent 42%),linear-gradient(145deg,${deep},${theme.background})`
                      : style === "starlight"
                        ? `radial-gradient(circle at 18% 28%,#fff 1px,transparent 2px),radial-gradient(circle at 72% 14%,#fff 1px,transparent 2px),linear-gradient(145deg,#111027,${primary})`
                        : style === "floating-hearts"
                          ? `radial-gradient(circle at 16% 12%,${accent}aa,transparent 30%),radial-gradient(circle at 82% 80%,${primary}99,transparent 34%),linear-gradient(145deg,${theme.background},${primary}55)`
                          : `radial-gradient(circle at 18% 12%,#fff9,transparent 30%),radial-gradient(circle at 82% 82%,${accent}99,transparent 34%),linear-gradient(145deg,${theme.background},${primary}77)`;
  const filter = appearance.backgroundFilter || "balanced";
  const veil = filter === "soft" ? 0.25 : filter === "strong" ? 0.68 : 0.46;
  const backdropOverlay = `linear-gradient(145deg,${primary}22,${accent}18),linear-gradient(color-mix(in srgb,${theme.background} ${veil * 100}%,transparent),color-mix(in srgb,${theme.background} ${veil * 100}%,transparent))`;
  const image = appearance.backgroundImage?.previewUrl;
  const imagePresentation = normalizeImagePresentation(
    appearance.backgroundImage?.presentation,
  );
  const imagePosition = `${imagePresentation.focalX * 100}% ${imagePresentation.focalY * 100}%`;
  // Recipient backdrops are atmospheric viewport artwork, not content
  // photos. They always fill the viewport so an old FIT/CUSTOM setting cannot
  // leak empty bars into fullscreen, the viewer, or the Android WebView.
  const imageSizing = "cover no-repeat";
  const background = image
    ? `${backdropOverlay},url("${safeCssUrl(image)}") ${imagePosition}/${imageSizing} fixed,${treatment}`
    : treatment;
  const ink =
    dark
      ? "#fffaf7"
      : appearance.theme === "lavender-dream"
        ? "#34264d"
        : appearance.theme === "sweet-sky"
          ? "#173a51"
          : "#432a25";
  const font = fontFamilyForPairing(appearance.theme, appearance.fontPairing);
  const primaryForeground = resolveContrastForeground(primary);
  const accentForeground = resolveContrastForeground(accent);
  const focus = resolveFocusColor(primary, dark ? DARK_CONTROL_FOREGROUND : theme.background);
  // A custom photograph retains the selected theme. Reading surfaces have
  // their own contrast tokens; selecting a photo never switches a light
  // appearance to a dark one. The shared veil applies in both renderers.
  const overImage = Boolean(image);
  const surfaceReference = overImage && dark
    ? mixHexColors("#18121a", primary, 0.88) || "#18121a"
    : mixHexColors(theme.background, primary, 0.86) || theme.background;
  const elevatedSurfaceReference = overImage && dark
    ? mixHexColors("#1c151e", "#ffffff", 0.9) || "#1c151e"
    : mixHexColors(theme.background, "#ffffff", dark ? 0.72 : 0.92) || theme.background;
  const surfaceForeground = resolveContrastForeground(surfaceReference);
  const elevatedSurfaceForeground = resolveContrastForeground(elevatedSurfaceReference);
  const secondaryReference =
    mixHexColors(theme.background, primary, 0.82) || theme.background;
  const mutedReference =
    mixHexColors(theme.background, accent, 0.78) || theme.background;
  const secondaryForeground = resolveContrastForeground(secondaryReference);
  const mutedSurfaceForeground = resolveContrastForeground(mutedReference);
  const tokens: RecipientThemeTokens = {
    canvas: theme.background,
    foreground: ink,
    mutedForeground: `color-mix(in srgb, ${ink} 78%, transparent)`,
    mutedSurfaceForeground,
    secondaryForeground,
    surface: surfaceReference,
    surfaceForeground,
    surfaceMutedForeground: `color-mix(in srgb, ${surfaceForeground} 84%, transparent)`,
    elevatedSurface: elevatedSurfaceReference,
    elevatedSurfaceForeground,
    elevatedSurfaceMutedForeground: `color-mix(in srgb, ${elevatedSurfaceForeground} 84%, transparent)`,
    border: overImage
      ? `color-mix(in srgb, ${primary} 44%, rgba(255, 255, 255, 0.3))`
      : `color-mix(in srgb, ${primary} 36%, ${theme.background})`,
    overlay: dark ? "rgba(8, 5, 12, .68)" : "rgba(32, 20, 24, .52)",
    accent,
    focus,
    primaryForeground,
    accentForeground,
  };
  return {
    theme,
    primary,
    accent,
    dark,
    ink,
    font,
    background,
    backdropOverlay,
    treatment,
    tokens,
  };
}
