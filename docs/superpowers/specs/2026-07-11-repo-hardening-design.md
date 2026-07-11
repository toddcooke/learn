# Repo Hardening & aws Rebalance — Design

Date: 2026-07-11. Scope approved by Todd: all five workstreams from the
whole-repo review (4-dimension multi-agent audit of code drift, frontend/UX,
content integrity, tooling/docs).

## Findings driving this work

**Critical (content):** the aws question bank predates the answer-position
disciplines. MC correct answers sit at index 0 in 56.3% of questions
(resilient 83.9% at index 0, secure 72.4% at index 0, performant 85.0% at
index 1; only cost is balanced at 4/4/4/4). 17 of 23 MR questions are keyed
at just [0,2] or [0,1]. 10 explanations reference options by ordinal/letter
("option B", "the first option") — these three must be fixed together since
reordering options invalidates ordinal references. kubernetes, postgres,
sre, networking all audited clean on every programmatic check.

**Real bugs (all 5 modules, shared views):**
- Timer expiry calls `finishExam()` without `saveAnswer()` — the answer
  selected on the currently displayed question is discarded on auto-submit.
- Both results renderers persist to localStorage *before* rendering, and
  `storage.js save()` has no try/catch — a quota/security error kills the
  results screen after a full exam.
- `aws/js/views/mockExam.js` calls `estimateScaledScore()` without explicit
  `{minScore, maxScore}` — correct today only because the shared defaults
  (100–1000) coincidentally equal AWS's scale.

**Structural cause:** per-module prose embedded in `mockExam.js` means that
file can never be byte-identical, which is exactly how the aws backport was
missed. Related paper cuts: networking's results note says "(similar to how
AWS's isn't)" (template artifact); postgres/sre nav says "Practice Exam" but
every in-view label says "Mock Exam"; postgres/sre start screen says "like
the real exam" though no real exam exists for them.

**UX/a11y:** zero ARIA anywhere; focus dropped to `<body>` on every
interaction (full innerHTML re-renders); mock-exam progress silently lost on
refresh/back; no low-time warnings; success green #16a34a fails WCAG AA
(3.30:1) on full explanation paragraphs; URL-hash param echoed raw into
innerHTML (Safari fragment-encoding edge); clicking the current view's nav
link is a dead click.

**Tooling/docs:** `export-anki.mjs` hardcodes the module list (already
caused real drift — networking shipped a day before it was added); exported
files lack `#tags column:3` so Anki doesn't auto-map the tags column; root
README "Adding a module" omits the launch.json/README/export steps actual
practice requires; root `.gitignore` lacks `.DS_Store` and
`**/.claude/settings.local.json` (currently masked by a machine-local global
ignore); `kubernetes/.gitignore` is redundant; kubernetes README says "(once
deployed)" though the site is live; `validate-content.mjs` is forked 3 ways
over two trivially data-drivable deltas; stale header comments in aws and
kubernetes `questions.js` describe only a subset of the domains present.

**Verified non-issues:** exam facts all current as of 2026-07-11 (SAA-C03,
CKA format, N10-009); all documented commands work; no cross-module content
bleed; drift otherwise perfectly contained.

## Design decisions

1. **Keep the copy-per-module architecture.** Self-containment ("works
   unmodified at whatever path", no build step) is a documented design goal
   and the review affirmed it. Instead, shrink the intentionally-divergent
   set to exactly one line (storage.js's NAMESPACE) by moving all per-module
   exam prose into a new `EXAM_UI` export in each module's `examInfo.js`:
   `{ examLabel, startBlurb, startNote, resultsNote }`. `mockExam.js` and
   `progress.js` render from it and become byte-identical across all 5.
2. **Genericize `validate-content.mjs`** (drop the hardcoded domain count —
   the weight-sum and mockExamCount-sum invariants already catch domain
   add/remove; guard the aws-only scored/unscored check with a field-presence
   test) so all 5 copies are byte-identical.
3. **Add `scripts/check-drift.mjs`** at the root: asserts the shared file
   set is byte-identical across modules and that storage.js differs only on
   the NAMESPACE line. Run in Task-final verification and documented in the
   root README so future backports can't be silently missed.
4. **Exam resilience:** checkpoint in-flight exam state (question ids,
   answers, index, deadline timestamp) to the existing store after each
   answer save; offer "Resume exam" on the #/exam landing screen;
   `beforeunload` guard plus `confirm()` on in-app navigation while an exam
   is in flight. Timer derives from the deadline timestamp so a resumed exam
   keeps accurate time.
5. **A11y baseline, not a rewrite:** keep the innerHTML-re-render
   architecture; add focus restoration (focus the new question heading /
   flip button / view heading after each render), `role="status"` on quiz
   feedback, fieldset/legend association for option groups, polite
   live-region announcements at 10 and 1 minutes remaining, `aria-current`
   on nav, darken `--color-success` to #15803d, stop echoing raw hash params,
   and make same-hash nav clicks re-render.
6. **aws rebalance:** reorder options (updating `correctIndexes`) across the
   secure/resilient/performant domains until each MC index lands in roughly
   20–30% and MR sets are spread; rewrite the 10 ordinal explanations to
   describe distractors by content; content facts themselves are untouched
   (answer keys stay keyed to the same option *text*).
7. **Tooling:** auto-discover modules in `export-anki.mjs` (any top-level
   dir containing `js/data/flashcards.js`); add `#tags column:3`; update
   root README (module list already current; fix "Adding a module" and the
   Anki section); root `.gitignore` gains `.DS_Store` and
   `**/.claude/settings.local.json`; delete `kubernetes/.gitignore`; drop
   "(once deployed)" from kubernetes README.

## Explicitly out of scope

- Renaming `.cache/aws-docs` or the flashcard `service` field (cosmetic,
  cross-cutting churn, zero user-visible benefit).
- Extracting a shared library or adding a build step.
- Any content changes beyond the aws option reordering + explanation
  rewrites and the two stale header comments.
- `launch.json` "cka-site" naming (harmless, and renaming breaks muscle
  memory).
