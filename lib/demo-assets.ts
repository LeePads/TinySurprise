import type { LocalImage } from './types'

export const DEMO_PHOTO_PATHS = [1,2,3,4,5].map(index => `/art/demo/memory-${index}.jpg`)

export function demoPhoto(index: number): LocalImage {
  const normalized=((index-1)%DEMO_PHOTO_PATHS.length+DEMO_PHOTO_PATHS.length)%DEMO_PHOTO_PATHS.length
  return {id:`demo-photo-${normalized+1}`,previewUrl:DEMO_PHOTO_PATHS[normalized],name:`memory-${normalized+1}.jpg`,mimeType:'image/jpeg',size:0,source:'url'}
}
