import { isNativePlatform } from "../platform";

export const HAPTICS_STORAGE_KEY = "tinysurprise-haptics";

export function readHapticsPreference(): boolean {
  if (typeof window === "undefined") return true;
  try {
    return window.localStorage.getItem(HAPTICS_STORAGE_KEY) !== "off";
  } catch {
    return true;
  }
}

export function setHapticsPreference(enabled: boolean): void {
  try {
    window.localStorage.setItem(HAPTICS_STORAGE_KEY, enabled ? "on" : "off");
  } catch {
    // Best-effort — a blocked localStorage just means the setting resets next session.
  }
}

type HapticStyle = "light" | "medium" | "heavy" | "selection";

/**
 * Best-effort haptic tap. No-ops on web, when the setting is off, or when
 * @capacitor/haptics isn't linked in this build — never throws, never
 * blocks the caller.
 */
export async function hapticTap(style: HapticStyle = "light"): Promise<void> {
  if (!isNativePlatform() || !readHapticsPreference()) return;
  try {
    if (style === "selection") {
      const { Haptics } = await import("@capacitor/haptics");
      await Haptics.selectionStart();
      await Haptics.selectionChanged();
      await Haptics.selectionEnd();
      return;
    }
    const { Haptics, ImpactStyle } = await import("@capacitor/haptics");
    const impact =
      style === "heavy"
        ? ImpactStyle.Heavy
        : style === "medium"
          ? ImpactStyle.Medium
          : ImpactStyle.Light;
    await Haptics.impact({ style: impact });
  } catch {
    // Plugin not linked — nothing more to do.
  }
}
