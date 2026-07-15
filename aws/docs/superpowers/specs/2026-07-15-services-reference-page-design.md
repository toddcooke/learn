# Services Reference Page — Design

**Date:** 2026-07-15
**Status:** Approved

## Goal

Add a "Services" page to the AWS SAA-C03 exam-prep SPA that lists every AWS
service the site covers, each with a very brief (one-sentence) description of
what it does. A quick-scan reference that complements the deeper study guide
and flashcards.

## Decisions made during brainstorming

- **New SPA view**, not a standalone HTML page — added to the main nav and
  hash router like the other views, sharing the site's styling.
- **Scope: site-covered services only** (~60), i.e. the services already
  referenced by the flashcard deck and study guide — not the full official
  exam-guide in-scope appendix.
- **Data source: a new authored data file** (`js/data/services.js`), not a
  runtime derivation from `FLASHCARDS` — flashcards carry no blurb field, and
  their `service` values include pseudo-entries and sub-features that would
  need filtering anyway.

## Design

### Data — `js/data/services.js`

Exports `SERVICES`: an array of roughly 60 entries:

```js
{
  id: 'ec2',                  // unique kebab-case slug
  name: 'Amazon EC2',          // display name
  domain: 'Compute, Containers, and Serverless', // one of the 7 real FLASHCARD_DOMAINS
  blurb: '...',                // one sentence, ~20–220 chars
  covers: ['Amazon EC2 Auto Scaling'], // optional: flashcard `service` values this entry subsumes
}
```

- Domain buckets are the 7 real entries of `FLASHCARD_DOMAINS` (imported from
  `flashcards.js`); the "Best-Fit Scenarios" bucket is excluded — it is a
  study category, not a service category.
- Blurbs are written fresh in the site's own words, grounded in the existing
  study/flashcard content (which was itself checked against AWS docs).
- Sub-options of a service (e.g. RDS Multi-AZ, Read Replicas) fold into the
  parent service's blurb rather than getting their own rows. Distinct
  exam-relevant networking constructs the deck treats separately (NAT
  Gateway, Security Groups, Network ACLs, ALB/NLB/GWLB) keep their own rows.

### View — `js/views/services.js`

- Exports `render(mount)` like every other view.
- Renders one section per domain (in `FLASHCARD_DOMAINS` order, minus
  Best-Fit Scenarios), each containing an alphabetized definition-style list:
  **Service name** — blurb.
- Purely static render: no state, no params, no localStorage.

### Wiring

- `js/app.js`: import the view, add `services` to the `VIEWS` map.
- `index.html`: add `<a href="#/services" data-view="services">Services</a>`
  to the nav, between Study Guide and Quizzes (it's reference material).
- CSS: reuse existing styles where possible; add a small `.services` block to
  `css/style.css` only if the default list styling isn't adequate (including
  dark-mode and print/mobile stylesheets if touched).

### Validation — `scripts/validate-content.mjs`

New `validateServices()`, skipped if the file doesn't exist (matching the
other validators):

- `SERVICES` is a non-empty array; ids unique and non-empty; names non-empty.
- `domain` must be one of `FLASHCARD_DOMAINS` and must not be
  `'Best-Fit Scenarios'`.
- `blurb` length within 20–220 chars (keeps "very brief" honest).
- `covers`, when present, is an array of non-empty strings.
- **Drift guard:** every distinct `service` value in `FLASHCARDS` (except
  `'Best-Fit Scenario'`) must be covered by some services entry — matching
  either the entry's `name` exactly or an element of its `covers` list — so
  future flashcards can't silently miss this page.

### Testing

- No new unit-testable logic (static render, no branching worth a harness).
- `node scripts/validate-content.mjs` must pass.
- Manual browser check of the rendered page (nav link, grouping, dark mode).

## Out of scope

- Search/filter box.
- Per-service deep links into flashcards or the study guide.
- Services from the official exam-guide appendix that the site doesn't
  otherwise cover (e.g. SageMaker, AppFlow).
