import { registerPlugin } from "@capacitor/core";

export interface SurpriseSharePayload {
  /** The file:// URI of a file this app already wrote to its own export directory. */
  path: string;
  title?: string;
  text?: string;
  dialogTitle?: string;
}

export interface SurpriseShareResult {
  /** True only if the user backed out of the Sharesheet without picking a target. */
  cancelled: boolean;
}

interface SurpriseSharePluginApi {
  shareFile(options: SurpriseSharePayload): Promise<SurpriseShareResult>;
}

/**
 * Native (Android) bridge that shares an already-exported Tiny Surprise HTML
 * file as a generic application/octet-stream attachment instead of
 * text/html, so chat apps with a narrow ACTION_SEND MIME allowlist still
 * offer this app's file in the system Sharesheet. See
 * android/app/src/main/java/com/tinysurprise/app/SurpriseSharePlugin.java.
 */
export const SurpriseShare =
  registerPlugin<SurpriseSharePluginApi>("SurpriseShare");
