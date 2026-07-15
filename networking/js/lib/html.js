// HTML-escapes a data-derived string so it can be interpolated into an
// innerHTML template safely. Content strings legitimately contain angle
// brackets (e.g. kubectl placeholders like `<pod>` or `<namespace>` in the
// kubernetes module's questions); without escaping, the browser parses them
// as unknown start tags and silently drops them from the rendered page.
// Escape only the data, never the surrounding template markup.
export function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
}
