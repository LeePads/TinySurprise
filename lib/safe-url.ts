const MAX_URL_LENGTH = 2048;

export function normalizeHttpUrl(value?: string): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > MAX_URL_LENGTH) return null;
  try {
    const url = new URL(candidate);
    if (!['http:', 'https:'].includes(url.protocol)) return null;
    if (url.username || url.password) return null;
    return url.href;
  } catch {
    return null;
  }
}

export function normalizeRenderableImageUrl(value?: string): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 12 * 1024 * 1024) return null;
  if (/^blob:[^"'<>\\\s]+$/i.test(candidate)) return candidate;
  if (/^\/(?!\/)[^\r\n]*$/.test(candidate)) {
    try {
      const url = new URL(candidate, "https://tinysurprise.local");
      return `${url.pathname}${url.search}${url.hash}`;
    } catch {
      return null;
    }
  }
  if (
    /^data:image\/(?:jpeg|png|webp|gif);base64,[a-z0-9+/=\s]+$/i.test(candidate)
  )
    return candidate;
  return normalizeHttpUrl(candidate);
}

export function normalizeRenderableVideoUrl(value?: string): string | null {
  const candidate = value?.trim();
  if (!candidate || candidate.length > 24 * 1024 * 1024) return null;
  if (/^blob:[^"'<>\\\s]+$/i.test(candidate)) return candidate;
  if (
    /^data:video\/(?:mp4|webm|ogg);base64,[a-z0-9+/=\s]+$/i.test(candidate)
  )
    return candidate;
  return normalizeHttpUrl(candidate);
}
