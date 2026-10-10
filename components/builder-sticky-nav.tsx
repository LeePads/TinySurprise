"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Music2, Volume2, VolumeX } from "lucide-react";
import { Button } from "./ui/button";
import type { SurpriseMusic } from "@/lib/types";

interface BuilderStickyNavProps {
  onBack: () => void;
  backLabel: string;
  backDisabled: boolean;
  onContinue?: () => void;
  continueLabel?: string;
  /** Shrinks the bar with a shorter Continue label while the on-screen keyboard is open. Android only — see use-keyboard.ts. */
  compact?: boolean;
  /** Retained for call-site compatibility; the sticky control owns SiteMusic. */
  music?: SurpriseMusic;
  onMusic?: (value: Partial<SurpriseMusic>) => void;
  hasYoutubeSong?: boolean;
}

/**
 * Shared compact sticky bar for the builder: Back / Music / Continue.
 * The Music button is always a remote for the single SiteMusic instance.
 * The surprise's uploaded song remains owned by the Delivery music section.
 */
export function BuilderStickyNav({
  onBack,
  backLabel,
  backDisabled,
  onContinue,
  continueLabel,
  compact,
}: BuilderStickyNavProps) {
  return (
    <div
      className={`builder-sticky-nav ${compact ? "builder-sticky-nav--compact" : ""} sticky bottom-[calc(.5rem+env(safe-area-inset-bottom))] z-40 mx-auto mt-6 flex w-full min-w-0 max-w-3xl gap-2 rounded-[1.35rem] border border-border/70 bg-card/94 backdrop-blur-xl transition-[padding] duration-200 sm:gap-3 ${compact ? "p-1 shadow-[var(--shadow-soft)]" : "p-2 shadow-[var(--shadow-elevated)]"}`}
    >
      <Button
        className="h-auto min-h-12 min-w-0 flex-1 whitespace-normal py-2 sm:flex-none"
        variant="outline"
        onClick={onBack}
        disabled={backDisabled}
      >
        {backLabel}
      </Button>
      {!compact && <CompactMusicControl />}
      {onContinue && (
        <Button
          className="builder-sticky-nav__continue h-auto min-h-12 min-w-0 flex-[2] whitespace-normal py-2 sm:flex-none"
          onClick={onContinue}
          aria-label={continueLabel || "Continue"}
        >
          <span className="min-w-0">{compact ? "Continue" : continueLabel || "Continue"}</span>
          <ArrowRight className="ml-1.5 h-4 w-4" aria-hidden="true" />
        </Button>
      )}
    </div>
  );
}

/**
 * Remote control for the single, app-wide site-music instance
 * owned by site-music.tsx — communicates over the same window CustomEvent
 * pair the builder/preview experiences already use for audio ducking, so
 * there is still only ever one <audio> element playing.
 */
function CompactMusicControl() {
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const onState = (event: Event) => {
      const detail = (event as CustomEvent<{ playing: boolean; blocked: boolean }>)
        .detail;
      if (!detail) return;
      setPlaying(detail.playing);
      setBlocked(detail.blocked);
    };
    window.addEventListener("tiny-site-music-state", onState);
    return () => window.removeEventListener("tiny-site-music-state", onState);
  }, []);

  return (
    <button
      type="button"
      onClick={() =>
        window.dispatchEvent(new Event("tiny-site-music-toggle-request"))
      }
      aria-label={playing ? "Pause app music" : "Play app music"}
      aria-pressed={playing}
      title={playing ? "Pause app music" : "Play app music"}
      className={`builder-sticky-nav__music flex min-h-12 min-w-12 shrink-0 flex-col items-center justify-center gap-0.5 rounded-[1rem] border px-1 text-foreground transition hover:border-primary/45 hover:bg-primary/8 sm:hidden ${playing ? "border-primary/45 bg-primary/10" : "border-border/70 bg-card/70"}`}
    >
      {blocked ? (
        <Music2 className="h-4 w-4 text-primary" aria-hidden="true" />
      ) : playing ? (
        <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
      ) : (
        <VolumeX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="whitespace-normal text-xs font-semibold leading-tight">App music</span>
    </button>
  );
}
