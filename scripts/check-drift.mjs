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

if (failed) process.exit(1);
console.log(`No drift across ${MODULES.length} modules (${SHARED.length + 1} shared files).`);
