import { persistedImageError } from '../media-validation'
import { embeddedRasterImageFile } from '../raster-image-validation'
import type { CatchTheHeartContent, ChooseOurDateContent, LocalImage, LocalVideo, MemoryQuizContent, OpenWhenContent, PhotoPuzzleContent, SurpriseData, OurStorybookContent, WishUponAStarContent, CozyPlaylistContent } from '../types'
import type { EmbeddedAudio, EmbeddedImage, EmbeddedVideo, ExportableData, ExportMediaContribution, ImageConversionProgress } from './types'
import { normalizeHttpUrl } from '../safe-url'
import { audioMimeType, audioValidationMessage, normalizeLegacyMusic } from '../music'
import { collectLocalMediaRefs } from '../local-media'
import { readBoundedResponse } from '../bounded-file-read'

export const MAX_IMAGE_SIDE = 1600
export const OUTPUT_QUALITY = 0.86
const conversionCache = new WeakMap<File, Promise<{ previewUrl: string; mimeType: string; size: number }>>()
const remoteConversionCache = new Map<string, Promise<Blob>>()
const IMAGE_TYPES = new Set(['image/jpeg','image/png','image/webp','image/gif'])
const VIDEO_TYPES = new Set(['video/mp4','video/webm','video/ogg'])

export function isDataImageUrl(value: string): boolean {
  return /^data:image\/(jpeg|png|webp|gif);base64,[a-z0-9+/]+=*$/i.test(value)
}

const toDataUrl = (blob: Blob) => new Promise<string>((resolve, reject) => {
  const reader = new FileReader()
  reader.onload = () => typeof reader.result === 'string' ? resolve(reader.result) : reject(new Error('Could not read image data'))
  reader.onerror = () => reject(new Error('Could not read image data'))
  reader.readAsDataURL(blob)
})

const canvasToBlob = (canvas: HTMLCanvasElement, mimeType: string) => new Promise<Blob>((resolve, reject) => {
  canvas.toBlob((blob) => blob ? resolve(blob) : reject(new Error('Could not optimize image')), mimeType, OUTPUT_QUALITY)
})

async function optimizeImage(file: Blob): Promise<Blob> {
  if (file.type === 'image/gif') return file
  if (typeof createImageBitmap !== 'function') return file
  let bitmap: ImageBitmap
  try {
    bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' })
  } catch {
    bitmap = await createImageBitmap(file)
  }
  try {
    const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(bitmap.width * scale))
    canvas.height = Math.max(1, Math.round(bitmap.height * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Image optimization is unavailable in this browser')
    context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
    const outputType = file.type === 'image/png' ? 'image/webp' : file.type
    const optimized = await canvasToBlob(canvas, outputType)
    return optimized.size < file.size ? optimized : file
  } finally {
    bitmap.close()
  }
}

export async function fetchRemoteBlob(urlValue: string, label: string, kind: 'image'|'video'): Promise<Blob> {
  const url = normalizeHttpUrl(urlValue)
  if (!url) throw new Error(`${label}: enter a valid public http:// or https:// URL`)
  const cacheKey = `${kind}:${url}`
  let cached = remoteConversionCache.get(cacheKey)
  if (!cached) {
    cached = (async () => {
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      try {
        const response = await fetch(url, { mode: 'cors', credentials: 'omit', signal: controller.signal })
        if (!response.ok) throw new Error(`${label}: the remote file returned ${response.status}. Upload it directly instead`)
        const limit = kind === 'image' ? 5 * 1024 * 1024 : 15 * 1024 * 1024
        const blob = await readBoundedResponse(response, limit, `${label}: the remote ${kind} is too large. Upload a smaller file instead`)
        const allowed = kind === 'image' ? IMAGE_TYPES : VIDEO_TYPES
        const mimeType = blob.type.toLowerCase().split(';')[0]
        if (!allowed.has(mimeType)) throw new Error(`${label}: the URL did not return a supported ${kind} file`)
        if (blob.size > limit) throw new Error(`${label}: the remote ${kind} is too large. Upload a smaller file instead`)
        return blob
      } catch (error) {
        if (controller.signal.aborted) throw new Error(`${label}: the remote file took too long to load. Upload it directly instead`)
        if (error instanceof TypeError) throw new Error(`${label}: the remote site blocked browser access. Upload the file directly instead`)
        throw error
      } finally {
        clearTimeout(timeout)
        controller.abort()
      }
    })()
    remoteConversionCache.set(cacheKey, cached)
    const release = () => { if (remoteConversionCache.get(cacheKey) === cached) remoteConversionCache.delete(cacheKey) }
    void cached.then(release, release)
  }
  return cached
}

async function convert(image: LocalImage, label: string): Promise<EmbeddedImage> {
  try {
    if (!image.file && image.source === 'url') {
      const remote = await fetchRemoteBlob(image.previewUrl, label, 'image')
      const error = await persistedImageError(remote)
      if (error) throw new Error(error)
      const optimized = await optimizeImage(remote)
      const previewUrl = await toDataUrl(optimized)
      if (!isDataImageUrl(previewUrl)) throw new Error('The converted image data is invalid')
      return { id:image.id, previewUrl, name:image.name, mimeType:optimized.type, size:optimized.size, width:image.width, height:image.height, presentation:image.presentation }
    }
    if (!image.file) {
      if (isDataImageUrl(image.previewUrl)) {
        const error = await persistedImageError(embeddedRasterImageFile(image), image.mimeType)
        if (error) throw new Error(error)
        return { id:image.id, previewUrl:image.previewUrl, name:image.name, mimeType:image.mimeType, size:image.size, width:image.width, height:image.height, presentation:image.presentation }
      }
      if (/^blob:/i.test(image.previewUrl)) {
        throw new Error('The original photo is no longer available. Choose it again and retry')
      }
      return { id:image.id, previewUrl:image.previewUrl, name:image.name, mimeType:image.mimeType, size:0, width:image.width, height:image.height, presentation:image.presentation }
    }
    const file=image.file
    let cached = conversionCache.get(file)
    if (!cached) {
      cached = (async () => {
        const mimeType = image.mimeType.toLowerCase().split(';')[0]
        const source = file.type === mimeType ? file : file.slice(0, file.size, mimeType)
        const error = await persistedImageError(file, mimeType)
        if (error) throw new Error(error)
        const optimized = await optimizeImage(source)
        const previewUrl = await toDataUrl(optimized)
        if (!isDataImageUrl(previewUrl)) throw new Error('The converted image data is invalid')
        return { previewUrl, mimeType: optimized.type || image.mimeType, size: optimized.size }
      })()
      conversionCache.set(file, cached)
      void cached.catch(() => {
        if (conversionCache.get(file) === cached) conversionCache.delete(file)
      })
    }
    const converted = await cached
    return { id: image.id, ...converted, name: image.name, width: image.width, height: image.height, presentation: image.presentation }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown image conversion error'
    throw new Error(`${label} (${image.name}): ${reason}`)
  }
}

async function convertVideo(video: LocalVideo, label: string): Promise<EmbeddedVideo> {
  try {
    let blob: Blob
    if (video.file) {
      if (!VIDEO_TYPES.has(video.file.type.toLowerCase())) throw new Error('Choose an MP4, WebM, or Ogg video')
      if (video.file.size > 15 * 1024 * 1024) throw new Error('Choose a video no larger than 15 MB')
      blob = video.file
    } else if (video.source === 'url') {
      blob = await fetchRemoteBlob(video.previewUrl, label, 'video')
    } else if (/^data:video\//i.test(video.previewUrl)) {
      return { id:video.id, previewUrl:video.previewUrl, name:video.name, mimeType:video.mimeType, size:video.size }
    } else {
      throw new Error('The original video is no longer available. Choose it again and retry')
    }
    return { id:video.id, previewUrl:await toDataUrl(blob), name:video.name, mimeType:blob.type, size:blob.size }
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'Unknown video conversion error'
    throw new Error(`${label} (${video.name}): ${reason}`)
  }
}

async function convertAudio(file: File, durationSeconds?: number): Promise<EmbeddedAudio> {
  const message = audioValidationMessage(file)
  if (message) throw new Error(message)
  const mimeType = audioMimeType(file)
  // Supply the same canonical media type used by the authoring decoder. The
  // Blob view changes only the data-URL header; original bytes/name stay intact.
  const source = file.type === mimeType ? file : file.slice(0, file.size, mimeType)
  return { name:file.name, mimeType, size:file.size, dataUrl:await toDataUrl(source), durationSeconds }
}

function assertLocalMediaAvailable(data: SurpriseData): void {
  collectLocalMediaRefs(data).forEach(({ kind, media }) => {
    const source = "source" in media ? media.source : undefined
    const missingBlob =
      media.unavailable ||
      (kind === "audio" && !(media.file instanceof Blob)) ||
      (kind !== "audio" && source !== "url" && !(
        media.file instanceof Blob ||
        (kind === "image" && isDataImageUrl(media.previewUrl)) ||
        (kind === "video" && /^data:video\//i.test(media.previewUrl))
      ));
    if (!missingBlob) return;
    throw new Error(`${media.name}: media unavailable — choose it again before exporting`);
  });
}

export async function embedImages(data: SurpriseData, onProgress?: (progress: ImageConversionProgress) => void, onMedia?: (contribution: ExportMediaContribution) => void): Promise<ExportableData> {
  data = normalizeLegacyMusic(data)
  assertLocalMediaAvailable(data)
  const total = countPhotos(data)
  let completed = 0
  const embed = async (image: LocalImage | undefined, label: string) => {
    if (!image) return undefined
    onProgress?.({ completed, total, imageName: image.name })
    const embedded = await convert(image, label)
    onMedia?.({ kind: 'image', label, name: image.name, originalBytes: image.size, embeddedBytes: embedded.size })
    completed += 1
    onProgress?.({ completed, total, imageName: image.name })
    return embedded
  }
  const embedAudio = async (file: File, label: string, durationSeconds?: number) => {
    const embedded = await convertAudio(file, durationSeconds)
    onMedia?.({ kind: 'audio', label, name: file.name, originalBytes: file.size, embeddedBytes: embedded.size })
    return embedded
  }
  const embedVideo = async (video: LocalVideo, label: string) => {
    const embedded = await convertVideo(video, label)
    onMedia?.({ kind: 'video', mediaId: video.id, label, name: video.name, originalBytes: video.size, embeddedBytes: embedded.size })
    return embedded
  }
  const delight = data.delight ? { ...data.delight, coverPhoto: await embed(data.delight.coverPhoto, 'Cover photo') } : data.delight
  const { customBackgroundImage: _savedCustomBackground, ...appearanceValues } = data.appearance
  const appearance = { ...appearanceValues, backgroundImage: await embed(data.appearance.backgroundImage, 'Custom background') }
  const music = data.music
    ? {
        ...data.music,
        file: data.music.file
          ? await embedAudio(data.music.file.file, 'Background music', data.music.file.durationSeconds)
          : undefined,
      }
    : undefined
  const base = { ...data, appearance, delight, music }

  if (data.template === 'catch-the-heart') {
    const content = data.content as CatchTheHeartContent
    const { songFile: _songFile, ...contentWithoutAudio } = content
    const hearts = []
    for (let index = 0; index < content.hearts.length; index += 1) {
      const heart = content.hearts[index]
      hearts.push({ id: heart.id, message: heart.message, photo: await embed(heart.photo, `Heart ${index + 1}`) })
    }
    return { ...base, content: { ...contentWithoutAudio, hearts } }
  }
  if (data.template === 'photo-puzzle') {
    const content = data.content as PhotoPuzzleContent
    const photo = await embed(content.photo, 'Puzzle image')
    return { ...base, content: { ...content, photo, photoUrl: photo?.previewUrl || content.photoUrl } }
  }
  if (data.template === 'open-when') {
    const content = data.content as OpenWhenContent; const envelopes = []
    for (let index = 0; index < content.envelopes.length; index += 1) { const envelope = content.envelopes[index]; envelopes.push({ id: envelope.id, title: envelope.title, message: envelope.message, photo: await embed(envelope.photo, `Letter ${index + 1} photo`), video: envelope.video ? await embedVideo(envelope.video, `Letter ${index + 1} video`) : undefined }) }
    const musicFile = content.musicFile ? await embedAudio(content.musicFile.file, 'Open When music', content.musicFile.durationSeconds) : undefined
    return { ...base, content: { ...content, envelopes, musicFile } }
  }
  if (data.template === 'choose-our-date') { const content=data.content as ChooseOurDateContent,rounds=[];for(let roundIndex=0;roundIndex<content.rounds.length;roundIndex++){const round=content.rounds[roundIndex],options=[];for(let optionIndex=0;optionIndex<round.options.length;optionIndex++){const option=round.options[optionIndex];options.push({...option,photo:await embed(option.photo,`Date round ${roundIndex+1}, option ${optionIndex+1}`)})}rounds.push({...round,options})}return{...base,content:{...content,rounds}} }
  if(data.template==='memory-quiz'){const content=data.content as MemoryQuizContent,questions=[];for(let index=0;index<content.questions.length;index++){const question=content.questions[index];questions.push({...question,photo:await embed(question.photo,`Quiz memory ${index+1}`)})}return{...base,content:{...content,questions}}}
  if(data.template==='our-storybook'){const content=data.content as OurStorybookContent,pages=[];for(let index=0;index<content.pages.length;index++){const page=content.pages[index];pages.push({...page,photo:await embed(page.photo,`Story page ${index+1}`)})}return{...base,content:{...content,pages}}}
  if(data.template==='wish-upon-a-star'){const content=data.content as WishUponAStarContent,stars=[];for(let index=0;index<content.stars.length;index++){const star=content.stars[index];stars.push({...star,photo:await embed(star.photo,`Wish ${index+1}`)})}return{...base,content:{...content,stars}}}
  if(data.template==='cozy-playlist'){const content=data.content as CozyPlaylistContent,tracks=[];for(let index=0;index<content.tracks.length;index++){const track=content.tracks[index];tracks.push({...track,photo:await embed(track.photo,`Playlist song ${index+1}`),audio:track.audio?await embedAudio(track.audio.file,`Playlist song ${index+1} audio`,track.audio.durationSeconds):undefined})}return{...base,content:{...content,tracks}}}
  return base as ExportableData
}

export function countPhotos(data: SurpriseData): number {
  const cover = (data.delight?.coverPhoto ? 1 : 0) + (data.appearance.backgroundImage ? 1 : 0)
  if (data.template === 'catch-the-heart') return cover + (data.content as CatchTheHeartContent).hearts.filter((heart) => heart.photo).length
  if (data.template === 'photo-puzzle') return cover + ((data.content as PhotoPuzzleContent).photo ? 1 : 0)
  if (data.template === 'open-when') return cover + (data.content as OpenWhenContent).envelopes.filter((envelope) => envelope.photo).length
  if (data.template === 'choose-our-date') return cover + (data.content as ChooseOurDateContent).rounds.flatMap((round)=>round.options).filter((option) => option.photo).length
  if (data.template === 'memory-quiz') return cover + (data.content as MemoryQuizContent).questions.filter((question) => question.photo).length
  if (data.template === 'our-storybook') return cover + (data.content as OurStorybookContent).pages.filter((page) => page.photo).length
  if (data.template === 'wish-upon-a-star') return cover + (data.content as WishUponAStarContent).stars.filter((star) => star.photo).length
  if (data.template === 'cozy-playlist') return cover + (data.content as CozyPlaylistContent).tracks.filter((track) => track.photo).length
  return cover
}
