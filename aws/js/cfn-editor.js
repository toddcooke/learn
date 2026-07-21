// aws/js/cfn-editor.js
//
// CodeMirror glue for the CloudFormation editor: YAML highlighting themed
// from the site's CSS variables, lint squiggles pulled from the page's
// cached compile (getDiagnostics — the editor never compiles anything
// itself), IntelliJ-style hover docs from cfnSchema, and schema-driven
// autocompletion. setText() is a programmatic swap (challenge open/Reveal/
// Reset): it clears the pending onDocChange debounce because its caller
// recompiles synchronously — only real typing reaches onDocChange.

import {
  EditorState, EditorView, keymap, lineNumbers, highlightActiveLine,
  highlightActiveLineGutter, drawSelection, hoverTooltip, defaultKeymap,
  history, historyKeymap, indentWithTab, indentOnInput, bracketMatching,
  syntaxHighlighting, HighlightStyle, indentUnit, linter, lintGutter,
  forceLinting, autocompletion, closeBrackets, completionKeymap,
  closeBracketsKeymap, searchKeymap, highlightSelectionMatches, yaml, tags,
} from './vendor/codemirror.js';
import { RESOURCE_TYPES, typeDoc, propDoc } from './lib/cfnSchema.js';

// CodeMirror injects these as literal CSS values, so var() references keep
// working across the site's light/dark palettes with no per-theme styles.
const siteTheme = EditorView.theme({
  '&': {
    fontSize: '13px',
    height: '100%',
    backgroundColor: 'var(--arch-surface)',
    color: 'var(--color-text)',
  },
  '.cm-content': {
    fontFamily: 'ui-monospace, SFMono-Regular, Menlo, monospace',
    caretColor: 'var(--color-text)',
  },
  '.cm-gutters': {
    backgroundColor: 'var(--arch-surface-muted)',
    color: 'var(--color-muted)',
    border: 'none',
  },
  '.cm-tooltip': {
    backgroundColor: 'var(--arch-surface)',
    color: 'var(--color-text)',
    border: '1px solid var(--color-border)',
  },
  '&.cm-focused': { outline: 'none' },
});

const cfnHighlight = HighlightStyle.define([
  { tag: tags.propertyName, color: 'var(--color-primary)' },
  { tag: tags.string, color: 'var(--color-success)' },
  { tag: tags.number, color: 'var(--color-danger)' },
  { tag: tags.bool, color: 'var(--color-danger)' },
  { tag: tags.comment, color: 'var(--color-muted)', fontStyle: 'italic' },
  { tag: tags.keyword, color: 'var(--color-primary-dark)' },
  { tag: tags.meta, color: 'var(--color-muted)' },
]);

// The resource block (logical id + Type) enclosing a line, found by
// scanning upward for the nearest 2-space-indented "  Name:" line. Text
// heuristics, not AST — good enough for completion/hover context and
// resilient to half-typed templates the parser can't finish.
function enclosingResource(state, lineNo) {
  for (let n = lineNo; n >= 1; n -= 1) {
    const lineText = state.doc.line(n).text;
    if (/^[A-Za-z]/.test(lineText)) return { logicalId: null, typeName: null };
    const m = /^ {2}([A-Za-z0-9]+):\s*$/.exec(lineText);
    if (m) {
      for (let k = n + 1; k <= state.doc.lines; k += 1) {
        const t = state.doc.line(k).text;
        if (/^ {0,2}\S/.test(t)) break;
        const tm = /^\s*Type:\s*([A-Za-z0-9:]+)\s*$/.exec(t);
        if (tm) return { logicalId: m[1], typeName: tm[1] };
      }
      return { logicalId: m[1], typeName: null };
    }
  }
  return { logicalId: null, typeName: null };
}

function cfnCompletions(getCompile, getRoles) {
  return (context) => {
    const { state, pos } = context;
    const line = state.doc.lineAt(pos);
    const before = line.text.slice(0, pos - line.from);

    // Enum values after "Prop: " when the schema constrains that property.
    // Must precede resource-type branch so schema-constrained Type properties
    // (e.g. ALB Type: application) complete their enum; resource-level Type
    // values contain ":" and fall through to resource-type completion.
    let m = /^\s*-?\s*([A-Za-z0-9]+):\s+([A-Za-z0-9.-]*)$/.exec(before);
    if (m) {
      const { typeName } = enclosingResource(state, line.number);
      const spec = typeName ? RESOURCE_TYPES[typeName] : null;
      const propSpec = spec ? spec.props[m[1]] : null;
      if (propSpec && propSpec.enum) {
        return {
          from: pos - m[2].length,
          options: propSpec.enum.map((v) => ({ label: String(v), type: 'constant' })),
          validFor: /^[A-Za-z0-9.-]*$/,
        };
      }
    }

    // Resource type names after "Type:".
    m = /Type:\s*([A-Za-z0-9:]*)$/.exec(before);
    if (m) {
      return {
        from: pos - m[1].length,
        options: Object.keys(RESOURCE_TYPES).map((t) => ({
          label: t, type: 'class', info: typeDoc(t) || undefined,
        })),
        validFor: /^[A-Za-z0-9:]*$/,
      };
    }

    // Logical ids after !Ref (or !GetAtt), filtered to the kind the
    // enclosing property expects when it is knowable from this line.
    m = /!(Ref|GetAtt)\s+([A-Za-z0-9.]*)$/.exec(before);
    if (m) {
      const compiled = getCompile();
      const propM = /^\s*-?\s*([A-Za-z0-9]+):/.exec(line.text);
      const { typeName } = enclosingResource(state, line.number);
      const spec = typeName ? RESOURCE_TYPES[typeName] : null;
      const propSpec = spec && propM ? spec.props[propM[1]] : null;
      const wanted = propSpec
        ? propSpec.ref || propSpec.refList || (propSpec.getAtt && propSpec.getAtt.kind) || null
        : null;
      const options = Object.entries(compiled.kinds || {})
        .filter(([, kind]) => !wanted || kind === wanted)
        .map(([id]) => ({ label: id, type: 'variable' }));
      return { from: pos - m[2].length, options, validFor: /^[A-Za-z0-9]*$/ };
    }

    // Property names inside a known resource.
    m = /^(\s+)([A-Za-z0-9]+)$/.exec(before);
    if (m) {
      const { typeName } = enclosingResource(state, line.number);
      const spec = typeName ? RESOURCE_TYPES[typeName] : null;
      if (spec) {
        return {
          from: pos - m[2].length,
          options: Object.entries(spec.props).map(([name, ps]) => ({
            label: name, type: 'property', info: ps.doc || undefined,
          })),
          validFor: /^[A-Za-z0-9]*$/,
        };
      }
    }

    // Role tag values: the previous line carries "Key: Role".
    m = /Value:\s*([A-Za-z0-9-]*)$/.exec(before);
    if (m && line.number > 1 && /Key:\s*Role\s*$/.test(state.doc.line(line.number - 1).text)) {
      return {
        from: pos - m[1].length,
        options: getRoles().map((r) => ({ label: r, type: 'constant' })),
        validFor: /^[A-Za-z0-9-]*$/,
      };
    }
    return null;
  };
}

function cfnHover(getCompile) {
  return hoverTooltip((view, pos) => {
    const line = view.state.doc.lineAt(pos);
    const col = pos - line.from;
    const tokenRe = /[A-Za-z0-9:!.-]+/g;
    let match = null;
    let m;
    while ((m = tokenRe.exec(line.text))) {
      if (m.index <= col && col <= m.index + m[0].length) { match = m; break; }
    }
    if (!match) return null;
    const word = match[0].replace(/:$/, '');
    let body = null;
    if (/^AWS::/.test(word)) {
      body = typeDoc(word) || 'No documentation found.';
    } else if (/^[A-Za-z0-9]+$/.test(word) && new RegExp(`^\\s*-?\\s*${word}:`).test(line.text)) {
      const { typeName } = enclosingResource(view.state, line.number);
      if (typeName && RESOURCE_TYPES[typeName] && RESOURCE_TYPES[typeName].props[word]) {
        body = propDoc(typeName, word) || 'No documentation found.';
      }
    }
    const under = (getCompile().diagnostics || []).filter((d) => d.from <= pos && pos <= d.to);
    if (!body && under.length === 0) return null;
    return {
      pos: line.from + match.index,
      end: line.from + match.index + word.length,
      above: true,
      create() {
        const dom = document.createElement('div');
        dom.className = 'cfn-hover';
        for (const d of under) {
          const p = document.createElement('div');
          p.className = `cfn-hover-diag cfn-${d.severity}`;
          p.textContent = d.message;
          dom.appendChild(p);
        }
        if (body) {
          const p = document.createElement('div');
          p.className = 'cfn-hover-doc';
          p.textContent = body;
          dom.appendChild(p);
        }
        return { dom };
      },
    };
  });
}

function resourceEnd(ranges) {
  let end = ranges.key[1];
  if (ranges.type) end = Math.max(end, ranges.type[1]);
  for (const r of Object.values(ranges.props || {})) end = Math.max(end, r[1]);
  return end;
}

export function createCfnEditor(mount, {
  initialText = '', getDiagnostics, getCompile, getRoles = () => [],
  onDocChange, onCursorResource = () => {},
}) {
  let docTimer = null;
  let lastCursorResource;

  const lintSource = (view) => {
    const docLen = view.state.doc.length;
    return getDiagnostics(view.state.doc.toString()).map((d) => ({
      from: Math.min(d.from, docLen),
      to: Math.min(Math.max(d.to, Math.min(d.from + 1, docLen)), docLen),
      severity: d.severity,
      message: d.message,
    }));
  };

  const updateListener = EditorView.updateListener.of((update) => {
    if (update.docChanged) {
      clearTimeout(docTimer);
      docTimer = setTimeout(() => onDocChange(update.state.doc.toString()), 250);
    }
    if (update.selectionSet || update.docChanged) {
      const pos = update.state.selection.main.head;
      const { sourceMap } = getCompile();
      let found = null;
      for (const [id, ranges] of Object.entries(sourceMap || {})) {
        if (pos >= ranges.key[0] && pos <= resourceEnd(ranges)) { found = id; break; }
      }
      if (found !== lastCursorResource) {
        lastCursorResource = found;
        onCursorResource(found);
      }
    }
  });

  const view = new EditorView({
    parent: mount,
    state: EditorState.create({
      doc: initialText,
      extensions: [
        lineNumbers(), highlightActiveLineGutter(), highlightActiveLine(),
        drawSelection(), history(), indentOnInput(), bracketMatching(), closeBrackets(),
        autocompletion({ override: [cfnCompletions(getCompile, getRoles)] }),
        highlightSelectionMatches(),
        keymap.of([
          ...closeBracketsKeymap, ...defaultKeymap, ...searchKeymap,
          ...historyKeymap, ...completionKeymap, indentWithTab,
        ]),
        yaml(),
        indentUnit.of('  '),
        syntaxHighlighting(cfnHighlight),
        siteTheme,
        linter(lintSource, { delay: 300 }),
        lintGutter(),
        cfnHover(getCompile),
        updateListener,
        EditorView.lineWrapping,
      ],
    }),
  });

  return {
    view,
    setText(text) {
      view.dispatch({ changes: { from: 0, to: view.state.doc.length, insert: text } });
      clearTimeout(docTimer);
      forceLinting(view);
    },
    getText() {
      return view.state.doc.toString();
    },
    revealResource(logicalId) {
      const { sourceMap } = getCompile();
      const ranges = sourceMap && sourceMap[logicalId];
      if (!ranges) return;
      const pos = Math.min(ranges.key[0], view.state.doc.length);
      view.dispatch({
        selection: { anchor: pos },
        effects: EditorView.scrollIntoView(pos, { y: 'center' }),
      });
      view.focus();
    },
    relint() {
      forceLinting(view);
    },
    destroy() {
      clearTimeout(docTimer);
      view.destroy();
    },
  };
}
