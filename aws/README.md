# AWS SAA-C03 Exam Prep

An unofficial study site for the AWS Certified Solutions Architect – Associate (SAA-C03) exam. Not affiliated with or endorsed by AWS.

Live at https://toddcooke.github.io/learn/aws/ (source repo also mirrored under toddcooke.github.io as a submodule).

## Running it

No install step. From this directory:

```
python3 -m http.server 8000
```

Then open http://localhost:8000/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## What's here

- **Study guide** — organized by the exam's 4 official domains and their task statements.
- **Domain quizzes** — 100+ practice questions with instant feedback and explanations.
- **Flashcards** — a service-by-service cheat-sheet deck with known/unknown tracking.
- **Mock exam** — a 65-question, 130-minute timed exam weighted by domain, like the real thing.
- **Progress dashboard** — quiz and mock exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).
- **[VPC & Subnet Explorer](vpc-explorer.html)** — a standalone interactive page (linked from Home) for clicking through a worked 3-tier/3-AZ VPC's subnets, tracing packets through its route tables, and playing with CIDR math.

## How the content was sourced

Exam structure, domain weightings, and task statements come from AWS's official SAA-C03 exam guide (docs.aws.amazon.com), fetched 2026-07-07 — see [docs/superpowers/specs/2026-07-07-aws-saa-exam-prep-design.md](docs/superpowers/specs/2026-07-07-aws-saa-exam-prep-design.md) for details. Every quiz question was drafted from and checked against the relevant AWS service documentation before being added. Fetched doc pages are cached locally under `.cache/docs/` (gitignored) so re-running the content pipeline doesn't re-hit AWS for pages already fetched.

## Development

- `node --test` — runs unit tests for the pure storage/scoring logic.
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches an AWS doc page for content research.
