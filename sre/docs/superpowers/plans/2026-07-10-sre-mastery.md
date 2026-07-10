# Site Reliability Engineering (SRE) Mastery Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, locally-served website that teaches general Site Reliability Engineering mastery — a study guide across 6 self-authored domains, a 100+ question practice bank, flashcards, a timed self-test, and a progress dashboard — as the fourth learning module in the `learn` monorepo, alongside the existing AWS SAA-C03, CKA, and PostgreSQL modules (`aws/`, `kubernetes/`, `postgres/`).

**Architecture:** This project reuses the other three modules' entire application layer verbatim — the router, base styles, storage/scoring libraries, and content-tooling scripts are content-agnostic and require no code changes. Only the content data files (`js/data/*.js`), the home view's copy, and one small, already-proven wording edit to the mock exam view are new. Content is sourced from Google's SRE Book and Workbook at `sre.google` — the field's most influential (though not vendor-neutral) canonical reference — adversarially verified before being added, with all lessons learned from the three prior module builds applied from the start.

**Tech Stack:** Identical to `aws/`, `kubernetes/`, and `postgres/`: vanilla HTML/CSS/JS, no build step, no npm. Node.js only for two standalone helper scripts and `node --test` unit tests, copied unchanged.

## Global Constraints

- **This project's own working directory is `/Users/toddcooke/IdeaProjects/learn_aws/sre`.** All file paths in this plan are relative to that directory unless given as a `../aws/`, `../kubernetes/`, or `../postgres/` sibling-copy source path. This is a subdirectory of the same `learn_aws` git repository as the other three modules — `git add`/`git commit` work fine from inside `sre/` since git resolves the repo root automatically. A single push to `main` is the entire deployment step; no separate repo, no `git subtree`, no submodule changes.
- **No per-module `.gitignore` needed.** The repo root's `.gitignore` (`.cache/` and `.worktrees/`, no leading slash) already matches these directories at any depth, including inside `sre/`.
- **No npm/build tooling of any kind.**
- The site is served via `python3 -m http.server` for local use, not opened via `file://` (ES module imports are blocked by browsers under `file://`). A working preview config named `sre-site` (port 8003) already exists in the repo root's `.claude/launch.json` — use `preview_start` with name `sre-site`, no per-module launch config needed.
- **Node version note:** this environment runs Node v25.5.0, where `node --test js/lib` (a bare directory) fails with a module-resolution error. Use the explicit glob form `node --test "js/lib/*.test.mjs"` instead — this is an environment quirk, not a project bug.
- All exam content lives in `js/data/*.js` as ES module exports.
- Every question in `js/data/questions.js` must satisfy `node scripts/validate-content.mjs` and must have been adversarially verified against cached source documentation before being added.
- **Every question and study-content topic must be checked for all three of these, mandatory in every content task's steps below, not an afterthought:**
  1. **Verbatim copying** — 8+ consecutive words matching a cached source doc. Reword any hit. Sanity-check your own checker by planting a known violation and confirming it's caught before trusting a "0 hits" result.
  2. **Answer-length balance** — for multiple-choice questions, the correct option must not be the single longest option in a majority of your questions, and must not be conspicuously longer/more detailed than its distractors in any individual question.
  3. **Answer-position balance** — checked SEPARATELY for multiple-choice and multiple-response questions. For multiple-choice, the correct answer's index must not cluster at one position (no index >40% of a domain's questions). For multiple-response, the set of correct-answer indexes must not cluster at the same 1-2 positions across questions — a prior module had every multiple-response question's correct answers land at exactly `[0,1]`, discovered only by that task's own reviewer, and required a post-hoc fix. Check this explicitly, not just the multiple-choice case. Avoid a rigid repeating cycle in file order even when aggregate counts are balanced.
- **Explanations must describe distractors by their content/claim, never by option number or ordinal position** ("the option claiming X is false because...", not "option 3 is false") — a prior module shipped two questions whose explanations went stale after their options were reshuffled for position balance, because the explanations referenced ordinals. Writing content-based explanations from the start avoids this failure mode entirely regardless of any later reshuffling.
- **Total practice question bank must reach a MINIMUM of 100**, distributed by domain as per-domain FLOORS, not an exact target: SLIs/SLOs & Error Budgets ≥ 20, Monitoring/Observability & Alerting ≥ 20, Incident Response/On-Call & Postmortems ≥ 20, Capacity Planning & Managing Load ≥ 15, Release Engineering & Change Management ≥ 15, Reliability Patterns & Toil Reduction ≥ 10. Overshooting any floor is expected and fine — a prior module's Global Constraints said "exactly 100" while every task said "at least N," an internal inconsistency this plan avoids by only ever using floor language.
- `js/lib/storage.js`'s `NAMESPACE` constant must be `'sre-prep'`, NOT `'saa-prep'`, `'cka-prep'`, or `'pg-prep'` — all four modules share the `toddcooke.github.io` origin, so an unchanged copy would collide with another module's localStorage data.
- **`scripts/validate-content.mjs` must be copied from `../postgres/scripts/validate-content.mjs`.** Verify (don't assume) that its domain-count check already reads `DOMAINS.length === 6` — this module also has exactly 6 domains, so no edit to this file should be needed; if the number differs from 6 for any reason, update it, but expect zero changes. `postgres/`'s copy already has no AWS-specific scored/unscored check, which this module also doesn't need.
- **`js/views/mockExam.js` must be copied from `../postgres/js/views/mockExam.js`, NOT `../aws/`'s.** `postgres/`'s copy already has the `estimateScaledScore()` call passing explicit `{minScore, maxScore}` options (a scoring-scale bug independently rediscovered and fixed in two prior modules) — copying from `postgres/` means that fix is already present and needs no rediscovery. Only the results-screen text (currently naming PostgreSQL) needs a one-line wording edit — see Task 17.
- SRE has no official, industry-wide certification, AND no single vendor-neutral documentation site the way postgresql.org or kubernetes.io are — the closest canonical reference is Google's own SRE Book and Workbook at `sre.google`, one company's (albeit highly influential) perspective. The home page must carry a brief, honest note saying both things — see Task 3.
- Content is sourced from `https://sre.google/sre-book/<chapter>/` and `https://sre.google/workbook/<chapter>/` (all URLs below independently verified live as of 2026-07-10). **Two specific false-friend URLs are confirmed WRONG for their obvious-sounding titles** — do not use them for the topics their names suggest:
  - `https://sre.google/sre-book/being-on-call/` does NOT substantively cover playbooks despite what its title might suggest for a "playbooks" search — it covers on-call rotation/scheduling/stress. Use `sre-book/introduction/` and `workbook/on-call/` for playbooks instead (see Task 6).
  - `https://sre.google/workbook/overload/` (Workbook Ch.17, "Identifying and Recovering from Overload") is about human/team *operational* overload (toil, burnout), NOT system overload/load-shedding/cascading failures — confirmed by direct fetch. Use `sre-book/handling-overload/` for system overload instead (see Task 8).
- No user accounts, auth, or backend. All persistence is `localStorage`, namespaced under the `sre-prep:` key prefix.
- Every doc page fetched during content research must go through `scripts/fetch-doc.mjs`, which checks `.cache/aws-docs/index.json` first (directory kept as `aws-docs` for consistency with the copied, unmodified tooling).
- Reference spec: [docs/superpowers/specs/2026-07-10-sre-mastery-design.md](../specs/2026-07-10-sre-mastery-design.md).

---

## Task 1: Project scaffold — shell, router, base styles, view stubs

**Files:**
- Create: `index.html` (new content — title/copy changed from siblings)
- Copy from `../postgres/`: `css/style.css`, `js/app.js` (both unchanged; source doesn't matter, identical across all three sibling modules)
- Create: `js/views/home.js`, `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/mockExam.js`, `js/views/progress.js` (stubs — real implementations come later)
- Create: `README.md` (stub)

**Interfaces:**
- Produces: every `js/views/*.js` module exports `function render(mount, ...params)` — identical contract to the sibling modules, since `js/app.js` is copied unchanged and calls views this way.

- [ ] **Step 1: Copy the router and base styles unchanged**

```bash
mkdir -p js/views js/data js/lib css scripts
cp ../postgres/js/app.js js/app.js
cp ../postgres/css/style.css css/style.css
```

Run: `diff ../postgres/js/app.js js/app.js && diff ../postgres/css/style.css css/style.css`
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
  <title>SRE Mastery</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="site-header">
    <h1>SRE Mastery</h1>
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
    <p>Unofficial study aid drawing on Google's publicly available SRE literature. Not affiliated with or endorsed by Google.</p>
  </footer>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

(The nav link text says "Practice Exam" rather than "Mock Exam", matching the PostgreSQL module's convention — this isn't simulating a real vendor exam. The route/filename underneath stays `#/exam` / `mockExam.js` for router-convention consistency across all four modules — see Task 17.)

- [ ] **Step 4: Create the README stub**

```markdown
# SRE Mastery

An unofficial study site for general Site Reliability Engineering knowledge, drawing on Google's publicly available SRE Book and Workbook. Not tied to any certification, and not affiliated with or endorsed by Google.

Status: under construction.
```

- [ ] **Step 5: Verify in the browser**

Start the server (via the preview tool's `preview_start` with name `sre-site`), then load `http://localhost:8003/`.

Expected: page loads with the header "SRE Mastery", nav links, and "Coming soon." in the content area. Clicking each nav link changes the URL hash and keeps showing "Coming soon." with that link highlighted. Check the browser console (`preview_console_logs`) — expect no errors.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/app.js js/views README.md
git commit -m "Add SRE site scaffold: shell, router (copied from postgres/), base styles, view stubs"
```

---

## Task 2: Core infrastructure — exam data, storage, scoring, and content tooling

**Files:**
- Create: `js/data/examInfo.js` (new content)
- Copy from `../postgres/`, then edit: `js/lib/storage.js` (NAMESPACE change)
- Copy from `../postgres/` unchanged: `js/lib/storage.test.mjs`, `js/lib/scoring.js`, `js/lib/scoring.test.mjs`, `scripts/fetch-doc.mjs`
- Copy from `../postgres/` unchanged (verify, don't assume): `scripts/validate-content.mjs`

**Interfaces:**
- Produces: `DOMAINS` (array of `{id, name, weight, mockExamCount}`, **6 entries**) and `EXAM_FORMAT` (`{totalQuestions, durationMinutes, passingScore, minScore, maxScore}`) from `js/data/examInfo.js`.
- Produces: `createStore(backend = globalThis.localStorage)` from `js/lib/storage.js`, identical shape to the other modules' — `{getQuizHistory, recordQuizAttempt, getFlashcardState, setFlashcardKnown, getMockExamHistory, recordMockExamAttempt}` — but namespaced under `'sre-prep'`.
- Produces: `isCorrect`, `estimateScaledScore`, `drawMockExam` from `js/lib/scoring.js` — identical signatures to the other modules: `estimateScaledScore(correctCount, totalCount, { minScore = 100, maxScore = 1000 } = {})`.
- Produces: `node scripts/fetch-doc.mjs <url>` and `node scripts/validate-content.mjs` — identical behavior to the other modules.

- [ ] **Step 1: Write the exam info data**

```js
// js/data/examInfo.js
export const DOMAINS = [
  { id: 'slos', name: 'SLIs, SLOs & Error Budgets', weight: 20, mockExamCount: 10 },
  { id: 'monitoring', name: 'Monitoring, Observability & Alerting', weight: 20, mockExamCount: 10 },
  { id: 'incidents', name: 'Incident Response, On-Call & Postmortems', weight: 20, mockExamCount: 10 },
  { id: 'capacity', name: 'Capacity Planning & Managing Load', weight: 15, mockExamCount: 8 },
  { id: 'release', name: 'Release Engineering & Change Management', weight: 15, mockExamCount: 7 },
  { id: 'reliability', name: 'Reliability Patterns & Toil Reduction', weight: 10, mockExamCount: 5 },
];

export const EXAM_FORMAT = {
  totalQuestions: 50,
  durationMinutes: 75,
  passingScore: 70,
  minScore: 0,
  maxScore: 100,
};
```

(`weight` sums to 100; `mockExamCount` sums to 50, matching `EXAM_FORMAT.totalQuestions` — this is the practice-exam draw size, not the full question bank. The full bank floor of 100 questions is a Global Constraint above, not a stored field, matching how the other three modules handled it.)

- [ ] **Step 2: Copy the storage library and fix the namespace**

```bash
cp ../postgres/js/lib/storage.js js/lib/storage.js
cp ../postgres/js/lib/storage.test.mjs js/lib/storage.test.mjs
```

Open `js/lib/storage.js` and change:

```js
const NAMESPACE = 'pg-prep';
```

to:

```js
const NAMESPACE = 'sre-prep';
```

This is the only line that should differ from `postgres/`'s copy.

Run: `node --test js/lib/storage.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 3: Copy the scoring library and its test unchanged**

```bash
cp ../postgres/js/lib/scoring.js js/lib/scoring.js
cp ../postgres/js/lib/scoring.test.mjs js/lib/scoring.test.mjs
```

Run: `diff ../postgres/js/lib/scoring.js js/lib/scoring.js`
Expected: no output.

Run: `node --test js/lib/scoring.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 4: Copy the doc-fetch cache script unchanged**

```bash
cp ../postgres/scripts/fetch-doc.mjs scripts/fetch-doc.mjs
```

Run: `node scripts/fetch-doc.mjs https://sre.google/sre-book/service-level-objectives/`
Expected: prints a path under `.cache/aws-docs/`, and the cached file contains readable text about service level objectives (sre.google pages have no markdown-sibling; the script's generic HTML-stripping fallback handles them — already proven against three other doc sites in prior modules). Running the exact same command again prints the same path near-instantly (cache hit, no fetch).

- [ ] **Step 5: Copy the content validator and verify the domain count**

```bash
cp ../postgres/scripts/validate-content.mjs scripts/validate-content.mjs
```

Open `scripts/validate-content.mjs` and find this line inside `validateExamInfo()`:

```js
  check(Array.isArray(DOMAINS) && DOMAINS.length === 6, 'DOMAINS must have exactly 6 entries');
```

Confirm it already reads `6` (this module also has exactly 6 domains, matching `postgres/`'s count) — no edit needed. If it reads a different number for any reason, change it to `6` and note the discrepancy in your report.

Run: `node scripts/validate-content.mjs`
Expected: `studyContent.js not present yet, skipping`, `questions.js not present yet, skipping`, `flashcards.js not present yet, skipping`, then `All content validated successfully.` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add js/data/examInfo.js js/lib/storage.js js/lib/storage.test.mjs js/lib/scoring.js js/lib/scoring.test.mjs scripts/fetch-doc.mjs scripts/validate-content.mjs
git commit -m "Add exam data, storage (namespaced sre-prep)/scoring libs, and content tooling"
```

---

## Task 3: Home view

**Files:**
- Modify: `js/views/home.js`

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js` (Task 2).

This is new content, not a copy — it needs the dual honesty note required by the spec (not a certification, AND not a vendor-neutral standard).

- [ ] **Step 1: Replace the stub with the real home view**

```js
// js/views/home.js
import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About This Site</h2>
      <p>General Site Reliability Engineering mastery — not tied to any certification.</p>
      <p class="exam-note">There is no single, industry-wide SRE certification to prepare for. This site's domains are grounded primarily in Google's "Site Reliability Engineering" book and "The Site Reliability Workbook" — the field's most influential published references, but one company's perspective, not a vendor-neutral standard the way an official exam blueprint would be.</p>
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

Reload `http://localhost:8003/#/`. Expected: the dual honesty note (not a cert, not vendor-neutral either), exam facts, and all 6 domains with their weights (20/20/20/15/15/10) render. Clicking a domain link navigates to `#/study/<id>` (still "Coming soon" until Task 17).

- [ ] **Step 3: Commit**

```bash
git add js/views/home.js
git commit -m "Implement home view with dual honesty note (not a certification, not vendor-neutral)"
```

---

## Task 4: SLIs, SLOs & Error Budgets — study content

**Files:**
- Create: `js/data/studyContent.js`

**Interfaces:**
- Consumes: `domain: 'slos'` id from `js/data/examInfo.js`.
- Produces: `STUDY_CONTENT` array (consumed by `validateStudyContent` in Task 2's validator, and by `js/views/studyGuide.js` in Task 17).

This domain (20% weight) covers: service level indicators vs. objectives vs. agreements, choosing appropriate SLIs by system type, error budgets and error-budget policy, and embracing risk / the cost of extreme reliability.

- [ ] **Step 1: Fetch supporting docs**

Fetch these via `node scripts/fetch-doc.mjs <url>` (verified live during planning; if any 404s, use WebSearch for "<topic> site:sre.google" and fetch the correct current URL instead):

- `https://sre.google/sre-book/service-level-objectives/` (SLI/SLO/SLA definitions, SLI categories by system type)
- `https://sre.google/workbook/implementing-slos/` (practical SLO adoption, request-driven/pipeline/storage system SLIs)
- `https://sre.google/workbook/slo-document/` (worked example SLO document)
- `https://sre.google/sre-book/embracing-risk/` (error budget = 1 − SLO, the cost-of-reliability argument, the "nines" framework)
- `https://sre.google/workbook/error-budget-policy/` (a formal example error-budget policy: 4-week rolling window, thresholds)
- `https://sre.google/workbook/alerting-on-slos/` (burn-rate concept — full alerting mechanics belong to Task 6, but the burn-rate *definition* is useful grounding here)
- `https://sre.google/workbook/slo-engineering-case-studies/` (Evernote and Home Depot real-world SLO adoption)

**Do not** try to find a dedicated SLA (Service Level Agreement) chapter — neither book has one. Treat SLA as a short comparison point ("SLA = SLO + consequences, usually financial/contractual") rather than a deep sub-topic; `service-level-objectives/` gives this in one paragraph, which is sufficient.

- [ ] **Step 2: Write study notes grounded in the fetched docs**

Create `js/data/studyContent.js` with 4 sections for this domain (`domain: 'slos'`), each with 3-6 `topics` (prose paragraphs, not copied bullet lists) covering every knowledge item listed above, grounded in the docs fetched in Step 1:

```js
// js/data/studyContent.js
export const STUDY_CONTENT = [
  {
    domain: 'slos',
    taskStatement: 'Defining Reliability: SLI, SLO, and SLA',
    topics: [
      // Cover: the precise definitions (SLI = a quantitative measure of
      // service level, SLO = a target value/range for an SLI, SLA = a
      // contract with consequences), and practical framing from
      // implementing-slos/ (measuring close to the user, starting
      // simple, rolling vs calendar windows). Include the SLA comparison
      // point in one sentence, not a full sub-section.
    ],
  },
  {
    domain: 'slos',
    taskStatement: 'Choosing the Right SLIs by System Type',
    topics: [
      // Cover: SLI categories by system type from service-level-objectives/
      // (user-facing serving = availability/latency/throughput; storage =
      // latency/availability/durability; pipelines = throughput/end-to-end
      // latency; all systems = correctness) and the request-driven/
      // pipeline/storage framing from implementing-slos/, grounded with
      // the worked example in slo-document/.
    ],
  },
  {
    domain: 'slos',
    taskStatement: 'Error Budgets: Definition and Policy',
    topics: [
      // Cover: error budget = 1 − SLO (derived from the SLO, not measured
      // separately), the example error-budget policy from
      // error-budget-policy/ (4-week rolling window, halt-changes rule)
      // labeled explicitly as one illustrative policy, not a universal
      // rule, and real-world adoption examples from
      // slo-engineering-case-studies/.
    ],
  },
  {
    domain: 'slos',
    taskStatement: 'Embracing Risk and the Cost of Extreme Reliability',
    topics: [
      // Cover: why 100% reliability is the wrong target (economic/UX
      // argument, not a claim of technical impossibility), the nonlinear
      // cost curve ("100x more for the next nine"), the "nines"
      // framework, and request-based ("aggregate") availability vs.
      // time-based uptime.
    ],
  },
];
```

Replace each comment with 3-6 real `{ title, body }` topic objects (body >= 2-3 sentences each, in your own words, factually grounded in the fetched docs — not copied verbatim).

**Mandatory verbatim-copying check:** before committing, run an 8-word verbatim-overlap check for every topic body against the cached doc text it's drawn from. Sanity-check the checker itself first by planting a known 8+ word verbatim phrase and confirming it's flagged, before trusting a clean result.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors mentioning `studyContent` or `slos`; still reports `questions.js not present yet, skipping` and `flashcards.js not present yet, skipping`; ends with `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add SLIs, SLOs & Error Budgets domain study content"
```

---

## Task 5: SLIs, SLOs & Error Budgets — quiz questions

**Files:**
- Create: `js/data/questions.js`

**Interfaces:**
- Produces: `QUESTIONS` array (consumed by `validateQuestions` in Task 2's validator, and by `js/views/quiz.js`/`js/views/mockExam.js` in Task 17).

**Mandatory verification method for every question in every question task (this one and Tasks 7, 9, 11, 13, 15):**

1. Before adding a question, re-read the exact source passage it's based on and explicitly confirm two things: (a) the option marked correct in `correctIndexes` is actually what the docs say, and (b) every other option is actually wrong per the docs (not just "less good"). Never add a question whose answer key you haven't just re-confirmed against the cached doc text.
2. Before committing, run an 8-word verbatim-overlap check (question + all options + explanation, against every cached doc) and reword any hit — sanity-check the checker itself first (plant a known violation, confirm it's caught).
3. Before committing, check option-length balance: the correct option should not be the single longest option in a majority of your questions, and should not be conspicuously longer/more detailed than its distractors in any individual question.
4. Before committing, check answer-position balance SEPARATELY for multiple-choice and multiple-response: count how often each option index is correct in each question type. If any position is wildly over-represented (e.g. >40% for MC, or the same 1-2 positions for every MR question), reshuffle the skewed questions' `options` arrays (updating `correctIndexes` to match).
5. Write explanations that describe distractors by their claim/content, never by ordinal position ("the option claiming X..." not "option 3...") — this makes explanations immune to later reshuffling for position balance.

Grounding notes from planning research (fold these nuances into questions where they make for a good, defensible distractor — none of this is required verbatim, it's context to write sharper questions):
- Error budget = 1 − SLO, derived from the SLO itself, not a raw incident count. A 99.9% SLO yields exactly a 0.1% error budget over the measurement window.
- The SRE book rejects 100% reliability for economic/UX reasons (nonlinear cost curve, users can't perceive the difference), NOT because it's claimed to be technically impossible — a distractor claiming "the book says 100% is impossible" is a defensible wrong answer.
- Google defines availability as request-based ("aggregate availability" = successful requests / total requests), not time-based uptime.
- The error-budget-policy/ chapter's specific numeric thresholds (4-week rolling window, 20% single-incident / 20%-per-quarter) belong to ONE illustrative example policy, not a universal SRE rule — questions using these numbers should attribute them to "Google's example policy," not present them as a universal law.

- [ ] **Step 1: Draft and verify at least 20 questions for the SLIs, SLOs & Error Budgets domain**

Using the docs cached in Task 4 (fetch more via `fetch-doc.mjs` as needed), write questions distributed across the domain's sub-themes: at least 5 on SLI/SLO/SLA definitions, 5 on choosing SLIs by system type, 5 on error budgets/policy, and 5 on embracing risk/cost of reliability (20 minimum total). Mix `multiple-choice` (exactly 4 options, 1 correct) and `multiple-response` (5+ options, 2+ correct) — aim for roughly 80% multiple-choice / 20% multiple-response.

Create `js/data/questions.js`:

```js
// js/data/questions.js
export const QUESTIONS = [
  {
    id: 'slos-001',
    domain: 'slos',
    questionType: 'multiple-choice',
    question: '...',
    options: ['...', '...', '...', '...'],
    correctIndexes: [0],
    explanation: '...',
  },
  // ... continue through at least slos-020, each following the
  // verification method above before being added.
];
```

Use IDs `slos-001` through `slos-0NN` in order.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors; `flashcards.js not present yet, skipping`; `All content validated successfully.`

Also run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number >= 20.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add SLIs, SLOs & Error Budgets domain quiz questions"
```

---

## Task 6: Monitoring, Observability & Alerting — study content

**Files:**
- Modify: `js/data/studyContent.js`

**Interfaces:**
- Consumes: existing `STUDY_CONTENT` array structure from Task 4 — append new sections, don't restructure existing ones.

This domain (20% weight) covers: the four golden signals, black-box vs. white-box monitoring, alerting on symptoms vs. causes, playbooks, SLO-based (burn-rate) alerting, and dashboards/long-term monitoring.

- [ ] **Step 1: Fetch supporting docs**

```
https://sre.google/sre-book/monitoring-distributed-systems/
https://sre.google/workbook/monitoring/
https://sre.google/sre-book/practical-alerting/
https://sre.google/sre-book/introduction/
https://sre.google/workbook/on-call/
https://sre.google/workbook/alerting-on-slos/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

**Do NOT fetch `https://sre.google/sre-book/being-on-call/` for the "playbooks" sub-topic** — despite its title suggesting a match, it does not substantively discuss playbooks (confirmed by direct fetch during planning); it's about on-call rotation/scheduling/stress instead. Use `sre-book/introduction/` (which has the "playbooks give a 3x MTTR improvement" statistic) and `workbook/on-call/` (which has a dedicated "Maintaining Playbooks" section) instead.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'monitoring'`) before the closing `];` of `STUDY_CONTENT`:

- **"Monitoring Fundamentals: What and How to Measure"** — the four golden signals (latency, traffic, errors, saturation — note saturation is specifically "how full your service is," a forward-looking measure of a constrained resource, NOT simple CPU utilization) and black-box (symptom-oriented, tests externally-visible behavior) vs. white-box (cause-oriented, uses internal metrics/logs) monitoring, grounded in `monitoring-distributed-systems/` and `workbook/monitoring/`.
- **"Alerting Philosophy: Symptoms, Causes, and Playbooks"** — alerting on symptoms vs. causes (`monitoring-distributed-systems/`'s "Symptoms Versus Causes" framing, `practical-alerting/` for rule mechanics), and the value of playbooks (the 3x MTTR statistic from `introduction/`, "Maintaining Playbooks" from `workbook/on-call/` — staleness tradeoffs, when to automate instead of documenting).
- **"SLO-Based (Burn-Rate) Alerting"** — grounded in `workbook/alerting-on-slos/`: what burn rate means (relative to the SLO's compliance window, NOT an absolute percentage — burn rate 1 exhausts the budget exactly at window's end), why single-window alerting has precision/recall problems, and multiwindow multi-burn-rate alerting as the fix (the concrete 99.9%-SLO threshold table: 14.4x/1hr page, 6x/6hr page, 1x/3day ticket).
- **"Observability Over Time: Dashboards and Time Horizons"** — the distinction between near-real-time metrics (for alerting) and longer-term/historical analysis (for trend spotting, capacity planning), and dashboard design tied to the four golden signals, grounded in `workbook/monitoring/`'s "Why Monitor?" section and `monitoring-distributed-systems/`'s "Interfaces" subsection. Note neither book has one dedicated chapter for this distinction — it's assembled from both books' "Why Monitor?" discussions, so cite specific points rather than implying a standalone chapter exists.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check** (same method as Task 4, Step 2): run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Monitoring, Observability & Alerting domain study content"
```

---

## Task 7: Monitoring, Observability & Alerting — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Interfaces:**
- Consumes: existing `QUESTIONS` array from Task 5 — append, don't restructure existing entries.

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- Saturation is precisely "how full your service is" (a constrained resource, forward-looking) — a distractor equating it with "current CPU %" is a common, subtly wrong simplification.
- Black-box vs. white-box is symptom-orientation vs. cause-orientation, NOT "external tooling vs. internal tooling" — a distractor conflating "black-box = infrastructure checks" vs. "white-box = application checks" misses the book's actual distinction.
- Burn rate is relative to the SLO window, not a fixed absolute rate. Google's specific recommended thresholds for a 99.9% SLO: burn rate 14.4 over 1hr → page; burn rate 6 over 6hr → page; burn rate 1 over 3 days → ticket. Multiwindow (long AND short window must agree) is the recommended approach specifically to fix precision/recall problems with single-window alerts.

- [ ] **Step 1: Draft and verify at least 20 questions for the Monitoring, Observability & Alerting domain**

Using docs cached in Task 6 (fetch more as needed), write questions covering the four golden signals/black-box-white-box, alerting philosophy/playbooks, burn-rate alerting, and dashboards/time horizons (20 minimum, roughly evenly split). IDs `monitoring-001` through `monitoring-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'monitoring').length))"`
Expected: a number >= 20.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Monitoring, Observability & Alerting domain quiz questions"
```

---

## Task 8: Incident Response, On-Call & Postmortems — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (20% weight) covers: healthy on-call practices and escalation, incident command roles, communication during incidents (including declaration/severity), and blameless postmortem culture.

- [ ] **Step 1: Fetch supporting docs**

```
https://sre.google/sre-book/being-on-call/
https://sre.google/sre-book/dealing-with-interrupts/
https://sre.google/workbook/on-call/
https://sre.google/sre-book/managing-incidents/
https://sre.google/workbook/incident-response/
https://sre.google/sre-book/incident-document/
https://sre.google/sre-book/emergency-response/
https://sre.google/sre-book/postmortem-culture/
https://sre.google/workbook/postmortem-culture/
https://sre.google/sre-book/example-postmortem/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404. (`being-on-call/` IS the right chapter for on-call itself, unlike its unsuitability for "playbooks" noted in Task 6 — its title matches its actual on-call/escalation content here.)

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'incidents'`):

- **"On-Call Health, Escalation & Readiness"** — response-time targets, the "max ~2 incidents per shift" staffing heuristic (a workload-planning estimate, NOT a hard cap on responding — each incident averages ~6 hours fully handled, requiring roughly 8 engineers minimum for sustainable follow-the-sun coverage under a 25%-of-time ceiling), primary/secondary escalation, from `being-on-call/`, `dealing-with-interrupts/`, `workbook/on-call/`.
- **"Incident Command: Roles & Coordination"** — Incident Commander, Operations Lead, Communications Lead, Planning Lead from `managing-incidents/`'s four-role model, contrasted with the Workbook's "three Cs" (coordinate, communicate, control) three-primary-role framing in `incident-response/` — explicitly note this is a genuine inconsistency between the two books (3 vs. 4 core roles), not an error to resolve.
- **"Communicating Through a Crisis (and When to Declare One)"** — the living incident document as source of truth, declaration criteria (second team needed, customer-visible, unresolved after ~1 hour) from `managing-incidents/` and "declare early and often" from `incident-response/`. Note explicitly: **neither book defines a numbered severity scale (no SEV0-5 or P0-4)** — that's an industry convention from elsewhere, not how Google's own books frame it; ground any "severity" content in these qualitative declaration criteria instead.
- **"Blameless Postmortems & Organizational Learning"** — the blameless philosophy (which does NOT mean no accountability — the book explicitly warns against stopping at "human error" as a root cause, and postmortems still require named action-item owners), grounded in `postmortem-culture/` (both book and workbook versions) and `example-postmortem/`.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Incident Response, On-Call & Postmortems domain study content"
```

---

## Task 9: Incident Response, On-Call & Postmortems — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- The "max 2 incidents per on-call shift" figure is a staffing heuristic, not a rule to "stop responding after two" — a distractor implying the latter is defensible-but-wrong.
- Blameless does not mean no accountability — postmortems still name what people did and require owned, tracked action items; they just don't punish the people who took the actions.
- A defensible "how many core incident-response roles does Google define" question can have EITHER 3 or 4 as a correct answer depending on which source (SRE book vs. Workbook) is cited — a good source of a question that tests whether someone read both books, not a bug to fix.
- Neither book defines numbered severity tiers (no SEV0-5) — a question framed as "which of these does the SRE book NOT define" with a SEV-number option as the correct ("not defined") answer is well-grounded.

- [ ] **Step 1: Draft and verify at least 20 questions for the Incident Response, On-Call & Postmortems domain**

Using docs cached in Task 8 (fetch more as needed), write questions covering on-call health/escalation, incident command roles, incident communication/declaration, and blameless postmortems (20 minimum). IDs `incidents-001` through `incidents-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'incidents').length))"`
Expected: a number >= 20.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Incident Response, On-Call & Postmortems domain quiz questions"
```

---

## Task 10: Capacity Planning & Managing Load — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (15% weight) covers: load balancing at multiple layers, demand forecasting, handling overload and cascading failures, graceful degradation, and non-abstract large system design (NALSD).

- [ ] **Step 1: Fetch supporting docs**

```
https://sre.google/sre-book/load-balancing-frontend/
https://sre.google/sre-book/load-balancing-datacenter/
https://sre.google/workbook/managing-load/
https://sre.google/sre-book/service-best-practices/
https://sre.google/sre-book/reliable-product-launches/
https://sre.google/sre-book/handling-overload/
https://sre.google/sre-book/addressing-cascading-failures/
https://sre.google/workbook/non-abstract-design/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

**Do NOT fetch `https://sre.google/workbook/overload/` for this domain** — despite its title ("Identifying and Recovering from Overload"), it's about human/team operational overload (toil, on-call burnout), NOT system overload, load shedding, or cascading failures (confirmed by direct fetch during planning). Use `sre-book/handling-overload/` for system overload instead.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'capacity'`):

- **"Load Balancing Across the Stack"** — DNS load balancing (the 512-byte reply limit), Virtual-IP/L4 balancing, and backend/L7 policies (round robin, least-loaded round robin, weighted round robin, deterministic subsetting), grounded in `load-balancing-frontend/`, `load-balancing-datacenter/`, and `workbook/managing-load/`.
- **"Forecasting and Provisioning for Demand"** — validating forecasts against reality, N+2 redundant provisioning (able to survive a simultaneous planned AND unplanned outage — a step up from single-fault-tolerant N+1), launch-driven demand spikes (up to 15x estimates), and the Niantic/Pokémon GO case study where real traffic hit ~50x the initial estimate, grounded in `service-best-practices/`, `reliable-product-launches/`, `workbook/managing-load/`.
- **"Surviving Overload: Shedding, Degrading, and Preventing Cascades"** — criticality levels (CRITICAL_PLUS/CRITICAL/SHEDDABLE_PLUS/SHEDDABLE), client-side adaptive throttling (a client rejects its own requests once `requests` reaches K times `accepts`), per-client retry budgets (retry ratio capped around 10% to prevent retry amplification), and graceful degradation (serving cheaper/lower-quality responses) as distinct from load shedding (rejecting requests outright) — grounded in `handling-overload/` and `addressing-cascading-failures/`.
- **"Designing for Scale: Non-Abstract Large System Design"** — the NALSD whiteboard-to-concrete-resource methodology (a "Basic Design" phase, then a "Scaling" phase covering feasibility/failure domains/optimization), grounded in `workbook/non-abstract-design/`.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Capacity Planning & Managing Load domain study content"
```

---

## Task 11: Capacity Planning & Managing Load — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- Cascading failure has a precise definition: a failure that grows over time via POSITIVE FEEDBACK (e.g. surviving servers taking on redirected load and then failing too) — a single-root-cause outage with no feedback loop is NOT technically a cascading failure by this definition.
- Overload protection is deliberately client-side as well as server-side (adaptive throttling is a negotiated, client-cooperative behavior using criticality levels), not purely a server/load-balancer mechanism.
- Redundancy provisioning is expressed as N+2 (survive simultaneous planned + unplanned outage), not the more commonly assumed N+1 — good distractor set: N, N+1, N+2, N+3.

- [ ] **Step 1: Draft and verify at least 15 questions for the Capacity Planning & Managing Load domain**

Using docs cached in Task 10 (fetch more as needed), write questions covering load balancing layers, demand forecasting, overload/cascading-failure handling, and NALSD (15 minimum). IDs `capacity-001` through `capacity-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'capacity').length))"`
Expected: a number >= 15.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Capacity Planning & Managing Load domain quiz questions"
```

---

## Task 12: Release Engineering & Change Management — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (15% weight) covers: release engineering principles (hermetic builds, config-as-code), canarying and progressive rollout, configuration design/best practices, risky changes as a leading cause of outages, and rollback strategy.

- [ ] **Step 1: Fetch supporting docs**

```
https://sre.google/sre-book/release-engineering/
https://sre.google/workbook/canarying-releases/
https://sre.google/sre-book/service-best-practices/
https://sre.google/workbook/configuration-design/
https://sre.google/workbook/configuration-specifics/
https://sre.google/sre-book/introduction/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404. (`sre-book/introduction/` may already be cached from Task 6 — reuse it, don't refetch.)

**Do NOT look for the "~70% of outages are due to changes" statistic in `embracing-risk/`** — despite that chapter being about risk tolerance generally, it does NOT contain this specific statistic. The exact quote ("SRE has found that roughly 70% of outages are due to changes in a live system") lives in the Change Management section of `sre-book/introduction/` (Chapter 1).

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'release'`):

- **"Release Engineering Foundations"** — hermetic builds (a precise, narrow definition: build-time reproducibility independent of the local build machine's installed libraries — NOT runtime sandboxing or containerization), self-service releases, and config-as-code distribution models (mainline repo, packaged-with-binary, separate config package, external dynamic store), grounded in `release-engineering/`.
- **"Configuration as a Risk Surface"** — configuration design philosophy ("fewer knobs, the better," smart defaults, separating config interface from data format), config-induced toil, and the three required properties of a good config system (hermetic evaluation, tooling for config health, separation of config from data), grounded in `workbook/configuration-design/` and `workbook/configuration-specifics/`.
- **"Canarying & Progressive Rollout"** — canarying explicitly framed as "effectively an A/B testing process" (the canary population is the treatment, unchanged population is control) per the Workbook's own framing — NOT purely an operational rollback safety net — plus canary size/duration needing to scale with release cadence, grounded in `workbook/canarying-releases/` and `service-best-practices/`.
- **"Change Risk & Recovery (Rollback)"** — the "~70% of outages are due to changes" statistic (attributed correctly to `introduction/`, covering binary pushes, config pushes, AND new traffic patterns broadly, not just code deploys), and the "roll back first, diagnose afterward" MTTR guidance from `service-best-practices/`, tied to hermetic config evaluation enabling reliable rollback from `configuration-specifics/`.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Release Engineering & Change Management domain study content"
```

---

## Task 13: Release Engineering & Change Management — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- The "~70% of outages" statistic is in `introduction/`'s Change Management section, NOT `embracing-risk/` — a question testing this attribution is well-grounded (a plausible-but-wrong distractor would cite `embracing-risk/`).
- Canarying is explicitly equated with A/B testing by the Workbook's own text — a distractor framing it as purely an operational safety net contradicts the source directly.
- "Hermetic build" means build-time reproducibility independent of the local machine's installed libraries — a distractor equating it with runtime sandboxing/containerization is a common but wrong substitution.

- [ ] **Step 1: Draft and verify at least 15 questions for the Release Engineering & Change Management domain**

Using docs cached in Task 12 (fetch more as needed), write questions covering release engineering foundations, configuration as a risk surface, canarying/progressive rollout, and change risk/rollback (15 minimum). IDs `release-001` through `release-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'release').length))"`
Expected: a number >= 15.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Release Engineering & Change Management domain quiz questions"
```

---

## Task 14: Reliability Patterns & Toil Reduction — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (10% weight, the smallest) covers: the formal definition of toil and why it's capped, the evolution of automation, simplicity as a reliability property, and distributed-systems reliability patterns (redundancy, overload protection as Google's circuit-breaker analog, cascading-failure prevention).

- [ ] **Step 1: Fetch supporting docs**

```
https://sre.google/sre-book/eliminating-toil/
https://sre.google/workbook/eliminating-toil/
https://sre.google/sre-book/automation-at-google/
https://sre.google/sre-book/simplicity/
https://sre.google/workbook/simplicity/
https://sre.google/sre-book/managing-critical-state/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404. `load-balancing-frontend/`, `load-balancing-datacenter/`, and `handling-overload/` should already be cached from Task 10 — reuse them, don't refetch.

**Do not search for a chapter named "circuit breaker"** — neither book uses that literal term. When covering this pattern, frame it as the general distributed-systems concept and cite `handling-overload/`'s client-side adaptive throttling and criticality-based load shedding as Google's concrete implementation of the same goal (fail fast / shed load to protect callers and callees).

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'reliability'`):

- **"Toil: Definition, Detection, and Elimination"** — the 6-attribute formal definition of toil (manual, repetitive, automatable, tactical, no enduring value, scales linearly — work that produces a permanent improvement is explicitly NOT toil even if manual and one-time), and the 50% ceiling as an aspirational policy target vs. Google's empirically observed ~33% average (a good distractor pair, since these are often conflated), grounded in `eliminating-toil/` (both book and workbook versions).
- **"Automation as an Engineering Discipline"** — the hierarchy of automation from manual ops to fully autonomous self-healing systems, and the five value drivers (consistency, platform effects, faster repair, faster action, time savings), grounded in `automation-at-google/`.
- **"Simplicity as a First-Class Reliability Property"** — the Hoare quote ("the price of reliability is the pursuit of the utmost simplicity"), accidental vs. essential complexity, minimal APIs and modularity, and cyclomatic complexity as a practical proxy metric (from the Workbook), grounded in `simplicity/` (both book and workbook versions).
- **"Distributed Reliability Patterns: Redundancy, Load Management, and Cascading-Failure Prevention"** — redundancy via multi-datacenter replica pools and load balancing, quorum-based replication for critical state (2f+1 majority quorums), Google's overload-protection mechanisms as its circuit-breaker analog (adaptive throttling, criticality-based shedding), and the specific cascading-failure prevention toolkit (randomized exponential backoff with retry budgets, deadline propagation, small bounded queues, N+2 capacity margin), grounded in `load-balancing-frontend/`, `managing-critical-state/`, `handling-overload/`, `addressing-cascading-failures/`.

Each section needs 3-6 `{ title, body }` topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Reliability Patterns & Toil Reduction domain study content"
```

---

## Task 15: Reliability Patterns & Toil Reduction — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- Toil's "no enduring value" criterion is the one most often gotten wrong: work producing a permanent improvement is NOT toil even if it's a manual, one-time task. A distractor claiming "any repetitive operational task counts as toil" is a common misconception.
- The 50% toil ceiling is a policy target ("at least 50% of time on engineering work"), and Google's measured average was closer to 33% — these are two different numbers testing two different facts, not interchangeable.
- Load shedding (rejecting requests outright) and graceful degradation (serving cheaper/lower-quality responses) are related but explicitly DISTINCT per the book — a question conflating them is a good distractor-rich test.
- Neither book uses the term "circuit breaker" — a question like "which term does the SRE book actually use for this pattern" should NOT have "circuit breaker" as the correct answer.

- [ ] **Step 1: Draft and verify at least 10 questions for the Reliability Patterns & Toil Reduction domain**

Using docs cached in Task 14 (fetch more as needed), write questions covering toil definition/elimination, automation, simplicity, and distributed reliability patterns (10 minimum). IDs `reliability-001` through `reliability-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number >= 100 (this is the full bank across all 6 domains — confirms the Global Constraints floor is met).

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Reliability Patterns & Toil Reduction domain quiz questions"
```

---

## Task 16: Flashcard deck

**Files:**
- Create: `js/data/flashcards.js`

**Interfaces:**
- Produces: `FLASHCARDS` array (consumed by `validateFlashcards` in Task 2's validator, and by `js/views/flashcards.js` in Task 17).

- [ ] **Step 1: Build the deck from already-cached research**

Most of the material needed is already in `.cache/aws-docs/` from Tasks 4-15 (every major concept used across the 6 domains was fetched during those tasks). For concepts covered in earlier tasks, write the flashcard directly from the cached doc already on disk — don't refetch. Only fetch new pages for concepts not yet researched.

Target ~65-70 cards spanning all 6 domains, covering core SRE vocabulary and concepts: SLI, SLO, SLA, error budget, error budget policy, burn rate, toil, the four golden signals (latency/traffic/errors/saturation), black-box monitoring, white-box monitoring, blameless postmortem, incident commander, operations lead, communications lead, planning lead, incident document, on-call, escalation, playbook, canary release, hermetic build, config-as-code, rollback, cascading failure, positive feedback (in the cascading-failure sense), graceful degradation, load shedding, adaptive throttling, criticality levels, retry budget, deadline propagation, N+2 redundancy, non-abstract large system design (NALSD), load balancer (L4/L7), DNS load balancing, demand forecasting, automation (hierarchy of), simplicity (accidental vs essential complexity), quorum, circuit breaker (as the general pattern, with a note on Google's own terminology gap), availability (aggregate/request-based), nines (availability), MTTR, error budget burn-rate alerting, Incident Command System, postmortem action item, and any other terms that recurred across the study content.

```js
// js/data/flashcards.js
export const FLASHCARDS = [
  {
    id: 'sli',
    service: 'SLI (Service Level Indicator)',
    front: 'What is it?',
    back: '...',
  },
  // ... ~65-70 cards total
];
```

(The field is still named `service` for schema/validator compatibility with the copied `validate-content.mjs`, even though these are SRE concepts rather than AWS services — renaming it would require also editing the validator and view code, for zero behavioral benefit.)

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
- Copy from `../postgres/` unchanged: `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/progress.js`
- Copy from `../postgres/`, then edit: `js/views/mockExam.js` (one wording edit only — the scoring logic is already correct)

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js`; `STUDY_CONTENT` from `js/data/studyContent.js`; `QUESTIONS` from `js/data/questions.js`; `FLASHCARDS` from `js/data/flashcards.js`; `isCorrect`, `estimateScaledScore`, `drawMockExam` from `js/lib/scoring.js`; `createStore` from `js/lib/storage.js` — all already produced by Tasks 2, 4-16.

These four views (`studyGuide.js`, `quiz.js`, `flashcards.js`, `progress.js`) are entirely content-agnostic — they only reference the generic data shapes above, which are identical across all four modules. `mockExam.js` copied from `postgres/` already has the correct `estimateScaledScore()` call (with explicit `{minScore, maxScore}` options) — only its results-screen wording needs to change from naming PostgreSQL to naming this module correctly.

- [ ] **Step 1: Copy the four unchanged views**

```bash
cp ../postgres/js/views/studyGuide.js js/views/studyGuide.js
cp ../postgres/js/views/quiz.js js/views/quiz.js
cp ../postgres/js/views/flashcards.js js/views/flashcards.js
cp ../postgres/js/views/progress.js js/views/progress.js
```

Run: `for f in studyGuide.js quiz.js flashcards.js progress.js; do diff ../postgres/js/views/$f js/views/$f; done`
Expected: no output (all four files identical).

- [ ] **Step 2: Copy mockExam.js from `postgres/` and apply the one required text edit**

```bash
cp ../postgres/js/views/mockExam.js js/views/mockExam.js
```

Open `js/views/mockExam.js` and confirm the `estimateScaledScore` call inside `finishExam()` already reads:

```js
  const score = estimateScaledScore(correctCount, exam.length, {
    minScore: EXAM_FORMAT.minScore,
    maxScore: EXAM_FORMAT.maxScore,
  });
```

**Do not change this call** — it's already correct, copied from `postgres/` where this exact fix was already applied and verified.

Then find this line, a few lines further down in the same function's returned HTML:

```js
    <p class="exam-note">This is an estimate based on percent correct on a simplified 0–${EXAM_FORMAT.maxScore} scale — there's no official PostgreSQL exam or scaling formula behind it, since this module isn't tied to a certification. Passing score is ${EXAM_FORMAT.passingScore}.</p>
```

Replace it with:

```js
    <p class="exam-note">This is an estimate based on percent correct on a simplified 0–${EXAM_FORMAT.maxScore} scale — there's no official SRE exam or scaling formula behind it, since this module isn't tied to a certification. Passing score is ${EXAM_FORMAT.passingScore}.</p>
```

This is the only change to the file — every other line, including the scoring call, stays exactly as copied.

Run: `diff ../postgres/js/views/mockExam.js js/views/mockExam.js`
Expected: a single-line diff showing only this text change (`PostgreSQL exam` → `SRE exam`).

- [ ] **Step 3: Verify all five views in the browser**

With the server running (`preview_start` with name `sre-site`):

1. `#/study` → click through all 6 domains — content renders for each (no "Coming soon"), no console errors.
2. `#/quiz` → pick a domain, answer a question, submit — instant feedback + explanation, "Next Question" advances, results screen shows a score at the end.
3. `#/flashcards` → flip a card, mark it known, toggle "show only unknown" — filtering works.
4. `#/exam` → start the practice exam, confirm 50 questions total and the countdown timer starts near 75:00; answer through to the end and submit — results screen shows the estimated score against a 0–100 scale (NOT 0–1000) with the correct pass/fail line at 70, the new "SRE exam" text (no mention of PostgreSQL), and a per-domain breakdown summing to 50.
5. `#/progress` → confirm the quiz and practice exam attempts from steps 2 and 4 show up.
6. Check `preview_console_logs` at level `'error'` across the whole walkthrough — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add js/views/studyGuide.js js/views/quiz.js js/views/flashcards.js js/views/progress.js js/views/mockExam.js
git commit -m "Add remaining views (copied from postgres/; mock exam scoring already correct, only results text updated)"
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

Also run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"` and record the actual total — the README below must state this exact number (it may exceed 100, since domain counts are floors, not exact targets; do not write "100" unless the actual total really is 100).

- [ ] **Step 2: Write the final README**

```markdown
# SRE Mastery

An unofficial study site for general Site Reliability Engineering knowledge, drawing on Google's publicly available SRE Book and Workbook. Not tied to any certification — none exists industry-wide for SRE — and not affiliated with or endorsed by Google.

Live at https://toddcooke.github.io/learn/sre/. A companion to https://toddcooke.github.io/learn/aws/, https://toddcooke.github.io/learn/kubernetes/, and https://toddcooke.github.io/learn/postgres/.

## Running it

No install step. From this directory:

```
python3 -m http.server 8003
```

Then open http://localhost:8003/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## A note on scope

There is no single, industry-wide Site Reliability Engineering certification the way there is for AWS (SAA-C03) or Kubernetes (CKA). This site's 6-domain taxonomy is self-authored, grounded primarily in Google's "Site Reliability Engineering" book and "The Site Reliability Workbook" — the field's most influential published references, but one company's perspective on SRE, not a vendor-neutral standard. The "practice exam" is a self-test, not a simulation of any vendor's exam.

## What's here

- **Study guide** — organized by 6 domains: SLIs/SLOs & Error Budgets, Monitoring/Observability & Alerting, Incident Response/On-Call & Postmortems, Capacity Planning & Managing Load, Release Engineering & Change Management, and Reliability Patterns & Toil Reduction.
- **Domain quizzes** — [ACTUAL COUNT FROM STEP 1] practice questions with instant feedback and explanations.
- **Flashcards** — a cheat-sheet deck of core SRE vocabulary and concepts with known/unknown tracking.
- **Practice exam** — a 50-question, 75-minute timed self-test weighted by domain, scored on a 0-100 scale against an informal 70-point passing line.
- **Progress dashboard** — quiz and practice exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).

## How the content was sourced

All content is grounded in Google's "Site Reliability Engineering" book and "The Site Reliability Workbook," both freely readable at sre.google (chapter URLs confirmed live as of 2026-07-10). Every quiz question was drafted from and checked against the relevant cached chapter before being added. Fetched pages are cached locally under `.cache/aws-docs/` (gitignored; directory name kept for consistency with tooling shared with the other three modules) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

This project's application code (router, storage/scoring libraries, view components, content tooling) is shared architecture with the sibling [`aws/`](../aws), [`kubernetes/`](../kubernetes), and [`postgres/`](../postgres) modules in this repo — only the content data files and one small mock-exam wording edit differ. See those modules' READMEs for more on the shared tooling itself.

- `node --test "js/lib/*.test.mjs"` — runs unit tests for the pure storage/scoring logic (the bare-directory form `node --test js/lib` fails on some Node versions; use the glob form).
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.
```

Replace `[ACTUAL COUNT FROM STEP 1]` with the real number from Step 1's `QUESTIONS.length` check before committing — do not leave the placeholder text in the committed file.

- [ ] **Step 3: Full manual walkthrough**

With the server running (`preview_start` with name `sre-site`), walk through every feature end to end (this repeats Task 17 Step 3's walkthrough as a final full-system check, now that the README and final commit are in place):

1. `#/` — dual honesty note (not a cert, not vendor-neutral) and all 6 domains render correctly.
2. `#/study` → click through all 6 domains — content renders for each, no console errors.
3. `#/quiz` → run one domain quiz to completion — feedback, scoring, and results all work.
4. `#/flashcards` → flip a few cards, mark 2-3 known, toggle the "unknown only" filter — filtering works.
5. `#/exam` → start a practice exam, answer through to the end, submit — results screen renders with a per-domain breakdown summing to 50 and a score on the 0-100 scale (not 0-1000) against the 70-point line, with "SRE exam" text (no PostgreSQL references).
6. `#/progress` → confirm all of the above activity shows up.
7. Reload the page and revisit `#/progress` — expected: everything persisted.
8. Check `preview_console_logs` with `level: 'error'` across the whole walkthrough — expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Finalize README and complete end-to-end verification"
```
