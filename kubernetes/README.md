# CKA Exam Prep

An unofficial study site for the Certified Kubernetes Administrator (CKA) exam. Not affiliated with or endorsed by the Linux Foundation or CNCF.

Live at https://toddcooke.github.io/learn/kubernetes/. A companion to https://toddcooke.github.io/learn/aws/.

## Running it

No install step. From this directory:

```
python3 -m http.server 8001
```

Then open http://localhost:8001/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## A note on format

The real CKA exam is 100% hands-on — you solve tasks in a live cluster via the command line, not multiple-choice questions. This site's quizzes and mock exam test the same underlying knowledge in multiple-choice form, which is easier to self-check but is not a replica of the real exam. Pair this with hands-on practice using [kind](https://kind.sigs.k8s.io/), [minikube](https://minikube.sigs.k8s.io/), or [killer.sh](https://killer.sh/) for genuine exam readiness.

## What's here

- **Study guide** — organized by the exam's 5 official curriculum domains.
- **Domain quizzes** — 140 practice questions with instant feedback and explanations.
- **Flashcards** — a cheat-sheet deck of core Kubernetes objects and concepts with known/unknown tracking.
- **Mock exam** — a 60-question, 90-minute timed exam weighted by domain, scored against the real exam's 66% passing line.
- **Progress dashboard** — quiz and mock exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).

## How the content was sourced

Exam structure, domain weightings, and the curriculum come from the official CNCF CKA curriculum (github.com/cncf/curriculum) and Linux Foundation training/FAQ pages, fetched 2026-07-08 — see [docs/superpowers/specs/2026-07-08-cka-exam-prep-design.md](docs/superpowers/specs/2026-07-08-cka-exam-prep-design.md) for details. Every quiz question was drafted from and checked against the relevant kubernetes.io documentation before being added. Fetched doc pages are cached locally under `.cache/docs/` (gitignored; directory name kept for consistency with tooling shared with the AWS exam prep site) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

This project's application code (router, storage/scoring libraries, view components, content tooling) is shared architecture with [learn_aws](https://github.com/toddcooke/learn_aws) — only the content data files and the mock exam's disclaimer differ. See that project's README for more on the tooling itself.

- `node --test "js/lib/*.test.mjs"` — runs unit tests for the pure storage/scoring logic. (Some Node versions, including v25.5.0, fail to resolve a bare directory argument to `--test` — use the explicit glob form shown here.)
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.
