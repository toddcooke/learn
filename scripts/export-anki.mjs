// scripts/export-anki.mjs
// Exports each module's FLASHCARDS deck to a plain-text file Anki can
// import directly (File > Import). See
// docs/superpowers/specs/2026-07-10-anki-export-design.md.
import { mkdirSync, writeFileSync } from 'node:fs';

const ALL_MODULES = ['aws', 'kubernetes', 'postgres', 'sre'];

function toTag(service) {
  return service
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeField(text) {
  return text.replace(/[\t\r\n]+/g, ' ');
}

async function exportModule(name) {
  const { FLASHCARDS } = await import(`../${name}/js/data/flashcards.js`);
  const lines = ['#separator:tab', '#html:false'];
  for (const card of FLASHCARDS) {
    const front = sanitizeField(card.front);
    const back = sanitizeField(card.back);
    const tag = toTag(card.service);
    lines.push(`${front}\t${back}\t${tag}`);
  }
  mkdirSync(new URL('../anki/', import.meta.url), { recursive: true });
  const outPath = new URL(`../anki/${name}.txt`, import.meta.url);
  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`${name}: ${FLASHCARDS.length} cards → anki/${name}.txt`);
}

const requested = process.argv.slice(2);
const modules = requested.length > 0 ? requested : ALL_MODULES;

for (const name of modules) {
  if (!ALL_MODULES.includes(name)) {
    throw new Error(`Unknown module "${name}" — expected one of: ${ALL_MODULES.join(', ')}`);
  }
}

for (const name of modules) {
  await exportModule(name);
}
