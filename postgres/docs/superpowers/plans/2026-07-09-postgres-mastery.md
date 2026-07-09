# PostgreSQL Mastery Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, locally-served website that teaches general PostgreSQL mastery — a study guide organized by a self-authored 6-domain knowledge taxonomy, a 100-question practice bank, flashcards, a timed self-test, and a progress dashboard — as the third learning module in the `learn` monorepo, alongside the existing AWS SAA-C03 (`aws/`) and CKA (`kubernetes/`) modules.

**Architecture:** This project reuses the AWS/CKA modules' entire application layer verbatim — the router, base styles, storage/scoring libraries, and content-tooling scripts are content-agnostic and require no code changes. Only the content data files (`js/data/*.js`), the home view's copy, and two small, already-proven edits to the mock exam view are new. Content is sourced from the official PostgreSQL 18 documentation at postgresql.org, adversarially verified before being added — the same discipline the AWS and CKA sites used, with all three lessons learned from those builds (verbatim-copying, "longest answer" tells, and answer-position clustering) built into every content task's instructions from the start, plus two copy-source lessons specific to this module (see Global Constraints).

**Tech Stack:** Identical to `aws/` and `kubernetes/`: vanilla HTML/CSS/JS, no build step, no npm. Node.js only for two standalone helper scripts and `node --test` unit tests, copied unchanged.

## Global Constraints

- **This project's own working directory is `/Users/toddcooke/IdeaProjects/learn_aws/postgres`.** All file paths in this plan are relative to that directory unless given as a `../aws/...` or `../kubernetes/...` sibling-copy source path. This is a subdirectory of the same `learn_aws` git repository as `aws/` and `kubernetes/` (not a separate repo, unlike how the CKA module was originally built) — `git add`/`git commit` work fine from inside `postgres/` since git resolves the repo root automatically. A single push to `main` is the entire deployment step; no separate repo, no `git subtree`, no submodule changes.
- **No per-module `.gitignore` needed.** The repo root's `.gitignore` (`.cache/` and `.worktrees/`, no leading slash) already matches these directories at any depth, including inside `postgres/`.
- **No npm/build tooling of any kind.**
- The site is served via `python3 -m http.server` for local use, not opened via `file://` (ES module imports are blocked by browsers under `file://`). A working preview config named `postgres-site` (port 8002) already exists in the repo root's `.claude/launch.json` — use `preview_start` with name `postgres-site`, no per-module launch config needed.
- **Node version note:** this environment runs Node v25.5.0, where `node --test js/lib` (a bare directory) fails with a module-resolution error. Use the explicit glob form `node --test "js/lib/*.test.mjs"` instead — this is an environment quirk, not a project bug, already confirmed during the CKA build.
- All exam content lives in `js/data/*.js` as ES module exports.
- Every question in `js/data/questions.js` must satisfy `node scripts/validate-content.mjs` and must have been adversarially verified against cached source documentation before being added.
- **Every question and study-content topic must be checked for all three of these, mandatory in every content task's steps below, not an afterthought:**
  1. **Verbatim copying** — 8+ consecutive words matching a cached source doc. Reword any hit. Sanity-check your own checker by planting a known violation and confirming it's caught before trusting a "0 hits" result — an unsanity-checked checker produced a false "0 hits" once during an earlier module's build.
  2. **Answer-length balance** — for multiple-choice questions, the correct option must not be the single longest option in a majority of your questions, and must not be conspicuously longer/more detailed than its distractors in any individual question.
  3. **Answer-position balance** — the correct answer's index (for multiple-choice, `correctIndexes[0]`) must not cluster at one position across a domain's questions. A prior module had 22/22 questions in one domain with the correct answer at index 0 (100%) — found by a later task's implementer reading through the file, not by that task's own review. After drafting a domain's questions, count how many times each option position (0/1/2/3) is correct; if any position is wildly over-represented (e.g. >40% for a 4-option question set), reshuffle the skewed questions' `options` arrays (updating `correctIndexes` to match) before committing.
- Total practice question bank must reach **exactly 100**, distributed by domain weight as counts: Architecture & Data Types 15, Querying & SQL 20, Indexing & Performance 20, Transactions & Concurrency (MVCC) 15, Administration & Maintenance 20, Replication & High Availability 10.
- `js/lib/storage.js`'s `NAMESPACE` constant must be `'pg-prep'`, NOT `'saa-prep'` or `'cka-prep'` — all three modules share the `toddcooke.github.io` origin, so an unchanged copy would collide with the other modules' localStorage data.
- **`scripts/validate-content.mjs` must be copied from `../kubernetes/scripts/validate-content.mjs`, NOT `../aws/`'s.** `aws/`'s copy still has an AWS-specific check (`EXAM_FORMAT.totalQuestions === EXAM_FORMAT.scoredQuestions + EXAM_FORMAT.unscoredQuestions`) that only makes sense for AWS's real scored/unscored exam format; this module's `EXAM_FORMAT` has no such fields (same as CKA's), and `kubernetes/`'s copy already had that check removed during the CKA build's final review. Only the domain-count check needs editing (6, not 5) — see Task 2.
- **`js/views/mockExam.js` must be copied from `../aws/js/views/mockExam.js`, NOT `../kubernetes/`'s** (the reverse of the rule above) — `kubernetes/`'s copy has CKA-specific disclaimer text that doesn't apply here. But `aws/`'s copy has a latent bug: `finishExam()` calls `estimateScaledScore(correctCount, exam.length)` **without** passing `{minScore, maxScore}`, so it silently uses `scoring.js`'s AWS-shaped defaults (100–1000) instead of this module's actual `EXAM_FORMAT` (0–100). This call must explicitly pass those options — see Task 17 for the exact fix (already proven correct and live-verified in `kubernetes/js/views/mockExam.js`).
- PostgreSQL has no official, universally-recognized certification (confirmed 2026-07-09) — the domain taxonomy below is self-authored, not sourced from an exam blueprint. The home page must carry a brief, honest note saying so — see Task 3.
- Content is sourced from `https://www.postgresql.org/docs/current/` (PostgreSQL 18, patch 18.4, confirmed current stable as of 2026-07-09 — this path always resolves to the latest stable version). **Connection pooling (PgBouncer) is NOT documented anywhere in the core PostgreSQL manual** — independently confirmed during planning by 6 separate research passes across every domain that touches it. Use `https://www.pgbouncer.org/` and `https://www.pgbouncer.org/config.html` as the authoritative source for that specific sub-topic instead.
- No user accounts, auth, or backend. All persistence is `localStorage`, namespaced under the `pg-prep:` key prefix.
- Every doc page fetched during content research must go through `scripts/fetch-doc.mjs`, which checks `.cache/aws-docs/index.json` first (directory kept as `aws-docs` for consistency with the copied, unmodified tooling).
- Reference spec: [docs/superpowers/specs/2026-07-09-postgres-mastery-design.md](../specs/2026-07-09-postgres-mastery-design.md).

---

## Task 1: Project scaffold — shell, router, base styles, view stubs

**Files:**
- Create: `index.html` (new content — title/copy changed from `aws/`)
- Copy from `../aws/`: `css/style.css`, `js/app.js` (both unchanged)
- Create: `js/views/home.js`, `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/mockExam.js`, `js/views/progress.js` (stubs — real implementations come later)
- Create: `README.md` (stub)

**Interfaces:**
- Produces: every `js/views/*.js` module exports `function render(mount, ...params)` — identical contract to `aws/`/`kubernetes/`, since `js/app.js` is copied unchanged and calls views this way.

- [ ] **Step 1: Copy the router and base styles unchanged**

```bash
mkdir -p js/views js/data js/lib css scripts
cp ../aws/js/app.js js/app.js
cp ../aws/css/style.css css/style.css
```

Run: `diff ../aws/js/app.js js/app.js && diff ../aws/css/style.css css/style.css`
Expected: no output (files identical).

- [ ] **Step 2: Create the six view stub modules**

Each of `js/views/home.js`, `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/mockExam.js`, `js/views/progress.js` gets this content:

```js
// js/views/home.js
export function render(mount) {
  mount.innerHTML = '<p>Coming soon.</p>';
}
```

(Repeat verbatim for the other five files — they're replaced with real implementations in later tasks.)

- [ ] **Step 3: Create the HTML shell**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>PostgreSQL Mastery</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="site-header">
    <h1>PostgreSQL Mastery</h1>
    <nav id="nav">
      <a href="#/" data-view="home">Home</a>
      <a href="#/study" data-view="study">Study Guide</a>
      <a href="#/quiz" data-view="quiz">Quizzes</a>
      <a href="#/flashcards" data-view="flashcards">Flashcards</a>
      <a href="#/exam" data-view="exam">Practice Exam</a>
      <a href="#/progress" data-view="progress">Progress</a>
    </nav>
  </header>
  <main id="app-content"></main>
  <footer class="site-footer">
    <p>Unofficial study aid. Not affiliated with or endorsed by the PostgreSQL Global Development Group.</p>
  </footer>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

(The nav link text says "Practice Exam" rather than "Mock Exam" — this module isn't simulating a real vendor exam, so the UI copy says so plainly. The route/filename underneath stays `#/exam` / `mockExam.js` for consistency with the other two modules' router convention — see Task 17.)

- [ ] **Step 4: Create the README stub**

```markdown
# PostgreSQL Mastery

An unofficial study site for general PostgreSQL knowledge. Not tied to any specific certification, and not affiliated with or endorsed by the PostgreSQL Global Development Group.

Status: under construction.
```

- [ ] **Step 5: Verify in the browser**

Start the server (via the preview tool's `preview_start` with name `postgres-site`), then load `http://localhost:8002/`.

Expected: page loads with the header "PostgreSQL Mastery", nav links, and "Coming soon." in the content area. Clicking each nav link changes the URL hash and keeps showing "Coming soon." with that link highlighted. Check the browser console (`preview_console_logs`) — expect no errors.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/app.js js/views README.md
git commit -m "Add Postgres site scaffold: shell, router (copied from aws/), base styles, view stubs"
```

---

## Task 2: Core infrastructure — exam data, storage, scoring, and content tooling

**Files:**
- Create: `js/data/examInfo.js` (new content)
- Copy from `../aws/`, then edit: `js/lib/storage.js` (NAMESPACE change)
- Copy from `../aws/` unchanged: `js/lib/storage.test.mjs`, `js/lib/scoring.js`, `js/lib/scoring.test.mjs`, `scripts/fetch-doc.mjs`
- Copy from `../kubernetes/`, then edit: `scripts/validate-content.mjs` (domain-count change)

**Interfaces:**
- Produces: `DOMAINS` (array of `{id, name, weight, mockExamCount}`, **6 entries**) and `EXAM_FORMAT` (`{totalQuestions, durationMinutes, passingScore, minScore, maxScore}`) from `js/data/examInfo.js`.
- Produces: `createStore(backend = globalThis.localStorage)` from `js/lib/storage.js`, identical shape to the other modules' — `{getQuizHistory, recordQuizAttempt, getFlashcardState, setFlashcardKnown, getMockExamHistory, recordMockExamAttempt}` — but namespaced under `'pg-prep'`.
- Produces: `isCorrect`, `estimateScaledScore`, `drawMockExam` from `js/lib/scoring.js` — identical signatures to the other modules: `estimateScaledScore(correctCount, totalCount, { minScore = 100, maxScore = 1000 } = {})`.
- Produces: `node scripts/fetch-doc.mjs <url>` and `node scripts/validate-content.mjs` — identical behavior to the other modules, except the validator now expects 6 domains and has no scored/unscored check.

- [ ] **Step 1: Write the exam info data**

```js
// js/data/examInfo.js
export const DOMAINS = [
  { id: 'architecture', name: 'Architecture & Data Types', weight: 15, mockExamCount: 8 },
  { id: 'querying', name: 'Querying & SQL', weight: 20, mockExamCount: 10 },
  { id: 'indexing', name: 'Indexing & Performance', weight: 20, mockExamCount: 10 },
  { id: 'transactions', name: 'Transactions & Concurrency (MVCC)', weight: 15, mockExamCount: 7 },
  { id: 'administration', name: 'Administration & Maintenance', weight: 20, mockExamCount: 10 },
  { id: 'replication', name: 'Replication & High Availability', weight: 10, mockExamCount: 5 },
];

export const EXAM_FORMAT = {
  totalQuestions: 50,
  durationMinutes: 75,
  passingScore: 70,
  minScore: 0,
  maxScore: 100,
};
```

(`weight` sums to 100; `mockExamCount` sums to 50, matching `EXAM_FORMAT.totalQuestions` — this is the practice-exam draw size, not the full question bank. The full bank target of 100 questions is a Global Constraint above, not a stored field, matching how `aws/` and `kubernetes/` handled it.)

- [ ] **Step 2: Copy the storage library and fix the namespace**

```bash
cp ../aws/js/lib/storage.js js/lib/storage.js
cp ../aws/js/lib/storage.test.mjs js/lib/storage.test.mjs
```

Open `js/lib/storage.js` and change:

```js
const NAMESPACE = 'saa-prep';
```

to:

```js
const NAMESPACE = 'pg-prep';
```

This is the only line that should differ from `aws/`'s copy.

Run: `node --test js/lib/storage.test.mjs`
Expected: 3 tests pass (the test file doesn't assert on the literal namespace string, so it needs no changes and still passes).

- [ ] **Step 3: Copy the scoring library and its test unchanged**

```bash
cp ../aws/js/lib/scoring.js js/lib/scoring.js
cp ../aws/js/lib/scoring.test.mjs js/lib/scoring.test.mjs
```

Run: `diff ../aws/js/lib/scoring.js js/lib/scoring.js`
Expected: no output.

Run: `node --test js/lib/scoring.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 4: Copy the doc-fetch cache script unchanged**

```bash
cp ../aws/scripts/fetch-doc.mjs scripts/fetch-doc.mjs
```

Run: `node scripts/fetch-doc.mjs https://www.postgresql.org/docs/current/sql-select.html`
Expected: prints a path under `.cache/aws-docs/`, and the cached file contains readable text about the `SELECT` statement (postgresql.org pages have no markdown-sibling like AWS docs did; the script's generic HTML-stripping fallback handles them — already confirmed usable during design, if a bit noisier due to version-picker nav cruft). Running the exact same command again prints the same path near-instantly (cache hit, no fetch).

- [ ] **Step 5: Copy the content validator from `kubernetes/` and fix the domain count**

```bash
cp ../kubernetes/scripts/validate-content.mjs scripts/validate-content.mjs
```

Open `scripts/validate-content.mjs` and find this line inside `validateExamInfo()`:

```js
  check(Array.isArray(DOMAINS) && DOMAINS.length === 5, 'DOMAINS must have exactly 5 entries');
```

Change it to:

```js
  check(Array.isArray(DOMAINS) && DOMAINS.length === 6, 'DOMAINS must have exactly 6 entries');
```

This is the only line that should differ from `kubernetes/`'s copy — every other check in the file (weight-sum, mock-count-sum, per-domain shape, question/flashcard/study-content shape) is already generic and needs no changes. Confirm this file does **not** contain any `scoredQuestions`/`unscoredQuestions` check (that's the AWS-specific check `kubernetes/`'s copy already had removed, and why this step copies from `kubernetes/` instead of `aws/` — see Global Constraints).

Run: `node scripts/validate-content.mjs`
Expected: `studyContent.js not present yet, skipping`, `questions.js not present yet, skipping`, `flashcards.js not present yet, skipping`, then `All content validated successfully.` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add js/data/examInfo.js js/lib/storage.js js/lib/storage.test.mjs js/lib/scoring.js js/lib/scoring.test.mjs scripts/fetch-doc.mjs scripts/validate-content.mjs
git commit -m "Add exam data, storage (namespaced pg-prep)/scoring libs, and content tooling"
```

---

## Task 3: Home view

**Files:**
- Modify: `js/views/home.js`

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js` (Task 2).

This is new content, not a copy — it needs the "not a certification" honesty note required by the spec.

- [ ] **Step 1: Replace the stub with the real home view**

```js
// js/views/home.js
import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About This Site</h2>
      <p>General PostgreSQL mastery — not tied to any certification.</p>
      <p class="exam-note">Unlike some other learning modules on this site, there is no single, universally recognized PostgreSQL certification to prepare for — the PostgreSQL Global Development Group doesn't run one. The domains below are a self-authored curriculum covering both DBA and application-development knowledge, grounded in the official PostgreSQL documentation, not an official exam blueprint.</p>
      <ul class="exam-facts">
        <li>${EXAM_FORMAT.totalQuestions}-question practice exam, ${EXAM_FORMAT.durationMinutes}-minute time limit</li>
        <li>Self-test score 0–${EXAM_FORMAT.maxScore}, informal passing line at ${EXAM_FORMAT.passingScore}</li>
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
        <li>Take the <a href="#/exam">practice exam</a>.</li>
        <li>Track improvement on the <a href="#/progress">progress dashboard</a>.</li>
      </ol>
    </section>
  `;
}
```

(`.exam-note`, `.home`, `.exam-facts`, and `.domain-list` are class names already used — unstyled, plain elements — in the copied `css/style.css`; reusing them here means no CSS changes are needed.)

- [ ] **Step 2: Verify in the browser**

Reload `http://localhost:8002/#/`. Expected: the "not a certification" note, exam facts, and all 6 domains with their weights (15/20/20/15/20/10) render. Clicking a domain link navigates to `#/study/<id>` (still "Coming soon" until Task 17).

- [ ] **Step 3: Commit**

```bash
git add js/views/home.js
git commit -m "Implement home view with 'not a certification' honesty note"
```

---

## Task 4: Architecture & Data Types — study content

**Files:**
- Create: `js/data/studyContent.js`

**Interfaces:**
- Consumes: `domain: 'architecture'` id from `js/data/examInfo.js`.
- Produces: `STUDY_CONTENT` array (consumed by `validateStudyContent` in Task 2's validator, and by `js/views/studyGuide.js` in Task 17).

This domain (15% weight) covers, per the design spec's self-authored taxonomy: process/memory architecture, storage layout, TOAST, native data types (numeric, text, date/time, arrays, ranges, JSON/JSONB, UUID), NULL handling.

- [ ] **Step 1: Fetch supporting docs**

Fetch these via `node scripts/fetch-doc.mjs <url>` (verified live during planning; if any 404s, use WebSearch for "<topic> postgresql docs current" and fetch the correct current URL instead):

- `https://www.postgresql.org/docs/current/tutorial-arch.html` and `https://www.postgresql.org/docs/current/overview.html` (client/server process model)
- `https://www.postgresql.org/docs/current/runtime-config-resource.html` and `https://www.postgresql.org/docs/current/runtime-config-connection.html` (memory: shared_buffers, work_mem, max_connections)
- `https://www.postgresql.org/docs/current/wal-intro.html` (WAL as the durability backbone)
- `https://www.postgresql.org/docs/current/storage.html`, `https://www.postgresql.org/docs/current/storage-file-layout.html`, `https://www.postgresql.org/docs/current/storage-page-layout.html` (data directory structure, 8KB pages, tuple headers)
- `https://www.postgresql.org/docs/current/storage-toast.html` (TOAST)
- `https://www.postgresql.org/docs/current/datatype.html` (type catalog overview)
- `https://www.postgresql.org/docs/current/datatype-numeric.html`, `https://www.postgresql.org/docs/current/datatype-character.html`, `https://www.postgresql.org/docs/current/datatype-datetime.html`
- `https://www.postgresql.org/docs/current/arrays.html`, `https://www.postgresql.org/docs/current/rangetypes.html`, `https://www.postgresql.org/docs/current/datatype-json.html`, `https://www.postgresql.org/docs/current/datatype-uuid.html`
- `https://www.postgresql.org/docs/current/functions-comparison.html` (NULL / three-valued logic)

- [ ] **Step 2: Write study notes grounded in the fetched docs**

Create `js/data/studyContent.js` with 4 sections for this domain (`domain: 'architecture'`), each with 3-6 `topics` (prose paragraphs, not copied bullet lists) covering every knowledge item listed above:

```js
// js/data/studyContent.js
export const STUDY_CONTENT = [
  {
    domain: 'architecture',
    taskStatement: 'Server Architecture & Process Model',
    topics: [
      // Cover: client/server model and the postmaster forking one backend
      // process per connection (tutorial-arch.html), the path of a query
      // through parse/plan/execute (overview.html), WAL as the durability
      // mechanism underlying crash recovery (wal-intro.html), and the
      // memory knobs shared_buffers/work_mem/max_connections
      // (runtime-config-resource.html, runtime-config-connection.html).
    ],
  },
  {
    domain: 'architecture',
    taskStatement: 'Physical Storage & TOAST Internals',
    topics: [
      // Cover: PGDATA directory structure (base/, pg_wal/, tablespaces),
      // 1GB file segment splitting, 8KB page layout with
      // PageHeaderData/ItemIdData, heap tuple headers (xmin/xmax) —
      // grounded in storage.html, storage-file-layout.html,
      // storage-page-layout.html. Then TOAST: why it exists (values too
      // big for a page), the ~2kB threshold, and the four per-column
      // strategies (PLAIN/EXTENDED/MAIN/EXTERNAL) — storage-toast.html.
    ],
  },
  {
    domain: 'architecture',
    taskStatement: 'Core Scalar & Temporal Data Types',
    topics: [
      // Cover: numeric/decimal precision and integer ranges
      // (datatype-numeric.html); char(n) vs varchar(n) vs text — note
      // the docs explicitly say char(n) has NO performance advantage
      // and wastes space via padding (datatype-character.html);
      // timestamp vs timestamptz and UTC storage (datatype-datetime.html);
      // UUID including PG18's native UUIDv7 generation alongside
      // long-standing UUIDv4 (datatype-uuid.html).
    ],
  },
  {
    domain: 'architecture',
    taskStatement: 'Composite & Semi-Structured Data, and NULL Semantics',
    topics: [
      // Cover: arrays (1-based indexing, unenforced declared sizes,
      // slicing — arrays.html); range types (inclusive/exclusive bounds,
      // discrete vs continuous, exclusion constraints — rangetypes.html);
      // json vs jsonb (json preserves exact text/whitespace/key
      // order/duplicate keys; jsonb reparses, drops whitespace, keeps
      // only the last duplicate key — datatype-json.html); NULL's
      // three-valued logic and why `= NULL` never matches, versus
      // `IS [NOT] DISTINCT FROM` for null-safe comparison
      // (functions-comparison.html).
    ],
  },
];
```

Replace each comment with 3-6 real `{ title, body }` topic objects (body >= 2-3 sentences each, in your own words, factually grounded in the fetched docs — not copied verbatim).

**Mandatory verbatim-copying check:** before committing, run an 8-word verbatim-overlap check for every topic body against the cached doc text it's drawn from. Sanity-check the checker itself first by planting a known 8+ word verbatim phrase and confirming it's flagged, before trusting a clean result. Reword any real hit. Short technical terms and proper nouns (type names, function names) don't count as copying; multi-word descriptive clauses lifted intact do.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors mentioning `studyContent` or `architecture`; still reports `questions.js not present yet, skipping` and `flashcards.js not present yet, skipping`; ends with `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Architecture & Data Types domain study content"
```

---

## Task 5: Architecture & Data Types — quiz questions

**Files:**
- Create: `js/data/questions.js`

**Interfaces:**
- Produces: `QUESTIONS` array (consumed by `validateQuestions` in Task 2's validator, and by `js/views/quiz.js`/`js/views/mockExam.js` in Tasks 17/17).

**Mandatory verification method for every question in every question task (this one and Tasks 7, 9, 11, 13, 15):**

1. Before adding a question, re-read the exact source passage it's based on and explicitly confirm two things: (a) the option marked correct in `correctIndexes` is actually what the docs say, and (b) every other option is actually wrong per the docs (not just "less good"). Never add a question whose answer key you haven't just re-confirmed against the cached doc text.
2. Before committing, run an 8-word verbatim-overlap check (question + all options + explanation, against every cached doc) and reword any hit — sanity-check the checker itself first (plant a known violation, confirm it's caught).
3. Before committing, check option-length balance: the correct option should not be the single longest option in a majority of your questions, and should not be conspicuously longer/more detailed than its distractors in any individual question.
4. Before committing, check answer-position balance: count how many times each option index (0/1/2/3 for multiple-choice) is the correct answer across this domain's questions. If any single position is wildly over-represented (e.g. >40% for a 4-option set), reshuffle the skewed questions' `options` arrays (updating `correctIndexes` to match).

Grounding notes from planning research (fold these nuances into questions where they make for a good, defensible distractor — none of this is required verbatim, it's context to write sharper questions):
- json vs jsonb: `json` preserves whitespace/key order/all duplicate keys exactly as input; `jsonb` reparses, drops whitespace, reorders keys, and keeps only the last duplicate key at write time.
- `NULL = NULL` evaluates to NULL (not true), so `WHERE col = NULL` matches nothing; `IS NOT DISTINCT FROM` is the null-safe equality operator and treats `NULL IS NOT DISTINCT FROM NULL` as true.
- `char(n)` has no documented performance advantage over `varchar(n)`/`text` — it's blank-padded (wasting space), and trailing spaces are insignificant for `char(n)` comparisons but significant for `varchar(n)`/`text`.
- TOAST engages per-column once a row's total size would exceed roughly a 2kB threshold (not per-value size alone); storage strategy (PLAIN/EXTENDED/MAIN/EXTERNAL) is configurable per column.

- [ ] **Step 1: Draft and verify at least 15 questions for the Architecture & Data Types domain**

Using the docs cached in Task 4 (fetch more via `fetch-doc.mjs` as needed), write questions distributed across the domain's sub-themes: at least 3 on server architecture/process model, 3 on storage/TOAST internals, 5 on core data types (numeric/text/datetime/UUID), and 4 on arrays/ranges/JSON/NULL semantics (15 minimum total). Mix `multiple-choice` (exactly 4 options, 1 correct) and `multiple-response` (5+ options, 2+ correct) — aim for roughly 80% multiple-choice / 20% multiple-response.

Create `js/data/questions.js`:

```js
// js/data/questions.js
export const QUESTIONS = [
  {
    id: 'architecture-001',
    domain: 'architecture',
    questionType: 'multiple-choice',
    question: '...',
    options: ['...', '...', '...', '...'],
    correctIndexes: [0],
    explanation: '...',
  },
  // ... continue through at least architecture-015, each following the
  // verification method above before being added.
];
```

Use IDs `architecture-001` through `architecture-0NN` in order.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors; `flashcards.js not present yet, skipping`; `All content validated successfully.`

Also run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number >= 15.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Architecture & Data Types domain quiz questions"
```

---

## Task 6: Querying & SQL — study content

**Files:**
- Modify: `js/data/studyContent.js`

**Interfaces:**
- Consumes: existing `STUDY_CONTENT` array structure from Task 4 — append new sections, don't restructure existing ones.

This domain (20% weight) covers: joins, subqueries, CTEs (including recursive), window functions, aggregate functions, JSON/JSONB querying, full-text search basics, upsert (`ON CONFLICT`).

- [ ] **Step 1: Fetch supporting docs**

```
https://www.postgresql.org/docs/current/queries-table-expressions.html
https://www.postgresql.org/docs/current/functions-subquery.html
https://www.postgresql.org/docs/current/queries-with.html
https://www.postgresql.org/docs/current/functions-window.html
https://www.postgresql.org/docs/current/tutorial-window.html
https://www.postgresql.org/docs/current/functions-aggregate.html
https://www.postgresql.org/docs/current/functions-json.html
https://www.postgresql.org/docs/current/textsearch.html
https://www.postgresql.org/docs/current/textsearch-intro.html
https://www.postgresql.org/docs/current/textsearch-tables.html
https://www.postgresql.org/docs/current/sql-insert.html
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'querying'`) before the closing `];` of `STUDY_CONTENT`:

- **"Combining & Filtering Rows"** — joins (INNER/LEFT/RIGHT/FULL OUTER/CROSS, `USING` vs `ON` vs `NATURAL`) from `queries-table-expressions.html` §7.2.1; subqueries (`EXISTS`, `IN`, `NOT IN`, `ANY`/`SOME`, `ALL`) from `functions-subquery.html` §9.24. **Important nuance to include:** a filter on the right-hand (nullable) table placed in `WHERE` silently turns a `LEFT OUTER JOIN` back into an `INNER JOIN`; the same filter in the `ON` clause preserves outer-join semantics.
- **"Reusable Query Blocks: CTEs"** — `WITH` queries and `WITH RECURSIVE` (search order, cycle detection, `SEARCH`/`CYCLE` clauses) from `queries-with.html` §7.8.
- **"Aggregation & Window Analytics"** — aggregate functions (`count`/`sum`/`avg`/`array_agg`/`string_agg`, ordered-set aggregates) from `functions-aggregate.html` §9.21, `GROUP BY`/`HAVING` from `queries-table-expressions.html` §7.2.3-7.2.5, plus window functions (`row_number`, `rank`, `lag`/`lead`, `OVER`/`PARTITION BY`/frame clauses) from `functions-window.html` §9.22 and `tutorial-window.html` §3.5. **Important nuance:** a window function with `ORDER BY` in `OVER` but no explicit frame clause defaults to `RANGE BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW`, so `sum(x) OVER (ORDER BY y)` computes a running total, not the partition total.
- **"Beyond Relational: JSON, Full-Text Search & Upsert"** — JSON/JSONB querying (`->`, `->>`, `@>`, `jsonb_set`) from `functions-json.html` §9.16; full-text search (`to_tsvector`/`to_tsquery`/`@@`, GIN indexes) from `textsearch.html` ch. 12; upsert (`DO NOTHING` vs `DO UPDATE`, `EXCLUDED` pseudo-table) from the "ON CONFLICT Clause" section of `sql-insert.html`.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check** (same method as Task 4, Step 2): run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Querying & SQL domain study content"
```

---

## Task 7: Querying & SQL — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Interfaces:**
- Consumes: existing `QUESTIONS` array from Task 5 — append, don't restructure existing entries.

**Verification method for every question in this task:** identical to Task 5's four-part method.

Grounding notes from planning research (use where they make for a sharp, defensible question):
- `NOT IN (subquery)` where the subquery produces even one `NULL` makes the *entire* `NOT IN` expression evaluate to NULL/unknown for every outer row — silently returning zero rows. `NOT EXISTS` (correlated) doesn't have this trap.
- A `LEFT JOIN` filter condition on the nullable side belongs in `ON`, not `WHERE` — putting it in `WHERE` silently converts the query to an `INNER JOIN`.
- Two `jsonb` values with keys inserted in a different order are still equal to each other; two `json` values with different key order or whitespace are NOT textually identical (json preserves exact input text).

- [ ] **Step 1: Draft and verify at least 20 questions for the Querying & SQL domain**

Using docs cached in Task 6 (fetch more as needed), write questions covering joins/subqueries, CTEs, aggregation/window functions, and JSON/full-text-search/upsert (20 minimum, roughly evenly split across the four groupings). IDs `querying-001` through `querying-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'querying').length))"`
Expected: a number >= 20.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Querying & SQL domain quiz questions"
```

---

## Task 8: Indexing & Performance — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (20% weight) covers: index types (B-tree, Hash, GIN, GiST, BRIN, partial/expression indexes), `EXPLAIN`/`EXPLAIN ANALYZE`, the query planner/cost model, common performance pitfalls.

- [ ] **Step 1: Fetch supporting docs**

```
https://www.postgresql.org/docs/current/indexes.html
https://www.postgresql.org/docs/current/indexes-types.html
https://www.postgresql.org/docs/current/gin.html
https://www.postgresql.org/docs/current/gist.html
https://www.postgresql.org/docs/current/brin.html
https://www.postgresql.org/docs/current/indexes-partial.html
https://www.postgresql.org/docs/current/indexes-expressional.html
https://www.postgresql.org/docs/current/sql-explain.html
https://www.postgresql.org/docs/current/using-explain.html
https://www.postgresql.org/docs/current/planner-stats.html
https://www.postgresql.org/docs/current/runtime-config-query.html
https://www.postgresql.org/docs/current/performance-tips.html
https://www.postgresql.org/docs/current/populate.html
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'indexing'`):

- **"Index Types & When to Use Each"** — overview/comparison table from `indexes.html`/`indexes-types.html`; drill into `gin.html`, `gist.html`, `brin.html` for the more specialized types. Note there's no dedicated Hash-index deep-dive chapter — it's covered only in the `indexes-types.html` summary table, and that's sufficient (equality-only, WAL-logged and crash-safe since PG10, no multi-column support). Contrast operator support: B-tree's full range of comparison operators vs Hash's equality-only vs GIN's containment operators vs BRIN's lossy min/max summaries.
- **"Targeted Indexing: Partial & Expression Indexes"** — `indexes-partial.html` and `indexes-expressional.html`; both trade write-time cost for read-time selectivity by shrinking/specializing an index rather than choosing a different access method.
- **"Reading Query Plans: EXPLAIN & the Cost Model"** — `sql-explain.html` (syntax reference), `using-explain.html` (reading plan trees, cost=startup..total, actual vs estimated rows), `planner-stats.html` (where row estimates come from: `pg_statistic`/`ANALYZE`), `runtime-config-query.html` (the cost constants `seq_page_cost`/`random_page_cost`/`cpu_*_cost`). **Important nuance:** `EXPLAIN ANALYZE` actually *executes* the statement — for `INSERT`/`UPDATE`/`DELETE` this modifies real data even though the docs note the output rows are discarded; wrap in `BEGIN; ... ROLLBACK;` to avoid persisting changes.
- **"Performance Pitfalls & Operational Tuning"** — `performance-tips.html` (umbrella chapter), `populate.html` (bulk-load anti-patterns: autocommit-per-row, indexing before loading, stale stats after a big load). **Important nuance:** the default `random_page_cost` (4.0) models spinning-disk I/O asymmetry; on all-SSD systems this biases the planner toward sequential scans more than is actually optimal — only the *ratio* between cost constants matters, not their absolute values.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Indexing & Performance domain study content"
```

---

## Task 9: Indexing & Performance — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's four-part method.

Grounding notes from planning research:
- BRIN indexes use lossy block-range summaries (min/max per `pages_per_range`); every BRIN scan is followed by a recheck of the actual row. BRIN is a poor choice when the indexed column's physical storage order isn't correlated with its logical value (e.g. a randomly-ordered UUID column) — a common trap is assuming BRIN is "just a smaller B-tree."
- `EXPLAIN` alone only estimates and never executes; `EXPLAIN ANALYZE` actually executes the statement.
- Hash indexes support equality lookups only — no range queries, no `ORDER BY`, no multi-column indexes, and can't back a `UNIQUE` constraint.

- [ ] **Step 1: Draft and verify at least 20 questions for the Indexing & Performance domain**

Using docs cached in Task 8 (fetch more as needed), write questions covering index types (B-tree/Hash/GIN/GiST/BRIN), partial/expression indexes, `EXPLAIN`/cost model, and performance pitfalls (20 minimum). IDs `indexing-001` through `indexing-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'indexing').length))"`
Expected: a number >= 20.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Indexing & Performance domain quiz questions"
```

---

## Task 10: Transactions & Concurrency (MVCC) — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (15% weight) covers: MVCC internals, isolation levels, locking (row/table/advisory), deadlocks, `SERIALIZABLE` behavior.

- [ ] **Step 1: Fetch supporting docs**

```
https://www.postgresql.org/docs/current/mvcc.html
https://www.postgresql.org/docs/current/mvcc-intro.html
https://www.postgresql.org/docs/current/mvcc-caveats.html
https://www.postgresql.org/docs/current/transaction-iso.html
https://www.postgresql.org/docs/current/explicit-locking.html
https://www.postgresql.org/docs/current/functions-admin.html
https://www.postgresql.org/docs/current/view-pg-locks.html
https://www.postgresql.org/docs/current/runtime-config-locks.html
https://www.postgresql.org/docs/current/applevel-consistency.html
https://www.postgresql.org/docs/current/mvcc-serialization-failure-handling.html
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'transactions'`):

- **"MVCC Fundamentals & Snapshots"** — `mvcc.html`, `mvcc-intro.html`, `mvcc-caveats.html`: how PostgreSQL versions rows instead of locking readers, snapshot visibility. **Important nuance:** `TRUNCATE` and table-rewriting `ALTER TABLE` variants are NOT MVCC-safe — a concurrent older-snapshot transaction that hadn't touched the table yet sees it as empty/rewritten once the DDL commits, unlike ordinary DML.
- **"Isolation Levels & the SQL Standard"** — `transaction-iso.html` §13.2.1-13.2.3 (Read Committed, Repeatable Read, Serializable): what phenomena each level does/doesn't prevent. **Important nuance:** PostgreSQL only implements 3 of the 4 SQL-standard levels — requesting Read Uncommitted silently gives Read Committed behavior (dirty reads are never possible at any level in PostgreSQL).
- **"Locking Mechanics: Table, Row & Advisory"** — `explicit-locking.html` §13.3.1-13.3.5 plus `functions-admin.html` (advisory lock functions) and `view-pg-locks.html` (inspecting live locks): lock modes/conflict matrix, `SELECT FOR UPDATE`/`FOR SHARE` row locking, session- vs transaction-level advisory locks.
- **"Deadlocks & Serializable Failure Handling"** — `explicit-locking.html#LOCKING-DEADLOCKS`, `runtime-config-locks.html` (`deadlock_timeout`), `applevel-consistency.html`, `mvcc-serialization-failure-handling.html`: deadlock detection/victim selection, `SQLSTATE 40001`/`40P01` retry patterns. **Important nuance:** `SERIALIZABLE` is Serializable Snapshot Isolation (SSI) layered on `REPEATABLE READ` — it uses predicate locking to *detect* dangerous conflict patterns and aborts one transaction with a serialization failure, rather than adding blocking locks during normal operation.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Transactions & Concurrency (MVCC) domain study content"
```

---

## Task 11: Transactions & Concurrency (MVCC) — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's four-part method.

Grounding notes from planning research:
- Requesting `READ UNCOMMITTED` in PostgreSQL silently gives `READ COMMITTED` behavior — dirty reads are impossible at any isolation level.
- `SERIALIZABLE`'s integrity guarantee does NOT extend to hot-standby/logical replicas — the strictest isolation level usable on a read replica is `REPEATABLE READ`.
- A newly created table becomes visible immediately to concurrent `REPEATABLE READ`/`SERIALIZABLE` transactions (system-catalog access is an exception to normal snapshot visibility), even though the table's row *contents* still obey normal snapshot rules.

- [ ] **Step 1: Draft and verify at least 15 questions for the Transactions & Concurrency domain**

Using docs cached in Task 10 (fetch more as needed), write questions covering MVCC fundamentals, isolation levels, locking mechanics, and deadlocks/serialization failures (15 minimum). IDs `transactions-001` through `transactions-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'transactions').length))"`
Expected: a number >= 15.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Transactions & Concurrency (MVCC) domain quiz questions"
```

---

## Task 12: Administration & Maintenance — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (20% weight) covers: roles/permissions, `VACUUM`/autovacuum, backup and restore (`pg_dump`/`pg_restore`, physical backups, WAL archiving), configuration/tuning basics, extensions, partitioning management.

- [ ] **Step 1: Fetch supporting docs**

```
https://www.postgresql.org/docs/current/user-manag.html
https://www.postgresql.org/docs/current/ddl-priv.html
https://www.postgresql.org/docs/current/sql-createrole.html
https://www.postgresql.org/docs/current/sql-grant.html
https://www.postgresql.org/docs/current/predefined-roles.html
https://www.postgresql.org/docs/current/routine-vacuuming.html
https://www.postgresql.org/docs/current/sql-vacuum.html
https://www.postgresql.org/docs/current/runtime-config-autovacuum.html
https://www.postgresql.org/docs/current/backup.html
https://www.postgresql.org/docs/current/app-pgdump.html
https://www.postgresql.org/docs/current/app-pg-dumpall.html
https://www.postgresql.org/docs/current/app-pgbasebackup.html
https://www.postgresql.org/docs/current/continuous-archiving.html
https://www.postgresql.org/docs/current/runtime-config.html
https://www.postgresql.org/docs/current/extend-extensions.html
https://www.postgresql.org/docs/current/sql-createextension.html
https://www.postgresql.org/docs/current/ddl-partitioning.html
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'administration'`):

- **"Access Control: Roles, Privileges & Predefined Roles"** — `user-manag.html` (roles, role attributes, membership), `ddl-priv.html` (privilege model, `GRANT`/`REVOKE`), `sql-createrole.html`/`sql-grant.html` (exact syntax), `predefined-roles.html` (`pg_read_all_data`, `pg_monitor`, etc.). **Important nuance:** `CREATE USER` is literally `CREATE ROLE ... LOGIN` with a different default — roles and users are the same object type, distinguished only by the `LOGIN` attribute.
- **"Routine Maintenance: VACUUM, Autovacuum & Storage Reclamation"** — `routine-vacuuming.html` (concepts, transaction ID wraparound), `sql-vacuum.html` (`FULL`/`FREEZE`/`PARALLEL` options), `runtime-config-autovacuum.html` (tuning parameters). **Important nuance:** plain `VACUUM` never shrinks a table's on-disk footprint back to the OS (only trailing all-free pages under an exclusive lock) — it only marks dead-tuple space reusable internally; only `VACUUM FULL` (which rewrites the whole table) returns space to the OS, and autovacuum never issues `VACUUM FULL`. Also: autovacuum's trigger is a formula — `autovacuum_vacuum_threshold` (default 50) plus `autovacuum_vacuum_scale_factor` (default 20%) times the table's estimated row count — so large high-churn tables can go under-vacuumed by default for a long time.
- **"Backup, Restore & Point-in-Time Recovery"** — `backup.html` (the three strategies: SQL dump, filesystem-level, continuous archiving), `app-pgdump.html`/`app-pg-dumpall.html` (logical backup/restore), `app-pgbasebackup.html` (physical/base backups), `continuous-archiving.html` (WAL archiving and PITR). **Important nuance:** `pg_dump` backs up a single database's objects/data but explicitly does NOT include roles, tablespaces, or cluster-wide privilege grants — only `pg_dumpall` (or `pg_dumpall --globals-only`) captures those.
- **"Server Configuration, Extensions & Partitioning"** — `runtime-config.html` (parameter categories overview), `extend-extensions.html`/`sql-createextension.html`, `ddl-partitioning.html` (declarative partitioning, `ATTACH`/`DETACH`, partition pruning).

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Administration & Maintenance domain study content"
```

---

## Task 13: Administration & Maintenance — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's four-part method.

Grounding notes from planning research:
- Plain `VACUUM` does not shrink a table file on disk (except trailing free pages); only `VACUUM FULL` does, and autovacuum never runs `VACUUM FULL` automatically.
- `pg_dump` does NOT include roles, tablespaces, or config-parameter privilege grants — those require `pg_dumpall`.
- `CREATE USER` and `CREATE ROLE ... LOGIN` create the identical object type — there's no structural distinction, just the `LOGIN` attribute.

- [ ] **Step 1: Draft and verify at least 20 questions for the Administration & Maintenance domain**

Using docs cached in Task 12 (fetch more as needed), write questions covering roles/permissions, VACUUM/autovacuum, backup/restore, and configuration/extensions/partitioning (20 minimum). IDs `administration-001` through `administration-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'administration').length))"`
Expected: a number >= 20.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Administration & Maintenance domain quiz questions"
```

---

## Task 14: Replication & High Availability — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (10% weight, the smallest) covers: streaming replication, logical replication, failover concepts, connection pooling (e.g. PgBouncer), read replicas.

- [ ] **Step 1: Fetch supporting docs**

```
https://www.postgresql.org/docs/current/high-availability.html
https://www.postgresql.org/docs/current/warm-standby.html
https://www.postgresql.org/docs/current/runtime-config-replication.html
https://www.postgresql.org/docs/current/app-pgbasebackup.html
https://www.postgresql.org/docs/current/logical-replication.html
https://www.postgresql.org/docs/current/logical-replication-publication.html
https://www.postgresql.org/docs/current/logical-replication-subscription.html
https://www.postgresql.org/docs/current/logical-replication-restrictions.html
https://www.postgresql.org/docs/current/warm-standby-failover.html
https://www.postgresql.org/docs/current/different-replication-solutions.html
https://www.postgresql.org/docs/current/hot-standby.html
```

Also fetch these for the connection-pooling sub-topic — **not covered by postgresql.org's own docs** (confirmed during planning: only two incidental mentions exist, neither explains pooling modes), so this sub-topic uses PgBouncer's own official docs instead:

```
https://www.pgbouncer.org/
https://www.pgbouncer.org/config.html
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'replication'`):

- **"Physical (Streaming) Replication Fundamentals"** — primary/standby architecture, WAL streaming, `primary_conninfo`, replication slots, synchronous vs asynchronous replication — `high-availability.html`, `warm-standby.html`, `runtime-config-replication.html`, `app-pgbasebackup.html`. **Important nuance:** streaming replication is asynchronous by default; synchronous replication is opt-in via `synchronous_standby_names`/`synchronous_commit`, and even then the level chosen (`remote_write` vs `on` vs `remote_apply`) controls whether "synchronous" means received, flushed, or actually applied/visible for reads.
- **"Logical Replication: Publish/Subscribe Model"** — publications, subscriptions, restrictions — `logical-replication.html`, `logical-replication-publication.html`, `logical-replication-subscription.html`, `logical-replication-restrictions.html`.
- **"High Availability & Failover"** — detecting primary failure, `pg_ctl promote`/`pg_promote()`, why core PostgreSQL has no built-in automatic failover — `warm-standby-failover.html`, `different-replication-solutions.html`. **Important nuance:** PostgreSQL explicitly does NOT provide automatic-failure-detection or automatic-promotion software — that's delegated to third-party tools (e.g. Patroni, repmgr).
- **"Read Scaling & Connection Pooling"** — read replicas via hot standby (`hot-standby.html`); a "warm standby" (WAL applied, not queryable) vs a "hot standby" (accepts read-only queries) is a genuine terminology distinction. Then connection pooling: since PostgreSQL core has no built-in pooler, this section should explicitly note that and introduce PgBouncer's `pool_mode` (session/transaction/statement) from `pgbouncer.org/config.html` as the external, industry-standard tool for this.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing — this applies to the PgBouncer docs content too, not just postgresql.org pages.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Replication & High Availability domain study content"
```

---

## Task 15: Replication & High Availability — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's four-part method.

Grounding notes from planning research:
- A standby with WAL applied but not queryable is a "warm standby"; only once it accepts read-only queries (`hot_standby=on`) is it a "hot standby" (informally, a "read replica"). A distractor conflating these two terms is defensible since many engineers use them loosely.
- PostgreSQL has NO built-in automatic failover and NO built-in connection pooler — both are explicitly delegated to third-party tools per the official docs. A strong question format: "which of these is NOT part of core PostgreSQL?" with PgBouncer/Patroni/repmgr/pgpool-II as correct "external tool" answers vs. `pg_ctl promote`/replication slots as genuine core features.
- Synchronous replication's `synchronous_commit` level controls whether a standby has *received*, *flushed*, or *applied* (visible for reads) the data — these are three meaningfully different guarantees, not synonyms.

- [ ] **Step 1: Draft and verify at least 10 questions for the Replication & High Availability domain**

Using docs cached in Task 14 (fetch more as needed), write questions covering streaming replication, logical replication, failover concepts, and connection pooling/read replicas (10 minimum). IDs `replication-001` through `replication-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number >= 100 (this is the full bank across all 6 domains — confirms the Global Constraints target is met).

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Replication & High Availability domain quiz questions"
```

---

## Task 16: Flashcard deck

**Files:**
- Create: `js/data/flashcards.js`

**Interfaces:**
- Produces: `FLASHCARDS` array (consumed by `validateFlashcards` in Task 2's validator, and by `js/views/flashcards.js` in Task 17).

- [ ] **Step 1: Build the deck from already-cached research**

Most of the material needed is already in `.cache/aws-docs/` from Tasks 4-15 (every major concept used across the 6 domains was fetched during those tasks). For concepts covered in earlier tasks, write the flashcard directly from the cached doc already on disk — don't refetch. Only fetch new pages for concepts not yet researched.

Target ~65 cards spanning all 6 domains, covering core PostgreSQL objects/concepts:

- **Architecture & Data Types:** TOAST, JSONB, JSON, UUID, Array type, Range type, NULL (three-valued logic), NUMERIC type, TIMESTAMPTZ, shared_buffers, Write-Ahead Log (WAL)
- **Querying & SQL:** CTE (WITH query), Recursive CTE, Window function, JOIN (INNER/LEFT/RIGHT/FULL), Subquery, ON CONFLICT (upsert), Full-text search (tsvector/tsquery), Aggregate function, GROUP BY/HAVING
- **Indexing & Performance:** B-tree index, Hash index, GIN index, GiST index, BRIN index, Partial index, Expression index, EXPLAIN, EXPLAIN ANALYZE, Query planner, seq_page_cost/random_page_cost
- **Transactions & Concurrency:** MVCC, Isolation level, Read Committed, Repeatable Read, Serializable, Row lock, Table lock, Advisory lock, Deadlock, Serialization failure (SSI), Snapshot
- **Administration & Maintenance:** Role, Schema, VACUUM, Autovacuum, VACUUM FULL, pg_dump, pg_dumpall, pg_restore, WAL archiving, pg_basebackup, Extension, Declarative partitioning, Tablespace, GRANT/REVOKE, Predefined role, Sequence, Trigger, View, Materialized view
- **Replication & High Availability:** Streaming replication, Logical replication, Publication, Subscription, Replication slot, Hot standby, Warm standby, Failover, pg_promote, Connection pooling, PgBouncer, Synchronous replication

```js
// js/data/flashcards.js
export const FLASHCARDS = [
  {
    id: 'toast',
    service: 'TOAST',
    front: 'What is it?',
    back: '...',
  },
  // ... ~65 cards total
];
```

(The field is still named `service` for schema/validator compatibility with the copied `validate-content.mjs`, even though these are PostgreSQL objects/concepts rather than AWS services — renaming it would require also editing the validator and view code, for zero behavioral benefit.)

**Mandatory verbatim-copying check**: run it before committing (same method as the study-content tasks).

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 3: Commit**

```bash
git add js/data/flashcards.js
git commit -m "Add flashcard deck"
```

---

## Task 17: Copy the remaining views

**Files:**
- Copy from `../aws/` unchanged: `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/progress.js`
- Copy from `../aws/`, then edit: `js/views/mockExam.js` (fix `estimateScaledScore` call, replace results-screen explanatory text)

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js`; `STUDY_CONTENT` from `js/data/studyContent.js`; `QUESTIONS` from `js/data/questions.js`; `FLASHCARDS` from `js/data/flashcards.js`; `isCorrect`, `estimateScaledScore`, `drawMockExam` from `js/lib/scoring.js`; `createStore` from `js/lib/storage.js` — all already produced by Tasks 2, 4-16.

These four views (`studyGuide.js`, `quiz.js`, `flashcards.js`, `progress.js`) are entirely content-agnostic — they only reference the generic data shapes above, which are identical between `aws/` and this project. `mockExam.js` needs the two edits documented in the Global Constraints.

- [ ] **Step 1: Copy the four unchanged views**

```bash
cp ../aws/js/views/studyGuide.js js/views/studyGuide.js
cp ../aws/js/views/quiz.js js/views/quiz.js
cp ../aws/js/views/flashcards.js js/views/flashcards.js
cp ../aws/js/views/progress.js js/views/progress.js
```

Run: `for f in studyGuide.js quiz.js flashcards.js progress.js; do diff ../aws/js/views/$f js/views/$f; done`
Expected: no output (all four files identical).

- [ ] **Step 2: Copy mockExam.js from `aws/` and apply both required edits**

```bash
cp ../aws/js/views/mockExam.js js/views/mockExam.js
```

Open `js/views/mockExam.js` and find this line inside `finishExam()`:

```js
  const score = estimateScaledScore(correctCount, exam.length);
```

Replace it with:

```js
  const score = estimateScaledScore(correctCount, exam.length, {
    minScore: EXAM_FORMAT.minScore,
    maxScore: EXAM_FORMAT.maxScore,
  });
```

(Without this, `estimateScaledScore` silently falls back to `scoring.js`'s AWS-shaped defaults of 100–1000 instead of this module's actual 0–100 scale — the same bug already found and fixed for the CKA module.)

Then find this line, a few lines further down in the same function's returned HTML:

```js
    <p class="exam-note">This is an estimate based on percent correct; AWS's real scaling formula is not public. Passing score is ${EXAM_FORMAT.passingScore}.</p>
```

Replace it with:

```js
    <p class="exam-note">This is an estimate based on percent correct on a simplified 0–${EXAM_FORMAT.maxScore} scale — there's no official PostgreSQL exam or scaling formula behind it, since this module isn't tied to a certification. Passing score is ${EXAM_FORMAT.passingScore}.</p>
```

These are the only two changes to the file — every other function (`startExam`, `finishExam`'s remaining logic, timer handling, results rendering, the retake handler) stays exactly as copied.

Run: `diff ../aws/js/views/mockExam.js js/views/mockExam.js`
Expected: a small diff showing only these two changes.

- [ ] **Step 3: Verify all five views in the browser**

With the server running (`preview_start` with name `postgres-site`):

1. `#/study` → click through all 6 domains — content renders for each (no "Coming soon"), no console errors.
2. `#/quiz` → pick a domain, answer a question, submit — instant feedback + explanation, "Next Question" advances, results screen shows a score at the end.
3. `#/flashcards` → flip a card, mark it known, toggle "show only unknown" — filtering works.
4. `#/exam` → start the practice exam, confirm 50 questions total and the countdown timer starts near 75:00; answer through to the end and submit — results screen shows the estimated score against a 0–100 scale (NOT 0–1000) with the correct pass/fail line at 70, the new explanatory text (no mention of AWS), and a per-domain breakdown summing to 50.
5. `#/progress` → confirm the quiz and practice exam attempts from steps 2 and 4 show up.
6. Check `preview_console_logs` at level `'error'` across the whole walkthrough — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add js/views/studyGuide.js js/views/quiz.js js/views/flashcards.js js/views/progress.js js/views/mockExam.js
git commit -m "Add remaining views (copied from aws/; mock exam scoring and copy fixed for the 0-100 scale)"
```

---

## Task 18: Final integration, README, and full walkthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the full automated check suite**

```bash
node --test "js/lib/*.test.mjs"
node scripts/validate-content.mjs
```

Expected: all `node --test` cases pass (6 tests total: 3 storage + 3 scoring); validator prints `All content validated successfully.`

- [ ] **Step 2: Write the final README**

```markdown
# PostgreSQL Mastery

An unofficial study site for general PostgreSQL knowledge. Not tied to any specific certification — the PostgreSQL Global Development Group doesn't run one — and not affiliated with or endorsed by the PostgreSQL Global Development Group.

Live at https://toddcooke.github.io/learn/postgres/. A companion to https://toddcooke.github.io/learn/aws/ and https://toddcooke.github.io/learn/kubernetes/.

## Running it

No install step. From this directory:

```
python3 -m http.server 8002
```

Then open http://localhost:8002/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## A note on scope

There is no single, universally recognized PostgreSQL certification the way there is for AWS (SAA-C03) or Kubernetes (CKA). This site's 6-domain taxonomy is self-authored, covering both DBA and application-development knowledge, grounded in the official PostgreSQL documentation rather than an official exam blueprint. The "practice exam" is a self-test, not a simulation of any vendor's exam.

## What's here

- **Study guide** — organized by 6 domains: Architecture & Data Types, Querying & SQL, Indexing & Performance, Transactions & Concurrency (MVCC), Administration & Maintenance, and Replication & High Availability.
- **Domain quizzes** — 100 practice questions with instant feedback and explanations.
- **Flashcards** — a cheat-sheet deck of core PostgreSQL objects and concepts with known/unknown tracking.
- **Practice exam** — a 50-question, 75-minute timed self-test weighted by domain, scored on a 0-100 scale against an informal 70-point passing line.
- **Progress dashboard** — quiz and practice exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).

## How the content was sourced

All content is grounded in the official PostgreSQL 18 documentation at postgresql.org/docs/current/ (confirmed current stable as of 2026-07-09), with one exception: connection pooling, which PostgreSQL core doesn't document at all (confirmed during planning) — that sub-topic draws from the official PgBouncer docs instead. Every quiz question was drafted from and checked against the relevant cached documentation before being added. Fetched doc pages are cached locally under `.cache/aws-docs/` (gitignored; directory name kept for consistency with tooling shared with the other two modules) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

This project's application code (router, storage/scoring libraries, view components, content tooling) is shared architecture with the sibling [`aws/`](../aws) and [`kubernetes/`](../kubernetes) modules in this repo — only the content data files and two small mock-exam edits differ. See those modules' READMEs for more on the shared tooling itself.

- `node --test "js/lib/*.test.mjs"` — runs unit tests for the pure storage/scoring logic (the bare-directory form `node --test js/lib` fails on some Node versions; use the glob form).
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.
```

- [ ] **Step 3: Full manual walkthrough**

With the server running (`preview_start` with name `postgres-site`), walk through every feature end to end (this repeats Task 17 Step 3's walkthrough as a final full-system check, now that the README and final commit are in place):

1. `#/` — the "not a certification" note and all 6 domains render correctly.
2. `#/study` → click through all 6 domains — content renders for each, no console errors.
3. `#/quiz` → run one domain quiz to completion — feedback, scoring, and results all work.
4. `#/flashcards` → flip a few cards, mark 2-3 known, toggle the "unknown only" filter — filtering works.
5. `#/exam` → start a practice exam, answer through to the end, submit — results screen renders with a per-domain breakdown summing to 50 and a score on the 0-100 scale (not 0-1000) against the 70-point line.
6. `#/progress` → confirm all of the above activity shows up.
7. Reload the page and revisit `#/progress` — expected: everything persisted.
8. Check `preview_console_logs` with `level: 'error'` across the whole walkthrough — expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Finalize README and complete end-to-end verification"
```
