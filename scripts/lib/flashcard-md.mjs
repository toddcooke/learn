// scripts/lib/flashcard-md.mjs
// Parses a module's flashcards.md into card records. The emitted format is
// defined by docs/superpowers/specs/2026-08-26-markdown-conversion-design.md:
//
//   ## <domain>
//   ### `<id>` · <service>
//   **<front>**
//   <details><summary>Answer</summary>
//   <back>
//   </details>
//
// Strict on purpose: a lenient parser would silently shrink an Anki deck.

const HEADING = /^`([^`]+)` · (.+)$/;

// Exact inverse of the converter's mdText. Bare placeholders like <name> are
// emitted backtick-wrapped because CommonMark would otherwise treat them as
// raw HTML and drop them when rendered; Anki fields must carry the original
// text, so they are unwrapped here. Only backticks that wrap a tag-like token
// are stripped, leaving genuinely backticked prose untouched.
const BACKTICKED_TAG = /`(<\/?[A-Za-z][A-Za-z0-9-]*\s*\/?>)`/g;

const unmdText = (text) => text.replace(BACKTICKED_TAG, '$1');

export function parseFlashcardMarkdown(text, moduleName) {
  const cards = [];
  const seen = new Set();
  let domain = null;
  let card = null;
  let inAnswer = false;
  let sawClose = false;
  let buf = [];

  const fail = (message) => {
    throw new Error(`${moduleName}/flashcards.md: ${message}`);
  };

  const flush = () => {
    if (!card) return;
    if (!card.front) fail(`card "${card.id}" is missing a front`);
    card.back = unmdText(buf.join('\n').trim());
    if (card.back === '') fail(`card "${card.id}" is missing a back`);
    cards.push(card);
    card = null;
    buf = [];
  };

  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      if (card && inAnswer) fail(`card "${card.id}" has content after its answer`);
      flush();
      domain = unmdText(line.slice(3).trim());
    } else if (line.startsWith('### ')) {
      if (card && inAnswer) fail(`card "${card.id}" has content after its answer`);
      flush();
      const m = line.slice(4).match(HEADING);
      if (!m) fail(`unparseable card heading: ${line}`);
      if (domain === null) fail(`card "${m[1]}" appears before any domain heading`);
      if (seen.has(m[1])) fail(`duplicate card id "${m[1]}"`);
      if (/[\t\r\n]/.test(m[1])) fail(`card id "${m[1]}" contains a tab, carriage return, or newline`);
      seen.add(m[1]);
      card = { id: m[1], service: unmdText(m[2].trim()), domain, front: null, back: '' };
      inAnswer = false;
      sawClose = false;
    } else if (!card) {
      continue;
    } else if (line.startsWith('<details>')) {
      if (sawClose) fail(`card "${card.id}" has content after its answer`);
      inAnswer = true;
    } else if (line.startsWith('</details>')) {
      inAnswer = false;
      sawClose = true;
    } else if (inAnswer) {
      buf.push(line);
    } else if (card.front === null && line.startsWith('**') && line.trimEnd().endsWith('**')) {
      card.front = unmdText(line.trim().slice(2, -2));
    } else if (sawClose && line.trim() !== '') {
      fail(`card "${card.id}" has content after its answer`);
    }
  }
  flush();

  if (cards.length === 0) fail('no cards found');
  return cards;
}
