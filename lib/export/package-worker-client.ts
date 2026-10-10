import type { PackageWorkerEntryInput, PackageWorkerProgress } from "./package-worker";

export type PackageZipStage = "STARTED" | "PACKING_ENTRIES";
export interface PackageZipProgress {
  stage: PackageZipStage;
  completed?: number;
  total?: number;
}

export class PackageWorkerCancelledError extends Error {
  constructor() { super("Cancelled."); }
}

let workerFailed = false;
let operationCounter = 0;
const WORKER_TIMEOUT_MS = 60_000;

/** A job owns its worker: termination never cancels another export. */
export function createZipInWorker(
  entries: PackageWorkerEntryInput[],
  onProgress?: (progress: PackageZipProgress) => void,
): { result: Promise<ArrayBuffer>; cancel: () => void } | undefined {
  if (workerFailed || typeof Worker === "undefined") return undefined;
  let worker: Worker;
  try {
    worker = new Worker(new URL("./package-worker.ts", import.meta.url), { type: "module" });
  } catch {
    workerFailed = true;
    return undefined;
  }
  const operationId = `zip-${Date.now()}-${++operationCounter}`;
  let cancel = () => {};
  const result = new Promise<ArrayBuffer>((resolve, reject) => {
    let settled = false;
    let timeout: ReturnType<typeof setTimeout>;
    const cleanup = () => {
      clearTimeout(timeout);
      worker.removeEventListener("message", handleMessage);
      worker.removeEventListener("error", handleFailure);
      worker.removeEventListener("messageerror", handleFailure);
      worker.terminate();
    };
    const fail = (error: Error) => {
      if (settled) return;
      settled = true;
      if (!(error instanceof PackageWorkerCancelledError)) workerFailed = true;
      cleanup();
      reject(error);
    };
    const handleFailure = () => fail(new Error("File preparation was interrupted."));
    const handleMessage = (event: MessageEvent<PackageWorkerProgress>) => {
      if (settled || event.data?.operationId !== operationId) return;
      const message = event.data;
      try {
        switch (message.type) {
          case "STARTED": onProgress?.({ stage: "STARTED" }); break;
          case "PACKING_ENTRIES":
            onProgress?.({ stage: "PACKING_ENTRIES", completed: message.completed, total: message.total });
            break;
          case "COMPLETED":
            if (!(message.zipBuffer instanceof ArrayBuffer)) { handleFailure(); break; }
            settled = true;
            cleanup();
            resolve(message.zipBuffer);
            break;
          case "FAILED": fail(new Error(message.message)); break;
        }
      } catch { handleFailure(); }
    };
    // Termination interrupts even synchronous CRC/packing work. This error
    // is recognized by the caller and must never trigger fallback.
    cancel = () => fail(new PackageWorkerCancelledError());
    worker.addEventListener("message", handleMessage);
    worker.addEventListener("error", handleFailure);
    worker.addEventListener("messageerror", handleFailure);
    timeout = setTimeout(() => fail(new Error("File preparation took too long.")), WORKER_TIMEOUT_MS);
    try {
      worker.postMessage({ type: "CREATE_ZIP", operationId, entries }, entries.map(entry => entry.buffer));
    } catch { handleFailure(); }
  });
  return { result, cancel: () => cancel() };
}
