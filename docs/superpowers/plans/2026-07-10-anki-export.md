# Anki Deck Export Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a root-level CLI script that exports each module's `FLASHCARDS` deck to a plain-text file Anki can import directly via File > Import.

**Architecture:** One new script (`scripts/export-anki.mjs`) at the monorepo root, not duplicated per module. It dynamically imports each requested module's `js/data/flashcards.js`, converts the array to Anki's tab-separated import format with header directives, and writes one output file per module to a new gitignored `anki/` directory.

**Tech Stack:** Plain Node.js (`node:fs` only), no dependencies, no build step — consistent with every module in this monorepo.

## Global Constraints

- **This project's own working directory is `/Users/toddcooke/IdeaProjects/learn_aws`** (the repo root, not a module subdirectory) — this is root-level tooling, not part of any single module.
- No npm/build tooling of any kind, no new dependencies.
- Output format is Anki's plain-text tab-separated import format (`#separator:tab` / `#html:false` header directives, then `Front\tBack\tTags` rows) — NOT a `.apkg` package.
- Exports `FLASHCARDS` only, never `QUESTIONS`.
- Four valid module names: `aws`, `kubernetes`, `postgres`, `sre`. No arguments = export all four; one or more module-name arguments = export only those; an unknown name is a hard error before anything is written.
- Output goes to a new root-level `anki/` directory (created if missing): `anki/aws.txt`, `anki/kubernetes.txt`, `anki/postgres.txt`, `anki/sre.txt`. This directory must be added to the root `.gitignore`.
- `Tags` column derivation: lowercase the card's `service` field, replace every run of one or more non-alphanumeric characters with a single hyphen, trim leading/trailing hyphens.
- `Front`/`Back` fields: replace any literal tab or newline character with a single space (defensive — none expected in current content, but must not silently corrupt the file if one appears later).
- The script does not create or name an Anki deck — the user picks the target deck in Anki's own Import dialog.
- Dynamic `import()` of each module's `flashcards.js` must resolve relative to the script's own location (`import.meta.url`), not the process's working directory, mirroring the pattern already used in every module's own `scripts/validate-content.mjs`.
- Reference spec: [docs/superpowers/specs/2026-07-10-anki-export-design.md](../specs/2026-07-10-anki-export-design.md).

---

## Task 1: Anki export script

**Files:**
- Create: `scripts/export-anki.mjs`
- Modify: `.gitignore`
- Modify: `README.md`

**Interfaces:**
- Produces: a CLI entry point, `node scripts/export-anki.mjs [module...]` — no importable functions consumed by anything else in the repo.

- [ ] **Step 1: Write the script**

```js
// scripts/export-anki.mjs
// Exports each module's FLASHCARDS deck to a plain-text file Anki can
// import directly (File > Import). See
// docs/superpowers/specs/2026-07-10-anki-export-design.md.
import { mkdirSync, writeFileSync } from 'node:fs';

const ALL_MODULES = ['aws', 'kubernetes', 'postgres', 'sre'];

function toTag(service) {
  return service
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

function sanitizeField(text) {
  return text.replace(/[\t\r\n]+/g, ' ');
}

async function exportModule(name) {
  const { FLASHCARDS } = await import(`../${name}/js/data/flashcards.js`);
  const lines = ['#separator:tab', '#html:false'];
  for (const card of FLASHCARDS) {
    const front = sanitizeField(card.front);
    const back = sanitizeField(card.back);
    const tag = toTag(card.service);
    lines.push(`${front}\t${back}\t${tag}`);
  }
  mkdirSync(new URL('../anki/', import.meta.url), { recursive: true });
  const outPath = new URL(`../anki/${name}.txt`, import.meta.url);
  writeFileSync(outPath, lines.join('\n') + '\n');
  console.log(`${name}: ${FLASHCARDS.length} cards → anki/${name}.txt`);
}

const requested = process.argv.slice(2);
const modules = requested.length > 0 ? requested : ALL_MODULES;

for (const name of modules) {
  if (!ALL_MODULES.includes(name)) {
    throw new Error(`Unknown module "${name}" — expected one of: ${ALL_MODULES.join(', ')}`);
  }
}

for (const name of modules) {
  await exportModule(name);
}
```

(The all-modules validation loop runs to completion before any export starts, so a single typo in a multi-module invocation fails fast with nothing written, rather than partially exporting.)

- [ ] **Step 2: Run with no arguments and verify all four modules export correctly**

```bash
node scripts/export-anki.mjs
```

Expected: four lines of output, one per module, each in the form `<module>: <N> cards → anki/<module>.txt` with `<N>` roughly 65-70 for each (matching each module's own flashcard count). Exit code 0.

Then inspect one output file's structure directly:

```bash
head -5 anki/sre.txt
```

Expected: line 1 is exactly `#separator:tab`, line 2 is exactly `#html:false`, and lines 3+ each have exactly two tab characters (three fields: front, back, tag) with a non-empty tag containing only lowercase letters, digits, and hyphens (no leading/trailing hyphen).

Run: `wc -l anki/*.txt` and confirm each file's line count is `<card count> + 2` (the two header lines).

- [ ] **Step 3: Run with specific module arguments and verify only those export**

```bash
rm -rf anki
node scripts/export-anki.mjs aws sre
ls anki/
```

Expected: `ls anki/` shows exactly `aws.txt` and `sre.txt` — `kubernetes.txt` and `postgres.txt` are not present (either never created, or, if `anki/` already existed from Step 2, this confirms the script itself never touches modules that weren't requested — since Step 3 clears `anki/` first, absence of the other two files confirms this cleanly).

- [ ] **Step 4: Run with an unknown module name and verify it errors clearly before writing anything**

```bash
rm -rf anki
node scripts/export-anki.mjs aws bogus-module 2>&1 | head -5
echo "exit code: $?"
ls anki 2>&1
```

Expected: a thrown `Error` mentioning `bogus-module` and listing the four valid module names; non-zero exit code; `ls anki` reports the directory doesn't exist (nothing was written, including for the valid `aws` argument that preceded the bad one in argv — confirms the fail-fast-before-writing behavior from Step 1's design).

- [ ] **Step 5: Regenerate the full export and add `anki/` to `.gitignore`**

```bash
node scripts/export-anki.mjs
```

Open `.gitignore` and confirm/add:

```
.cache/
.worktrees/
anki/
```

Run: `git status --porcelain anki/` — expected: no output (directory is untracked and ignored, not merely untracked).

- [ ] **Step 6: Document the tool in the root README**

Open `README.md` and add a new section after "Adding a module" and before "Deployment":

```markdown
## Anki export

Each module's flashcard deck can be exported to a plain-text file Anki
imports directly (File > Import):

```
node scripts/export-anki.mjs [module...]
```

With no arguments, exports all four modules to `anki/<module>.txt`
(gitignored — regenerate anytime with the command above). Pass one or
more module names (`aws`, `kubernetes`, `postgres`, `sre`) to export only
those. Each file only needs the deck picked/created once in Anki's own
Import dialog — the script doesn't assume a deck name.
```

- [ ] **Step 7: Commit**

```bash
git add scripts/export-anki.mjs .gitignore README.md
git commit -m "Add Anki deck export script"
```
