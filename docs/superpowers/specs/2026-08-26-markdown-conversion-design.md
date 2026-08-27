# Convert the Learning Modules to Markdown

Status: Approved
Date: 2026-08-26

## Purpose

Replace the five browser-based study modules with plain markdown files
read locally, and sever this repo's publishing relationship with
`toddcooke.github.io`. After this change there is no site to serve, no
`/learn/` URL, and no submodule sync: the repo becomes a set of markdown
documents Todd reads in IntelliJ, Obsidian, or any markdown viewer, plus
the Anki decks exported from them.

The content survives the move intact because it was never HTML. It lives
in `js/data/*.js` as structured objects (`{ taskStatement, topics }`,
`{ question, options, correctIndexes, explanation }`,
`{ id, service, domain, front, back }`) that the view layer renders at
runtime. Markdown is a different renderer over the same data.

## Scope

In scope:

- Generate markdown for all content in all five modules: 593 study
  topics (~111,000 words), 677 quiz questions, 579 flashcards, and the
  74-entry aws services reference.
- Delete the application: every `index.html`, `js/`, `css/`, each
  module's `scripts/validate-content.mjs`, and `scripts/check-drift.mjs`
  (127 tracked files).
- Rewrite `scripts/export-anki.mjs` to read markdown instead of
  `js/data/flashcards.js`, preserving its output contract exactly.
- Inline `vpc-explorer.html`'s ES-module script so it opens over
  `file://` without a server.
- Remove every reference to the published site from this repo's READMEs
  and cheatsheets.
- Tear down the integration in `toddcooke.github.io`.

Out of scope:

- Rewriting or re-researching any content. This is a format migration;
  prose is carried across byte-identical.
- Any static-site generator, build step, or npm dependency. The repo's
  standing "no build tooling" rule holds — markdown is the artifact, not
  an input to one.
- The `anki/` directory (exported decks and `.apkg` backups) is
  untouched.

## Decisions

Each of these was chosen deliberately over the alternatives noted.

1. **Markdown replaces the app entirely**, rather than sitting alongside
   it as an extra export. A single source of truth is the point; two
   renderings of the same content would drift.

2. **Markdown becomes the source of truth**, hand-edited going forward.
   `js/data/*.js` is deleted, not retained as a generator input —
   otherwise content edits would still mean editing JavaScript objects,
   which defeats the migration.

3. **The Anki export survives** by parsing markdown. Dropping it was
   considered and rejected: the decks are in active use and 579 notes
   are already synced under `Learn::<Module>`. Keeping the export means
   the flashcard markdown must stay machine-parseable, which constrains
   its format (see below).

4. **Study content splits by exam domain; the question and flashcard
   banks stay whole.** 27 domain files across the five modules run
   3,000-6,000 words each, which reads well and diffs well. Keeping
   `flashcards.md` whole also gives the Anki parser one file per module
   rather than 27 fragments to reassemble.

5. **Answers are hidden in `<details>` blocks**, not printed inline.
   GitHub, Obsidian, and IntelliJ all render `<details>` collapsed, so
   self-testing largely survives a format that otherwise puts the answer
   directly beneath the question. The cost is a little raw HTML in the
   markdown source, which is acceptable.

6. **The seven standalone HTML pages are kept.** The five `cheatsheet.html`
   files and `exam-shortcut.html` contain zero `<script>` tags and
   already open by double-click; their one-page print layout is most of
   their value and does not survive conversion to markdown.
   `vpc-explorer.html` is the sole exception requiring work (below).

## Repository end state

```
learn/
  README.md                     rewritten
  scripts/
    export-anki.mjs             rewritten to parse markdown
  aws/
    README.md                   rewritten
    study/
      01-secure.md  02-resilient.md  03-performant.md  04-cost.md
    questions.md
    flashcards.md
    services.md                 aws only
    cheatsheet.html             unchanged
    exam-shortcut.html          unchanged
    vpc-explorer.html           script inlined
    scripts/fetch-doc.mjs       kept
    docs/superpowers/           unchanged
  kubernetes/  postgres/  sre/  networking/
    same shape, minus services.md and the two aws-only pages
  anki/                         unchanged
  docs/superpowers/             unchanged
```

Study file counts per module follow the module's exam domains: aws 4,
kubernetes 5, networking 5, sre 6, postgres 7 — 27 files in total.
Files are numbered in the order the domains appear in `examInfo.js` so
directory listing matches study order.

38 markdown files are created; 127 tracked files are deleted.

## Markdown formats

### Study content

`STUDY_CONTENT` is an array of `{ domain, taskStatement, topics }`, and
each topic is `{ title, body }`. The mapping is direct:

```markdown
# Domain 1: Design Secure Architectures

30% of the exam. 18 topics.

## Task 1.1: Design secure access to AWS resources

### IAM foundations: users, groups, roles, and policies

<body prose, verbatim>
```

The `# ` heading and its weight line come from `examInfo.js`'s `DOMAINS`
entry for that domain. No content is dropped or reworded.

### Questions

Grouped under one `# ` heading per domain within the module's single
`questions.md`, preserving the existing question order and IDs:

```markdown
### secure-001

When a new AWS account is created, what access level does the initial
root user have?

- **A.** Unrestricted access to every AWS service and resource in the account
- **B.** Only the ability to view billing information
- **C.** Read-only access to all resources until IAM policies are attached
- **D.** No access until multi-factor authentication (MFA) is configured

<details><summary>Answer</summary>

**A.** — The root user is the very first identity on a brand-new account
and starts out with full administrative control over everything in it...

</details>
```

Both question types in the data are handled: `multiple-choice` renders
one answer letter, and `multiple-response` renders every correct letter
and appends a `*(choose two)*` marker derived from
`correctIndexes.length`. Options keep their source order, so the letter
labels are stable and match the explanations, which sometimes reference
the wording of a specific distractor.

### Flashcards

A markdown table was considered and rejected: card backs average 388
characters and reach 936, which makes table cells unreadable even though
no back contains a pipe or newline. Headings carry the structure
instead, with the same `<details>` treatment as questions so cards stay
self-testable outside Anki:

```markdown
## Security, Identity, and Compliance

### `iam` · AWS IAM

**What does IAM control within an AWS account?**

<details><summary>Answer</summary>

IAM is the account-wide gatekeeper for who can sign in and what they're
allowed to touch once inside...

</details>
```

The `## ` heading is the card's `domain`, taken from `FLASHCARD_DOMAINS`.
Note that aws is the one module whose flashcard buckets do not match its
exam domains — it uses 8 service categories (Storage, Database,
Analytics, and so on) against 4 exam domains. Those buckets drive the
Anki tags, so they are reproduced as-is rather than remapped. The other
four modules happen to align 1:1, but the exporter must not assume it.

The inline code span holds the card `id` and the text after `·` holds
`service`. Both are load-bearing for the Anki export and are not
cosmetic.

### Services

aws only. `SERVICES` entries are `{ id, name, domain, blurb }`, and
blurbs are one sentence, so a table is appropriate here: one `## `
section per domain, each with a `| Service | What it's for |` table.

## Anki exporter

`scripts/export-anki.mjs` keeps its current output contract byte-for-byte
so existing decks update in place instead of duplicating:

- Same 4-column tab-separated format with the same three `#` header
  lines and the same `# exported <date> from toddcooke/learn <module>`
  provenance comment.
- Same note ID: `<module>-<card id>`.
- Same front composition: `<service> — <front>`.
- Same tag: `<module>::<slugified domain>`, using the existing `toTag`
  slug rule.
- Same `sanitizeField` handling (collapse tab/CR/LF, prefix a space to
  any field starting with a double quote so Anki does not parse it as a
  quoted CSV field).
- Same CLI: no arguments exports every module that has a
  `flashcards.md`; named arguments export only those; an unknown name is
  a hard error.
- Same cross-module ID uniqueness assertion before any file is written.

Only the input changes. Module discovery switches from "directory
containing `js/data/flashcards.js`" to "directory containing
`flashcards.md`". The parser walks the file with a line-oriented state
machine: `## ` sets the current domain, `### ` opens a card and yields
its id and service, the next bold line is the front, and the text
between `<details>` and `</details>` is the back with surrounding blank
lines trimmed.

The parser is strict and fails the whole run rather than skipping a bad
record. It throws on: a `### ` card heading that does not match the
`` `id` · service `` shape, a card missing a front or a back, a card
appearing before any `## ` domain heading, a duplicate id within a
module, or a domain heading that is not one of the module's known
buckets. Silent omission is the failure mode that would quietly shrink a
deck, so it is the one explicitly designed against.

## CI

`.github/workflows/ci.yml` drops to a single step:

```
node scripts/export-anki.mjs
```

The four existing steps all lose their subject: the JS syntax check, the
`node --test` unit tests, `validate-content.mjs`, and `check-drift.mjs`
all operate on code being deleted. The remaining command parses all 579
cards across all five modules and asserts shape and ID uniqueness, which
is the only machine-checkable invariant left and the one protecting the
Anki sync. Module auto-discovery still means adding a module requires no
workflow edit.

## vpc-explorer

`aws/vpc-explorer.html` loads `js/vpc-explorer.js` as
`<script type="module">`, which browsers refuse to load over `file://`.
Since `js/` is being deleted, the script and its two imports are inlined
into the page as one classic `<script>` block: `js/vpc-explorer.js` (406
lines) plus `js/lib/vpcMath.js` (253 lines) and the `escapeHtml` helper
from `js/lib/html.js`. Import/export statements are stripped; the result
is a single self-contained file that opens by double-click like the
other six HTML pages.

After inlining, the page is verified by hand in a browser: subnet
selection, packet tracing through the route tables, and the CIDR math
inputs all still work.

## Accepted tradeoffs

These are losses, recorded so they are not discovered later as
surprises. Everything deleted remains recoverable from git history.

- **Quiz and mock exam as exercises.** Instant feedback, scoring, and
  the 65-question / 130-minute timed exam weighted by domain are gone.
  `<details>` blocks preserve recall practice but not scoring.
- **Progress tracking.** localStorage quiz history, flashcard
  known/unknown state, and weak-area analysis have no markdown
  equivalent and are not migrated. Existing browser state is abandoned.
- **`vpcMath.test.mjs`.** 21 of the 22 deleted test files cover logic
  that ceases to exist. This one covers code that survives, inlined into
  `vpc-explorer.html`, so that code goes from tested to untested.
  Retaining the test would require keeping a standalone `vpcMath.js`
  that then drifts from the inlined copy, which is the worse outcome.
- **The published site.** All `https://toddcooke.github.io/learn/*` URLs
  begin returning 404.

## toddcooke.github.io teardown

In the separate `toddcooke/toddcooke.github.io` repo:

- `git rm` the `static/learn` submodule and remove its `.gitmodules`
  entry and `.git/modules` leftovers.
- Delete `.github/workflows/sync-learn-submodules.yml` (the hourly cron
  that advanced the submodule and dispatched the Hugo deploy).
- Delete `content/learn.md`, the `/learn/` landing page.
- Remove the `learn` entry from the `menu.main` list in `config.yaml`.

`hugo.yaml` and the rest of the site are untouched. Because this deletes
live public pages, the commit is pushed only after explicit confirmation
at that point in the plan, and it is the final step — the markdown
conversion is complete and verified in this repo first.

In this repo, the same scrub removes the "Live at
https://toddcooke.github.io/learn/<module>/" line from all five module
READMEs, the submodule/publishing description from the root README, and
the `toddcooke.github.io/learn/<module>` footer text printed in all five
cheatsheets.

## Migration mechanics and verification

The converter is a one-shot script run from the scratchpad, not
committed. It imports each module's `js/data/*.js` and writes the
markdown tree. Once `js/data` is deleted the script has no further
purpose, and the source data stays recoverable in git history.

Verification is a round trip, and it runs before anything is deleted:

1. Re-parse the generated markdown and assert it reproduces every
   record: 593 study topics, 677 questions, 579 flashcards, 74 services,
   with prose compared byte-for-byte against the objects in `js/data`.
   Any mismatch fails the migration.
2. Run the rewritten `export-anki.mjs` against the markdown and diff its
   output against the output of the current exporter run against
   `js/data`. The two must be identical except for the export date line.
   This is what proves the Anki decks will update in place rather than
   duplicate.
3. Confirm `<details>` blocks render collapsed in the actual readers in
   use — GitHub's markdown view and IntelliJ's preview.
4. Open all seven HTML pages over `file://` and confirm they work,
   including the inlined vpc-explorer.

Deletion of `js/`, `css/`, `index.html`, and the retired scripts happens
only after steps 1 and 2 pass.
