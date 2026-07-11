// Usage: node scripts/validate-content.mjs
// Validates the shape of every data file under js/data/ that currently
// exists. Exits non-zero and prints every problem found if any data file
// is malformed. Skips files that don't exist yet.
import { existsSync } from 'node:fs';

const errors = [];

function check(condition, message) {
  if (!condition) errors.push(message);
}

async function validateExamInfo() {
  const { DOMAINS, EXAM_FORMAT } = await import('../js/data/examInfo.js');
  check(Array.isArray(DOMAINS) && DOMAINS.length > 0, 'DOMAINS must be a non-empty array');
  const totalWeight = DOMAINS.reduce((sum, d) => sum + d.weight, 0);
  check(totalWeight === 100, `DOMAINS weights must sum to 100, got ${totalWeight}`);
  const totalMockCount = DOMAINS.reduce((sum, d) => sum + d.mockExamCount, 0);
  check(totalMockCount === EXAM_FORMAT.totalQuestions,
    `DOMAINS mockExamCount must sum to ${EXAM_FORMAT.totalQuestions}, got ${totalMockCount}`);
  for (const d of DOMAINS) {
    check(typeof d.id === 'string' && d.id.length > 0, `domain missing id: ${JSON.stringify(d)}`);
    check(typeof d.name === 'string' && d.name.length > 0, `domain missing name: ${JSON.stringify(d)}`);
    check(typeof d.weight === 'number' && d.weight > 0, `domain missing weight: ${JSON.stringify(d)}`);
  }
  if ('scoredQuestions' in EXAM_FORMAT) {
    check(EXAM_FORMAT.totalQuestions === EXAM_FORMAT.scoredQuestions + EXAM_FORMAT.unscoredQuestions,
      'EXAM_FORMAT.totalQuestions must equal scoredQuestions + unscoredQuestions');
  }
  return DOMAINS;
}

async function validateStudyContent(domainIds) {
  if (!existsSync(new URL('../js/data/studyContent.js', import.meta.url))) {
    console.log('studyContent.js not present yet, skipping');
    return;
  }
  const { STUDY_CONTENT } = await import('../js/data/studyContent.js');
  check(Array.isArray(STUDY_CONTENT), 'STUDY_CONTENT must be an array');
  for (const section of STUDY_CONTENT) {
    check(domainIds.includes(section.domain), `study section has unknown domain: ${section.domain}`);
    check(typeof section.taskStatement === 'string' && section.taskStatement.length > 0,
      `study section missing taskStatement: ${JSON.stringify(section).slice(0, 80)}`);
    check(Array.isArray(section.topics) && section.topics.length > 0,
      `study section missing topics: ${section.taskStatement}`);
    for (const topic of section.topics) {
      check(typeof topic.title === 'string' && topic.title.length > 0,
        `topic missing title in ${section.taskStatement}`);
      check(typeof topic.body === 'string' && topic.body.length >= 40,
        `topic "${topic.title}" body too short`);
    }
  }
}

async function validateQuestions(domainIds) {
  if (!existsSync(new URL('../js/data/questions.js', import.meta.url))) {
    console.log('questions.js not present yet, skipping');
    return;
  }
  const { QUESTIONS } = await import('../js/data/questions.js');
  check(Array.isArray(QUESTIONS) && QUESTIONS.length > 0, 'QUESTIONS must be a non-empty array');
  const seenIds = new Set();
  for (const q of QUESTIONS) {
    check(!seenIds.has(q.id), `duplicate question id: ${q.id}`);
    seenIds.add(q.id);
    check(domainIds.includes(q.domain), `question ${q.id} has unknown domain: ${q.domain}`);
    check(['multiple-choice', 'multiple-response'].includes(q.questionType),
      `question ${q.id} has invalid questionType: ${q.questionType}`);
    check(typeof q.question === 'string' && q.question.length > 0, `question ${q.id} missing question text`);
    check(Array.isArray(q.options) && q.options.length >= 4, `question ${q.id} must have at least 4 options`);
    check(Array.isArray(q.correctIndexes) && q.correctIndexes.length > 0,
      `question ${q.id} must have at least 1 correct index`);
    for (const idx of q.correctIndexes) {
      check(Number.isInteger(idx) && idx >= 0 && idx < q.options.length,
        `question ${q.id} has out-of-range correctIndex: ${idx}`);
    }
    if (q.questionType === 'multiple-choice') {
      check(q.correctIndexes.length === 1, `multiple-choice question ${q.id} must have exactly 1 correct answer`);
      check(q.options.length === 4, `multiple-choice question ${q.id} must have exactly 4 options`);
    } else {
      check(q.correctIndexes.length >= 2, `multiple-response question ${q.id} must have at least 2 correct answers`);
      check(q.options.length >= 5, `multiple-response question ${q.id} must have at least 5 options`);
    }
    check(typeof q.explanation === 'string' && q.explanation.length >= 20, `question ${q.id} missing explanation`);
  }
}

async function validateFlashcards() {
  if (!existsSync(new URL('../js/data/flashcards.js', import.meta.url))) {
    console.log('flashcards.js not present yet, skipping');
    return;
  }
  const { FLASHCARDS } = await import('../js/data/flashcards.js');
  check(Array.isArray(FLASHCARDS) && FLASHCARDS.length > 0, 'FLASHCARDS must be a non-empty array');
  const seenIds = new Set();
  for (const c of FLASHCARDS) {
    check(!seenIds.has(c.id), `duplicate flashcard id: ${c.id}`);
    seenIds.add(c.id);
    check(typeof c.service === 'string' && c.service.length > 0, `flashcard ${c.id} missing service`);
    check(typeof c.front === 'string' && c.front.length > 0, `flashcard ${c.id} missing front`);
    check(typeof c.back === 'string' && c.back.length >= 20, `flashcard ${c.id} missing back`);
  }
}

async function main() {
  const domains = await validateExamInfo();
  const domainIds = domains.map((d) => d.id);
  await validateStudyContent(domainIds);
  await validateQuestions(domainIds);
  await validateFlashcards();

  if (errors.length > 0) {
    console.error(`\n${errors.length} validation error(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('All content validated successfully.');
}

main();
