export type ShareOutcome = "shared" | "cancelled";

export function createSurpriseFile(htmlBlob: Blob, filename: string): File {
  return new File([htmlBlob], filename, { type: "text/html;charset=utf-8" });
}

export function supportsFileSharing(file: File): boolean {
  if (
    typeof navigator === "undefined" ||
    typeof navigator.share !== "function" ||
    typeof navigator.canShare !== "function"
  )
    return false;
  try {
    return navigator.canShare({ files: [file] });
  } catch {
    return false;
  }
}

export async function shareSurpriseFile(
  file: File,
  recipientName: string,
): Promise<ShareOutcome> {
  if (!supportsFileSharing(file))
    throw new Error(
      "Direct sharing is unavailable in this browser. Download the HTML file instead.",
    );
  try {
    await navigator.share({
      title: `A TinySurprise for ${recipientName || "you"}`,
      text: "I made a tiny interactive surprise for you.",
      files: [file],
    });
    return "shared";
  } catch (error) {
    if (error instanceof DOMException && error.name === "AbortError") {
      // Option A: cancellation keeps the generated result available; only an
      // explicit Download action may save it after the user returns.
      return "cancelled";
    }
    if (
      error instanceof DOMException &&
      ["NotAllowedError", "DataError"].includes(error.name)
    )
      throw new Error(
        "Your device could not share this HTML file. Download it and attach it manually instead.",
      );
    throw new Error(
      "Direct sharing did not finish. Your HTML file is still ready to download.",
    );
  }
}

function crc32(bytes: Uint8Array) {
  let crc = 0xffffffff;
  for (const byte of bytes) {
    crc ^= byte;
    for (let i = 0; i < 8; i++) crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function writeU16(view: DataView, offset: number, value: number) {
  view.setUint16(offset, value, true);
}

function writeU32(view: DataView, offset: number, value: number) {
  view.setUint32(offset, value, true);
}

function localHeader(name: Uint8Array, data: Uint8Array, crc: number) {
  const header = new Uint8Array(30 + name.length);
  const view = new DataView(header.buffer);
  writeU32(view, 0, 0x04034b50);
  writeU16(view, 4, 20);
  writeU16(view, 6, 0);
  writeU16(view, 8, 0);
  writeU16(view, 10, 0);
  // 1980-01-01 is the earliest valid DOS date accepted by ZIP readers.
  writeU16(view, 12, 0x0021);
  writeU32(view, 14, crc);
  writeU32(view, 18, data.length);
  writeU32(view, 22, data.length);
  writeU16(view, 26, name.length);
  writeU16(view, 28, 0);
  header.set(name, 30);
  return header;
}

function centralHeader(
  name: Uint8Array,
  data: Uint8Array,
  crc: number,
  localOffset: number,
) {
  const header = new Uint8Array(46 + name.length);
  const view = new DataView(header.buffer);
  writeU32(view, 0, 0x02014b50);
  writeU16(view, 4, 20);
  writeU16(view, 6, 20);
  writeU16(view, 8, 0);
  writeU16(view, 10, 0);
  writeU16(view, 12, 0);
  writeU16(view, 14, 0x0021);
  writeU32(view, 16, crc);
  writeU32(view, 20, data.length);
  writeU32(view, 24, data.length);
  writeU16(view, 28, name.length);
  writeU16(view, 30, 0);
  writeU16(view, 32, 0);
  writeU16(view, 34, 0);
  writeU16(view, 36, 0);
  writeU32(view, 38, 0);
  writeU32(view, 42, localOffset);
  header.set(name, 46);
  return header;
}

export async function createSurpriseZip(
  file: File,
  recipientName: string,
  /** Base filename (no extension) to reuse instead of re-deriving one from recipientName \u2014 pass the renamed HTML file's base name so the ZIP stays consistent with a user-chosen filename. */
  baseName?: string,
): Promise<File> {
  const html = new Uint8Array(await file.arrayBuffer());
  const note = new TextEncoder().encode(
    "HOW TO OPEN YOUR TINYSURPRISE\r\n\r\n1. Extract this ZIP file.\r\n2. Open the tiny-surprise HTML file inside.\r\n3. If your phone asks which app to use, choose a web browser such as Chrome or Safari.\r\n\r\nThis ZIP is a transport copy of one recipient HTML experience, not an editable backup or Library archive. Keep the HTML file intact when sending it. Photos and uploaded media are included. YouTube and external song links open separately and need internet. Return to the surprise to continue.\r\n",
  );
  const slug =
    (recipientName || "someone-special")
      .trim()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .replace(/[^a-z0-9]+/gi, "-")
      .replace(/^-|-$/g, "")
      .toLowerCase() || "someone-special";
  const base = baseName || `tiny-surprise-for-${slug}`;
  const files = [
    { name: `${base}.html`, data: html },
    { name: "OPEN-ME.txt", data: note },
  ];
  const localParts: BlobPart[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of files) {
    const name = new TextEncoder().encode(entry.name),
      crc = crc32(entry.data);
    const header = localHeader(name, entry.data, crc);
    localParts.push(header, entry.data);
    centralParts.push(centralHeader(name, entry.data, crc, offset));
    offset += header.length + entry.data.length;
  }
  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const end = new Uint8Array(22);
  const endView = new DataView(end.buffer);
  writeU32(endView, 0, 0x06054b50);
  writeU16(endView, 4, 0);
  writeU16(endView, 6, 0);
  writeU16(endView, 8, files.length);
  writeU16(endView, 10, files.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, offset);
  writeU16(endView, 20, 0);
  return new File(
    [...localParts, ...centralParts, end],
    `${base}.zip`,
    { type: "application/zip" },
  );
}
