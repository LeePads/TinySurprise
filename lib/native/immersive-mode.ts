import { registerPlugin } from "@capacitor/core";
import { isNativePlatform } from "../platform";

interface ImmersiveModePlugin {
  enter(): Promise<void>;
  exit(): Promise<void>;
}

const ImmersiveMode = registerPlugin<ImmersiveModePlugin>("ImmersiveMode");

/**
 * Hides the status bar and navigation bar for a true full-screen recipient
 * viewer / creator full-screen preview. Best-effort like haptics.ts — never
 * throws, no-ops on web or if the native plugin isn't available in this
 * build (e.g. a web-only dev server hot-reloading native code changes).
 */
export async function enterImmersiveMode(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await ImmersiveMode.enter();
  } catch {
    // Not fatal — the viewer still works, just without hidden system bars.
  }
}

export async function exitImmersiveMode(): Promise<void> {
  if (!isNativePlatform()) return;
  try {
    await ImmersiveMode.exit();
  } catch {
    // Best-effort restore — if this fails the OS still keeps the app
    // interactive, worst case the bars stay hidden until the next screen
    // that doesn't need immersive mode restores them itself.
  }
}
