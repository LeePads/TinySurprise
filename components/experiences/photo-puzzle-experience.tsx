'use client'

import { useCallback, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { PuzzleBoard } from '@/components/puzzle-board'
import { PuzzleCompletionReveal } from '@/components/puzzle-completion-reveal'
import type { SurpriseData, PhotoPuzzleContent } from '@/lib/types'
import { resolveExperienceCompletion } from '@/lib/experience-completion'
import { useRecipientReducedMotion } from '@/lib/recipient-motion'

interface PhotoPuzzleExperienceProps {
  data: SurpriseData
}

export function PhotoPuzzleExperience({ data }: PhotoPuzzleExperienceProps) {
  const [isCompleted, setIsCompleted] = useState(false)
  const [completionKey, setCompletionKey] = useState(0)
  const reduceMotion = useRecipientReducedMotion(data.appearance?.animationIntensity)

  const content = data.content as PhotoPuzzleContent

  const difficulty = content.difficulty || 'medium'
  const photoUrl = content?.photo?.previewUrl || content?.photoUrl
  const completionMessage = content?.completionMessage || 'Well done!'
  const completion = resolveExperienceCompletion(data)
  const finalMessage = completion.finalMessage.trim() === completionMessage.trim()
    ? ""
    : completion.finalMessage

  const handleComplete = useCallback(() => {
    setIsCompleted(true)
  }, [])

  const handleReplay = useCallback(() => {
    setIsCompleted(false)
    setCompletionKey(prev => prev + 1)
  }, [])

  if (!photoUrl) return <div className="flex min-h-[420px] items-center justify-center bg-background p-6 text-center text-muted-foreground">Choose a puzzle photo to preview this surprise.</div>

  return (
    <div className="photo-puzzle-root flex min-h-0 items-start justify-center text-[var(--experience-foreground)]" style={{ background: "linear-gradient(145deg, var(--experience-canvas), var(--experience-surface))" }}>
      <div className="w-full max-w-2xl">
        {/* Header */}
        <motion.div
          key={`header-${completionKey}`}
          initial={reduceMotion ? false : { opacity: 0, y: -20 }}
          animate={reduceMotion ? undefined : { opacity: 1, y: 0 }}
          className="mb-5 text-center @[640px]/recipient-preview:mb-8"
        >
          <h1 className="mb-3 recipient-title font-bold text-foreground">
            {isCompleted ? completion.title : 'Solve the Puzzle'}
          </h1>
          <p className="text-lg text-foreground/70">
            {isCompleted ? 'Great work!' : `Difficulty: ${difficulty.charAt(0).toUpperCase() + difficulty.slice(1)}`}
          </p>
        </motion.div>

        {/* Main Content */}
        <AnimatePresence mode="wait">
          {!isCompleted ? (
            <motion.div
              key="puzzle"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.95 }}
              transition={{ duration: reduceMotion ? 0 : 0.3 }}
            >
              <PuzzleBoard
                key={`board-${completionKey}`}
                imageUrl={photoUrl}
                presentation={content.photo?.presentation}
                difficulty={difficulty}
                onComplete={handleComplete}
                onRevealAlternative={handleComplete}
                animationIntensity={data.appearance?.animationIntensity || 'medium'}
                focusOnMount={completionKey > 0}
              />
            </motion.div>
          ) : (
            <motion.div
              key="completion"
              initial={reduceMotion ? false : { opacity: 0, scale: 0.95 }}
              animate={reduceMotion ? undefined : { opacity: 1, scale: 1 }}
              transition={{ duration: reduceMotion ? 0 : 0.3 }}
            >
              <PuzzleCompletionReveal
                key={`reveal-${completionKey}`}
                completionTitle={completion.title}
                completionMessage={completionMessage}
                finalMessage={finalMessage}
                closingMessage={completion.closingMessage}
                signature={completion.signature}
                photo={content.photo}
                photoUrl={content.photo ? undefined : photoUrl}
                recipientName={data.basics?.recipientName}
                animationIntensity={data.appearance?.animationIntensity || 'medium'}
                onReplay={handleReplay}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  )
}
