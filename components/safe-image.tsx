"use client";

import { useState, type CSSProperties } from "react";
import { ImageOff } from "lucide-react";

interface SafeImageProps {
  src?: string;
  alt: string;
  className?: string;
  required?: boolean;
  unavailable?: boolean;
  loading?: "eager" | "lazy";
  style?: CSSProperties;
  "data-presentation-mode"?: string;
  "data-presentation-zoom"?: number;
}

/**
 * Recipient-facing photo with a designed fallback instead of a browser
 * broken-image icon. `required` distinguishes gameplay-critical media
 * (still shows the frame + message so layout doesn't collapse) from
 * optional decoration (message reads accordingly either way — the caller
 * still decides whether to keep showing the surrounding UI).
 */
export function SafeImage(props: SafeImageProps) {
  return <ImageForSource key={(props.src || "") + ":" + Boolean(props.unavailable)} {...props} />;
}

function ImageForSource({
  src,
  alt,
  className,
  required,
  unavailable,
  loading,
  style,
  "data-presentation-mode": presentationMode,
  "data-presentation-zoom": presentationZoom,
}: SafeImageProps) {
  const [failedSource, setFailedSource] = useState<string>();

  if (!src || unavailable || failedSource === src) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 bg-muted/60 text-center text-muted-foreground ${className || ""}`}
        role="img"
        aria-label={alt || "Photo unavailable"}
      >
        <ImageOff className="h-6 w-6" aria-hidden="true" />
        <p className="px-3 text-xs">
          {unavailable
            ? "Photo unavailable — choose it again"
            : required
            ? "This surprise is missing a required photo."
            : "This photo could not be loaded."}
        </p>
      </div>
    );
  }

  // draggable={false}: a bare <img> is natively draggable, and that native
  // HTML5 drag pre-empts pointer gestures on top of it — in the framing
  // editor it fired pointercancel mid-pan and bubbled a `drop` up into
  // LocalImagePicker's file-drop handler. Nothing in this app wants an
  // image ghost-drag, so it is off everywhere SafeImage renders.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={src} src={src} alt={alt} draggable={false} className={className} style={style} data-presentation-mode={presentationMode} data-presentation-zoom={presentationZoom} loading={loading} decoding="async" onError={() => setFailedSource(src)} />;
}
