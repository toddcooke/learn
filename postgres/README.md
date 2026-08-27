# PostgreSQL Mastery

An unofficial study guide for general PostgreSQL knowledge. Not tied to any specific certification — the PostgreSQL Global Development Group doesn't run one — and not affiliated with or endorsed by the PostgreSQL Global Development Group.

A companion to [`aws/`](../aws), [`kubernetes/`](../kubernetes), [`sre/`](../sre), and [`networking/`](../networking).

## Reading it

No install step, no server. Open [`study/`](study), [`questions.md`](questions.md), and [`flashcards.md`](flashcards.md) directly in any markdown viewer (GitHub, VS Code, Obsidian, etc.) — questions and flashcards hide their answers in collapsed `<details>` blocks so you can still self-test. [`cheatsheet.html`](cheatsheet.html) is a standalone HTML page — open it by double-click, no server needed.

## A note on scope

There is no single, universally recognized PostgreSQL certification the way there is for AWS (SAA-C03) or Kubernetes (CKA). This module's 7-domain taxonomy is self-authored, covering both DBA and application-development knowledge, grounded in the official PostgreSQL documentation rather than an official exam blueprint. The questions in [`questions.md`](questions.md) are a self-test, not a simulation of any vendor's exam.

## What's here

- **Study guide** — [`study/`](study), organized by 7 domains: Architecture & Data Types, Schema Design & Constraints, Querying & SQL, Indexing & Performance, Transactions & Concurrency (MVCC), Administration & Maintenance, and Replication & High Availability.
- **Question bank** — [`questions.md`](questions.md), 154 practice questions with explanations, answers collapsed until you expand them.
- **Flashcards** — [`flashcards.md`](flashcards.md), 133 cards covering core PostgreSQL objects and concepts.
- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference distilled from the study guide and flashcards.

## How the content was sourced

All content is grounded in the official PostgreSQL 18 documentation at postgresql.org/docs/current/ (confirmed current stable as of 2026-07-09), with two exceptions: connection pooling, which PostgreSQL core doesn't document at all (confirmed during planning) — that sub-topic draws from the official PgBouncer docs instead; and normalization theory — normal forms, functional dependencies, and the anomalies they prevent — is not part of the PostgreSQL documentation, which is implementation-focused by design; that material draws on the canonical relational literature (Codd for the relational model and first through third normal forms, Boyce–Codd for BCNF), and no theory claim in this module is attributed to the PostgreSQL docs. Every question was drafted from and checked against the relevant cached documentation before being added. Fetched doc pages are cached locally under `.cache/docs/` (gitignored; directory name kept for consistency with tooling shared with the other modules) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

From the repo root:

- `node scripts/export-anki.mjs postgres` — exports this module's flashcard deck to `anki/postgres.txt`.
- `node --test scripts/lib/*.test.mjs` — runs the flashcard-markdown parser's unit tests.

From this directory:

- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.

`scripts/fetch-doc.mjs` and the shared-scaffold block inside `cheatsheet.html` are the only things still required to be byte-identical with the sibling modules — `node scripts/check-drift.mjs` at the repo root checks both.
