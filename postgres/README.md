# PostgreSQL Mastery

An unofficial study site for general PostgreSQL knowledge. Not tied to any specific certification — the PostgreSQL Global Development Group doesn't run one — and not affiliated with or endorsed by the PostgreSQL Global Development Group.

Live at https://toddcooke.github.io/learn/postgres/. A companion to https://toddcooke.github.io/learn/aws/ and https://toddcooke.github.io/learn/kubernetes/.

## Running it

No install step. From this directory:

```
python3 -m http.server 8002
```

Then open http://localhost:8002/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## A note on scope

There is no single, universally recognized PostgreSQL certification the way there is for AWS (SAA-C03) or Kubernetes (CKA). This site's 6-domain taxonomy is self-authored, covering both DBA and application-development knowledge, grounded in the official PostgreSQL documentation rather than an official exam blueprint. The "practice exam" is a self-test, not a simulation of any vendor's exam.

## What's here

- **Study guide** — organized by 6 domains: Architecture & Data Types, Querying & SQL, Indexing & Performance, Transactions & Concurrency (MVCC), Administration & Maintenance, and Replication & High Availability.
- **Domain quizzes** — 132 practice questions with instant feedback and explanations.
- **Flashcards** — a cheat-sheet deck of core PostgreSQL objects and concepts with known/unknown tracking.
- **Practice exam** — a 50-question, 75-minute timed self-test weighted by domain, scored on a 0-100 scale against an informal 70-point passing line.
- **Progress dashboard** — quiz and practice exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).
- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference distilled from the study guide and flashcards, linked from Home.

## How the content was sourced

All content is grounded in the official PostgreSQL 18 documentation at postgresql.org/docs/current/ (confirmed current stable as of 2026-07-09), with one exception: connection pooling, which PostgreSQL core doesn't document at all (confirmed during planning) — that sub-topic draws from the official PgBouncer docs instead. Every quiz question was drafted from and checked against the relevant cached documentation before being added. Fetched doc pages are cached locally under `.cache/docs/` (gitignored; directory name kept for consistency with tooling shared with the other two modules) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

This project's application code (router, storage/scoring libraries, view components, content tooling) is shared architecture with the sibling [`aws/`](../aws) and [`kubernetes/`](../kubernetes) modules in this repo — only the content data files and two small mock-exam edits differ. See those modules' READMEs for more on the shared tooling itself.

- `node --test "js/lib/*.test.mjs"` — runs unit tests for the pure storage/scoring logic (the bare-directory form `node --test js/lib` fails on some Node versions; use the glob form).
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.
