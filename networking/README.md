# CompTIA Network+ (N10-009) Prep

An unofficial study site for the CompTIA Network+ certification (exam N10-009). Not affiliated with or endorsed by CompTIA.

Live at https://toddcooke.github.io/learn/networking/. A companion to https://toddcooke.github.io/learn/aws/, https://toddcooke.github.io/learn/kubernetes/, https://toddcooke.github.io/learn/postgres/, and https://toddcooke.github.io/learn/sre/.

## Running it

No install step. From this directory:

```
python3 -m http.server 8004
```

Then open http://localhost:8004/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## A note on format

The real N10-009 exam is a maximum of 90 questions (multiple-choice AND performance-based/simulation), 90 minutes, passing score 720 on a 100–900 scale. This site's quizzes and mock exam test the same underlying knowledge in multiple-choice/multiple-response form only — the performance-based simulation questions aren't replicated here. Pair this with hands-on lab practice (e.g. Cisco Packet Tracer or GNS3) for genuine exam readiness.

## What's here

- **Study guide** — organized by the exam's 5 official domains: Networking Concepts, Network Implementation, Network Operations, Network Security, Network Troubleshooting.
- **Domain quizzes** — 127 practice questions with instant feedback and explanations.
- **Flashcards** — a cheat-sheet deck of core networking vocabulary with known/unknown tracking.
- **Mock exam** — a 90-question, 90-minute timed exam weighted by domain, scored against the real exam's 100-900 scale and 720 passing line.
- **Progress dashboard** — quiz and mock exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).

## How the content was sourced

Unlike this repo's other modules, there's no single official documentation site for Network+ content, so this module uses a tiered sourcing strategy: IETF RFCs for internet protocols, NIST Special Publications for security/continuity concepts, Cisco's free public documentation for vendor/hardware implementation topics, and official man pages for CLI tools — confirmed reachable 2026-07-10. Domain weights and the exam format come directly from CompTIA's own official N10-009 exam objectives (fetched 2026-07-10). Every quiz question was drafted from and checked against the relevant cached documentation before being added. Fetched pages are cached locally under `.cache/docs/` (gitignored; directory name kept for consistency with tooling shared across all five modules).

## Development

This project's application code (router, storage/scoring libraries, view components, content tooling) is shared architecture with the sibling [`aws/`](../aws), [`kubernetes/`](../kubernetes), [`postgres/`](../postgres), and [`sre/`](../sre) modules in this repo — only the content data files and one small mock-exam wording edit differ.

- `node --test "js/lib/*.test.mjs"` — runs unit tests for the pure storage/scoring logic (the bare-directory form `node --test js/lib` fails on some Node versions; use the glob form).
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.
