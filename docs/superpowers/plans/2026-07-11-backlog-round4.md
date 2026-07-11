# Backlog Round 4 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the approved backlog: flashcard `domain` field with `module::domain` Anki tags, weak-areas panel in the progress view, in-session wrong-answer review for quizzes and mock exams, plus three parked minors (aws secure-030 reword, exam-checkpoint validation hardening, cache-dir rename).

**Architecture:** Same as always — shared views stay byte-identical across the 5 modules (drift-checked in CI); data changes per module; export-layer changes at root.

## Global Constraints

- Shared-view edits happen on networking's canonical copies and propagate byte-identical ×5; `node scripts/check-drift.mjs` green after every task.
- After every task: `node --test "js/lib/*.test.mjs"` and `node scripts/validate-content.mjs` green in every touched module; no scratch scripts committed.
- New/rewritten card or question text: grounded in the module's own reviewed content or cached docs; 8+-word verbatim check (scratch only); fronts unique per deck.
- localStorage record shapes may gain OPTIONAL fields only — existing stored history must keep rendering (backward compatibility with users' current data).

---

### Task 1: Small fixes bundle

**Files:** `aws/js/data/questions.js`; `<m>/js/views/mockExam.js` ×5; `<m>/scripts/fetch-doc.mjs` ×5; `networking/README.md` (cache-dir note), any other README mentioning `aws-docs`.

- [ ] **Step 1 — secure-030 reword.** The question asks which key type "requires manual rotation"; the marked answer (asymmetric KMS key) is correct, but the distractor "symmetric encryption key with imported (EXTERNAL) material" ALSO cannot be auto-rotated, making it defensibly correct. Read the question + its grounding in aws study content; fix by rewording the imported-material distractor into something unambiguously auto-rotatable (e.g. a plain AWS-managed symmetric key) or re-scoping the stem so only one option fits. Preserve answer-position balance (don't move the correct index) and the content-based explanation style; update the explanation to match.
- [ ] **Step 2 — checkpoint validation hardening** (canonical mockExam.js, propagate ×5): in `readResumableCheckpoint`, require `Number.isInteger(checkpoint.index) && checkpoint.index >= 0`, `Array.isArray(checkpoint.questionIds) && checkpoint.questionIds.length > 0`, and clear+ignore any stored falsy-but-present value (the `if (!checkpoint) return null` path should also clear when a raw stored value existed). Tampered checkpoints must show the plain start screen, never throw.
- [ ] **Step 3 — cache-dir rename**: `CACHE_DIR` in fetch-doc.mjs becomes `.cache/docs` (byte-identical ×5). Root `.gitignore` already covers `.cache/`. Update the networking README's "cached locally under `.cache/aws-docs`" note (and grep for any other `aws-docs` doc mentions). Old local cache dirs stay on disk harmlessly; scripts create the new path on next fetch.
- [ ] **Step 4:** validators + tests ×5, drift check. Commit — `git commit -m "Fix secure-030 ambiguity, harden exam checkpoint validation, rename doc cache dir"`

### Task 2: Flashcard `domain` field + `module::domain` Anki tags

**Files:** `<m>/js/data/flashcards.js` ×5; `<m>/scripts/validate-content.mjs` ×5; `scripts/export-anki.mjs`; `docs/superpowers/specs/2026-07-10-anki-export-design.md`; `README.md` (tags line).

- [ ] **Step 1 — assign domains.** Add `domain: '<Bucket Name>'` to every card. aws/sre/networking: use the existing section-header comments verbatim as the bucket names (aws 8 incl. "Best-Fit Scenarios", sre 6, networking 5). kubernetes: bucket by CKA domain names (Cluster Architecture, Services & Networking, Workloads & Scheduling, Storage, Troubleshooting) — assign each card by its topic. postgres: bucket by the module's six domains (Architecture, Querying, Indexing, Transactions, Administration, Replication). Every card gets exactly one bucket; report the per-bucket counts (no bucket should hold fewer than ~4 cards — merge tiny buckets sensibly).
- [ ] **Step 2 — validator** (byte-identical ×5): extend the flashcards check to require a non-empty string `domain` on every card.
- [ ] **Step 3 — export**: tag becomes `${name}::${toTag(card.domain)}` (replacing the service-slug tag — service is already in the Front). Update the export spec doc + README tag description.
- [ ] **Step 4:** validators ×5 (now enforcing domain), export regenerates with the new tags (spot-check tag distribution: each deck should have 5-8 distinct tags, not 60+), drift check (validator is in the shared set — must be identical ×5). Commit — `git commit -m "Add domain buckets to flashcards; tag Anki exports by module::domain"`

### Task 3: Weak-areas panel in the progress view

**Files:** `<m>/js/views/progress.js` ×5 (canonical: networking).

- [ ] **Step 1:** Add a "By Domain" section between Flashcard Mastery and Quiz History: aggregate quiz history per domain (`attempts`, total correct/total questions → accuracy %), render a row per domain with name, attempts, accuracy; visually flag the weakest domain with ≥1 attempt (e.g. "— weakest, focus here"). Domains with no attempts show "no attempts yet". Use `DOMAINS` for names/order; guard division by zero; no changes to stored record shapes.
- [ ] **Step 2:** Browser-verify on networking (take two quick quizzes in different domains via preview tools, confirm aggregation + weakest flag). Propagate ×5, drift check, tests ×5. Commit — `git commit -m "Add per-domain weak-areas panel to the progress view"`

### Task 4: In-session wrong-answer review

**Files:** `<m>/js/views/quiz.js`, `<m>/js/views/mockExam.js` ×5 (canonical: networking).

- [ ] **Step 1 — quiz:** on the results screen, when `state.answers` contains misses, add "Review the N you missed" which re-runs the quiz loop over just the missed questions (map `questionId`s back to question objects; reuse `runQuiz` with a filtered list and a flag/label so the header reads "<Domain> Quiz — review". The review round does NOT record a history attempt (it's remediation, not a fresh attempt) — implement by parameter, not by mutating shared state.
- [ ] **Step 2 — mock exam:** the results screen already holds per-question `results`; when misses exist, add "Practice the M missed questions" that runs the same quiz-style loop (question → submit → feedback → next) over the missed questions, ending on a simple "review complete" screen with a link back to `#/exam`. No timer, no scoring record, checkpoint untouched. Reuse quiz.js's loop if cleanly importable; otherwise a small local loop — but do NOT duplicate the option-shuffle/fieldset/a11y patterns inconsistently: match quiz.js's rendering exactly (shuffled options, original-index values, fieldset/legend, role=status feedback).
- [ ] **Step 3:** Browser-verify both flows on networking (miss ≥1 on purpose, run the review round, confirm no new history rows appear in `#/progress` from review rounds). Propagate ×5, drift check, tests ×5. Commit — `git commit -m "Add in-session review of missed questions to quizzes and mock exams"`

### Task 5: Final verification

- [ ] Validators + tests ×5; drift check; export (tags = module::domain, 5-8 tags/deck); full browser walkthrough of the new features on networking + one other module; `git status` clean. Commit stragglers only if fixes were needed. Then final review (opus) over the whole range and push (CI must go green).
