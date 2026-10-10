/**
 * The creator's own locally-saved profile — display name and default
 * sign-off — so the builder's identity step can prefill "From" instead of
 * asking every single time. Local-first, no account, nothing uploaded.
 * Storage mirrors haptics.ts's localStorage pattern rather than
 * IndexedDB/recipients.ts, since there is exactly one profile, not a list.
 */

import { TEXT_LIMITS } from "./text-limits";

export interface SenderProfile {
  id: string;
  displayName: string;
  defaultSignOff?: string;
  updatedAt: string;
}

const STORAGE_KEY = "tinysurprise-sender-profile";
const PROFILE_ID = "local-sender";

export function readSenderProfile(): SenderProfile | undefined {
  if (typeof window === "undefined") return undefined;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return undefined;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== "object") return undefined;
    const displayName = String(
      (parsed as { displayName?: unknown }).displayName || "",
    ).trim();
    if (!displayName) return undefined;
    const defaultSignOff = (parsed as { defaultSignOff?: unknown }).defaultSignOff;
    return {
      id: PROFILE_ID,
      displayName,
      defaultSignOff:
        typeof defaultSignOff === "string" && defaultSignOff.trim()
          ? defaultSignOff.trim()
          : undefined,
      updatedAt:
        typeof (parsed as { updatedAt?: unknown }).updatedAt === "string"
          ? (parsed as { updatedAt: string }).updatedAt
          : new Date(0).toISOString(),
    };
  } catch {
    return undefined;
  }
}

/**
 * Saving here only updates the reusable profile itself — it never reaches
 * into already-created surprises. Completed/saved creations keep the sender
 * snapshot they were made with (see lib/identity.ts), by design (Section E:
 * "does not retroactively change completed surprises").
 */
export function writeSenderProfile(
  displayName: string,
  defaultSignOff?: string,
): SenderProfile {
  if (displayName.length > TEXT_LIMITS.name || (defaultSignOff?.length || 0) > TEXT_LIMITS.profileSignOff) {
    throw new Error("Use at most 60 character units for your name and default sign-off.");
  }
  const profile: SenderProfile = {
    id: PROFILE_ID,
    displayName: displayName.trim(),
    defaultSignOff: defaultSignOff?.trim() || undefined,
    updatedAt: new Date().toISOString(),
  };
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(profile));
  } catch {
    // Best-effort, same as haptics.ts — a blocked localStorage just means
    // the profile doesn't persist across sessions.
  }
  return profile;
}

export function clearSenderProfile(): void {
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Best-effort.
  }
}
