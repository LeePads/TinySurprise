import { describe, expect, it } from 'vitest'
import { CATCH_HEART_VISIBLE_LIMIT, MAX_HEART_MEMORIES, appendHeartMemory, assignPhotosToMemories, memoriesFromSelectedPhotos } from './heart-memories'
import type { HeartItem, LocalImage } from './types'

const photo=(index:number):LocalImage=>({id:`image-${index}`,file:new File(['x'],`memory-${index}.jpg`,{type:'image/jpeg'}),previewUrl:`blob:memory-${index}`,name:`memory-${index}.jpg`,mimeType:'image/jpeg',size:1})
const prepared = (count: number) => Array.from({ length: count }, (_, index) => ({ id: `new-${index}`, message: '', photo: photo(index) }))

describe('Catch the Heart memory batches',()=>{
  it('creates exactly nine items and preserves existing ids and notes by position',()=>{const current=[{id:'heart-a',message:'Keep me'},{id:'heart-b',message:'And me'}];const result=memoriesFromSelectedPhotos(current,Array.from({length:9},(_,i)=>photo(i)));expect(result).toHaveLength(9);expect(result[0]).toMatchObject({id:'heart-a',message:'Keep me',photo:{id:'image-0'}});expect(result[1]).toMatchObject({id:'heart-b',message:'And me'});expect(new Set(result.map(item=>item.id)).size).toBe(9)})
  it('caps batches and individual additions at the supported maximum',()=>{const full=memoriesFromSelectedPhotos([],Array.from({length:25},(_,i)=>photo(i)));expect(full).toHaveLength(MAX_HEART_MEMORIES);expect(appendHeartMemory(full)).toBe(full)})
  it('keeps the authoring maximum separate from the bounded active visual window',()=>{expect(MAX_HEART_MEMORIES).toBe(20);expect(CATCH_HEART_VISIBLE_LIMIT).toBe(5)})
  it('fills the three defaults before appending the remaining two photos', () => {
    const current = Array.from({ length: 3 }, (_, i) => ({ id: `existing-${i}`, message: `Note ${i}` }))
    const result = assignPhotosToMemories(current, prepared(5))
    expect(result).toHaveLength(5)
    expect(result.map(item => item.photo?.id)).toEqual(['image-0', 'image-1', 'image-2', 'image-3', 'image-4'])
    expect(result.slice(0, 3).map(({ id, message }) => ({ id, message }))).toEqual(current)
    expect(result.slice(3).map(item => item.id)).toEqual(['new-3', 'new-4'])
    expect(current.every(item => !('photo' in item))).toBe(true)
  })
  it('preserves populated and unavailable photos, notes, and existing ordering', () => {
    const existingPhoto = { ...photo(99), unavailable: true }
    const current: HeartItem[] = [{ id: 'a', message: 'Keep', photo: existingPhoto }, { id: 'b', message: 'Edited while reading' }, { id: 'c', message: 'Keep too', photo: photo(98) }, { id: 'd', message: '' }]
    const result = assignPhotosToMemories(current, prepared(3))
    expect(result[0]).toBe(current[0])
    expect(result[2]).toBe(current[2])
    expect(result[1]).toMatchObject({ id: 'b', message: 'Edited while reading', photo: { id: 'image-0' } })
    expect(result[3]).toMatchObject({ id: 'd', photo: { id: 'image-1' } })
    expect(result[4]).toMatchObject({ id: 'new-2', photo: { id: 'image-2' } })
  })
  it('fills empty photo slots at the collection maximum without adding rows', () => {
    const current: HeartItem[] = Array.from({ length: 20 }, (_, i) => ({ id: `h-${i}`, message: '', ...(i < 18 ? { photo: photo(100 + i) } : {}) }))
    const result = assignPhotosToMemories(current, prepared(5))
    expect(result).toHaveLength(20)
    expect(result.slice(18).map(item => item.photo?.id)).toEqual(['image-0', 'image-1'])
    expect(assignPhotosToMemories(result, prepared(5))).toEqual(result)
  })
  it('rechecks a changed collection and produces deterministic replay with prepared IDs', () => {
    const batch = prepared(5)
    const current: HeartItem[] = [{ id: 'a', message: 'Latest', photo: photo(99) }, { id: 'b', message: 'New note' }]
    const first = assignPhotosToMemories(current, batch, 3)
    expect(first.map(item => item.photo?.id)).toEqual(['image-99', 'image-0', 'image-1'])
    expect(assignPhotosToMemories(current, batch, 3)).toEqual(first)
    expect(assignPhotosToMemories(current, [])).toBe(current)
  })
})
