'use client'

import { useEffect, useState } from 'react'
import { Maximize2, Monitor, RotateCcw, Smartphone } from 'lucide-react'
import { Button } from './ui/button'
import { isNativePlatform } from '@/lib/platform'
import type { PreviewViewport } from '@/lib/use-builder-preview-mode'

export function StepPreview({
  renderPreview,
  onOpenFullPreview,
  previewPaused = false,
}: {
  renderPreview: (mode: PreviewViewport) => React.ReactNode
  previewPaused?: boolean
  /**
   * Opens the shared FullScreenPreview overlay on every platform. The browser
   * Fullscreen API used to be the web fallback, but it is unreliable in an
   * Android WebView, offers no in-app Back affordance, and gave web and
   * Android two different preview experiences — one overlay now serves both.
   */
  onOpenFullPreview: () => void
}) {
  const [native, setNative] = useState(false)
  useEffect(() => setNative(isNativePlatform()), [])
  const [mode, setMode] = useState<'mobile' | 'desktop'>('mobile')
  const [previewKey, setPreviewKey] = useState(0)
  return <div className="builder-preview-step space-y-5">
    <div className="flex flex-wrap items-center justify-between gap-3">
      {!native && <div className="flex rounded-xl border bg-card p-1" role="group" aria-label="Preview viewport">
        <Button size="sm" type="button" aria-pressed={mode === 'mobile'} variant={mode === 'mobile' ? 'default' : 'ghost'} onClick={() => setMode('mobile')}><Smartphone className="mr-1 h-4 w-4" />Phone</Button>
        <Button size="sm" type="button" aria-pressed={mode === 'desktop'} variant={mode === 'desktop' ? 'default' : 'ghost'} onClick={() => setMode('desktop')}><Monitor className="mr-1 h-4 w-4" />Desktop</Button>
      </div>}
      <div className="flex flex-wrap gap-2"><Button size="sm" variant="ghost" type="button" onClick={() => setPreviewKey((key) => key + 1)}><RotateCcw className="mr-2 h-4 w-4" />Restart preview</Button><Button size="sm" variant="ghost" type="button" onClick={onOpenFullPreview}><Maximize2 className="mr-2 h-4 w-4"/>Fullscreen</Button></div>
    </div>
    <p className="text-sm text-muted-foreground">Restarting the preview doesn’t change your saved work.</p>
    <div className={`preview-device preview-device-${native ? "available" : mode}`}>
      <div key={previewKey} className="preview-device__screen">
        {previewPaused ? (
          <div className="flex h-full min-h-64 items-center justify-center bg-secondary/20" aria-hidden="true" />
        ) : renderPreview(native ? "available" : mode)}
      </div>
    </div>
  </div>
}
