# SRE Mastery

An unofficial study guide for general Site Reliability Engineering knowledge, drawing on Google's publicly available SRE Book and Workbook. Not tied to any certification — none exists industry-wide for SRE — and not affiliated with or endorsed by Google.

A companion to [`aws/`](../aws), [`kubernetes/`](../kubernetes), [`postgres/`](../postgres), and [`networking/`](../networking).

## Reading it

No install step, no server. Open [`study/`](study), [`questions.md`](questions.md), and [`flashcards.md`](flashcards.md) directly in any markdown viewer (GitHub, VS Code, Obsidian, etc.) — questions and flashcards hide their answers in collapsed `<details>` blocks so you can still self-test. [`cheatsheet.html`](cheatsheet.html) is a standalone HTML page — open it by double-click, no server needed.

## A note on scope

There is no single, industry-wide Site Reliability Engineering certification the way there is for AWS (SAA-C03) or Kubernetes (CKA). This module's 6-domain taxonomy is self-authored, grounded primarily in Google's "Site Reliability Engineering" book and "The Site Reliability Workbook" — the field's most influential published references, but one company's perspective on SRE, not a vendor-neutral standard. The questions in [`questions.md`](questions.md) are a self-test, not a simulation of any vendor's exam.

## What's here

- **Study guide** — [`study/`](study), organized by 6 domains: SLIs/SLOs & Error Budgets, Monitoring/Observability & Alerting, Incident Response/On-Call & Postmortems, Capacity Planning & Managing Load, Release Engineering & Change Management, and Reliability Patterns & Toil Reduction.
- **Question bank** — [`questions.md`](questions.md), 137 practice questions with explanations, answers collapsed until you expand them.
- **Flashcards** — [`flashcards.md`](flashcards.md), 93 cards covering core SRE vocabulary and concepts.
- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference distilled from the study guide and flashcards.

## How the content was sourced

All content is grounded in Google's "Site Reliability Engineering" book and "The Site Reliability Workbook," both freely readable at sre.google (chapter URLs confirmed live as of 2026-07-10). Every question was drafted from and checked against the relevant cached chapter before being added. Fetched pages are cached locally under `.cache/docs/` (gitignored; directory name kept for consistency with tooling shared with the other modules) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

From the repo root:

- `node scripts/export-anki.mjs sre` — exports this module's flashcard deck to `anki/sre.txt`.
- `node --test scripts/lib/*.test.mjs` — runs the flashcard-markdown parser's unit tests.

From this directory:

- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.

`scripts/fetch-doc.mjs` and the shared-scaffold block inside `cheatsheet.html` are the only things still required to be byte-identical with the sibling modules — `node scripts/check-drift.mjs` at the repo root checks both.
