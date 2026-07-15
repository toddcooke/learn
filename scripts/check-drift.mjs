// scripts/check-drift.mjs
// Asserts the shared app layer is byte-identical across all modules.
// storage.js is the one sanctioned exception: it may differ ONLY on its
// first line (the NAMESPACE constant).
import { readFileSync, readdirSync, existsSync } from 'node:fs';

const root = new URL('..', import.meta.url);
const MODULES = readdirSync(root, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(new URL(`${e.name}/js/app.js`, root)))
  .map((e) => e.name)
  .sort();

const SHARED = [
  'js/app.js', 'js/lib/html.js', 'js/lib/scoring.js', 'js/lib/scoring.test.mjs',
  'js/lib/examSupport.js', 'js/lib/examSupport.test.mjs',
  'js/lib/weakAreas.js', 'js/lib/weakAreas.test.mjs',
  'js/lib/storage.test.mjs',
  'js/views/quiz.js', 'js/views/flashcards.js', 'js/views/progress.js',
  'js/views/studyGuide.js', 'js/views/mockExam.js', 'css/style.css',
  'scripts/fetch-doc.mjs', 'scripts/validate-content.mjs',
];

let failed = false;
const read = (m, f) => readFileSync(new URL(`${m}/${f}`, root), 'utf8');

for (const file of SHARED) {
  const reference = read(MODULES[0], file);
  for (const m of MODULES.slice(1)) {
    if (read(m, file) !== reference) {
      console.error(`DRIFT: ${m}/${file} differs from ${MODULES[0]}/${file}`);
      failed = true;
    }
  }
}

const tailOf = (m) => read(m, 'js/lib/storage.js').split('\n').slice(1).join('\n');
const refTail = tailOf(MODULES[0]);
for (const m of MODULES.slice(1)) {
  if (tailOf(m) !== refTail) {
    console.error(`DRIFT: ${m}/js/lib/storage.js differs beyond the NAMESPACE line`);
    failed = true;
  }
}

// The sanctioned line-1 exception is still constrained: it must be exactly
// a NAMESPACE constant, and the namespace must be unique per module (all
// modules share one localStorage origin, so a duplicate would silently
// cross-contaminate saved progress).
const namespaceOwner = new Map();
for (const m of MODULES) {
  const line1 = read(m, 'js/lib/storage.js').split('\n')[0];
  const match = line1.match(/^const NAMESPACE = '([^']+)';$/);
  if (!match) {
    console.error(`DRIFT: ${m}/js/lib/storage.js line 1 must be "const NAMESPACE = '<name>';", got: ${line1}`);
    failed = true;
    continue;
  }
  const owner = namespaceOwner.get(match[1]);
  if (owner) {
    console.error(`DRIFT: ${m} reuses NAMESPACE '${match[1]}' already used by ${owner}`);
    failed = true;
  }
  namespaceOwner.set(match[1], m);
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
console.log(`No drift across ${MODULES.length} modules (${SHARED.length + 1} shared files + cheatsheet scaffold).`);
