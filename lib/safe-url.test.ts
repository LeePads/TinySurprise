import { describe, expect, it } from 'vitest';
import { normalizeHttpUrl, normalizeRenderableImageUrl } from './safe-url';

describe('safe external URLs', () => {
  it('normalizes public HTTP links', () => {
    expect(normalizeHttpUrl(' https://example.com/a song?q=love ')).toBe(
      'https://example.com/a%20song?q=love',
    );
  });

  it.each([
    'javascript:alert(1)',
    'data:text/html,<script>alert(1)</script>',
    'file:///secret',
    'https://user:pass@example.com/song',
    '//example.com/song',
  ])('rejects unsafe link %s', (value) => {
    expect(normalizeHttpUrl(value)).toBeNull();
  });

  it('allows only renderable local, embedded, blob, or HTTP image sources', () => {
    expect(normalizeRenderableImageUrl('/art/demo/memory-1.jpg')).toBe(
      '/art/demo/memory-1.jpg',
    );
    expect(normalizeRenderableImageUrl('blob:local-preview')).toBe(
      'blob:local-preview',
    );
    expect(
      normalizeRenderableImageUrl('data:image/png;base64,iVBORw0KGgo='),
    ).toBe('data:image/png;base64,iVBORw0KGgo=');
    expect(normalizeRenderableImageUrl('data:image/svg+xml,<svg/>')).toBeNull();
  });
});
