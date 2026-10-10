import { describe, expect, it } from 'vitest'
import { containsBlobUrl, estimateExportSize } from './html-generator'
import { isDataImageUrl } from './image-conversion'
import { sanitizeFilename } from './sanitize'
import type { SurpriseData } from '../types'

describe('export safety utilities', () => {
  it('sanitizes recipient names into safe HTML filenames', () => expect(sanitizeFilename(' Mía / Doe ')).toBe('tiny-surprise-for-mia-doe.html'))
  it('detects residual blob URLs', () => {
    expect(containsBlobUrl('<img src="blob:123">')).toBe(true)
    expect(containsBlobUrl('<img src="data:image/png;base64,iVBORw0KGgo=">')).toBe(false)
  })
  it('validates embedded image data URLs', () => {
    expect(isDataImageUrl('data:image/png;base64,iVBORw0KGgo=')).toBe(true)
    expect(isDataImageUrl('blob:123')).toBe(false)
  })
  it('includes cover and custom-background media in the size warning', () => {
    const image = (id: string, size: number) => ({
      id,
      previewUrl: `blob:${id}`,
      name: `${id}.jpg`,
      mimeType: 'image/jpeg',
      size,
    })
    const data: SurpriseData = {
      template: 'catch-the-heart',
      basics: { senderName: 'A', recipientName: 'B', openingMessage: 'Hi' },
      content: {
        hearts: [{ id: 'h1', message: 'Memory' }],
        finalMessage: 'Always',
        soundEffects: false,
      },
      appearance: {
        theme: 'soft-rose',
        animationIntensity: 'normal',
        backgroundImage: image('background', 2_000_000),
      },
      delivery: { expiration: 'none' },
      delight: {
        coverEnabled: true,
        coverMessage: 'Open me',
        coverPhoto: image('cover', 2_000_000),
        openingStyle: 'gentle-fade',
        passphraseEnabled: false,
        passphrase: '',
        closingMessage: '',
        signature: '',
      },
    }
    expect(estimateExportSize(data).level).toBe('large')
    expect(estimateExportSize(data).photoCount).toBe(2)
  })

  it('warns about a large preflight estimate without blocking creation', () => {
    const image = (id: string) => ({
      id,
      previewUrl: `blob:${id}`,
      name: `${id}.jpg`,
      mimeType: 'image/jpeg',
      size: 2_000_000,
    })
    const data: SurpriseData = {
      template: 'catch-the-heart',
      basics: { senderName: 'A', recipientName: 'B', openingMessage: 'Hi' },
      content: {
        hearts: Array.from({ length: 20 }, (_, index) => ({
          id: `h${index}`,
          message: 'Memory',
          photo: image(`photo-${index}`),
        })),
        finalMessage: 'Always',
        soundEffects: false,
      },
      appearance: { theme: 'soft-rose', animationIntensity: 'normal' },
      delivery: { expiration: 'none' },
    }
    const estimate = estimateExportSize(data)
    expect(estimate.estimatedBytes).toBeGreaterThan(25 * 1024 * 1024)
    expect(estimate.level).toBe('warning')
  })
})
