// aws/js/arch-challenge.js
//
// Standalone page logic for architecture-challenge.html. Not part of the
// hash-router SPA and not in scripts/check-drift.mjs's SHARED list. The
// service diagram ({ nodes, edges }) is the single source of truth: the
// canvas builder (svc-canvas.js) edits it, and Check runs the structural
// validator, the goal evaluator, and the best-practice rules straight on
// it. All model logic lives in js/lib/ (pure, node --test covered); this
// file wires the canvas and the task panel together.

import { escapeHtml } from './lib/html.js';
import { createStore } from './lib/storage.js';
import { SVC_CHALLENGES } from './data/svcChallenges.js';
import { createGraph } from './lib/svcModel.js';
import { validateStructure, evaluateBestPractices } from './lib/svcValidate.js';
import { evaluateGoals } from './lib/svcGoals.js';
import { renderGraphCanvas, unmountGraphCanvas } from './svc-canvas.js';

const store = createStore();

const SANDBOX = {
  id: 'sandbox',
  title: 'Sandbox',
  brief: 'Free build: no goals, no grading. Place any services, wire any flows — '
    + 'structural checks and every best-practice rule run against whatever you '
    + 'design.',
  roles: [],
  goals: [],
  bestPractices: 'all',
  hints: [],
  startState: null,
  refSolution: null,
};

let challenge = null; // null = landing
let graph = null;
let results = null;   // { errors, goalRows, bpRows } from the last Check
let hintsShown = 0;
let failedChecks = 0;

function findChallenge(id) {
  if (id === 'sandbox') return SANDBOX;
  return SVC_CHALLENGES.find((c) => c.id === id) || null;
}

function startGraph() {
  return challenge.startState ? challenge.startState() : createGraph();
}

// The draft is a service graph; a corrupted draft must degrade to the
// start state, never a blank page.
function draftGraph() {
  return store.getSvcGraph(challenge.id) || startGraph();
}

function openFromHash() {
  // Direct hash jumps between challenges never pass through the landing
  // branch — clear canvas selection/gesture state here so nothing (like a
  // same-shaped edge selection) survives into the next challenge.
  unmountGraphCanvas();
  const id = window.location.hash.replace(/^#\/?/, '');
  challenge = findChallenge(id);
  results = null;
  hintsShown = 0;
  failedChecks = 0;
  graph = challenge ? draftGraph() : null;
  renderAll();
}

// Every committed edit funnels through here: persist the draft,
// invalidate stale results, re-render everything.
function changed() {
  store.setSvcGraph(challenge.id, graph);
  results = null;
  renderAll();
}

// Card moves are presentation-only: persist positions without touching
// Check results or forcing a re-render (the canvas already moved the DOM).
function layoutChanged() {
  store.setSvcGraph(challenge.id, graph);
}

// Renames re-render without invalidating Check results — a name only
// changes labels, and the canvas defers this call so the click that blurred
// the name input isn't swallowed by the re-render.
function softChanged() {
  store.setSvcGraph(challenge.id, graph);
  renderAll();
}

function renderAll() {
  const landing = document.getElementById('arch-landing');
  const workbench = document.getElementById('arch-workbench');
  landing.hidden = !!challenge;
  workbench.hidden = !challenge;
  if (!challenge) {
    unmountGraphCanvas();
    renderLanding(landing);
    return;
  }
  renderHead(document.getElementById('arch-head'));
  renderGraphCanvas(document.getElementById('arch-forms'), {
    graph, challenge, onChange: changed, onLayout: layoutChanged, onSoftChange: softChanged,
  });
  renderTask(document.getElementById('arch-task'));
}

function renderLanding(mount) {
  const done = store.getArchResults();
  const cards = SVC_CHALLENGES.map((ch, i) => {
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
    <p>Each challenge gives you a scenario; sketch the AWS architecture that
       satisfies it the way AWS reference diagrams are drawn — service boxes and
       data-flow arrows, no VPC plumbing. Designs are checked three ways:
       <strong>structural</strong> (is the diagram coherent), <strong>functional</strong>
       (do the required flows connect), and <strong>best practices</strong>
       (advisory score). Drafts autosave locally. For subnet-level practice, use the
       <a href="vpc-explorer.html">VPC Explorer</a>.</p>
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
  const errors = validateStructure(graph).errors;
  const goalRows = errors.length === 0 ? evaluateGoals(graph, challenge) : null;
  const bpRows = evaluateBestPractices(graph, challenge.bestPractices);
  results = { errors, goalRows, bpRows };
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
  const rolesHtml = challenge.roles.map((role) => {
    const assigned = graph.nodes.filter((n) => n.role === role.id);
    return `<li>${escapeHtml(role.label)}: ${assigned.length
      ? escapeHtml(assigned.map((n) => n.name).join(', '))
      : '<em>unassigned — set a card’s Role</em>'}</li>`;
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

  mount.innerHTML = `
    <h2>${challenge.id === 'sandbox' ? 'Checks' : 'Task'}</h2>
    ${challenge.roles.length ? `<ul>${rolesHtml}</ul>` : ''}
    <div class="arch-row">
      <button type="button" data-action="check">Check architecture</button>
      <button type="button" data-action="reset">Reset</button>
      ${reveal}
    </div>
    ${hintsHtml}
    ${results ? resultsHtml : '<p class="arch-mini">Build, then hit Check. Results explain every pass and fail.</p>'}`;
}

window.addEventListener('hashchange', openFromHash);

document.getElementById('arch-task').addEventListener('click', (event) => {
  const el = event.target.closest('button[data-action]');
  if (!el) return;
  if (el.dataset.action === 'check') runCheck();
  if (el.dataset.action === 'hint') { hintsShown += 1; renderAll(); }
  if (el.dataset.action === 'reveal'
      && window.confirm('Replace your current design with the reference solution?')) {
    unmountGraphCanvas(); // stale selection must not re-attach to same-id nodes
    graph = challenge.refSolution();
    changed();
  }
  if (el.dataset.action === 'reset'
      && window.confirm('Discard your design and start this challenge over?')) {
    unmountGraphCanvas(); // as above — the fresh start state reuses node ids
    store.clearSvcGraph(challenge.id);
    graph = startGraph();
    results = null;
    hintsShown = 0;   // a fresh attempt starts with hints and the
    failedChecks = 0; // reference-solution reveal re-gated, like openFromHash
    renderAll();
  }
});

openFromHash();
