# PostgreSQL Mastery Site

Status: Approved
Date: 2026-07-09

## Purpose

Build a static, local-first website that helps someone learn PostgreSQL in
depth — a study guide organized by knowledge domain, a large practice
question bank, flashcards, a timed self-test, and a progress dashboard —
following the same design and architecture as the existing AWS SAA-C03 and
CKA exam prep modules (`aws/`, `kubernetes/`) in this repo. This is the
third module in the `learn` monorepo, published at
`https://toddcooke.github.io/learn/postgres/`.

## Not tied to a certification

Unlike the AWS and Kubernetes modules, there is no single, universally
recognized PostgreSQL certification analogous to SAA-C03 or CKA. The
PostgreSQL Global Development Group does not run a certification program
(confirmed by checking postgresql.org, 2026-07-09). EDB (EnterpriseDB) runs
its own commercial certification track, but it is one vendor's program, not
an industry-standard blueprint the way CNCF's CKA curriculum is.

This module is therefore **general PostgreSQL mastery**, not exam prep for
a specific credential. The domain taxonomy below is self-authored (not
sourced from an official exam guide), and the home page carries a brief,
honest note that this module isn't tied to any single certification —
mirroring the honesty the AWS and CKA modules already apply to their own
content (CKA's format-honesty disclaimer; both modules' "unofficial study
aid" footer).

## Source of truth for content

Confirmed directly from postgresql.org as of 2026-07-09:

- Current stable major version: **PostgreSQL 18** (patch 18.4, released
  2026-05-14). PostgreSQL 19 is in beta and not yet stable.
- Official documentation lives at `https://www.postgresql.org/docs/current/`
  — this path always resolves to the latest stable version's docs, so
  content sourced from it stays accurate as new point releases ship
  (verified: `/docs/current/index.html` and `/docs/current/sql-select.html`
  both return 200).
- PostgreSQL doc pages have no markdown-sibling like AWS docs did;
  `scripts/fetch-doc.mjs`'s existing generic HTML-stripping fallback
  (already used for kubernetes.io in the CKA module) was tested directly
  against a real page (`/docs/current/sql-select.html`) and produces
  usable, if slightly noisier, text — no tooling changes needed.

## Domain taxonomy and weights

Self-authored, covering both DBA and application-development knowledge
areas, designed to sum to 100 the same way the AWS/CKA domain weights do
(enabling the same weight-as-question-count convention):

| Domain | id | Weight |
|---|---|---|
| Architecture & Data Types | `architecture` | 15% |
| Querying & SQL | `querying` | 20% |
| Indexing & Performance | `indexing` | 20% |
| Transactions & Concurrency (MVCC) | `transactions` | 15% |
| Administration & Maintenance | `administration` | 20% |
| Replication & High Availability | `replication` | 10% |

- **Architecture & Data Types**: process/memory architecture, storage
  layout, TOAST, native data types (numeric, text, date/time, arrays,
  ranges, JSON/JSONB, UUID), NULL handling.
- **Querying & SQL**: joins, subqueries, CTEs (including recursive), window
  functions, aggregate functions, JSON/JSONB querying, full-text search
  basics, upsert (`ON CONFLICT`).
- **Indexing & Performance**: index types (B-tree, Hash, GIN, GiST, BRIN,
  partial/expression indexes), `EXPLAIN`/`EXPLAIN ANALYZE`, the query
  planner/cost model, common performance pitfalls.
- **Transactions & Concurrency (MVCC)**: MVCC internals, isolation levels,
  locking (row/table/advisory), deadlocks, `SERIALIZABLE` behavior.
- **Administration & Maintenance**: roles/permissions, `VACUUM`/autovacuum,
  backup and restore (`pg_dump`/`pg_restore`, physical backups, WAL
  archiving), configuration/tuning basics, extensions, partitioning
  management.
- **Replication & High Availability**: streaming replication, logical
  replication, failover concepts, connection pooling (e.g. PgBouncer),
  read replicas.

## Architecture: reuse, not rebuild — now simpler

Same content-agnostic application layer as the AWS and CKA modules
(router, base styles, storage/scoring libraries, view components, content
tooling scripts — all copied unchanged except `js/lib/storage.js`'s
`NAMESPACE` constant and `scripts/validate-content.mjs`'s domain count).

Unlike the CKA module, this one does **not** need its own repo, its own
push, or a `git subtree` import: `toddcooke/learn` is now a multi-module
monorepo (established when the CKA module was added), so this module is
built directly as a new sibling subdirectory, `postgres/`, inside the
existing `learn_aws` checkout. A single push to `main` is sufficient — the
existing `static/learn` submodule and the hourly
`sync-learn-submodules.yml` workflow in `toddcooke.github.io` already cover
any subdirectory added under `toddcooke/learn`, with zero additional
deployment wiring.

### Two lessons from the CKA build apply directly here, and change which sibling module a file is copied from

1. **`scripts/validate-content.mjs` must be copied from `kubernetes/`, not
   `aws/`.** `aws/`'s version still has an AWS-specific check
   (`EXAM_FORMAT.totalQuestions === EXAM_FORMAT.scoredQuestions +
   EXAM_FORMAT.unscoredQuestions`) that only makes sense for AWS's real
   scored/unscored exam format. This module's `EXAM_FORMAT` has no such
   fields (same as CKA's), and `kubernetes/`'s copy already had that check
   removed during the CKA build's final review — copying from there avoids
   re-discovering the same dead-field problem. Only the domain-count check
   needs editing (6, not 5).
2. **`js/views/mockExam.js` must be copied from `aws/`, not `kubernetes/`**
   (the reverse of the above) — `kubernetes/`'s copy has CKA-specific
   disclaimer text ("the real CKA exam is 100% hands-on...") that doesn't
   apply here. But `aws/`'s copy has a latent bug that only surfaces when
   `EXAM_FORMAT.minScore`/`maxScore` differ from `scoring.js`'s defaults
   (100/1000): `finishExam()` calls `estimateScaledScore(correctCount,
   exam.length)` **without** passing `{minScore, maxScore}`, so it silently
   uses the wrong scale. This module's `EXAM_FORMAT` uses `minScore: 0,
   maxScore: 100` (like CKA's), so this call must explicitly pass those
   options — the same one-line fix already applied and verified in
   `kubernetes/js/views/mockExam.js:129`. The results-screen explanatory
   text also needs new, postgres-appropriate wording (neither AWS's nor
   CKA's phrasing fits, since this module isn't honest-about-hands-on
   (CKA's angle) or referencing a real scaling formula (AWS's angle) — it's
   honest about being a self-test with no official scoring behind it).

### Local doc cache

Same as the other two modules: every fetched page is cached to
`.cache/aws-docs/<slug>.md` (directory name kept for consistency with the
copied, unmodified tooling) keyed by URL, via `scripts/fetch-doc.mjs`.
`.cache/` is gitignored.

## File tree

```
postgres/
  index.html                 - app shell (copied from aws/, title/copy updated)
  css/
    style.css                - copied from aws/ unchanged
  js/
    app.js                   - copied from aws/ unchanged (router)
    views/
      home.js                - copied, home page text + "not a certification" note updated
      studyGuide.js           - copied unchanged
      quiz.js                 - copied unchanged
      flashcards.js           - copied unchanged
      mockExam.js             - copied from aws/ (not kubernetes/), then TWO required edits:
                                  the estimateScaledScore() call needs explicit
                                  {minScore, maxScore} options, and the results-screen
                                  explanatory text needs new copy (see Architecture
                                  section above). Filename/route stays "mockExam"/"#/exam"
                                  to keep the router's view-name convention identical
                                  across all three modules, even though the UI copy calls
                                  it a "practice exam."
      progress.js              - copied unchanged (source doesn't matter, identical in both)
    data/
      examInfo.js             - NEW: PostgreSQL domains, weights, practice-exam format
      studyContent.js         - NEW: PostgreSQL study content
      questions.js             - NEW: PostgreSQL question bank
      flashcards.js            - NEW: PostgreSQL flashcard deck
    lib/
      storage.js               - copied from aws/ with NAMESPACE changed to 'pg-prep'
      storage.test.mjs         - copied from aws/ unchanged
      scoring.js                - copied from aws/ unchanged
      scoring.test.mjs          - copied from aws/ unchanged
  scripts/
    fetch-doc.mjs              - copied from aws/ unchanged (source doesn't matter, identical in both)
    validate-content.mjs       - copied from kubernetes/ (not aws/ — see Architecture
                                  section above), with the domain-count check changed
                                  to 6
  README.md                    - new content, same structure as the other two modules'
```

### Data shapes

Identical schema to the other two modules (validated by the same,
unmodified `validate-content.mjs`):

```js
// data/examInfo.js
export const DOMAINS = [
  { id: 'architecture', name: 'Architecture & Data Types', weight: 15, mockExamCount: 8 },
  { id: 'querying', name: 'Querying & SQL', weight: 20, mockExamCount: 10 },
  { id: 'indexing', name: 'Indexing & Performance', weight: 20, mockExamCount: 10 },
  { id: 'transactions', name: 'Transactions & Concurrency (MVCC)', weight: 15, mockExamCount: 7 },
  { id: 'administration', name: 'Administration & Maintenance', weight: 20, mockExamCount: 10 },
  { id: 'replication', name: 'Replication & High Availability', weight: 10, mockExamCount: 5 },
];
export const EXAM_FORMAT = {
  totalQuestions: 50, // practice-exam draw size, not the full bank
  durationMinutes: 75,
  passingScore: 70,
  minScore: 0,
  maxScore: 100,
};
```

`DOMAINS[].weight` sums to 100; `DOMAINS[].mockExamCount` sums to 50
(`EXAM_FORMAT.totalQuestions`). The full practice bank target (100
questions, matching weight-as-count) is a Global Constraint in the
implementation plan, not a stored field — same pattern as the other two
modules. `questions.js`, `flashcards.js`, and `studyContent.js` use the
exact same shapes as the AWS/CKA modules.

## Content pipeline

Same adversarial-verification approach as the AWS and CKA modules, with
every lesson learned from those builds applied from the start (not
discovered via review):

1. **Fan-out research per domain.** Fetch the relevant PostgreSQL
   documentation pages for each domain's topics via `fetch-doc.mjs`.
2. **Draft per topic.** Study notes and draft questions grounded in the
   fetched docs.
3. **Adversarial verification.** Every draft question's answer key is
   re-checked against the source docs before being accepted.
4. **Verbatim-copying, answer-length-balance, and answer-position-balance
   checks, mandatory from the first task.** All three were real,
   independently-confirmed bugs found during the CKA module's build (one
   as severe as 100% of answers landing on option A). Every content task's
   instructions require sanity-checking the verification tooling itself
   (plant a known violation, confirm it's caught) before trusting a clean
   result.
5. **Assembly.** Verified content compiled into the static JS data files
   above.

Target volume: **100 practice questions total**, matching domain weight
percentages directly as counts (Architecture 15, Querying 20, Indexing 20,
Transactions 15, Administration 20, Replication 10 — sums to exactly 100),
mixed ~80% multiple-choice / 20% multiple-response. Flashcard deck: ~65
cards covering core PostgreSQL concepts and objects (table/index/view/
materialized view, index types, MVCC, WAL, transaction isolation levels,
role, schema, trigger, constraint types, JSONB, partitioning, sequence,
CTE, window function, lock types, deadlock, autovacuum, TOAST,
tablespace, `pg_stat_*` views, extensions, streaming/logical replication,
connection pooling, etc.).

## Features

Identical feature set to the AWS and CKA modules:

- **Study guide** — sidebar organized by the 6 domains, each with
  thematically-grouped topics.
- **Domain quizzes** — pick a domain, answer questions drawn from that
  domain's bank, instant per-question feedback with explanation.
- **Flashcards** — flip-card per concept/object; mark known/unknown;
  filter to just what still needs review.
- **Practice exam** — 50 questions drawn and weighted by domain
  percentage, 75-minute countdown timer, results screen showing percent
  correct against a 70% passing line and a per-domain breakdown. Framed
  honestly as a self-test, not a simulation of any specific vendor exam.
- **Progress dashboard** — quiz history, practice exam attempts,
  flashcard mastery, all read from `localStorage` namespaced under
  `pg-prep:` (distinct from `saa-prep:` and `cka-prep:`, since all three
  modules will share the `toddcooke.github.io` origin).

## Verification approach

Same as the other two modules: (1) the adversarial content-verification
pass described above, including all three integrity checks; (2) a manual
end-to-end browser walkthrough before calling the build done — study guide
navigation across all 6 domains, a full domain quiz, flashcard flipping/
filtering, a complete 50-question practice exam through to the results
screen, and confirming progress persists across a page reload. Given a
real, user-visible scoring bug was found via live browser testing (not
per-task review) during the CKA build, the controller will personally
perform this live walkthrough after the views task, the same way it did
for CKA, rather than delegating it to a subagent.

## Explicitly out of scope

- No backend, no build tooling, no external database — same constraints
  as the other two modules.
- No claim of tracking any specific certification's blueprint or passing
  score — the "not a certification" note on the home page makes this
  explicit.
- No new deployment/hosting work — building inside the existing monorepo
  and pushing to `main` is the entire deployment step, per the
  Architecture section above.
- No user accounts/auth — all state is local to the browser via
  `localStorage`.
