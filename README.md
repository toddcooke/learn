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
to export only those. Each file only needs the deck picked/created once
in Anki's own Import dialog — the script doesn't assume a deck name.

## Deployment

This whole repo is referenced as a single git submodule in
`toddcooke.github.io` at `static/learn`. Hugo's static-passthrough copies
everything here verbatim into the published site, so
`kubernetes/index.html` ends up at `/learn/kubernetes/`, `aws/index.html`
at `/learn/aws/`, etc. `toddcooke.github.io` also runs an hourly workflow
that advances this submodule to its latest commit and redeploys
automatically — see that repo's `.github/workflows/sync-learn-submodules.yml`.
