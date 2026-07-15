# Backlog Round 5 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the items parked by the 2026-07-15 audit round: mock-exam question navigator with flags, quiz resume, flashcard order persistence, progress reset, mobile + print CSS, remaining a11y labels, extraction of the bug-prone view logic into tested lib modules, cheatsheet shared-scaffold drift enforcement, flashcard-domain canonical lists, and VPC-explorer theming + tested math.

**Architecture:** Same as always — shared views stay byte-identical across the 5 modules (drift-checked in CI); data changes per module; export/CI changes at root. New shared lib modules join the check-drift SHARED list. The VPC explorer stays aws-only; its extracted math module lives in `aws/js/lib/` so the CI test glob picks its tests up without any CI change.

## Global Constraints

- Shared-view edits happen on aws's canonical copies and propagate byte-identical ×5; `node scripts/check-drift.mjs` green after every task (storage.js still differs only on line 1).
- After every task: `node --test "js/lib/"*.test.mjs` and `node scripts/validate-content.mjs` green in every touched module.
- localStorage record shapes may gain OPTIONAL fields only — existing stored history, checkpoints, and flashcard state must keep working (a pre-round-5 exam checkpoint must still resume).
- Views stay dependency-free vanilla ES modules; all data-derived text goes through `escapeHtml` (established this round — new rendering code must follow it).

---

### Task 1: Extract exam support logic into tested lib modules

**Files:** new `<m>/js/lib/examSupport.js` ×5 + `<m>/js/lib/examSupport.test.mjs` ×5; `<m>/js/views/mockExam.js` ×5.

- [ ] **Step 1 — examSupport.js.** Move (verbatim behavior, no redesign) out of mockExam.js: checkpoint validation (`validateCheckpoint(raw, questionsById, now)` returning `{checkpoint, expired}` or `null`, tolerating the optional `flags` field Task 2 adds) and timer threshold logic (`crossedThreshold(prevSeconds, nowSeconds)` returning the lowest crossed threshold message or `null`, thresholds 600s/60s).
- [ ] **Step 2 — tests.** node:test coverage: malformed/expired/stale-id checkpoints, checkpoints without `flags` (backward compat), threshold single-crossing, large-jump lowest-only, no-crossing.
- [ ] **Step 3.** mockExam.js imports and uses both; behavior byte-for-byte equivalent from the user's perspective. Tests + drift green (SHARED-list update lands in Task 5).

### Task 2: Mock exam question navigator, flags, unanswered count, a11y labels

**Files:** `<m>/js/views/mockExam.js` ×5 (styles land in Task 4).

- [ ] **Step 1 — navigator.** Numbered button grid (`.exam-nav`) on every question screen: current (`.is-current`, `aria-current="true"`), answered (`.is-answered`), flagged (`.is-flagged`, `aria-pressed` on the flag toggle); clicking jumps to that question. Must be usable unstyled.
- [ ] **Step 2 — flags.** Per-question "Flag for review" toggle; flags persist in the checkpoint as an OPTIONAL `flags` array of indexes (old checkpoints without it resume fine).
- [ ] **Step 3 — unanswered count.** Live count next to the navigator and on the final screen next to Submit Exam ("3 unanswered").
- [ ] **Step 4 — a11y.** Timer element gets an accessible name ("Time remaining"); each question screen gets a real heading ("Question N of M") without breaking the existing focus flow. Results breakdown table gains a `.table-scroll` wrapper div (styled in Task 4).

### Task 3: Quiz resume, flashcard order persistence, progress reset, feedback markers, skip links

**Files:** `<m>/js/lib/storage.js` ×5 (tail only), `<m>/js/lib/storage.test.mjs` ×5, new `<m>/js/lib/weakAreas.js` + `weakAreas.test.mjs` ×5, `<m>/js/views/quiz.js` ×5, `<m>/js/views/flashcards.js` ×5, `<m>/js/views/progress.js` ×5, `<m>/index.html` ×5.

- [ ] **Step 1 — quiz resume.** Single-slot `quiz-checkpoint` key (`{domainId, questionIds, index, answers}`) saved on every answered question; entering `#/quiz/<domain>` with a matching-domain checkpoint offers Resume / Start over; starting any quiz overwrites the slot; finishing (or entering review rounds) clears it. Review rounds are never checkpointed.
- [ ] **Step 2 — flashcard session.** `flashcard-session` key (`{order, index, filterUnknown}`) persisted on every action; restored on entry when `order` still matches the deck's id set; explicit "Shuffle" button reshuffles and resets position. Wrong-shape/stale values fall back to a fresh shuffle.
- [ ] **Step 3 — progress reset.** Buttons on the progress view — clear quiz history, clear mock-exam history, reset flashcard progress — each with a `confirm()` guard and matching new storage methods (`clearQuizHistory` etc.) covered by storage tests.
- [ ] **Step 4 — weakAreas.js.** Extract the per-domain accuracy + weakest-domain selection from progress.js into `weakAreas.js` with tests (rounding-tie case, all-100% suppression, single-domain rule); progress.js imports it. History tables get `.table-scroll` wrappers.
- [ ] **Step 5 — feedback markers.** Quiz/exam feedback and review lists carry textual ✓/✗ markers (aria-hidden glyph + words like "Correct"/"Incorrect" already adjacent), so state never rides on color alone.
- [ ] **Step 6 — skip link.** `<a class="skip-link" href="#app-content">Skip to content</a>` first in `<body>` of each module's index.html (visually hidden until focused; style in Task 4).

### Task 4: Mobile + print CSS

**Files:** `<m>/css/style.css` ×5.

- [ ] **Step 1 — mobile.** `@media (max-width: 640px)`: header/nav wrap, reduced page padding, `.table-scroll { overflow-x: auto }`, flashcard/exam controls wrap, `.exam-nav` grid tightens. No horizontal body scroll at 375px.
- [ ] **Step 2 — print.** `@media print`: hide nav, controls, buttons, skip link; study content full-width; avoid page-breaks inside `.study-topic`.
- [ ] **Step 3 — new component styles.** `.exam-nav` states, `.skip-link` focus reveal, flag toggle, unanswered badge, reset buttons — consistent with the existing palette and `:focus-visible` rules.

### Task 5: Guardrails — cheatsheet scaffold drift, flashcard domains, SHARED list

**Files:** `<m>/cheatsheet.html` ×5, `scripts/check-drift.mjs`, `<m>/js/data/flashcards.js` ×5, `<m>/scripts/validate-content.mjs` ×5, `README.md`.

- [ ] **Step 1 — unify + mark scaffold.** Reconcile the five cheatsheets' shared print scaffolding (style block + page chrome) to one canonical version between `<!-- shared-scaffold:start -->` / `<!-- shared-scaffold:end -->` markers, preserving each sheet's own content and title.
- [ ] **Step 2 — enforce.** check-drift compares the marked block across the five cheatsheets (and fails when markers are missing), alongside its existing checks; add `js/lib/examSupport.js`, `js/lib/weakAreas.js`, and their test files to SHARED.
- [ ] **Step 3 — flashcard domains.** Each flashcards.js exports `FLASHCARD_DOMAINS` (the module's 5–8 canonical buckets); validate-content checks every card's `domain` is in the list and the list has no duplicates. README's Anki section mentions the canonical lists.

### Task 6: VPC explorer — tested math + dark mode

**Files:** `aws/js/vpc-explorer.js`, `aws/vpc-explorer.html`, new `aws/js/lib/vpcMath.js` + `aws/js/lib/vpcMath.test.mjs` (aws-only, NOT drift-checked).

- [ ] **Step 1 — extract math.** CIDR parse/format, network/broadcast, usableAddresses, and longest-prefix route matching move to `vpcMath.js` (pure functions); vpc-explorer.js imports it; the page loads the script as a module if it doesn't already.
- [ ] **Step 2 — tests.** node:test coverage incl. /31 & /32 clamps, longest-prefix tie-breaking, the local-route-always-matches invariant (CI's `js/lib/*.test.mjs` glob picks this up for aws automatically).
- [ ] **Step 3 — theming.** Replace hardcoded light-mode hex values with CSS custom properties and add a `prefers-color-scheme: dark` palette consistent with the sheet's existing look; centralize the highlightable-id list in one exported constant.

### Task 7: Verification + ship

- [ ] Full suite ×5 + drift + export; drive navigator/resume/persistence flows and a 375px viewport in the browser; commit in logical chunks; push; watch CI.
