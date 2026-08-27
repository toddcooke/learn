# AWS SAA-C03 Exam Prep

An unofficial study guide for the AWS Certified Solutions Architect – Associate (SAA-C03) exam. Not affiliated with or endorsed by AWS.

A companion to [`kubernetes/`](../kubernetes), [`postgres/`](../postgres), [`sre/`](../sre), and [`networking/`](../networking).

## Reading it

No install step, no server. Open [`study/`](study), [`questions.md`](questions.md), [`flashcards.md`](flashcards.md), and [`services.md`](services.md) directly in any markdown viewer (GitHub, VS Code, Obsidian, etc.) — questions and flashcards hide their answers in collapsed `<details>` blocks so you can still self-test. [`cheatsheet.html`](cheatsheet.html), [`exam-shortcut.html`](exam-shortcut.html), and [`vpc-explorer.html`](vpc-explorer.html) are standalone HTML pages — open them by double-click, no server needed.

## What's here

- **Study guide** — [`study/`](study), organized by the exam's 4 official domains and their task statements.
- **Question bank** — [`questions.md`](questions.md), 119 practice questions with explanations, answers collapsed until you expand them.
- **Flashcards** — [`flashcards.md`](flashcards.md), 89 service-by-service cards, one-way (front asks, back explains).
- **Services at a glance** — [`services.md`](services.md), every covered service with a one-sentence description, grouped by domain.
- **[VPC & Subnet Explorer](vpc-explorer.html)** — a standalone interactive page for clicking through a worked 3-tier/3-AZ VPC's subnets, tracing packets through its route tables, and playing with CIDR math.
- **[The exam shortcut](exam-shortcut.html)** — a standalone static reference mapping the trigger phrases SAA-C03 stems use to the service each one points at, plus the look-alike service pairs and the qualifier clauses that break a tie between two plausible answers. Hand-maintained plain HTML with no script, like the cheatsheet.
- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference distilled from the study guide and flashcards.

## How the content was sourced

Exam structure, domain weightings, and task statements come from AWS's official SAA-C03 exam guide (docs.aws.amazon.com), fetched 2026-07-07 — see [docs/superpowers/specs/2026-07-07-aws-saa-exam-prep-design.md](docs/superpowers/specs/2026-07-07-aws-saa-exam-prep-design.md) for details. Every question was drafted from and checked against the relevant AWS service documentation before being added. Fetched doc pages are cached locally under `.cache/docs/` (gitignored) so re-running the content pipeline doesn't re-hit AWS for pages already fetched.

## Development

From the repo root:

- `node scripts/export-anki.mjs aws` — exports this module's flashcard deck to `anki/aws.txt`.
- `node --test scripts/lib/*.test.mjs` — runs the flashcard-markdown parser's unit tests.

From this directory:

- `node scripts/fetch-doc.mjs <url>` — fetches and caches an AWS doc page for content research.
