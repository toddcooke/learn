# learn

Learning modules for Todd Cooke, published as a single submodule under
`toddcooke.github.io` at `static/learn`. Each module is a sibling
subdirectory here and publishes at `https://toddcooke.github.io/learn/<module>/`.

## Modules

- [`aws/`](aws) — AWS Certified Solutions Architect – Associate (SAA-C03) exam prep, published at https://toddcooke.github.io/learn/aws/
- [`kubernetes/`](kubernetes) — Certified Kubernetes Administrator (CKA) exam prep, published at https://toddcooke.github.io/learn/kubernetes/
- [`postgres/`](postgres) — general PostgreSQL mastery (not tied to a certification), published at https://toddcooke.github.io/learn/postgres/
- [`sre/`](sre) — general Site Reliability Engineering mastery (not tied to a certification), published at https://toddcooke.github.io/learn/sre/
- [`networking/`](networking) — CompTIA Network+ (N10-009) exam prep, published at https://toddcooke.github.io/learn/networking/

Each module is self-contained: its own `index.html`, `js/`, `css/`,
`scripts/`, and `docs/superpowers/` spec+plan. None of them use a build
step — see each module's own README for how to run and develop it.

## Adding a module

Add a new top-level directory (e.g. `gcp/`) with its own `index.html` entry
point — everything in each module uses relative paths, so a module works
unmodified at whatever path it's nested under. Then:

- add it to the Modules list in this README;
- add a `.claude/launch.json` entry on the next free port;
- run `node scripts/check-drift.mjs` to confirm the copied app layer
  matches the other modules (`scripts/export-anki.mjs` discovers modules
  automatically — no registration needed);
- CI needs no edits either: it auto-discovers modules the same way the
  scripts do (any top-level directory containing `js/app.js`);
- link to it from `toddcooke.github.io`'s `content/learn.md` page (that
  repo owns the `/learn/` landing page; this repo only supplies the module
  content under it).

## Anki export

Each module's flashcard deck can be exported to a plain-text file Anki
imports directly (File > Import):

```
node scripts/export-anki.mjs [module...]
```

With no arguments, exports every module that has a flashcard deck (auto-discovered) to `anki/<module>.txt`
(gitignored — regenerate anytime with the command above). Pass one or
more module names (`aws`, `kubernetes`, `postgres`, `sre`, `networking`)
to export only those.

### Format

Each `.txt` file contains a 4-column tab-separated format:

```
#separator:tab
#html:false
#tags column:4
# exported <YYYY-MM-DD> from toddcooke/learn <module>
<ID>\t<Front>\t<Back>\t<Tags>
```

- **ID** (col 1): stable module-qualified identifier (`<module>-<card-id>`), required for Anki to match and update notes on re-import
- **Front** (col 2): `<service> — <front>` (service name + question)
- **Back** (col 3): the answer/explanation
- **Tags** (col 4): hierarchical tags (`<module>::<domain-slug>`), where the domain is the card's section/topic bucket (5-8 per deck), not the per-card service name

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

## Deployment

This whole repo is referenced as a single git submodule in
`toddcooke.github.io` at `static/learn`. Hugo's static-passthrough copies
everything here verbatim into the published site, so
`kubernetes/index.html` ends up at `/learn/kubernetes/`, `aws/index.html`
at `/learn/aws/`, etc. `toddcooke.github.io` also runs an hourly workflow
that advances this submodule to its latest commit and redeploys
automatically — see that repo's `.github/workflows/sync-learn-submodules.yml`.
