# learn

Hub for Todd Cooke's learning modules, published at https://toddcooke.github.io/learn/.

Each module lives in its own subfolder and publishes at `https://toddcooke.github.io/learn/<module>/`. Pushing to `main` deploys automatically via GitHub Actions (see `.github/workflows/pages.yml`).

## Modules

- [`aws/`](aws) — AWS Certified Solutions Architect – Associate (SAA-C03) exam prep, published at https://toddcooke.github.io/learn/aws/

## Adding a module

Add a new top-level folder (e.g. `gcp/`) with its own `index.html` entry point — everything in this project uses relative paths, so a module works unmodified at whatever path it's nested under. Link to it from the root `index.html`.
