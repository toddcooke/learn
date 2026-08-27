# CKA Exam Prep

An unofficial study guide for the Certified Kubernetes Administrator (CKA) exam. Not affiliated with or endorsed by the Linux Foundation or CNCF.

A companion to [`aws/`](../aws), [`postgres/`](../postgres), [`sre/`](../sre), and [`networking/`](../networking).

## Reading it

No install step, no server. Open [`study/`](study), [`questions.md`](questions.md), and [`flashcards.md`](flashcards.md) directly in any markdown viewer (GitHub, VS Code, Obsidian, etc.) — questions and flashcards hide their answers in collapsed `<details>` blocks so you can still self-test. [`cheatsheet.html`](cheatsheet.html) is a standalone HTML page — open it by double-click, no server needed.

## A note on format

The real CKA exam is 100% hands-on — you solve tasks in a live cluster via the command line, not multiple-choice questions. This module's practice questions test the same underlying knowledge in multiple-choice form, which is easier to self-check but is not a replica of the real exam. Pair this with hands-on practice using [kind](https://kind.sigs.k8s.io/), [minikube](https://minikube.sigs.k8s.io/), or [killer.sh](https://killer.sh/) for genuine exam readiness.

## Hands-on labs

[`sandbox/`](sandbox) holds 34 runnable labs — one per concept, grouped by the same five exam domains — that demonstrate Kubernetes behavior against a disposable local [kind](https://kind.sigs.k8s.io/) cluster the labs create themselves. Each folder has a README you can read on its own, the manifests it applies, and a `run.sh` that executes the walkthrough and asserts the result, so a lab that exits non-zero means the cluster didn't behave as its README claims.

```
kubernetes/sandbox/cluster/up.sh                        # once
bash kubernetes/sandbox/workloads-scheduling/pod/run.sh
kubernetes/sandbox/cluster/down.sh                      # when finished
```

## What's here

- **Study guide** — [`study/`](study), organized by the exam's 5 official curriculum domains.
- **Question bank** — [`questions.md`](questions.md), 140 practice questions with explanations, answers collapsed until you expand them.
- **Flashcards** — [`flashcards.md`](flashcards.md), 109 cards covering core Kubernetes objects and concepts.
- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference distilled from the study guide and flashcards.

## How the content was sourced

Exam structure, domain weightings, and the curriculum come from the official CNCF CKA curriculum (github.com/cncf/curriculum) and Linux Foundation training/FAQ pages, fetched 2026-07-08 — see [docs/superpowers/specs/2026-07-08-cka-exam-prep-design.md](docs/superpowers/specs/2026-07-08-cka-exam-prep-design.md) for details. Every question was drafted from and checked against the relevant kubernetes.io documentation before being added. Fetched doc pages are cached locally under `.cache/docs/` (gitignored; directory name kept for consistency with tooling shared with the other modules) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

From the repo root:

- `node scripts/export-anki.mjs kubernetes` — exports this module's flashcard deck to `anki/kubernetes.txt`.
- `node --test scripts/lib/*.test.mjs` — runs the flashcard-markdown parser's unit tests.

From this directory:

- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.

`scripts/fetch-doc.mjs` and the shared-scaffold block inside `cheatsheet.html` are the only things still required to be byte-identical with the sibling modules — `node scripts/check-drift.mjs` at the repo root checks both.
