// aws/js/arch-challenge.js
//
// Standalone page logic for architecture-challenge.html. Not part of the
// hash-router SPA and not in scripts/check-drift.mjs's SHARED list. All
// validation/simulation logic lives in js/lib/ (pure, node --test covered);
// this file only renders and wires the DOM. Re-renders happen on 'change'
// (committed edits), so text inputs keep focus while typing.

import { escapeHtml } from './lib/html.js';
import { createStore } from './lib/storage.js';
import { ARCH_CHALLENGES } from './data/archChallenges.js';
import {
  AZS, createArch,
  getSubnet, getRouteTable, getSecurityGroup,
  addSubnet, updateSubnet, removeSubnet, addNat, removeNat,
  addRouteTable, removeRouteTable, addRoute, removeRoute,
  associateSubnet, disassociateSubnet,
  addSecurityGroup, removeSecurityGroup, addSgRule, removeSgRule,
  addWorkload, updateWorkload, removeWorkload,
  isPublicSubnet, effectiveRouteTable,
} from './lib/archModel.js';
import { validateStructure, evaluateBestPractices } from './lib/archValidate.js';
import { evaluateGoals } from './lib/archGoals.js';

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

let challenge = null; // null = landing
let arch = null;
let results = null;      // { errors, goalRows, bpRows } from the last Check
let hintsShown = 0;
let failedChecks = 0;

function findChallenge(id) {
  if (id === 'sandbox') return SANDBOX;
  return ARCH_CHALLENGES.find((c) => c.id === id) || null;
}

function openFromHash() {
  const id = window.location.hash.replace(/^#\/?/, '');
  challenge = findChallenge(id);
  results = null;
  hintsShown = 0;
  failedChecks = 0;
  if (challenge) {
    arch = store.getArchDraft(challenge.id)
      || (challenge.startState ? challenge.startState() : createArch());
  } else {
    arch = null;
  }
  renderAll();
}

// Every committed edit funnels through here: persist the draft, invalidate
// stale results, re-render everything.
function changed() {
  store.setArchDraft(challenge.id, arch);
  results = null;
  renderAll();
}

function renderAll() {
  const landing = document.getElementById('arch-landing');
  const workbench = document.getElementById('arch-workbench');
  landing.hidden = !!challenge;
  workbench.hidden = !challenge;
  if (!challenge) {
    renderLanding(landing);
    return;
  }
  renderHead(document.getElementById('arch-head'));
  renderBuilder(document.getElementById('arch-builder'));
  renderDiagram(document.getElementById('arch-diagram'));
  renderTask(document.getElementById('arch-task'));
}

function renderLanding(mount) {
  const done = store.getArchResults();
  const cards = ARCH_CHALLENGES.map((ch, i) => {
    const result = done[ch.id];
    const badge = result
      ? `<p class="badge-done">✓ Completed — best practices ${result.bpPassed}/${result.bpApplicable || '–'}</p>`
      : '<p class="arch-mini">Not completed yet</p>';
    return `
      <a class="arch-card" href="#${ch.id}">
        <h3>${i + 1}. ${escapeHtml(ch.title)}</h3>
        <p class="arch-mini">${escapeHtml(ch.brief.slice(0, 110))}…</p>
        ${badge}
      </a>`;
  }).join('');
  mount.innerHTML = `
    <p>Each challenge gives you a scenario; build the architecture that satisfies it.
       Your design is checked three ways: <strong>structural</strong> (would AWS accept it),
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

window.addEventListener('hashchange', openFromHash);
openFromHash();

function options(list, selected, labelFor) {
  return list.map((item) => {
    const value = typeof item === 'string' ? item : item.id;
    const label = labelFor ? labelFor(item) : value;
    return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function renderBuilder(mount) {
  const subnetOpts = (sel) => options(arch.subnets, sel, (s) => `${s.name} (${s.cidr}, AZ ${s.az})`);
  const roleOpts = ['', ...challenge.roles.map((r) => r.id)];

  const subnetRows = arch.subnets.map((s) => `
    <div class="arch-row">
      <input type="text" value="${escapeHtml(s.name)}" data-action="subnet-name" data-id="${s.id}" aria-label="Subnet name" />
      <select data-action="subnet-az" data-id="${s.id}" aria-label="AZ">${options(AZS, s.az, null)}</select>
      <input type="text" value="${escapeHtml(s.cidr)}" data-action="subnet-cidr" data-id="${s.id}" aria-label="Subnet CIDR" />
      <button type="button" class="arch-del" data-action="subnet-del" data-id="${s.id}" title="Delete subnet">✕</button>
    </div>`).join('');

  const natRows = arch.natGateways.map((n) => `
    <div class="arch-row">
      <span class="arch-mini">${n.id} in</span>
      <select data-action="nat-subnet" data-id="${n.id}" aria-label="NAT subnet">${subnetOpts(n.subnetId)}</select>
      <button type="button" class="arch-del" data-action="nat-del" data-id="${n.id}" title="Delete NAT">✕</button>
    </div>`).join('');

  const targetOpts = (sel) => options(
    ['igw', ...arch.natGateways.map((n) => `nat:${n.id}`)], sel, null,
  );
  const rtSections = arch.routeTables.map((rt) => {
    const routeRows = rt.routes.map((r, i) => `
      <div class="arch-row">
        <input type="text" value="${escapeHtml(r.destCidr)}" data-action="route-dest" data-id="${rt.id}" data-index="${i}" aria-label="Destination CIDR" />
        <span class="arch-mini">→</span>
        <select data-action="route-target" data-id="${rt.id}" data-index="${i}" aria-label="Route target">${targetOpts(r.target)}</select>
        <button type="button" class="arch-del" data-action="route-del" data-id="${rt.id}" data-index="${i}">✕</button>
      </div>`).join('');
    const assocBoxes = arch.subnets.map((s) => {
      const isHere = rt.subnetIds.includes(s.id);
      return `<label class="arch-mini"><input type="checkbox" data-action="rt-assoc" data-id="${rt.id}" data-subnet="${s.id}" ${isHere ? 'checked' : ''}/> ${escapeHtml(s.name)}</label>`;
    }).join(' ');
    return `
      <div class="arch-section">
        <h3>${escapeHtml(rt.name)}${rt.isMain && rt.name.toLowerCase() !== 'main' ? ' (main)' : ''}
          ${rt.isMain ? '' : `<button type="button" class="arch-del" data-action="rt-del" data-id="${rt.id}">✕</button>`}</h3>
        <p class="arch-mini">local route (${escapeHtml(arch.vpc.cidr)}) is implicit</p>
        ${routeRows}
        <button type="button" class="arch-add" data-action="route-add" data-id="${rt.id}">+ route</button>
        <p class="arch-mini">Associated subnets: ${assocBoxes || '<em>none (subnets default to main)</em>'}</p>
      </div>`;
  }).join('');

  const sgSections = arch.securityGroups.map((sg) => {
    const ruleRows = sg.inbound.map((r, i) => `
      <div class="arch-row">
        <span class="arch-mini">TCP</span>
        <input type="number" value="${r.portFrom}" data-action="rule-portfrom" data-id="${sg.id}" data-index="${i}" aria-label="Port from" />
        <span class="arch-mini">–</span>
        <input type="number" value="${r.portTo}" data-action="rule-portto" data-id="${sg.id}" data-index="${i}" aria-label="Port to" />
        <span class="arch-mini">from</span>
        <input type="text" value="${escapeHtml(r.source)}" list="arch-sg-sources" data-action="rule-source" data-id="${sg.id}" data-index="${i}" aria-label="Source" />
        <button type="button" class="arch-del" data-action="rule-del" data-id="${sg.id}" data-index="${i}">✕</button>
      </div>`).join('');
    return `
      <div class="arch-section">
        <h3><input type="text" value="${escapeHtml(sg.name)}" data-action="sg-name" data-id="${sg.id}" aria-label="Security group name" />
          <button type="button" class="arch-del" data-action="sg-del" data-id="${sg.id}">✕</button></h3>
        ${ruleRows || '<p class="arch-mini">No inbound rules — denies all inbound.</p>'}
        <button type="button" class="arch-add" data-action="rule-add" data-id="${sg.id}">+ inbound rule</button>
      </div>`;
  }).join('');

  const wlSections = arch.workloads.map((wl) => {
    const subnetBoxes = arch.subnets.map((s) => `
      <label class="arch-mini"><input type="checkbox" data-action="wl-subnet" data-id="${wl.id}" data-subnet="${s.id}"
        ${wl.subnetIds.includes(s.id) ? 'checked' : ''}/> ${escapeHtml(s.name)}</label>`).join(' ');
    const sgBoxes = arch.securityGroups.map((g) => `
      <label class="arch-mini"><input type="checkbox" data-action="wl-sg" data-id="${wl.id}" data-sg="${g.id}"
        ${wl.sgIds.includes(g.id) ? 'checked' : ''}/> ${escapeHtml(g.name)}</label>`).join(' ');
    const roleSelect = challenge.roles.length === 0 ? '' : `
      <label class="arch-mini">role
        <select data-action="wl-role" data-id="${wl.id}">
          ${options(roleOpts, wl.role || '', (id) => id || '(none)')}
        </select></label>`;
    const typeBits = wl.type === 'ec2'
      ? `<label class="arch-mini"><input type="checkbox" data-action="wl-publicip" data-id="${wl.id}" ${wl.publicIp ? 'checked' : ''}/> public IP</label>`
      : wl.type === 'rds'
        ? `<label class="arch-mini"><input type="checkbox" data-action="wl-multiaz" data-id="${wl.id}" ${wl.multiAz ? 'checked' : ''}/> Multi-AZ</label>`
        : '';
    return `
      <div class="arch-section">
        <h3>${wl.type.toUpperCase()}
          <input type="text" value="${escapeHtml(wl.name)}" data-action="wl-name" data-id="${wl.id}" aria-label="Workload name" />
          <button type="button" class="arch-del" data-action="wl-del" data-id="${wl.id}">✕</button></h3>
        <div class="arch-row">${roleSelect}
          <label class="arch-mini">port <input type="number" value="${wl.port}" data-action="wl-port" data-id="${wl.id}" /></label>
          ${typeBits}</div>
        <p class="arch-mini">Subnets: ${subnetBoxes || '<em>create subnets first</em>'}</p>
        <p class="arch-mini">Security groups: ${sgBoxes || '<em>none defined</em>'}</p>
      </div>`;
  }).join('');

  mount.innerHTML = `
    <h2>Builder</h2>
    <datalist id="arch-sg-sources">
      <option value="0.0.0.0/0"></option>
      ${arch.securityGroups.map((g) => `<option value="sg:${g.id}">${escapeHtml(g.name)}</option>`).join('')}
    </datalist>
    <div class="arch-section">
      <h3>VPC</h3>
      <div class="arch-row">
        <label class="arch-mini">CIDR <input type="text" value="${escapeHtml(arch.vpc.cidr)}" data-action="vpc-cidr" /></label>
        <label class="arch-mini"><input type="checkbox" data-action="vpc-igw" ${arch.vpc.igwAttached ? 'checked' : ''}/> Internet gateway attached</label>
      </div>
    </div>
    <div class="arch-section"><h3>Subnets</h3>${subnetRows}
      <button type="button" class="arch-add" data-action="subnet-add">+ subnet</button></div>
    <div class="arch-section"><h3>NAT gateways</h3>${natRows}
      <button type="button" class="arch-add" data-action="nat-add" ${arch.subnets.length ? '' : 'disabled'}>+ NAT gateway</button></div>
    ${rtSections}
    <button type="button" class="arch-add" data-action="rt-add">+ route table</button>
    ${sgSections}
    <button type="button" class="arch-add" data-action="sg-add">+ security group</button>
    ${wlSections}
    <div class="arch-row">
      <button type="button" data-action="wl-add" data-type="ec2" ${arch.subnets.length ? '' : 'disabled'}>+ EC2</button>
      <button type="button" data-action="wl-add" data-type="alb" ${arch.subnets.length ? '' : 'disabled'}>+ ALB</button>
      <button type="button" data-action="wl-add" data-type="rds" ${arch.subnets.length ? '' : 'disabled'}>+ RDS</button>
    </div>
    <p class="arch-mini">Simplification: security groups are inbound-only here; outbound is allow-all.</p>`;
}

// One delegated handler pair drives every builder control.
const ACTIONS = {
  'vpc-cidr': (el) => { arch.vpc.cidr = el.value.trim(); },
  'vpc-igw': (el) => { arch.vpc.igwAttached = el.checked; },
  'subnet-add': () => { addSubnet(arch, { az: 'a', cidr: '' }); },
  'subnet-name': (el) => { updateSubnet(arch, el.dataset.id, { name: el.value.trim() }); },
  'subnet-az': (el) => { updateSubnet(arch, el.dataset.id, { az: el.value }); },
  'subnet-cidr': (el) => { updateSubnet(arch, el.dataset.id, { cidr: el.value.trim() }); },
  'subnet-del': (el) => { removeSubnet(arch, el.dataset.id); },
  'nat-add': () => { addNat(arch, arch.subnets[0].id); },
  'nat-subnet': (el) => { const nat = arch.natGateways.find((n) => n.id === el.dataset.id); if (nat) nat.subnetId = el.value; },
  'nat-del': (el) => { removeNat(arch, el.dataset.id); },
  'rt-add': () => { addRouteTable(arch); },
  'rt-del': (el) => { removeRouteTable(arch, el.dataset.id); },
  'route-add': (el) => { addRoute(arch, el.dataset.id, { destCidr: '0.0.0.0/0', target: 'igw' }); },
  'route-dest': (el) => {
    const rt = getRouteTable(arch, el.dataset.id);
    if (rt && rt.routes[el.dataset.index]) rt.routes[el.dataset.index].destCidr = el.value.trim();
  },
  'route-target': (el) => {
    const rt = getRouteTable(arch, el.dataset.id);
    if (rt && rt.routes[el.dataset.index]) rt.routes[el.dataset.index].target = el.value;
  },
  'route-del': (el) => { removeRoute(arch, el.dataset.id, Number(el.dataset.index)); },
  'rt-assoc': (el) => {
    if (el.checked) associateSubnet(arch, el.dataset.id, el.dataset.subnet);
    else disassociateSubnet(arch, el.dataset.subnet);
  },
  'sg-add': () => { addSecurityGroup(arch); },
  'sg-name': (el) => { const sg = getSecurityGroup(arch, el.dataset.id); if (sg) sg.name = el.value.trim(); },
  'sg-del': (el) => { removeSecurityGroup(arch, el.dataset.id); },
  'rule-add': (el) => { addSgRule(arch, el.dataset.id, { portFrom: 80, source: '0.0.0.0/0' }); },
  'rule-portfrom': (el) => {
    const sg = getSecurityGroup(arch, el.dataset.id);
    if (sg && sg.inbound[el.dataset.index]) sg.inbound[el.dataset.index].portFrom = Number(el.value);
  },
  'rule-portto': (el) => {
    const sg = getSecurityGroup(arch, el.dataset.id);
    if (sg && sg.inbound[el.dataset.index]) sg.inbound[el.dataset.index].portTo = Number(el.value);
  },
  'rule-source': (el) => {
    const sg = getSecurityGroup(arch, el.dataset.id);
    if (sg && sg.inbound[el.dataset.index]) sg.inbound[el.dataset.index].source = el.value.trim();
  },
  'rule-del': (el) => { removeSgRule(arch, el.dataset.id, Number(el.dataset.index)); },
  'wl-add': (el) => { addWorkload(arch, { type: el.dataset.type }); },
  'wl-name': (el) => { updateWorkload(arch, el.dataset.id, { name: el.value.trim() }); },
  'wl-role': (el) => { updateWorkload(arch, el.dataset.id, { role: el.value || null }); },
  'wl-port': (el) => { updateWorkload(arch, el.dataset.id, { port: Number(el.value) }); },
  'wl-publicip': (el) => { updateWorkload(arch, el.dataset.id, { publicIp: el.checked }); },
  'wl-multiaz': (el) => { updateWorkload(arch, el.dataset.id, { multiAz: el.checked }); },
  'wl-subnet': (el) => {
    const wl = arch.workloads.find((w) => w.id === el.dataset.id);
    if (!wl) return;
    wl.subnetIds = el.checked
      ? [...wl.subnetIds, el.dataset.subnet]
      : wl.subnetIds.filter((sid) => sid !== el.dataset.subnet);
  },
  'wl-sg': (el) => {
    const wl = arch.workloads.find((w) => w.id === el.dataset.id);
    if (!wl) return;
    wl.sgIds = el.checked
      ? [...wl.sgIds, el.dataset.sg]
      : wl.sgIds.filter((gid) => gid !== el.dataset.sg);
  },
  'wl-del': (el) => { removeWorkload(arch, el.dataset.id); },
};

function dispatchAction(event, kinds) {
  const el = event.target.closest('[data-action]');
  if (!el || !kinds.includes(el.tagName)) return;
  const fn = ACTIONS[el.dataset.action];
  if (!fn) return;
  fn(el);
  changed();
}

document.getElementById('arch-builder').addEventListener('click', (e) => dispatchAction(e, ['BUTTON']));
document.getElementById('arch-builder').addEventListener('change', (e) => dispatchAction(e, ['INPUT', 'SELECT']));

function renderDiagram(mount) {
  const azsInUse = AZS.filter((az) => arch.subnets.some((s) => s.az === az));
  const azCols = azsInUse.map((az) => {
    const cards = arch.subnets.filter((s) => s.az === az).map((s) => {
      const rt = effectiveRouteTable(arch, s.id);
      const nats = arch.natGateways.filter((n) => n.subnetId === s.id)
        .map((n) => `<span class="arch-chip">NAT ${escapeHtml(n.id)}</span>`).join('');
      const wls = arch.workloads.filter((w) => w.subnetIds.includes(s.id))
        .map((w) => `<span class="arch-chip">${escapeHtml(w.type.toUpperCase())} ${escapeHtml(w.name)}${w.publicIp ? ' ⬆︎' : ''}</span>`).join('');
      const pub = isPublicSubnet(arch, s.id);
      return `
        <div class="arch-subnet ${pub ? 'is-public' : 'is-private'}">
          <strong>${escapeHtml(s.name)}</strong> <span class="cidr">${escapeHtml(s.cidr)}</span>
          <span class="arch-mini">${pub ? 'public' : 'private'} · ${escapeHtml(rt ? rt.name : '?')}</span>
          <div>${nats}${wls}</div>
        </div>`;
    }).join('');
    return `<div class="arch-az"><h4>AZ ${escapeHtml(az)}</h4>${cards}</div>`;
  }).join('');
  const unplaced = arch.workloads.filter((w) => w.subnetIds.length === 0)
    .map((w) => `<span class="arch-chip">${escapeHtml(w.type.toUpperCase())} ${escapeHtml(w.name)}</span>`).join('');
  mount.innerHTML = `
    <h2>Diagram</h2>
    <div class="arch-vpc-box">
      ${arch.vpc.igwAttached ? '<span class="arch-igw-chip">IGW</span>' : ''}
      <span class="cidr">VPC ${escapeHtml(arch.vpc.cidr)}</span>
      ${azsInUse.length ? `<div class="arch-az-grid">${azCols}</div>` : '<p class="arch-mini">No subnets yet — the map fills in as you build.</p>'}
    </div>
    ${unplaced ? `<p class="arch-mini">Not placed in any subnet: ${unplaced}</p>` : ''}
    <p class="arch-mini">Public subnets are tinted green (route to an attached IGW); private are blue. ⬆︎ = public IP.</p>`;
}

function runCheck() {
  const { errors } = validateStructure(arch);
  const goalRows = errors.length === 0 ? evaluateGoals(arch, challenge) : null;
  const bpRows = evaluateBestPractices(arch, challenge.bestPractices);
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
    const assigned = arch.workloads.filter((w) => w.role === role.id);
    return `<li>${escapeHtml(role.label)}: ${assigned.length
      ? escapeHtml(assigned.map((w) => w.name).join(', '))
      : '<em>unassigned — set a workload\'s role</em>'}</li>`;
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

document.getElementById('arch-task').addEventListener('click', (event) => {
  const el = event.target.closest('button[data-action]');
  if (!el) return;
  if (el.dataset.action === 'check') runCheck();
  if (el.dataset.action === 'hint') { hintsShown += 1; renderAll(); }
  if (el.dataset.action === 'reveal'
      && window.confirm('Replace your current design with the reference solution?')) {
    arch = challenge.refSolution();
    changed();
  }
  if (el.dataset.action === 'reset'
      && window.confirm('Discard your design and start this challenge over?')) {
    store.clearArchDraft(challenge.id);
    arch = challenge.startState ? challenge.startState() : createArch();
    results = null;
    renderAll();
  }
});
