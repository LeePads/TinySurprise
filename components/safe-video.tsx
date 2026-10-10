"use client";

import { useState } from "react";
import { VideoOff } from "lucide-react";

interface SafeVideoProps {
  src?: string;
  className?: string;
  required?: boolean;
}

/**
 * Recipient-facing video with a designed fallback instead of a broken
 * native player, mirroring SafeImage's pattern for photos. `required`
 * distinguishes gameplay-critical media from optional decoration.
 */
export function SafeVideo(props: SafeVideoProps) {
  return <VideoForSource key={props.src || ""} {...props} />;
}

function VideoForSource({ src, className, required }: SafeVideoProps) {
  const [failedSource, setFailedSource] = useState<string>();

  if (!src || failedSource === src) {
    return (
      <div
        className={`flex flex-col items-center justify-center gap-1.5 bg-muted/60 text-center text-muted-foreground ${className || ""}`}
        role="img"
        aria-label="Video unavailable"
      >
        <VideoOff className="h-6 w-6" aria-hidden="true" />
        <p className="px-3 text-xs">
          {required
            ? "This surprise is missing a required video."
            : "This video could not be loaded."}
        </p>
      </div>
    );
  }

  return (
    <video
      className={className}
      src={src}
      controls
      playsInline
      preload="metadata"
      key={src}
      onError={() => setFailedSource(src)}
    />
  );
}
