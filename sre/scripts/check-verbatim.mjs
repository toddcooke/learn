// Usage: node scripts/check-verbatim.mjs
// Mandatory verbatim-copying check for newly authored study-content topics.
// Scans every topic body added for the 'monitoring' domain (Task 6) for any
// 8+ consecutive word run that also appears verbatim in one of the cached
// source docs under .cache/aws-docs/. Sanity-checks itself first by planting
// a known violation and confirming the detector catches it, per the task's
// "don't trust a 0-hits result blindly" instruction.
import { readFile, readdir } from 'node:fs/promises';
import path from 'node:path';

const CACHE_DIR = '.cache/aws-docs';
const WINDOW = 8; // consecutive words

function normalizeWords(text) {
  return text
    .toLowerCase()
    .replace(/['’]/g, "'")
    .replace(/[^a-z0-9' ]+/g, ' ')
    .split(/\s+/)
    .filter(Boolean);
}

function ngramSet(words, n) {
  const set = new Set();
  for (let i = 0; i + n <= words.length; i++) {
    set.add(words.slice(i, i + n).join(' '));
  }
  return set;
}

async function loadCorpus() {
  const files = (await readdir(CACHE_DIR)).filter((f) => f.endsWith('.md'));
  let combinedWords = [];
  for (const f of files) {
    const text = await readFile(path.join(CACHE_DIR, f), 'utf8');
    combinedWords = combinedWords.concat(normalizeWords(text));
  }
  return ngramSet(combinedWords, WINDOW);
}

function findViolations(bodyText, corpusNgrams) {
  const words = normalizeWords(bodyText);
  const hits = [];
  for (let i = 0; i + WINDOW <= words.length; i++) {
    const gram = words.slice(i, i + WINDOW).join(' ');
    if (corpusNgrams.has(gram)) {
      hits.push(gram);
    }
  }
  return hits;
}

async function main() {
  const corpusNgrams = await loadCorpus();

  // --- Sanity check: plant a known 8+ word verbatim run from a cached doc
  // and confirm the detector catches it, before trusting a clean result.
  const plantedViolation =
    "The four golden signals of monitoring are latency, traffic, errors, and saturation.";
  const sanityHits = findViolations(plantedViolation, corpusNgrams);
  if (sanityHits.length === 0) {
    console.error('SANITY CHECK FAILED: planted violation was not detected. Aborting — do not trust results.');
    process.exit(2);
  }
  console.log(`Sanity check passed: detector caught the planted violation ("${sanityHits[0]}").`);

  // --- Real check: every topic body in the 'monitoring' domain sections.
  const { STUDY_CONTENT } = await import('../js/data/studyContent.js');
  const monitoringSections = STUDY_CONTENT.filter((s) => s.domain === 'monitoring');
  console.log(`Checking ${monitoringSections.length} monitoring section(s)...`);

  let totalViolations = 0;
  for (const section of monitoringSections) {
    for (const topic of section.topics) {
      const hits = findViolations(topic.body, corpusNgrams);
      if (hits.length > 0) {
        totalViolations += hits.length;
        console.error(`\nVIOLATION in "${section.taskStatement}" > "${topic.title}":`);
        for (const h of hits) console.error(`  - "${h}"`);
      }
    }
  }

  if (totalViolations > 0) {
    console.error(`\n${totalViolations} verbatim violation(s) found.`);
    process.exit(1);
  }
  console.log('\n0 hits: no 8+ consecutive word run in any new monitoring topic matches the cached docs.');
}

main();
