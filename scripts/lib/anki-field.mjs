// scripts/lib/anki-field.mjs
// Turns one parsed flashcard field into the text that goes in an Anki field.
//
// Anki fields are HTML, so a list only renders as a list if the field
// actually contains <ul>/<li>. That is why the exported file is written with
// `#html:true` and this module does the escaping itself: card text is escaped
// here, and the only unescaped markup in a field is markup this module added.
//
// Under the previous `#html:false` header the importer did the escaping, so
// the *stored* result is unchanged for prose cards — `<pod>` was stored as
// `&lt;pod&gt;` then and is written as `&lt;pod&gt;` now. What changed is that
// a markdown bullet list in flashcards.md now survives the trip instead of
// being flattened into one run-on line.

const BULLET = /^\s*[-*+]\s+(.*)$/;
// Ordered markers keep their own numbering in <ol>, so the marker is dropped.
const NUMBERED = /^\s*\d+[.)]\s+(.*)$/;

export function escapeHtml(text) {
  return String(text)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;');
}

// Groups the field's lines into runs of bullets and runs of prose. A blank
// line always ends the current run, so two paragraphs stay two paragraphs.
function toBlocks(text) {
  const blocks = [];
  let current = null;
  for (const raw of String(text).split('\n')) {
    if (raw.trim() === '') { current = null; continue; }
    const bullet = raw.match(BULLET);
    const numbered = bullet ? null : raw.match(NUMBERED);
    const match = bullet || numbered;
    const type = bullet ? 'ul' : numbered ? 'ol' : 'text';
    const value = (match ? match[1] : raw).trim();
    if (current && current.type === type) current.items.push(value);
    else { current = { type, items: [value] }; blocks.push(current); }
  }
  return blocks;
}

export function toAnkiField(text) {
  const blocks = toBlocks(text);
  let html = '';
  blocks.forEach((block, i) => {
    // A list is already block-level; only two adjacent prose runs need a break.
    if (i > 0 && block.type === 'text' && blocks[i - 1].type === 'text') html += '<br>';
    if (block.type === 'text') {
      html += escapeHtml(block.items.join(' '));
    } else {
      const items = block.items.map((item) => `<li>${escapeHtml(item)}</li>`).join('');
      html += `<${block.type}>${items}</${block.type}>`;
    }
  });
  // Collapse anything that would break the TSV row. A field that BEGINS with a
  // double quote would be parsed as csv-quoted by Anki's importer (swallowing
  // separators and corrupting the row), so prefix a space to keep it plain.
  const flat = html.replace(/[\t\r\n]+/g, ' ');
  return flat.startsWith('"') ? ` ${flat}` : flat;
}
