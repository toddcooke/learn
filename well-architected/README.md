# AWS Well-Architected Framework

An unofficial flashcard deck covering the AWS Well-Architected Framework — its six pillars, their design principles and best practice areas, the shared vocabulary, and the review process. Not affiliated with or endorsed by AWS.

A companion to [`aws/`](../aws), [`kubernetes/`](../kubernetes), [`postgres/`](../postgres), [`sre/`](../sre), and [`networking/`](../networking).

## Reading it

No install step, no server. Open [`flashcards.md`](flashcards.md) directly in any markdown viewer (GitHub, VS Code, Obsidian, etc.) — every answer is hidden in a collapsed `<details>` block so you can self-test. [`cheatsheet.html`](cheatsheet.html) is a standalone HTML page — open it by double-click, no server needed.

## A note on scope

The Well-Architected Framework is not a certification, and there is no exam behind this module. It is a set of foundational questions AWS uses to review architectures, so this deck is built for recall of the framework itself: the six pillars, the design principles under each, the best practice areas each pillar decomposes into, and the terminology a review depends on. It is a useful supplement to [`aws/`](../aws) (SAA-C03), which covers the services the framework's answers are usually built from, but the two decks overlap very little on purpose — this one stays on the framework, not on service selection.

This module is **flashcards only**. It has no `study/` directory and no `questions.md`, unlike its five siblings.

## What's here

- **Flashcards** — [`flashcards.md`](flashcards.md), 112 cards across 7 domains: Framework Foundations, and one domain per pillar (Operational Excellence, Security, Reliability, Performance Efficiency, Cost Optimization, Sustainability).
- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference: all six pillars with their design principles and best practice areas, the general design principles, the vocabulary, and the review process.

## How the content was sourced

Everything is grounded in the AWS Well-Architected Framework documentation at `docs.aws.amazon.com/wellarchitected/latest/framework/` (publication date November 6, 2024) and the [Well-Architected homepage](https://aws.amazon.com/architecture/well-architected/), fetched 2026-08-28. Every card was drafted from the relevant cached page and written in the author's own words, not copied verbatim. Fetched pages are cached locally under `.cache/docs/` (gitignored) so re-running the content pipeline doesn't re-hit AWS for pages already fetched.

## Development

From the repo root:

- `node scripts/export-anki.mjs well-architected` — exports this module's flashcard deck to `anki/well-architected.txt`.
- `node --test scripts/lib/*.test.mjs` — runs the flashcard-markdown parser's unit tests.

From this directory:

- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.

`scripts/fetch-doc.mjs` and the shared-scaffold block inside `cheatsheet.html` are the only things still required to be byte-identical with the sibling modules — `node scripts/check-drift.mjs` at the repo root checks both.
