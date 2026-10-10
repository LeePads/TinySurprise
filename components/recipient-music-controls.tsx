"use client";

import { Pause, Play, RotateCcw, Volume2, VolumeX, X } from "lucide-react";
import { useEffect, useId, useRef, useState } from "react";

import { useRecipientOverlay } from "@/lib/use-recipient-overlay";
import { usePreviewSuspended } from "@/lib/preview-activity";

export interface RecipientMusicControlsProps {
  playing: boolean;
  muted: boolean;
  volume: number;
  error?: string;
  onToggle: () => void;
  onToggleMute: () => void;
  onVolumeChange: (volume: number) => void;
  onRestart: () => void;
  onRetry: () => void;
  playLabel?: string;
}

/**
 * A deliberately small recipient-facing control surface. The primary pill
 * keeps the experience quiet; the secondary controls live behind one
 * accessible settings dialog so preview/fullscreen/WebView share the same
 * interaction model without turning the surprise into a music-player screen.
 */
export function RecipientMusicControls({
  playing,
  muted,
  volume,
  error,
  onToggle,
  onToggleMute,
  onVolumeChange,
  onRestart,
  onRetry,
  playLabel,
}: RecipientMusicControlsProps) {
  const [expanded, setExpanded] = useState(false);
  const suspended = usePreviewSuspended();
  useEffect(() => { if (suspended) setExpanded(false); }, [suspended]);
  const triggerRef = useRef<HTMLButtonElement>(null);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const close = () => { setExpanded(false); triggerRef.current?.focus({ preventScroll: true }); };
  useRecipientOverlay({ open: expanded && !suspended, containerRef: dialogRef, initialRef: closeRef, onClose: close });
  useEffect(() => {
    const dismiss = (event: Event) => { if ((event as CustomEvent<{ container?: HTMLElement }>).detail?.container !== dialogRef.current) setExpanded(false); };
    window.addEventListener("tiny-recipient-overlay-open", dismiss);
    return () => window.removeEventListener("tiny-recipient-overlay-open", dismiss);
  }, []);
  const optionsId = `recipient-music-options-${useId().replace(/:/g, "")}`;

  return (
    <div className="grid w-full justify-items-end gap-2">
      <div className="flex w-full max-w-full flex-wrap justify-end gap-2">
        <button
          type="button"
          aria-label={playing ? "Pause music" : playLabel || "Play music"}
          aria-pressed={playing}
          onClick={onToggle}
          className="recipient-surface-elevated inline-flex min-h-12 items-center gap-2 rounded-full border border-[var(--experience-border)] bg-[var(--experience-surface-elevated)] px-4 text-sm font-semibold shadow-sm transition hover:bg-[var(--experience-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]"
        >
          {playing ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          {playing ? "Music on" : playLabel || "Play music"}
        </button>
        <button
          type="button"
          ref={triggerRef}
          aria-label={error ? "Music settings: playback needs attention" : "Music settings"}
          aria-haspopup="dialog"
          aria-expanded={expanded}
          aria-controls={optionsId}
          onClick={() => setExpanded((open) => !open)}
          className="recipient-surface-elevated flex min-h-12 min-w-12 items-center justify-center rounded-full border border-[var(--experience-border)] bg-[var(--experience-surface-elevated)] px-3 text-sm font-semibold shadow-sm transition hover:bg-[var(--experience-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]"
        >
          {muted ? (
            <VolumeX className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Volume2 className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
      {error && !expanded && <p role="status" className="text-sm">Music needs attention. Open Music settings to retry.</p>}
      {expanded && (
        <div ref={dialogRef} id={optionsId} role="dialog" aria-modal="true" aria-labelledby={optionsId + "-title"} className="recipient-dialog-overlay fixed inset-0 z-[110] flex items-end justify-center bg-[var(--experience-overlay)] p-4 @[640px]/recipient-preview:items-center" onClick={event => { if (event.target === event.currentTarget) close(); }}>
        <section className="recipient-surface-elevated grid w-full max-w-sm gap-2 overflow-y-auto rounded-2xl border border-[var(--experience-border)] bg-[var(--experience-surface-elevated)] p-4 text-left shadow-xl">
          <header className="flex items-center justify-between gap-3"><h2 id={optionsId + "-title"} className="text-lg font-semibold">Music settings</h2><button ref={closeRef} type="button" onClick={close} aria-label="Close music settings" className="grid min-h-12 min-w-12 place-items-center rounded-xl hover:bg-[var(--experience-surface)]"><X className="h-5 w-5" /></button></header>
          <p role="status" className="text-sm text-[var(--experience-surface-elevated-muted)]">{error || (playing ? muted ? "Music is playing, muted." : "Music is playing." : "Music is paused.")}</p>
          <button type="button" onClick={onToggle} className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-[var(--experience-surface)]">{playing ? <Pause className="h-4 w-4" /> : <Play className="h-4 w-4" />}{playing ? "Pause music" : playLabel || "Play music"}</button>
          <button
            type="button"
            aria-label={muted ? "Unmute music" : "Mute music"}
            onClick={onToggleMute}
            className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-[var(--experience-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]"
          >
            {muted ? (
              <Volume2 className="h-4 w-4" aria-hidden="true" />
            ) : (
              <VolumeX className="h-4 w-4" aria-hidden="true" />
            )}
            {muted ? "Unmute" : "Mute"}
          </button>
          <label className="grid gap-1 px-3 py-1 text-xs font-semibold">
            <span>Volume {volume}%</span>
            <input
              aria-label="Music volume"
              type="range"
              min="0"
              max="100"
              value={volume}
              onChange={(event) => onVolumeChange(Number(event.target.value))}
              className="min-h-12 w-full accent-primary"
            />
          </label>
          <button
            type="button"
            aria-label="Restart music"
            onClick={onRestart}
            className="flex min-h-12 items-center gap-2 rounded-xl px-3 text-sm font-semibold hover:bg-[var(--experience-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Restart
          </button>
          {error && (
            <div
              className="grid gap-2 rounded-xl border border-[var(--experience-border)] bg-[var(--experience-surface)] p-3 text-xs"
              role="alert"
            >
              <span>{error}</span>
              <button
                type="button"
                onClick={onRetry}
                className="min-h-12 rounded-xl border border-[var(--experience-border)] px-3 text-left font-semibold hover:bg-[var(--experience-surface)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--experience-focus)]"
              >
                Try again
              </button>
            </div>
          )}
        </section></div>
      )}
    </div>
  );
}
