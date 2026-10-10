type UnknownRecord = Record<string, unknown>;

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value));

function repairId(
  base: string,
  reserved: Set<string>,
  used: Set<string>,
): string {
  let candidate = base;
  let suffix = 2;
  while (reserved.has(candidate) || used.has(candidate)) {
    candidate = `${base}-${suffix++}`;
  }
  used.add(candidate);
  return candidate;
}

function normalizeFlatIds(
  items: unknown[],
  getBase: (index: number) => string,
): { items: unknown[]; changed: boolean } {
  const reserved = new Set(
    items.flatMap((item) => {
      const id = isRecord(item) && typeof item.id === "string" ? item.id.trim() : "";
      return id ? [id] : [];
    }),
  );
  const seen = new Set<string>();
  const used = new Set<string>();
  let changed = false;

  const normalized = items.map((item, index) => {
    if (!isRecord(item)) return item;
    const id = typeof item.id === "string" && item.id.trim() ? item.id : undefined;
    if (id && !seen.has(id) && !used.has(id)) {
      seen.add(id);
      used.add(id);
      return item;
    }

    if (id) seen.add(id);
    changed = true;
    return { ...item, id: repairId(getBase(index), reserved, used) };
  });

  return { items: normalized, changed };
}

/**
 * Repairs Choose Our Date round and choice identities conservatively.
 *
 * Round IDs and choice IDs are globally unique because choice IDs are used in
 * builder DOM/ARIA identifiers as well as recipient selection. Existing first
 * occurrences and all unique IDs are preserved; only blank, missing, or
 * duplicate IDs receive deterministic replacements. The original order and
 * every non-identity field remain unchanged.
 */
export function normalizeChooseOurDateIds<T>(content: T): T {
  if (!isRecord(content) || !Array.isArray(content.rounds)) return content;

  const normalizedRounds = normalizeFlatIds(
    content.rounds,
    (index) => `date-round-repaired-${index + 1}`,
  );
  const choiceReserved = new Set<string>();
  const choiceItems = normalizedRounds.items.map((round) => {
    if (!isRecord(round) || !Array.isArray(round.options)) return [];
    return round.options;
  });
  choiceItems.flat().forEach((option) => {
    if (!isRecord(option)) return;
    const id = typeof option.id === "string" ? option.id.trim() : "";
    if (id) choiceReserved.add(id);
  });

  const choiceSeen = new Set<string>();
  const choiceUsed = new Set<string>();
  let choicesChanged = false;
  const rounds = normalizedRounds.items.map((round, roundIndex) => {
    if (!isRecord(round) || !Array.isArray(round.options)) return round;
    const options = round.options.map((option, optionIndex) => {
      if (!isRecord(option)) return option;
      const id =
        typeof option.id === "string" && option.id.trim()
          ? option.id
          : undefined;
      if (id && !choiceSeen.has(id) && !choiceUsed.has(id)) {
        choiceSeen.add(id);
        choiceUsed.add(id);
        return option;
      }

      if (id) choiceSeen.add(id);
      choicesChanged = true;
      return {
        ...option,
        id: repairId(
          `date-choice-repaired-${roundIndex + 1}-${optionIndex + 1}`,
          choiceReserved,
          choiceUsed,
        ),
      };
    });
    return options === round.options ? round : { ...round, options };
  });

  if (!normalizedRounds.changed && !choicesChanged) return content;
  return { ...content, rounds } as T;
}
