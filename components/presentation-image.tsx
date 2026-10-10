"use client";

import { SafeImage } from "./safe-image";
import {
  normalizeImagePresentation,
  presentationImageStyle,
} from "@/lib/image-presentation";
import type { ImagePresentation, LocalImage } from "@/lib/types";

type PresentationImageValue = Pick<LocalImage, "previewUrl" | "presentation" | "unavailable"> & {
  imageFit?: "contain" | "cover";
};

interface PresentationImageProps {
  image?: PresentationImageValue;
  alt: string;
  className?: string;
  frameClassName?: string;
  aspectRatio?: number | string;
  required?: boolean;
  loading?: "eager" | "lazy";
  presentation?: ImagePresentation;
}

/** One image-frame contract shared by builder previews and recipient views. */
export function PresentationImage({
  image,
  alt,
  className = "",
  frameClassName = "",
  aspectRatio,
  required,
  loading,
  presentation,
}: PresentationImageProps) {
  const resolved = presentation ?? image?.presentation;
  const style = presentationImageStyle(resolved, image?.imageFit);
  const normalized = normalizeImagePresentation(resolved, image?.imageFit);

  return (
    <div
      className={`relative flex min-h-0 min-w-0 items-center justify-center overflow-hidden bg-muted/40 ${frameClassName}`}
      style={aspectRatio ? { aspectRatio } : undefined}
    >
      <SafeImage
        src={image?.previewUrl}
        alt={alt}
        required={required}
        unavailable={image?.unavailable}
        loading={loading}
        className={`absolute inset-0 block h-full w-full ${className}`}
        style={style}
        data-presentation-mode={normalized.mode}
        data-presentation-zoom={normalized.zoom}
      />
    </div>
  );
}

