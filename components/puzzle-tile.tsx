'use client'

import { motion, useReducedMotion } from 'framer-motion'
import { puzzleTileImageStyle, puzzleTileSourceIndex } from '@/lib/puzzle-image'
import type { ImagePresentation } from '@/lib/types'

interface PuzzleTileProps {
  tileNumber: number
  isEmpty: boolean
  imageUrl?: string
  presentation?: ImagePresentation
  gridSize: number
  position: { row: number; col: number }
  isClickable: boolean
  onTileClick: (tileIndex: number) => void
  tileIndex: number
  animationIntensity: string
}

export function PuzzleTile({
  tileNumber,
  isEmpty,
  imageUrl,
  presentation,
  gridSize,
  position,
  isClickable,
  onTileClick,
  tileIndex,
  animationIntensity,
}: PuzzleTileProps) {
  const reduceMotion = useReducedMotion()
  const tileSize = 100 / gridSize
  const imageStyle = puzzleTileImageStyle(gridSize, puzzleTileSourceIndex(tileNumber), presentation)
  const pieceLabel = `Puzzle piece ${tileNumber}, row ${position.row + 1}, column ${position.col + 1}${isClickable ? ', movable into the empty space' : ', not movable right now'}`

  const shouldAnimate = !reduceMotion && animationIntensity !== 'subtle' && animationIntensity !== 'reduced'

  return (
    <motion.button
      type="button"
      className={`
        group absolute overflow-hidden border-0 p-0 text-left
        ${isEmpty ? 'bg-secondary/50' : 'bg-transparent cursor-pointer hover:shadow-warm'}
      `}
      style={{
        width: `${tileSize}%`,
        height: `${tileSize}%`,
        left: `${position.col * tileSize}%`,
        top: `${position.row * tileSize}%`,
        minHeight: 0,
        minWidth: 0,
        padding: 0,
      }}
      layout
      transition={{
        duration: shouldAnimate ? 0.2 : 0.1,
        ease: 'easeOut',
      }}
      onClick={() => isClickable && !isEmpty && onTileClick(tileIndex)}
      disabled={isEmpty || !isClickable}
      aria-label={isEmpty ? 'Empty space' : pieceLabel}
    >
      {!isEmpty && imageUrl && (
        // The same source URL is intentionally clipped into every tile; using
        // next/image here would create a separate optimized asset per crop.
        // eslint-disable-next-line @next/next/no-img-element
        <img
          src={imageUrl}
          alt=""
          aria-hidden="true"
          draggable={false}
          className="pointer-events-none absolute block max-h-none max-w-none"
          style={imageStyle}
        />
      )}
      {isEmpty && (
        <div
          aria-hidden="true"
          className="h-full w-full border-2 border-dashed border-foreground/20 bg-foreground/[0.06]"
        />
      )}
      <span aria-hidden="true" className={`pointer-events-none absolute inset-0 border border-background/35 ${isClickable && !isEmpty ? 'transition-colors group-hover:border-primary/60' : ''}`} />
    </motion.button>
  )
}
