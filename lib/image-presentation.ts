import type {
  ImagePresentation,
  ImagePresentationMode,
  LocalImage,
} from "./types";

export const DEFAULT_IMAGE_PRESENTATION: Required<ImagePresentation> = {
  mode: "fit",
  focalX: 0.5,
  focalY: 0.5,
  zoom: 1,
};

const clamp = (value: number, min: number, max: number) =>
  Math.min(max, Math.max(min, value));

const finiteNumber = (value: unknown): value is number =>
  typeof value === "number" && Number.isFinite(value);

export function normalizeImagePresentation(
  value?: Partial<ImagePresentation> | null,
  legacyFit?: "contain" | "cover",
): Required<ImagePresentation> {
  const legacyMode: ImagePresentationMode | undefined =
    legacyFit === "contain"
      ? "fit"
      : legacyFit === "cover"
        ? "fill"
        : undefined;
  const mode =
    value?.mode === "fit" || value?.mode === "fill" || value?.mode === "custom"
      ? value.mode
      : legacyMode ?? DEFAULT_IMAGE_PRESENTATION.mode;

  return {
    mode,
    focalX: finiteNumber(value?.focalX)
      ? clamp(value.focalX, 0, 1)
      : DEFAULT_IMAGE_PRESENTATION.focalX,
    focalY: finiteNumber(value?.focalY)
      ? clamp(value.focalY, 0, 1)
      : DEFAULT_IMAGE_PRESENTATION.focalY,
    zoom: finiteNumber(value?.zoom)
      ? clamp(value.zoom, 1, 3)
      : DEFAULT_IMAGE_PRESENTATION.zoom,
  };
}

export function normalizeLocalImagePresentation(
  image: LocalImage,
  legacyFit?: "contain" | "cover",
): LocalImage {
  return {
    ...image,
    presentation: normalizeImagePresentation(image.presentation, legacyFit),
  };
}

/** Backdrops always cover the pane, while retaining authored Adjust framing. */
export function backgroundImagePresentation(
  value?: Partial<ImagePresentation> | null,
): Required<ImagePresentation> {
  const presentation = normalizeImagePresentation(value);
  return { ...presentation, mode: presentation.mode === "custom" ? "custom" : "fill" };
}

export function presentationImageStyle(
  value?: Partial<ImagePresentation> | null,
  legacyFit?: "contain" | "cover",
): {
  objectFit: "contain" | "cover";
  objectPosition: string;
  transform: string;
  transformOrigin: string;
} {
  const presentation = normalizeImagePresentation(value, legacyFit);
  return {
    objectFit: presentation.mode === "fit" ? "contain" : "cover",
    objectPosition: `${presentation.focalX * 100}% ${presentation.focalY * 100}%`,
    transform:
      presentation.mode === "custom"
        ? `scale(${presentation.zoom})`
        : "scale(1)",
    transformOrigin: `${presentation.focalX * 100}% ${presentation.focalY * 100}%`,
  };
}

export function updateImagePresentation(
  current: Partial<ImagePresentation> | null | undefined,
  mode: ImagePresentationMode,
): Required<ImagePresentation> {
  const normalized = normalizeImagePresentation(current);
  if (mode === "fit" || mode === "fill") {
    return { ...normalized, mode, focalX: 0.5, focalY: 0.5, zoom: 1 };
  }
  return { ...normalized, mode: "custom" };
}

