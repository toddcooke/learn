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

async function validateQuestions(domains) {
  if (!existsSync(new URL('../js/data/questions.js', import.meta.url))) {
    console.log('questions.js not present yet, skipping');
    return;
  }
  const domainIds = domains.map((d) => d.id);
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
    check(new Set(q.correctIndexes).size === q.correctIndexes.length,
      `question ${q.id} has duplicate correctIndexes: ${q.correctIndexes}`);
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
  // drawMockExam takes pool.slice(0, d.mockExamCount) per domain, so a pool
  // smaller than mockExamCount silently shortens the mock exam.
  for (const d of domains) {
    const supply = QUESTIONS.filter((q) => q.domain === d.id).length;
    check(supply >= d.mockExamCount,
      `domain ${d.id} has ${supply} questions but mockExamCount is ${d.mockExamCount}`);
  }
}

async function validateFlashcards() {
  if (!existsSync(new URL('../js/data/flashcards.js', import.meta.url))) {
    console.log('flashcards.js not present yet, skipping');
    return;
  }
  const { FLASHCARDS, FLASHCARD_DOMAINS } = await import('../js/data/flashcards.js');
  check(Array.isArray(FLASHCARDS) && FLASHCARDS.length > 0, 'FLASHCARDS must be a non-empty array');
  check(Array.isArray(FLASHCARD_DOMAINS) && FLASHCARD_DOMAINS.length > 0,
    'FLASHCARD_DOMAINS must be a non-empty array');
  const cardDomains = Array.isArray(FLASHCARD_DOMAINS) ? FLASHCARD_DOMAINS : [];
  check(new Set(cardDomains).size === cardDomains.length,
    `FLASHCARD_DOMAINS has duplicate entries: ${cardDomains.join(', ')}`);
  const seenIds = new Set();
  for (const c of FLASHCARDS) {
    check(!seenIds.has(c.id), `duplicate flashcard id: ${c.id}`);
    seenIds.add(c.id);
    check(typeof c.service === 'string' && c.service.length > 0, `flashcard ${c.id} missing service`);
    check(typeof c.domain === 'string' && c.domain.length > 0, `flashcard ${c.id} missing domain`);
    check(cardDomains.includes(c.domain),
      `flashcard ${c.id} domain not in FLASHCARD_DOMAINS: ${c.domain}`);
    check(typeof c.front === 'string' && c.front.length > 0, `flashcard ${c.id} missing front`);
    check(typeof c.back === 'string' && c.back.length >= 20, `flashcard ${c.id} missing back`);
  }
}

async function validateServices() {
  if (!existsSync(new URL('../js/data/services.js', import.meta.url))) {
    console.log('services.js not present yet, skipping');
    return;
  }
  const { SERVICES } = await import('../js/data/services.js');
  const { FLASHCARDS, FLASHCARD_DOMAINS } = await import('../js/data/flashcards.js');
  check(Array.isArray(SERVICES) && SERVICES.length > 0, 'SERVICES must be a non-empty array');
  const seenIds = new Set();
  const seenNames = new Set();
  const covered = new Set();
  for (const s of SERVICES) {
    check(typeof s.id === 'string' && s.id.length > 0,
      `service missing id: ${JSON.stringify(s).slice(0, 80)}`);
    check(!seenIds.has(s.id), `duplicate service id: ${s.id}`);
    seenIds.add(s.id);
    check(typeof s.name === 'string' && s.name.length > 0, `service ${s.id} missing name`);
    check(!seenNames.has(s.name), `duplicate service name: ${s.name}`);
    seenNames.add(s.name);
    check(FLASHCARD_DOMAINS.includes(s.domain) && s.domain !== 'Best-Fit Scenarios',
      `service ${s.id} has invalid domain: ${s.domain}`);
    check(typeof s.blurb === 'string' && s.blurb.length >= 20 && s.blurb.length <= 220,
      `service ${s.id} blurb must be 20-220 chars, got ${typeof s.blurb === 'string' ? s.blurb.length : 'none'}`);
    covered.add(s.name);
    if (s.covers !== undefined) {
      check(Array.isArray(s.covers) && s.covers.length > 0
        && s.covers.every((c) => typeof c === 'string' && c.length > 0),
        `service ${s.id} covers must be a non-empty array of non-empty strings`);
      for (const c of Array.isArray(s.covers) ? s.covers : []) covered.add(c);
    }
  }
  // Drift guard: every service the flashcard deck names must appear on the
  // services page, either as an entry's name or in its covers list.
  const deckServices = new Set(
    FLASHCARDS.map((c) => c.service).filter((svc) => svc !== 'Best-Fit Scenario'));
  for (const svc of deckServices) {
    check(covered.has(svc), `flashcard service not covered by services.js: ${svc}`);
  }
  // Reverse check: covers aliases must name real deck services, so renamed
  // or removed flashcards can't leave stale aliases behind.
  for (const s of SERVICES) {
    for (const c of s.covers ?? []) {
      check(deckServices.has(c), `service ${s.id} covers unknown flashcard service: ${c}`);
    }
  }
}

async function validateSvcChallenges() {
  if (!existsSync(new URL('../js/data/svcChallenges.js', import.meta.url))) {
    console.log('svcChallenges.js not present yet, skipping');
    return;
  }
  const { SVC_CHALLENGES } = await import('../js/data/svcChallenges.js');
  const { GOAL_TYPES } = await import('../js/lib/svcGoals.js');
  const { BEST_PRACTICE_RULE_IDS } = await import('../js/lib/svcValidate.js');
  const { SERVICE_IDS } = await import('../js/lib/svcCatalog.js');
  check(Array.isArray(SVC_CHALLENGES) && SVC_CHALLENGES.length > 0,
    'SVC_CHALLENGES must be a non-empty array');
  const kebabCase = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  // One selector-shaped field per goal key; each must be { service } with a
  // known service id or { role } with a role declared by the challenge.
  const SELECTOR_KEYS = { exists: ['sel'], edge: ['from', 'to'], linked: ['a', 'b'], noEdge: ['from', 'to'], path: ['from', 'to'], fanout: ['from'] };
  const seenIds = new Set();
  for (const c of Array.isArray(SVC_CHALLENGES) ? SVC_CHALLENGES : []) {
    check(typeof c.id === 'string' && c.id.length > 0 && kebabCase.test(c.id),
      `challenge has invalid id (must be non-empty kebab-case): ${JSON.stringify(c.id)}`);
    check(!seenIds.has(c.id), `duplicate challenge id: ${c.id}`);
    seenIds.add(c.id);
    check(typeof c.title === 'string' && c.title.length > 0, `challenge ${c.id} missing title`);
    check(typeof c.brief === 'string' && c.brief.length >= 80,
      `challenge ${c.id} brief must be at least 80 chars, got ${typeof c.brief === 'string' ? c.brief.length : 'none'}`);

    check(Array.isArray(c.roles), `challenge ${c.id} roles must be an array`);
    const roles = Array.isArray(c.roles) ? c.roles : [];
    const roleIds = new Set();
    for (const r of roles) {
      check(typeof r.id === 'string' && r.id.length > 0,
        `challenge ${c.id} has a role with missing id: ${JSON.stringify(r).slice(0, 80)}`);
      check(typeof r.label === 'string' && r.label.length > 0,
        `challenge ${c.id} role ${r.id} missing label`);
      check(!roleIds.has(r.id), `challenge ${c.id} has duplicate role id: ${r.id}`);
      roleIds.add(r.id);
      check(SERVICE_IDS.includes(r.service),
        `challenge ${c.id} role ${r.id} has invalid service: ${r.service}`);
    }

    const referencedRoles = new Set();
    const checkSelector = (g, key, sel) => {
      if (sel && typeof sel.service === 'string') {
        check(SERVICE_IDS.includes(sel.service),
          `challenge ${c.id} goal (${g.type}) ${key} names unknown service "${sel.service}"`);
      } else if (sel && typeof sel.role === 'string') {
        referencedRoles.add(sel.role);
        check(roleIds.has(sel.role),
          `challenge ${c.id} goal (${g.type}) ${key} references unknown role "${sel.role}"`);
      } else {
        check(false, `challenge ${c.id} goal (${g.type}) ${key} must be { service } or { role }`);
      }
    };
    check(Array.isArray(c.goals) && c.goals.length > 0, `challenge ${c.id} goals must be a non-empty array`);
    for (const g of Array.isArray(c.goals) ? c.goals : []) {
      check(GOAL_TYPES.includes(g.type),
        `challenge ${c.id} has a goal with unknown type: ${g.type}`);
      for (const key of SELECTOR_KEYS[g.type] ?? []) checkSelector(g, key, g[key]);
      if (g.type === 'path') {
        check(g.via === undefined || Array.isArray(g.via),
          `challenge ${c.id} path goal via must be an array when present`);
        for (const sel of Array.isArray(g.via) ? g.via : []) checkSelector(g, 'via', sel);
      }
      if (g.type === 'fanout') {
        check(typeof g.min === 'number' && g.min >= 2,
          `challenge ${c.id} fanout goal needs numeric min >= 2`);
      }
      if (g.type === 'exists') {
        check(g.service === undefined || SERVICE_IDS.includes(g.service),
          `challenge ${c.id} exists goal has unknown service: ${g.service}`);
        check(g.min === undefined || (typeof g.min === 'number' && g.min >= 1),
          `challenge ${c.id} exists goal min must be a number >= 1`);
      }
    }

    check(c.bestPractices === 'all'
      || (Array.isArray(c.bestPractices) && c.bestPractices.length > 0
        && c.bestPractices.every((id) => BEST_PRACTICE_RULE_IDS.includes(id))),
      `challenge ${c.id} bestPractices must be 'all' or a non-empty array of known rule ids`);

    check(Array.isArray(c.hints) && c.hints.length > 0
      && c.hints.every((h) => typeof h === 'string' && h.length > 0),
      `challenge ${c.id} hints must be a non-empty array of non-empty strings`);

    check(typeof c.refSolution === 'function', `challenge ${c.id} refSolution must be a function`);
    check(c.startState === null || typeof c.startState === 'function',
      `challenge ${c.id} startState must be null or a function`);

    for (const rid of roleIds) {
      check(referencedRoles.has(rid),
        `challenge ${c.id} role "${rid}" is not referenced by any goal`);
    }
  }
}

async function main() {
  const domains = await validateExamInfo();
  const domainIds = domains.map((d) => d.id);
  await validateStudyContent(domainIds);
  await validateQuestions(domains);
  await validateFlashcards();
  await validateServices();
  await validateSvcChallenges();

  if (errors.length > 0) {
    console.error(`\n${errors.length} validation error(s):`);
    errors.forEach((e) => console.error(`  - ${e}`));
    process.exit(1);
  }
  console.log('All content validated successfully.');
}

main();
