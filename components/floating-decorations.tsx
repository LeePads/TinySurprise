'use client'

import { useEffect, useState } from 'react'
import { Heart } from 'lucide-react'
import { useReducedMotion } from 'framer-motion'

const DEFAULT_COLORS = ['#ec8b7f', '#fdb66f', '#d8a5db', '#fdd178', '#9dd4cb']

interface FloatingDecorationsProps {
  count?: number
  colors?: string[]
  className?: string
}

interface DecorElement {
  size: number
  x: number
  y: number
  color: string
}

interface FallingHeartElement {
  size: number
  x: number
  delay: number
  duration: number
  drift: number
  color: string
}

export function FloatingDecorations({ count = 6, colors, className = '' }: FloatingDecorationsProps) {
  // Derive a primitive dependency key so an inline colors array from a parent
  // cannot retrigger this state-initializing effect on every render.
  const colorKey = colors?.join('|') ?? ''
  const [decorations, setDecorations] = useState<DecorElement[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const colorList = colorKey ? colorKey.split('|') : DEFAULT_COLORS
    // Generate decorations after mount to avoid hydration mismatch
    const decor = Array.from({ length: count }).map((_, i) => ({
      size: Math.random() * 100 + 40,
      x: Math.random() * 100,
      y: Math.random() * 100,
      color: colorList[i % colorList.length],
    }))
    setDecorations(decor)
    setMounted(true)
  }, [count, colorKey])

  if (!mounted) {
    return <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`} />
  }

  return (
    <div className={`fixed inset-0 pointer-events-none overflow-hidden ${className}`}>
      {decorations.map((decor, i) => (
        <div
          key={i}
          className="absolute rounded-full opacity-10"
          style={{
            width: decor.size,
            height: decor.size,
            left: `${decor.x}%`,
            top: `${decor.y}%`,
            backgroundColor: decor.color,
            filter: 'blur(40px)',
          }}
        />
      ))}
    </div>
  )
}

export function FallingHearts({ count = 5, colors, className = '' }: FloatingDecorationsProps) {
  const colorKey = colors?.join('|') ?? ''
  const reduceMotion = useReducedMotion()
  const [hearts, setHearts] = useState<FallingHeartElement[]>([])
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    const colorList = colorKey ? colorKey.split('|') : DEFAULT_COLORS
    setHearts(
      Array.from({ length: count }, (_, index) => ({
        size: 18 + Math.random() * 12,
        x: 8 + Math.random() * 84,
        delay: -(Math.random() * 8),
        duration: 8 + Math.random() * 5,
        drift: (Math.random() - 0.5) * 34,
        color: colorList[index % colorList.length],
      })),
    )
    setMounted(true)
  }, [colorKey, count])

  if (!mounted) return null

  return (
    <div className={`pointer-events-none absolute inset-0 z-[1] overflow-hidden ${className}`} aria-hidden="true">
      {hearts.map((heart, index) => (
        <Heart
          key={index}
          className={reduceMotion ? 'absolute opacity-20' : 'landing-falling-heart absolute opacity-20'}
          size={heart.size}
          strokeWidth={1.5}
          fill="currentColor"
          style={{
            left: `${heart.x}%`,
            top: reduceMotion ? `${10 + ((index * 19) % 72)}%` : undefined,
            color: heart.color,
            animationDelay: `${heart.delay}s`,
            animationDuration: `${heart.duration}s`,
            ['--heart-drift' as string]: `${heart.drift}px`,
          }}
        />
      ))}
    </div>
  )
}
