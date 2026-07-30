# Schema Design & Constraints Domain

Status: Approved
Date: 2026-07-30

## Purpose

Add a seventh knowledge domain — **Schema Design & Constraints** — to the
PostgreSQL Mastery module (`postgres/`). The module currently teaches how to
operate and query a PostgreSQL database but never teaches how to design one:
an audit on 2026-07-30 found no coverage of normalization, entity
relationships, primary or foreign keys, or referential actions anywhere in
the study guide, quiz bank, or flashcard deck.

The only near-misses are incidental. Every occurrence of "normaliz\*" in the
content refers to text or type normalization (tsvector lexemes,
timestamptz-to-UTC conversion, UUID canonical form, range bound
normalization), not database normalization. The single "surrogate key"
occurrence sits inside a wrong-answer distractor on a replica-identity
question, and "ER model" matched only the substring in "Client/Server Model".
Constraints appear solely in service of other topics: exclusion constraints
via range overlap, partial unique indexes as an indexing trick, CHECK
constraints in the partition-attach path.

## Scope decisions

Four decisions were settled during brainstorming and are fixed for this work:

1. **A new seventh domain**, not a fold into an existing one. The taxonomy is
   self-authored (see `2026-07-09-postgres-mastery-design.md`), so extending
   it is legitimate. Folding schema design into "Architecture & Data Types"
   would force it to share that domain's weight and mock-exam slots with the
   process model, TOAST, WAL, and every data type, leaving it thin.
2. **Normalization theory is included**, as a second documented sourcing
   exception (see "Sourcing" below).
3. **15% weight** — a peer of Architecture and Transactions, not a major
   domain like Querying or Administration.
4. **Theory-first learning path** — theory and PostgreSQL mechanics
   interleave so each conceptual idea is immediately cashed out in syntax,
   rather than being split into a theory track and a mechanics track.

## Taxonomy and weights

Add to `js/data/examInfo.js`, positioned **second** in the `DOMAINS` array
(immediately after Architecture) so the study guide reads in learning order:

```js
{ id: 'schema-design', name: 'Schema Design & Constraints', weight: 15, mockExamCount: 7 }
```

`scripts/validate-content.mjs` enforces that `weight` sums to exactly 100 and
`mockExamCount` sums to exactly `EXAM_FORMAT.totalQuestions` (50), so the
existing six domains must be rebalanced in the same edit:

| Domain | Weight | Mock count |
| --- | --- | --- |
| Architecture & Data Types | 15 → 13 | 8 → 7 |
| **Schema Design & Constraints** | — → **15** | — → **7** |
| Querying & SQL | 20 → 17 | 10 → 9 |
| Indexing & Performance | 20 → 17 | 10 → 9 |
| Transactions & Concurrency (MVCC) | 15 → 13 | 7 → 6 |
| Administration & Maintenance | 20 → 17 | 10 → 8 |
| Replication & High Availability | 10 → 8 | 5 → 4 |
| **Total** | **100** | **50** |

Every existing domain's `mockExamCount` only decreases, and the validator's
`supply >= mockExamCount` rule is already satisfied at the current, higher
counts (current supply: architecture 24, querying 24, indexing 24,
transactions 22, administration 24, replication 14), so no existing domain
can be starved by this change.

Both the study-guide index (`js/views/studyGuide.js`) and the quiz index
(`js/views/quiz.js`) map over `DOMAINS` in array order, so second position is
what places the new domain after Architecture in both views. The study-guide
index also renders each domain's `weight` as a percentage, making the
rebalanced numbers directly user-visible.

`FLASHCARD_DOMAINS` in `js/data/flashcards.js` gains `'Schema Design'`,
inserted second to match. The Anki exporter derives its tag from that label,
producing `postgres::schema-design`.

## Content plan

### Study guide — five sections, ~20 topics

Sections are authored as `STUDY_CONTENT` entries with
`domain: 'schema-design'`. `js/views/studyGuide.js` renders a domain's
sections by filtering `STUDY_CONTENT` in array order, so the array position of
these entries is what determines the order a learner reads them in; author
them in exactly this sequence:

1. **Relational Modeling Foundations** *(theory)* — relations and tuples;
   why redundancy produces update, insertion, and deletion anomalies;
   functional dependencies as the tool for spotting them.
2. **Keys and Identity** *(mixed)* — candidate, primary, and composite keys;
   natural versus surrogate key tradeoffs; identity columns and the `serial`
   pseudo-type; how `UNIQUE` differs from `PRIMARY KEY`, including null
   handling.
3. **Constraints and Referential Integrity** *(docs)* — CHECK, NOT NULL,
   UNIQUE, PRIMARY KEY, and FOREIGN KEY constraints (EXCLUDE stays in
   Architecture with the range types it builds on);
   `ON DELETE` / `ON UPDATE` actions (NO ACTION, RESTRICT, CASCADE, SET NULL,
   SET DEFAULT); `DEFERRABLE INITIALLY DEFERRED`; `MATCH FULL`; adding
   constraints as `NOT VALID` then `VALIDATE CONSTRAINT`.
4. **Normalization and Relationships** *(theory)* — 1NF through BCNF worked
   through a single running example; one-to-many modeled with a foreign key;
   many-to-many modeled with a junction table.
5. **Design Tradeoffs in PostgreSQL** *(mixed)* — deliberate denormalization
   and what it costs; generated columns; domains and composite types;
   `CHECK` constraints versus application-level validation; table inheritance
   versus declarative partitioning.

### Quiz — ~22 questions

`domain: 'schema-design'`, obeying the validator's shape rules:
`multiple-choice` requires exactly 4 options and exactly 1 correct index;
`multiple-response` requires at least 5 options and at least 2 correct
indexes; every question needs an explanation of at least 20 characters. The
domain needs at least 7 to satisfy `mockExamCount`; ~22 gives the mock exam a
non-degenerate pool to draw from.

### Flashcards — ~16 new, plus 2 migrated

New cards follow existing house style: dense prose backs of one to three
sentences, fronts that ask about mechanism, why, or tradeoff rather than bare
"What is X?", and a `service` label that never answers an identification-style
front outright.

## Sourcing

Constraint mechanics stay strictly grounded in the PostgreSQL 18
documentation at `postgresql.org/docs/current/`, consistent with the rest of
the module. Chapter 5 (Data Definition) is the primary source; its sections
cover table basics, identity columns, generated columns, constraints, system
columns, modifying tables, inheritance, and partitioning.

That chapter teaches no normalization theory, no normal forms, no functional
dependencies, and no entity-relationship modeling — it is implementation
focused by design. Theory content therefore draws on the canonical relational
literature instead: Codd's relational model and first through third normal
forms, and Boyce–Codd normal form for BCNF.

This is the module's **second** documented sourcing exception, after
connection pooling (which draws on the PgBouncer docs because PostgreSQL core
documents no pooler). `README.md` gains a bullet beside the existing PgBouncer
note stating plainly that normalization theory is not PostgreSQL
documentation and naming its source. No theory claim may be phrased as though
the PostgreSQL documentation asserted it.

## Migrations

One existing card moves into the new domain so the material lives in one
place:

| Card id | From | To |
| --- | --- | --- |
| `identity-vs-serial` | Administration | Schema Design |

`exclusion-constraint` was originally slated to move here too. It stayed in
Architecture: the card teaches `EXCLUDE USING GIST` with range overlap, which
only makes sense once range types are understood, and range types are
Architecture material. Its study topic and quiz coverage live there as well,
so moving the card alone would have split one concept across two domains —
the opposite of this section's goal.

The card id is unchanged, so the Anki sync updates that note in place — its
tag changes while review scheduling survives, since notes are keyed on the ID
field.

Data types themselves (numeric, char/varchar/text, timestamptz, UUID, arrays,
ranges, json/jsonb) stay in Architecture. They are about representing values,
not structuring relations.

Resulting deck: 133 cards — Architecture 20, Schema Design 17, Querying 16,
Indexing 18, Transactions 15, Administration 31, Replication 16.

## Files touched

| File | Change |
| --- | --- |
| `js/data/examInfo.js` | Add domain; rebalance six weights and mock counts |
| `js/data/studyContent.js` | Add 5 sections (~20 topics) |
| `js/data/questions.js` | Add ~22 questions |
| `js/data/flashcards.js` | Add `'Schema Design'` to `FLASHCARD_DOMAINS`; add ~16 cards; move 1 |
| `README.md` | Domain list; second sourcing-exception bullet |
| `cheatsheet.html` | Study Domains list; new Schema Design block |

The cheatsheet's shared print scaffolding is delimited by
`<!-- shared-scaffold:start -->` / `<!-- shared-scaffold:end -->` markers and
compared byte-for-byte across modules by `scripts/check-drift.mjs`. All edits
must stay **outside** those markers, in the per-module sheet body.

No shared app-layer file is touched, so the drift check is unaffected.

## Verification

1. **Authoring** — content drafted by a doc-grounded multi-agent workflow,
   one agent per study section and question cluster, each fetching the live
   documentation pages for its topic before writing.
2. **Adversarial verification** — every new card, question, and study topic
   is fact-checked by an independent verifier instructed to refute it, the
   same panel approach used for the 2026-07-18 deck review. Mechanics are
   checked against live PostgreSQL 18 documentation; theory claims are
   checked against the cited relational literature and must not be attributed
   to the PostgreSQL docs.
3. **Mechanical checks** — `node scripts/validate-content.mjs`,
   `node --test "js/lib/*.test.mjs"`, `node scripts/check-drift.mjs`, and
   `node scripts/export-anki.mjs` (expecting 133 postgres cards).
4. **Live check** — load the module in a browser, confirm the study guide
   renders seven domains, the quiz offers the new domain, the flashcard
   deck reports 133 cards, and the console is clean.

## Out of scope

- Anki upload. The export file is regenerated, but syncing into Anki via
  AnkiConnect is a separate, explicitly requested step.
- Any change to the five sibling modules (`aws/`, `kubernetes/`,
  `networking/`, `sre/`).
- Retrofitting schema-design questions into existing domains.
- Deployment. Work stays on the `worktree-schema-design-domain` branch until
  reviewed.
