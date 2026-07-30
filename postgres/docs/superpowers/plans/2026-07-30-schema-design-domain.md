# Schema Design & Constraints Domain Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a seventh domain, "Schema Design & Constraints," to the PostgreSQL Mastery module — teaching relational design theory and PostgreSQL constraint mechanics as one interleaved learning path.

**Architecture:** Pure content addition to an existing static site. Six data files under `postgres/js/data/` drive every view; `scripts/validate-content.mjs` is the test harness and enforces cross-file invariants (domain weights sum to 100, mock-exam counts sum to 50, each domain's question supply ≥ its mock count, every flashcard domain listed in `FLASHCARD_DOMAINS`). Each task uses that validator as its red-green cycle: make a change that the validator rejects, then complete the change until it passes.

**Tech Stack:** Plain ES modules, no build step. Node 22 for scripts and tests. Content sourced from PostgreSQL 18 docs at postgresql.org/docs/current/, plus canonical relational literature for theory.

## Global Constraints

- Spec: `postgres/docs/superpowers/specs/2026-07-30-schema-design-domain-design.md`. Read it before starting.
- Domain id is exactly `schema-design`; display name exactly `Schema Design & Constraints`; flashcard domain label exactly `Schema Design`.
- Domain sits **second** in `DOMAINS` (after Architecture) and `FLASHCARD_DOMAINS`. Array order determines render order in `js/views/studyGuide.js:18` and `js/views/quiz.js:95`.
- Final weights: architecture 13, schema-design 15, querying 17, indexing 17, transactions 13, administration 17, replication 8. Sum = 100.
- Final mock counts: architecture 7, schema-design 7, querying 9, indexing 9, transactions 6, administration 8, replication 4. Sum = 50.
- `multiple-choice` questions: exactly 4 options, exactly 1 correct index. `multiple-response`: at least 5 options, at least 2 correct indexes. Every explanation ≥ 20 characters.
- Study topic bodies must be ≥ 40 characters. Flashcard backs ≥ 20 characters.
- House style for flashcards: back is 1–3 dense prose sentences; front asks mechanism/why/tradeoff, not bare "What is X?"; the `service` label is always visible above the front and must never answer an identification-style front outright.
- **Sourcing discipline:** mechanics claims must be grounded in PostgreSQL 18 docs. Theory claims (normal forms, functional dependencies, anomalies, key theory, junction tables) must NOT be phrased as though the PostgreSQL docs asserted them, and are attributed to the relational literature (Codd for the relational model and 1NF–3NF; Boyce–Codd for BCNF).
- All work happens in the worktree at `.claude/worktrees/schema-design-domain` on branch `worktree-schema-design-domain`. Run all commands from `postgres/` unless stated otherwise.
- Do not touch any shared app-layer file (`js/app.js`, `js/lib/*`, `js/views/*`, `css/style.css`, `scripts/fetch-doc.mjs`, `scripts/validate-content.mjs`) — `scripts/check-drift.mjs` compares them byte-for-byte across all five modules.

---

### Task 1: Taxonomy — add the domain, rebalance weights, seed 7 questions

The validator makes this circular: a domain with `mockExamCount: 7` fails until 7 questions exist, and questions with `domain: 'schema-design'` fail until the domain exists. Both land in one commit.

**Files:**
- Modify: `postgres/js/data/examInfo.js:1-8`
- Modify: `postgres/js/data/questions.js` (append new section at end of `QUESTIONS`)

**Interfaces:**
- Consumes: nothing from earlier tasks.
- Produces: domain id `schema-design` usable by `question.domain` and `STUDY_CONTENT[].domain`; question ids `schema-design-001` through `schema-design-007`.

- [ ] **Step 1: Add the domain without rebalancing, to see the validator reject it**

In `postgres/js/data/examInfo.js`, insert as the second element of `DOMAINS`:

```js
export const DOMAINS = [
  { id: 'architecture', name: 'Architecture & Data Types', weight: 15, mockExamCount: 8 },
  { id: 'schema-design', name: 'Schema Design & Constraints', weight: 15, mockExamCount: 7 },
  { id: 'querying', name: 'Querying & SQL', weight: 20, mockExamCount: 10 },
  { id: 'indexing', name: 'Indexing & Performance', weight: 20, mockExamCount: 10 },
  { id: 'transactions', name: 'Transactions & Concurrency (MVCC)', weight: 15, mockExamCount: 7 },
  { id: 'administration', name: 'Administration & Maintenance', weight: 20, mockExamCount: 10 },
  { id: 'replication', name: 'Replication & High Availability', weight: 10, mockExamCount: 5 },
];
```

- [ ] **Step 2: Run the validator to verify it fails on the sums**

Run: `node scripts/validate-content.mjs`
Expected: FAIL, printing `DOMAINS weights must sum to 100, got 115` and `DOMAINS mockExamCount must sum to 50, got 57`.

- [ ] **Step 3: Rebalance the six existing domains**

Replace `DOMAINS` with the final values:

```js
export const DOMAINS = [
  { id: 'architecture', name: 'Architecture & Data Types', weight: 13, mockExamCount: 7 },
  { id: 'schema-design', name: 'Schema Design & Constraints', weight: 15, mockExamCount: 7 },
  { id: 'querying', name: 'Querying & SQL', weight: 17, mockExamCount: 9 },
  { id: 'indexing', name: 'Indexing & Performance', weight: 17, mockExamCount: 9 },
  { id: 'transactions', name: 'Transactions & Concurrency (MVCC)', weight: 13, mockExamCount: 6 },
  { id: 'administration', name: 'Administration & Maintenance', weight: 17, mockExamCount: 8 },
  { id: 'replication', name: 'Replication & High Availability', weight: 8, mockExamCount: 4 },
];
```

- [ ] **Step 4: Run the validator to verify sums pass but question supply fails**

Run: `node scripts/validate-content.mjs`
Expected: FAIL with `domain schema-design has 0 questions but mockExamCount is 7`. The weight and mock-count sum errors from Step 2 are gone.

- [ ] **Step 5: Fetch the source docs for the seed questions**

Fetch and read these pages before drafting. Every mechanics claim must be traceable to one of them:

- https://www.postgresql.org/docs/current/ddl-constraints.html
- https://www.postgresql.org/docs/current/ddl-identity-columns.html

Theory questions (001–005) draw on the relational literature, not these pages.

- [ ] **Step 6: Append the seven seed questions**

Add at the end of the `QUESTIONS` array in `postgres/js/data/questions.js`, preserving the file's existing comment-banner style. Two are written out in full below as the quality bar; draft 003–007 to the same standard from the manifest that follows.

```js
  // --- Schema design: foundations & keys (schema-design-001..007) ---
  {
    id: 'schema-design-001',
    domain: 'schema-design',
    questionType: 'multiple-choice',
    question: 'A table stores each order line together with the full customer address, repeated on every line. The customer moves, and only some rows get updated. What is this class of problem called?',
    options: [
      'A deletion anomaly, because removing a row loses unrelated facts.',
      'An update anomaly, because one fact is stored in many places and the copies can disagree.',
      'An insertion anomaly, because a new row cannot be added without unrelated data.',
      'A referential integrity violation, because a foreign key no longer matches its parent.',
    ],
    correctIndexes: [1],
    explanation: 'Storing one fact in multiple rows means every copy must be changed together. When an update reaches only some copies, the table now holds contradictory versions of the same fact — the update anomaly that normalization exists to prevent.',
  },
  {
    id: 'schema-design-002',
    domain: 'schema-design',
    questionType: 'multiple-choice',
    question: 'What does it mean to say that a functional dependency A -> B holds in a relation?',
    options: [
      'Every value of B appears at least once for some value of A.',
      'A and B always change together whenever a row is updated.',
      'Each value of A is associated with exactly one value of B across the whole relation.',
      'A is a foreign key that references the column B in another table.',
    ],
    correctIndexes: [2],
    explanation: 'A functional dependency A -> B says that fixing a value of A fixes the value of B: no two rows may share an A value while disagreeing on B. Identifying these dependencies is how redundancy is located, since a dependency on anything other than a whole candidate key signals a fact stored in the wrong place.',
  },
```

Manifest for the remaining five — draft each to the same standard:

| id | Type | Must test | Source |
| --- | --- | --- | --- |
| `schema-design-003` | multiple-choice | Insertion and deletion anomalies: why an unrelated fact cannot be recorded, or is lost, when two entities share one table | theory |
| `schema-design-004` | multiple-response | Which properties hold for a relation: unordered rows, unordered attributes, no duplicate rows, each cell a single value (≥5 options, ≥2 correct) | theory |
| `schema-design-005` | multiple-choice | Candidate key vs primary key: several candidates may exist; one is chosen as primary | theory |
| `schema-design-006` | multiple-choice | `UNIQUE` allows multiple nulls; `PRIMARY KEY` is `UNIQUE` plus `NOT NULL` | `ddl-constraints.html` |
| `schema-design-007` | multiple-choice | `GENERATED ALWAYS AS IDENTITY` rejects an explicit value unless `OVERRIDING SYSTEM VALUE` is given; `BY DEFAULT` accepts one | `ddl-identity-columns.html` |

- [ ] **Step 7: Run the validator to verify it passes**

Run: `node scripts/validate-content.mjs`
Expected: PASS — `All content validated successfully.`

- [ ] **Step 8: Run the unit tests**

Run: `node --test "js/lib/"*.test.mjs`
Expected: PASS, 0 failures.

- [ ] **Step 9: Commit**

```bash
git add postgres/js/data/examInfo.js postgres/js/data/questions.js
git commit -m "feat(postgres): add Schema Design domain and rebalance weights"
```

---

### Task 2: Study guide — five sections

**Files:**
- Modify: `postgres/js/data/studyContent.js` (insert new sections after the architecture sections, before the querying sections)

**Interfaces:**
- Consumes: domain id `schema-design` from Task 1.
- Produces: five `STUDY_CONTENT` entries whose `taskStatement` values the quiz questions and flashcards in Tasks 3 and 4 must stay consistent with.

- [ ] **Step 1: Confirm the validator currently passes**

Run: `node scripts/validate-content.mjs`
Expected: PASS. This is the baseline; if it already fails, stop and fix Task 1 before continuing.

- [ ] **Step 2: Fetch the source docs**

- https://www.postgresql.org/docs/current/ddl-constraints.html
- https://www.postgresql.org/docs/current/ddl-identity-columns.html
- https://www.postgresql.org/docs/current/ddl-generated-columns.html
- https://www.postgresql.org/docs/current/sql-createdomain.html
- https://www.postgresql.org/docs/current/rowtypes.html
- https://www.postgresql.org/docs/current/ddl-inherit.html
- https://www.postgresql.org/docs/current/sql-altertable.html (for `NOT VALID` / `VALIDATE CONSTRAINT`)

- [ ] **Step 3: Write the five sections**

Insert into `STUDY_CONTENT` after the last `domain: 'architecture'` section. Array order is render order. Section 1 is written out in full as the quality bar; write the rest from the manifest below to the same standard — prose paragraphs of roughly 80–140 words, no bullet lists, matching the surrounding file's voice.

```js
  {
    domain: 'schema-design',
    taskStatement: 'Relational Modeling Foundations',
    topics: [
      {
        title: 'Tables as Relations',
        body: "A relational table models a set of facts about one kind of thing. Because it is a set, no row order is guaranteed and the same row cannot meaningfully appear twice; because each row has the same named attributes, a column means the same thing in every row. This is why a query has to state its own ORDER BY to get a stable order, and why a table that mixes two kinds of things — orders and the customers who placed them — starts causing trouble immediately: attributes that describe only the customer end up repeated on every order line, and the table no longer describes a single kind of fact.",
      },
      {
        title: 'Redundancy and the Three Anomalies',
        body: "When one fact is stored in more than one place, the copies can disagree. Three failure modes follow. An update anomaly happens when a change reaches some copies and not others, leaving the table self-contradictory. An insertion anomaly happens when a fact cannot be recorded because unrelated data is missing — you cannot register a customer who has not yet placed an order, if customers only exist as columns on order rows. A deletion anomaly is the mirror image: removing the last order for a customer also erases the customer. These three anomalies, not elegance, are the practical reason to split tables apart.",
      },
      {
        title: 'Functional Dependencies',
        body: "A functional dependency A -> B holds when each value of A is associated with exactly one value of B: no two rows may agree on A while disagreeing on B. Dependencies are statements about the real world the data models, not about the rows that happen to be present, so they are decided from the domain rather than discovered by querying. They matter because they locate redundancy precisely. A dependency whose left side is a whole candidate key is fine — that is what a key means. A dependency on anything else means the table is recording a fact about something other than its own subject, and that fact will be repeated on every row that shares the value.",
      },
      {
        title: 'One Fact in One Place',
        body: "The design goal that falls out of the anomalies is simple to state: each fact should be recorded exactly once, in the table whose subject that fact is about. A customer's address is a fact about the customer, so it belongs on a customer row and is referenced from orders rather than copied into them. This principle is what the normal forms formalize — each successive form rules out another way a table can end up storing a fact about something other than its own key. Working out the grain of a table first, before writing any DDL, usually settles most design questions before they become arguments.",
      },
    ],
  },
```

Manifest for sections 2–5. Section 2 topics carry a mix of theory and documented mechanics; sections 3 is entirely documented mechanics; section 4 is entirely theory; section 5 is mixed.

**Section 2 — `taskStatement: 'Keys and Identity'`** (4 topics)

| Title | Content | Source |
| --- | --- | --- |
| `Candidate Keys, Primary Keys, and Composite Keys` | A candidate key is any minimal attribute set that uniquely identifies a row; a table may have several, one of which is designated primary. Composite keys span multiple columns | theory |
| `Natural Versus Surrogate Keys` | Natural keys carry meaning and can change or turn out not to be unique; surrogates are meaningless, stable, and compact but require a uniqueness constraint on the natural key anyway to prevent duplicates | theory |
| `Identity Columns and serial` | `GENERATED ALWAYS`/`BY DEFAULT AS IDENTITY` versus the `serial` shorthand; `OVERRIDING SYSTEM VALUE`; neither guarantees uniqueness without a constraint | `ddl-identity-columns.html` |
| `UNIQUE Versus PRIMARY KEY` | `UNIQUE` permits multiple nulls because nulls are never equal; `PRIMARY KEY` is `UNIQUE` plus `NOT NULL`; a table may have many unique constraints but one primary key | `ddl-constraints.html` |

**Section 3 — `taskStatement: 'Constraints and Referential Integrity'`** (7 topics)

| Title | Content | Source |
| --- | --- | --- |
| `CHECK and NOT NULL: Validating a Row Against Itself` | Boolean expression per row; a check passes when it evaluates true or null; `NOT NULL` as the common case with its own syntax | `ddl-constraints.html` |
| `Declaring a Foreign Key` | A foreign key requires each non-null value to match a row in the referenced table, which must have a unique or primary key on those columns | `ddl-constraints.html` |
| `Referential Actions` | `NO ACTION` (default), `RESTRICT`, `CASCADE`, `SET NULL`, `SET DEFAULT`, for both `ON DELETE` and `ON UPDATE`; what each does to referencing rows | `ddl-constraints.html` |
| `NO ACTION Versus RESTRICT` | Both reject the operation, but `NO ACTION` allows the check to be deferred to end of transaction while `RESTRICT` fires immediately and cannot be deferred | `ddl-constraints.html` |
| `Deferrable Constraints` | `DEFERRABLE INITIALLY DEFERRED` postpones checking to commit, which is what makes mutually-referencing inserts and key swaps possible; `SET CONSTRAINTS` controls it per transaction | `ddl-constraints.html`, `sql-set-constraints.html` |
| `MATCH FULL Versus MATCH SIMPLE` | The default composite-FK matching mode lets a partially-null reference escape the constraint; `MATCH FULL` requires all-or-nothing | `ddl-constraints.html` |
| `Adding Constraints to a Live Table` | `NOT VALID` adds a constraint enforced only for new rows without scanning the table, then `VALIDATE CONSTRAINT` checks existing rows under a weaker lock | `sql-altertable.html` |

**Section 4 — `taskStatement: 'Normalization and Relationships'`** (5 topics, all theory)

| Title | Content |
| --- | --- |
| `First Normal Form` | Each cell holds a single value; no repeating groups or lists crammed into one column |
| `Second Normal Form` | With a composite key, no non-key attribute may depend on only part of the key |
| `Third Normal Form` | No non-key attribute may depend on another non-key attribute — no transitive dependencies |
| `Boyce-Codd Normal Form` | Every determinant must be a candidate key; the case 3NF permits and BCNF rules out |
| `Modeling Relationships` | One-to-many via a foreign key on the many side; many-to-many via a junction table whose primary key is the pair of foreign keys |

Use one running example (orders, customers, products) across all five topics so the progression is visible.

**Section 5 — `taskStatement: 'Design Tradeoffs in PostgreSQL'`** (4 topics)

| Title | Content | Source |
| --- | --- | --- |
| `Denormalizing Deliberately` | Trading write cost and the risk of divergence for read speed; only worth it against a measured problem, and the redundancy must then be maintained by something | theory |
| `Generated Columns` | A stored generated column computes from other columns in the same row and cannot be written directly — derived data the database maintains rather than the application | `ddl-generated-columns.html` |
| `Domains and Composite Types` | A domain is a reusable type plus constraints, so one rule is declared once and reused; composite types group fields but are usually the wrong choice where a related table belongs | `sql-createdomain.html`, `rowtypes.html` |
| `Inheritance Versus Declarative Partitioning` | Table inheritance predates partitioning and does not enforce constraints across children the way partitioning does; declarative partitioning is the right tool for splitting one table by key | `ddl-inherit.html` |

- [ ] **Step 4: Run the validator**

Run: `node scripts/validate-content.mjs`
Expected: PASS. A body under 40 characters fails with `topic "<title>" body too short`.

- [ ] **Step 5: Verify the study guide renders seven domains**

Run: `python3 -m http.server 8002` from `postgres/`, open `http://localhost:8002/#/study`, confirm seven domains listed with the new weights, and that clicking Schema Design & Constraints shows five sections in the order above.

- [ ] **Step 6: Commit**

```bash
git add postgres/js/data/studyContent.js
git commit -m "feat(postgres): add Schema Design study guide sections"
```

---

### Task 3: Quiz — remaining 15 questions

**Files:**
- Modify: `postgres/js/data/questions.js` (extend the schema-design section)

**Interfaces:**
- Consumes: domain id and question-id sequence from Task 1; section content from Task 2.
- Produces: question ids `schema-design-008` through `schema-design-022`, bringing the domain's supply to 22.

- [ ] **Step 1: Confirm the baseline passes**

Run: `node scripts/validate-content.mjs`
Expected: PASS.

- [ ] **Step 2: Fetch the source docs**

Same pages as Task 2, Step 2. Every mechanics question must cite one; theory questions must not.

- [ ] **Step 3: Write the fifteen questions**

Append to the schema-design section. Manifest — each must test the stated point, with plausible distractors drawn from real misconceptions rather than obvious filler:

| id | Type | Must test | Source |
| --- | --- | --- | --- |
| `schema-design-008` | multiple-choice | A `CHECK` constraint passes when the expression is true **or null**, so a null column value does not fail a check | `ddl-constraints.html` |
| `schema-design-009` | multiple-response | What a foreign key requires: referenced columns need a unique/primary key; null referencing values are permitted; the reference may be to the same table | `ddl-constraints.html` |
| `schema-design-010` | multiple-choice | `ON DELETE CASCADE` deletes referencing rows; distractors offer `SET NULL` and `RESTRICT` behavior | `ddl-constraints.html` |
| `schema-design-011` | multiple-choice | `ON DELETE SET NULL` sets referencing columns to null rather than deleting the row | `ddl-constraints.html` |
| `schema-design-012` | multiple-choice | `NO ACTION` versus `RESTRICT`: only `NO ACTION` allows the check to be deferred | `ddl-constraints.html` |
| `schema-design-013` | multiple-choice | Why `DEFERRABLE INITIALLY DEFERRED` makes a circular insert or a key swap possible | `ddl-constraints.html` |
| `schema-design-014` | multiple-choice | `MATCH FULL` on a composite foreign key: a row escapes the constraint only if **all** referencing columns are null | `ddl-constraints.html` |
| `schema-design-015` | multiple-choice | `NOT VALID` enforces the constraint for new rows without scanning existing ones; `VALIDATE CONSTRAINT` checks them later | `sql-altertable.html` |
| `schema-design-016` | multiple-choice | A table violating 1NF: a comma-separated list in one column | theory |
| `schema-design-017` | multiple-choice | A 2NF violation: a non-key attribute depending on part of a composite key | theory |
| `schema-design-018` | multiple-choice | A 3NF violation: a transitive dependency between two non-key attributes | theory |
| `schema-design-019` | multiple-choice | What BCNF requires beyond 3NF — every determinant is a candidate key | theory |
| `schema-design-020` | multiple-response | Modeling a many-to-many relationship with a junction table: which statements hold (≥5 options, ≥2 correct) | theory |
| `schema-design-021` | multiple-choice | A stored generated column cannot be written directly by `INSERT`/`UPDATE` | `ddl-generated-columns.html` |
| `schema-design-022` | multiple-choice | What a domain gives that a bare column type does not — a reusable named type carrying its constraints | `sql-createdomain.html` |

- [ ] **Step 4: Run the validator**

Run: `node scripts/validate-content.mjs`
Expected: PASS. Shape violations report as e.g. `multiple-choice question schema-design-016 must have exactly 4 options`.

- [ ] **Step 5: Verify the question count**

Run:

```bash
node -e "import('./js/data/questions.js').then(m=>console.log(m.QUESTIONS.filter(q=>q.domain==='schema-design').length))"
```

Expected: `22`

- [ ] **Step 6: Commit**

```bash
git add postgres/js/data/questions.js
git commit -m "feat(postgres): complete the Schema Design quiz bank"
```

---

### Task 4: Flashcards — new domain, 16 new cards, 1 migration

**Files:**
- Modify: `postgres/js/data/flashcards.js` (`FLASHCARD_DOMAINS`, new card section, two `domain` field edits)

**Interfaces:**
- Consumes: nothing from Tasks 1–3 structurally; content must stay consistent with Task 2's sections.
- Produces: deck of 133 cards; Anki tag `postgres::schema-design`. (`exclusion-constraint` was later returned to Architecture — see the spec's Migrations note.)

- [ ] **Step 1: Migrate one card first, to see the validator reject the unknown domain**

In `postgres/js/data/flashcards.js`, change the `exclusion-constraint` card's `domain` from `'Architecture'` to `'Schema Design'`.

- [ ] **Step 2: Run the validator to verify it fails**

Run: `node scripts/validate-content.mjs`
Expected: FAIL with `flashcard exclusion-constraint domain not in FLASHCARD_DOMAINS: Schema Design`.

- [ ] **Step 3: Register the domain and migrate the second card**

Update the constant, inserting second:

```js
export const FLASHCARD_DOMAINS = [
  'Architecture',
  'Schema Design',
  'Querying',
  'Indexing',
  'Transactions',
  'Administration',
  'Replication',
];
```

Then change the `identity-vs-serial` card's `domain` from `'Administration'` to `'Schema Design'`.

- [ ] **Step 4: Run the validator to verify it passes**

Run: `node scripts/validate-content.mjs`
Expected: PASS.

- [ ] **Step 5: Fetch the source docs**

Same pages as Task 2, Step 2.

- [ ] **Step 6: Write the sixteen new cards**

Add a `// --- Schema Design & Constraints ---` section after the Architecture block. Two are written out in full as the quality bar; write the rest from the manifest to the same standard.

```js
  {
    id: 'redundancy-anomalies',
    service: 'Redundancy',
    domain: 'Schema Design',
    front: 'Storing a customer address on every order line is redundant. What three concrete failure modes does that redundancy cause?',
    back: "An update anomaly, where changing the address reaches some copies and not others and leaves the table contradicting itself; an insertion anomaly, where a customer who has not yet ordered cannot be recorded at all because there is no row to hold them; and a deletion anomaly, where removing a customer's last order also erases the customer. These three failures, rather than any aesthetic preference, are what normalization exists to prevent.",
  },
  {
    id: 'no-action-vs-restrict',
    service: 'Referential Actions',
    domain: 'Schema Design',
    front: 'ON DELETE NO ACTION and ON DELETE RESTRICT both refuse to orphan a row. What actually differs between them?',
    back: 'Timing. NO ACTION, the default, lets the check be deferred to the end of the transaction if the constraint is declared deferrable, so an intermediate state that would violate it is tolerated as long as things are consistent by commit. RESTRICT fires immediately and cannot be deferred, which rules out that intermediate state entirely.',
  },
```

> **Correction (found during Task 6 verification):** this exemplar's back is
> wrong and must NOT be copied. Timing is not the only difference — the
> PostgreSQL docs state plainly that "RESTRICT is a stricter setting than NO
> ACTION," a substantive difference beyond deferrability. The shipped card
> reflects the corrected wording; see `js/data/flashcards.js`.

Manifest for the remaining fourteen:

| id | `service` label | Front tests | Source |
| --- | --- | --- | --- |
| `functional-dependency` | `Functional Dependency` | What A -> B asserts, and why it is decided from the domain rather than from current rows | theory |
| `natural-vs-surrogate-key` | `Key Selection` | The tradeoff, and why a surrogate does not remove the need for a unique constraint on the natural key | theory |
| `unique-vs-primary-key` | `Uniqueness Constraints` | `UNIQUE` allows multiple nulls since nulls are never equal; `PRIMARY KEY` = `UNIQUE` + `NOT NULL` | `ddl-constraints.html` |
| `check-constraint` | `CHECK Constraint` | Passes when the expression is true **or null** — the null loophole | `ddl-constraints.html` |
| `foreign-key-basics` | `Foreign Key` | Referenced columns must carry a unique or primary key; null referencing values are allowed | `ddl-constraints.html` |
| `referential-actions` | `ON DELETE / ON UPDATE` | The five actions and what each does to referencing rows | `ddl-constraints.html` |
| `deferrable-constraints` | `Constraint Timing` | What deferring to commit enables (circular inserts, key swaps) and the `SET CONSTRAINTS` control | `ddl-constraints.html` |
| `match-full` | `Composite FK Matching` | `MATCH FULL` requires all-null or all-matching; a mix always fails | `ddl-constraints.html` |
| `not-valid-constraint` | `Constraint Rollout` | `NOT VALID` skips the scan and binds only new rows; `VALIDATE CONSTRAINT` checks the rest later | `sql-altertable.html` |
| `first-normal-form` | `1NF` | Single value per cell; what a repeating group looks like in practice | theory |
| `second-third-normal-form` | `2NF and 3NF` | Partial dependency on part of a composite key vs transitive dependency between non-key attributes | theory |
| `bcnf` | `BCNF` | Every determinant must be a candidate key; the overlapping-candidate-key case 3NF allows | theory |
| `junction-table` | `Many-to-Many` | Why a junction table is required, and what its primary key normally is | theory |
| `generated-columns` | `Generated Column` | Computed from the same row, not directly writable — derived data the database maintains | `ddl-generated-columns.html` |

- [ ] **Step 7: Run the validator and confirm the counts**

Run:

```bash
node scripts/validate-content.mjs && node -e "import('./js/data/flashcards.js').then(m=>{const c={};for(const x of m.FLASHCARDS)c[x.domain]=(c[x.domain]||0)+1;console.log(c,'total',m.FLASHCARDS.length)})"
```

Expected: validator PASS, then `Architecture: 20, Schema Design: 17, Querying: 16, Indexing: 18, Transactions: 15, Administration: 31, Replication: 16` and `total 133`.

- [ ] **Step 8: Regenerate the Anki export**

Run from the repository root: `node scripts/export-anki.mjs`
Expected: `postgres: 133 cards → anki/postgres.txt`

- [ ] **Step 9: Commit**

```bash
git add postgres/js/data/flashcards.js
git commit -m "feat(postgres): add Schema Design flashcards and migrate two cards"
```

---

### Task 5: README and cheatsheet

**Files:**
- Modify: `postgres/README.md:23` (domain list), `postgres/README.md:32` (sourcing note)
- Modify: `postgres/cheatsheet.html:242-252` (Study Domains table) and one new section in the sheet body

**Interfaces:**
- Consumes: final weights from Task 1; section titles from Task 2.
- Produces: no code interface.

- [ ] **Step 1: Update the README domain list**

Replace line 23's `organized by 6 domains:` sentence with a seven-domain version naming `Schema Design & Constraints` second.

- [ ] **Step 2: Add the second sourcing exception**

In the `## How the content was sourced` paragraph, change `with one exception` to `with two exceptions`, keep the existing PgBouncer clause, and add: normalization theory — normal forms, functional dependencies, and the anomalies they prevent — is not part of the PostgreSQL documentation, which is implementation-focused by design; that material draws on the canonical relational literature (Codd for the relational model and first through third normal forms, Boyce–Codd for BCNF), and no theory claim in this module is attributed to the PostgreSQL docs.

- [ ] **Step 3: Update the cheatsheet Study Domains table**

In `postgres/cheatsheet.html`, replace the six `<tr>` rows in the Study Domains table with seven, using the final weights, Schema Design second:

```html
              <tr><td>Architecture &amp; Data Types</td><td class="mono">13%</td></tr>
              <tr><td>Schema Design &amp; Constraints</td><td class="mono">15%</td></tr>
              <tr><td>Querying &amp; SQL</td><td class="mono">17%</td></tr>
              <tr><td>Indexing &amp; Performance</td><td class="mono">17%</td></tr>
              <tr><td>Transactions &amp; Concurrency</td><td class="mono">13%</td></tr>
              <tr><td>Administration &amp; Maintenance</td><td class="mono">17%</td></tr>
              <tr><td>Replication &amp; HA</td><td class="mono">8%</td></tr>
```

- [ ] **Step 4: Add a Schema Design block to the cheatsheet body**

Add one `<section class="sec">` following the existing pattern — an `<h2>` of `Constraints &amp; Keys` and a `<ul class="ol">` of terse reference lines covering: the five referential actions; `NO ACTION` deferrable vs `RESTRICT` not; `CHECK` passes on true **or null**; `UNIQUE` allows multiple nulls, `PRIMARY KEY` = `UNIQUE` + `NOT NULL`; `MATCH FULL` all-or-nothing; `NOT VALID` then `VALIDATE CONSTRAINT`; 1NF/2NF/3NF/BCNF in one line each.

**This block must be placed outside the `<!-- shared-scaffold:start -->` / `<!-- shared-scaffold:end -->` markers.** Content inside those markers is compared byte-for-byte across all five modules and any edit there breaks the drift check.

- [ ] **Step 5: Run the drift check**

Run from the repository root: `node scripts/check-drift.mjs`
Expected: `No drift across 5 modules (18 shared files + cheatsheet scaffold).`

- [ ] **Step 6: Verify the cheatsheet renders**

Open `http://localhost:8002/cheatsheet.html`, confirm the seven-row domain table and the new Constraints & Keys section, and that the print layout still fits its page.

- [ ] **Step 7: Commit**

```bash
git add postgres/README.md postgres/cheatsheet.html
git commit -m "docs(postgres): document the Schema Design domain and its sourcing exception"
```

---

### Task 6: Adversarial verification and full mechanical pass

**Files:**
- Modify: any content file where verification finds an error.

**Interfaces:**
- Consumes: everything from Tasks 1–5.
- Produces: a verified domain.

- [ ] **Step 1: Run the full mechanical suite**

From `postgres/`:

```bash
node scripts/validate-content.mjs && node --test "js/lib/"*.test.mjs
```

Then from the repository root:

```bash
node scripts/check-drift.mjs && node scripts/export-anki.mjs
```

Expected: validator PASS, tests 0 failures, no drift, `postgres: 133 cards`.

- [ ] **Step 2: Fact-check every new item adversarially**

Dispatch one verifier per new study topic, quiz question, and flashcard — each instructed to refute rather than confirm, and to fetch the live documentation itself. Two distinct rules apply:

- **Mechanics items** are checked against the live PostgreSQL 18 page for their topic. Any claim not supported by the page is a failure.
- **Theory items** are checked for correctness against the relational literature *and* for attribution: a theory item that reads as though the PostgreSQL docs asserted it is a failure even when the content is right.

Record each verdict with the URL checked. Apply every confirmed correction, then re-run Step 1.

- [ ] **Step 3: Check for cross-domain contradictions**

Sweep the new items against the existing 117-card deck and 132 questions for contradictions and true duplication — particularly `exclusion-constraint` against `range-type`, `identity-vs-serial` against `sequence`, `unique-vs-primary-key` against the partial-unique-index material in the Indexing domain, and `generated-columns` against the full-text-search indexing topic. Complementary reinforcement from a different angle is deliberate house style and is not a finding; only same-fact-same-angle duplication or outright contradiction is.

- [ ] **Step 4: Live application check**

Serve `postgres/` and confirm, with the browser console open:

- `#/study` lists seven domains with weights 13/15/17/17/13/17/8
- `#/study/schema-design` shows five sections in the planned order
- `#/quiz` lists Schema Design & Constraints with 22 questions
- `#/flashcards` reports `Card 1 of 133`
- `#/exam` starts and draws a 50-question exam
- Console is free of errors

- [ ] **Step 5: Commit any fixes**

```bash
git add -A postgres/
git commit -m "fix(postgres): apply Schema Design verification corrections"
```

---

## Self-Review

**Spec coverage.** Taxonomy and weights → Task 1. Five study sections → Task 2. ~22 quiz questions → Tasks 1 and 3 (7 + 15). ~16 flashcards and both migrations → Task 4. Sourcing exception and README → Task 5. Cheatsheet → Task 5. Verification approach → Task 6. Out-of-scope items (Anki upload, sibling modules, deployment) are correctly absent.

**Counts reconciled with the spec.** Spec states 133 cards; final split is Architecture 20 / Schema Design 17 after the exclusion-constraint migration was reverted (see the spec's Migrations note). Spec states "~20 topics"; this plan specifies 24 (4+4+7+5+4), a deliberate upward adjustment to cover all six referential actions and BCNF properly. Spec states "~22 questions"; this plan specifies exactly 22.

**Placeholder scan.** No TBD or TODO. Content-authoring steps carry either full exemplars or a per-item manifest naming the exact id, the exact point to test, and the exact source page — specific enough to implement without further decisions, while the prose is written against live docs at execution time as the spec requires.

**Type and name consistency.** Domain id `schema-design` and label `Schema Design` are used identically in Tasks 1–5. Question ids run `schema-design-001`–`022` with no gaps across Tasks 1 and 3. Card ids in Task 4's manifest are unique and do not collide with any of the 117 existing ids. Weight and mock-count figures are identical in the Global Constraints, Task 1, and Task 5.
