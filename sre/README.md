# SRE Mastery

An unofficial study site for general Site Reliability Engineering knowledge, drawing on Google's publicly available SRE Book and Workbook. Not tied to any certification — none exists industry-wide for SRE — and not affiliated with or endorsed by Google.

Live at https://toddcooke.github.io/learn/sre/. A companion to https://toddcooke.github.io/learn/aws/, https://toddcooke.github.io/learn/kubernetes/, and https://toddcooke.github.io/learn/postgres/.

## Running it

No install step. From this directory:

```
python3 -m http.server 8003
```

Then open http://localhost:8003/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## A note on scope

There is no single, industry-wide Site Reliability Engineering certification the way there is for AWS (SAA-C03) or Kubernetes (CKA). This site's 6-domain taxonomy is self-authored, grounded primarily in Google's "Site Reliability Engineering" book and "The Site Reliability Workbook" — the field's most influential published references, but one company's perspective on SRE, not a vendor-neutral standard. The "practice exam" is a self-test, not a simulation of any vendor's exam.

## What's here

- **Study guide** — organized by 6 domains: SLIs/SLOs & Error Budgets, Monitoring/Observability & Alerting, Incident Response/On-Call & Postmortems, Capacity Planning & Managing Load, Release Engineering & Change Management, and Reliability Patterns & Toil Reduction.
- **Domain quizzes** — 137 practice questions with instant feedback and explanations.
- **Flashcards** — a cheat-sheet deck of core SRE vocabulary and concepts with known/unknown tracking.
- **Practice exam** — a 50-question, 75-minute timed self-test weighted by domain, scored on a 0-100 scale against an informal 70-point passing line.
- **Progress dashboard** — quiz and practice exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).
- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference distilled from the study guide and flashcards, linked from Home.

## How the content was sourced

All content is grounded in Google's "Site Reliability Engineering" book and "The Site Reliability Workbook," both freely readable at sre.google (chapter URLs confirmed live as of 2026-07-10). Every quiz question was drafted from and checked against the relevant cached chapter before being added. Fetched pages are cached locally under `.cache/docs/` (gitignored; directory name kept for consistency with tooling shared with the other three modules) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

This project's application code (router, storage/scoring libraries, view components, content tooling) is shared architecture with the sibling [`aws/`](../aws), [`kubernetes/`](../kubernetes), and [`postgres/`](../postgres) modules in this repo — only the content data files and one small mock-exam wording edit differ. See those modules' READMEs for more on the shared tooling itself.

- `node --test "js/lib/*.test.mjs"` — runs unit tests for the pure storage/scoring logic (the bare-directory form `node --test js/lib` fails on some Node versions; use the glob form).
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.
