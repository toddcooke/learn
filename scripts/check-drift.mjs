// scripts/check-drift.mjs
// Asserts the last two things every module still shares are byte-identical:
//   1. scripts/fetch-doc.mjs
//   2. the shared-scaffold block(s) inside cheatsheet.html
// This used to guard the whole browser app layer (js/, css/,
// validate-content.mjs, and the storage.js NAMESPACE convention), but that
// layer was deleted wholesale in 83ff4ef "feat!: delete the browser app
// layer" — every module now stands alone as static HTML/Markdown. This
// script was deleted in the same commit on the premise that everything it
// guarded went with it, but fetch-doc.mjs and the cheatsheet scaffold
// blocks both survived, unguarded, until this file was restored. Only
// those two invariants are checked now; there is no app layer left to
// check the rest of.
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const MODULES = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(new URL(`${e.name}/flashcards.md`, root)))
  .map((e) => e.name)
  .sort();

let failed = false;
const read = (m, f) => readFileSync(new URL(`${m}/${f}`, root), 'utf8');

// scripts/fetch-doc.mjs must be byte-identical across all modules.
const fetchDocOwners = [];
for (const m of MODULES) {
  if (!existsSync(new URL(`${m}/scripts/fetch-doc.mjs`, root))) {
    console.error(`DRIFT: ${m}/scripts/fetch-doc.mjs is missing`);
    failed = true;
    continue;
  }
  fetchDocOwners.push(m);
}
if (fetchDocOwners.length > 0) {
  const reference = read(fetchDocOwners[0], 'scripts/fetch-doc.mjs');
  for (const m of fetchDocOwners.slice(1)) {
    if (read(m, 'scripts/fetch-doc.mjs') !== reference) {
      console.error(`DRIFT: ${m}/scripts/fetch-doc.mjs differs from ${fetchDocOwners[0]}/scripts/fetch-doc.mjs`);
      failed = true;
    }
  }
}

// Each module's printable cheatsheet wraps its shared print scaffolding
// (style block + page chrome) in shared-scaffold marker pairs; per-module
// content (title, home link, sheet body, footer) stays outside the markers.
// The marked blocks must be byte-identical across all modules.
const SCAFFOLD_START = '<!-- shared-scaffold:start -->';
const SCAFFOLD_END = '<!-- shared-scaffold:end -->';

function scaffoldBlocks(html) {
  const blocks = [];
  let current = null;
  for (const line of html.split('\n')) {
    const trimmed = line.trim();
    if (trimmed === SCAFFOLD_START) {
      if (current !== null) return { error: `${SCAFFOLD_START} inside an unclosed block` };
      current = [];
    } else if (trimmed === SCAFFOLD_END) {
      if (current === null) return { error: `${SCAFFOLD_END} without a matching start marker` };
      blocks.push(current.join('\n'));
      current = null;
    } else if (current !== null) {
      current.push(line);
    }
  }
  if (current !== null) return { error: `${SCAFFOLD_START} never closed` };
  if (blocks.length === 0) return { error: 'shared-scaffold markers are missing' };
  return { blocks };
}

const scaffolds = new Map();
for (const m of MODULES) {
  if (!existsSync(new URL(`${m}/cheatsheet.html`, root))) {
    console.error(`DRIFT: ${m}/cheatsheet.html is missing`);
    failed = true;
    continue;
  }
  const { blocks, error } = scaffoldBlocks(read(m, 'cheatsheet.html'));
  if (error) {
    console.error(`DRIFT: ${m}/cheatsheet.html: ${error}`);
    failed = true;
    continue;
  }
  scaffolds.set(m, blocks);
}
const refScaffold = scaffolds.get(MODULES[0]);
for (const m of MODULES.slice(1)) {
  const blocks = scaffolds.get(m);
  if (!refScaffold || !blocks) continue;
  if (blocks.length !== refScaffold.length) {
    console.error(`DRIFT: ${m}/cheatsheet.html has ${blocks.length} shared-scaffold blocks, ${MODULES[0]} has ${refScaffold.length}`);
    failed = true;
    continue;
  }
  blocks.forEach((block, i) => {
    if (block !== refScaffold[i]) {
      console.error(`DRIFT: ${m}/cheatsheet.html shared-scaffold block ${i + 1} differs from ${MODULES[0]}/cheatsheet.html`);
      failed = true;
    }
  });
}

if (failed) process.exit(1);
console.log(`No drift across ${MODULES.length} modules (fetch-doc.mjs + cheatsheet scaffold).`);
