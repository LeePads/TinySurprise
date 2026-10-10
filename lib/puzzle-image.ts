import { createStableId } from './local-media'
import { normalizeImagePresentation } from './image-presentation'
import type { ImagePresentation, LocalImage } from './types'

export interface ImageRect { x: number; y: number; width: number; height: number }

export interface PuzzleTileImageStyle {
  position: 'absolute'
  display: 'block'
  width: string
  height: string
  left: string
  top: string
  maxWidth: 'none'
  maxHeight: 'none'
  pointerEvents: 'none'
  objectFit: 'contain' | 'cover'
  objectPosition: string
  transform: string
  transformOrigin: string
}

export interface PuzzleBackdropStyle {
  backgroundSize: 'cover'
  backgroundPosition: string
  transform: 'scale(1.12)'
}

/**
 * The quiet, full-bleed layer behind the square puzzle canvas. Fit keeps the
 * complete image in the foreground while this layer fills the letterbox with
 * the same photo, so every presentation still begins from one square frame.
 */
export function puzzleBackdropStyle(
  value?: Partial<ImagePresentation> | null,
): PuzzleBackdropStyle {
  const presentation = normalizeImagePresentation(value)
  return {
    backgroundSize: 'cover',
    backgroundPosition: `${presentation.focalX * 100}% ${presentation.focalY * 100}%`,
    transform: 'scale(1.12)',
  }
}

/**
 * Positions one presentation-aware image frame inside a puzzle tile.
 *
 * The frame is the size of the complete square puzzle board, while each tile
 * clips the frame to its own cell. That keeps FIT letterboxing, FILL cropping,
 * and CUSTOM focal/zoom behavior identical to PresentationImage without
 * requiring source dimensions or stretching the source into a square.
 */
export function puzzleTileImageStyle(
  gridSize: number,
  sourceIndex: number,
  value?: Partial<ImagePresentation> | null,
): PuzzleTileImageStyle {
  const presentation = normalizeImagePresentation(value)
  const sourceRow = Math.floor(sourceIndex / gridSize)
  const sourceCol = sourceIndex % gridSize
  return {
    position: 'absolute',
    display: 'block',
    width: `${gridSize * 100}%`,
    height: `${gridSize * 100}%`,
    left: `${-sourceCol * 100}%`,
    top: `${-sourceRow * 100}%`,
    maxWidth: 'none',
    maxHeight: 'none',
    pointerEvents: 'none',
    objectFit: presentation.mode === 'fit' ? 'contain' : 'cover',
    objectPosition: `${presentation.focalX * 100}% ${presentation.focalY * 100}%`,
    transform:
      presentation.mode === 'custom'
        ? `scale(${presentation.zoom})`
        : 'scale(1)',
    transformOrigin: `${presentation.focalX * 100}% ${presentation.focalY * 100}%`,
  }
}

/** Maps the React puzzle's non-empty tile value to its source grid section. */
export function puzzleTileSourceIndex(tileNumber: number): number {
  // Tile zero intentionally leaves the top-left image section empty.
  return Math.max(0, tileNumber)
}

export function calculateImageRect(width: number, height: number, size: number, fit: 'contain' | 'cover' = 'contain'): ImageRect {
  const scale = fit === 'contain' ? Math.min(size / width, size / height) : Math.max(size / width, size / height)
  const renderedWidth = width * scale
  const renderedHeight = height * scale
  return { x: (size - renderedWidth) / 2, y: (size - renderedHeight) / 2, width: renderedWidth, height: renderedHeight }
}

const canvasBlob = (canvas: HTMLCanvasElement) => new Promise<Blob>((resolve, reject) => canvas.toBlob(blob => blob ? resolve(blob) : reject(new Error('Could not prepare the puzzle image.')), 'image/jpeg', .9))

export async function normalizePuzzleImage(source: LocalImage, fit: 'contain' | 'cover' = 'contain', size = 1200): Promise<LocalImage> {
  if (!source.file) return source
  const file=source.file
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' }).catch(() => createImageBitmap(file))
  try {
    const canvas = document.createElement('canvas')
    canvas.width = size
    canvas.height = size
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Your browser could not prepare this puzzle image.')
    const gradient = context.createLinearGradient(0, 0, size, size)
    gradient.addColorStop(0, '#f7ece8')
    gradient.addColorStop(1, '#e9e2ee')
    context.fillStyle = gradient
    context.fillRect(0, 0, size, size)
    const rect = calculateImageRect(bitmap.width, bitmap.height, size, fit)
    context.drawImage(bitmap, rect.x, rect.y, rect.width, rect.height)
    const blob = await canvasBlob(canvas)
    const file = new File([blob], `${source.name.replace(/\.[^.]+$/, '')}-puzzle.jpg`, { type: blob.type })
    return { id: createStableId('puzzle'), file, previewUrl: URL.createObjectURL(file), name: file.name, mimeType: file.type, size: file.size, width: size, height: size }
  } finally {
    bitmap.close()
  }
}
