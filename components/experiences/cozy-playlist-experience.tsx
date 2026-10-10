"use client";

import { usePreviewSuspended } from "@/lib/preview-activity";
import { useEffect, useId, useRef, useState } from "react";
import { Music2, Pause, Play, SkipBack, SkipForward } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { CozyPlaylistContent, SurpriseData } from "@/lib/types";
import { normalizeHttpUrl, normalizeRenderableImageUrl } from "@/lib/safe-url";
import { openExternalLink } from "@/lib/native/open-link";
import { PresentationImage } from "@/components/presentation-image";
import { createExperienceProgress } from "@/lib/experience-progress";
import { resolveExperienceCompletion } from "@/lib/experience-completion";
import {
  isPlayableCozyPlaylistContent,
  normalizeCozyPlaylistContent,
} from "@/lib/cozy-playlist";
import {
  bindExclusiveAudioPreview,
  claimAudioPreview,
} from "@/lib/audio-preview";

type PlaylistPlaybackState = 'selected' | 'playing' | 'paused' | 'error'

export function CozyPlaylistExperience({ data }: { data: SurpriseData }) {
  const normalizedContent = normalizeCozyPlaylistContent(data.content)
  const content = normalizedContent as CozyPlaylistContent
  const tracks = Array.isArray(content.tracks) ? content.tracks : []
  const playable = isPlayableCozyPlaylistContent(normalizedContent, 'compatibility')
  const completion = resolveExperienceCompletion(data)
  const [activeIndex, setActiveIndex] = useState(0)
  const [playbackState, setPlaybackState] = useState<PlaylistPlaybackState>('selected')
  const [currentTime, setCurrentTime] = useState(0)
  const [duration, setDuration] = useState(0)
  const [explored, setExplored] = useState<Set<string>>(() => new Set())
  const [announcement, setAnnouncement] = useState('')
  const [playbackError, setPlaybackError] = useState('')
  const audioRef = useRef<HTMLAudioElement>(null)
  const suspended = usePreviewSuspended()
  useEffect(() => { if (suspended) audioRef.current?.pause() }, [suspended])
  const playButtonRef = useRef<HTMLButtonElement>(null)
  const completionHeadingRef = useRef<HTMLHeadingElement>(null)
  const completionWasVisible = useRef(false)
  const audioOwner = `cozy-playlist-${useId()}`
  const activeTrack = tracks[activeIndex]
  const activeTrackId = activeTrack?.id
  const activeTrackTitle = activeTrack?.title
  const progress = createExperienceProgress('cozy-playlist', explored.size, tracks.length)

  useEffect(() => {
    const audio = audioRef.current
    if (!audio) return
    return bindExclusiveAudioPreview(audio, audioOwner)
  }, [activeTrack?.id, audioOwner])

  useEffect(() => {
    audioRef.current?.pause()
    if (audioRef.current) audioRef.current.currentTime = 0
    setPlaybackState('selected')
    setPlaybackError('')
    setCurrentTime(0)
    setDuration(0)
    setAnnouncement(activeTrackTitle ? `${activeTrackTitle} selected.` : '')
    if (activeTrackId) setExplored(current => new Set(current).add(activeTrackId))
  }, [activeTrackId, activeTrackTitle])

  useEffect(() => {
    if (!progress.complete) {
      completionWasVisible.current = false
      return
    }
    if (completionWasVisible.current) return
    completionWasVisible.current = true
    setAnnouncement('Playlist complete.')
    const frame = window.requestAnimationFrame(() => completionHeadingRef.current?.focus())
    return () => window.cancelAnimationFrame(frame)
  }, [progress.complete])

  const selectTrack = (index: number) => {
    setActiveIndex(index)
    const track = tracks[index]
    if (track) setExplored(current => new Set(current).add(track.id))
  }
  const stepTrack = (direction: number) => {
    const next = Math.min(tracks.length - 1, Math.max(0, activeIndex + direction))
    setActiveIndex(next)
  }
  const togglePlayback = () => {
    const audio = audioRef.current
    if (!audio || !activeTrack?.audio) return
    if (audio.paused) {
      setPlaybackError('')
      claimAudioPreview(audioOwner)
      void audio.play().catch(() => {
        setPlaybackState('error')
        setPlaybackError('This song could not be played on this device.')
        setAnnouncement('Playback unavailable for this song.')
      })
    } else {
      audio.pause()
      setPlaybackState('paused')
      setAnnouncement(`Paused ${activeTrack.title}.`)
    }
  }
  const timeLabel = (seconds: number) => {
    if (!Number.isFinite(seconds) || seconds < 0) return '0:00'
    const minutes = Math.floor(seconds / 60)
    return `${minutes}:${Math.floor(seconds % 60).toString().padStart(2, '0')}`
  }
  const seekMax = Number.isFinite(duration) && duration > 0 ? duration : 1
  const imageWithFill = activeTrack?.photo
    ? { ...activeTrack.photo, presentation: activeTrack.photo.presentation || { mode: 'fill' as const } }
    : undefined

  if (!playable)
    return <div role="alert" className="flex min-h-[430px] items-center justify-center rounded-[2rem] bg-[var(--experience-surface)] p-8 text-center">This Cozy Playlist could not be opened because its songs are incomplete.</div>

  return (
    <div className="cozy-playlist-root mx-auto max-w-2xl space-y-6">
      <p className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</p>
      <div className="border-b border-[var(--experience-border)] pb-5 text-center">
        <p className="text-sm font-semibold text-primary">{progress.label}</p>
        <h2 className="mt-2 text-3xl font-bold">The Cozy Playlist</h2>
        <p className="mx-auto mt-3 max-w-xl text-[var(--experience-muted)]">A handmade mixtape, with the little memories tucked into its liner notes.</p>
      </div>
      {activeTrack && (
        <section className="rounded-[1.75rem] bg-[var(--experience-surface)] p-4 shadow-warm @[640px]/recipient-preview:p-6" aria-label="Selected song">
          {imageWithFill && (
            <PresentationImage
              image={{ ...imageWithFill, previewUrl: normalizeRenderableImageUrl(imageWithFill.previewUrl) || imageWithFill.previewUrl }}
              alt={`${activeTrack.title || 'Song'} memory`}
              aspectRatio="16 / 9"
              frameClassName="w-full rounded-2xl bg-muted"
            />
          )}
          <div className="mt-4 flex items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[.16em] text-primary">{playbackState === 'playing' ? 'Now playing' : 'Now selected'}</p>
              <h3 className="mt-1 [overflow-wrap:anywhere] text-2xl font-semibold">{activeTrack.title}</h3>
              <p className="text-sm text-[var(--experience-muted)]">{activeTrack.artist}</p>
              <p className="mt-1 text-xs text-[var(--experience-muted)]">{playbackState === 'playing' ? 'Playing' : playbackState === 'paused' ? 'Paused' : playbackState === 'error' ? 'Unavailable' : activeTrack.audio ? 'Ready to play' : activeTrack.link ? 'External song' : 'Story interlude'}</p>
            </div>
            <Music2 className="mt-1 h-6 w-6 shrink-0 text-primary" aria-hidden="true" />
          </div>
          <div className="mt-5 border-t border-[var(--experience-border)] pt-5">
            <p className="text-sm font-semibold text-primary">Liner note</p>
            <p className="mt-2 whitespace-pre-wrap text-lg leading-7">{activeTrack.why}</p>
          </div>
          {activeTrack.audio ? (
            <div className="mt-5 space-y-3">
              <audio
                ref={audioRef}
                className="hidden"
                preload="metadata"
                src={activeTrack.audio.previewUrl}
                onLoadedMetadata={event => setDuration(Number.isFinite(event.currentTarget.duration) ? event.currentTarget.duration : 0)}
                onTimeUpdate={event => setCurrentTime(Number.isFinite(event.currentTarget.currentTime) ? event.currentTarget.currentTime : 0)}
                onPlay={() => { setPlaybackState('playing'); setPlaybackError(''); setAnnouncement(`Playing ${activeTrack.title}.`) }}
                onPause={() => setPlaybackState(state => state === 'error' ? state : 'paused')}
                onError={() => { setPlaybackState('error'); setPlaybackError('This song could not be played on this device.'); setAnnouncement('Playback unavailable for this song.') }}
                onEnded={() => {
                  setPlaybackState('selected')
                  setAnnouncement(`Finished ${activeTrack.title}.`)
                  if (progress.complete) completionHeadingRef.current?.focus()
                  else playButtonRef.current?.focus()
                }}
              />
              <label className="block text-sm font-medium" htmlFor={`playlist-seek-${activeTrack.id}`}>Song position</label>
              <input id={`playlist-seek-${activeTrack.id}`} type="range" min={0} max={seekMax} step={1} value={Math.min(currentTime, seekMax)} onChange={event => { const next=Number(event.target.value); if(audioRef.current) audioRef.current.currentTime=next; setCurrentTime(next) }} className="w-full accent-primary" aria-describedby={playbackError ? `playlist-error-${activeTrack.id}` : undefined} aria-valuetext={`${timeLabel(currentTime)} of ${duration > 0 ? timeLabel(duration) : 'duration unavailable'}`} />
              <div className="flex justify-between text-xs text-[var(--experience-muted)]"><span>{timeLabel(currentTime)}</span><span>{duration > 0 ? timeLabel(duration) : 'â€”'}</span></div>
              {playbackError && <p id={`playlist-error-${activeTrack.id}`} className="text-sm text-destructive" role="alert">{playbackError}</p>}
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex gap-2">
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => stepTrack(-1)} disabled={activeIndex === 0}><SkipBack className="mr-2 h-4 w-4" /> Previous</Button>
                  <Button ref={playButtonRef} type="button" className="min-h-12" onClick={togglePlayback} aria-label={playbackState === 'playing' ? `Pause ${activeTrack.title}` : `Play ${activeTrack.title}`}>
                    {playbackState === 'playing' ? <Pause className="mr-2 h-4 w-4" /> : <Play className="mr-2 h-4 w-4" />}
                    {playbackState === 'playing' ? 'Pause' : 'Play'}
                  </Button>
                  <Button type="button" variant="outline" className="min-h-12" onClick={() => stepTrack(1)} disabled={activeIndex === tracks.length - 1}>Next <SkipForward className="ml-2 h-4 w-4" /></Button>
                </div>
              </div>
            </div>
          ) : (
            <p className="mt-4 text-sm text-[var(--experience-muted)]">{activeTrack.link ? 'This song opens from its link below.' : 'This one is a story interlude from an older playlist.'}</p>
          )}
          {normalizeHttpUrl(activeTrack.link) && (
            <a className="mt-4 inline-flex min-h-12 items-center justify-center rounded-[var(--radius-button)] border border-border px-4 text-sm font-semibold transition hover:border-primary hover:text-primary focus-visible:outline-none focus-visible:ring-4 focus-visible:ring-primary/20" href={normalizeHttpUrl(activeTrack.link) || undefined} target="_blank" rel="noopener noreferrer" onClick={(event) => { setExplored(current => new Set(current).add(activeTrack.id)); void openExternalLink(normalizeHttpUrl(activeTrack.link) || '', event) }}>Open song elsewhere</a>
          )}
        </section>
      )}
      <div className="space-y-2" role="list" aria-label="Playlist tracks">
        {tracks.map((track, index) => {
          const photoUrl = normalizeRenderableImageUrl(track.photo?.previewUrl)
          const link = normalizeHttpUrl(track.link)
          const wasExplored = explored.has(track.id)
          const selected = index === activeIndex
          const playing = selected && playbackState === 'playing'
          return (
            <div role="listitem" key={track.id}>
              <button type="button" aria-current={selected ? 'true' : undefined} aria-label={`${track.title}, ${track.artist}, song ${index + 1} of ${tracks.length}${selected ? playing ? ', selected and playing' : ', selected' : ''}`} onClick={() => selectTrack(index)} className={`flex w-full items-center gap-3 rounded-2xl border p-3 text-left transition ${selected ? 'border-primary bg-primary/10 shadow-sm' : 'border-[var(--experience-border)] bg-[var(--experience-surface)]/45 hover:border-primary/45'}`}>
                {photoUrl && <PresentationImage image={{ ...track.photo!, previewUrl: photoUrl, presentation: track.photo!.presentation || { mode: 'fill' } }} alt={`${track.title || 'Song'} memory`} loading="lazy" aspectRatio="5 / 4" frameClassName="h-16 w-20 shrink-0 rounded-xl bg-muted" />}
                <div className="min-w-0 flex-1"><h3 className="truncate font-semibold">{track.title}</h3><p className="truncate text-sm text-[var(--experience-muted)]">{track.artist}</p><p className="mt-1 truncate text-xs text-[var(--experience-muted)]">{wasExplored ? 'Explored' : track.audio ? 'Local song' : link ? 'External song' : 'Story interlude'}</p></div>
                {selected && (playing ? <Pause className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" /> : <Play className="h-4 w-4 shrink-0 text-primary" aria-hidden="true" />)}
              </button>
            </div>
          )
        })}
      </div>
      {progress.complete && <div className="rounded-2xl bg-primary/10 p-5 text-center text-lg"><p className="text-sm font-semibold text-primary">{completion.eyebrow}</p><h3 ref={completionHeadingRef} tabIndex={-1} className="mt-2 outline-none">{completion.finalMessage}</h3>{completion.closingMessage && <p className="mt-3 font-medium">{completion.closingMessage}</p>}{completion.signature && <p className="mt-2 text-sm italic text-muted-foreground">{completion.signature}</p>}</div>}
    </div>
  )
}
