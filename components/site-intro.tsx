'use client'

import { ArrowRight, Sparkles } from 'lucide-react'
import Link from 'next/link'
import { useCallback, useEffect, useRef, useState } from 'react'
import { BrandMark } from '@/components/brand'
import { useFocusTrap } from '@/lib/use-focus-trap'

const CLOSE_DURATION_MS = 180
const SITE_INTRO_STORAGE_KEY = 'tinysurprise-site-intro-seen'
let introSeenThisSession = false

export function SiteIntro() {
  const [phase, setPhase] = useState<'hidden' | 'open' | 'closing'>('hidden')
  const primaryAction = useRef<HTMLAnchorElement>(null)
  const sceneRef = useRef<HTMLDivElement>(null)
  const closeTimer = useRef<number | null>(null)

  useEffect(() => {
    if (introSeenThisSession) return
    try {
      if (window.localStorage.getItem(SITE_INTRO_STORAGE_KEY) === '1') {
        introSeenThisSession = true
        return
      }
      window.localStorage.setItem(SITE_INTRO_STORAGE_KEY, '1')
    } catch {
      // The in-memory guard still prevents route/remount loops when storage
      // is unavailable (for example, private browser settings).
    }
    introSeenThisSession = true
    setPhase('open')
    return () => {
      if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    }
  }, [])

  const dismiss = useCallback(() => {
    if (phase !== 'open') return
    setPhase('closing')
    if (closeTimer.current !== null) window.clearTimeout(closeTimer.current)
    closeTimer.current = window.setTimeout(
      () => setPhase('hidden'),
      CLOSE_DURATION_MS,
    )
  }, [phase])

  useFocusTrap(phase !== 'hidden', sceneRef, primaryAction, dismiss)

  useEffect(() => {
    if (phase === 'hidden') return

    const previousOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    if (phase === 'open') primaryAction.current?.focus()

    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') dismiss()
    }
    window.addEventListener('keydown', closeOnEscape)

    return () => {
      document.body.style.overflow = previousOverflow
      window.removeEventListener('keydown', closeOnEscape)
    }
  }, [dismiss, phase])

  if (phase === 'hidden') return null

  return (
    <div
      className={`site-intro site-intro--${phase}`}
      role="dialog"
      aria-modal="true"
      aria-labelledby="site-intro-title"
      aria-describedby="site-intro-description"
      onClick={dismiss}
    >
      <div
        className="site-intro__scene"
        ref={sceneRef}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="site-intro__glow site-intro__glow--one" aria-hidden />
        <div className="site-intro__glow site-intro__glow--two" aria-hidden />
        <span className="site-intro__eyebrow">
          <Sparkles className="h-4 w-4" /> A little something lovely
        </span>
        <div className="site-intro__heart" aria-hidden>
          <BrandMark decorative className="h-7 w-7" />
        </div>
        <h1 id="site-intro-title">Let’s make a tiny moment they’ll keep.</h1>
        <p id="site-intro-description">
          Welcome to Tiny Surprise — choose a feeling, add your words, and turn
          an ordinary message into a sweet little experience made just for
          someone you love.
        </p>
        <Link
          ref={primaryAction}
          className="site-intro__cta"
          onClick={dismiss}
          href="/templates"
        >
          Let’s create something sweet <ArrowRight className="h-4 w-4" />
        </Link>
        <button type="button" className="site-intro__skip" onClick={dismiss}>
          Maybe later
        </button>
      </div>
      <style jsx global>{`
        .site-intro--open {
          animation: site-intro-fade-in 280ms ease-out both;
        }
        .site-intro--open .site-intro__scene {
          animation: site-intro-scene-in 440ms
            cubic-bezier(0.22, 1, 0.36, 1) both;
        }
        .site-intro--closing {
          animation: site-intro-fade-out ${CLOSE_DURATION_MS}ms ease-in both;
        }
        .site-intro--closing .site-intro__scene {
          animation: site-intro-scene-out ${CLOSE_DURATION_MS}ms ease-in both;
        }
        @keyframes site-intro-fade-in {
          from {
            opacity: 0;
          }
        }
        @keyframes site-intro-scene-in {
          from {
            opacity: 0;
            transform: translateY(1.25rem) scale(0.97);
          }
        }
        @keyframes site-intro-fade-out {
          to {
            opacity: 0;
          }
        }
        @keyframes site-intro-scene-out {
          to {
            opacity: 0;
            transform: translateY(0.65rem) scale(0.985);
          }
        }
        @media (prefers-reduced-motion: reduce) {
          .site-intro,
          .site-intro__scene {
            animation-duration: 1ms !important;
          }
        }
      `}</style>
    </div>
  )
}
