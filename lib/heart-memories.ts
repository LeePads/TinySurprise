import { createStableId } from './local-media'
import type { HeartItem, LocalImage } from './types'

export const MAX_HEART_MEMORIES = 20
export const CATCH_HEART_VISIBLE_LIMIT = 5

type UnknownRecord = Record<string, unknown>

const isRecord = (value: unknown): value is UnknownRecord =>
  Boolean(value && typeof value === "object" && !Array.isArray(value))

/**
 * Repairs only Catch heart identities that are missing, malformed, or
 * duplicated. Repair names are deterministic so importing the same malformed
 * record produces the same canonical content before it is persisted or
 * hashed. Existing unique IDs are never rewritten and heart order/content is
 * preserved.
 */
export function normalizeCatchHeartIds<T>(content: T): T {
  if (!isRecord(content) || !Array.isArray(content.hearts)) return content

  const used = new Set<string>()
  let changed = false
  const hearts = content.hearts.map((heart, index) => {
    if (!isRecord(heart)) return heart
    const id = typeof heart.id === "string" && heart.id.trim() ? heart.id : undefined
    if (id && !used.has(id)) {
      used.add(id)
      return heart
    }

    changed = true
    const base = `heart-repaired-${index + 1}`
    let repairedId = base
    let suffix = 2
    while (used.has(repairedId)) repairedId = `${base}-${suffix++}`
    used.add(repairedId)
    return { ...heart, id: repairedId }
  })

  return changed ? ({ ...content, hearts } as T) : content
}

/** Batch selection is authoritative: one valid selected photo becomes one memory. */
export function memoriesFromSelectedPhotos(
  current: HeartItem[],
  photos: LocalImage[],
  maximum = MAX_HEART_MEMORIES,
): HeartItem[] {
  return photos.slice(0, maximum).map((photo, index) => ({
    id: current[index]?.id || createStableId('heart'),
    message: current[index]?.message || '',
    photo,
  }))
}

/** Assigns prepared photos without generating identities inside a React updater. */
export function assignPhotosToMemories(
  current: HeartItem[],
  preparedMemories: (HeartItem & { photo: LocalImage })[],
  maximum = MAX_HEART_MEMORIES,
): HeartItem[] {
  if (!preparedMemories.length) return current
  let index = 0
  const hearts = current.map((heart) => {
    if (heart.photo || index >= preparedMemories.length) return heart
    return { ...heart, photo: preparedMemories[index++].photo }
  })
  const remaining = Math.max(0, maximum - hearts.length)
  return [...hearts, ...preparedMemories.slice(index, index + remaining)]
}

export function appendHeartMemory(
  current: HeartItem[],
  maximum = MAX_HEART_MEMORIES,
): HeartItem[] {
  if (current.length >= maximum) return current
  return [...current, { id: createStableId('heart'), message: '' }]
}
