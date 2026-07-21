// aws/js/arch-canvas.js
//
// Drag-and-drop canvas for the Architecture Challenge. Drop legality and
// which arrows exist (derived from routes and security-group rules) live in
// js/lib/archCanvasRules.js; this module renders DOM, wires pointer events,
// and the console-style route/rule editors below the canvas, applying edits
// through ctx.onChange. Dragging changes PARENTAGE only — no coordinates are
// ever stored.

import { escapeHtml } from './lib/html.js';
import {
  AZS, getSubnet, getWorkload, getNat, getSecurityGroup, getRouteTable,
  isPublicSubnet, effectiveRouteTable,
  addSubnet, addNat, addWorkload, addSecurityGroup,
  updateWorkload, updateSubnet, removeSubnet, removeNat, removeWorkload, removeSecurityGroup,
  removeRoute, addSgRule, removeSgRule, associateSubnet, disassociateSubnet,
} from './lib/archModel.js';
import { derivedEdges, canDrop, addSubnetRoute, ensureWorkloadSg } from './lib/archCanvasRules.js';

const PALETTE = [
  { kind: 'subnet', label: '+ Subnet' },
  { kind: 'nat', label: '+ NAT gateway' },
  { kind: 'ec2', label: '+ EC2' },
  { kind: 'alb', label: '+ ALB' },
  { kind: 'rds', label: '+ RDS' },
  { kind: 'sg', label: '+ Security group' },
];

const ref = (obj) => escapeHtml(JSON.stringify(obj));

// The mount-level click listener is attached once (see wireStaticHandlers)
// and lives for the page's lifetime, but arch/selection/challenge change on
// every render and every challenge switch. currentCtx holds the ctx from the
// most recent renderCanvas call so the long-lived handler always reads live
// state instead of closing over a stale ctx from its first render.
let currentCtx = null;
// The mount from the most recent renderCanvas call, kept alongside currentCtx
// so the module-level resize handler (attached once, below) can re-run
// drawEdges against live state without a render having to thread it through.
let lastMount = null;
// The arch object identity from the most recent renderCanvas call. Arch id
// counters restart from scratch on every challenge switch, Reset, and Reveal
// (see arch-challenge.js, which clears its own `selection` for the same
// reason), so a same-id workload in a NEW arch would otherwise alias
// wlruleDraft's stale port/source prefill from the old one. Compared by
// reference (not id) below so any such swap is caught even when ids match.
let lastArch = null;

export function renderCanvas(mount, ctx) {
  currentCtx = ctx;
  const { arch, selection } = ctx;
  if (arch !== lastArch) {
    wlruleDraft = { forId: null, port: null, source: '0.0.0.0/0' };
    lastArch = arch;
  }
  const sel = (r) => (selection && JSON.stringify(selection) === JSON.stringify(r) ? 'cv-selected' : '');

  const azsInUse = AZS.filter((az) => arch.subnets.some((s) => s.az === az));
  const azCols = azsInUse.map((az) => {
    const cards = arch.subnets.filter((s) => s.az === az).map((s) => {
      const nodes = [
        ...arch.natGateways.filter((n) => n.subnetId === s.id).map((n) => chip({ type: 'nat', id: n.id }, `NAT ${n.id}`, sel)),
        ...arch.workloads.filter((w) => w.subnetIds.includes(s.id)).map((w) =>
          chip({ type: 'workload', id: w.id }, `${w.type.toUpperCase()} ${w.name}${w.publicIp ? ' ⬆' : ''}`, sel)),
      ].join('');
      const pub = isPublicSubnet(arch, s.id);
      const rt = effectiveRouteTable(arch, s.id);
      return `
        <div class="cv-subnet ${pub ? 'is-public' : 'is-private'} ${sel({ type: 'subnet', id: s.id })}"
             data-node="${ref({ type: 'subnet', id: s.id })}" data-drop="${ref({ type: 'subnet', id: s.id })}">
          <strong>${escapeHtml(s.name)}</strong> <span class="cidr">${escapeHtml(s.cidr)}</span>
          <span class="arch-mini">${pub ? 'public' : 'private'} · ${escapeHtml(rt ? rt.name : '?')}</span>
          <div>${nodes}</div>
        </div>`;
    }).join('');
    return `<div class="cv-az"><h4>AZ ${escapeHtml(az)}</h4>${cards}</div>`;
  }).join('');

  const unplaced = arch.workloads.filter((w) => w.subnetIds.length === 0).map((w) =>
    chip({ type: 'workload', id: w.id }, `${w.type.toUpperCase()} ${w.name} (unplaced)`, sel)).join('');

  const tray = arch.securityGroups.map((g) =>
    chip({ type: 'sg', id: g.id }, `SG ${g.name} (${g.inbound.length})`, sel)).join('');

  mount.innerHTML = `
    <h2>Canvas</h2>
    <div class="cv-palette">
      ${PALETTE.map((p) => `<button type="button" data-palette="${p.kind}">${p.label}</button>`).join('')}
    </div>
    <p class="arch-mini">Drag onto the canvas (or click to add). Click anything to edit its properties, routes, and rules below.</p>
    <div class="cv-surface">
      <div class="cv-internet ${sel({ type: 'internet' })}" data-node="${ref({ type: 'internet' })}">🌐 Internet</div>
      <div class="cv-vpc" data-drop="${ref({ type: 'vpc' })}">
        <button type="button" class="cv-igw-chip ${arch.vpc.igwAttached ? 'attached' : ''}"
                data-node="${ref({ type: 'igw' })}" data-action="toggle-igw">
          IGW ${arch.vpc.igwAttached ? 'attached' : 'not attached'}</button>
        <span class="cidr">VPC ${escapeHtml(arch.vpc.cidr)}</span>
        ${azsInUse.length
          ? `<div class="cv-az-grid">${azCols}</div>`
          : '<p class="arch-mini">Drag a subnet here to start.</p>'}
      </div>
      ${unplaced ? `<p class="arch-mini">Unplaced: ${unplaced}</p>` : ''}
      <div class="cv-tray" data-drop="${ref({ type: 'sg-tray' })}">
        <span class="arch-mini">Security groups:</span> ${tray || '<span class="arch-mini">none yet</span>'}
      </div>
      <svg id="arch-edges" aria-hidden="true"></svg>
    </div>
    <p class="cv-legend arch-mini">
      <svg class="cv-legend-line" viewBox="0 0 20 8" aria-hidden="true"><line x1="1" y1="4" x2="19" y2="4" class="route"></line></svg>
      route (where a subnet's traffic goes)
      <span aria-hidden="true">·</span>
      <svg class="cv-legend-line" viewBox="0 0 20 8" aria-hidden="true"><line x1="1" y1="4" x2="19" y2="4" class="sg-rule"></line></svg>
      security-group rule (allowed inbound traffic)
    </p>
    <div id="arch-inspector"></div>
    <p class="arch-mini">Simplification: security groups are inbound-only here; outbound is allow-all.</p>`;

  lastMount = mount;
  drawEdges(mount, ctx);
  renderInspector(mount.querySelector('#arch-inspector'), ctx);
  wireCanvas(mount);
}

// Called by the host page when navigating away from the workbench (e.g. back
// to the landing list). Clears currentCtx so long-lived, module-level
// listeners (document keydown, the debounced resize handler) see "no canvas
// mounted" and no-op instead of operating on a detached arch from the last
// render.
export function unmountCanvas() {
  currentCtx = null;
}

function chip(r, label, sel) {
  return `<span class="cv-chip ${sel(r)}" data-node="${ref(r)}">${escapeHtml(label)}</span>`;
}

// Clamps a ray from a rectangle's center toward another point to that
// rectangle's own border (a simple line/box intersection: scale the
// direction vector so it lands on whichever half-extent it reaches first),
// so edge lines start/stop at box borders instead of crossing interiors or
// (for a wide card like a subnet) ending in empty space in the middle.
// Degenerate directions (zero-length segments, e.g. two overlapping boxes
// sharing a center) have no well-defined border crossing — fall back to the
// center itself rather than divide-by-zero into NaN.
function clampToBorder(cx, cy, dx, dy, halfW, halfH) {
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const scale = Math.min(scaleX, scaleY);
  if (!Number.isFinite(scale)) return { x: cx, y: cy };
  return { x: cx + dx * scale, y: cy + dy * scale };
}

// Route edges store just the destination CIDR as `label` (matches the
// model's route shape), so build the fuller pill text from the edge's
// resolved `to` ref. SG-rule edges already carry their full `TCP <port>`
// (or `<source> → TCP <port>`) text in `label` — leave those alone.
function edgeLabelText(edge) {
  if (edge.kind !== 'route') return edge.label;
  const dest = edge.to.type === 'igw' ? 'IGW' : `NAT ${edge.to.id}`;
  return `${edge.label} → ${dest}`;
}

// Arrows between element edges (not centers), in cv-surface coords, each
// carrying a midpoint label pill so its meaning reads without a hover.
function drawEdges(mount, ctx) {
  const svg = mount.querySelector('#arch-edges');
  const surface = mount.querySelector('.cv-surface');
  const surfaceBox = surface.getBoundingClientRect();
  const anchor = (r) => {
    const el = r.type === 'igw'
      ? surface.querySelector('[data-action="toggle-igw"]')
      : surface.querySelector(`[data-node='${JSON.stringify(r)}']`);
    return el ? el.getBoundingClientRect() : null;
  };
  const paths = [];
  derivedEdges(ctx.arch).forEach((edge, i) => {
    const a = anchor(edge.from);
    const b = anchor(edge.to);
    if (!a || !b) return;
    const ax = a.left + a.width / 2 - surfaceBox.left;
    const ay = a.top + a.height / 2 - surfaceBox.top;
    const bx = b.left + b.width / 2 - surfaceBox.left;
    const by = b.top + b.height / 2 - surfaceBox.top;
    // Clamp the center-to-center segment to each element's own border.
    const start = clampToBorder(ax, ay, bx - ax, by - ay, a.width / 2, a.height / 2);
    const end = clampToBorder(bx, by, ax - bx, ay - by, b.width / 2, b.height / 2);
    const d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    const mx = (start.x + end.x) / 2;
    const my = (start.y + end.y) / 2;
    paths.push(`<path class="${edge.kind}" d="${d}" marker-end="url(#cv-arrow)"><title>${escapeHtml(edge.label)}</title></path>`);
    // pointer-events none (belt-and-suspenders with the CSS default) so the
    // label never steals a click from the .hit path drawn right after it.
    paths.push(`<text class="cv-edge-label ${edge.kind}" x="${mx}" y="${my}" text-anchor="middle" dominant-baseline="middle" pointer-events="none">${escapeHtml(edgeLabelText(edge))}</text>`);
    paths.push(`<path class="hit" d="${d}" data-edge-index="${i}"></path>`);
  });
  svg.innerHTML = `
    <defs><marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path></marker></defs>
    ${paths.join('')}`;
}

// Console-style source control: a type select plus a conditional field.
// Presentation only — the stored value stays '0.0.0.0/0' | CIDR | 'sg:<id>'.
function sourceControls(arch, source, insPrefix, dataAttrs) {
  const kind = source === '0.0.0.0/0' ? 'anywhere' : source.startsWith('sg:') ? 'sg' : 'cidr';
  const sgOpts = arch.securityGroups.map((g) =>
    `<option value="sg:${escapeHtml(g.id)}" ${source === `sg:${g.id}` ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
  return `
    <select data-ins="${insPrefix}-srctype" ${dataAttrs} aria-label="Source type">
      <option value="anywhere" ${kind === 'anywhere' ? 'selected' : ''}>Anywhere-IPv4 (0.0.0.0/0)</option>
      <option value="cidr" ${kind === 'cidr' ? 'selected' : ''}>Custom CIDR</option>
      <option value="sg" ${kind === 'sg' ? 'selected' : ''} ${arch.securityGroups.length === 0 ? 'disabled' : ''}>Security group</option>
    </select>
    ${kind === 'cidr' ? `<input type="text" value="${escapeHtml(source)}" data-ins="${insPrefix}-srccidr" ${dataAttrs} aria-label="Source CIDR" />` : ''}
    ${kind === 'sg' ? `<select data-ins="${insPrefix}-srcsg" ${dataAttrs} aria-label="Source security group">${sgOpts}</select>` : ''}`;
}

// Reads the sourceControls trio back into a stored source string. The type
// select's value always reflects the user's latest pick even before a
// re-render, but the conditional cidr/sg field it implies may not exist in
// the DOM yet (first switch to that type) — fall back to a value that isn't
// '0.0.0.0/0' or 'sg:...' itself, so the next render classifies it as the
// intended kind instead of springing back to "anywhere".
function readSourceControls(row, prefix, arch) {
  const kind = row.querySelector(`[data-ins="${prefix}-srctype"]`).value;
  if (kind === 'anywhere') return '0.0.0.0/0';
  if (kind === 'sg') {
    const picked = row.querySelector(`[data-ins="${prefix}-srcsg"]`)?.value;
    return picked || (arch.securityGroups[0] ? `sg:${arch.securityGroups[0].id}` : '0.0.0.0/0');
  }
  return row.querySelector(`[data-ins="${prefix}-srccidr"]`)?.value.trim() || '10.0.0.0/16';
}

// Workload add-rule row is draft-only until "Add rule" commits it via
// addSgRule, but switching the Source-type select still needs a live
// re-render to show/hide the CIDR or SG field with no model write — and a
// port typed before that switch shouldn't be lost when it happens.
// wlruleDraft holds that in-progress { port, source } state across those
// re-renders; forId scopes it to the selected workload, reset when
// selection changes (in renderInspector), the rule is committed
// (wlrule-add), or the arch itself is swapped out (in renderCanvas).
let wlruleDraft = { forId: null, port: null, source: '0.0.0.0/0' };

// The inspector's own delegated change/click listeners are guarded the same
// way as renderInspector's parent template: mount.innerHTML on the OUTER
// canvas mount replaces this #arch-inspector element wholesale every render,
// so a fresh node (and a fresh `wired` dataset) shows up each time regardless
// — but the listeners still read currentCtx rather than closing over the
// `ctx` param, for the same stale-context reasons as wireStaticHandlers.
function renderInspector(mount, ctx) {
  const { arch, challenge, selection } = ctx;
  const sel = selection;
  const roleOpts = (current) => ['', ...challenge.roles.map((r) => r.id)]
    .map((id) => `<option value="${escapeHtml(id)}" ${id === (current || '') ? 'selected' : ''}>${escapeHtml(id || '(none)')}</option>`).join('');

  let html = '';
  if (!sel || sel.type === 'internet' || sel.type === 'igw' || sel.type === 'vpc') {
    html = `<h3>VPC</h3><div class="arch-row">
      <label class="arch-mini">CIDR <input type="text" value="${escapeHtml(arch.vpc.cidr)}" data-ins="vpc-cidr" /></label>
      <span class="arch-mini">Select any node on the canvas to edit it here.</span></div>`;
  } else if (sel.type === 'subnet') {
    const s = getSubnet(arch, sel.id);
    if (s) {
      const rt = effectiveRouteTable(arch, s.id);
      const tables = arch.routeTables.filter((t) => !t.isMain).map((t) =>
        `<option value="${t.id}" ${rt && rt.id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
      html = `<h3>Subnet ${escapeHtml(s.name)}</h3>
        <div class="arch-row">
          <input type="text" value="${escapeHtml(s.name)}" data-ins="subnet-name" aria-label="Name" />
          <select data-ins="subnet-az" aria-label="AZ">${AZS.map((az) => `<option ${az === s.az ? 'selected' : ''}>${az}</option>`).join('')}</select>
          <input type="text" value="${escapeHtml(s.cidr)}" data-ins="subnet-cidr" aria-label="CIDR" placeholder="10.0.1.0/24" />
          <button type="button" class="arch-del" data-ins="delete" title="Delete subnet">✕ delete</button>
        </div>
        <p class="arch-mini">Route table: ${escapeHtml(rt ? rt.name : 'main')}${rt && !rt.isMain ? ` (shared by ${rt.subnetIds.length})` : ''}
          <select data-ins="subnet-rtb" aria-label="Associate route table">
            <option value="">main (implicit)</option>${tables}</select></p>`;
      const targetOpts = (selected) => `
        <option value="igw" ${selected === 'igw' ? 'selected' : ''}>Internet gateway</option>
        ${arch.natGateways.map((n) => `<option value="nat:${escapeHtml(n.id)}" ${selected === `nat:${n.id}` ? 'selected' : ''}>NAT gateway ${escapeHtml(n.id)} — in ${escapeHtml(getSubnet(arch, n.subnetId)?.name || '?')}</option>`).join('')}`;
      const routeRows = (rt && !rt.isMain ? rt.routes : []).map((route, i) => `
        <div class="arch-row">
          <input type="text" value="${escapeHtml(route.destCidr)}" data-ins="route-dest" data-rtb="${escapeHtml(rt.id)}" data-index="${i}" aria-label="Destination" />
          <span class="arch-mini">→</span>
          <select data-ins="route-target" data-rtb="${escapeHtml(rt.id)}" data-index="${i}" aria-label="Target">${targetOpts(route.target)}</select>
          <button type="button" class="arch-del" data-ins="route-del" data-rtb="${escapeHtml(rt.id)}" data-index="${i}">✕</button>
        </div>`).join('');
      const sharedNote = rt && !rt.isMain && rt.subnetIds.length > 1
        ? ` <span class="arch-mini">(shared by ${rt.subnetIds.length} subnets — edits affect all)</span>` : '';
      // A start/reference arch can legitimately carry routes on rtb-main
      // (e.g. private-egress's refSolution routes 0.0.0.0/0 → NAT on main),
      // so the canvas draws an arrow for them even though main isn't one of
      // the editable `tables` above. Surface those facts read-only here
      // rather than silently showing an arrow the inspector can't explain.
      const mainRouteRows = (rt && rt.isMain ? rt.routes : []).map((route) => {
        const targetLabel = route.target === 'igw' ? 'Internet gateway' : `NAT gateway ${route.target.slice(4)}`;
        return `<p class="arch-mini">${escapeHtml(route.destCidr)} → ${escapeHtml(targetLabel)} (main route table — read-only here)</p>`;
      }).join('');
      html += `
        <h3>Routes${sharedNote}</h3>
        <p class="arch-mini">${escapeHtml(arch.vpc.cidr)} — local (implicit)</p>
        ${mainRouteRows}
        ${routeRows}
        <div class="arch-row">
          <input type="text" value="0.0.0.0/0" data-ins="route-new-dest" aria-label="New route destination" />
          <span class="arch-mini">→</span>
          <select data-ins="route-new-target" aria-label="New route target">${targetOpts('igw')}</select>
          <button type="button" data-ins="route-add">Add route</button>
        </div>`;
    }
  } else if (sel.type === 'nat') {
    const n = getNat(arch, sel.id);
    if (n) {
      html = `<h3>NAT gateway ${escapeHtml(n.id)}</h3>
        <div class="arch-row"><span class="arch-mini">in ${escapeHtml(getSubnet(arch, n.subnetId)?.name || '?')}
          — drag the chip to move it</span>
          <button type="button" class="arch-del" data-ins="delete">✕ delete</button></div>`;
    }
  } else if (sel.type === 'workload') {
    const w = getWorkload(arch, sel.id);
    if (w) {
      if (wlruleDraft.forId !== w.id) wlruleDraft = { forId: w.id, port: null, source: '0.0.0.0/0' };
      const subnetBoxes = arch.subnets.map((s) => `
        <label class="arch-mini"><input type="checkbox" value="${s.id}" data-ins="wl-subnet"
          ${w.subnetIds.includes(s.id) ? 'checked' : ''} ${w.type === 'ec2' ? 'disabled' : ''} /> ${escapeHtml(s.name)}</label>`).join(' ');
      const sgBoxes = arch.securityGroups.map((g) => `
        <label class="arch-mini"><input type="checkbox" value="${g.id}" data-ins="wl-sg"
          ${w.sgIds.includes(g.id) ? 'checked' : ''} /> ${escapeHtml(g.name)}</label>`).join(' ');
      html = `<h3>${w.type.toUpperCase()} <input type="text" value="${escapeHtml(w.name)}" data-ins="wl-name" aria-label="Name" /></h3>
        <div class="arch-row">
          ${challenge.roles.length ? `<label class="arch-mini">role <select data-ins="wl-role">${roleOpts(w.role)}</select></label>` : ''}
          <label class="arch-mini">port <input type="number" value="${w.port}" data-ins="wl-port" /></label>
          ${w.type === 'ec2' ? `<label class="arch-mini"><input type="checkbox" data-ins="wl-publicip" ${w.publicIp ? 'checked' : ''} /> public IP</label>` : ''}
          ${w.type === 'rds' ? `<label class="arch-mini"><input type="checkbox" data-ins="wl-multiaz" ${w.multiAz ? 'checked' : ''} /> Multi-AZ</label>` : ''}
          <button type="button" class="arch-del" data-ins="delete">✕ delete</button>
        </div>
        <p class="arch-mini">Subnets${w.type === 'ec2' ? ' (drag the chip to move an EC2)' : ''}: ${subnetBoxes || '<em>none</em>'}</p>
        <p class="arch-mini">Security groups: ${sgBoxes || '<em>none — add an inbound rule below to auto-create one</em>'}</p>`;
      const attachedRules = w.sgIds.flatMap((gid) => {
        const g = getSecurityGroup(arch, gid);
        return g ? g.inbound.map((r) => {
          const srcLabel = r.source === '0.0.0.0/0' ? 'anywhere (0.0.0.0/0)'
            : r.source.startsWith('sg:') ? (getSecurityGroup(arch, r.source.slice(3))?.name || r.source) : r.source;
          const ports = r.portFrom === r.portTo ? r.portFrom : `${r.portFrom}–${r.portTo}`;
          return `<p class="arch-mini">${escapeHtml(g.name)}: TCP ${escapeHtml(String(ports))} from ${escapeHtml(srcLabel)}</p>`;
        }) : [];
      }).join('');
      html += `
        <h3>Inbound rules</h3>
        ${attachedRules || '<p class="arch-mini">No inbound rules — all inbound traffic is denied.</p>'}
        <div class="arch-row">
          <label class="arch-mini">port <input type="number" value="${wlruleDraft.port ?? w.port}" data-ins="wlrule-port" /></label>
          ${sourceControls(arch, wlruleDraft.source, 'wlrule', '')}
          <button type="button" data-ins="wlrule-add">Add rule</button>
        </div>`;
    }
  } else if (sel.type === 'sg') {
    const g = getSecurityGroup(arch, sel.id);
    if (g) {
      const rows = g.inbound.map((r, i) => `
        <div class="arch-row"><span class="arch-mini">TCP</span>
          <input type="number" value="${r.portFrom}" data-ins="rule-portfrom" data-index="${i}" aria-label="Port from" />
          <span class="arch-mini">–</span>
          <input type="number" value="${r.portTo}" data-ins="rule-portto" data-index="${i}" aria-label="Port to" />
          <span class="arch-mini">from</span>
          ${sourceControls(arch, r.source, 'rule', `data-index="${i}"`)}
          <button type="button" class="arch-del" data-ins="rule-del" data-index="${i}">✕</button></div>`).join('');
      html = `<h3>SG <input type="text" value="${escapeHtml(g.name)}" data-ins="sg-name" aria-label="Name" />
          <button type="button" class="arch-del" data-ins="delete">✕ delete</button></h3>
        ${rows || '<p class="arch-mini">No inbound rules — denies all inbound.</p>'}
        <button type="button" class="arch-add" data-ins="rule-add">+ inbound rule</button>`;
    }
  }
  mount.innerHTML = html;

  if (!mount.dataset.wired) {
    mount.dataset.wired = '1';
    mount.addEventListener('change', (e) => applyInspector(e, currentCtx, 'change'));
    mount.addEventListener('click', (e) => applyInspector(e, currentCtx, 'click'));
  }
}

function applyInspector(event, ctx, phase) {
  const el = event.target.closest('[data-ins]');
  if (!el) return;
  if (phase === 'click' && el.tagName !== 'BUTTON') return;
  if (phase === 'change' && el.tagName === 'BUTTON') return;
  const { arch, selection } = ctx;
  const ins = el.dataset.ins;
  const idx = Number(el.dataset.index);
  const sub = selection && selection.type === 'subnet' ? getSubnet(arch, selection.id) : null;
  const wl = selection && selection.type === 'workload' ? getWorkload(arch, selection.id) : null;
  const sg = selection && selection.type === 'sg' ? getSecurityGroup(arch, selection.id) : null;

  switch (ins) {
    case 'vpc-cidr': arch.vpc.cidr = el.value.trim(); break;
    case 'subnet-name': if (sub) updateSubnet(arch, sub.id, { name: el.value.trim() }); break;
    case 'subnet-az': if (sub) updateSubnet(arch, sub.id, { az: el.value }); break;
    case 'subnet-cidr': if (sub) updateSubnet(arch, sub.id, { cidr: el.value.trim() }); break;
    case 'subnet-rtb':
      if (sub) {
        if (el.value) associateSubnet(arch, el.value, sub.id);
        else disassociateSubnet(arch, sub.id);
      }
      break;
    case 'wl-name': if (wl) updateWorkload(arch, wl.id, { name: el.value.trim() }); break;
    case 'wl-role': if (wl) updateWorkload(arch, wl.id, { role: el.value || null }); break;
    case 'wl-port': if (wl) updateWorkload(arch, wl.id, { port: Number(el.value) }); break;
    case 'wl-publicip': if (wl) updateWorkload(arch, wl.id, { publicIp: el.checked }); break;
    case 'wl-multiaz': if (wl) updateWorkload(arch, wl.id, { multiAz: el.checked }); break;
    case 'wl-subnet':
      if (wl) {
        wl.subnetIds = el.checked
          ? [...wl.subnetIds, el.value]
          : wl.subnetIds.filter((sid) => sid !== el.value);
      }
      break;
    case 'wl-sg':
      if (wl) {
        wl.sgIds = el.checked ? [...wl.sgIds, el.value] : wl.sgIds.filter((gid) => gid !== el.value);
      }
      break;
    case 'sg-name': if (sg) sg.name = el.value.trim(); break;
    case 'rule-add': if (sg) addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' }); break;
    case 'rule-portfrom': if (sg && sg.inbound[idx]) sg.inbound[idx].portFrom = Number(el.value); break;
    case 'rule-portto': if (sg && sg.inbound[idx]) sg.inbound[idx].portTo = Number(el.value); break;
    case 'rule-del': if (sg) removeSgRule(arch, sg.id, idx); break;
    case 'route-dest': {
      const rt = getRouteTable(arch, el.dataset.rtb);
      if (rt && rt.routes[el.dataset.index]) rt.routes[el.dataset.index].destCidr = el.value.trim();
      break;
    }
    case 'route-target': {
      const rt = getRouteTable(arch, el.dataset.rtb);
      if (rt && rt.routes[el.dataset.index]) rt.routes[el.dataset.index].target = el.value;
      break;
    }
    case 'route-del': if (getRouteTable(arch, el.dataset.rtb)) removeRoute(arch, el.dataset.rtb, Number(el.dataset.index)); break;
    case 'route-add': {
      if (!sub) return;
      const row = el.closest('.arch-row');
      addSubnetRoute(arch, sub.id, row.querySelector('[data-ins="route-new-dest"]').value.trim(),
        row.querySelector('[data-ins="route-new-target"]').value);
      break;
    }
    case 'rule-srctype': case 'rule-srccidr': case 'rule-srcsg': {
      if (!sg || !sg.inbound[idx]) return;
      sg.inbound[idx].source = readSourceControls(el.closest('.arch-row'), 'rule', arch);
      break;
    }
    case 'wlrule-add': {
      if (!wl) return;
      const row = el.closest('.arch-row');
      const target = ensureWorkloadSg(arch, wl.id);
      if (!target) return;
      addSgRule(arch, target.id, {
        portFrom: Number(row.querySelector('[data-ins="wlrule-port"]').value) || wl.port,
        source: readSourceControls(row, 'wlrule', arch),
      });
      wlruleDraft = { forId: null, port: null, source: '0.0.0.0/0' }; // reset draft after commit
      break;
    }
    // Draft-only: nothing is stored in the model until wlrule-add commits it.
    // srctype/srccidr/srcsg update wlruleDraft.source and re-render directly
    // (bypassing ctx.onChange) so the conditional cidr/sg field shows up
    // without a spurious "unsaved changes" write; port just remembers itself
    // so a later srctype-triggered re-render doesn't drop the typed value.
    case 'wlrule-port': wlruleDraft.port = Number(el.value); return;
    case 'wlrule-srctype': case 'wlrule-srccidr': case 'wlrule-srcsg':
      wlruleDraft.source = readSourceControls(el.closest('.arch-row'), 'wlrule', arch);
      renderInspector(event.currentTarget, ctx);
      return;
    case 'delete': deleteSelection(ctx); return; // deleteSelection calls onSelect+onChange itself
    default: return;
  }
  ctx.onChange();
}

function deleteSelection(ctx) {
  const { arch, selection } = ctx;
  if (!selection) return;
  if (selection.type === 'subnet') removeSubnet(arch, selection.id);
  else if (selection.type === 'nat') removeNat(arch, selection.id);
  else if (selection.type === 'workload') removeWorkload(arch, selection.id);
  else if (selection.type === 'sg') removeSecurityGroup(arch, selection.id);
  else return;
  ctx.onSelect(null); // triggers renderAll; onChange persists
  ctx.onChange();
}

// One in-flight drag gesture per page; cleared on drop/cancel.
let gesture = null;
// The document-level keydown listener (Escape to cancel/close, Delete or
// Backspace to remove the selection) is attached once for the page's
// lifetime, independent of (and in addition to) the mount's own attach-once
// guard below — guarded by its own module-level flag rather than piggy-
// backing on mount.dataset.cvWired so it stays correct even if a second
// mount is ever wired.
let docKeydownWired = false;
// Same once-per-page rationale as docKeydownWired: window resizes (e.g. the
// arch-workbench grid collapsing at the 1100px breakpoint) move every node,
// so the SVG overlay's arrows need to be redrawn from fresh getBoundingClientRect
// calls. Debounced so a drag-resize doesn't redraw on every intermediate frame.
let resizeWired = false;
let resizeTimer = null;

function wireCanvas(mount) { wireStaticHandlers(mount); }

// mount.innerHTML is fully replaced on every render, but the mount element
// itself persists for the page's lifetime, so delegated listeners attached
// to it survive across renders. Attach exactly once (guarded by a data
// attribute) — otherwise every re-render stacks another listener and a
// single click/pointerdown fires the handler once per prior render. Every
// listener here reads currentCtx (set at the top of renderCanvas) rather
// than closing over the ctx from whichever render first attached it, so it
// always sees the live arch/selection/challenge. A gesture in flight
// (startDrag) threads that currentCtx snapshot through its own
// synchronous pointermove/pointerup lifecycle — it never re-reads
// currentCtx mid-gesture, but no render (and thus no ctx change) happens
// until the gesture applies its result through ctx.onChange().
function wireStaticHandlers(mount) {
  if (mount.dataset.cvWired) return;
  mount.dataset.cvWired = '1';

  mount.addEventListener('click', (event) => {
    const igw = event.target.closest('[data-action="toggle-igw"]');
    if (igw) {
      currentCtx.arch.vpc.igwAttached = !currentCtx.arch.vpc.igwAttached;
      currentCtx.onChange();
      return;
    }
    // .cv-surface (and the #arch-edges SVG it contains) is recreated on
    // every render, so edge-click handling lives here on the persistent
    // mount via event.target.closest('path.hit') rather than bound to the
    // surface element directly.
    const hit = event.target.closest('path.hit');
    if (hit) {
      showEdgePopover(Number(hit.dataset.edgeIndex), event, mount, currentCtx);
      return;
    }
    const pal = event.target.closest('[data-palette]');
    if (pal) {
      clickToAdd(pal.dataset.palette, currentCtx);
      return;
    }
    const nodeEl = event.target.closest('[data-node]');
    if (nodeEl) {
      currentCtx.onSelect(JSON.parse(nodeEl.dataset.node));
    }
  });

  mount.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const pal = event.target.closest('[data-palette]');
    const nodeEl = event.target.closest('[data-node]');
    if (pal) {
      startDrag({ mode: 'place', kind: pal.dataset.palette, label: pal.textContent }, event, mount, currentCtx);
    } else if (nodeEl) {
      const r = JSON.parse(nodeEl.dataset.node);
      if (r.type === 'workload' || r.type === 'nat') {
        const fromSubnet = event.target.closest('[data-drop]');
        startDrag({
          mode: 'move', kind: r.id, label: nodeEl.textContent,
          fromSubnet: fromSubnet ? JSON.parse(fromSubnet.dataset.drop).id : null,
        }, event, mount, currentCtx);
      }
    }
  });

  if (!docKeydownWired) {
    docKeydownWired = true;
    document.addEventListener('keydown', onDocumentKeydown);
  }

  if (!resizeWired) {
    resizeWired = true;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!currentCtx || !lastMount || !lastMount.isConnected) return;
        drawEdges(lastMount, currentCtx);
      }, 100);
    });
  }
}

function onDocumentKeydown(event) {
  // Popovers are post-gesture artifacts (the gesture that opened them has
  // already ended), so Escape must close them too, not just cancel an
  // in-flight drag.
  if (event.key === 'Escape') { cancelGesture(); closePopover(); return; }
  // Delete/Backspace removes the current selection, but only when focus
  // isn't in a form field (so backspacing inside a subnet-name input, say,
  // doesn't also delete the subnet out from under it). Reads currentCtx
  // (not a closed-over ctx) for the same stale-context reasons as every
  // other long-lived listener in this file.
  if ((event.key === 'Delete' || event.key === 'Backspace')
      && currentCtx && currentCtx.selection
      && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) {
    deleteSelection(currentCtx);
  }
}

function cancelGesture() {
  if (!gesture) return;
  gesture.cleanup();
  gesture = null;
}

// document.elementFromPoint only returns the topmost element at a point, but
// every arrow drawn by drawEdges() STARTS at a node's own center and the
// #arch-edges overlay's invisible path.hit companions are 10px wide with
// pointer-events: stroke — so once any arrow touches a node, that node's own
// center (and everywhere along the arrow) reports path.hit as the topmost
// hit, silently masking the container/node underneath during drag
// targeting. Scan the full elementsFromPoint stack, skipping anything inside
// the #arch-edges SVG, and return the first element matching `selector`.
// Clicking an arrow to inspect/delete its fact is unaffected — that's a
// direct click listener on path.hit, not a hit-test scan.
function hitTarget(x, y, selector) {
  const stack = document.elementsFromPoint(x, y);
  for (const el of stack) {
    if (el.closest('#arch-edges')) continue;
    const hit = el.closest(selector);
    if (hit) return hit;
  }
  return null;
}

// Palette placement and chip re-homing share one drag loop: a ghost chip
// follows the pointer; drop containers highlight when canDrop() says yes.
function startDrag(spec, event, mount, ctx) {
  cancelGesture();
  const ghost = document.createElement('span');
  ghost.className = 'cv-chip cv-ghost';
  ghost.textContent = spec.label.trim();
  document.body.appendChild(ghost);
  let target = null; // targetRef | null

  const move = (e) => {
    ghost.style.left = `${e.clientX + 8}px`;
    ghost.style.top = `${e.clientY + 8}px`;
    const el = hitTarget(e.clientX, e.clientY, '[data-drop]');
    mount.querySelectorAll('.cv-drop-ok').forEach((n) => n.classList.remove('cv-drop-ok'));
    target = null;
    if (el) {
      const targetRef = JSON.parse(el.dataset.drop);
      // Re-homing must not "drop into" the chip's own source subnet card
      // when hovering itself; canDrop already treats same-subnet as false.
      if (canDrop(spec.kind, targetRef, ctx.arch)) {
        el.classList.add('cv-drop-ok');
        target = targetRef;
      }
    }
  };
  const up = (e) => {
    const dropAt = { x: e.clientX, y: e.clientY };
    cancelGesture();
    if (target) applyDrop(spec, target, dropAt, mount, ctx);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  gesture = {
    cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      mount.querySelectorAll('.cv-drop-ok').forEach((n) => n.classList.remove('cv-drop-ok'));
    },
  };
  move(event);
}

function applyDrop(spec, targetRef, dropAt, mount, ctx) {
  const { arch } = ctx;
  if (spec.mode === 'place') {
    if (spec.kind === 'subnet') {
      showPopover(mount, dropAt, `
        <p>Add subnet in which Availability Zone?</p>
        <div class="arch-row">${['a', 'b', 'c'].map((az) => `<button type="button" data-az="${az}">AZ ${az}</button>`).join('')}
          <button type="button" data-cancel>Cancel</button></div>`,
      (pop) => {
        pop.addEventListener('click', (e) => {
          const az = e.target.closest('[data-az]');
          if (az) { addSubnet(arch, { az: az.dataset.az, cidr: '' }); closePopover(); ctx.onChange(); }
          if (e.target.closest('[data-cancel]')) closePopover();
        });
      });
      return;
    }
    if (spec.kind === 'alb') {
      const boxes = arch.subnets.map((s) => `
        <label class="arch-mini"><input type="checkbox" value="${escapeHtml(s.id)}" /> ${escapeHtml(s.name)}</label>`).join(' ');
      showPopover(mount, dropAt, `
        <p>ALB subnets (needs two AZs to be valid):</p>
        <div class="arch-row">${boxes || '<em class="arch-mini">no subnets yet</em>'}</div>
        <div class="arch-row"><button type="button" data-ok>Add ALB</button> <button type="button" data-cancel>Cancel</button></div>`,
      (pop) => {
        pop.addEventListener('click', (e) => {
          if (e.target.closest('[data-ok]')) {
            const ids = [...pop.querySelectorAll('input:checked')].map((i) => i.value);
            addWorkload(arch, { type: 'alb', subnetIds: ids });
            closePopover(); ctx.onChange();
          }
          if (e.target.closest('[data-cancel]')) closePopover();
        });
      });
      return;
    }
    if (spec.kind === 'sg') { addSecurityGroup(arch); ctx.onChange(); return; }
    if (spec.kind === 'nat') { addNat(arch, targetRef.id); ctx.onChange(); return; }
    addWorkload(arch, { type: spec.kind, subnetIds: [targetRef.id] }); // ec2 | rds
    ctx.onChange();
    return;
  }
  // mode === 'move' (re-home)
  // canDrop already gates this, but a re-home can only ever mean "into a
  // subnet" — guard here too so a future gating regression can never write
  // an undefined id into subnetIds.
  if (targetRef.type !== 'subnet') return;
  const nat = getNat(arch, spec.kind);
  if (nat) { nat.subnetId = targetRef.id; ctx.onChange(); return; }
  const wl = getWorkload(arch, spec.kind);
  if (!wl) return;
  if (wl.type === 'ec2') {
    updateWorkload(arch, wl.id, { subnetIds: [targetRef.id] });
  } else {
    // ALB/RDS chips render once per occupied subnet; replace the one it was
    // dragged FROM, falling back to appending when the source is unknown.
    const next = spec.fromSubnet && wl.subnetIds.includes(spec.fromSubnet)
      ? wl.subnetIds.map((sid) => (sid === spec.fromSubnet ? targetRef.id : sid))
      : [...wl.subnetIds, targetRef.id];
    updateWorkload(arch, wl.id, { subnetIds: [...new Set(next)] });
  }
  ctx.onChange();
}

function showEdgePopover(index, event, mount, ctx) {
  const edge = derivedEdges(ctx.arch)[index];
  if (!edge) return;
  showPopover(mount, { x: event.clientX, y: event.clientY }, `
    <p>${escapeHtml(edge.kind === 'route' ? 'Route' : 'Security group rule')}: ${escapeHtml(edge.label)}</p>
    <div class="arch-row"><button type="button" data-del>Delete</button> <button type="button" data-cancel>Close</button></div>`,
  (pop) => {
    pop.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) {
        if (edge.fact.kind === 'route') removeRoute(ctx.arch, edge.fact.rtbId, edge.fact.index);
        else removeSgRule(ctx.arch, edge.fact.sgId, edge.fact.index);
        closePopover(); ctx.onChange();
      }
      if (e.target.closest('[data-cancel]')) closePopover();
    });
  });
}

// One popover at a time, positioned inside the canvas panel near the drop.
function showPopover(mount, at, html, wire) {
  closePopover();
  const pop = document.createElement('div');
  pop.className = 'cv-popover';
  pop.id = 'cv-popover';
  pop.innerHTML = html;
  const panelBox = mount.getBoundingClientRect();
  pop.style.left = `${Math.max(8, at.x - panelBox.left - 40)}px`;
  pop.style.top = `${Math.max(8, at.y - panelBox.top + 12)}px`;
  mount.appendChild(pop);
  wire(pop);
}

function closePopover() {
  document.getElementById('cv-popover')?.remove();
}

// Adds a palette item into the selected container (or a sensible default)
// via a single click, then commits through ctx.onChange.
export function clickToAdd(kind, ctx) {
  const { arch, selection } = ctx;
  switch (kind) {
    case 'subnet':
      addSubnet(arch, { az: 'a', cidr: '' });
      break;
    case 'nat':
    case 'ec2':
    case 'rds': {
      const subnetId = selection?.type === 'subnet' ? selection.id : arch.subnets[0]?.id;
      if (!subnetId) return;
      if (kind === 'nat') addNat(arch, subnetId);
      else addWorkload(arch, { type: kind, subnetIds: [subnetId] });
      break;
    }
    case 'alb':
      addWorkload(arch, { type: 'alb' });
      break;
    case 'sg':
      addSecurityGroup(arch);
      break;
    default:
      return;
  }
  ctx.onChange();
}
