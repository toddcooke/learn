# Vendored bundles

Prebuilt ESM bundles; the site stays buildless at runtime. Rebuilt only by
re-running the commands below and replacing these files wholesale.

## codemirror.js

- Entry re-exports (see `cm-entry.js` contents below): state, view,
  commands, language, lint, autocomplete, search, lang-yaml, lezer/highlight.
- Versions (from `npm ls --depth=0` on 2026-07-21):
  - @codemirror/autocomplete@6.20.3
  - @codemirror/commands@6.10.4
  - @codemirror/lang-yaml@6.1.3
  - @codemirror/language@6.12.4
  - @codemirror/lint@6.9.7
  - @codemirror/search@6.7.1
  - @codemirror/state@6.7.1
  - @codemirror/view@6.43.6
  - @lezer/highlight@1.2.3
  - esbuild@0.28.1 (build tool only, not part of the bundle)
- License: MIT (https://github.com/codemirror/dev)

## yaml.js

- Package: yaml (eemeli/yaml) 2.9.0
- License: ISC (https://github.com/eemeli/yaml)

## Rebuild

Work in a temp dir outside the repo. Only the two `.js` bundles and this
README are checked in — `node_modules`, `package.json`, and the entry files
below are not.

    mkdir vendor-build && cd vendor-build
    npm init -y
    npm install esbuild @codemirror/state @codemirror/view @codemirror/commands \
      @codemirror/language @codemirror/lint @codemirror/autocomplete \
      @codemirror/search @codemirror/lang-yaml @lezer/highlight yaml

Create `cm-entry.js`:

```js
export { EditorState, StateEffect } from '@codemirror/state';
export {
  EditorView, keymap, lineNumbers, highlightActiveLine, highlightActiveLineGutter,
  drawSelection, hoverTooltip,
} from '@codemirror/view';
export { defaultKeymap, history, historyKeymap, indentWithTab } from '@codemirror/commands';
export {
  indentOnInput, bracketMatching, syntaxHighlighting, HighlightStyle, indentUnit,
} from '@codemirror/language';
export { linter, lintGutter, forceLinting } from '@codemirror/lint';
export {
  autocompletion, closeBrackets, completionKeymap, closeBracketsKeymap,
} from '@codemirror/autocomplete';
export { searchKeymap, highlightSelectionMatches } from '@codemirror/search';
export { yaml } from '@codemirror/lang-yaml';
export { tags } from '@lezer/highlight';
```

Create `yaml-entry.js`:

```js
export { parseDocument, visit, isMap, isSeq, isScalar, isPair, LineCounter } from 'yaml';
```

Build (minified keeps the checked-in blobs manageable):

    npx esbuild cm-entry.js  --bundle --format=esm --minify --outfile=codemirror.js
    npx esbuild yaml-entry.js --bundle --format=esm --minify --outfile=yaml.js
    cp codemirror.js yaml.js <repo>/aws/js/vendor/

## Smoke test

    cd <repo>
    node --input-type=module -e "
    import { parseDocument } from './aws/js/vendor/yaml.js';
    const d = parseDocument('a: 1');
    console.log(d.toJS().a === 1 ? 'yaml OK' : 'yaml FAIL');
    "
    node --input-type=module -e "
    import * as cm from './aws/js/vendor/codemirror.js';
    console.log(typeof cm.EditorView === 'function' && typeof cm.linter === 'function' ? 'cm OK' : 'cm FAIL');
    "
