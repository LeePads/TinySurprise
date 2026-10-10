"use client";

import { useEffect, useRef, useState } from "react";
import { CloudOff, RefreshCw, Sparkles, X } from "lucide-react";
import { requestBuilderExit } from "@/lib/builder-exit";
import { isNativePlatform } from "@/lib/platform";

export function PwaRegister() {
  const [online, setOnline] = useState(true);
  const [waiting, setWaiting] = useState<ServiceWorker | null>(null);
  const [dismissed, setDismissed] = useState(false);
  const refreshing = useRef(false);

  useEffect(() => {
    // Assets are bundled locally in the Android app; a service worker would
    // only fight Capacitor's own asset serving, so skip registration there.
    if (isNativePlatform()) return;
    // Development chunks change during HMR, sometimes at the same URL. Never
    // put a PWA cache between the dev server and its client module graph.
    if (process.env.NODE_ENV !== "production") {
      if ("serviceWorker" in navigator) {
        void (async () => {
          const registrations = await navigator.serviceWorker.getRegistrations();
          await Promise.all(registrations.filter(registration => {
            const worker = registration.active || registration.waiting || registration.installing;
            if (!worker) return false;
            const script = new URL(worker.scriptURL);
            return script.origin === window.location.origin && script.pathname === "/sw.js";
          }).map(registration => registration.unregister()));
          if ("caches" in window) {
            const keys = await caches.keys();
            await Promise.all(keys.filter(key => key.startsWith("tinysurprise-")).map(key => caches.delete(key)));
          }
        })().catch(() => undefined);
      }
      // Unregistration does not release already controlled tabs immediately.
      // Do not reload here: the builder may have unsaved work.
      return;
    }
    setOnline(navigator.onLine);
    const syncOnline = () => setOnline(navigator.onLine);
    window.addEventListener("online", syncOnline);
    window.addEventListener("offline", syncOnline);
    if (!("serviceWorker" in navigator))
      return () => {
        window.removeEventListener("online", syncOnline);
        window.removeEventListener("offline", syncOnline);
      };

    const controllerChanged = () => {
      if (refreshing.current) window.location.reload();
    };
    navigator.serviceWorker.addEventListener(
      "controllerchange",
      controllerChanged,
    );

    void navigator.serviceWorker
      .register("/sw.js", { updateViaCache: "none" })
      .then((registration) => {
        if (registration.waiting && navigator.serviceWorker.controller)
          setWaiting(registration.waiting);
        registration.addEventListener("updatefound", () => {
          const worker = registration.installing;
          worker?.addEventListener("statechange", () => {
            if (
              worker.state === "installed" &&
              navigator.serviceWorker.controller
            ) {
              setDismissed(false);
              setWaiting(worker);
            }
          });
        });
        return registration.update();
      })
      .catch(() => undefined);

    return () => {
      window.removeEventListener("online", syncOnline);
      window.removeEventListener("offline", syncOnline);
      navigator.serviceWorker.removeEventListener(
        "controllerchange",
        controllerChanged,
      );
    };
  }, []);

  const update = () => {
    if (!waiting) return;
    requestBuilderExit(() => {
      refreshing.current = true;
      waiting.postMessage({ type: "SKIP_WAITING" });
    });
  };
  if (online && (!waiting || dismissed)) return null;

  return (
    <aside
      className="fixed bottom-[calc(1rem+env(safe-area-inset-bottom))] left-3 z-[75] max-w-[calc(100vw-6.5rem)] rounded-2xl border bg-card/95 p-3 text-card-foreground shadow-2xl backdrop-blur-xl sm:left-5 sm:max-w-sm"
      role="status"
      aria-live="polite"
    >
      {!online ? (
        <div className="flex items-center gap-2 text-xs font-semibold">
          <CloudOff className="h-4 w-4 shrink-0 text-amber-600" />
          <span>
            You’re offline. Saved pages and your local draft remain available.
          </span>
        </div>
      ) : (
        <div className="flex items-center gap-3">
          <span className="grid h-9 w-9 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <Sparkles className="h-4 w-4" />
          </span>
          <div className="min-w-0">
            <strong className="block text-xs">
              A fresher Tiny Surprise is ready
            </strong>
            <button
              type="button"
              onClick={update}
              className="mt-1 inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-primary px-2.5 text-xs font-bold text-primary-foreground"
            >
              <RefreshCw className="h-3.5 w-3.5" />
              Update now
            </button>
          </div>
          <button
            type="button"
            onClick={() => setDismissed(true)}
            className="grid h-9 w-9 shrink-0 place-items-center rounded-full hover:bg-secondary"
            aria-label="Dismiss update"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      )}
    </aside>
  );
}
