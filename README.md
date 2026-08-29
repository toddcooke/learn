# learn

Local study material for Todd Cooke, organized as seven independent
markdown modules — no server, no build step, no published site. Read a
module's files directly in any markdown viewer (GitHub, VS Code,
Obsidian, `cat`, whatever), and double-click its standalone HTML pages to
open them straight from disk.

## Modules

- [`aws/`](aws) — AWS Certified Solutions Architect – Associate (SAA-C03) exam prep
- [`kubernetes/`](kubernetes) — Certified Kubernetes Administrator (CKA) exam prep
- [`postgres/`](postgres) — general PostgreSQL mastery (not tied to a certification)
- [`sre/`](sre) — general Site Reliability Engineering mastery (not tied to a certification)
- [`networking/`](networking) — CompTIA Network+ (N10-009) exam prep
- [`well-architected/`](well-architected) — AWS Well-Architected Framework (flashcards only; no certification exists for it)
- [`terraform/`](terraform) — HashiCorp Terraform Associate (004) exam prep (flashcards only)

Each module is self-contained: `study/` (one markdown file per exam
domain), `questions.md`, `flashcards.md`, its own `README.md`, a
printable `cheatsheet.html`, `scripts/fetch-doc.mjs` for content
research, and a `docs/superpowers/` spec+plan folder kept as a historical
record. `aws/` additionally has `services.md`, `exam-shortcut.html`, and
an interactive `vpc-explorer.html`. `well-architected/` and `terraform/`
are the exceptions: each is a flashcard deck plus a cheatsheet, with no
`study/` directory and no `questions.md`. See each module's own README
for details.

## Adding a module

Add a new top-level directory (e.g. `gcp/`) with `study/NN-<domain>.md`
files, a `questions.md`, and a `flashcards.md`. Copy `scripts/fetch-doc.mjs`
and the shared-scaffold portion of `cheatsheet.html` from a sibling
module verbatim — those two are the only things still required to be
byte-identical across modules. Then:

- add it to the Modules list in this README;
- run `node scripts/check-drift.mjs` to confirm the copied
  `fetch-doc.mjs` and `cheatsheet.html` scaffold match the other modules
  (`scripts/export-anki.mjs` discovers modules automatically by the
  presence of `flashcards.md` — no registration needed);
- CI needs no edits either: it discovers modules the same way the
  scripts do.

Nothing else: no `.claude/launch.json` entry (that file doesn't exist
anymore — there's nothing to serve), and no edit in any other repo —
this repo doesn't publish anywhere.

## Anki export

Each module's flashcard deck can be exported to a plain-text file Anki
imports directly (File > Import):

```
node scripts/export-anki.mjs [module...]
```

With no arguments, exports every module that has a flashcard deck (auto-discovered) to `anki/<module>.txt`
(gitignored — regenerate anytime with the command above). Pass one or
more module names (`aws`, `kubernetes`, `postgres`, `sre`,
`networking`, `well-architected`, `terraform`) to export only those.

### Format

Each `.txt` file contains a 4-column tab-separated format:

```
#separator:tab
#html:true
#tags column:4
# exported <YYYY-MM-DD> from toddcooke/learn <module>
<ID>\t<Front>\t<Back>\t<Tags>
```

- **ID** (col 1): stable module-qualified identifier (`<module>-<card-id>`), required for Anki to match and update notes on re-import
- **Front** (col 2): `<service> — <front>` (service name + question)
- **Back** (col 3): the answer/explanation
- **Tags** (col 4): hierarchical tags (`<module>::<domain-slug>`), where the domain is the card's section/topic bucket (5-8 per deck), not the per-card service name

#### Lists in answers

Anki fields are HTML, so an answer only renders as a list if the field
actually contains `<ul>`/`<ol>`. Write the list as ordinary markdown in
`flashcards.md` and `scripts/lib/anki-field.mjs` converts it on export:

| In `flashcards.md` | In the Anki field |
| --- | --- |
| `- item` lines | `<ul><li>item</li>…</ul>` |
| `1.` / `1)` lines | `<ol><li>item</li>…</ol>` (marker stripped, `<ol>` renumbers) |
| blank line between two prose runs | `<br>` |
| everything else | escaped text, unchanged |

That is why the header is `#html:true` rather than `#html:false`: the
exporter escapes the card text itself, so the only markup in a field is
markup it added. The *stored* result for a prose card is identical either
way — under `#html:false` the importer escaped `<pod>` to `&lt;pod&gt;`,
and now the exporter writes `&lt;pod&gt;` directly — so decks imported
before this change need no migration. Verified against the live
collection: all 602 existing notes matched byte-for-byte.

Because markdown emphasis is *not* converted, don't put `**bold**` in an
answer — it would reach Anki as literal asterisks.

Each card's domain bucket is just the `##` heading text above it in that
module's `flashcards.md` — `scripts/lib/flashcard-md.mjs` parses it
directly (and rejects the file outright if a card's shape doesn't match:
missing front, missing back, duplicate ID, content outside the expected
structure), so the tag set is whatever the markdown headings say.

To hand-add a card, follow the shape the parser expects:

```markdown
## Storage

### `s3` · Amazon S3

**What is it for?**

<details><summary>Answer</summary>

Object storage. It comes in classes:

- Standard
- Infrequent Access
- Glacier

</details>
```

The `<!-- domains: ... -->` line near the top of `flashcards.md` must list
every `##` bucket used in the file, including this one.

### One-time Anki setup

To import these decks, set up a custom note type once:

1. In Anki, create a new note type with exactly three fields, in order: `ID`, `Front`, `Back`
2. Set `Front` as the "sort field" (the field that controls the order cards appear in browsing)
3. In the card templates, do NOT include the `ID` field on the card face (it's metadata only)
4. When importing the `.txt` file (File > Import), map the columns:
   - Column 1 → `ID`
   - Column 2 → `Front`
   - Column 3 → `Back`
   - Column 4 → Tags
5. Each time you re-import the file, Anki will match notes by ID and update them instead of creating duplicates

### Migration for existing imports

If you previously imported these decks using the older 3-column format, you should delete those decks in Anki and re-import the files fresh with the new 4-column format. The ID column ensures updates work correctly going forward.

### Deck naming & one-way design

Each file only needs to be imported once per deck in Anki's own Import dialog (you pick or create the target deck name). The decks are one-way by design: the backs are prose explanations that name their own topic, so reversed (back→front) cards would mostly give away their answer.

## No server, no publishing

There is nothing to run here. Clone the repo
and read the markdown directly, or browse it on whatever git host has
your fork. The nine standalone HTML pages across the seven modules
(seven `cheatsheet.html` plus `aws/exam-shortcut.html` and
`aws/vpc-explorer.html`) are fully self-contained — open them by
double-click, no server required.

CI (`.github/workflows/ci.yml`) runs on every push and PR to guard
content, not to build or deploy anything:

```
node --test scripts/lib/*.test.mjs   # unit tests for the flashcard-markdown parser and the Anki field builder
node scripts/check-drift.mjs         # fetch-doc.mjs + cheatsheet scaffold stay identical across modules
node scripts/export-anki.mjs         # parses every module's flashcards.md, asserts shape + cross-deck ID uniqueness
```

Each module also has its own `node scripts/fetch-doc.mjs <url>` for
researching new content — see that module's README.
