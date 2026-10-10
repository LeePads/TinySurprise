/** Accepts every supported generated HTML file, with room for older copies. */
export const MAX_HTML_IMPORT_BYTES = 30 * 1024 * 1024;

export function assertHtmlImportSize(bytes: number): void {
  if (!Number.isFinite(bytes) || bytes < 0 || bytes > MAX_HTML_IMPORT_BYTES) {
    throw new Error("This browser copy is too large to open. Ask for a smaller surprise.");
  }
}

/** Never buffers a complete remote response before checking its actual size. */
export async function readBoundedResponse(
  response: Response,
  limit: number,
  tooLarge: string,
): Promise<Blob> {
  const declared = Number(response.headers.get("content-length"));
  if (Number.isFinite(declared) && declared > limit) throw new Error(tooLarge);
  if (!response.body) throw new Error("This media could not be read. Upload the file instead.");
  const reader = response.body.getReader();
  const parts: Uint8Array<ArrayBuffer>[] = [];
  let total = 0;
  try {
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      total += value.byteLength;
      if (total > limit) throw new Error(tooLarge);
      parts.push(new Uint8Array(value));
    }
    return new Blob(parts, { type: response.headers.get("content-type")?.split(";")[0].trim().toLowerCase() || "" });
  } finally {
    await reader.cancel().catch(() => undefined);
    reader.releaseLock();
  }
}
