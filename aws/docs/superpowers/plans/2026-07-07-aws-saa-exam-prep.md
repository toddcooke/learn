# AWS SAA-C03 Exam Prep Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, locally-served website that teaches the AWS Certified Solutions Architect – Associate (SAA-C03) exam content and lets someone practice with 100+ verified questions, flashcards, and a timed mock exam.

**Architecture:** Vanilla HTML/CSS/JS, no build step. A hash-based router in `js/app.js` mounts one of six view modules into `#app-content`. Content (exam info, study notes, questions, flashcards) lives in plain ES module data files under `js/data/`, sourced from the official AWS exam guide and AWS service docs and adversarially verified before being added. Browser state (quiz history, flashcard mastery, mock exam attempts) persists to `localStorage` via `js/lib/storage.js`. The site is served with `python3 -m http.server` (not opened via `file://`) because Chrome blocks ES module imports over `file://`.

**Tech Stack:** No frameworks, no npm, no build tooling. Node.js (already installed) is used only for two standalone helper scripts (`scripts/fetch-doc.mjs`, `scripts/validate-content.mjs`) and for `node --test` unit tests of pure logic modules — never for the shipped site itself, which runs as plain ES modules in the browser.

## Global Constraints

- No npm/build tooling of any kind. Node is used only via its built-ins (`node`, `node --test`, `fetch`, `fs`) for helper scripts and tests — never a dependency in `package.json`, because there is no `package.json`.
- The site is served via `python3 -m http.server` for local use, not opened via `file://` (ES module imports are blocked by browsers under `file://`).
- All exam content (study notes, questions, flashcards) lives in `js/data/*.js` as ES module exports — no `fetch()` of JSON at runtime.
- Every question in `js/data/questions.js` must satisfy `node scripts/validate-content.mjs` and must have been adversarially verified against the cached source AWS docs before being added (see Task 5's verification method — the same method applies to every question task).
- Total practice question count must reach **at least 100** (per the approved spec's "Large bank" choice), distributed roughly by domain weight: Secure ≥30, Resilient ≥26, High-Performing ≥24, Cost-Optimized ≥20.
- Exam domains, weights, and format constants are fixed per the official SAA-C03 exam guide as fetched 2026-07-07 (recorded in the design spec) — do not alter `DOMAINS`/`EXAM_FORMAT` values without re-checking the source.
- No user accounts, auth, or backend. All persistence is `localStorage`, namespaced under the `saa-prep:` key prefix via `js/lib/storage.js`.
- Every AWS doc page fetched during content research must go through `scripts/fetch-doc.mjs`, which checks `.cache/aws-docs/index.json` first and only hits the network on a cache miss. `.cache/` is gitignored.
- Reference spec: [docs/superpowers/specs/2026-07-07-aws-saa-exam-prep-design.md](../specs/2026-07-07-aws-saa-exam-prep-design.md).

---

## Task 1: Project scaffold — shell, router, base styles, view stubs

**Files:**
- Create: `index.html`
- Create: `css/style.css`
- Create: `js/app.js`
- Create: `js/views/home.js`
- Create: `js/views/studyGuide.js`
- Create: `js/views/quiz.js`
- Create: `js/views/flashcards.js`
- Create: `js/views/mockExam.js`
- Create: `js/views/progress.js`
- Create: `README.md`
- Create: `.claude/launch.json`

**Interfaces:**
- Produces: every `js/views/*.js` module exports `function render(mount, ...params)` where `mount` is the DOM element to populate and `params` are the hash-route segments after the view name (e.g. `#/quiz/secure` → `render(mount, 'secure')`). Every later task that touches a view file must preserve this exported signature — `js/app.js` calls all six identically.

- [ ] **Step 1: Create the six view stub modules**

Each of `js/views/home.js`, `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/mockExam.js`, `js/views/progress.js` gets this content (only the visible label differs):

```js
// js/views/home.js
export function render(mount) {
  mount.innerHTML = '<p>Coming soon.</p>';
}
```

(Repeat verbatim for the other five files — they'll be replaced with real implementations in later tasks. `studyGuide.js`, `quiz.js` will eventually accept a domain-id parameter, but the stub ignores extra params.)

- [ ] **Step 2: Create the router**

```js
// js/app.js
import { render as renderHome } from './views/home.js';
import { render as renderStudyGuide } from './views/studyGuide.js';
import { render as renderQuiz } from './views/quiz.js';
import { render as renderFlashcards } from './views/flashcards.js';
import { render as renderMockExam } from './views/mockExam.js';
import { render as renderProgress } from './views/progress.js';

const VIEWS = {
  home: renderHome,
  study: renderStudyGuide,
  quiz: renderQuiz,
  flashcards: renderFlashcards,
  exam: renderMockExam,
  progress: renderProgress,
};

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [view, ...params] = hash.split('/').filter(Boolean);
  return { view: view || 'home', params };
}

function highlightNav(view) {
  document.querySelectorAll('#nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === view);
  });
}

function renderRoute() {
  const { view, params } = parseHash();
  const mount = document.getElementById('app-content');
  const renderFn = VIEWS[view] || renderHome;
  mount.innerHTML = '';
  renderFn(mount, ...params);
  highlightNav(VIEWS[view] ? view : 'home');
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('DOMContentLoaded', renderRoute);
```

- [ ] **Step 3: Create the HTML shell**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>AWS SAA-C03 Exam Prep</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="site-header">
    <h1>AWS Solutions Architect – Associate Prep</h1>
    <nav id="nav">
      <a href="#/" data-view="home">Home</a>
      <a href="#/study" data-view="study">Study Guide</a>
      <a href="#/quiz" data-view="quiz">Quizzes</a>
      <a href="#/flashcards" data-view="flashcards">Flashcards</a>
      <a href="#/exam" data-view="exam">Mock Exam</a>
      <a href="#/progress" data-view="progress">Progress</a>
    </nav>
  </header>
  <main id="app-content"></main>
  <footer class="site-footer">
    <p>Unofficial study aid. Not affiliated with or endorsed by AWS.</p>
  </footer>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create the base stylesheet**

```css
/* css/style.css */
:root {
  --color-bg: #ffffff;
  --color-text: #1a1a2e;
  --color-muted: #5a6472;
  --color-border: #e2e5e9;
  --color-primary: #2563eb;
  --color-primary-dark: #1d4ed8;
  --color-success: #16a34a;
  --color-danger: #dc2626;
  --font-sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
}

* { box-sizing: border-box; }

body {
  margin: 0;
  font-family: var(--font-sans);
  color: var(--color-text);
  background: var(--color-bg);
  line-height: 1.5;
}

.site-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 1rem 2rem;
  border-bottom: 1px solid var(--color-border);
  flex-wrap: wrap;
  gap: 1rem;
}

.site-header h1 { font-size: 1.1rem; margin: 0; }

#nav { display: flex; gap: 1.25rem; flex-wrap: wrap; }

#nav a { color: var(--color-muted); text-decoration: none; font-weight: 500; }

#nav a.active, #nav a:hover { color: var(--color-primary); }

#app-content { max-width: 960px; margin: 0 auto; padding: 2rem; min-height: 60vh; }

.site-footer {
  text-align: center;
  color: var(--color-muted);
  font-size: 0.85rem;
  padding: 1.5rem;
  border-top: 1px solid var(--color-border);
}

button {
  font: inherit;
  cursor: pointer;
  border-radius: 6px;
  border: 1px solid var(--color-border);
  background: var(--color-primary);
  color: #fff;
  padding: 0.5rem 1rem;
}

button:hover { background: var(--color-primary-dark); }

button.secondary { background: #fff; color: var(--color-text); }

button.secondary:hover { background: #f3f4f6; }

button:disabled { opacity: 0.6; cursor: not-allowed; }

.domain-list { list-style: none; padding: 0; }

.domain-list li { padding: 0.5rem 0; border-bottom: 1px solid var(--color-border); }
```

- [ ] **Step 5: Create the launch config for the preview server**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "site",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8000"],
      "port": 8000
    }
  ]
}
```

Save as `.claude/launch.json`.

- [ ] **Step 6: Create the README stub**

```markdown
# AWS SAA-C03 Exam Prep

An unofficial study site for the AWS Certified Solutions Architect – Associate (SAA-C03) exam. Not affiliated with or endorsed by AWS.

Status: under construction.
```

- [ ] **Step 7: Verify in the browser**

Start the server (via the preview tool's `preview_start` with name `site`, or manually with `python3 -m http.server 8000`), then load `http://localhost:8000/`.

Expected: page loads with the header, nav links, and "Coming soon." in the content area. Clicking each nav link changes the URL hash and keeps showing "Coming soon." with that link highlighted (bold/blue). Check the browser console (`preview_console_logs`) — expect no errors.

- [ ] **Step 8: Commit**

```bash
git add index.html css/style.css js/app.js js/views README.md .claude/launch.json
git commit -m "Add site scaffold: shell, router, base styles, view stubs"
```

---

## Task 2: Core infrastructure — exam data, storage, scoring, and content tooling

**Files:**
- Create: `js/data/examInfo.js`
- Create: `js/lib/storage.js`
- Create: `js/lib/storage.test.mjs`
- Create: `js/lib/scoring.js`
- Create: `js/lib/scoring.test.mjs`
- Create: `scripts/fetch-doc.mjs`
- Create: `scripts/validate-content.mjs`

**Interfaces:**
- Produces: `DOMAINS` (array of `{id, name, weight, mockExamCount}`) and `EXAM_FORMAT` (`{totalQuestions, scoredQuestions, unscoredQuestions, durationMinutes, passingScore, minScore, maxScore}`) from `js/data/examInfo.js` — every later data and view file imports these.
- Produces: `createStore(backend = globalThis.localStorage)` from `js/lib/storage.js`, returning `{getQuizHistory, recordQuizAttempt, getFlashcardState, setFlashcardKnown, getMockExamHistory, recordMockExamAttempt}`.
- Produces: `isCorrect(question, selectedIndexes)`, `estimateScaledScore(correctCount, totalCount, opts?)`, `drawMockExam(questions, domains)` from `js/lib/scoring.js`.
- Produces: `node scripts/fetch-doc.mjs <url>` — prints the path to a cached, verbatim-where-possible text copy of `<url>`, fetching only on a cache miss.
- Produces: `node scripts/validate-content.mjs` — exits 0 and prints "All content validated successfully." when every present `js/data/*.js` file matches its schema; otherwise exits 1 and lists every problem. Skips (with a log line) any data file that doesn't exist yet.

- [ ] **Step 1: Write the exam info data**

```js
// js/data/examInfo.js
export const DOMAINS = [
  { id: 'secure', name: 'Design Secure Architectures', weight: 30, mockExamCount: 20 },
  { id: 'resilient', name: 'Design Resilient Architectures', weight: 26, mockExamCount: 16 },
  { id: 'performant', name: 'Design High-Performing Architectures', weight: 24, mockExamCount: 16 },
  { id: 'cost', name: 'Design Cost-Optimized Architectures', weight: 20, mockExamCount: 13 },
];

export const EXAM_FORMAT = {
  totalQuestions: 65,
  scoredQuestions: 50,
  unscoredQuestions: 15,
  durationMinutes: 130,
  passingScore: 720,
  minScore: 100,
  maxScore: 1000,
};
```

(`weight` sums to 100; `mockExamCount` sums to 65 — both are checked by the validator in Step 6.)

- [ ] **Step 2: Write the storage library**

```js
// js/lib/storage.js
const NAMESPACE = 'saa-prep';

function load(backend, key, fallback) {
  const raw = backend.getItem(`${NAMESPACE}:${key}`);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(backend, key, value) {
  backend.setItem(`${NAMESPACE}:${key}`, JSON.stringify(value));
}

export function createStore(backend = globalThis.localStorage) {
  return {
    getQuizHistory() {
      return load(backend, 'quiz-history', []);
    },
    recordQuizAttempt(attempt) {
      const history = load(backend, 'quiz-history', []);
      history.push(attempt);
      save(backend, 'quiz-history', history);
    },
    getFlashcardState() {
      return load(backend, 'flashcard-state', {});
    },
    setFlashcardKnown(cardId, known) {
      const state = load(backend, 'flashcard-state', {});
      state[cardId] = known;
      save(backend, 'flashcard-state', state);
    },
    getMockExamHistory() {
      return load(backend, 'mock-exam-history', []);
    },
    recordMockExamAttempt(attempt) {
      const history = load(backend, 'mock-exam-history', []);
      history.push(attempt);
      save(backend, 'mock-exam-history', history);
    },
  };
}
```

- [ ] **Step 3: Write and run the storage test**

```js
// js/lib/storage.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './storage.js';

function fakeBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('quiz history starts empty and records attempts', () => {
  const store = createStore(fakeBackend());
  assert.deepEqual(store.getQuizHistory(), []);
  store.recordQuizAttempt({ domain: 'secure', score: 8, total: 10 });
  assert.equal(store.getQuizHistory().length, 1);
  assert.equal(store.getQuizHistory()[0].domain, 'secure');
});

test('flashcard known state persists per card', () => {
  const store = createStore(fakeBackend());
  assert.deepEqual(store.getFlashcardState(), {});
  store.setFlashcardKnown('ec2', true);
  assert.equal(store.getFlashcardState().ec2, true);
});

test('mock exam history records attempts', () => {
  const store = createStore(fakeBackend());
  store.recordMockExamAttempt({ score: 780, correct: 50, total: 65 });
  assert.equal(store.getMockExamHistory().length, 1);
  assert.equal(store.getMockExamHistory()[0].score, 780);
});
```

Run: `node --test js/lib/storage.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 4: Write the scoring library**

```js
// js/lib/scoring.js
export function isCorrect(question, selectedIndexes) {
  const a = [...selectedIndexes].sort((x, y) => x - y);
  const b = [...question.correctIndexes].sort((x, y) => x - y);
  return a.length === b.length && a.every((v, i) => v === b[i]);
}

export function estimateScaledScore(correctCount, totalCount, { minScore = 100, maxScore = 1000 } = {}) {
  if (totalCount === 0) return minScore;
  const fraction = correctCount / totalCount;
  return Math.round(minScore + fraction * (maxScore - minScore));
}

function shuffle(array) {
  const result = [...array];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

export function drawMockExam(questions, domains) {
  const drawn = [];
  for (const domain of domains) {
    const pool = shuffle(questions.filter((q) => q.domain === domain.id));
    drawn.push(...pool.slice(0, domain.mockExamCount));
  }
  return shuffle(drawn);
}
```

- [ ] **Step 5: Write and run the scoring test**

```js
// js/lib/scoring.test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { isCorrect, estimateScaledScore, drawMockExam } from './scoring.js';

test('isCorrect matches regardless of selection order', () => {
  const q = { correctIndexes: [1, 3] };
  assert.equal(isCorrect(q, [3, 1]), true);
  assert.equal(isCorrect(q, [1, 2]), false);
  assert.equal(isCorrect(q, [1]), false);
});

test('estimateScaledScore maps 0% to minScore and 100% to maxScore', () => {
  assert.equal(estimateScaledScore(0, 65), 100);
  assert.equal(estimateScaledScore(65, 65), 1000);
});

test('drawMockExam pulls the configured count per domain', () => {
  const domains = [
    { id: 'a', mockExamCount: 2 },
    { id: 'b', mockExamCount: 1 },
  ];
  const questions = [
    { id: 'a1', domain: 'a' }, { id: 'a2', domain: 'a' }, { id: 'a3', domain: 'a' },
    { id: 'b1', domain: 'b' }, { id: 'b2', domain: 'b' },
  ];
  const exam = drawMockExam(questions, domains);
  assert.equal(exam.length, 3);
  assert.equal(exam.filter((q) => q.domain === 'a').length, 2);
  assert.equal(exam.filter((q) => q.domain === 'b').length, 1);
});
```

Run: `node --test js/lib/scoring.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 6: Write the doc-fetch cache script**

```js
// scripts/fetch-doc.mjs
// Usage: node scripts/fetch-doc.mjs <url>
// Fetches a doc page (preferring the verbatim markdown sibling that
// docs.aws.amazon.com pages expose at the same path with .html replaced
// by .md), caches it under .cache/aws-docs/, and prints the cached path.
// Re-running with the same URL reuses the cache instead of hitting the
// network again.
import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import path from 'node:path';

const CACHE_DIR = '.cache/aws-docs';
const INDEX_PATH = path.join(CACHE_DIR, 'index.json');

function slugify(url) {
  return url
    .replace(/^https?:\/\//, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .toLowerCase();
}

function stripHtml(html) {
  const body = html
    .replace(/^[\s\S]*?<body[^>]*>/i, '')
    .replace(/<\/body>[\s\S]*$/i, '');
  return body
    .replace(/<(script|style|nav|footer|header)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<(h[1-6]|p|li|br|tr|div)[^>]*>/gi, '\n')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

async function fetchText(url) {
  const res = await fetch(url, { headers: { 'User-Agent': 'Mozilla/5.0' } });
  if (!res.ok) return null;
  return res.text();
}

async function loadIndex() {
  if (!existsSync(INDEX_PATH)) return {};
  return JSON.parse(await readFile(INDEX_PATH, 'utf8'));
}

async function main() {
  const url = process.argv[2];
  if (!url) {
    console.error('Usage: node scripts/fetch-doc.mjs <url>');
    process.exit(1);
  }

  await mkdir(CACHE_DIR, { recursive: true });
  const index = await loadIndex();
  const slug = slugify(url);
  const filePath = path.join(CACHE_DIR, `${slug}.md`);

  if (index[url] && existsSync(filePath)) {
    console.log(filePath);
    return;
  }

  let content = null;
  const isAwsDocsHtml = /^https:\/\/docs\.aws\.amazon\.com\/.*\.html$/.test(url);
  if (isAwsDocsHtml) {
    content = await fetchText(url.replace(/\.html$/, '.md'));
  }
  if (content === null) {
    const html = await fetchText(url);
    if (html === null) {
      console.error(`Fetch failed for ${url}`);
      process.exit(1);
    }
    content = stripHtml(html);
  }

  await writeFile(filePath, content, 'utf8');
  index[url] = { slug, fetchedAt: new Date().toISOString().slice(0, 10) };
  await writeFile(INDEX_PATH, JSON.stringify(index, null, 2), 'utf8');
  console.log(filePath);
}

main();
```

Run: `node scripts/fetch-doc.mjs https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html`
Expected: prints a path under `.cache/aws-docs/`, and `cat` of that path shows the "What is IAM?" markdown content. Running the exact same command again prints the same path near-instantly (cache hit, no fetch).

Note: `.cache/aws-docs/` already contains 8 pages fetched during planning (the top-level cert page, the exam guide index, all 4 domain pages, and the in-scope/out-of-scope service lists) — running `fetch-doc.mjs` on any of those exact URLs should hit the cache immediately. Their URLs are listed in `.cache/aws-docs/index.json`.

- [ ] **Step 7: Write the content validator**

```js
// scripts/validate-content.mjs
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
  check(Array.isArray(DOMAINS) && DOMAINS.length === 4, 'DOMAINS must have exactly 4 entries');
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
  check(EXAM_FORMAT.totalQuestions === EXAM_FORMAT.scoredQuestions + EXAM_FORMAT.unscoredQuestions,
    'EXAM_FORMAT.totalQuestions must equal scoredQuestions + unscoredQuestions');
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
```

Run: `node scripts/validate-content.mjs`
Expected: `studyContent.js not present yet, skipping`, `questions.js not present yet, skipping`, `flashcards.js not present yet, skipping`, then `All content validated successfully.` (exit 0).

- [ ] **Step 8: Commit**

```bash
git add js/data/examInfo.js js/lib/storage.js js/lib/storage.test.mjs js/lib/scoring.js js/lib/scoring.test.mjs scripts/fetch-doc.mjs scripts/validate-content.mjs
git commit -m "Add exam data, storage/scoring libs, and content tooling"
```

---

## Task 3: Home view

**Files:**
- Modify: `js/views/home.js`

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js` (Task 2).

- [ ] **Step 1: Replace the stub with the real home view**

```js
// js/views/home.js
import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About the Exam</h2>
      <p>AWS Certified Solutions Architect – Associate (SAA-C03)</p>
      <ul class="exam-facts">
        <li>${EXAM_FORMAT.totalQuestions} questions (${EXAM_FORMAT.scoredQuestions} scored, ${EXAM_FORMAT.unscoredQuestions} unscored)</li>
        <li>${EXAM_FORMAT.durationMinutes}-minute time limit</li>
        <li>Scaled score ${EXAM_FORMAT.minScore}–${EXAM_FORMAT.maxScore}, passing score ${EXAM_FORMAT.passingScore}</li>
      </ul>
      <h3>Domains</h3>
      <ul class="domain-list">
        ${DOMAINS.map((d) => `<li><a href="#/study/${d.id}">${d.name}</a> — ${d.weight}%</li>`).join('')}
      </ul>
      <h3>How to use this site</h3>
      <ol>
        <li>Read the <a href="#/study">Study Guide</a> for each domain.</li>
        <li>Test yourself with <a href="#/quiz">domain quizzes</a>.</li>
        <li>Drill weak spots with <a href="#/flashcards">flashcards</a>.</li>
        <li>Simulate exam day with the <a href="#/exam">mock exam</a>.</li>
        <li>Track improvement on the <a href="#/progress">progress dashboard</a>.</li>
      </ol>
    </section>
  `;
}
```

- [ ] **Step 2: Verify in the browser**

Reload `http://localhost:8000/#/`. Expected: the exam facts (65 questions, 130-minute limit, 100–1000 score, 720 passing) and all 4 domains with their weights (30/26/24/20) render. Clicking a domain link navigates to `#/study/<id>` (still "Coming soon" until Task 13).

- [ ] **Step 3: Commit**

```bash
git add js/views/home.js
git commit -m "Implement home view with exam overview"
```

---

## Task 4: Domain 1 (Secure) — study content

**Files:**
- Create: `js/data/studyContent.js`

**Interfaces:**
- Consumes: `domain: 'secure'` id from `js/data/examInfo.js`.
- Produces: `STUDY_CONTENT` array (consumed by `validateStudyContent` in Task 2's validator, and by `js/views/studyGuide.js` in Task 13).

This domain covers 3 task statements from the official exam guide (fetched 2026-07-07, already cached at `.cache/aws-docs/docs-aws-amazon-com-aws-certification-latest-solutions-architect-associate-03-solutions-architect-associate-03-domain1-html.md`):

- **Task 1.1: Design secure access to AWS resources** — Knowledge of: access controls across multiple accounts; AWS federated access/identity (IAM, IAM Identity Center); AWS global infrastructure; least privilege; shared responsibility model. Skills in: MFA for IAM/root users; flexible IAM authorization (users/groups/roles/policies); role-based access (STS, role switching, cross-account); multi-account security strategy (Control Tower, SCPs); resource policies; federating a directory service with IAM roles.
- **Task 1.2: Design secure workloads and applications** — Knowledge of: application config/credential security; AWS service endpoints; controlling ports/protocols/traffic; secure application access; security services (Cognito, GuardDuty, Macie); external threat vectors (DDoS, SQL injection). Skills in: VPC security components (security groups, route tables, NACLs, NAT gateways); network segmentation (public/private subnets); Shield, WAF, IAM Identity Center, Secrets Manager; securing external connections (VPN, Direct Connect).
- **Task 1.3: Determine appropriate data security controls** — Knowledge of: data access/governance; data recovery; retention/classification; encryption and key management. Skills in: compliance alignment; encrypting data at rest (KMS); encrypting data in transit (ACM/TLS); access policies for encryption keys; backups/replication; data lifecycle/protection policies; key rotation and certificate renewal.

- [ ] **Step 1: Fetch supporting service docs**

The domain task-statement page is already cached (see path above). Fetch these service overview pages via `node scripts/fetch-doc.mjs <url>` (if any 404s, use WebSearch for "<service> what is AWS documentation" and fetch the correct current URL instead):

- `https://docs.aws.amazon.com/IAM/latest/UserGuide/introduction.html` (already cached from Task 2's Step 6 test run)
- `https://docs.aws.amazon.com/singlesignon/latest/userguide/what-is.html` (IAM Identity Center)
- `https://docs.aws.amazon.com/organizations/latest/userguide/orgs_introduction.html` (Organizations/SCPs)
- `https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_temp.html` (STS)
- `https://docs.aws.amazon.com/cognito/latest/developerguide/what-is-amazon-cognito.html`
- `https://docs.aws.amazon.com/guardduty/latest/ug/what-is-guardduty.html`
- `https://docs.aws.amazon.com/macie/latest/user/what-is-macie.html`
- `https://docs.aws.amazon.com/waf/latest/developerguide/shield-chapter.html` (Shield)
- `https://docs.aws.amazon.com/waf/latest/developerguide/what-is-aws-waf.html`
- `https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html`
- `https://docs.aws.amazon.com/kms/latest/developerguide/overview.html`
- `https://docs.aws.amazon.com/acm/latest/userguide/acm-overview.html`
- `https://docs.aws.amazon.com/vpc/latest/userguide/what-is-amazon-vpc.html` (for security groups/NACLs/NAT gateway sections)

- [ ] **Step 2: Write study notes grounded in the fetched docs**

Create `js/data/studyContent.js` with one section per task statement above (`domain: 'secure'`), each with 3–6 `topics` (prose paragraphs, not copied bullet lists) covering every "Knowledge of" and "Skills in" item listed for that task statement, grounded in the docs fetched in Step 1:

```js
// js/data/studyContent.js
export const STUDY_CONTENT = [
  {
    domain: 'secure',
    taskStatement: 'Task 1.1: Design secure access to AWS resources',
    topics: [
      // { title: '...', body: '...' } — write these from the fetched IAM,
      // IAM Identity Center, Organizations, and STS docs. Cover: IAM
      // users/groups/roles/policies, MFA, least privilege, the shared
      // responsibility model, SCPs and Control Tower for multi-account
      // security, role switching and cross-account access via STS, and
      // when to federate an external directory with IAM roles.
    ],
  },
  {
    domain: 'secure',
    taskStatement: 'Task 1.2: Design secure workloads and applications',
    topics: [
      // Cover: VPC security groups vs. NACLs vs. NAT gateways, public vs.
      // private subnet segmentation, Shield/WAF for external threats,
      // Cognito for app-user identity, GuardDuty/Macie for threat and
      // sensitive-data detection, Secrets Manager for app credentials,
      // and VPN/Direct Connect for secure external connectivity.
    ],
  },
  {
    domain: 'secure',
    taskStatement: 'Task 1.3: Determine appropriate data security controls',
    topics: [
      // Cover: encryption at rest with KMS (including key rotation and
      // key access policies), encryption in transit with ACM/TLS
      // (including certificate renewal), backup/replication strategies,
      // and data lifecycle/retention/classification policies.
    ],
  },
];
```

Replace each comment with 3–6 real `{ title, body }` topic objects (body ≥ 2–3 sentences each, in your own words, factually grounded in the fetched docs — not copied verbatim from AWS's text).

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors mentioning `studyContent` or `secure`; still reports `questions.js not present yet, skipping` and `flashcards.js not present yet, skipping`; ends with `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Secure domain study content"
```

---

## Task 5: Domain 1 (Secure) — quiz questions

**Files:**
- Create: `js/data/questions.js`

**Interfaces:**
- Produces: `QUESTIONS` array (consumed by `validateQuestions` in Task 2's validator, and by `js/views/quiz.js`/`js/views/mockExam.js` in Tasks 14/16).

**Verification method for every question in every question task (this one and Tasks 7, 9, 11):** for each drafted question, before adding it to the file, re-read the exact passage in the cached source doc(s) that the question is based on and explicitly check two things: (1) the option marked correct in `correctIndexes` is actually what the docs say, and (2) every other option is actually wrong per the docs (not just "less good"). If either check fails, rewrite or discard the question — never add a question whose answer key you haven't just re-confirmed against the cached doc text.

- [ ] **Step 1: Draft and verify at least 30 questions for the Secure domain**

Using the docs already cached in Task 4 (re-fetch via `fetch-doc.mjs` if you need a page not yet cached), write questions distributed across the 3 task statements: at least 10 for Task 1.1 (IAM/access), 10 for Task 1.2 (secure workloads/network), 10 for Task 1.3 (data security/encryption). Mix `multiple-choice` (exactly 4 options, 1 correct) and `multiple-response` (5+ options, 2+ correct) — aim for roughly 80% multiple-choice / 20% multiple-response, matching the real exam's mix.

Create `js/data/questions.js`:

```js
// js/data/questions.js
export const QUESTIONS = [
  {
    id: 'secure-001',
    domain: 'secure',
    questionType: 'multiple-choice',
    question: '...',
    options: ['...', '...', '...', '...'],
    correctIndexes: [0],
    explanation: '...',
  },
  // ... continue through at least secure-030, each following the
  // Task 5 verification method above before being added.
];
```

Use IDs `secure-001` through `secure-0NN` in order.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors; `flashcards.js not present yet, skipping`; `All content validated successfully.`

Also run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number ≥ 30.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Secure domain quiz questions"
```

---

## Task 6: Domain 2 (Resilient) — study content

**Files:**
- Modify: `js/data/studyContent.js`

**Interfaces:**
- Consumes: existing `STUDY_CONTENT` array structure from Task 4 — append new sections, don't restructure existing ones.

Task statements (from `.cache/aws-docs/...domain2-html.md`, already cached):

- **Task 2.1: Design scalable and loosely coupled architectures** — Knowledge of: API Gateway/REST APIs; managed services (Transfer Family, SQS, Secrets Manager); caching strategies; microservices (stateless vs. stateful); event-driven architectures; horizontal vs. vertical scaling; CDNs; container migration; load balancing (ALB); multi-tier architectures; queuing/pub-sub; serverless (Fargate, Lambda); storage types (object/file/block); container orchestration (ECS, EKS); read replicas; workflow orchestration (Step Functions). Skills in: designing event-driven/microservice/multi-tier architectures; scaling strategy selection; achieving loose coupling; when to use containers vs. serverless; recommending compute/storage/network/database technologies; using purpose-built AWS services.
- **Task 2.2: Design highly available and/or fault-tolerant architectures** — Knowledge of: AWS global infrastructure (AZs, Regions, Route 53); managed AI services (Comprehend, Polly) as an example of AMS; basic networking (route tables); DR strategies (backup/restore, pilot light, warm standby, active-active, RPO/RTO); distributed design patterns; failover strategies; immutable infrastructure; load balancing (ALB); proxy concepts (RDS Proxy); service quotas/throttling; storage durability/replication; workload visibility (X-Ray). Skills in: automation for infrastructure integrity; choosing services for HA/fault tolerance across Regions/AZs; identifying HA metrics; mitigating single points of failure; ensuring data durability/availability; selecting a DR strategy; improving reliability of legacy/non-cloud-native apps.

- [ ] **Step 1: Fetch supporting service docs**

```
https://docs.aws.amazon.com/apigateway/latest/developerguide/welcome.html
https://docs.aws.amazon.com/AWSSimpleQueueService/latest/SQSDeveloperGuide/welcome.html
https://docs.aws.amazon.com/AmazonECS/latest/developerguide/Welcome.html
https://docs.aws.amazon.com/eks/latest/userguide/what-is-eks.html
https://docs.aws.amazon.com/AmazonECS/latest/userguide/what-is-fargate.html
https://docs.aws.amazon.com/lambda/latest/dg/welcome.html
https://docs.aws.amazon.com/step-functions/latest/dg/welcome.html
https://docs.aws.amazon.com/elasticloadbalancing/latest/application/introduction.html
https://docs.aws.amazon.com/Route53/latest/DeveloperGuide/Welcome.html
https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/rds-proxy.html
https://docs.aws.amazon.com/xray/latest/devguide/aws-xray.html
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch to find the correct current URL for any that 404.

- [ ] **Step 2: Append study notes for both task statements**

Open `js/data/studyContent.js`, and insert two new section objects (`domain: 'resilient'`, one per task statement above) before the closing `];` of `STUDY_CONTENT`, each with 3–6 `{title, body}` topics grounded in the fetched docs, covering every "Knowledge of"/"Skills in" item listed above (e.g. loose coupling via SQS/API Gateway, containers vs. serverless, multi-AZ/multi-Region HA design, DR strategies with RPO/RTO, ALB + RDS Proxy + X-Ray for resilience).

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Resilient domain study content"
```

---

## Task 7: Domain 2 (Resilient) — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Interfaces:**
- Consumes: existing `QUESTIONS` array from Task 5 — append, don't restructure existing entries.

**Verification method for every question in this task:** for each drafted question, before adding it to the file, re-read the exact passage in the cached source doc(s) that the question is based on and explicitly check two things: (1) the option marked correct in `correctIndexes` is actually what the docs say, and (2) every other option is actually wrong per the docs (not just "less good"). If either check fails, rewrite or discard the question — never add a question whose answer key you haven't just re-confirmed against the cached doc text.

- [ ] **Step 1: Draft and verify at least 26 questions for the Resilient domain**

Using docs cached in Task 6 (fetch any additional ones needed via `node scripts/fetch-doc.mjs <url>`), write at least 13 questions for Task 2.1 (scalable/loosely-coupled) and 13 for Task 2.2 (HA/fault-tolerant), IDs `resilient-001` through `resilient-0NN`. Mix `multiple-choice` (exactly 4 options, 1 correct) and `multiple-response` (5+ options, 2+ correct) at roughly an 80/20 ratio, matching the real exam's mix. Insert them before the closing `];` of `QUESTIONS` in `js/data/questions.js`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'resilient').length))"`
Expected: a number ≥ 26.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Resilient domain quiz questions"
```

---

## Task 8: Domain 3 (High-Performing) — study content

**Files:**
- Modify: `js/data/studyContent.js`

Task statements (from `.cache/aws-docs/...domain3-html.md`, already cached):

- **Task 3.1: Determine high-performing and/or scalable storage solutions** — S3/EFS/EBS use cases, hybrid storage, object/file/block characteristics; selecting storage for performance and future scale.
- **Task 3.2: Design high-performing and elastic compute solutions** — Batch/EMR/Fargate, distributed computing, pub/sub, EC2 Auto Scaling/AWS Auto Scaling, Lambda/Fargate serverless, ECS/EKS orchestration; decoupling for independent scaling, scaling metrics, instance type/size and Lambda memory selection.
- **Task 3.3: Determine high-performing database solutions** — AZs/Regions, ElastiCache caching, read-vs-write-intensive access patterns, capacity planning (capacity units, IOPS), connections/proxies, engine selection (heterogeneous/homogeneous migration), read replicas, relational vs. non-relational vs. in-memory; configuring read replicas, choosing engine/type (Aurora vs. DynamoDB), integrating caching.
- **Task 3.4: Determine high-performing and/or scalable network architectures** — CloudFront/Global Accelerator edge services, subnet tiers/routing/IP addressing, ALB, VPN/Direct Connect/PrivateLink; network topology design, scalable network config, resource placement, load balancer selection.
- **Task 3.5: Determine high-performing data ingestion and transformation solutions** — Athena/Lake Formation/analytics visualization, ingestion frequency patterns, DataSync/Storage Gateway transfer, Glue transformation, secure ingestion access, Kinesis streaming; building/securing data lakes, streaming architecture design, transfer solution design, visualization, EMR compute selection, format transformation (e.g. csv to parquet).

- [ ] **Step 1: Fetch supporting service docs**

```
https://docs.aws.amazon.com/AmazonS3/latest/userguide/Welcome.html
https://docs.aws.amazon.com/efs/latest/ug/whatisefs.html
https://docs.aws.amazon.com/ebs/latest/userguide/what-is-ebs.html
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-types.html
https://docs.aws.amazon.com/autoscaling/ec2/userguide/what-is-amazon-ec2-auto-scaling.html
https://docs.aws.amazon.com/AmazonElastiCache/latest/red-ug/WhatIs.html
https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/CHAP_AuroraOverview.html
https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/Introduction.html
https://docs.aws.amazon.com/AmazonCloudFront/latest/DeveloperGuide/Introduction.html
https://docs.aws.amazon.com/global-accelerator/latest/dg/what-is-global-accelerator.html
https://docs.aws.amazon.com/streams/latest/dev/introduction.html
https://docs.aws.amazon.com/glue/latest/dg/what-is-glue.html
https://docs.aws.amazon.com/athena/latest/ug/what-is.html
https://docs.aws.amazon.com/datasync/latest/userguide/what-is-datasync.html
https://docs.aws.amazon.com/storagegateway/latest/userguide/WhatIsStorageGateway.html
https://docs.aws.amazon.com/emr/latest/ManagementGuide/emr-what-is-emr.html
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes for all five task statements**

Insert five new section objects (`domain: 'performant'`) before the closing `];` of `STUDY_CONTENT`, each with 3–6 topics grounded in the fetched docs, covering every knowledge/skill item listed above for that task statement.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add High-Performing domain study content"
```

---

## Task 9: Domain 3 (High-Performing) — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Interfaces:**
- Consumes: existing `QUESTIONS` array from Task 7 — append, don't restructure existing entries.

**Verification method for every question in this task:** for each drafted question, before adding it to the file, re-read the exact passage in the cached source doc(s) that the question is based on and explicitly check two things: (1) the option marked correct in `correctIndexes` is actually what the docs say, and (2) every other option is actually wrong per the docs (not just "less good"). If either check fails, rewrite or discard the question — never add a question whose answer key you haven't just re-confirmed against the cached doc text.

- [ ] **Step 1: Draft and verify at least 24 questions for the Performant domain**

Using docs cached in Task 8 (fetch any additional ones needed via `node scripts/fetch-doc.mjs <url>`), write questions distributed across the 5 task statements (roughly 5 each, e.g. 5/5/5/5/4), IDs `performant-001` through `performant-0NN`. Mix `multiple-choice` (exactly 4 options, 1 correct) and `multiple-response` (5+ options, 2+ correct) at roughly an 80/20 ratio. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'performant').length))"`
Expected: a number ≥ 24.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add High-Performing domain quiz questions"
```

---

## Task 10: Domain 4 (Cost-Optimized) — study content

**Files:**
- Modify: `js/data/studyContent.js`

Task statements (from `.cache/aws-docs/...domain4-html.md`, already cached):

- **Task 4.1: Design cost-optimized storage solutions** — Requester Pays, cost allocation tags/multi-account billing, Cost Explorer/Budgets/Cost and Usage Report, FSx/EFS/S3/EBS use cases, backup strategies, HDD vs. SSD volume types, data lifecycles, hybrid storage (DataSync/Transfer Family/Storage Gateway), storage tiering; choosing storage tier/service/lifecycle for lowest cost.
- **Task 4.2: Design cost-optimized compute solutions** — purchasing options (Spot, Reserved, Savings Plans), Outposts, instance families/sizes, compute utilization optimization (containers/serverless/microservices), scaling strategies (auto scaling, hibernation); ALB vs. NLB vs. GWLB selection, workload availability tiers, cost-effective compute service selection.
- **Task 4.3: Design cost-optimized database solutions** — caching, data retention policies, capacity planning, connections/proxies, engine selection, replication, relational vs. non-relational; backup/retention design, cost-effective engine/type selection (DynamoDB vs. RDS, serverless), schema/engine migration.
- **Task 4.4: Design cost-optimized network architectures** — NAT gateway cost models, network connectivity (private lines/VPN), routing/topology/peering (Transit Gateway, VPC peering), DNS; NAT gateway configuration, connection type selection, minimizing transfer costs, CDN/edge caching strategy, throttling, bandwidth allocation.

- [ ] **Step 1: Fetch supporting service docs**

```
https://docs.aws.amazon.com/AmazonS3/latest/userguide/storage-class-intro.html
https://docs.aws.amazon.com/AmazonS3/latest/userguide/object-lifecycle-mgmt.html
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/ebs-volume-types.html
https://docs.aws.amazon.com/fsx/latest/WindowsGuide/what-is.html
https://docs.aws.amazon.com/cost-management/latest/userguide/ce-what-is.html
https://docs.aws.amazon.com/cost-management/latest/userguide/budgets-managing-costs.html
https://docs.aws.amazon.com/savingsplans/latest/userguide/what-is-savings-plans.html
https://docs.aws.amazon.com/AWSEC2/latest/UserGuide/instance-purchasing-options.html
https://docs.aws.amazon.com/vpc/latest/userguide/vpc-nat-gateway.html
https://docs.aws.amazon.com/vpc/latest/tgw/what-is-transit-gateway.html
https://docs.aws.amazon.com/vpc/latest/peering/what-is-vpc-peering.html
https://docs.aws.amazon.com/vpc/latest/privatelink/vpc-endpoints.html
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes for all four task statements**

Insert four new section objects (`domain: 'cost'`) before the closing `];` of `STUDY_CONTENT`, each with 3–6 topics grounded in the fetched docs.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Cost-Optimized domain study content"
```

---

## Task 11: Domain 4 (Cost-Optimized) — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Interfaces:**
- Consumes: existing `QUESTIONS` array from Task 9 — append, don't restructure existing entries.

**Verification method for every question in this task:** for each drafted question, before adding it to the file, re-read the exact passage in the cached source doc(s) that the question is based on and explicitly check two things: (1) the option marked correct in `correctIndexes` is actually what the docs say, and (2) every other option is actually wrong per the docs (not just "less good"). If either check fails, rewrite or discard the question — never add a question whose answer key you haven't just re-confirmed against the cached doc text.

- [ ] **Step 1: Draft and verify at least 20 questions for the Cost domain**

Using docs cached in Task 10 (fetch any additional ones needed via `node scripts/fetch-doc.mjs <url>`), write 5 questions per task statement (20 total minimum), IDs `cost-001` through `cost-0NN`. Mix `multiple-choice` (exactly 4 options, 1 correct) and `multiple-response` (5+ options, 2+ correct) at roughly an 80/20 ratio. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number ≥ 100 (this is the full bank across all 4 domains — confirms the Global Constraints minimum is met).

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Cost-Optimized domain quiz questions"
```

---

## Task 12: Flashcard deck

**Files:**
- Create: `js/data/flashcards.js`

**Interfaces:**
- Produces: `FLASHCARDS` array (consumed by `validateFlashcards` in Task 2's validator, and by `js/views/flashcards.js` in Task 15).

- [ ] **Step 1: Build the deck from already-cached research**

Most of the material needed is already in `.cache/aws-docs/` from Tasks 4–11 (every major in-scope service used across the 4 domains was fetched during those tasks). For services covered in earlier tasks, write the flashcard directly from the cached doc already on disk — don't refetch. Only fetch new pages (via `node scripts/fetch-doc.mjs <url>`) for in-scope services that weren't already researched (cross-check against the cached in-scope-services list at `.cache/aws-docs/...saa-03-in-scope-services-html.md`).

Target ~70 cards, one per major in-scope service actually referenced in the study content (e.g. IAM, IAM Identity Center, Organizations, KMS, ACM, Secrets Manager, Cognito, GuardDuty, Macie, Shield, WAF, VPC, EC2, EC2 Auto Scaling, ELB/ALB, Lambda, Fargate, ECS, EKS, API Gateway, SQS, SNS, EventBridge, Step Functions, S3, S3 Glacier, EBS, EFS, FSx, Storage Gateway, RDS, Aurora, DynamoDB, ElastiCache, Redshift, Route 53, CloudFront, Global Accelerator, Direct Connect, Transit Gateway, VPC Peering, PrivateLink, NAT Gateway, X-Ray, CloudWatch, CloudTrail, Config, Control Tower, Cost Explorer, Budgets, Savings Plans, Trusted Advisor, Kinesis, Glue, Athena, Lake Formation, EMR, DataSync).

```js
// js/data/flashcards.js
export const FLASHCARDS = [
  {
    id: 'iam',
    service: 'AWS IAM',
    front: 'What is it for?',
    back: '...',
  },
  // ... ~70 cards total
];
```

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 3: Commit**

```bash
git add js/data/flashcards.js
git commit -m "Add flashcard deck"
```

---

## Task 13: Study guide view

**Files:**
- Modify: `js/views/studyGuide.js`
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `DOMAINS` from `js/data/examInfo.js`, `STUDY_CONTENT` from `js/data/studyContent.js`.

- [ ] **Step 1: Implement the view**

```js
// js/views/studyGuide.js
import { DOMAINS } from '../data/examInfo.js';
import { STUDY_CONTENT } from '../data/studyContent.js';

export function render(mount, domainId) {
  if (!domainId) {
    renderDomainList(mount);
    return;
  }
  renderDomain(mount, domainId);
}

function renderDomainList(mount) {
  mount.innerHTML = `
    <h2>Study Guide</h2>
    <p>Pick a domain to review its task statements and key concepts.</p>
    <ul class="domain-list">
      ${DOMAINS.map((d) => `<li><a href="#/study/${d.id}">${d.name}</a> — ${d.weight}%</li>`).join('')}
    </ul>
  `;
}

function renderDomain(mount, domainId) {
  const domain = DOMAINS.find((d) => d.id === domainId);
  if (!domain) {
    mount.innerHTML = `<p>Unknown domain "${domainId}". <a href="#/study">Back to Study Guide</a></p>`;
    return;
  }
  const sections = STUDY_CONTENT.filter((s) => s.domain === domainId);
  mount.innerHTML = `
    <p><a href="#/study">&larr; All domains</a></p>
    <h2>${domain.name} (${domain.weight}%)</h2>
    ${sections.map(renderSection).join('')}
    <p><a href="#/quiz/${domainId}">Take a quiz on this domain &rarr;</a></p>
  `;
}

function renderSection(section) {
  return `
    <section class="study-section">
      <h3>${section.taskStatement}</h3>
      ${section.topics.map((t) => `
        <article class="study-topic">
          <h4>${t.title}</h4>
          <p>${t.body}</p>
        </article>
      `).join('')}
    </section>
  `;
}
```

- [ ] **Step 2: Add supporting styles**

Append to `css/style.css`:

```css
.study-section { margin-bottom: 2rem; }

.study-topic { margin-left: 1rem; padding-left: 1rem; border-left: 3px solid var(--color-border); margin-bottom: 1rem; }

.study-topic h4 { margin-bottom: 0.25rem; }
```

- [ ] **Step 3: Verify in the browser**

Navigate to `#/study`. Expected: list of 4 domains with weights. Click each domain: expected task-statement headings and topic content render (no "Coming soon", no console errors — check with `preview_console_logs`). Click "Take a quiz on this domain" — expected: navigates to `#/quiz/<id>` (still stub until Task 14).

- [ ] **Step 4: Commit**

```bash
git add js/views/studyGuide.js css/style.css
git commit -m "Implement study guide view"
```

---

## Task 14: Quiz view

**Files:**
- Modify: `js/views/quiz.js`
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `DOMAINS` from `js/data/examInfo.js`; `QUESTIONS` from `js/data/questions.js`; `isCorrect` from `js/lib/scoring.js`; `createStore` from `js/lib/storage.js`.

- [ ] **Step 1: Implement the view**

```js
// js/views/quiz.js
import { DOMAINS } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { isCorrect } from '../lib/scoring.js';
import { createStore } from '../lib/storage.js';

const store = createStore();

export function render(mount, domainId) {
  if (!domainId) {
    renderDomainPicker(mount);
    return;
  }
  const domain = DOMAINS.find((d) => d.id === domainId);
  const questions = QUESTIONS.filter((q) => q.domain === domainId);
  if (!domain || questions.length === 0) {
    mount.innerHTML = `<p>Unknown quiz domain "${domainId}". <a href="#/quiz">Back to Quizzes</a></p>`;
    return;
  }
  runQuiz(mount, domain, questions);
}

function renderDomainPicker(mount) {
  mount.innerHTML = `
    <h2>Quizzes</h2>
    <p>Choose a domain to quiz yourself on.</p>
    <ul class="domain-list">
      ${DOMAINS.map((d) => `<li><a href="#/quiz/${d.id}">${d.name}</a> (${QUESTIONS.filter((q) => q.domain === d.id).length} questions)</li>`).join('')}
    </ul>
  `;
}

function runQuiz(mount, domain, questions) {
  const state = { index: 0, correctCount: 0, answers: [] };

  function renderQuestion() {
    const q = questions[state.index];
    const isMulti = q.questionType === 'multiple-response';
    mount.innerHTML = `
      <p><a href="#/quiz">&larr; All quizzes</a></p>
      <h2>${domain.name} Quiz</h2>
      <p class="quiz-progress">Question ${state.index + 1} of ${questions.length}</p>
      <form id="quiz-form">
        <p class="quiz-question">${q.question}</p>
        ${q.options.map((opt, i) => `
          <label class="quiz-option">
            <input type="${isMulti ? 'checkbox' : 'radio'}" name="answer" value="${i}" />
            ${opt}
          </label>
        `).join('')}
        <div id="quiz-feedback"></div>
        <button type="submit">Submit Answer</button>
      </form>
    `;
    document.getElementById('quiz-form').addEventListener('submit', (e) => {
      e.preventDefault();
      handleSubmit(q);
    });
  }

  function handleSubmit(q) {
    const selected = Array.from(mount.querySelectorAll('input[name="answer"]:checked')).map((el) => Number(el.value));
    if (selected.length === 0) return;
    const correct = isCorrect(q, selected);
    if (correct) state.correctCount += 1;
    state.answers.push({ questionId: q.id, selected, correct });

    const feedback = document.getElementById('quiz-feedback');
    feedback.innerHTML = `
      <p class="${correct ? 'feedback-correct' : 'feedback-incorrect'}">
        ${correct ? 'Correct!' : 'Incorrect.'} ${q.explanation}
      </p>
      <button type="button" id="quiz-next">${state.index + 1 < questions.length ? 'Next Question' : 'See Results'}</button>
    `;
    mount.querySelector('#quiz-form button[type="submit"]').disabled = true;
    mount.querySelectorAll('input[name="answer"]').forEach((el) => { el.disabled = true; });
    document.getElementById('quiz-next').addEventListener('click', () => {
      state.index += 1;
      if (state.index < questions.length) {
        renderQuestion();
      } else {
        renderResults();
      }
    });
  }

  function renderResults() {
    store.recordQuizAttempt({
      domain: domain.id,
      score: state.correctCount,
      total: questions.length,
      timestamp: new Date().toISOString(),
    });
    mount.innerHTML = `
      <h2>${domain.name} Quiz Results</h2>
      <p class="quiz-score">${state.correctCount} / ${questions.length} correct</p>
      <p><a href="#/quiz/${domain.id}">Retake this quiz</a> · <a href="#/quiz">Other quizzes</a> · <a href="#/progress">View progress</a></p>
    `;
  }

  renderQuestion();
}
```

- [ ] **Step 2: Add supporting styles**

Append to `css/style.css`:

```css
.quiz-option { display: block; margin: 0.5rem 0; }

.quiz-progress { color: var(--color-muted); }

.feedback-correct { color: var(--color-success); }

.feedback-incorrect { color: var(--color-danger); }

.quiz-score { font-size: 1.25rem; font-weight: 600; }
```

- [ ] **Step 3: Verify in the browser**

Navigate to `#/quiz`, pick the Secure domain, answer a question (select an option, submit) — expected: instant correct/incorrect feedback with the explanation text, inputs disabled after submit, "Next Question" advances. Complete all questions — expected: results screen shows `N / total correct`. Reload the page and check `#/progress` isn't wired yet (fine, Task 17) but confirm via `preview_eval` that `localStorage.getItem('saa-prep:quiz-history')` now contains the recorded attempt.

- [ ] **Step 4: Commit**

```bash
git add js/views/quiz.js css/style.css
git commit -m "Implement quiz view"
```

---

## Task 15: Flashcards view

**Files:**
- Modify: `js/views/flashcards.js`
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `FLASHCARDS` from `js/data/flashcards.js`; `createStore` from `js/lib/storage.js`.

- [ ] **Step 1: Implement the view**

```js
// js/views/flashcards.js
import { FLASHCARDS } from '../data/flashcards.js';
import { createStore } from '../lib/storage.js';

const store = createStore();

export function render(mount) {
  const state = { index: 0, showBack: false, filterUnknown: false };

  function visibleCards() {
    if (!state.filterUnknown) return FLASHCARDS;
    const known = store.getFlashcardState();
    return FLASHCARDS.filter((c) => !known[c.id]);
  }

  function renderCard() {
    const cards = visibleCards();
    if (cards.length === 0) {
      mount.innerHTML = `<p>All caught up! <button id="fc-reset">Show all cards</button></p>`;
      document.getElementById('fc-reset').addEventListener('click', () => {
        state.filterUnknown = false;
        state.index = 0;
        renderCard();
      });
      return;
    }
    if (state.index >= cards.length) state.index = 0;
    const card = cards[state.index];
    const known = store.getFlashcardState();
    mount.innerHTML = `
      <h2>Flashcards</h2>
      <label>
        <input type="checkbox" id="fc-filter" ${state.filterUnknown ? 'checked' : ''} />
        Show only cards I haven't marked known
      </label>
      <p class="quiz-progress">Card ${state.index + 1} of ${cards.length}</p>
      <div class="flashcard" id="flashcard">
        <p class="flashcard-service">${card.service}</p>
        <p class="flashcard-text">${state.showBack ? card.back : card.front}</p>
      </div>
      <div class="flashcard-controls">
        <button type="button" id="fc-flip">Flip</button>
        <button type="button" id="fc-prev">Previous</button>
        <button type="button" id="fc-next">Next</button>
        <button type="button" id="fc-known" class="secondary">${known[card.id] ? 'Marked Known ✓' : 'Mark Known'}</button>
      </div>
    `;
    document.getElementById('fc-filter').addEventListener('change', (e) => {
      state.filterUnknown = e.target.checked;
      state.index = 0;
      renderCard();
    });
    document.getElementById('fc-flip').addEventListener('click', () => {
      state.showBack = !state.showBack;
      renderCard();
    });
    document.getElementById('fc-prev').addEventListener('click', () => {
      state.index = (state.index - 1 + cards.length) % cards.length;
      state.showBack = false;
      renderCard();
    });
    document.getElementById('fc-next').addEventListener('click', () => {
      state.index = (state.index + 1) % cards.length;
      state.showBack = false;
      renderCard();
    });
    document.getElementById('fc-known').addEventListener('click', () => {
      store.setFlashcardKnown(card.id, !known[card.id]);
      renderCard();
    });
  }

  renderCard();
}
```

- [ ] **Step 2: Add supporting styles**

Append to `css/style.css`:

```css
.flashcard {
  border: 1px solid var(--color-border);
  border-radius: 10px;
  padding: 3rem 2rem;
  text-align: center;
  min-height: 8rem;
  display: flex;
  flex-direction: column;
  justify-content: center;
  gap: 0.5rem;
}

.flashcard-service { color: var(--color-muted); font-size: 0.9rem; text-transform: uppercase; letter-spacing: 0.05em; }

.flashcard-text { font-size: 1.1rem; }

.flashcard-controls { display: flex; gap: 0.75rem; margin-top: 1rem; flex-wrap: wrap; }
```

- [ ] **Step 3: Verify in the browser**

Navigate to `#/flashcards`. Expected: first card's service name + front text shows. Click "Flip" — expected: back text shows. Click "Next"/"Previous" — expected: card index changes, flip state resets to front. Click "Mark Known" — expected: button label changes to "Marked Known ✓". Check the "Show only cards I haven't marked known" checkbox — expected: the marked card no longer appears in rotation. Confirm via `preview_eval` that `localStorage.getItem('saa-prep:flashcard-state')` reflects the marked card.

- [ ] **Step 4: Commit**

```bash
git add js/views/flashcards.js css/style.css
git commit -m "Implement flashcards view"
```

---

## Task 16: Mock exam view

**Files:**
- Modify: `js/views/mockExam.js`
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js`; `QUESTIONS` from `js/data/questions.js`; `drawMockExam`, `isCorrect`, `estimateScaledScore` from `js/lib/scoring.js`; `createStore` from `js/lib/storage.js`.

- [ ] **Step 1: Implement the view**

```js
// js/views/mockExam.js
import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { drawMockExam, isCorrect, estimateScaledScore } from '../lib/scoring.js';
import { createStore } from '../lib/storage.js';

const store = createStore();

export function render(mount) {
  mount.innerHTML = `
    <h2>Mock Exam</h2>
    <p>${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam.</p>
    <button type="button" id="start-exam">Start Mock Exam</button>
  `;
  document.getElementById('start-exam').addEventListener('click', () => startExam(mount));
}

function startExam(mount) {
  const exam = drawMockExam(QUESTIONS, DOMAINS);
  const state = {
    index: 0,
    answers: new Array(exam.length).fill(null),
    secondsLeft: EXAM_FORMAT.durationMinutes * 60,
  };

  state.timerId = setInterval(() => {
    state.secondsLeft -= 1;
    updateTimerDisplay();
    if (state.secondsLeft <= 0) {
      clearInterval(state.timerId);
      finishExam(mount, exam, state);
    }
  }, 1000);

  function updateTimerDisplay() {
    const el = document.getElementById('exam-timer');
    if (!el) return;
    const m = Math.floor(state.secondsLeft / 60);
    const s = state.secondsLeft % 60;
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  function renderQuestion() {
    const q = exam[state.index];
    const isMulti = q.questionType === 'multiple-response';
    const selected = state.answers[state.index] ?? [];
    mount.innerHTML = `
      <div class="exam-header">
        <span>Question ${state.index + 1} of ${exam.length}</span>
        <span id="exam-timer" class="exam-timer"></span>
      </div>
      <form id="exam-form">
        <p class="quiz-question">${q.question}</p>
        ${q.options.map((opt, i) => `
          <label class="quiz-option">
            <input type="${isMulti ? 'checkbox' : 'radio'}" name="answer" value="${i}" ${selected.includes(i) ? 'checked' : ''} />
            ${opt}
          </label>
        `).join('')}
      </form>
      <div class="exam-nav">
        <button type="button" id="exam-prev" ${state.index === 0 ? 'disabled' : ''}>Previous</button>
        <button type="button" id="exam-next">${state.index + 1 < exam.length ? 'Next' : 'Review & Submit'}</button>
      </div>
    `;
    updateTimerDisplay();
    document.getElementById('exam-prev').addEventListener('click', () => { saveAnswer(); state.index -= 1; renderQuestion(); });
    document.getElementById('exam-next').addEventListener('click', () => {
      saveAnswer();
      if (state.index + 1 < exam.length) {
        state.index += 1;
        renderQuestion();
      } else {
        clearInterval(state.timerId);
        finishExam(mount, exam, state);
      }
    });
  }

  function saveAnswer() {
    const selected = Array.from(mount.querySelectorAll('input[name="answer"]:checked')).map((el) => Number(el.value));
    state.answers[state.index] = selected;
  }

  renderQuestion();
}

function finishExam(mount, exam, state) {
  const results = exam.map((q, i) => ({
    question: q,
    selected: state.answers[i] ?? [],
    correct: isCorrect(q, state.answers[i] ?? []),
  }));
  const correctCount = results.filter((r) => r.correct).length;
  const score = estimateScaledScore(correctCount, exam.length);
  const passed = score >= EXAM_FORMAT.passingScore;

  const byDomain = DOMAINS.map((d) => {
    const domainResults = results.filter((r) => r.question.domain === d.id);
    const domainCorrect = domainResults.filter((r) => r.correct).length;
    return { domain: d, correct: domainCorrect, total: domainResults.length };
  });

  store.recordMockExamAttempt({
    score,
    correct: correctCount,
    total: exam.length,
    passed,
    timestamp: new Date().toISOString(),
  });

  mount.innerHTML = `
    <h2>Mock Exam Results</h2>
    <p class="quiz-score">Estimated scaled score: ${score} / ${EXAM_FORMAT.maxScore} — ${passed ? 'PASS' : 'Below passing score'}</p>
    <p class="exam-note">This is an estimate based on percent correct; AWS's real scaling formula is not public. Passing score is ${EXAM_FORMAT.passingScore}.</p>
    <p>${correctCount} / ${exam.length} correct</p>
    <h3>By Domain</h3>
    <ul>
      ${byDomain.map((d) => `<li>${d.domain.name}: ${d.correct} / ${d.total}</li>`).join('')}
    </ul>
    <h3>Review</h3>
    ${results.map((r, i) => `
      <article class="review-item ${r.correct ? 'feedback-correct' : 'feedback-incorrect'}">
        <p><strong>Q${i + 1}.</strong> ${r.question.question}</p>
        <p>${r.correct ? 'Correct' : 'Incorrect'} — ${r.question.explanation}</p>
      </article>
    `).join('')}
    <p><a href="#/exam">Take another mock exam</a> · <a href="#/progress">View progress</a></p>
  `;
}
```

- [ ] **Step 2: Add supporting styles**

Append to `css/style.css`:

```css
.exam-header { display: flex; justify-content: space-between; margin-bottom: 1rem; font-weight: 600; }

.exam-timer { font-variant-numeric: tabular-nums; }

.exam-nav { display: flex; gap: 0.75rem; margin-top: 1rem; }

.review-item { border-left: 3px solid var(--color-border); padding-left: 1rem; margin-bottom: 1rem; }
```

- [ ] **Step 3: Verify in the browser**

Navigate to `#/exam`, click "Start Mock Exam" — expected: question 1 of 65 renders with a visible countdown timer starting near 130:00. Answer and click "Next" through a few questions, then click "Previous" — expected: your prior selection is still checked (state persists per-question). Read the timer value, wait ~5 seconds, read it again via `preview_eval` (`document.getElementById('exam-timer').textContent`) — expected: it decreased by ~5 seconds, confirming the countdown runs. Answer through to the last question and click "Review & Submit" — expected: results screen with an estimated score (100–1000), pass/fail line, per-domain breakdown summing to 65, and a review list of all 65 questions with correct/incorrect marking and explanations. (Waiting the full 130 minutes for auto-submit is impractical to test manually — the auto-submit path calls the identical `finishExam` function as the manual submit path, so verifying manual submission is sufficient coverage.)

- [ ] **Step 4: Commit**

```bash
git add js/views/mockExam.js css/style.css
git commit -m "Implement mock exam view"
```

---

## Task 17: Progress dashboard view

**Files:**
- Modify: `js/views/progress.js`
- Modify: `css/style.css`

**Interfaces:**
- Consumes: `DOMAINS` from `js/data/examInfo.js`; `FLASHCARDS` from `js/data/flashcards.js`; `createStore` from `js/lib/storage.js`.

- [ ] **Step 1: Implement the view**

```js
// js/views/progress.js
import { DOMAINS } from '../data/examInfo.js';
import { FLASHCARDS } from '../data/flashcards.js';
import { createStore } from '../lib/storage.js';

const store = createStore();

export function render(mount) {
  const quizHistory = store.getQuizHistory();
  const mockHistory = store.getMockExamHistory();
  const flashcardState = store.getFlashcardState();
  const knownCount = Object.values(flashcardState).filter(Boolean).length;
  const masteryPct = FLASHCARDS.length ? Math.round((knownCount / FLASHCARDS.length) * 100) : 0;

  mount.innerHTML = `
    <h2>Progress</h2>
    <section>
      <h3>Flashcard Mastery</h3>
      <p>${knownCount} / ${FLASHCARDS.length} marked known (${masteryPct}%)</p>
    </section>
    <section>
      <h3>Quiz History</h3>
      ${quizHistory.length === 0 ? '<p>No quizzes taken yet.</p>' : `
        <table class="history-table">
          <thead><tr><th>Domain</th><th>Score</th><th>Date</th></tr></thead>
          <tbody>
            ${quizHistory.slice().reverse().map((a) => `
              <tr>
                <td>${DOMAINS.find((d) => d.id === a.domain)?.name ?? a.domain}</td>
                <td>${a.score} / ${a.total}</td>
                <td>${new Date(a.timestamp).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </section>
    <section>
      <h3>Mock Exam History</h3>
      ${mockHistory.length === 0 ? '<p>No mock exams taken yet.</p>' : `
        <table class="history-table">
          <thead><tr><th>Score</th><th>Correct</th><th>Result</th><th>Date</th></tr></thead>
          <tbody>
            ${mockHistory.slice().reverse().map((a) => `
              <tr>
                <td>${a.score}</td>
                <td>${a.correct} / ${a.total}</td>
                <td>${a.passed ? 'Pass' : 'Fail'}</td>
                <td>${new Date(a.timestamp).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </section>
  `;
}
```

- [ ] **Step 2: Add supporting styles**

Append to `css/style.css`:

```css
.history-table { width: 100%; border-collapse: collapse; margin-bottom: 1.5rem; }

.history-table th, .history-table td { text-align: left; padding: 0.5rem; border-bottom: 1px solid var(--color-border); }
```

- [ ] **Step 3: Verify in the browser**

Navigate to `#/progress`. Expected: flashcard mastery percentage reflects cards marked known in Task 15's verification, quiz history table lists the attempt(s) recorded in Task 14's verification, mock exam history lists the attempt from Task 16's verification. Reload the page — expected: all three sections still show the same data (confirms `localStorage` persistence survives a reload).

- [ ] **Step 4: Commit**

```bash
git add js/views/progress.js css/style.css
git commit -m "Implement progress dashboard view"
```

---

## Task 18: Final integration, README, and full walkthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the full automated check suite**

```bash
node --test js/lib
node scripts/validate-content.mjs
```

Expected: all `node --test` cases pass; validator prints `All content validated successfully.`

- [ ] **Step 2: Write the final README**

```markdown
# AWS SAA-C03 Exam Prep

An unofficial study site for the AWS Certified Solutions Architect – Associate (SAA-C03) exam. Not affiliated with or endorsed by AWS.

## Running it

No install step. From this directory:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## What's here

- **Study guide** — organized by the exam's 4 official domains and their task statements.
- **Domain quizzes** — 100+ practice questions with instant feedback and explanations.
- **Flashcards** — a service-by-service cheat-sheet deck with known/unknown tracking.
- **Mock exam** — a 65-question, 130-minute timed exam weighted by domain, like the real thing.
- **Progress dashboard** — quiz and mock exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).

## How the content was sourced

Exam structure, domain weightings, and task statements come from AWS's official SAA-C03 exam guide (docs.aws.amazon.com), fetched 2026-07-07 — see [docs/superpowers/specs/2026-07-07-aws-saa-exam-prep-design.md](docs/superpowers/specs/2026-07-07-aws-saa-exam-prep-design.md) for details. Every quiz question was drafted from and checked against the relevant AWS service documentation before being added. Fetched doc pages are cached locally under `.cache/aws-docs/` (gitignored) so re-running the content pipeline doesn't re-hit AWS for pages already fetched.

## Development

- `node --test js/lib` — runs unit tests for the pure storage/scoring logic.
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches an AWS doc page for content research.
```

- [ ] **Step 3: Full manual walkthrough**

With the server running (`preview_start` with name `site`), walk through every feature end to end:

1. `#/` — exam overview renders correctly.
2. `#/study` → click through all 4 domains — content renders for each, no console errors.
3. `#/quiz` → run one domain quiz to completion — feedback, scoring, and results all work.
4. `#/flashcards` → flip a few cards, mark 2–3 known, toggle the "unknown only" filter — filtering works.
5. `#/exam` → start a mock exam, answer through to the end, submit — results screen renders with a per-domain breakdown summing to 65.
6. `#/progress` → confirm all of the above activity shows up (quiz history, mock exam history, flashcard mastery %).
7. Reload the page and revisit `#/progress` — expected: everything from steps 3–5 persisted.
8. Check `preview_console_logs` with `level: 'error'` across the whole walkthrough — expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Finalize README and complete end-to-end verification"
```
