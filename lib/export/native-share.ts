/**
 * Native (Android) counterpart to lib/export/share.ts. The web build keeps
 * using its browser download / Web Share flow untouched — this module is
 * only imported from the Capacitor build path via lib/platform.ts checks.
 */
import { yieldToEventLoop } from "../yield-to-paint";

export type NativeExportOutcome = "shared" | "saved" | "cancelled";

export class NativeShareError extends Error {}

/**
 * Base64-encodes in chunks, yielding to the event loop every few chunks so a
 * 10-30 MB file doesn't block the UI thread for one long uninterrupted
 * stretch — the previous version built one giant binary string and called
 * btoa() on all of it in a single synchronous pass.
 */
async function fileToBase64(file: File): Promise<string> {
  const buffer = await file.arrayBuffer();
  const bytes = new Uint8Array(buffer);
  const chunkSize = 8192;
  const yieldEvery = 256; // ~2 MB of input between yields
  const parts: string[] = [];
  for (let i = 0, chunkIndex = 0; i < bytes.length; i += chunkSize, chunkIndex++) {
    parts.push(String.fromCharCode(...bytes.subarray(i, i + chunkSize)));
    if (chunkIndex % yieldEvery === yieldEvery - 1) await yieldToEventLoop();
  }
  return btoa(parts.join(""));
}

function splitName(name: string): [base: string, ext: string] {
  const dot = name.lastIndexOf(".");
  return dot > 0 ? [name.slice(0, dot), name.slice(dot)] : [name, ""];
}

/**
 * Finds a path in Directory.Documents that doesn't already exist, so a
 * second export with the same recipient/template never silently clobbers
 * the first one. Tries "-2", "-3", … before falling back to a timestamp.
 */
async function uniquePath(
  Filesystem: typeof import("@capacitor/filesystem").Filesystem,
  Directory: typeof import("@capacitor/filesystem").Directory,
  name: string,
): Promise<string> {
  const exists = async (candidate: string) => {
    try {
      await Filesystem.stat({ path: candidate, directory: Directory.Documents });
      return true;
    } catch {
      return false;
    }
  };
  if (!(await exists(name))) return name;
  const [base, ext] = splitName(name);
  for (let i = 2; i <= 20; i++) {
    const candidate = `${base}-${i}${ext}`;
    if (!(await exists(candidate))) return candidate;
  }
  return `${base}-${Date.now()}${ext}`;
}

/**
 * Writes the export to the app's Documents directory. No extra storage
 * permission is required on modern Android — Filesystem's Documents
 * directory is app-scoped external storage, visible to the Files app under
 * the app's own folder.
 */
export async function saveOnNative(file: File): Promise<string> {
  // Native import display names come from an untrusted content provider.
  // Never let a filename become a relative path or URI inside Documents.
  if (!file.name.trim() || file.name === "." || file.name === ".." || /[\\/:\u0000-\u001f]/.test(file.name)) {
    throw new NativeShareError("This filename cannot be saved. Use a filename without folders or special path characters.");
  }
  const { Filesystem, Directory } = await import("@capacitor/filesystem");
  let path: string;
  let base64: string;
  try {
    [path, base64] = await Promise.all([
      uniquePath(Filesystem, Directory, file.name),
      fileToBase64(file),
    ]);
  } catch {
    throw new NativeShareError("This file could not be prepared for saving.");
  }
  let written: { uri: string };
  try {
    written = await Filesystem.writeFile({
      path,
      data: base64,
      directory: Directory.Documents,
      recursive: true,
    });
  } catch {
    throw new NativeShareError(
      "This file could not be saved on your device. Check available storage and try again.",
    );
  }
  if (!written?.uri)
    throw new NativeShareError("This file could not be saved on your device.");
  return written.uri;
}

/** Saves the export, then opens the native share sheet for it. */
export async function saveAndShareOnNative(
  file: File,
  recipientName: string,
): Promise<NativeExportOutcome> {
  const uri = await saveOnNative(file);
  const { Share } = await import("@capacitor/share");
  try {
    await Share.share({
      title: `A TinySurprise for ${recipientName || "you"}`,
      text: "I made a tiny interactive surprise for you.",
      url: uri,
      dialogTitle: "Send your TinySurprise",
    });
    return "shared";
  } catch (error) {
    const message = error instanceof Error ? error.message : "";
    if (/cancel/i.test(message)) return "saved";
    // The file is already safely on disk even if the share sheet itself
    // failed to open (e.g. no share targets installed) — don't lose that.
    throw new NativeShareError(
      "The file was saved, but the share sheet could not be opened. You can find it in the app's Documents folder.",
    );
  }
}

/**
 * Saves the HTML export, then shares it through SurpriseSharePlugin as a
 * generic application/octet-stream attachment rather than text/html.
 * @capacitor/share (used by saveAndShareOnNative above) always derives its
 * Intent MIME type from the file's extension with no way to override it, so
 * a .html file it shares is always typed text/html — and some chat apps
 * never register an ACTION_SEND filter for text/html, so they never appear
 * in the Sharesheet for it (see DECISIONS.md's "Messenger sharing depends
 * on MIME support" entry). The shared bytes and filename are unchanged;
 * only the Sharesheet's own matching is affected.
 */
export async function saveAndShareHtmlOnNative(
  file: File,
  recipientName: string,
): Promise<NativeExportOutcome> {
  const uri = await saveOnNative(file);
  const { SurpriseShare } = await import("../native/surprise-share-plugin");
  try {
    const { cancelled } = await SurpriseShare.shareFile({
      title: `A TinySurprise for ${recipientName || "you"}`,
      text: "I made a tiny interactive surprise for you.",
      path: uri,
      dialogTitle: "Send your TinySurprise",
    });
    return cancelled ? "saved" : "shared";
  } catch {
    // The file is already safely on disk even if the share sheet itself
    // failed to open (e.g. no share targets installed) — don't lose that.
    throw new NativeShareError(
      "The file was saved, but the share sheet could not be opened. You can find it in the app's Documents folder.",
    );
  }
}
