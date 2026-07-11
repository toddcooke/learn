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
  'js/app.js', 'js/lib/scoring.js', 'js/lib/scoring.test.mjs', 'js/lib/storage.test.mjs',
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

if (failed) process.exit(1);
console.log(`No drift across ${MODULES.length} modules (${SHARED.length + 1} shared files).`);
