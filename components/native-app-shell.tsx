"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import { isNativePlatform } from "@/lib/platform";
import { runBackHandlers } from "@/lib/native/back-handler";
import {
  TinySurpriseImport,
  base64ToBlob,
  type TinySurpriseImportPayload,
} from "@/lib/native/tinysurprise-import-plugin";
import { readTinySurprisePackageDetailed } from "@/lib/export/tinysurprise-package";
import { resolveImportConflict } from "@/lib/creations";
import { setPendingImport, peekPendingImport } from "@/lib/native/pending-import-store";
import { ANDROID_ROOT_PATHS } from "@/components/android-nav-tabs";
import { TINY_SURPRISE_IMPORT_PREFIX } from "@/lib/native/temp-files";
import { MAX_HTML_IMPORT_BYTES, assertHtmlImportSize } from "@/lib/bounded-file-read";
import { disposeDraftMedia } from "@/lib/local-media";
import { classifyImportBlob } from "@/lib/viewer-summary";
import {
  ImportErrorDialog,
  type ImportErrorDetails,
} from "@/components/import-error-dialog";

type NativeImportError = { message: string; details?: ImportErrorDetails; payload?: TinySurpriseImportPayload };
const importErrorIdentity = (value: NativeImportError) =>
  value.payload?.id || value.payload?.intentToken || value.payload?.path || "native-read-error";

/**
 * Mounted once at the app root. No-ops entirely on the web build; on
 * Android it wires hardware back navigation, app lifecycle, status bar
 * styling, and .tinysurprise import handoff — kept out of individual
 * components so native concerns live in one place.
 */
export function NativeAppShell() {
  const router = useRouter();
  const pathname = usePathname();
  const routerRef = useRef(router);
  const pathnameRef = useRef(pathname);
  const importQueue = useRef<Promise<void>>(Promise.resolve());
  const queuedImports = useRef(0);
  const [importError, setImportError] = useState<NativeImportError>();
  const importErrorsRef = useRef<NativeImportError[]>([]);
  const errorBusyRef = useRef(false);
  const [errorBusy, setErrorBusy] = useState(false);
  const nativeIdsRef = useRef(new Set<string>());
  const importErrorRef = useRef<typeof importError>(undefined);
  const reportImportError = useCallback((value: NativeImportError) => {
    const queue = importErrorsRef.current;
    const index = queue.findIndex(item => importErrorIdentity(item) === importErrorIdentity(value));
    if (index < 0) queue.push(value);
    else queue[index] = value;
    importErrorRef.current = queue[0];
    setImportError({ ...queue[0] });
  }, []);
  const removeImportError = useCallback((value: NativeImportError) => {
    importErrorsRef.current = importErrorsRef.current.filter(item => importErrorIdentity(item) !== importErrorIdentity(value));
    importErrorRef.current = importErrorsRef.current[0];
    setImportError(importErrorRef.current);
  }, []);

  useEffect(() => {
    routerRef.current = router;
  }, [router]);
  useEffect(() => {
    pathnameRef.current = pathname;
  }, [pathname]);

  // Marks the document so CSS can target native-only presentation (e.g.
  // hiding the desktop-style scrollbar — see globals.css's `.native-shell`
  // rules) without needing every stylesheet rule to reach for a JS check.
  useEffect(() => {
    if (!isNativePlatform()) return;
    document.documentElement.classList.add("native-shell");
  }, []);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];

    void (async () => {
      // Every step below is independently caught so one failure (e.g. a
      // plugin that isn't linked in this build) can never leave the splash
      // screen stuck on screen or skip registering the other listeners.
      try {
        const [{ App }, statusBarModule, { SplashScreen }] = await Promise.all([
          import("@capacitor/app"),
          import("@capacitor/status-bar").catch(() => null),
          import("@capacitor/splash-screen"),
        ]);
        if (disposed) return;

        if (statusBarModule) {
          const { StatusBar, Style } = statusBarModule;
          const syncStatusBarStyle = () => {
            const dark = document.documentElement.classList.contains("dark");
            void StatusBar.setStyle({ style: dark ? Style.Dark : Style.Light }).catch(
              () => undefined,
            );
          };
          syncStatusBarStyle();
          void StatusBar.setOverlaysWebView({ overlay: false }).catch(
            () => undefined,
          );
          const observer = new MutationObserver(syncStatusBarStyle);
          observer.observe(document.documentElement, {
            attributes: true,
            attributeFilter: ["class"],
          });
          cleanups.push(() => observer.disconnect());
        }

        if (!disposed) {
          const backListener = await App.addListener("backButton", () => {
            if (runBackHandlers()) return;
            const atRoot = ANDROID_ROOT_PATHS.has(pathnameRef.current);
            if (atRoot) void App.exitApp();
            else routerRef.current.back();
          });
          if (disposed) void backListener.remove();
          else cleanups.push(() => void backListener.remove());
        }

        if (!disposed) {
          const pauseListener = await App.addListener("pause", () => {
            window.dispatchEvent(new Event("tiny-music-duck"));
            // Distinct from tiny-music-duck (which only tells the
            // decorative site ambience to yield) — this tells the actual
            // recipient/preview surprise audio and YouTube playback to
            // stop while the app is backgrounded.
            window.dispatchEvent(new Event("tiny-app-pause"));
          });
          if (disposed) void pauseListener.remove();
          else cleanups.push(() => void pauseListener.remove());
        }

        if (!disposed) {
          const resumeListener = await App.addListener("resume", () => {
            window.dispatchEvent(new Event("tiny-music-unduck"));
            window.dispatchEvent(new Event("tiny-app-resume"));
          });
          if (disposed) void resumeListener.remove();
          else cleanups.push(() => void resumeListener.remove());
        }

        await SplashScreen.hide().catch(() => undefined);
      } catch {
        // Best-effort: still try to clear the splash screen so a plugin
        // failure never leaves the user staring at a frozen launch screen.
        try {
          const { SplashScreen } = await import("@capacitor/splash-screen");
          await SplashScreen.hide().catch(() => undefined);
        } catch {
          // Nothing more we can do without the plugin.
        }
      }
    })();

    return () => {
      disposed = true;
      cleanups.forEach((dispose) => dispose());
    };
  }, []);

  const processPayload = useCallback(async (payload: TinySurpriseImportPayload) => {
    if (!payload) return;
    if (payload.error) {
      if (payload.id) nativeIdsRef.current.delete(payload.id);
      reportImportError({
        message: payload.error,
        payload,
        details: { name: payload.name },
      });
      return;
    }
    if (!payload.base64 && !payload.path) return;
    let blob: Blob | undefined;
    let importedData: import("@/lib/types").SurpriseData | undefined;
    let transferred = false;
    try {
      let base64 = payload.base64;
      if (payload.path) {
        const { Filesystem } = await import("@capacitor/filesystem");
        const stat = await Filesystem.stat({ path: payload.path });
        assertHtmlImportSize(stat.size);
        const result = await Filesystem.readFile({ path: payload.path });
        if (typeof result.data !== "string") throw new Error("This native file could not be read.");
        base64 = result.data;
      }
      if (!base64 || base64.length > Math.ceil(MAX_HTML_IMPORT_BYTES / 3) * 4 + 1024) throw new Error("This file is too large to open.");
      blob = base64ToBlob(base64);
      assertHtmlImportSize(blob.size);
      const kind = await classifyImportBlob(payload.name, blob);
      if (kind === "html") {
        // Keep the received standalone artifact byte-for-byte identical to
        // the FileProvider payload. It is already base64 at this boundary;
        // decoding it to text and encoding it again can change bytes and
        // obscures whether a share transport or the HTML itself is broken.
        const path = payload.path || await writeTempHtmlFile(base64);
        setPendingImport({ kind: "html", path, name: payload.name, nativeId: payload.id });
        transferred = true;
        if (!importErrorRef.current) routerRef.current.push("/viewer?mode=html");
        return;
      }
      const {
        data,
        contentHash,
        hashVersion,
        sourceCreationId,
        exportedAt,
        manifestVersion,
        accessMode,
        purpose, step,
      } = await readTinySurprisePackageDetailed(blob);
      importedData = data;
      const conflict = await resolveImportConflict(contentHash, sourceCreationId);
      setPendingImport({
        kind: "tinysurprise",
        nativeId: payload.id,
        data,
        contentHash,
        hashVersion,
        sourceCreationId,
        exportedAt,
        manifestVersion,
        accessMode,
        purpose, step,
        suggestedName: payload.name,
        approxBytes: blob.size,
        conflict,
      });
      transferred = true;
      if (!importErrorRef.current) routerRef.current.push("/viewer?mode=tinysurprise");
    } catch (error) {
      const technical = error instanceof Error ? error.message : String(error);
      const message =
        error instanceof Error ? error.message : "This file could not be imported.";
      reportImportError({
        message,
        payload,
        details: {
          name: payload.name,
          bytes: blob?.size,
          // Only worth a separate "Details" line when it says something the
          // message above doesn't already say (validation errors are an
          // Error whose .message *is* the technical detail).
          technical: technical === message ? undefined : technical,
        },
      });
    } finally {
      if (!transferred) {
        if (payload.id) nativeIdsRef.current.delete(payload.id);
        if (importedData) disposeDraftMedia(importedData);
      }
    }
  }, [reportImportError]);

  const handlePayload = useCallback((payload: TinySurpriseImportPayload) => {
    if (payload.id && nativeIdsRef.current.has(payload.id)) return Promise.resolve();
    if (queuedImports.current >= 3) {
      reportImportError({ message: "Finish an open surprise before importing another file.", payload });
      return Promise.resolve();
    }
    queuedImports.current += 1;
    if (payload.id) nativeIdsRef.current.add(payload.id);
    importQueue.current = importQueue.current.catch(() => undefined).then(() => processPayload(payload)).finally(() => { queuedImports.current -= 1; });
    return importQueue.current;
  }, [processPayload, reportImportError]);

  const retryImport = useCallback(async () => {
    if (errorBusyRef.current) return;
    const previousError = importErrorRef.current;
    const payload = previousError?.payload;
    errorBusyRef.current = true;
    setErrorBusy(true);
    try {
      if (!payload || payload.error) {
        // Retry the native read, rather than replaying an immutable error payload.
        const result = await TinySurpriseImport.getPendingImports();
        for (const item of result.imports) await handlePayload(item);
        if (previousError && result.imports.length > 0 && (
          payload?.id ? nativeIdsRef.current.has(payload.id) : !result.imports.some(item => item.error && importErrorIdentity({ message: item.error, payload: item }) === importErrorIdentity(previousError))
        )) removeImportError(previousError);
        if (result.imports.length === 0) reportImportError({ message: "This file is no longer available here. Choose it again or ask for a new copy.", payload });
      } else {
        await handlePayload(payload);
        if (previousError && (payload.id ? nativeIdsRef.current.has(payload.id) : importErrorRef.current === previousError && Boolean(peekPendingImport()))) removeImportError(previousError);
      }
      if (!importErrorRef.current && peekPendingImport()) routerRef.current.push("/viewer");
    } catch {
      reportImportError({ message: "Received files could not be reopened. Retry, or choose the file again.", payload });
    } finally {
      errorBusyRef.current = false;
      setErrorBusy(false);
    }
  }, [handlePayload, reportImportError, removeImportError]);

  const dismissImportError = useCallback(async () => {
    if (errorBusyRef.current) return false;
    const currentError = importErrorRef.current;
    if (!currentError) return true;
    const payload = currentError.payload;
    errorBusyRef.current = true;
    setErrorBusy(true);
    try {
      if (payload?.id || payload?.intentToken) await TinySurpriseImport.acknowledgeImport({ id: payload.id, intentToken: payload.intentToken });
      removeImportError(currentError);
      if (payload?.id) nativeIdsRef.current.delete(payload.id);
      if (!importErrorRef.current && peekPendingImport() && pathnameRef.current !== "/viewer") routerRef.current.push("/viewer");
      return true;
    } catch {
      reportImportError({ message: "This received file could not be released. Try closing it again.", payload });
      return false;
    } finally { errorBusyRef.current = false; setErrorBusy(false); }
  }, [reportImportError, removeImportError]);

  const chooseAnotherFile = useCallback(() => {
    void dismissImportError().then(released => { if (released && !importErrorRef.current) routerRef.current.push("/viewer"); });
  }, [dismissImportError]);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let disposed = false;
    let listenerHandle: { remove: () => void } | undefined;
    TinySurpriseImport.getPendingImports()
      .then((result) => {
        if (!disposed) result.imports.forEach(payload => { void handlePayload(payload); });
      })
      .catch(() => { if (!disposed) reportImportError({ message: "Received files could not be reopened. They remain on this device. Try again." }); });
    TinySurpriseImport.addListener("importReceived", (payload) => {
      void handlePayload(payload);
    })
      .then((handle) => {
        if (disposed) void handle.remove();
        else listenerHandle = handle;
      })
      .catch(() => undefined);

    return () => {
      disposed = true;
      listenerHandle?.remove();
    };
  }, [handlePayload, reportImportError]);

  return (
    <ImportErrorDialog
      open={Boolean(importError)}
      busy={errorBusy}
      message={importError?.message || ""}
      details={importError?.details}
      remainingFiles={Math.max(0, importErrorsRef.current.length - 1)}
      onRetry={retryImport}
      onChooseAnother={chooseAnotherFile}
      onClose={() => void dismissImportError()}
    />
  );
}

/** Compatibility path for older bridge payloads; the pending-import owner releases it. */
async function writeTempHtmlFile(base64: string): Promise<string> {
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  const path = `${TINY_SURPRISE_IMPORT_PREFIX}${crypto.randomUUID()}.html`;
  await Filesystem.writeFile({
    path,
    data: base64,
    directory: Directory.Cache,
  });
  const { uri } = await Filesystem.getUri({ path, directory: Directory.Cache });
  return uri;
}
