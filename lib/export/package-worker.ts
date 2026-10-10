/// <reference lib="webworker" />
/**
 * Off-main-thread ZIP byte assembly for .tinysurprise packages. Hashing
 * (crypto.subtle.digest) is already effectively non-blocking on the main
 * thread — real browsers/WebViews implement it off the JS thread — so the
 * one piece of this pipeline that's genuinely synchronous, CPU-bound JS work
 * scaling with package size is createZipArchive's CRC32 + byte-packing over
 * every media file. That's the only thing this worker does; canonical
 * serialization and content hashing stay on the main thread in
 * tinysurprise-package.ts, unchanged.
 *
 * Only ever receives already-extracted bytes — never a File, Blob, or DOM
 * reference, so this file has no dependency on `window`.
 */
import { createZipArchive, type ZipEntry } from "./zip";

export interface PackageWorkerEntryInput {
  name: string;
  buffer: ArrayBuffer;
}

export type PackageWorkerRequest = {
  type: "CREATE_ZIP";
  operationId: string;
  entries: PackageWorkerEntryInput[];
};

export type PackageWorkerProgress =
  | { type: "STARTED"; operationId: string }
  | {
      type: "PACKING_ENTRIES";
      operationId: string;
      completed: number;
      total: number;
    }
  | { type: "COMPLETED"; operationId: string; zipBuffer: ArrayBuffer }
  | { type: "FAILED"; operationId: string; message: string };

function createZip(
  request: Extract<PackageWorkerRequest, { type: "CREATE_ZIP" }>,
) {
  const { operationId } = request;
  const post = (message: PackageWorkerProgress) =>
    (self as unknown as Worker).postMessage(message);
  post({ type: "STARTED", operationId });
  try {
    const entries: ZipEntry[] = [];
    for (let i = 0; i < request.entries.length; i++) {
      const item = request.entries[i];
      entries.push({ name: item.name, data: new Uint8Array(item.buffer) });
      post({
        type: "PACKING_ENTRIES",
        operationId,
        completed: i + 1,
        total: request.entries.length,
      });
    }
    const zipBytes = createZipArchive(entries);
    const zipBuffer = zipBytes.buffer.slice(
      zipBytes.byteOffset,
      zipBytes.byteOffset + zipBytes.byteLength,
    ) as ArrayBuffer;
    post({ type: "COMPLETED", operationId, zipBuffer });
  } catch (error) {
    post({
      type: "FAILED",
      operationId,
      message: error instanceof Error ? error.message : "ZIP assembly failed.",
    });
  }
}

self.addEventListener("message", (event: MessageEvent<PackageWorkerRequest>) => {
  const request = event.data;
  // Cancellation belongs to the client, which terminates this job's worker.
  if (request.type === "CREATE_ZIP") createZip(request);
});
