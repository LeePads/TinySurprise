"use client";

import { useEffect, useId, useMemo, useRef, useState } from "react";
import { motion } from "framer-motion";
import {
  Gift,
  Heart,
  KeyRound,
  LockKeyhole,

  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { usePreviewSuspended } from "@/lib/preview-activity";
import { ExternalSongLink } from "@/components/external-song-link";
import { RecipientMusicControls } from "@/components/recipient-music-controls";
import { PresentationImage } from "@/components/presentation-image";
import { backgroundImagePresentation } from "@/lib/image-presentation";
import { appearanceVisual } from "@/lib/appearance";
import { normalizeRenderableImageUrl } from "@/lib/safe-url";
import type { OpeningStyle, SurpriseData } from "@/lib/types";
import { parseYouTubeUrl } from "@/lib/youtube";
import { normalizeLegacyMusic } from "@/lib/music";
import {
  useRecipientMotionMode,
  type RecipientMotionMode,
} from "@/lib/recipient-motion";
import {

  bindExclusiveAudioPreview,


} from "@/lib/audio-preview";

const normalize = (value: string) =>
  value.trim().toLocaleLowerCase().replace(/\s+/g, " ");
type Phase = "locked" | "cover" | "opening" | "experience";

function AppearanceBackdrop({ appearance }: { appearance: SurpriseData["appearance"] }) {
  if (!appearance.backgroundImage) return null;
  return (
    <div className="pointer-events-none fixed inset-0 z-0 overflow-hidden" aria-hidden="true">
      <PresentationImage
        image={appearance.backgroundImage}
        alt=""
        presentation={backgroundImagePresentation(appearance.backgroundImage.presentation)}
        frameClassName="!absolute inset-0 h-full w-full rounded-none !bg-transparent"
      />
      <div className="absolute inset-0" style={{ background: appearanceVisual(appearance).backdropOverlay }} />
    </div>
  );
}

export function RecipientPreview({
  data,
  children,
  initialPhase,
  fillHeight,
  presentationMode,
}: {
  data: SurpriseData;
  children: React.ReactNode;
  initialPhase?: Phase;
  /** Stretch fullscreen experience content through the pane's flex layout. */
  fillHeight?: boolean;
  presentationMode?: "contained" | "viewport" | "builder-compact-preview";
}) {
  const suspended = usePreviewSuspended();
  const suspendedRef = useRef(suspended);
  useEffect(() => { suspendedRef.current = suspended; }, [suspended]);
  const accepted = [
    ...(data.delight?.passphraseAnswers || []),
    data.delight?.passphrase || "",
  ]
    .map(normalize)
    .filter(Boolean);
  const secretChoices = (data.delight?.passphraseChoices || []).filter(
    (choice) => choice.trim(),
  );
  const usesChoices =
    data.delight?.passphraseMode === "choice" && secretChoices.length >= 2;
  const canonicalMusic = useMemo(() => normalizeLegacyMusic(data).music, [data]);
  const suppressBackgroundMusic = data.template === "cozy-playlist";
  const youtube = suppressBackgroundMusic
    ? null
    : parseYouTubeUrl(canonicalMusic?.youtubeUrl);
  const uploadedMusic = suppressBackgroundMusic ? undefined : canonicalMusic?.file;
  const hasStartGate = Boolean(
    data.delight?.coverEnabled || youtube || uploadedMusic,
  );
  const locked = Boolean(data.delight?.passphraseEnabled && accepted.length);
  const defaultPhase: Phase = locked
    ? "locked"
    : hasStartGate
      ? "cover"
      : "opening";
  const [phase, setPhase] = useState<Phase>(initialPhase || defaultPhase);
  const [word, setWord] = useState("");
  const [error, setError] = useState("");
  const [musicPlaying, setMusicPlaying] = useState(false);
  const [musicMuted, setMusicMuted] = useState(Boolean(canonicalMusic?.startMuted));
  const [musicVolume, setMusicVolume] = useState(canonicalMusic?.volume ?? 60);
  const [musicError, setMusicError] = useState("");
  const uploadedAudio = useRef<HTMLAudioElement | null>(null);
  useEffect(() => { if (suspended) uploadedAudio.current?.pause(); }, [suspended]);
  const secretInputRef = useRef<HTMLInputElement>(null);
  const previewOwner = useId();
  const resolvedPresentationMode = presentationMode || (fillHeight ? "viewport" : "contained");
  const containedClasses = resolvedPresentationMode === "viewport"
    ? ""
    : ` recipient-preview--contained${resolvedPresentationMode === "builder-compact-preview" ? " recipient-preview--builder-compact" : ""}`;
  const motionMode = useRecipientMotionMode(data.appearance.animationIntensity);
  const reduceMotion = motionMode === "reduced";
  const lockSignature = `${Boolean(data.delight?.passphraseEnabled)}:${accepted.join("|")}:${hasStartGate}`;

  useEffect(() => {
    setPhase(initialPhase || defaultPhase);
    setWord("");
    setError("");
    setMusicError("");

  }, [lockSignature, defaultPhase, initialPhase]);
  useEffect(() => {
    setMusicMuted(Boolean(canonicalMusic?.startMuted));
    setMusicVolume(Math.min(100, Math.max(0, canonicalMusic?.volume ?? 60)));
  }, [canonicalMusic?.startMuted, canonicalMusic?.volume]);
  useEffect(() => {
    if (!uploadedMusic) {
      uploadedAudio.current = null;
      return;
    }
    setMusicPlaying(false);
    const audio = new Audio();
    audio.preload = "none";
    audio.src = uploadedMusic.previewUrl;
    audio.loop = canonicalMusic?.loop ?? true;
    audio.muted = Boolean(canonicalMusic?.startMuted);
    audio.volume = Math.min(1, Math.max(0, (canonicalMusic?.volume ?? 60) / 100));
    uploadedAudio.current = audio;
    const onPlay = () => {
      if (suspendedRef.current) { audio.pause(); return; }
      setMusicPlaying(true);
      setMusicError("");
      window.dispatchEvent(new Event("tiny-music-duck"));
    };
    const onPause = () => {
      setMusicPlaying(false);
      window.dispatchEvent(new Event("tiny-music-unduck"));
    };
    const onError = () => {
      setMusicPlaying(false);
      setMusicError("Music could not play. Try again.");
      window.dispatchEvent(new Event("tiny-music-unduck"));
    };
    audio.addEventListener("play", onPlay);
    audio.addEventListener("pause", onPause);
    audio.addEventListener("error", onError);
    const unbindExclusivePreview = bindExclusiveAudioPreview(
      audio,
      `recipient-audio-${previewOwner}`,
    );
    return () => {
      audio.removeEventListener("play", onPlay);
      audio.removeEventListener("pause", onPause);
      audio.removeEventListener("error", onError);
      unbindExclusivePreview();
      audio.pause();
      uploadedAudio.current = null;
      window.dispatchEvent(new Event("tiny-music-unduck"));
    };
  }, [
    canonicalMusic?.loop,
    canonicalMusic?.startMuted,
    canonicalMusic?.volume,
    uploadedMusic,
    previewOwner,
  ]);
  useEffect(() => {
    const audio = uploadedAudio.current;
    if (audio) audio.muted = musicMuted;
  }, [musicMuted]);
  useEffect(() => {
    const audio = uploadedAudio.current;
    if (audio) audio.volume = musicVolume / 100;
  }, [musicVolume]);
  useEffect(() => {
    // Backgrounding the app (native) or hiding the tab (web) should pause
    // the recipient's surprise audio, not just the decorative site ambience
    // (tiny-music-duck/unduck) — and resume should only restart it if it was
    // actually playing before, not force it back on.
    const wasPlaying = { current: false };
    const pause = () => {
      const audio = uploadedAudio.current;
      if (!audio || audio.paused) return;
      wasPlaying.current = true;
      audio.pause();
      window.dispatchEvent(new Event("tiny-music-unduck"));
    };
    const resume = () => {
      const audio = uploadedAudio.current;
      if (!audio || !wasPlaying.current || suspendedRef.current) return;
      wasPlaying.current = false;
      void audio
        .play()
        .then(() => {
          window.dispatchEvent(new Event("tiny-music-duck"));
        })
        .catch(() => setMusicError("Music could not play. Try again."));
    };
    const onVisibility = () => (document.hidden ? pause() : resume());
    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("tiny-app-pause", pause);
    window.addEventListener("tiny-app-resume", resume);
    return () => {
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("tiny-app-pause", pause);
      window.removeEventListener("tiny-app-resume", resume);
    };
  }, []);
  useEffect(() => {
    if (phase !== "opening") return;
    if (reduceMotion) {
      setPhase("experience");
      return;
    }
    const timer = window.setTimeout(
      () => setPhase("experience"),
      950,
    );
    return () => window.clearTimeout(timer);
  }, [phase, reduceMotion]);

  useEffect(() => {
    const syncVisibility = () =>
      document.documentElement.classList.toggle(
        "recipient-effects-paused",
        document.hidden,
      );
    syncVisibility();
    document.addEventListener("visibilitychange", syncVisibility);
    return () => {
      document.removeEventListener("visibilitychange", syncVisibility);
      document.documentElement.classList.remove("recipient-effects-paused");
    };
  }, []);

  const visual = useMemo(() => appearanceVisual(data.appearance), [data.appearance]);
  const theme = visual;
  const coverPhotoUrl = normalizeRenderableImageUrl(
    data.delight?.coverPhoto?.previewUrl,
  );
  const panelStyle = useMemo(
    () => ({
      background: visual.tokens.elevatedSurface,
      borderColor: visual.tokens.border,
      color: visual.tokens.elevatedSurfaceForeground,
      fontFamily: visual.font,
      "--foreground": visual.tokens.elevatedSurfaceForeground,
      "--muted-foreground": visual.tokens.elevatedSurfaceMutedForeground,
      "--card-foreground": visual.tokens.elevatedSurfaceForeground,
      "--popover-foreground": visual.tokens.elevatedSurfaceForeground,
    }) as React.CSSProperties,
    [visual],
  );
  const experienceStyle = useMemo(
    () =>
      ({
        background: visual.treatment,
        color: visual.tokens.foreground,
        fontFamily: visual.font,
        colorScheme: visual.dark ? "dark" : "light",
        // Shared semantic utilities inside the preview resolve to the
        // recipient's selected appearance, never the creator shell.
        "--background": visual.tokens.canvas,
        "--foreground": visual.tokens.foreground,
        "--card": visual.tokens.surface,
        "--card-foreground": visual.tokens.surfaceForeground,
        "--popover": visual.tokens.elevatedSurface,
        "--popover-foreground": visual.tokens.elevatedSurfaceForeground,
        "--primary": visual.primary,
        "--primary-foreground": visual.tokens.primaryForeground,
        "--secondary": `color-mix(in srgb, ${visual.tokens.canvas} 82%, ${visual.primary})`,
        "--secondary-foreground": visual.tokens.secondaryForeground,
        "--muted": `color-mix(in srgb, ${visual.tokens.canvas} 78%, ${visual.accent})`,
        "--muted-foreground": visual.tokens.mutedSurfaceForeground,
        "--accent": visual.tokens.accent,
        "--accent-foreground": visual.tokens.accentForeground,
        "--success": visual.primary,
        "--warning": visual.accent,
        "--error": visual.primary,
        "--border": visual.tokens.border,
        "--input": `color-mix(in srgb, ${visual.tokens.canvas} 90%, ${visual.primary})`,
        "--ring": visual.tokens.focus,
        "--experience-canvas": visual.tokens.canvas,
        "--experience-foreground": visual.tokens.foreground,
        "--experience-muted": visual.tokens.mutedForeground,
        "--experience-surface": visual.tokens.surface,
        "--experience-surface-foreground": visual.tokens.surfaceForeground,
        "--experience-surface-muted": visual.tokens.surfaceMutedForeground,
        "--experience-surface-elevated": visual.tokens.elevatedSurface,
        "--experience-surface-elevated-foreground": visual.tokens.elevatedSurfaceForeground,
        "--experience-surface-elevated-muted": visual.tokens.elevatedSurfaceMutedForeground,
        "--experience-border": visual.tokens.border,
        "--experience-overlay": visual.tokens.overlay,
        "--experience-accent": visual.tokens.accent,
        "--experience-focus": visual.tokens.focus,
        "--experience-primary-foreground": visual.tokens.primaryForeground,
        "--experience-accent-foreground": visual.tokens.accentForeground,
      }) as React.CSSProperties,
    [visual],
  );
  const beginOpening = () => {
    setMusicError("");
    if (uploadedAudio.current) void uploadedAudio.current.play().catch(() => setMusicError("Music could not play. Try again."));
    setPhase("opening");
  };
  const playMusic = () => { void uploadedAudio.current?.play().catch(() => setMusicError("This audio could not play. Try again.")); };
  const toggleRecipientMusic = () => { const audio = uploadedAudio.current; if (audio?.paused) playMusic(); else audio?.pause(); };
  const toggleRecipientMute = () => setMusicMuted(value => !value);
  const changeRecipientVolume = (volume: number) => setMusicVolume(Math.min(100, Math.max(0, volume)));
  const restartRecipientMusic = () => { if (uploadedAudio.current) uploadedAudio.current.currentTime = 0; };
  const retryRecipientMusic = () => { setMusicError(""); uploadedAudio.current?.load(); playMusic(); };
  const tryAnswer = (value: string) => {
    if (!value.trim()) {
      setError(usesChoices ? "Choose an answer first." : "Type the shared answer first.");
      if (!usesChoices) secretInputRef.current?.focus();
      return false;
    }
    if (accepted.includes(normalize(value))) {
      setError("");
      setPhase(hasStartGate ? "cover" : "opening");
      return true;
    } else {
      setError(
        usesChoices
          ? "That wasn't the key. Try another choice."
          : "That answer did not turn the key. Capitalization and extra spaces do not matter.",
      );
      if (!usesChoices) secretInputRef.current?.focus();
      return false;
    }
  };
  const unlock = (event: React.FormEvent) => {
    event.preventDefault();
    tryAnswer(word);
  };

  const contentStyle = { ...experienceStyle, background: "transparent" };
  const renderPhase = () => {
  if (phase === "locked")
    return (
      <div
        className={`recipient-preview-surface recipient-secret-gate recipient-preview-centered relative z-10 text-center ${resolvedPresentationMode === "viewport" ? "recipient-preview-centered--viewport" : ""}`}
        style={contentStyle}
        data-recipient-motion={motionMode}
      >
        <div className="recipient-secret-gate__inner recipient-preview-centered__inner relative z-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 18, scale: 0.97 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          className="recipient-surface-elevated w-full max-w-md min-w-0 rounded-[2.25rem] border bg-[var(--experience-surface-elevated)] p-6 shadow-xl @[640px]/recipient-preview:p-7"
          style={panelStyle}
        >
          <div className="relative mx-auto mb-4 flex h-24 w-24 items-center justify-center @[640px]/recipient-preview:h-28 @[640px]/recipient-preview:w-28">
            <motion.div className="absolute inset-0">
              <Heart
                className="h-full w-full fill-current"
                style={{ color: `${theme.primary}33` }}
              />
            </motion.div>
            <LockKeyhole
              className="relative h-9 w-9"
              style={{ color: theme.primary }}
            />
            <KeyRound
              className="absolute -bottom-1 -right-1 h-9 w-9 -rotate-12"
              style={{ color: theme.primary }}
            />
          </div>
          <p
            className="text-xs font-bold uppercase tracking-[.18em]"
            style={{ color: theme.primary }}
          >
            A tiny locket for {data.basics.recipientName}
          </p>
          <h1 className="mt-3 break-words text-2xl font-semibold [overflow-wrap:anywhere]">
            {data.delight?.passphraseQuestion || "What is our little secret?"}
          </h1>
          {usesChoices ? (
            <div className="mt-5 grid gap-2 text-left">
              {secretChoices.map((choice, index) => (
                <Button
                  key={`${choice}-${index}`}
                  type="button"
                  variant="outline"
                  className="recipient-secret-choice min-h-12 h-auto justify-start whitespace-normal py-3 text-left"
                  style={{
                    background: visual.tokens.elevatedSurface,
                    borderColor: visual.tokens.border,
                    color: visual.tokens.elevatedSurfaceForeground,
                  }}
                  onClick={() => tryAnswer(choice)}
                >
                  <span
                    className="mr-2 grid h-6 w-6 shrink-0 place-items-center rounded-full text-xs font-bold"
                    style={{
                      background: visual.accent,
                      color: visual.tokens.accentForeground,
                    }}
                    aria-hidden="true"
                  >
                    {String.fromCharCode(65 + index)}
                  </span>
                  {choice}
                </Button>
              ))}
              {error && (
                <p
                  role="alert"
                  className="recipient-secret-error text-center text-sm"
                  style={{ color: visual.tokens.elevatedSurfaceForeground }}
                >
                  {error}
                </p>
              )}
            </div>
          ) : (
            <form
              className="mt-5 space-y-3 text-left"
              onSubmit={unlock}
              noValidate
            >
              <label htmlFor="preview-secret" className="text-sm font-medium">
                Your answer
              </label>
              <Input
                id="preview-secret"
                ref={secretInputRef}
                autoComplete="off"
                required
                aria-invalid={Boolean(error)}
                aria-describedby={error ? "preview-secret-error" : undefined}
                value={word}
                onChange={(event) => {
                  setWord(event.target.value);
                  if (error) setError("");
                }}
                placeholder="Type the answer..."
              />
              <Button type="submit" className="min-h-12 w-full">
                <KeyRound className="mr-2 h-4 w-4" /> Turn the key
              </Button>
              {error && (
                <p
                  id="preview-secret-error"
                  role="alert"
                  className="text-center text-sm text-[var(--experience-accent)]"
                >
                  {error}
                </p>
              )}
            </form>
          )}
        </motion.div>
        </div>
      </div>
    );

  if (phase === "cover")
    return (
      <div
        className={`recipient-preview-surface recipient-preview-centered relative z-10 min-h-full p-4 pb-[calc(1rem+env(safe-area-inset-bottom))] text-center ${resolvedPresentationMode === "viewport" ? "recipient-preview-centered--viewport" : ""}`}
        style={contentStyle}
        data-recipient-motion={motionMode}
      >
        <div className="recipient-preview-centered__inner relative z-10">
        <motion.div
          initial={reduceMotion ? false : { opacity: 0, y: 20, scale: 0.96 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0, scale: 1 }}
          className="recipient-surface w-full max-w-md min-w-0 rounded-[2rem] border bg-[var(--experience-surface)] p-6 shadow-xl @[640px]/recipient-preview:p-7"
          style={panelStyle}
        >
          {coverPhotoUrl && (
            <div className="mb-5 overflow-hidden rounded-2xl border border-[var(--experience-border)] shadow-lg">
              <PresentationImage
                image={data.delight?.coverPhoto}
                alt="Cover memory"
                aspectRatio="16 / 9"
                frameClassName="max-h-48 w-full bg-transparent"
              />
            </div>
          )}
          <motion.span
            className="mx-auto grid h-16 w-16 place-items-center rounded-[1.4rem] border border-[var(--experience-border)]"
            style={{ background: `${theme.primary}22`, color: theme.primary }}
            initial={reduceMotion ? false : { opacity: 0, y: 6 }}
            animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
            transition={{ duration: reduceMotion ? 0 : 0.2 }}
          >
            <Gift className="h-8 w-8" />
          </motion.span>
          <h1 className="mt-2 break-words text-3xl font-semibold [overflow-wrap:anywhere]">
            {data.basics.recipientName || "someone special"}
          </h1>
          <p className="mt-4 whitespace-pre-wrap break-words text-sm leading-6 opacity-75 [overflow-wrap:anywhere]">
            {data.delight?.coverMessage || data.basics.openingMessage}
          </p>
          {youtube && !uploadedMusic && <ExternalSongLink url={canonicalMusic?.youtubeUrl} />}
          <Button className="mt-7 min-h-12 w-full" onClick={beginOpening}>Start Surprise <Sparkles className="ml-2 h-4 w-4" /></Button>
          {Boolean(canonicalMusic?.file || uploadedMusic) && (
            <p className="mt-3 text-xs opacity-70">
              Your uploaded song starts with the surprise.
            </p>
          )}
        </motion.div>
        </div>
      </div>
    );

  if (phase === "opening")
    return (
      <OpeningMoment
        style={data.delight?.openingStyle || "gentle-fade"}
        background="transparent"
        color={theme.primary}
        motionMode={motionMode}
        reduceMotion={Boolean(reduceMotion)}
        experienceStyle={contentStyle}
        presentationMode={resolvedPresentationMode}
      />
    );
  return (
    <div
      className={`recipient-preview-surface recipient-appearance-scene relative z-10 min-h-full opening-${data.delight?.openingStyle}${fillHeight ? " flex flex-col" : ""}`}
      style={contentStyle}
      data-recipient-motion={motionMode}
    >
      {youtube && !uploadedMusic && <div className="relative z-20 shrink-0 px-4 py-3"><ExternalSongLink url={canonicalMusic?.youtubeUrl} /></div>}
      {uploadedMusic && (
        <div className="relative z-20 flex shrink-0 justify-end px-4 pb-2 pt-3">
          <RecipientMusicControls
            playing={musicPlaying}
            muted={musicMuted}
            volume={musicVolume}
            error={musicError}
            onToggle={toggleRecipientMusic}
            onToggleMute={toggleRecipientMute}
            onVolumeChange={changeRecipientVolume}
            onRestart={restartRecipientMusic}
            onRetry={retryRecipientMusic}
          />
        </div>
      )}
      <div
        className={
          fillHeight
            ? "relative z-10 recipient-appearance-content flex min-h-0 flex-1 flex-col [&>*]:min-h-0 [&>*]:flex-1"
            : "relative z-10 recipient-appearance-content min-h-full"
        }
      >
        {children}
      </div>
    </div>
  );
  };

  // Keep the canvas and photographic backdrop outside animated phases. The
  // bounded screen owns fixed layers; phase transforms cannot crop the canvas.
  return (
    <div
      className={`recipient-preview-surface recipient-preview-frame relative flex min-h-full flex-col${containedClasses}`}
      style={experienceStyle}
      data-recipient-motion={motionMode}
    >
      <AppearanceBackdrop appearance={data.appearance} />
      {renderPhase()}
    </div>
  );
}

function OpeningMoment({
  style,
  background,
  color,
  motionMode,
  reduceMotion,
  experienceStyle,
  presentationMode,
}: {
  style: OpeningStyle;
  background: string;
  color: string;
  motionMode: RecipientMotionMode;
  reduceMotion: boolean;
  experienceStyle: React.CSSProperties;
  presentationMode: "contained" | "viewport" | "builder-compact-preview";
}) {
  const labels: Record<OpeningStyle, string> = {
    "gentle-fade": "A little moment, just for you",
    "gift-unwrap": "Unwrapping your surprise",
    "envelope-reveal": "Opening your little letter",
    "sparkle-pop": "Sprinkling a little magic",
    "cinematic-curtain": "The scene is yours",
    "polaroid-drop": "A favorite moment is developing",
    "heart-bloom": "Let this little love bloom",
    "storybook-turn": "Turning to your first chapter",
  };
  return (
    <div
      role="status"
      aria-live="polite"
      className={`recipient-preview-surface recipient-preview-centered relative z-10 flex min-h-full items-center justify-center p-5 text-center ${presentationMode === "viewport" ? "recipient-preview-centered--viewport" : ""}`}
      style={{ ...experienceStyle, background, color }}
      data-recipient-motion={motionMode}
    >
      <motion.div
        className={`relative z-10 opening-demo-${style} flex flex-col items-center`}
        initial={reduceMotion ? false : { opacity: 0, scale: 0.72, y: 28, rotate: -3 }}
        animate={reduceMotion ? undefined : { opacity: 1, scale: 1, y: 0, rotate: 0 }}
        transition={{
          type: reduceMotion ? "tween" : "spring",
          stiffness: 170,
          damping: 18,
          duration: reduceMotion ? 0 : 1.1,
        }}
      >
        <motion.span
          initial={reduceMotion ? false : { scale: 0.4, rotate: -12 }}
          animate={reduceMotion ? undefined : { scale: 1, rotate: 0 }}
          transition={{
            delay: reduceMotion ? 0 : 0.15,
            type: reduceMotion ? "tween" : "spring",
            stiffness: 220,
            damping: 15,
            duration: reduceMotion ? 0 : undefined,
          }}
        className="recipient-surface-elevated flex h-28 w-28 items-center justify-center rounded-[2.25rem] border border-[var(--experience-border)] bg-[var(--experience-surface-elevated)] shadow-2xl"
        >
          <Heart className="h-16 w-16 fill-current" style={{ color }} />
        </motion.span>
        <h2 className="mt-2 max-w-sm text-2xl font-semibold">
          {labels[style]}
        </h2>
          <span className="mt-6 h-1.5 w-40 overflow-hidden rounded-full bg-[var(--experience-overlay)]/20">
          <span
            className="opening-progress block h-full rounded-full"
            style={{ background: color }}
          />
        </span>
      </motion.div>
    </div>
  );
}
