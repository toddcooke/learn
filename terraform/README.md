# HashiCorp Terraform Associate (004)

An unofficial flashcard deck for the HashiCorp Certified: Terraform Associate (004) exam, covering all eight objective domains. Not affiliated with or endorsed by HashiCorp.

A companion to [`aws/`](../aws), [`kubernetes/`](../kubernetes), [`postgres/`](../postgres), [`sre/`](../sre), [`networking/`](../networking), and [`well-architected/`](../well-architected).

## Reading it

No install step, no server. Open [`flashcards.md`](flashcards.md) directly in any markdown viewer (GitHub, VS Code, Obsidian, etc.) — every answer is hidden in a collapsed `<details>` block so you can self-test. [`cheatsheet.html`](cheatsheet.html) is a standalone HTML page — open it by double-click, no server needed.

## The exam

Multiple choice, online proctored, one hour, $70.50 USD plus tax, credential valid for two years. It tests Terraform 1.12 and includes HCP Terraform content. Provider-specific knowledge is not required — the tutorials use AWS and others, but the exam does not test them.

Four topics are new in 004 compared with 003: `depends_on` and `create_before_destroy` (4f), validating configuration with custom conditions (4g), ephemeral values and write-only arguments (4h), and organizing HCP Terraform workspaces and projects (8c). Objective 8 is now "HCP Terraform" rather than "Terraform Cloud".

## What's here

- **Flashcards** — [`flashcards.md`](flashcards.md), 184 cards across the exam's 8 objective domains:

  | Domain | Cards |
  | --- | --- |
  | 1. Infrastructure as Code with Terraform | 11 |
  | 2. Terraform Fundamentals | 23 |
  | 3. Core Terraform Workflow | 23 |
  | 4. Terraform Configuration | 50 |
  | 5. Terraform Modules | 14 |
  | 6. State Management | 19 |
  | 7. Maintaining Infrastructure | 17 |
  | 8. HCP Terraform | 27 |

- **[Printable cheatsheet](cheatsheet.html)** — a standalone one-page (Letter/A4) print reference: exam facts and objective domains, the core workflow and its flags, every configuration block and meta-argument, types and expressions, variable precedence, provider versioning, state and backends, modules, sensitive data, and HCP Terraform.

This module is **flashcards only**. Like [`well-architected/`](../well-architected), and unlike the five decks with a `study/` directory, it has no study notes and no `questions.md`.

## How the content was sourced

Every card is grounded in the official Terraform 1.12 documentation at `developer.hashicorp.com` and in HashiCorp's own [004 exam objectives](https://developer.hashicorp.com/certifications/infrastructure-automation) and [exam content list](https://developer.hashicorp.com/terraform/tutorials/certification-004/associate-review-004), fetched 2026-08-28. The exam content list maps each objective to specific documentation pages; those pages are what the deck was written from — in the author's own words, not copied verbatim. Fetched pages are cached under `.cache/docs/` (gitignored) so re-running the content pipeline doesn't re-hit HashiCorp for pages already fetched.

## Development

From the repo root:

- `node scripts/export-anki.mjs terraform` — exports this module's flashcard deck to `anki/terraform.txt`.
- `node --test scripts/lib/*.test.mjs` — runs the flashcard-markdown parser's unit tests.

From this directory:

- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.

`scripts/fetch-doc.mjs` and the shared-scaffold block inside `cheatsheet.html` are the only things still required to be byte-identical with the sibling modules — `node scripts/check-drift.mjs` at the repo root checks both.
