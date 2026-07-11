// scripts/export-anki.mjs
// Exports each module's FLASHCARDS deck to a plain-text file Anki can
// import directly (File > Import). See
// docs/superpowers/specs/2026-07-10-anki-export-design.md.
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const ALL_MODULES = readdirSync(new URL('..', import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(new URL(`../${e.name}/js/data/flashcards.js`, import.meta.url)))
  .map((e) => e.name)
  .sort();

function toTag(service) {
  return service
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeField(text) {
  return text.replace(/[\t\r\n]+/g, ' ');
}

async function exportModule(name, reversed) {
  const { FLASHCARDS } = await import(`../${name}/js/data/flashcards.js`);
  const lines = ['#separator:tab', '#html:false'];
  if (reversed) {
    // Anki's stock two-way note type: each row imports as front→back AND
    // back→front. Assumes the English default name for that note type.
    lines.push('#notetype:Basic (and reversed card)');
  }
  lines.push('#tags column:3');
  for (const card of FLASHCARDS) {
    // The site renders card.service as a heading above card.front, so some
    // decks (aws especially) use generic fronts like "What is it for?" that
    // only make sense with the service name attached. Anki also dedupes on
    // the first field, so a bare generic front would silently collapse
    // cards on import. service + front is unique in every deck.
    const front = sanitizeField(`${card.service} — ${card.front}`);
    const back = sanitizeField(card.back);
    const tag = toTag(card.service);
    lines.push(`${front}\t${back}\t${tag}`);
  }
  mkdirSync(new URL('../anki/', import.meta.url), { recursive: true });
  const outPath = new URL(`../anki/${name}.txt`, import.meta.url);
  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`${name}: ${FLASHCARDS.length} cards → anki/${name}.txt`);
}

const args = process.argv.slice(2);
const reversed = args.includes('--reversed');
const requested = args.filter((a) => a !== '--reversed');
const modules = requested.length > 0 ? requested : ALL_MODULES;

for (const name of modules) {
  if (!ALL_MODULES.includes(name)) {
    throw new Error(`Unknown module "${name}" — expected one of: ${ALL_MODULES.join(', ')}`);
  }
}

for (const name of modules) {
  await exportModule(name, reversed);
}
