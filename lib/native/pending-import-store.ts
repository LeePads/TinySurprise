import type { SurpriseData } from "../types";
import type { ImportConflict } from "../creations";
import type { PackageAccessMode } from "../export/tinysurprise-package";

export type PendingImport = { nativeId?: string } & (
  {
      kind: "tinysurprise";
      data: SurpriseData;
      contentHash: string;
      hashVersion: number;
      sourceCreationId?: string;
      exportedAt: string;
      manifestVersion: number;
      accessMode: PackageAccessMode;
      purpose: "surprise" | "draft-backup";
      step: number;
      suggestedName?: string;
      approxBytes: number;
      conflict: ImportConflict;
    }
  | {
      kind: "html";
      path: string;
      name?: string;
    });

// Observable FIFO: each undecided native import retains its own identity.
const pending: PendingImport[] = [];
const listeners = new Set<() => void>();
export function subscribePendingImport(listener: () => void): () => void {
  listeners.add(listener);
  return () => { listeners.delete(listener); };
}

export function setPendingImport(value: PendingImport): void {
  if (value.nativeId && pending.some(item => item.nativeId === value.nativeId)) return;
  if (pending.length >= 3) throw new Error("Finish or discard an open surprise before importing another file.");
  pending.push(value);
  listeners.forEach((listener) => listener());
}

/**
 * Reads the pending import without clearing it, so a distracted recipient who
 * navigates away from /viewer before deciding (interruption, accidental Back)
 * can return to the same import rather than losing it. Call
 * clearPendingImport() explicitly once the user has actually dismissed or
 * saved it.
 */
export function peekPendingImport(): PendingImport | undefined {
  return pending[0];
}

export function clearPendingImport(): void {
  pending.shift();
  listeners.forEach((listener) => listener());
}

/** Release exactly the current native-owned artifact after Save or explicit Discard. */
export async function finishPendingImport(expected: PendingImport): Promise<void> {
  if (pending[0] !== expected) throw new Error("The open import changed. Review it before continuing.");
  if (expected.nativeId) {
    const { TinySurpriseImport } = await import("./tinysurprise-import-plugin");
    await TinySurpriseImport.acknowledgeImport({ id: expected.nativeId });
    // Cleanup is best-effort after acknowledgement; a retained receipt is safer
    // than repeating a committed save. Native artifact IDs are never reused.
    await import("../creations").then(module => module.forgetNativeImportResults(expected.nativeId!)).catch(() => undefined);
  } else if (expected.kind === "html") {
    const { releaseLegacyImportFile } = await import("./temp-files");
    await releaseLegacyImportFile(expected.path);
  }
  if (pending[0] === expected) clearPendingImport();
}

export function pendingImportPaths(): string[] {
  return pending.flatMap(item => item.kind === "html" ? [item.path] : []);
}
