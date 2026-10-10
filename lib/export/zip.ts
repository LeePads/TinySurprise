export interface ZipEntry {
  name: string;
  data: Uint8Array;
}

// Precomputed once per module load rather than per byte — turns crc32 from
// an 8-shifts-per-byte loop into a single table lookup per byte, which
// matters here since it runs over every byte of every embedded photo/video/
// audio file synchronously (in the worker when available, or on the main
// thread as the fallback).
let crcTable: Uint32Array | undefined;
function getCrcTable(): Uint32Array {
  if (crcTable) return crcTable;
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  crcTable = table;
  return table;
}

function crc32(bytes: Uint8Array) {
  const table = getCrcTable();
  let crc = 0xffffffff;
  for (let i = 0; i < bytes.length; i++) {
    crc = table[(crc ^ bytes[i]) & 0xff] ^ (crc >>> 8);
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

/** Builds an uncompressed (STORE method) ZIP archive from raw entries. */
export function createZipArchive(entries: ZipEntry[]): Uint8Array {
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  for (const entry of entries) {
    const name = new TextEncoder().encode(entry.name);
    const crc = crc32(entry.data);
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
  writeU16(endView, 8, entries.length);
  writeU16(endView, 10, entries.length);
  writeU32(endView, 12, centralSize);
  writeU32(endView, 16, offset);
  writeU16(endView, 20, 0);
  const total =
    localParts.reduce((sum, part) => sum + part.length, 0) +
    centralSize +
    end.length;
  const out = new Uint8Array(total);
  let cursor = 0;
  for (const part of [...localParts, ...centralParts, end]) {
    out.set(part, cursor);
    cursor += part.length;
  }
  return out;
}

/**
 * Reads back a ZIP archive produced by createZipArchive. Only the STORE
 * (uncompressed) method is supported, since that is all this app ever
 * writes — a package built by a real zip tool with DEFLATE entries will be
 * rejected rather than silently misread.
 */
export class ZipTruncatedError extends Error {}

/**
 * Reads back a ZIP archive produced by createZipArchive. Only the STORE
 * (uncompressed) method is supported, since that is all this app ever
 * writes — a package built by a real zip tool with DEFLATE entries will be
 * rejected rather than silently misread.
 *
 * Every byte range read below is bounds-checked against the actual buffer
 * length before use. `Uint8Array.slice`/`subarray` never throw for an
 * out-of-range end — they silently clamp — so without these checks a file
 * that was cut short in transit (a real-world Messenger/chat-app failure
 * mode for large attachments) would silently come back with truncated media
 * bytes instead of a clear "this file is incomplete" error.
 */
export function readZipArchive(bytes: Uint8Array, limits: {
  maxEntries?: number; maxTotalBytes?: number; maxEntryBytes?: (name: string) => number;
} = {}): ZipEntry[] {
  if (bytes.length < 22)
    throw new ZipTruncatedError(
      "This file is too small to be a complete TinySurprise package — it looks like it was cut off while sending.",
    );
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  let eocd = -1;
  const scanFloor = Math.max(0, bytes.length - 22 - 65536);
  for (let i = bytes.length - 22; i >= scanFloor; i--) {
    if (view.getUint32(i, true) === 0x06054b50) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1)
    throw new ZipTruncatedError(
      "This file doesn't look like a complete TinySurprise package. It may have been cut off or altered while it was shared.",
    );
  const count = view.getUint16(eocd + 10, true);
  const centralOffset = view.getUint32(eocd + 16, true);
  const centralSize = view.getUint32(eocd + 12, true);
  if (count > (limits.maxEntries ?? 300)) throw new Error("Too many ZIP entries.");
  if (view.getUint16(eocd + 4, true) || view.getUint16(eocd + 6, true) ||
      view.getUint16(eocd + 8, true) !== count || centralOffset + centralSize !== eocd ||
      eocd + 22 + view.getUint16(eocd + 20, true) !== bytes.length) throw new ZipTruncatedError("Invalid or incomplete ZIP directory.");
  const descriptors: { name: string; start: number; end: number; local: number; crc: number }[] = [];
  let totalBytes = 0;
  let ptr = centralOffset;
  for (let i = 0; i < count; i++) {
    if (ptr + 46 > bytes.length || view.getUint32(ptr, true) !== 0x02014b50)
      throw new ZipTruncatedError(
        "This TinySurprise package's file list is incomplete — it looks like it was cut off while sending.",
      );
    const method = view.getUint16(ptr + 10, true);
    const compSize = view.getUint32(ptr + 20, true);
    const nameLen = view.getUint16(ptr + 28, true);
    const extraLen = view.getUint16(ptr + 30, true);
    const commentLen = view.getUint16(ptr + 32, true);
    const localOffset = view.getUint32(ptr + 42, true);
    if (ptr + 46 + nameLen + extraLen + commentLen > eocd)
      throw new ZipTruncatedError(
        "This TinySurprise package's file list is incomplete — it looks like it was cut off while sending.",
      );
    const name = new TextDecoder().decode(
      bytes.subarray(ptr + 46, ptr + 46 + nameLen),
    );
    if (method !== 0)
      throw new Error(`Unsupported compression in ZIP entry "${name}".`);
    if (localOffset + 30 > centralOffset)
      throw new ZipTruncatedError(
        `"${name}" in this TinySurprise package is incomplete — it looks like it was cut off while sending.`,
      );
    const lNameLen = view.getUint16(localOffset + 26, true);
    const lExtraLen = view.getUint16(localOffset + 28, true);
    const dataStart = localOffset + 30 + lNameLen + lExtraLen;
    if (dataStart + compSize > centralOffset)
      throw new ZipTruncatedError(
        `"${name}" in this TinySurprise package is incomplete — it looks like it was cut off while sending.`,
      );
    if (view.getUint32(localOffset, true) !== 0x04034b50 ||
        view.getUint16(ptr + 8, true) !== 0 || view.getUint16(localOffset + 6, true) !== 0 ||
        view.getUint16(localOffset + 8, true) !== method ||
        view.getUint32(ptr + 24, true) !== compSize ||
        view.getUint32(localOffset + 18, true) !== compSize ||
        view.getUint32(localOffset + 22, true) !== compSize ||
        view.getUint32(localOffset + 14, true) !== view.getUint32(ptr + 16, true) ||
        new TextDecoder().decode(bytes.subarray(localOffset + 30, localOffset + 30 + lNameLen)) !== name)
      throw new Error("Inconsistent ZIP headers.");
    totalBytes += compSize;
    if (compSize > (limits.maxEntryBytes?.(name) ?? 30 * 1024 * 1024) || totalBytes > (limits.maxTotalBytes ?? 30 * 1024 * 1024))
      throw new Error("ZIP payload exceeds the import budget.");
    if (descriptors.some((entry) => localOffset < entry.end && dataStart + compSize > entry.local))
      throw new Error("Overlapping ZIP entries are not supported.");
    descriptors.push({ name, start: dataStart, end: dataStart + compSize, local: localOffset, crc: view.getUint32(ptr + 16, true) });
    ptr += 46 + nameLen + extraLen + commentLen;
  }
  if (ptr !== eocd) throw new ZipTruncatedError("Invalid ZIP directory length.");
  return descriptors.map(({ name, start, end, crc }) => {
    const data = bytes.subarray(start, end);
    if (crc32(data) !== crc) throw new Error("ZIP checksum mismatch.");
    return { name, data: data.slice() };
  });
}
