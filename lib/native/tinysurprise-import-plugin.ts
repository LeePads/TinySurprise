import { registerPlugin } from "@capacitor/core";

export interface TinySurpriseImportPayload {
  id?: string;
  path?: string;
  intentToken?: string;
  base64?: string;
  name?: string;
  /** Set instead of base64 when the native side couldn't read the file (too large, permission denied, I/O error). */
  error?: string;
}

export interface TinySurpriseImportPluginApi {
  getPendingImport(): Promise<TinySurpriseImportPayload>;
  getPendingImports(): Promise<{ imports: TinySurpriseImportPayload[] }>;
  acknowledgeImport(options: { id?: string; intentToken?: string }): Promise<void>;
  addListener(
    eventName: "importReceived",
    listenerFunc: (payload: TinySurpriseImportPayload) => void,
  ): Promise<{ remove: () => Promise<void> }>;
}

/** Native (Android) bridge that reports .tinysurprise files opened/shared into the app. */
export const TinySurpriseImport =
  registerPlugin<TinySurpriseImportPluginApi>("TinySurpriseImport");

export function base64ToBlob(base64: string): Blob {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
  return new Blob([bytes]);
}
