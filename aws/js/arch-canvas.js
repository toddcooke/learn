// aws/js/arch-canvas.js
//
// Drag-and-drop canvas for the Architecture Challenge. All judgment calls
// (drop legality, connection meaning, which arrows exist) live in
// js/lib/archCanvasRules.js; this module renders DOM, wires pointer events,
// and applies confirmed intents through ctx.onChange. Dragging changes
// PARENTAGE only — no coordinates are ever stored.

import { escapeHtml } from './lib/html.js';
import {
  AZS, getSubnet, getWorkload, getNat, getSecurityGroup,
  isPublicSubnet, effectiveRouteTable,
  addSubnet, addNat, addWorkload, addSecurityGroup,
  updateWorkload, updateSubnet, removeSubnet, removeNat, removeWorkload, removeSecurityGroup,
  removeRoute, addSgRule, removeSgRule, associateSubnet, disassociateSubnet,
} from './lib/archModel.js';
import { derivedEdges, canDrop, connectionIntent } from './lib/archCanvasRules.js';

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

export function renderCanvas(mount, ctx) {
  currentCtx = ctx;
  const { arch, selection } = ctx;
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
          <span class="cv-handle" data-connect="${ref({ type: 'subnet', id: s.id })}" title="Draw route">⇢</span>
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
    <p class="arch-mini">Drag onto the canvas (or click to add). Drag the ⇢ handle between nodes to connect. Click anything to edit it below.</p>
    <div class="cv-surface">
      <div class="cv-internet ${sel({ type: 'internet' })}" data-node="${ref({ type: 'internet' })}">🌐 Internet
        <span class="cv-handle" data-connect="${ref({ type: 'internet' })}" title="Draw connection">⇢</span>
      </div>
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
    <div id="arch-inspector"></div>
    <p class="arch-mini">Simplification: security groups are inbound-only here; outbound is allow-all.</p>`;

  drawEdges(mount, ctx);
  renderInspector(mount.querySelector('#arch-inspector'), ctx); // Task 5 fills this in
  wireCanvas(mount);                                             // Task 4 fills this in
}

function chip(r, label, sel) {
  const connectable = r.type === 'workload' || r.type === 'nat';
  return `<span class="cv-chip ${sel(r)}" data-node="${ref(r)}">${escapeHtml(label)}
    ${connectable ? `<span class="cv-handle" data-connect="${ref(r)}" title="Draw connection">⇢</span>` : ''}</span>`;
}

// Straight-line arrows between element edge midpoints, in cv-surface coords.
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
    const x1 = a.left + a.width / 2 - surfaceBox.left;
    const y1 = a.top + a.height / 2 - surfaceBox.top;
    const x2 = b.left + b.width / 2 - surfaceBox.left;
    const y2 = b.top + b.height / 2 - surfaceBox.top;
    const d = `M ${x1} ${y1} L ${x2} ${y2}`;
    paths.push(`<path class="${edge.kind}" d="${d}" marker-end="url(#cv-arrow)"><title>${escapeHtml(edge.label)}</title></path>`);
    paths.push(`<path class="hit" d="${d}" data-edge-index="${i}"></path>`);
  });
  svg.innerHTML = `
    <defs><marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path></marker></defs>
    ${paths.join('')}`;
}

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
        <p class="arch-mini">Security groups: ${sgBoxes || '<em>none — draw a connection to auto-create one</em>'}</p>`;
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
          <input type="text" value="${escapeHtml(r.source)}" list="cv-sg-sources" data-ins="rule-source" data-index="${i}" aria-label="Source" />
          <button type="button" class="arch-del" data-ins="rule-del" data-index="${i}">✕</button></div>`).join('');
      html = `<h3>SG <input type="text" value="${escapeHtml(g.name)}" data-ins="sg-name" aria-label="Name" />
          <button type="button" class="arch-del" data-ins="delete">✕ delete</button></h3>
        <datalist id="cv-sg-sources"><option value="0.0.0.0/0"></option>
          ${arch.securityGroups.map((o) => `<option value="sg:${o.id}">${escapeHtml(o.name)}</option>`).join('')}</datalist>
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
    case 'rule-source': if (sg && sg.inbound[idx]) sg.inbound[idx].source = el.value.trim(); break;
    case 'rule-del': if (sg) removeSgRule(arch, sg.id, idx); break;
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

// One in-flight drag/connect gesture per page; cleared on drop/cancel.
let gesture = null;
// The document-level keydown listener (Escape to cancel/close, Delete or
// Backspace to remove the selection) is attached once for the page's
// lifetime, independent of (and in addition to) the mount's own attach-once
// guard below — guarded by its own module-level flag rather than piggy-
// backing on mount.dataset.cvWired so it stays correct even if a second
// mount is ever wired.
let docKeydownWired = false;

function wireCanvas(mount) { wireStaticHandlers(mount); }

// mount.innerHTML is fully replaced on every render, but the mount element
// itself persists for the page's lifetime, so delegated listeners attached
// to it survive across renders. Attach exactly once (guarded by a data
// attribute) — otherwise every re-render stacks another listener and a
// single click/pointerdown fires the handler once per prior render. Every
// listener here reads currentCtx (set at the top of renderCanvas) rather
// than closing over the ctx from whichever render first attached it, so it
// always sees the live arch/selection/challenge. A gesture in flight
// (startDrag/startConnect) threads that currentCtx snapshot through its own
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
    if (nodeEl && !event.target.closest('[data-connect]')) {
      currentCtx.onSelect(JSON.parse(nodeEl.dataset.node));
    }
  });

  mount.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const handle = event.target.closest('[data-connect]');
    const pal = event.target.closest('[data-palette]');
    const nodeEl = event.target.closest('[data-node]');
    if (handle) {
      startConnect(JSON.parse(handle.dataset.connect), event, mount, currentCtx);
      event.preventDefault();
    } else if (pal) {
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
}

function onDocumentKeydown(event) {
  // Popovers are post-gesture artifacts (the gesture that opened them has
  // already ended), so Escape must close them too, not just cancel an
  // in-flight drag/connect.
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
// hit, silently masking the container/node underneath during drag/connect
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

// Connect gesture: rubber-band line in the SVG overlay; legal endpoints are
// any [data-node] (or the IGW chip) whose ref yields a non-null intent.
function startConnect(fromRef, event, mount, ctx) {
  cancelGesture();
  const surface = mount.querySelector('.cv-surface');
  const svg = mount.querySelector('#arch-edges');
  const band = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  band.setAttribute('class', 'route');
  band.setAttribute('stroke-dasharray', '4 3');
  svg.appendChild(band);
  const box = () => surface.getBoundingClientRect();
  const start = { x: event.clientX - box().left, y: event.clientY - box().top };
  let toRef = null;

  const refAt = (e) => {
    const el = hitTarget(e.clientX, e.clientY, '[data-node]');
    return el ? JSON.parse(el.dataset.node) : null;
  };
  const move = (e) => {
    band.setAttribute('d', `M ${start.x} ${start.y} L ${e.clientX - box().left} ${e.clientY - box().top}`);
    mount.querySelectorAll('.cv-drop-ok').forEach((n) => n.classList.remove('cv-drop-ok'));
    toRef = null;
    const candidate = refAt(e);
    if (candidate && connectionIntent(fromRef, candidate, ctx.arch)) {
      const el = hitTarget(e.clientX, e.clientY, '[data-node]');
      el.classList.add('cv-drop-ok');
      toRef = candidate;
    }
  };
  const up = (e) => {
    const dropAt = { x: e.clientX, y: e.clientY };
    const finalTo = toRef;
    cancelGesture();
    if (finalTo) showIntentPopover(fromRef, finalTo, dropAt, mount, ctx);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  gesture = {
    cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      band.remove();
      mount.querySelectorAll('.cv-drop-ok').forEach((n) => n.classList.remove('cv-drop-ok'));
    },
  };
}

function showIntentPopover(fromRef, toRef, dropAt, mount, ctx) {
  const intent = connectionIntent(fromRef, toRef, ctx.arch);
  if (!intent) return;
  const portInput = intent.defaultPort !== null
    ? `<input type="number" id="cv-port" value="${intent.defaultPort}" aria-label="Port" />`
    : '';
  // escapeHtml runs first and leaves the literal "{port}" marker untouched
  // (it contains no HTML-special characters), so splitting on it directly
  // is safe even if the intent's own text (e.g. a user-edited workload
  // name) happens to contain the word "PORT" — there's no intermediate
  // sentinel for such text to collide with.
  const parts = escapeHtml(intent.description).split('{port}');
  const description = parts.join(portInput || '');
  showPopover(mount, dropAt, `
    <p><span>${description}</span></p>
    ${intent.warning ? `<p class="arch-mini">⚠ ${escapeHtml(intent.warning)}</p>` : ''}
    <div class="arch-row"><button type="button" data-ok>Confirm</button> <button type="button" data-cancel>Cancel</button></div>`,
  (pop) => {
    pop.addEventListener('click', (e) => {
      if (e.target.closest('[data-ok]')) {
        const port = pop.querySelector('#cv-port');
        intent.apply(ctx.arch, port ? { port: Number(port.value) } : {});
        closePopover(); ctx.onChange();
      }
      if (e.target.closest('[data-cancel]')) closePopover();
    });
  });
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
