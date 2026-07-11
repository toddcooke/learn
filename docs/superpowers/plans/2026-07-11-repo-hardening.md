# Repo Hardening & aws Rebalance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the real bugs and the aws answer-position bias found by the 2026-07-11 whole-repo review, de-fork the shared app layer so every shared file is byte-identical across all 5 modules, and raise the UX/a11y baseline — per `docs/superpowers/specs/2026-07-11-repo-hardening-design.md`.

**Architecture:** Copy-per-module stays (documented design goal). All per-module exam prose moves into a new `EXAM_UI` export in each module's `js/data/examInfo.js`; every other shared file becomes byte-identical and a new root `scripts/check-drift.mjs` enforces it.

**Tech Stack:** Vanilla ES modules, no build step, Node built-in test runner.

## Global Constraints

- After Task 3, `js/views/mockExam.js` and `js/views/progress.js` must be byte-identical across all 5 modules. After Task 4, `scripts/validate-content.mjs` too. `js/lib/storage.js` may differ ONLY on its first line (`const NAMESPACE = '<ns>-prep';`).
- The five namespaces are: aws=`saa-prep`, kubernetes=`cka-prep`, postgres=`pg-prep`, sre=`sre-prep`, networking=`net-prep`. Never change them (existing users' history).
- Propagation recipe for any shared-file task: edit the networking copy, verify, then `for m in aws kubernetes postgres sre; do cp networking/<path> $m/<path>; done` and confirm with `md5 -q` that all 5 match.
- Every task ends with: `node --test "js/lib/*.test.mjs"` (6+ pass) and `node scripts/validate-content.mjs` ("All content validated successfully.") run in EVERY module whose files changed, plus (from Task 4 on) `node scripts/check-drift.mjs` at the root.
- aws content facts are NOT to be changed in Task 6 — only option ORDER, `correctIndexes` (to track the moved text), explanations' distractor references, and file-header comments.
- No scratch/checker scripts committed — scratchpad only.
- Commit messages: plain imperative subject lines, as elsewhere in this repo.

---

### Task 1: Repo hygiene + Anki export fixes + docs

**Files:**
- Modify: `.gitignore`, `scripts/export-anki.mjs`, `README.md`, `kubernetes/README.md`
- Delete: `kubernetes/.gitignore`

- [ ] **Step 1: .gitignore** — append two lines to the root `.gitignore` so it reads exactly:

```
.cache/
.worktrees/
anki/
.DS_Store
**/.claude/settings.local.json
```

- [ ] **Step 2: Delete `kubernetes/.gitignore`** (`git rm kubernetes/.gitignore`) — its two patterns (`.cache/`, `.worktrees/`) are already covered by the root file at every depth.

- [ ] **Step 3: export-anki auto-discovery + tags header.** In `scripts/export-anki.mjs`: replace line 7's hardcoded list with discovery, and add the tags-column header. The discovery block:

```js
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';

const ALL_MODULES = readdirSync(new URL('..', import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(new URL(`../${e.name}/js/data/flashcards.js`, import.meta.url)))
  .map((e) => e.name)
  .sort();
```

Keep the existing explicit-argument validation against `ALL_MODULES` unchanged (unknown names must still throw before any file is written). Where the file header is emitted (currently `#separator:tab` and `#html:false`), add a third line `#tags column:3`.

- [ ] **Step 4: Run it** — `node scripts/export-anki.mjs` must report all 5 modules; `head -3 anki/aws.txt` must show the three header lines. Then `node scripts/export-anki.mjs nonsense` must exit non-zero with the unknown-module error and write nothing.

- [ ] **Step 5: Root README.** In the Anki section, replace "exports all five modules" phrasing with "exports every module that has a flashcard deck (auto-discovered)". Rewrite the "Adding a module" section to list all actual steps:

```markdown
## Adding a module

Add a new top-level directory (e.g. `gcp/`) with its own `index.html` entry
point — everything in each module uses relative paths, so a module works
unmodified at whatever path it's nested under. Then:

- add it to the Modules list in this README;
- add a `.claude/launch.json` entry on the next free port;
- run `node scripts/check-drift.mjs` to confirm the copied app layer
  matches the other modules (`scripts/export-anki.mjs` discovers modules
  automatically — no registration needed);
- link to it from `toddcooke.github.io`'s `content/learn.md` page (that
  repo owns the `/learn/` landing page; this repo only supplies the module
  content under it).
```

(The check-drift bullet forward-references Task 4's script; that's fine — the plan lands as one branch.)

- [ ] **Step 6: kubernetes README** — delete the "(once deployed)" parenthetical on line 5 (the site is live).

- [ ] **Step 7: Commit** — `git add -A && git commit -m "Fix repo hygiene: gitignore, Anki tags header, module auto-discovery, README steps"`

### Task 2: storage.js hardening (all 5 modules)

**Files:**
- Modify: `<module>/js/lib/storage.js` ×5, `<module>/js/lib/storage.test.mjs` ×5

**Interfaces:** `createStore(backend?)` keeps its exact current API; adds three methods used by Task 7: `getExamCheckpoint()`, `setExamCheckpoint(checkpoint)`, `clearExamCheckpoint()`.

- [ ] **Step 1: Write failing tests** (append to `networking/js/lib/storage.test.mjs`; file stays byte-identical across modules so write them namespace-agnostically like the existing tests, which construct stores over a fake backend):

```js
test('save failures are swallowed, not thrown', () => {
  const throwing = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  const store = createStore(throwing);
  assert.doesNotThrow(() => store.recordQuizAttempt({ score: 1 }));
  assert.deepEqual(store.getQuizHistory(), []);
});

test('unavailable localStorage falls back to in-memory store', () => {
  const store = createStore(null);
  store.recordQuizAttempt({ score: 2 });
  assert.equal(store.getQuizHistory().length, 1);
});

test('exam checkpoint set/get/clear round-trips', () => {
  const backend = fakeBackend();  // reuse the file's existing fake-backend helper
  const store = createStore(backend);
  assert.equal(store.getExamCheckpoint(), null);
  store.setExamCheckpoint({ index: 3, answers: [[0]], questionIds: ['a'], deadline: 123 });
  assert.equal(store.getExamCheckpoint().index, 3);
  store.clearExamCheckpoint();
  assert.equal(store.getExamCheckpoint(), null);
});
```

(Adapt the fake-backend construction to whatever helper the file already uses; if it uses inline object literals, keep that style.) Run: `node --test networking/js/lib/storage.test.mjs` → new tests FAIL.

- [ ] **Step 2: Implement.** In `storage.js` (edit networking's copy): wrap `save()` in try/catch (silently ignore); make `load()` tolerate a throwing/missing backend (`try { raw = backend.getItem(...) } catch { return fallback; }`); in `createStore`, if the passed/default backend is falsy or probing it throws, substitute an in-memory shim:

```js
function memoryBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
}

export function createStore(backend = globalThis.localStorage) {
  let b;
  try {
    b = backend || memoryBackend();
    b.getItem(`${NAMESPACE}:probe`);
  } catch {
    b = memoryBackend();
  }
  return {
    /* existing six methods, referencing b */
    getExamCheckpoint() {
      return load(b, 'exam-checkpoint', null);
    },
    setExamCheckpoint(checkpoint) {
      save(b, 'exam-checkpoint', checkpoint);
    },
    clearExamCheckpoint() {
      try { b.removeItem(`${NAMESPACE}:exam-checkpoint`); } catch { /* ignore */ }
    },
  };
}
```

- [ ] **Step 3: Tests pass** — `node --test networking/js/lib/storage.test.mjs` all green.

- [ ] **Step 4: Propagate** both files to the other 4 modules, then restore each module's NAMESPACE first line in `storage.js` (`saa-prep`/`cka-prep`/`pg-prep`/`sre-prep`). Verify: `storage.test.mjs` md5 identical ×5; `diff <(tail -n +2 aws/js/lib/storage.js) <(tail -n +2 networking/js/lib/storage.js)` empty (repeat per module). Run tests in all 5 modules.

- [ ] **Step 5: Commit** — `git commit -m "Harden storage: tolerate save failures and blocked localStorage, add exam checkpoint API"`

### Task 3: EXAM_UI extraction — de-fork mockExam.js/progress.js + bug backports

**Files:**
- Modify: `<module>/js/data/examInfo.js` ×5, `<module>/js/views/mockExam.js` ×5, `<module>/js/views/progress.js` ×5

**Interfaces:** each `examInfo.js` gains `export const EXAM_UI = { examLabel, startBlurb, startNote, resultsNote }` (all strings; `startNote` may be `null`). Views import it alongside the existing exports.

- [ ] **Step 1: Add EXAM_UI per module** (append after `EXAM_FORMAT`; template literals may reference `EXAM_FORMAT`, in scope in the same file). Exact values:

aws:
```js
export const EXAM_UI = {
  examLabel: 'Mock Exam',
  startBlurb: `${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam.`,
  startNote: null,
  resultsNote: `This is an estimate based on percent correct; AWS's real scaling formula is not public. Passing score is ${EXAM_FORMAT.passingScore}.`,
};
```

kubernetes:
```js
export const EXAM_UI = {
  examLabel: 'Mock Exam',
  startBlurb: `${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam's domains.`,
  startNote: `The real CKA exam is 100% hands-on (command-line tasks in a live cluster), not multiple-choice. This mock exam reinforces the same knowledge but isn't a replica of the real exam experience — pair it with hands-on practice (kind, minikube, killer.sh).`,
  resultsNote: `This is an estimate based on percent correct against a simplified 0–100 scale; the real CKA exam is pass/fail on hands-on tasks, not scored this way. Passing score is ${EXAM_FORMAT.passingScore}.`,
};
```

postgres (note the corrected startBlurb — there is no "real exam"):
```js
export const EXAM_UI = {
  examLabel: 'Practice Exam',
  startBlurb: `${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, weighted by domain.`,
  startNote: null,
  resultsNote: `This is an estimate based on percent correct on a simplified 0–${EXAM_FORMAT.maxScore} scale — there's no official PostgreSQL exam or scaling formula behind it, since this module isn't tied to a certification. Passing score is ${EXAM_FORMAT.passingScore}.`,
};
```

sre: same as postgres but `resultsNote` says "official SRE exam" instead of "official PostgreSQL exam".

networking (note the dropped "(similar to how AWS's isn't)"):
```js
export const EXAM_UI = {
  examLabel: 'Mock Exam',
  startBlurb: `${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam.`,
  startNote: null,
  resultsNote: `This is an estimate based on percent correct on the real exam's ${EXAM_FORMAT.minScore}–${EXAM_FORMAT.maxScore} scale — CompTIA's own scaled-score formula isn't published. Also, this is a multiple-choice-only self-test; the real N10-009 exam also includes performance-based questions this site doesn't simulate. Passing score is ${EXAM_FORMAT.passingScore}.`,
};
```

(These are plain-text strings — no HTML tags belong in any EXAM_UI value; the view supplies the surrounding markup.)

- [ ] **Step 2: Rewrite the canonical `networking/js/views/mockExam.js`** with these exact changes (everything else stays as-is):
  - Import: `import { DOMAINS, EXAM_FORMAT, EXAM_UI } from '../data/examInfo.js';`
  - `render()` start screen becomes:

```js
  mount.innerHTML = `
    <h2>${EXAM_UI.examLabel}</h2>
    <p>${EXAM_UI.startBlurb}</p>
    ${EXAM_UI.startNote ? `<p class="exam-note">${EXAM_UI.startNote}</p>` : ''}
    <button type="button" id="start-exam">Start ${EXAM_UI.examLabel}</button>
  `;
```

  - Timer-expiry bug fix — the interval callback becomes:

```js
    if (state.secondsLeft <= 0) {
      saveAnswer();
      stopActiveTimer();
      finishExam(mount, exam, state);
    }
```

  (`saveAnswer` is declared later in `startExam` via function hoisting — verify it is a `function` declaration, which it is.)
  - `finishExam()` — render results FIRST, then record inside try/catch, appending a non-fatal note on failure. Replace the current record-then-render tail with:

```js
  mount.innerHTML = `
    <h2>${EXAM_UI.examLabel} Results</h2>
    <p class="quiz-score">Estimated scaled score: ${score} / ${EXAM_FORMAT.maxScore} — ${passed ? 'PASS' : 'Below passing score'}</p>
    <p class="exam-note">${EXAM_UI.resultsNote}</p>
    ... (rest of the existing results markup, with the two label strings updated:
         "Take another mock exam" → `Take another ${EXAM_UI.examLabel.toLowerCase()}`) ...
  `;
  try {
    store.recordMockExamAttempt({ score, correct: correctCount, total: exam.length, passed, timestamp: new Date().toISOString() });
  } catch {
    mount.insertAdjacentHTML('beforeend', '<p class="exam-note">Could not save this attempt to history.</p>');
  }
```

  (Note: `storage.save` no longer throws after Task 2, so the catch is belt-and-braces; the REORDER is the substantive fix.)
- [ ] **Step 3: `networking/js/views/progress.js`** — import `EXAM_UI` and change the literal `Mock Exam History` heading to `${EXAM_UI.examLabel} History`.
- [ ] **Step 4: Propagate** `mockExam.js` and `progress.js` byte-identical to all 4 other modules (this also delivers aws's explicit-options scoring call, already canonical). `md5 -q` ×5 must match for both files.
- [ ] **Step 5: Verify per module** — tests + validator ×5. Browser spot-check (preview servers): postgres `#/exam` shows "Practice Exam"/"Start Practice Exam"; kubernetes start screen still shows the CKA hands-on note; networking results note no longer mentions AWS; aws `#/exam` completes an exam and scores on 100–1000.
- [ ] **Step 6: Commit** — `git commit -m "Extract per-module exam prose into EXAM_UI; de-fork mockExam/progress views; fix timer-expiry answer loss and aws scoring options"`

### Task 4: validate-content unification + drift checker

**Files:**
- Modify: `<module>/scripts/validate-content.mjs` ×5
- Create: `scripts/check-drift.mjs`

- [ ] **Step 1:** Edit networking's `validate-content.mjs`: replace the hardcoded `DOMAINS.length === 5` check with `check(Array.isArray(DOMAINS) && DOMAINS.length > 0, 'DOMAINS must be a non-empty array');` and add, where aws's variant had its extra check:

```js
  if ('scoredQuestions' in EXAM_FORMAT) {
    check(EXAM_FORMAT.totalQuestions === EXAM_FORMAT.scoredQuestions + EXAM_FORMAT.unscoredQuestions,
      'EXAM_FORMAT.totalQuestions must equal scoredQuestions + unscoredQuestions');
  }
```

Propagate byte-identical ×5; run the validator in all 5 modules (aws must still exercise the scored/unscored branch — temporarily break aws's `scoredQuestions` to 49, confirm the validator fails, restore).

- [ ] **Step 2: Create `scripts/check-drift.mjs`:**

```js
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
```

- [ ] **Step 3:** `node scripts/check-drift.mjs` → "No drift across 5 modules". Sanity-check it catches drift: add a space to `aws/js/app.js`, confirm exit 1 + message, revert.
- [ ] **Step 4: Commit** — `git commit -m "Unify validate-content across modules; add drift checker"`

### Task 5: quiz/studyGuide — render-before-record and param-echo fix

**Files:**
- Modify: `<module>/js/views/quiz.js` ×5, `<module>/js/views/studyGuide.js` ×5

- [ ] **Step 1:** In networking's `quiz.js`: (a) line 16's unknown-domain message drops the raw param → `mount.innerHTML = '<p>Unknown quiz domain. <a href="#/quiz">Back to Quizzes</a></p>';` (b) in `renderResults()`, move `store.recordQuizAttempt(...)` AFTER the `mount.innerHTML = ...` assignment and wrap in try/catch (same non-fatal-note pattern as Task 3).
- [ ] **Step 2:** In networking's `studyGuide.js`: same unknown-domain treatment (drop the interpolated `${domainId}` from the error message).
- [ ] **Step 3:** Propagate both ×5; md5 check; tests+validator ×5; `node scripts/check-drift.mjs`.
- [ ] **Step 4: Commit** — `git commit -m "Render results before recording history; stop echoing raw hash params"`

### Task 6: aws question-bank rebalance (content — the Critical)

**Files:**
- Modify: `aws/js/data/questions.js`, `kubernetes/js/data/questions.js` (header comment only)

Current measured state (re-verify before editing): 96 MC with correct-index distribution 54/31/7/4 (56.3% at index 0; resilient 26/31 at 0, secure 21/29 at 0, performant 17/20 at 1; cost balanced 4/4/4/4). 23 MR with 9× `[0,2]` and 8× `[0,1]`. Ordinal-referencing explanations in: resilient-008, -015, -024, -028, -029, -030, -031, -035, -037, performant-013.

- [ ] **Step 1:** Write a scratchpad script that loads `aws/js/data/questions.js` and prints per-domain MC index distribution, MR set frequencies, and correct-is-longest fraction. Record the "before" numbers.
- [ ] **Step 2:** Reorder options in secure/resilient/performant questions (do NOT touch the cost domain or any question text/facts): move each question's option array into a new order and update `correctIndexes` so the same option TEXT stays correct. Target: each MC index in 20–30% overall AND no index >40% within any domain; MR sets spread so no single set exceeds 3 occurrences and indexes 3/4 each appear in ≥5 sets.
- [ ] **Step 3:** Rewrite the 10 ordinal explanations to reference distractors by content ("the option that swaps RPO and RTO" not "option B"). Scan the WHOLE file afterward: `grep -inE "option [a-d1-4]|first option|second option|third option|fourth option|[^a-z](A|B|C|D) and (A|B|C|D)[^a-z]" aws/js/data/questions.js` → the only acceptable hits are ones that aren't referring to answer positions (read each).
- [ ] **Step 4:** Update the stale file-header comments: aws `questions.js` lines 1–7 must describe all 4 domains and current counts (119 total: secure 36, resilient 38, performant 25, cost 20 — re-count at edit time); kubernetes `questions.js` lines 2–4 must describe all 5 domains (140 total — re-count).
- [ ] **Step 5:** Re-run the Step-1 script → verify targets met; `node scripts/validate-content.mjs` in aws and kubernetes; `node --test "js/lib/*.test.mjs"` in aws. Spot-check 5 reordered questions by hand: correctIndexes still point at the same option text as before the move.
- [ ] **Step 6: Commit** — `git commit -m "Rebalance aws answer positions, rewrite ordinal explanations, fix stale question-bank headers"`

### Task 7: Mock-exam persistence and resume (all 5 via canonical copy)

**Files:**
- Modify: `<module>/js/views/mockExam.js` ×5 (canonical: networking)

**Interfaces:** consumes Task 2's `getExamCheckpoint`/`setExamCheckpoint`/`clearExamCheckpoint`. Checkpoint shape: `{ questionIds: string[], answers: (number[]|null)[], index: number, deadline: number }` (epoch ms).

- [ ] **Step 1:** In `render()`: read `store.getExamCheckpoint()`. If one exists, its `deadline > Date.now()`, and every `questionIds` entry resolves in `QUESTIONS`, show a "Resume exam (N answered, M:SS left)" button beside "Start …"; Resume rebuilds `exam` by mapping ids to question objects and re-enters the exam loop at the saved index. A checkpoint that is expired or unresolvable is cleared and ignored.
- [ ] **Step 2:** In `startExam()`: compute `const deadline = Date.now() + EXAM_FORMAT.durationMinutes * 60 * 1000;` and derive `state.secondsLeft = Math.max(0, Math.round((deadline - Date.now()) / 1000))` inside the interval instead of decrementing — a resumed exam then keeps true time. Write the checkpoint in `saveAnswer()` (it already runs on every navigation) and once at exam start.
- [ ] **Step 3:** Leaving guards. While an exam is in flight, register `const onBeforeUnload = (e) => { e.preventDefault(); };` on `beforeunload` (browsers then show their native leave-confirmation on refresh/close); remove it in `stopActiveTimer()` and on finish. Do NOT attempt to block in-app `hashchange` navigation (re-setting `location.hash` from inside the handler causes guard loops): keep the existing teardown behavior — the timer stops, and because the checkpoint persists after every `saveAnswer()`, the resume flow in Step 1 recovers the exam when the user returns to `#/exam`. On `finishExam()`, call `store.clearExamCheckpoint()`.
- [ ] **Step 4:** Manual browser verification on networking (port 8004): start exam, answer 3, refresh → "Resume exam" appears with correct remaining time and answers intact; finish → checkpoint gone; letting the timer hit 0 with a selection on screen scores that selection (Task 3's fix, retested here).
- [ ] **Step 5:** Propagate ×5, md5 check, tests+validator ×5, check-drift.
- [ ] **Step 6: Commit** — `git commit -m "Persist in-flight mock exams: checkpoint, resume, and leave guards"`

### Task 8: A11y and UX polish (all 5 via canonical copies)

**Files:**
- Modify: `<module>/js/app.js`, `js/views/quiz.js`, `js/views/mockExam.js`, `js/views/flashcards.js`, `css/style.css` ×5

- [ ] **Step 1 (app.js):** in `highlightNav`, alongside the `.active` class set `a.setAttribute('aria-current', isActive ? 'page' : 'false')` (or remove the attribute when inactive). Add a nav click listener: if the clicked link's hash equals `location.hash`, call `renderRoute()` (fixes dead clicks). In `renderRoute`, after `renderFn(...)`: `mount.setAttribute('tabindex', '-1'); mount.focus({ preventScroll: true });` ONLY on hashchange-driven renders (pass a flag; skip on initial `DOMContentLoaded` so page load doesn't steal focus).
- [ ] **Step 2 (quiz.js):** wrap each question's options in `<fieldset>` with the question text in a `<legend class="quiz-question">` (keep the same rendered look — adjust css if fieldset default borders intrude: `fieldset { border: 0; padding: 0; margin: 0; }`). Give `#quiz-feedback` `role="status"`. After `renderQuestion()` from the Next click, focus the new question's legend (`legend.setAttribute('tabindex','-1'); legend.focus();`).
- [ ] **Step 3 (mockExam.js):** same fieldset/legend treatment; focus the "Question N of M" header element after Prev/Next; add a visually-hidden polite live region updated exactly twice — at 600 and 60 seconds remaining ("10 minutes remaining", "1 minute remaining") — and on auto-submit ("Time expired — exam submitted."). Do NOT make the per-second timer text live.
- [ ] **Step 4 (flashcards.js):** after Flip/Prev/Next/Mark-Known re-renders, focus the Flip button.
- [ ] **Step 5 (style.css):** `--color-success: #16a34a` → `#15803d`; add the fieldset reset and a `.visually-hidden` utility (clip-based).
- [ ] **Step 6:** Browser verification on networking: tab-only run-through of a quiz question and two exam questions (focus lands sensibly after every action); feedback announced (inspect `role=status` present); contrast of `.feedback-correct` computed color = `#15803d`.
- [ ] **Step 7:** Propagate ×5, md5, tests+validator ×5, check-drift.
- [ ] **Step 8: Commit** — `git commit -m "A11y baseline: focus management, ARIA landmarks and announcements, AA contrast, live nav clicks"`

### Task 9: Final integration and verification

**Files:** none new (fixes only if verification fails)

- [ ] **Step 1:** In each of the 5 modules: `node --test "js/lib/*.test.mjs"` (9/9 after Task 2's additions) and `node scripts/validate-content.mjs`.
- [ ] **Step 2:** `node scripts/check-drift.mjs` → no drift. `node scripts/export-anki.mjs` → 5 decks with 3 header lines each.
- [ ] **Step 3:** Full browser walkthrough on networking (8004) AND aws (8000): home, study, one full quiz (results render even with localStorage disabled via DevTools → verify the non-fatal note path on one of them), flashcards flip/mark/filter, full mock exam including refresh-resume mid-exam and timer-expiry-with-selection, progress, reload persistence, zero console errors.
- [ ] **Step 4:** aws distribution re-check (scratch script): MC ≤40% per index per domain; MR sets spread.
- [ ] **Step 5: Commit** any stragglers — `git commit -m "Final verification pass for repo hardening"` (or no commit if clean).

---

Plan complete. Final whole-branch review (most capable model) runs after Task 9 over the whole range, then superpowers:finishing-a-development-branch.
