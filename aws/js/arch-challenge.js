// aws/js/arch-challenge.js
//
// Standalone page logic for architecture-challenge.html. Not part of the
// hash-router SPA and not in scripts/check-drift.mjs's SHARED list. The
// CloudFormation template text is the single source of truth: every edit
// compiles (js/lib/cfnCompile.js) into the arch model that the read-only
// canvas renders and Check validates; startState/refSolution model
// builders enter this world through js/lib/cfnEmit.js. All model logic
// lives in js/lib/ (pure, node --test covered); this file only wires the
// editor, the diagram, and the task panel together.

import { escapeHtml } from './lib/html.js';
import { createStore } from './lib/storage.js';
import { ARCH_CHALLENGES } from './data/archChallenges.js';
import { createArch } from './lib/archModel.js';
import { validateStructure, evaluateBestPractices } from './lib/archValidate.js';
import { evaluateGoals } from './lib/archGoals.js';
import { compile } from './lib/cfnCompile.js';
import { emit } from './lib/cfnEmit.js';
import { renderCanvas, unmountCanvas } from './arch-canvas.js';
import { createCfnEditor } from './cfn-editor.js';

const store = createStore();

const SANDBOX = {
  id: 'sandbox',
  title: 'Sandbox',
  brief: 'Free build: no goals, no grading. Structural checks and every best-practice '
    + 'rule run against whatever you design. Security groups model inbound rules only '
    + '(outbound is treated as allow-all).',
  roles: [],
  goals: [],
  bestPractices: 'all',
  hints: [],
  startState: null,
  refSolution: null,
};

let challenge = null;   // null = landing
let compiled = { arch: null, diagnostics: [], sourceMap: {}, idMap: null, kinds: {} };
let lastGoodArch = createArch(); // diagram fallback while the template has errors
let lastGoodIdMap = null;
let checkDiagnostics = [];      // Check-time structural errors mapped onto the text
let results = null;             // { errors, goalRows, bpRows } from the last Check
let hintsShown = 0;
let failedChecks = 0;
let highlightId = null;         // model id of the resource under the editor cursor
let editor = null;

function findChallenge(id) {
  if (id === 'sandbox') return SANDBOX;
  return ARCH_CHALLENGES.find((c) => c.id === id) || null;
}

function startText() {
  return emit(challenge.startState ? challenge.startState() : createArch());
}

// The draft is YAML text. Legacy visual-builder drafts (JSON models) are
// migrated by serializing them once, then cleared so this runs only once.
function draftText() {
  const text = store.getArchCfnText(challenge.id);
  if (text !== null) return text;
  const legacy = store.getArchDraft(challenge.id);
  if (legacy) {
    const migrated = emit(legacy);
    store.setArchCfnText(challenge.id, migrated);
    store.clearArchDraft(challenge.id);
    return migrated;
  }
  return startText();
}

function errorCount() {
  return compiled.diagnostics.filter((d) => d.severity === 'error').length;
}

function recompile(text) {
  compiled = compile(text);
  checkDiagnostics = []; // stale the moment the text changes
  if (compiled.arch) {
    lastGoodArch = compiled.arch;
    lastGoodIdMap = compiled.idMap;
  }
}

function ensureEditor() {
  if (editor) return;
  editor = createCfnEditor(document.getElementById('arch-editor-host'), {
    initialText: '',
    getDiagnostics: () => [...compiled.diagnostics, ...checkDiagnostics],
    getCompile: () => compiled,
    getRoles: () => (challenge ? challenge.roles.map((r) => r.id) : []),
    onDocChange: (text) => {
      if (!challenge) return; // debounce survivor after navigating to landing
      recompile(text);
      store.setArchCfnText(challenge.id, text); // text autosaves even while invalid
      results = null;
      renderDiagram();
      renderTask(document.getElementById('arch-task'));
    },
    onCursorResource: (logicalId) => {
      const idMap = compiled.idMap || lastGoodIdMap;
      highlightId = idMap && logicalId ? idMap.logicalToModel[logicalId] || null : null;
      if (challenge) renderDiagram();
    },
  });
}

// Programmatic text swaps (open/reveal/reset) recompile synchronously —
// setText never fires onDocChange.
function swapText(text) {
  recompile(text);
  store.setArchCfnText(challenge.id, text);
  ensureEditor();
  editor.setText(text);
  results = null;
  highlightId = null;
}

function openFromHash() {
  const id = window.location.hash.replace(/^#\/?/, '');
  challenge = findChallenge(id);
  results = null;
  hintsShown = 0;
  failedChecks = 0;
  highlightId = null;
  checkDiagnostics = [];
  if (challenge) {
    lastGoodArch = createArch();
    lastGoodIdMap = null;
    swapText(draftText());
  }
  renderAll();
}

function renderAll() {
  const landing = document.getElementById('arch-landing');
  const workbench = document.getElementById('arch-workbench');
  landing.hidden = !!challenge;
  workbench.hidden = !challenge;
  if (!challenge) {
    unmountCanvas();
    renderLanding(landing);
    return;
  }
  renderHead(document.getElementById('arch-head'));
  renderDiagram();
  renderTask(document.getElementById('arch-task'));
}

function renderDiagram() {
  renderCanvas(document.getElementById('arch-canvas'), {
    arch: compiled.arch || lastGoodArch,
    highlightId,
    stale: compiled.arch ? null : { errors: errorCount() },
    onNodeClick: (modelId) => {
      const idMap = compiled.idMap || lastGoodIdMap;
      const logicalId = idMap ? idMap.modelToLogical[modelId] : null;
      if (logicalId) editor.revealResource(logicalId);
    },
  });
}

function renderLanding(mount) {
  const done = store.getArchResults();
  const cards = ARCH_CHALLENGES.map((ch, i) => {
    const result = done[ch.id];
    const badge = result
      ? `<p class="badge-done">✓ Completed — best practices ${Number(result.bpPassed)}/${Number(result.bpApplicable) || '–'}</p>`
      : '<p class="arch-mini">Not completed yet</p>';
    const truncated = ch.brief.length > 110 ? `${ch.brief.slice(0, 110)}…` : ch.brief;
    return `
      <a class="arch-card" href="#${ch.id}">
        <h3>${i + 1}. ${escapeHtml(ch.title)}</h3>
        <p class="arch-mini">${escapeHtml(truncated)}</p>
        ${badge}
      </a>`;
  }).join('');
  mount.innerHTML = `
    <p>Each challenge gives you a scenario; write the CloudFormation template that
       satisfies it in a live editor with error checking, docs on hover, and
       autocompletion. The diagram renders your template as you type. Designs are
       checked three ways: <strong>structural</strong> (would AWS accept it),
       <strong>functional</strong> (a connectivity simulation of the scenario's goals), and
       <strong>best practices</strong> (advisory score). Drafts autosave locally.</p>
    <div class="arch-cards">
      ${cards}
      <a class="arch-card" href="#sandbox"><h3>Sandbox</h3>
        <p class="arch-mini">Free build with live structural + best-practice checks. No goals.</p></a>
    </div>`;
}

function renderHead(mount) {
  mount.innerHTML = `
    <p><a href="#">← All challenges</a></p>
    <h2>${escapeHtml(challenge.title)}</h2>
    <p>${escapeHtml(challenge.brief)}</p>`;
}

function runCheck() {
  if (!compiled.arch) return;
  const arch = compiled.arch;
  const { errors } = validateStructure(arch);
  const goalRows = errors.length === 0 ? evaluateGoals(arch, challenge) : null;
  const bpRows = evaluateBestPractices(arch, challenge.bestPractices);
  results = { errors, goalRows, bpRows };
  // Mirror structural errors into the editor where a resource maps back to
  // a template range (best-effort; the panel remains the full list).
  checkDiagnostics = [];
  for (const e of errors) {
    for (const rid of e.resourceIds || []) {
      const logicalId = compiled.idMap.modelToLogical[rid];
      const ranges = logicalId ? compiled.sourceMap[logicalId] : null;
      if (ranges) checkDiagnostics.push({ from: ranges.key[0], to: ranges.key[1], severity: 'error', message: e.message });
    }
  }
  editor.relint();
  const complete = errors.length === 0 && challenge.goals.length > 0
    && goalRows.every((r) => r.ok);
  if (complete && challenge.id !== 'sandbox') {
    const applicable = bpRows.filter((r) => r.applicable);
    store.recordArchResult(challenge.id, {
      completedAt: Date.now(),
      bpPassed: applicable.filter((r) => r.ok).length,
      bpApplicable: applicable.length,
    });
  } else if (!complete) {
    failedChecks += 1;
  }
  renderAll();
}

function renderTask(mount) {
  const arch = compiled.arch || lastGoodArch;
  const rolesHtml = challenge.roles.map((role) => {
    const assigned = arch.workloads.filter((w) => w.role === role.id);
    return `<li>${escapeHtml(role.label)}: ${assigned.length
      ? escapeHtml(assigned.map((w) => w.name).join(', '))
      : '<em>unassigned — add a Role tag</em>'}</li>`;
  }).join('');

  let resultsHtml = '';
  if (results) {
    if (results.errors.length > 0) {
      resultsHtml += `<h3>Structural problems (fix these first)</h3>
        ${results.errors.map((e) => `<div class="arch-goal fail">${escapeHtml(e.message)}</div>`).join('')}`;
    } else if (results.goalRows && results.goalRows.length > 0) {
      const allOk = results.goalRows.every((r) => r.ok);
      resultsHtml += `<h3>Goals ${allOk ? '— all satisfied 🎉' : ''}</h3>`;
      resultsHtml += results.goalRows.map((row) => {
        const traces = row.traces.map((t) => `
          <details ${t.ok ? '' : 'open'}><summary class="arch-mini">${escapeHtml(t.title)}</summary>
            <ul class="arch-trace">${t.trace.map((s) => `<li class="${s.ok ? 'ok' : 'fail'}">${escapeHtml(s.label)}</li>`).join('')}</ul>
          </details>`).join('');
        return `<div class="arch-goal ${row.ok ? 'ok' : 'fail'}">
          ${escapeHtml(row.label)}
          <p class="arch-mini">${escapeHtml(row.detail)}</p>${traces}</div>`;
      }).join('');
    }
    const applicable = results.bpRows.filter((r) => r.applicable);
    if (applicable.length > 0) {
      const passed = applicable.filter((r) => r.ok).length;
      resultsHtml += `<h3>Best practices</h3>
        <p class="arch-score">${passed}/${applicable.length}</p>
        ${applicable.map((r) => `<div class="arch-goal ${r.ok ? 'ok' : 'fail'}">
          ${escapeHtml(r.message)}${r.ok ? '' : `<p class="arch-mini">Why: ${escapeHtml(r.why)}</p>`}</div>`).join('')}`;
    }
  }

  const hintsHtml = challenge.hints.length === 0 ? '' : `
    ${challenge.hints.slice(0, hintsShown).map((h) => `<p class="arch-mini">💡 ${escapeHtml(h)}</p>`).join('')}
    ${hintsShown < challenge.hints.length
      ? `<button type="button" data-action="hint">Hint ${hintsShown + 1}/${challenge.hints.length}</button>` : ''}`;

  const reveal = challenge.refSolution && failedChecks >= 1
    ? '<button type="button" data-action="reveal">Show reference solution</button>' : '';
  const blocked = errorCount() > 0;

  mount.innerHTML = `
    <h2>${challenge.id === 'sandbox' ? 'Checks' : 'Task'}</h2>
    ${challenge.roles.length ? `<ul>${rolesHtml}</ul>` : ''}
    <div class="arch-row">
      <button type="button" data-action="check" ${blocked ? 'disabled' : ''}>Check architecture</button>
      <button type="button" data-action="reset">Reset</button>
      ${reveal}
    </div>
    ${blocked ? '<p class="arch-mini">Fix the template errors (red underlines) to enable Check.</p>' : ''}
    ${hintsHtml}
    ${results ? resultsHtml : '<p class="arch-mini">Edit the template, then hit Check. Results explain every pass and fail.</p>'}`;
}

window.addEventListener('hashchange', openFromHash);

document.getElementById('arch-task').addEventListener('click', (event) => {
  const el = event.target.closest('button[data-action]');
  if (!el) return;
  if (el.dataset.action === 'check') runCheck();
  if (el.dataset.action === 'hint') { hintsShown += 1; renderAll(); }
  if (el.dataset.action === 'reveal'
      && window.confirm('Replace your current template with the reference solution?')) {
    swapText(emit(challenge.refSolution()));
    renderAll();
  }
  if (el.dataset.action === 'reset'
      && window.confirm('Discard your template and start this challenge over?')) {
    store.clearArchCfnText(challenge.id);
    store.clearArchDraft(challenge.id);
    swapText(startText());
    renderAll();
  }
});

openFromHash();
