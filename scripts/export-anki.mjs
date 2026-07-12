// scripts/export-anki.mjs
// Exports each module's FLASHCARDS deck to a plain-text file Anki can
// import directly (File > Import). See
// docs/superpowers/specs/2026-07-10-anki-export-design.md.
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const ALL_MODULES = readdirSync(new URL('..', import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(new URL(`../${e.name}/js/data/flashcards.js`, import.meta.url)))
  .map((e) => e.name)
  .sort();

function toTag(label) {
  return label
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeField(text) {
  return text.replace(/[\t\r\n]+/g, ' ');
}

async function exportModule(name) {
  const { FLASHCARDS } = await import(`../${name}/js/data/flashcards.js`);
  const date = new Date().toISOString().slice(0, 10);
  const lines = [
    '#separator:tab',
    '#html:false',
    '#tags column:4',
    `# exported ${date} from toddcooke/learn ${name}`
  ];
  for (const card of FLASHCARDS) {
    // The site renders card.service as a heading above card.front, so some
    // decks (aws especially) use generic fronts like "What is it for?" that
    // only make sense with the service name attached. Anki also dedupes on
    // the first field, so a bare generic front would silently collapse
    // cards on import. service + front is unique in every deck.
    const front = sanitizeField(`${card.service} — ${card.front}`);
    const back = sanitizeField(card.back);
    const id = `${name}-${card.id}`;
    const tag = `${name}::${toTag(card.domain)}`;
    lines.push(`${id}\t${front}\t${back}\t${tag}`);
  }
  return { name, lines, cardCount: FLASHCARDS.length };
}

const requested = process.argv.slice(2);
const modules = requested.length > 0 ? requested : ALL_MODULES;

// Validate module names
for (const name of modules) {
  if (!ALL_MODULES.includes(name)) {
    throw new Error(`Unknown module "${name}" — expected one of: ${ALL_MODULES.join(', ')}`);
  }
}

// Build all rows for all requested modules
const results = [];
for (const name of modules) {
  results.push(await exportModule(name));
}

// Assert cross-deck ID uniqueness before writing any file
const allIds = new Set();
for (const result of results) {
  for (const line of result.lines) {
    // Skip header/comment lines (they start with # or don't have 4 tab-separated fields)
    if (line.startsWith('#')) continue;
    const fields = line.split('\t');
    if (fields.length !== 4) continue; // Skip if not a data row
    const id = fields[0];
    if (allIds.has(id)) {
      throw new Error(`Duplicate ID across decks: "${id}"`);
    }
    allIds.add(id);
  }
}

// Write files
mkdirSync(new URL('../anki/', import.meta.url), { recursive: true });
for (const result of results) {
  const outPath = new URL(`../anki/${result.name}.txt`, import.meta.url);
  writeFileSync(outPath, result.lines.join('\n') + '\n');
  console.log(`${result.name}: ${result.cardCount} cards → anki/${result.name}.txt`);
}
