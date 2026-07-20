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
} from './lib/archModel.js';
import { derivedEdges } from './lib/archCanvasRules.js';

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

// Filled in by Task 5.
function renderInspector(mount, ctx) { mount.innerHTML = ''; }

// Filled in by Task 4 (drag/connect/popovers). This task wires only:
// selection clicks, palette click-to-add, and the IGW toggle.
function wireCanvas(mount) { wireStaticHandlers(mount); }

// mount.innerHTML is fully replaced on every render, but the mount element
// itself persists for the page's lifetime, so a delegated listener attached
// to it survives across renders. Attach exactly once (guarded by a data
// attribute) — otherwise every re-render stacks another listener and a
// single click fires the handler once per prior render. The handler reads
// currentCtx (set at the top of renderCanvas) rather than closing over the
// ctx from whichever render first attached it, so it always sees the live
// arch/selection/challenge.
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
