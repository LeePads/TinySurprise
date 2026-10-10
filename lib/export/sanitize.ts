export function escapeHtml(value: string): string { return value.replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c] || c)).replace(/\r?\n/g, '<br>') }
export function safeJson(value: unknown): string { return JSON.stringify(value).replace(/[<>&\u2028\u2029]/g, c => ({'<':'\\u003c','>':'\\u003e','&':'\\u0026','\u2028':'\\u2028','\u2029':'\\u2029'}[c] || c)) }
export function slugify(name: string): string { return name.normalize('NFKD').replace(/[\u0300-\u036f]/g, '').replace(/[^a-zA-Z0-9]+/g, '-').replace(/^-+|-+$/g, '').toLowerCase() }
const WINDOWS_RESERVED_BASENAMES = new Set([
  'con', 'prn', 'aux', 'nul',
  ...Array.from({ length: 9 }, (_, index) => `com${index + 1}`),
  ...Array.from({ length: 9 }, (_, index) => `lpt${index + 1}`),
])
function safeSlug(name: string): string {
  const clean = slugify(name)
  if (!clean) return ''
  return WINDOWS_RESERVED_BASENAMES.has(clean) ? `${clean}-keepsake` : clean
}
export function sanitizeFilename(name: string): string { const clean = safeSlug(name); return clean ? `tiny-surprise-for-${clean}.html` : 'tiny-surprise.html' }
/** Short default for the editable filename field: "<recipient>-surprise.html" instead of the longer "tiny-surprise-for-<recipient>.html". */
export function defaultShortHtmlFilename(recipientName: string): string { const clean = safeSlug(recipientName); return clean ? `${clean}-surprise.html` : 'surprise.html' }
/** Sanitizes a user-typed filename into a safe "<slug>.html" name, stripping any extension the user typed and falling back to `fallback` if nothing usable remains. */
export function sanitizeUserHtmlFilename(input: string, fallback: string): string { const clean = safeSlug(input.replace(/\.html?$/i, '')); return clean ? `${clean}.html` : fallback }
