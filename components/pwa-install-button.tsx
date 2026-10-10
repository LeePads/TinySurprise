"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Download, MoreVertical, Share, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isNativePlatform } from "@/lib/platform";
import { BrandMark } from "@/components/brand";

interface InstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed"; platform: string }>;
}

const standalone = () =>
  window.matchMedia("(display-mode: standalone)").matches ||
  Boolean((navigator as Navigator & { standalone?: boolean }).standalone);

export function PwaInstallButton() {
  const [promptEvent, setPromptEvent] = useState<InstallPromptEvent | null>(
    null,
  );
  const [installed, setInstalled] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [isIos, setIsIos] = useState(false);
  const closeButton = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    setInstalled(standalone());
    setIsIos(
      /iphone|ipad|ipod/i.test(navigator.userAgent) ||
        (navigator.platform === "MacIntel" && navigator.maxTouchPoints > 1),
    );
    const ready = (event: Event) => {
      event.preventDefault();
      setPromptEvent(event as InstallPromptEvent);
    };
    const complete = () => {
      setInstalled(true);
      setPromptEvent(null);
      setGuideOpen(false);
    };
    window.addEventListener("beforeinstallprompt", ready);
    window.addEventListener("appinstalled", complete);
    return () => {
      window.removeEventListener("beforeinstallprompt", ready);
      window.removeEventListener("appinstalled", complete);
    };
  }, []);

  useEffect(() => {
    if (!guideOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButton.current?.focus();
    const close = (event: KeyboardEvent) =>
      event.key === "Escape" && setGuideOpen(false);
    window.addEventListener("keydown", close);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", close);
    };
  }, [guideOpen]);

  if (isNativePlatform()) return null;

  const install = async () => {
    if (installed) return;
    if (!promptEvent) {
      setGuideOpen(true);
      return;
    }
    await promptEvent.prompt();
    const choice = await promptEvent.userChoice;
    if (choice.outcome === "accepted") setInstalled(true);
    setPromptEvent(null);
  };

  return (
    <>
      <Button
        type="button"
        size="sm"
        variant="outline"
        onClick={() => void install()}
        disabled={installed}
        className="min-h-12 gap-1.5 bg-card px-2.5 shadow-sm sm:px-3"
        aria-label={
          installed ? "Tiny Surprise is installed" : "Install Tiny Surprise app"
        }
      >
        {installed ? (
          <Check className="h-4 w-4 text-primary" />
        ) : (
          <Download className="h-4 w-4 text-primary" />
        )}
        <span className="hidden min-[360px]:inline">
          {installed ? "Installed" : "Install"}
        </span>
      </Button>

      {guideOpen && (
        <div
          className="fixed inset-0 z-[100] grid place-items-center bg-black/60 p-4 backdrop-blur-sm"
          role="presentation"
          onMouseDown={(event) =>
            event.target === event.currentTarget && setGuideOpen(false)
          }
        >
          <section
            role="dialog"
            aria-modal="true"
            aria-labelledby="install-guide-title"
            className="w-full max-w-md rounded-[var(--radius-dialog)] border bg-card p-5 text-card-foreground shadow-2xl sm:p-6"
          >
            <div className="flex items-start justify-between gap-4">
              <div className="flex min-w-0 items-start gap-3">
                <BrandMark decorative className="h-8 w-8 shrink-0" />
                <div>
                  <p className="text-xs font-bold uppercase tracking-[.16em] text-primary">
                    Keep Tiny Surprise close
                  </p>
                  <h2
                    id="install-guide-title"
                    className="mt-1 text-xl font-semibold"
                  >
                    Install the app
                  </h2>
                </div>
              </div>
              <Button
                ref={closeButton}
                type="button"
                size="icon"
                variant="ghost"
                onClick={() => setGuideOpen(false)}
                aria-label="Close install guide"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>
            {isIos ? (
              <div className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
                <p className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                    <Share className="h-4 w-4" />
                  </span>
                  <span>
                    <strong className="block text-foreground">
                      1. Open the Share menu
                    </strong>
                    Tap the Share button in Safari.
                  </span>
                </p>
                <p className="flex gap-3">
                  <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 font-bold text-primary">
                    +
                  </span>
                  <span>
                    <strong className="block text-foreground">
                      2. Add to Home Screen
                    </strong>
                    Scroll down, choose Add to Home Screen, then tap Add.
                  </span>
                </p>
              </div>
            ) : (
              <div className="mt-5 space-y-3 text-sm leading-6 text-muted-foreground">
                <p>
                  The automatic install prompt is not available yet on this
                  browser.
                </p>
                <p className="flex gap-3 rounded-2xl bg-secondary/45 p-3">
                  <MoreVertical className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
                  <span>
                    Open your browser menu and choose{" "}
                    <strong className="text-foreground">
                      Install Tiny Surprise
                    </strong>{" "}
                    or{" "}
                    <strong className="text-foreground">
                      Add to Home Screen
                    </strong>
                    .
                  </span>
                </p>
                <p>
                  On desktop, Chrome and Edge may also show an install icon at
                  the right side of the address bar.
                </p>
              </div>
            )}
            <Button
              type="button"
              className="mt-6 w-full"
              onClick={() => setGuideOpen(false)}
            >
              Got it
            </Button>
          </section>
        </div>
      )}
    </>
  );
}
