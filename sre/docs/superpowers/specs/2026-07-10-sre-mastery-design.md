# Site Reliability Engineering (SRE) Mastery Site

Status: Approved
Date: 2026-07-10

## Purpose

Build a static, local-first website that helps someone learn Site
Reliability Engineering in depth — a study guide organized by knowledge
domain, a large practice question bank, flashcards, a timed self-test, and
a progress dashboard — following the same design and architecture as the
existing AWS SAA-C03, CKA, and PostgreSQL modules (`aws/`, `kubernetes/`,
`postgres/`) in this repo. This is the fourth module in the `learn`
monorepo, published at `https://toddcooke.github.io/learn/sre/`.

## Not tied to a certification

Unlike the AWS and Kubernetes modules, there is no single, industry-wide
Site Reliability Engineering certification analogous to SAA-C03 or CKA.
This module is therefore **general SRE mastery**, following the same
"general mastery, not exam prep" framing the PostgreSQL module already
established for this repo.

Unlike the PostgreSQL module, though, SRE also has no single official,
vendor-neutral documentation site the way postgresql.org is for
PostgreSQL. The closest thing to a canonical, industry-standard reference
is Google's own **Site Reliability Engineering** book (the "SRE book") and
**The Site Reliability Workbook**, both freely readable at `sre.google`
and enormously influential in coining and defining the field's vocabulary
(SLI/SLO/error budget, toil, blameless postmortems, etc.). The home page
must carry an honest note that this reflects one company's — albeit the
field's most influential — perspective on SRE, not a vendor-neutral
standard the way AWS's exam guide or the CNCF's CKA curriculum are for
their respective domains.

## Source of truth for content

Confirmed directly from `sre.google` as of 2026-07-10:

- **Site Reliability Engineering** ("the SRE book"): `sre.google/sre-book/`
  — table of contents confirmed live, organized into Part I (Introduction),
  Part II (Principles: Embracing Risk, Service Level Objectives,
  Eliminating Toil, Monitoring Distributed Systems, The Evolution of
  Automation at Google, Release Engineering, Simplicity), Part III
  (Practices: on-call/alerting/incident management/postmortems, then load
  balancing/overload/cascading failures/distributed consensus), Part IV
  (Management), Part V (Conclusions).
- **The Site Reliability Workbook**: `sre.google/workbook/` — table of
  contents confirmed live, organized into Part I (Foundations:
  Implementing SLOs, SLO Engineering Case Studies, Monitoring, Alerting on
  SLOs, Eliminating Toil, Simplicity), Part II (Practices: On-Call,
  Incident Response, Postmortem Culture, Managing Load, Non-Abstract Large
  System Design, Data Processing Pipelines, Configuration Design/Specifics,
  Canarying Releases), Part III (Processes).
- Five specific chapter URLs spot-checked directly (`service-level-objectives`,
  `monitoring-distributed-systems`, `eliminating-toil` from the SRE book;
  `implementing-slos`, `incident-response` from the Workbook) all return
  200 and real chapter content.
- `sre.google` pages have no markdown-sibling like AWS docs did;
  `scripts/fetch-doc.mjs`'s existing generic HTML-stripping fallback
  (already proven against kubernetes.io and postgresql.org in prior
  modules) is expected to work the same way here — confirmed at the
  design stage only via direct URL reachability, to be confirmed for real
  extraction quality during Task 2's implementation, same as every prior
  module.

## Domain taxonomy and weights

Self-authored (there is no official exam blueprint to draw from), mapped
directly onto real chapters/sections of the SRE book and Workbook so every
domain has genuine, fetchable source material — designed to sum to 100 the
same way the AWS/CKA/Postgres domain weights do:

| Domain | id | Weight |
|---|---|---|
| SLIs, SLOs & Error Budgets | `slos` | 20% |
| Monitoring, Observability & Alerting | `monitoring` | 20% |
| Incident Response, On-Call & Postmortems | `incidents` | 20% |
| Capacity Planning & Managing Load | `capacity` | 15% |
| Release Engineering & Change Management | `release` | 15% |
| Reliability Patterns & Toil Reduction | `reliability` | 10% |

- **SLIs, SLOs & Error Budgets**: service level indicators vs. objectives
  vs. agreements, choosing appropriate SLIs (request/response, pipeline,
  storage-system SLIs), error budgets and error-budget policy, embracing
  risk / the cost of 100% reliability (SRE book "Embracing Risk", "Service
  Level Objectives"; Workbook "Implementing SLOs", "SLO Engineering Case
  Studies").
- **Monitoring, Observability & Alerting**: the four golden signals
  (latency, traffic, errors, saturation), black-box vs. white-box
  monitoring, alerting on symptoms vs. causes, playbooks, burn-rate
  alerting on SLOs, long-term vs. real-time monitoring, dashboards (SRE
  book "Monitoring Distributed Systems"; Workbook "Monitoring", "Alerting
  on SLOs").
- **Incident Response, On-Call & Postmortems**: healthy on-call practices
  and escalation, incident command roles, communication during incidents,
  severity levels, blameless postmortem culture and learning from failure
  (Workbook "On-Call", "Incident Response", "Postmortem Culture: Learning
  from Failure").
- **Capacity Planning & Managing Load**: load balancing at multiple layers
  (DNS, L4/L7, backend), demand forecasting, handling overload and
  cascading failures, graceful degradation, non-abstract large system
  design as a capacity-planning methodology (SRE book overload/cascading
  failure chapters; Workbook "Managing Load", "Introducing Non-Abstract
  Large System Design").
- **Release Engineering & Change Management**: release engineering
  principles (hermetic builds, config-as-code), canarying and progressive
  rollout strategies, configuration design/best practices, why risky
  changes are a leading cause of outages, rollback strategy (SRE book
  "Release Engineering"; Workbook "Configuration Design and Best
  Practices", "Configuration Specifics", "Canarying Releases").
- **Reliability Patterns & Toil Reduction**: the formal definition of toil
  and why it must be capped, the evolution of automation, simplicity as a
  reliability property (complexity as the enemy of reliability),
  distributed-systems reliability patterns (redundancy, circuit breakers,
  cascading-failure prevention) (SRE book "Eliminating Toil", "The
  Evolution of Automation at Google", "Simplicity"; Workbook "Eliminating
  Toil", "Simplicity").

## Architecture: reuse, not rebuild

Same content-agnostic application layer as the AWS, CKA, and PostgreSQL
modules (router, base styles, storage/scoring libraries, view components,
content tooling scripts). Built directly as a new sibling subdirectory,
`sre/`, inside the existing monorepo checkout — no separate repo, no `git
subtree` import, no new deployment wiring. A single push to `main` is
sufficient; the existing `static/learn` submodule and hourly
`sync-learn-submodules.yml` workflow already cover any subdirectory added
under `toddcooke/learn`.

### Copy-source guidance, refined from the PostgreSQL build

The PostgreSQL module's final review flagged that copy-source choices
matter and change per file (see that module's own spec for the two
lessons learned from the CKA build). This module benefits from a further
refinement now that `postgres/` exists as a third, already-bug-fixed
sibling:

1. **`scripts/validate-content.mjs` should be copied from `postgres/`, not
   `aws/` or `kubernetes/`.** `postgres/`'s copy already has no AWS-specific
   scored/unscored check (correctly, since this module has no such
   concept either) AND its domain-count check already reads `DOMAINS.length
   === 6` — this module also has exactly 6 domains, so **no edit to this
   file is needed at all**, only a verification that the count still reads
   6.
2. **`js/views/mockExam.js` should also be copied from `postgres/`, not
   `aws/`.** `postgres/`'s copy already has the `estimateScaledScore()`
   call passing explicit `{minScore, maxScore}` options — the fix that had
   to be independently rediscovered and reapplied for both the CKA and
   PostgreSQL modules. Since this module also uses a non-default 0–100
   scale, copying from `postgres/` means the scoring-logic edit is already
   done; only the results-screen text needs a one-line wording change
   (swap "PostgreSQL exam" for "SRE exam" / "this module isn't tied to a
   certification" phrasing, which is already the right shape, just naming
   the wrong subject).
3. **`js/views/home.js` should use `postgres/`'s home view as its
   structural template** (not copied verbatim, since the content differs)
   — it already has the "not tied to a certification" honesty-note
   pattern this module also needs, unlike `aws/`'s or `kubernetes/`'s
   home views which describe a real exam.
4. Every other file (`css/style.css`, `js/app.js`, `js/lib/storage.js`
   pattern, `js/lib/scoring.js`, `js/views/{studyGuide,quiz,flashcards,
   progress}.js`, `scripts/fetch-doc.mjs`) is identical across all three
   existing modules — source doesn't matter, pick any.

### Local doc cache

Same as the other three modules: every fetched page is cached to
`.cache/aws-docs/<slug>.md` (directory name kept for consistency with the
copied, unmodified tooling) keyed by URL, via `scripts/fetch-doc.mjs`.
`.cache/` is gitignored at the repo root, already covering this
subdirectory.

## Data shapes

```js
// data/examInfo.js
export const DOMAINS = [
  { id: 'slos', name: 'SLIs, SLOs & Error Budgets', weight: 20, mockExamCount: 10 },
  { id: 'monitoring', name: 'Monitoring, Observability & Alerting', weight: 20, mockExamCount: 10 },
  { id: 'incidents', name: 'Incident Response, On-Call & Postmortems', weight: 20, mockExamCount: 10 },
  { id: 'capacity', name: 'Capacity Planning & Managing Load', weight: 15, mockExamCount: 8 },
  { id: 'release', name: 'Release Engineering & Change Management', weight: 15, mockExamCount: 7 },
  { id: 'reliability', name: 'Reliability Patterns & Toil Reduction', weight: 10, mockExamCount: 5 },
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
(`EXAM_FORMAT.totalQuestions`). `js/lib/storage.js`'s `NAMESPACE` constant
must be `'sre-prep'` — distinct from `saa-prep`/`cka-prep`/`pg-prep`,
since all four modules share the `toddcooke.github.io` origin.
`questions.js`, `flashcards.js`, and `studyContent.js` use the exact same
shapes as the other three modules, validated by the same, unmodified
`validate-content.mjs`.

## Content pipeline

Same adversarial-verification approach as every prior module, with every
lesson learned applied from the start:

1. **Fan-out research per domain.** Fetch the relevant SRE book/Workbook
   chapter pages for each domain's topics via `fetch-doc.mjs`.
2. **Draft per topic.** Study notes and draft questions grounded in the
   fetched chapters.
3. **Adversarial verification.** Every draft question's answer key is
   re-checked against the source chapters before being accepted.
4. **Verbatim-copying, answer-length-balance, and answer-position-balance
   checks, mandatory from the first task.** All three were real,
   independently-confirmed bugs found during earlier modules' builds.
   Every content task's instructions require sanity-checking the
   verification tooling itself (plant a known violation, confirm it's
   caught) before trusting a clean result.
5. **Assembly.** Verified content compiled into the static JS data files
   above.

**Process fix carried over from the PostgreSQL final review:** that
module's Global Constraints said the question bank must be "exactly 100,"
while every individual task's own step said "at least N" — an internal
plan inconsistency that let the delivered bank (132) technically violate
its own stated exact target without anyone treating it as a defect. This
spec states the per-domain counts explicitly as **floors**: SLIs/SLOs ≥
20, Monitoring ≥ 20, Incidents ≥ 20, Capacity ≥ 15, Release ≥ 15,
Reliability ≥ 10 (summing to a 100-question **minimum**, not an exact
target). Overshooting any domain's floor is expected and acceptable, not
a deviation to flag.

Target volume: **at least 100 practice questions total** (floors above),
mixed ~80% multiple-choice / 20% multiple-response. Flashcard deck:
~65-70 cards covering core SRE vocabulary and concepts (SLI, SLO, SLA,
error budget, error budget policy, toil, golden signals, blameless
postmortem, incident commander, canary release, hermetic build, cascading
failure, circuit breaker, graceful degradation, burn rate, on-call
rotation, runbook/playbook, non-abstract large system design, config-as-
code, load shedding, capacity planning, availability nines, etc.).

## Features

Identical feature set to the AWS, CKA, and PostgreSQL modules:

- **Study guide** — sidebar organized by the 6 domains, each with
  thematically-grouped topics.
- **Domain quizzes** — pick a domain, answer questions drawn from that
  domain's bank, instant per-question feedback with explanation.
- **Flashcards** — flip-card per concept/term; mark known/unknown; filter
  to just what still needs review.
- **Practice exam** — 50 questions drawn and weighted by domain
  percentage, 75-minute countdown timer, results screen showing percent
  correct against a 70% passing line and a per-domain breakdown. Framed
  honestly as a self-test, not a simulation of any vendor exam.
- **Progress dashboard** — quiz history, practice exam attempts,
  flashcard mastery, all read from `localStorage` namespaced under
  `sre-prep:` (distinct from the other three modules' namespaces, since
  all four share the `toddcooke.github.io` origin).

## Verification approach

Same as every prior module: (1) the adversarial content-verification pass
described above, including all three integrity checks; (2) a manual
end-to-end browser walkthrough before calling the build done — study guide
navigation across all 6 domains, a full domain quiz, flashcard flipping/
filtering, a complete 50-question practice exam through to the results
screen, and confirming progress persists across a page reload. The
controller will personally perform a live check of the mock-exam scoring
boundary after the views task, the same discipline applied to every prior
module (a real scoring-scale bug was found this way during the CKA
build and has recurred as a risk in every module since — copying
`mockExam.js` from `postgres/` per the Architecture section above should
prevent it from recurring here, but the live check still confirms it).

## Explicitly out of scope

- No backend, no build tooling, no external services — same constraints
  as the other three modules.
- No claim of tracking any specific certification's blueprint or passing
  score — the "not a certification, and not a vendor-neutral standard
  either" note on the home page makes this explicit.
- No new deployment/hosting work — building inside the existing monorepo
  and pushing to `main` is the entire deployment step.
- No user accounts/auth — all state is local to the browser via
  `localStorage`.
