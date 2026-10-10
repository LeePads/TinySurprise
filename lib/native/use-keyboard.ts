"use client";

import { useEffect, useState } from "react";
import { isNativePlatform } from "../platform";

export interface KeyboardState {
  visible: boolean;
  height: number;
}

const IDLE: KeyboardState = { visible: false, height: 0 };
// Below this diff, treat visualViewport shrinkage as browser chrome
// (address bar hide/show), not a keyboard.
const VISUAL_VIEWPORT_THRESHOLD = 80;

/**
 * Reports on-screen keyboard visibility/height.
 *
 * Root-cause fix: this used to be native XOR web — on native it trusted
 * @capacitor/keyboard events exclusively and never fell back to
 * visualViewport at all. On a real device those events can simply not fire
 * for a given IME/OS combination (observed: the Appearance preview never
 * auto-collapsed for SwiftKey), silently stranding every consumer at IDLE
 * forever with no fallback. Now both signals run simultaneously on native —
 * whichever reports the keyboard open first wins, and both must clear for
 * the state to go idle again — so a flaky plugin event no longer means dead
 * keyboard detection.
 *
 * This hook is called from multiple components at once (builder page +
 * step components), each getting its own independent state — fine for a
 * read-only signal, but that's exactly why nothing in here ever mutates
 * shared/global state (e.g. document-level styles): with several instances
 * subscribed simultaneously there'd be no single owner to safely restore
 * it. Callers that need a page-level side effect (scroll-padding, etc.)
 * should own that themselves, keyed off the value this hook returns.
 */
export function useKeyboard(): KeyboardState {
  const [capacitorState, setCapacitorState] = useState<KeyboardState>(IDLE);
  const [viewportState, setViewportState] = useState<KeyboardState>(IDLE);

  useEffect(() => {
    if (!isNativePlatform()) return;
    let disposed = false;
    const cleanups: Array<() => void> = [];
    void (async () => {
      try {
        const { Keyboard } = await import("@capacitor/keyboard");
        const onShow = (info: { keyboardHeight: number }) => {
          if (!disposed) setCapacitorState({ visible: true, height: info.keyboardHeight });
        };
        const onHide = () => {
          if (!disposed) setCapacitorState(IDLE);
        };
        const showListener = await Keyboard.addListener("keyboardWillShow", onShow);
        const showListener2 = await Keyboard.addListener("keyboardDidShow", onShow);
        const hideListener = await Keyboard.addListener("keyboardWillHide", onHide);
        const hideListener2 = await Keyboard.addListener("keyboardDidHide", onHide);
        if (disposed) {
          void showListener.remove();
          void showListener2.remove();
          void hideListener.remove();
          void hideListener2.remove();
        } else {
          cleanups.push(
            () => void showListener.remove(),
            () => void showListener2.remove(),
            () => void hideListener.remove(),
            () => void hideListener2.remove(),
          );
        }
      } catch {
        // Plugin not linked in this build — visualViewport below still covers it.
      }
    })();
    return () => {
      disposed = true;
      cleanups.forEach((dispose) => dispose());
    };
  }, []);

  // Runs on native AND web — on native this is the redundant, structurally
  // reliable signal (adjustResize genuinely shrinks the WebView's visual
  // viewport), not just a web-only fallback.
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) return;
    const sync = () => {
      const diff = window.innerHeight - viewport.height;
      setViewportState(
        diff > VISUAL_VIEWPORT_THRESHOLD ? { visible: true, height: diff } : IDLE,
      );
    };
    sync();
    viewport.addEventListener("resize", sync);
    return () => viewport.removeEventListener("resize", sync);
  }, []);

  const visible = capacitorState.visible || viewportState.visible;
  const height = Math.max(capacitorState.height, viewportState.height);

  return visible ? { visible: true, height } : IDLE;
}
