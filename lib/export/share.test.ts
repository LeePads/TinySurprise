import { describe, expect, it } from 'vitest'
import { createSurpriseZip } from './share'

describe('download packaging', () => {
  it('creates a transport ZIP with HTML and opening instructions', async () => {
    const zip = await createSurpriseZip(new File(['<!doctype html>'], 'gift.html', { type: 'text/html' }), 'Mía')
    const bytes = new Uint8Array(await zip.arrayBuffer())
    const text = new TextDecoder().decode(bytes)
    expect([...bytes.slice(0, 4)]).toEqual([0x50, 0x4b, 0x03, 0x04])
    expect(text).toContain('tiny-surprise-for-mia.html')
    expect(text).toContain('OPEN-ME.txt')
    expect(text).toContain('HOW TO OPEN YOUR TINYSURPRISE')

    const endOffset = bytes.length - 22
    const view = new DataView(bytes.buffer)
    expect(view.getUint32(endOffset, true)).toBe(0x06054b50)
    expect(view.getUint16(endOffset + 8, true)).toBe(2)
    const centralSize = view.getUint32(endOffset + 12, true)
    const centralOffset = view.getUint32(endOffset + 16, true)
    expect(centralOffset + centralSize).toBe(endOffset)
    expect(view.getUint32(centralOffset, true)).toBe(0x02014b50)
  })

  it('packages large HTML without spreading the file into JavaScript arrays', async () => {
    const html = new Uint8Array(2 * 1024 * 1024).fill(65)
    const zip = await createSurpriseZip(new File([html], 'gift.html'), 'Sam')
    expect(zip.size).toBeGreaterThan(html.length)
    expect(zip.type).toBe('application/zip')
  })
})
