# Anki Deck Export

Status: Approved
Date: 2026-07-10

## Purpose

Add a CLI script that exports each module's flashcard deck
(`js/data/flashcards.js`) to a plain-text file Anki can import directly,
so Todd can study the `aws/`, `kubernetes/`, `postgres/`, and `sre/`
flashcard decks inside Anki's own spaced-repetition scheduler instead of
only in-browser.

## Scope

- One new root-level script, not duplicated per module — this is an
  end-user convenience tool over the monorepo, not module-construction
  tooling (`fetch-doc.mjs`/`validate-content.mjs` stay duplicated per
  module since those are part of each module's self-contained build
  pipeline; this tool isn't).
- Exports `FLASHCARDS` only, not `QUESTIONS` — flashcards are already
  shaped as front/back pairs with a clean 1:1 mapping to Anki cards;
  multiple-choice/multiple-response questions aren't a good fit for
  Anki's recall-based format and are out of scope for this tool.
- Output format: Anki's plain-text tab-separated import format, not a
  `.apkg` package — a `.apkg` requires either an npm dependency (e.g. a
  genanki-style library) or hand-rolling the sqlite3+zip container from
  scratch, both of which conflict with this repo's established "no
  npm/build tooling" rule (a Global Constraint repeated verbatim across
  every module's plan). Plain text needs zero dependencies and Anki's
  built-in File > Import already reads it natively.

## Command

```
node scripts/export-anki.mjs [module...]
```

- No arguments: exports all four modules (`aws`, `kubernetes`, `postgres`,
  `sre`).
- One or more module names as arguments: exports only those (e.g.
  `node scripts/export-anki.mjs aws sre`).
- An unknown module name is a hard error (`node`'s own uncaught-exception
  behavior is sufficient — no need for custom validation/help text beyond
  a clear thrown error message naming the bad argument).

## Output

- Writes to a new root-level `anki/` directory (created if missing),
  one file per module: `anki/aws.txt`, `anki/kubernetes.txt`,
  `anki/postgres.txt`, `anki/sre.txt`.
- `anki/` is a generated-output directory, gitignored — add `anki/` to
  the root `.gitignore` (which already has `.cache/` and `.worktrees/`
  for the same reason: build/research artifacts, not source).
- Each file starts with Anki header-comment directives so Anki's
  importer auto-detects the format without the user having to configure
  it by hand:
  ```
  #separator:tab
  #html:false
  #tags column:3
  ```
  With the `--reversed` flag, a `#notetype:Basic (and reversed card)`
  directive is added so each row imports as a two-way card (assumes the
  English name of Anki's stock reversed note type).
- Followed by one row per flashcard: `Front\tBack\tTags`.
  - `Front` = `<service> — <front>` (the site renders `service` as a
    heading above the front, so generic fronts like "What is it for?"
    need the service name attached to stand alone; Anki also dedupes on
    the first field, so bare generic fronts would collapse on import).
  - `Back` = the card's `back` field verbatim.
  - `Tags` = the card's `service` field, converted to a single valid
    Anki tag by: lowercasing, replacing every run of one or more
    characters that isn't a letter or digit with a single hyphen, then
    trimming any leading/trailing hyphen. Example:
    `service: "SLI (Service Level Indicator)"` → tag
    `sli-service-level-indicator`.
  - `Front`/`Back` text is sanitized only to the extent required for
    TSV correctness: any literal tab or newline character inside a
    field is replaced with a single space (none are expected in current
    content, but the export must not silently produce a malformed file
    if one sneaks in later).
- The script does not create or name an Anki deck — the user picks or
  creates the target deck themselves in Anki's own Import dialog when
  they import each file. This avoids hardcoding a deck-naming assumption
  the script can't verify against the user's actual Anki setup.
- Console output reports one line per module processed: card count and
  output path (e.g. `sre: 67 cards → anki/sre.txt`).

## Data source

For each requested module, dynamically imports
`<module>/js/data/flashcards.js` and reads its `FLASHCARDS` export —
already an array of `{id, service, front, back}` objects, already
validated (uniqueness, minimum lengths) by that module's own
`validate-content.mjs` as part of its content pipeline. This script
performs no additional validation of the source data; it trusts the
existing invariant.

Import path resolution: dynamic `import()` specifiers resolve relative
to the importing module's own location, not the process's current
working directory — the script must use this (mirroring the
`new URL('../js/data/examInfo.js', import.meta.url)` pattern already
used inside each module's own `validate-content.mjs`) so it works
correctly regardless of which directory it's invoked from.

## Explicitly out of scope

- No `.apkg` package generation (see Scope above).
- No export of `QUESTIONS` (see Scope above).
- No new module-level script — this lives only at the repo root.
- No changes to any module's own `flashcards.js`, `validate-content.mjs`,
  or other existing tooling.
- No deck-name or sub-deck-by-domain logic — flashcards don't currently
  carry a `domain` field (only `service`, a concept label), so grouping
  by domain isn't reliably derivable from existing data; out of scope
  for this change.
