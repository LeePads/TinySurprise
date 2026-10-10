'use client'

import { motion } from 'framer-motion'
import { useEffect, useRef } from 'react'
import { Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { PresentationImage } from '@/components/presentation-image'
import type { AnimationIntensity, LocalImage } from '@/lib/types'
import { useRecipientReducedMotion } from '@/lib/recipient-motion'

interface PuzzleCompletionRevealProps {
  completionTitle: string
  completionMessage: string
  finalMessage: string
  closingMessage?: string
  signature?: string
  photo?: LocalImage
  photoUrl?: string
  recipientName?: string
  animationIntensity: AnimationIntensity
  onReplay: () => void
}

export function PuzzleCompletionReveal({
  completionTitle,
  completionMessage,
  finalMessage,
  closingMessage,
  signature,
  photo,
  photoUrl,
  recipientName,
  animationIntensity,
  onReplay,
}: PuzzleCompletionRevealProps) {
  const reducedMotion = useRecipientReducedMotion(animationIntensity as AnimationIntensity)
  const shouldAnimate = animationIntensity !== 'subtle' && !reducedMotion
  const headingRef = useRef<HTMLHeadingElement>(null)

  useEffect(() => {
    const frame = window.requestAnimationFrame(() => headingRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [])

  return (
    <motion.div
      initial={reducedMotion ? false : { opacity: 0, scale: 0.95 }}
      animate={reducedMotion ? undefined : { opacity: 1, scale: 1 }}
      transition={{ duration: reducedMotion ? 0 : 0.4 }}
      className="space-y-6 p-3 text-center"
    >
      {shouldAnimate && (
        <motion.div
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 0.6 }}
          className="mx-auto h-10 w-10 text-primary"
        >
          <Sparkles className="h-10 w-10" aria-hidden="true" />
        </motion.div>
      )}

      <motion.h2
        ref={headingRef}
        tabIndex={-1}
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.2 }}
        className="text-3xl font-bold text-foreground @[640px]/recipient-preview:text-4xl"
      >
        {completionTitle}
      </motion.h2>

      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
        transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.3 }}
      >
        {(photo || photoUrl) && (
          <PresentationImage
            image={photo || { previewUrl: photoUrl || '', presentation: undefined } as LocalImage}
            alt="The completed puzzle photo"
            required
            aspectRatio="1 / 1"
            frameClassName="mx-auto mb-5 w-full max-w-sm rounded-2xl"
          />
        )}
        <p className="text-lg font-medium text-foreground/80">
          {completionMessage}
        </p>
      </motion.div>

      {finalMessage && (
        <motion.div
          initial={reducedMotion ? false : { opacity: 0, y: 10 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.4 }}
          className="border-t border-primary/25 pt-5"
        >
          <p className="whitespace-pre-wrap leading-relaxed text-foreground">
            {finalMessage}
          </p>
        </motion.div>
      )}

      {closingMessage && <p className="whitespace-pre-wrap leading-relaxed">{closingMessage}</p>}
      {signature && <p className="whitespace-pre-wrap italic">{signature}</p>}

      {recipientName && (
        <motion.p
          initial={reducedMotion ? false : { opacity: 0 }}
          animate={reducedMotion ? undefined : { opacity: 1 }}
          transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.5 }}
          className="text-sm italic text-foreground/60"
        >
          This puzzle was crafted just for {recipientName}.
        </motion.p>
      )}

      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={reducedMotion ? undefined : { opacity: 1 }}
        transition={{ duration: reducedMotion ? 0 : 0.2, delay: reducedMotion ? 0 : 0.6 }}
      >
        <Button
          onClick={onReplay}
          className="bg-primary font-medium text-primary-foreground shadow-warm hover:bg-primary/90 hover:shadow-glow"
        >
          Puzzle again
        </Button>
      </motion.div>
    </motion.div>
  )
}
