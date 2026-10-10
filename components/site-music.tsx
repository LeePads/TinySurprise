"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { usePathname } from "next/navigation";
import { Music2, Pause, Volume2 } from "lucide-react";
import { isNativePlatform } from "@/lib/platform";
import {
  AUDIO_PREVIEW_START_EVENT,
  claimAudioPreview,
  type AudioPreviewStartDetail,
} from "@/lib/audio-preview";

const MUSIC_PREFERENCE_KEY = "tinysurprise-site-music";
const SITE_MUSIC_VOLUME = 0.28;
const PREVIEW_MUSIC_SLOT_EVENT = "tiny-preview-music-slot-change";

/** Reserve a normal-flow row below preview navigation for the existing player. */
export function SiteMusicPreviewSlot({ fullscreen = false }: { fullscreen?: boolean }) {
  const slotRef = useRef<HTMLDivElement | null>(null);
  const attachSlot = useCallback((node: HTMLDivElement | null) => {
    slotRef.current?.removeAttribute("data-site-music-slot");
    slotRef.current = node;
    node?.setAttribute("data-site-music-slot", fullscreen ? "fullscreen" : "template");
    window.dispatchEvent(new Event(PREVIEW_MUSIC_SLOT_EVENT));
  }, [fullscreen]);

  return <div ref={attachSlot} className="preview-music-slot" />;
}

export function SiteMusicHeaderControl() {
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);

  useEffect(() => {
    const syncState = (event: Event) => {
      const detail = (event as CustomEvent<{ playing?: boolean; blocked?: boolean }>).detail;
      if (!detail) return;
      setPlaying(Boolean(detail.playing));
      setBlocked(Boolean(detail.blocked));
    };
    window.addEventListener("tiny-site-music-state", syncState);
    return () => window.removeEventListener("tiny-site-music-state", syncState);
  }, []);

  const label = blocked ? "Music unavailable right now" : playing ? "Pause music" : "Play music";

  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={playing}
      onClick={() => window.dispatchEvent(new Event("tiny-site-music-toggle-request"))}
      className="flex min-h-12 w-full items-center gap-3 rounded-xl px-3 text-left text-sm font-semibold hover:bg-secondary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-ring/30"
    >
      {blocked ? (
        <Music2 className="h-4 w-4 text-primary" aria-hidden="true" />
      ) : playing ? (
        <Pause className="h-4 w-4 fill-current text-primary" aria-hidden="true" />
      ) : (
        <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
      )}
      <span>Music</span>
    </button>
  );
}

export function SiteMusic() {
  const pathname = usePathname();
  const audioRef = useRef<HTMLAudioElement>(null);
  const siteMusicOwner = `site-music-${useId()}`;
  const enabledRef = useRef(true);
  const resumeWhenVisible = useRef(false);
  const fadeTimer = useRef<number | undefined>(undefined);
  const toggleRef = useRef<() => void>(() => {});
  const [playing, setPlaying] = useState(false);
  const [blocked, setBlocked] = useState(false);
  const [native, setNative] = useState(false);
  const [previewSlot, setPreviewSlot] = useState<HTMLElement | null>(null);

  useEffect(() => {
    // Fullscreen takes precedence over the template page underneath. Slot refs
    // notify on mount/removal; the audio element stays mounted in this player.
    const syncSlot = () => setPreviewSlot(
      document.querySelector<HTMLElement>('[data-site-music-slot="fullscreen"]')
      || document.querySelector<HTMLElement>('[data-site-music-slot="template"]'),
    );
    window.addEventListener(PREVIEW_MUSIC_SLOT_EVENT, syncSlot);
    syncSlot();
    return () => window.removeEventListener(PREVIEW_MUSIC_SLOT_EVENT, syncSlot);
  }, []);
  const inBuilder = pathname.startsWith("/create/");
  const inTemplateDemo = pathname.startsWith("/s/");
  // The Android bottom nav (Home/Templates/My Surprises/Settings) occupies
  // the same corner outside the builder/demo flows, so this button needs to
  // sit above it there instead of colliding with it.
  useEffect(() => setNative(isNativePlatform()), []);
  const clearsBottomNav = native && !inBuilder && !inTemplateDemo;

  const fadeTo = useCallback((target: number, done?: () => void) => {
    const audio = audioRef.current;
    if (!audio) return;
    if (fadeTimer.current) window.clearInterval(fadeTimer.current);
    const start = audio.volume;
    const started = performance.now();
    fadeTimer.current = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - started) / 480);
      audio.volume = start + (target - start) * progress;
      if (progress === 1) {
        window.clearInterval(fadeTimer.current);
        fadeTimer.current = undefined;
        done?.();
      }
    }, 30);
  }, []);

  const play = useCallback(() => {
    const audio = audioRef.current;
    if (!audio) return Promise.resolve();
    claimAudioPreview(siteMusicOwner);
    return audio.play().then(() => {
      setPlaying(true);
      setBlocked(false);
      fadeTo(SITE_MUSIC_VOLUME);
    }).catch((error) => {
      audio.pause();
      setPlaying(false);
      setBlocked(true);
      throw error;
    });
  }, [fadeTo, siteMusicOwner]);

  useEffect(() => {
    const audio = audioRef.current;
    if (!audio) return;
    audio.volume = SITE_MUSIC_VOLUME;
    try {
      enabledRef.current =
        window.localStorage.getItem(MUSIC_PREFERENCE_KEY) !== "off";
    } catch {
      enabledRef.current = true;
    }

    const duck = () => {
      if (!audio.paused) fadeTo(0.035);
    };
    const unduck = () => {
      if (!audio.paused && enabledRef.current) fadeTo(SITE_MUSIC_VOLUME);
    };
    const attempt = () => {
      if (!enabledRef.current || !audio.paused) return;
      void play().catch(() => setBlocked(true));
    };
    const syncVisibility = () => {
      if (document.hidden) {
        resumeWhenVisible.current = !audio.paused && enabledRef.current;
        if (!audio.paused) audio.pause();
      } else if (resumeWhenVisible.current && enabledRef.current) {
        resumeWhenVisible.current = false;
        void play().catch(() => setBlocked(true));
      }
    };
    const pauseForPreview = (event: Event) => {
      const detail = (event as CustomEvent<AudioPreviewStartDetail>).detail;
      if (!detail?.owner || detail.owner === siteMusicOwner) return;
      resumeWhenVisible.current = false;
      if (!audio.paused) audio.pause();
    };
    const saveData = Boolean(
      (
        navigator as Navigator & {
          connection?: { saveData?: boolean };
        }
      ).connection?.saveData,
    );

    window.addEventListener("tiny-music-duck", duck);
    window.addEventListener("tiny-music-unduck", unduck);
    window.addEventListener(AUDIO_PREVIEW_START_EVENT, pauseForPreview);
    window.addEventListener("pointerdown", attempt, { once: true });
    window.addEventListener("keydown", attempt, { once: true });
    document.addEventListener("visibilitychange", syncVisibility);
    if (!saveData) attempt();

    return () => {
      window.removeEventListener("pointerdown", attempt);
      window.removeEventListener("keydown", attempt);
      window.removeEventListener("tiny-music-duck", duck);
      window.removeEventListener("tiny-music-unduck", unduck);
      window.removeEventListener(AUDIO_PREVIEW_START_EVENT, pauseForPreview);
      document.removeEventListener("visibilitychange", syncVisibility);
      if (fadeTimer.current) window.clearInterval(fadeTimer.current);
    };
  }, [fadeTo, play, siteMusicOwner]);

  const toggle = () => {
    const audio = audioRef.current;
    if (!audio) return;
    if (audio.paused) {
      enabledRef.current = true;
      try {
        window.localStorage.setItem(MUSIC_PREFERENCE_KEY, "on");
      } catch {}
      audio.volume = 0;
      void play().catch(() => setBlocked(true));
      return;
    }
    enabledRef.current = false;
    setPlaying(false);
    try {
      window.localStorage.setItem(MUSIC_PREFERENCE_KEY, "off");
    } catch {}
    fadeTo(0, () => {
      audio.pause();
      audio.currentTime = 0;
      audio.volume = SITE_MUSIC_VOLUME;
    });
  };

  // Lets a remote control (the compact music button in the builder's sticky
  // nav) share this same audio instance instead of creating a second one.
  useEffect(() => {
    toggleRef.current = toggle;
  });
  useEffect(() => {
    const remoteToggle = () => toggleRef.current();
    window.addEventListener("tiny-site-music-toggle-request", remoteToggle);
    return () =>
      window.removeEventListener("tiny-site-music-toggle-request", remoteToggle);
  }, []);

  useEffect(() => {
    window.dispatchEvent(
      new CustomEvent("tiny-site-music-state", { detail: { playing, blocked } }),
    );
  }, [playing, blocked]);

  const label = blocked || !playing ? "Play music" : "Pause music";
  const controlVisibility = inTemplateDemo
    ? "hidden"
    : native
    ? inBuilder
      ? "hidden sm:flex"
      : "flex"
    : inBuilder
      ? "hidden"
      : "flex md:hidden";
  const controlPosition = previewSlot
    ? "relative flex min-w-0 max-w-full whitespace-normal"
    : `fixed right-3 z-[70] ${controlVisibility} whitespace-nowrap sm:right-6 lg:right-8 ${inBuilder ? "bottom-[calc(5.7rem+env(safe-area-inset-bottom))]" : clearsBottomNav ? "bottom-[calc(4.75rem+env(safe-area-inset-bottom))]" : "bottom-[calc(1rem+env(safe-area-inset-bottom))] sm:bottom-6 lg:bottom-8"}`;
  const control = (
    <button
      type="button"
      onClick={toggle}
      aria-pressed={playing}
      aria-label={label}
      className={`site-music-control ${controlPosition} min-h-12 items-center gap-2 rounded-full border border-border/70 bg-card/95 px-3 text-xs font-semibold shadow-[var(--shadow-elevated)] backdrop-blur-xl transition hover:-translate-y-0.5 hover:border-primary/30 focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20`}
    >
      <span aria-hidden="true" className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/10">
        {blocked ? (
          <Music2 className="h-4 w-4 text-primary" />
        ) : playing ? (
          <Pause className="h-4 w-4 fill-current text-primary" />
        ) : (
          <Volume2 className="h-4 w-4 text-primary" />
        )}
      </span>
      <span className="min-w-0 [overflow-wrap:anywhere]">{label}</span>
    </button>
  );
  return (
    <>
      <audio
        ref={audioRef}
        src="/background/bg.mp3"
        loop
        preload="none"
        onPlay={() => setPlaying(true)}
        onPause={() => setPlaying(false)}
        onEnded={() => setPlaying(false)}
        onError={() => {
          setPlaying(false);
          setBlocked(true);
        }}
      />
      {previewSlot ? createPortal(control, previewSlot) : control}
    </>
  );
}
