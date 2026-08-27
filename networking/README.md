# CompTIA Network+ (N10-009) Prep

An unofficial study guide for the CompTIA Network+ certification (exam N10-009). Not affiliated with or endorsed by CompTIA.

A companion to [`aws/`](../aws), [`kubernetes/`](../kubernetes), [`postgres/`](../postgres), and [`sre/`](../sre).

## Reading it

No install step, no server. Open [`study/`](study), [`questions.md`](questions.md), and [`flashcards.md`](flashcards.md) directly in any markdown viewer (GitHub, VS Code, Obsidian, etc.) — questions and flashcards hide their answers in collapsed `<details>` blocks so you can still self-test. [`cheatsheet.html`](cheatsheet.html) is a standalone HTML page — open it by double-click, no server needed.

## A note on format

The real N10-009 exam is a maximum of 90 questions (multiple-choice AND performance-based/simulation), 90 minutes, passing score 720 on a 100–900 scale. This module's practice questions test the same underlying knowledge in multiple-choice/multiple-response form only — the performance-based simulation questions aren't replicated here. Pair this with hands-on lab practice (e.g. Cisco Packet Tracer or GNS3) for genuine exam readiness.

## What's here

- **Study guide** — [`study/`](study), organized by the exam's 5 official domains: Networking Concepts, Network Implementation, Network Operations, Network Security, Network Troubleshooting.
- **Question bank** — [`questions.md`](questions.md), 127 practice questions with explanations, answers collapsed until you expand them.
- **Flashcards** — [`flashcards.md`](flashcards.md), 155 cards covering core networking vocabulary.
- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference distilled from the study guide and flashcards.

## How the content was sourced

Unlike this repo's other modules, there's no single official documentation site for Network+ content, so this module uses a tiered sourcing strategy: IETF RFCs for internet protocols, NIST Special Publications for security/continuity concepts, Cisco's free public documentation for vendor/hardware implementation topics, and official man pages for CLI tools — confirmed reachable 2026-07-10. Domain weights and the exam format come directly from CompTIA's own official N10-009 exam objectives (fetched 2026-07-10). Every question was drafted from and checked against the relevant cached documentation before being added. Fetched pages are cached locally under `.cache/docs/` (gitignored; directory name kept for consistency with tooling shared across all five modules).

## Development

From the repo root:

- `node scripts/export-anki.mjs networking` — exports this module's flashcard deck to `anki/networking.txt`.
- `node --test scripts/lib/*.test.mjs` — runs the flashcard-markdown parser's unit tests.

From this directory:

- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.

`scripts/fetch-doc.mjs` and the shared-scaffold block inside `cheatsheet.html` are the only things still required to be byte-identical with the sibling modules — `node scripts/check-drift.mjs` at the repo root checks both.
