type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

/**
 * Repairs only Open When envelope identities that are missing, blank,
 * malformed, or duplicated. Existing unique IDs, order, content, and media
 * are preserved. Repair names are deterministic so a repaired record remains
 * stable across persistence, import, export, and hashing boundaries.
 */
export function normalizeOpenWhenEnvelopeIds<T>(content: T): T {
  if (!isRecord(content) || !Array.isArray(content.envelopes)) return content;

  const used = new Set<string>();
  let changed = false;
  const envelopes = content.envelopes.map((envelope, index) => {
    if (!isRecord(envelope)) return envelope;

    const id =
      typeof envelope.id === "string" && envelope.id.trim()
        ? envelope.id
        : undefined;
    if (id && !used.has(id)) {
      used.add(id);
      return envelope;
    }

    changed = true;
    const base = `envelope-repaired-${index + 1}`;
    let repairedId = base;
    let suffix = 2;
    while (used.has(repairedId)) repairedId = `${base}-${suffix++}`;
    used.add(repairedId);
    return { ...envelope, id: repairedId };
  });

  return changed ? ({ ...content, envelopes } as T) : content;
}
