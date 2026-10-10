"use client";

import { useEffect, useId, useRef, useState } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import type { PanInfo } from "framer-motion";
import {
  FileAudio2,
  Pause,
  Play,
  Trash2,
  Volume2,
  VolumeX,
  Wifi,
  X,
} from "lucide-react";
import { Button } from "./ui/button";
import { Input } from "./ui/input";
import { InlineFieldMessage } from "./ui/inline-field-message";
import { useModalBackHandler } from "@/lib/native/use-modal-back-handler";
import { hapticTap } from "@/lib/native/haptics";
import type { SurpriseMusic } from "@/lib/types";
import {
  AUDIO_ACCEPT,
  audioValidationMessage,
  prepareLocalAudio,
  AUDIO_COMPATIBILITY_NOTE,
  formatAudioDuration,
} from "@/lib/music";
import { parseYouTubeUrl } from "@/lib/youtube";
import { useFocusTrap } from "@/lib/use-focus-trap";
import { bindExclusiveAudioPreview } from "@/lib/audio-preview";
import { revokeObjectUrl } from "@/lib/local-media";

interface MusicSheetProps {
  open: boolean;
  onClose: () => void;
  music?: SurpriseMusic;
  onMusic: (value: Partial<SurpriseMusic>) => void;
  /** True when the current template also has a YouTube song URL configured — surfaced as an internet-required note. */
  hasYoutubeSong?: boolean;
}

/**
 * The surprise's own background-music control, reachable from anywhere in
 * the builder via BuilderStickyNav's Music button (Android/mobile web) —
 * distinct from site-music.tsx's decorative authoring-site ambience. Owns a
 * standalone <audio> element so it works even on steps that don't mount a
 * live recipient preview (Basics, Customize, Appearance).
 */
export function MusicSheet({
  open,
  onClose,
  music,
  onMusic,
  hasYoutubeSong,
}: MusicSheetProps) {
  const musicRef = useRef(music);
  useEffect(() => {
    musicRef.current = music;
  }, [music]);
  const panelRef = useRef<HTMLDivElement>(null);
  const closeButtonRef = useRef<HTMLButtonElement>(null);
  const audioRef = useRef<HTMLAudioElement>(null);
  const previewOwner = useId();
  const errorId = `${previewOwner}-error`;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const audioChoice = useRef(0);
  const [preparing, setPreparing] = useState(false);
  useEffect(() => () => { audioChoice.current++; }, []);
  const reduceMotion = useReducedMotion();
  const [playing, setPlaying] = useState(false);
  const [error, setError] = useState("");
  const errorDescription = error ? errorId : undefined;
  useModalBackHandler(open, onClose);
  useFocusTrap(open, panelRef, closeButtonRef, onClose);

  useEffect(() => {
    if (!open) {
      audioRef.current?.pause();
      setPlaying(false);
    }
  }, [open]);

  useEffect(() => {
    // Swapping the song mid-sheet (replace) shouldn't keep playing the old track.
    audioRef.current?.pause();
    setPlaying(false);
  }, [music?.file?.id]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    return bindExclusiveAudioPreview(audio, `music-sheet-${previewOwner}`);
  }, [music?.file?.id, open, previewOwner]);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previousOverflow;
    };
  }, [open]);

  const togglePlay = () => {
    const audio = audioRef.current;
    if (!audio) return;
    void hapticTap();
    if (playing) {
      audio.pause();
      setPlaying(false);
    } else {
      void audio.play().then(() => setPlaying(true)).catch(() => setError("This song could not be played."));
    }
  };

  const replaceMusic = async (file?: File) => {
    if (!file) return;
    const choice = ++audioChoice.current;
    setError("");
    const message = audioValidationMessage(file);
    if (message) {
      setError(message);
      setPreparing(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }
    const previous = musicRef.current;
    setPreparing(true);
    try {
      const uploaded = await prepareLocalAudio(file, "surprise-music");
      if (choice !== audioChoice.current) { revokeObjectUrl(uploaded.previewUrl); return; }
      if (musicRef.current !== previous) { revokeObjectUrl(uploaded.previewUrl); setError("Music settings changed while reading this file. Choose it again; your existing song is kept."); return; }
      onMusic({ file: uploaded, youtubeUrl: "" });
      if (previous?.file?.previewUrl.startsWith("blob:")) revokeObjectUrl(previous.file.previewUrl);
      void hapticTap("medium");
    } catch (reason) { if (choice === audioChoice.current) setError(reason instanceof Error ? reason.message : "This music could not be read. Your existing song is kept."); }
    finally { if (choice === audioChoice.current) { setPreparing(false); if (fileInputRef.current) fileInputRef.current.value = ""; } }
  };

  const removeMusic = () => {
    if (music?.file?.previewUrl.startsWith("blob:"))
      revokeObjectUrl(music.file.previewUrl);
    onMusic({ file: undefined, youtubeUrl: "" });
    void hapticTap();
  };

  const handleDragEnd = (
    _event: PointerEvent | MouseEvent | TouchEvent,
    info: PanInfo,
  ) => {
    if (info.offset.y > 80 || info.velocity.y > 500) onClose();
  };

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          className="fixed inset-0 z-[105] flex items-end justify-center bg-black/55 backdrop-blur-sm"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.2 }}
          onClick={onClose}
        >
          <motion.section
            ref={panelRef}
            role="dialog"
            aria-modal="true"
            aria-label="Surprise music"
            drag={reduceMotion ? false : "y"}
            dragConstraints={{ top: 0, bottom: 0 }}
            dragElastic={{ top: 0, bottom: 0.4 }}
            onDragEnd={handleDragEnd}
            initial={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            animate={reduceMotion ? { opacity: 1 } : { y: 0 }}
            exit={reduceMotion ? { opacity: 0 } : { y: "100%" }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
            className="android-sheet-panel w-full max-w-md rounded-t-[1.75rem] border border-border/70 bg-card p-4 pb-[calc(1.25rem+env(safe-area-inset-bottom))] shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-border" aria-hidden="true" />
            <div className="flex items-center justify-between">
              <h2 className="text-sm font-bold">Surprise music</h2>
              <button
                ref={closeButtonRef}
                type="button"
                aria-label="Close"
                onClick={onClose}
                className="grid min-h-12 min-w-12 place-items-center rounded-full hover:bg-secondary"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            {music?.file ? (
              <div className="mt-3 space-y-3">
                <div className="flex items-center gap-3 rounded-xl border bg-secondary/25 p-3">
                  <button
                    type="button"
                    onClick={togglePlay}
                    aria-label={playing ? "Pause" : "Play"}
                    aria-describedby={errorDescription}
                    className="grid h-12 w-12 shrink-0 place-items-center rounded-full bg-primary text-primary-foreground shadow-sm"
                  >
                    {playing ? (
                      <Pause className="h-5 w-5 fill-current" />
                    ) : (
                      <Play className="h-5 w-5 fill-current" />
                    )}
                  </button>
                  <span className="min-w-0 flex-1 text-sm font-semibold [overflow-wrap:anywhere]">
                    {music.file.name}
                    {formatAudioDuration(music.file.durationSeconds) && (
                      <span className="ml-2 text-xs font-normal text-muted-foreground">
                        {formatAudioDuration(music.file.durationSeconds)}
                      </span>
                    )}
                  </span>
                </div>
                <p className="text-xs text-muted-foreground">{(music.file.size / 1024 / 1024).toFixed(1)} MB · Original file included</p>
                <audio
                  ref={audioRef}
                  src={music.file.previewUrl}
                  preload="none"
                  onEnded={() => setPlaying(false)}
                  onError={() => setError("This browser cannot play the saved song. Replace it with MP3 or M4A; the saved file is kept until its replacement is ready.")}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => onMusic({ startMuted: !music.startMuted })}
                  aria-pressed={music.startMuted}
                  className="flex min-h-12 w-full items-center gap-3 rounded-xl border bg-card px-3 text-sm font-medium"
                >
                  {music.startMuted ? (
                    <VolumeX className="h-4 w-4 text-muted-foreground" />
                  ) : (
                    <Volume2 className="h-4 w-4 text-primary" />
                  )}
                  <span className="flex-1 text-left">Start muted for recipient</span>
                  <span
                    className={`flex h-6 w-11 shrink-0 items-center rounded-full p-0.5 transition ${music.startMuted ? "bg-primary justify-end" : "bg-muted justify-start"}`}
                  >
                    <span className="h-5 w-5 rounded-full bg-white shadow" />
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    variant="outline"
                    aria-describedby={errorDescription}
                    onClick={() => {
                      void hapticTap();
                      fileInputRef.current?.click();
                    }}
                  >
                    <FileAudio2 className="mr-2 h-4 w-4" />
                    Replace
                  </Button>
                  <Button variant="outline" className="text-destructive" onClick={removeMusic}>
                    <Trash2 className="mr-2 h-4 w-4" />
                    Remove
                  </Button>
                </div>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <p className="text-sm text-muted-foreground">
                  No song uploaded yet. Add one from the Delivery step, or
                  right here.
                </p>
                <Button
                  className="min-h-12 w-full"
                  variant="outline"
                  aria-describedby={errorDescription}
                  onClick={() => {
                    void hapticTap();
                    fileInputRef.current?.click();
                  }}
                >
                  <FileAudio2 className="mr-2 h-4 w-4" />
                  Upload a song
                </Button>
              </div>
            )}

            {preparing && <p role="status" className="mt-3 text-sm text-muted-foreground">Reading audio… Your existing song is kept until the file is ready.</p>}
            <p className="mt-3 text-xs text-muted-foreground">{AUDIO_COMPATIBILITY_NOTE}</p>
            <div className="mt-4 space-y-2 border-t border-border/60 pt-3">
              <label className="block text-sm font-medium" htmlFor="sheet-youtube-url">
                Or open a song on YouTube <span className="font-normal text-muted-foreground">(needs internet)</span>
              </label>
              <Input
                id="sheet-youtube-url"
                inputMode="url"
                placeholder="https://youtu.be/..."
                value={music?.youtubeUrl || ""}
                onChange={(event) => {
                  const value = event.target.value;
                  const replacesUpload = Boolean(parseYouTubeUrl(value));
                  if (replacesUpload && music?.file?.previewUrl.startsWith("blob:"))
                    revokeObjectUrl(music.file.previewUrl);
                  onMusic({ youtubeUrl: value, ...(replacesUpload ? { file: undefined } : {}) });
                }}
              />
              <p className="text-xs text-muted-foreground">YouTube opens separately and needs internet. Upload audio you have permission to share for music inside the surprise, including offline.</p>
              {music?.file && <p className="text-xs text-muted-foreground">Adding a valid YouTube link replaces the uploaded song. An incomplete link keeps your file.</p>}
              {music?.youtubeUrl && (
                <p className={`text-xs ${parseYouTubeUrl(music.youtubeUrl) ? "text-primary" : "text-destructive"}`}>
                  {parseYouTubeUrl(music.youtubeUrl) ? "YouTube opens separately and needs internet." : "Use a valid YouTube link."}
                </p>
              )}
            </div>

            {hasYoutubeSong && (
              <p className="mt-3 flex items-center gap-1.5 rounded-xl border bg-secondary/25 p-2.5 text-xs text-muted-foreground">
                <Wifi className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
                This template also has a YouTube song set — it needs internet
                and opens from the recipient&apos;s own tap.
              </p>
            )}

            <InlineFieldMessage id={errorId} message={error} />

            <input
              ref={fileInputRef}
              type="file"
              className="hidden"
              aria-label="Upload surprise music"
              accept={AUDIO_ACCEPT}
              onChange={(event) => replaceMusic(event.target.files?.[0])}
            />
          </motion.section>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
