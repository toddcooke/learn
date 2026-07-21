// aws/js/arch-canvas.js
//
// Read-only renderer for the Architecture Challenge diagram. The CFN
// template (cfn-editor.js) is the only input surface; this module renders
// the compiled model — layout, chips, derived arrows — and reports node
// clicks so the page can jump the editor to a resource's definition.
// Rendering is stateless per call except for the module-level refs the
// once-attached resize handler needs to redraw arrows.

import { escapeHtml } from './lib/html.js';
import { AZS, isPublicSubnet, effectiveRouteTable } from './lib/archModel.js';
import { derivedEdges } from './lib/archCanvasRules.js';

// Live refs for the once-per-page resize handler: window resizes (e.g. the
// workbench grid collapsing at its breakpoint) move every node, so arrows
// must be redrawn from fresh getBoundingClientRect calls.
let lastMount = null;
let lastArgs = null;
let resizeWired = false;
let resizeTimer = null;

export function renderCanvas(mount, args) {
  lastMount = mount;
  lastArgs = args;
  const { arch, highlightId, stale } = args;
  const hl = (id) => (highlightId === id ? 'cv-hl' : '');
  const chip = (id, label) =>
    `<span class="cv-chip ${hl(id)}" data-id="${escapeHtml(id)}">${escapeHtml(label)}</span>`;

  const azsInUse = AZS.filter((az) => arch.subnets.some((s) => s.az === az));
  const azCols = azsInUse.map((az) => {
    const cards = arch.subnets.filter((s) => s.az === az).map((s) => {
      const nodes = [
        ...arch.natGateways.filter((n) => n.subnetId === s.id).map((n) => chip(n.id, `NAT ${n.id}`)),
        ...arch.workloads.filter((w) => w.subnetIds.includes(s.id)).map((w) =>
          chip(w.id, `${w.type.toUpperCase()} ${w.name}${w.publicIp ? ' ⬆' : ''}`)),
      ].join('');
      const pub = isPublicSubnet(arch, s.id);
      const rt = effectiveRouteTable(arch, s.id);
      return `
        <div class="cv-subnet ${pub ? 'is-public' : 'is-private'} ${hl(s.id)}" data-id="${escapeHtml(s.id)}">
          <strong>${escapeHtml(s.name)}</strong> <span class="cidr">${escapeHtml(s.cidr)}</span>
          <span class="arch-mini">${pub ? 'public' : 'private'} · ${escapeHtml(rt ? rt.name : '?')}</span>
          <div>${nodes}</div>
        </div>`;
    }).join('');
    return `<div class="cv-az"><h4>AZ ${escapeHtml(az)}</h4>${cards}</div>`;
  }).join('');

  const unplaced = arch.workloads.filter((w) => w.subnetIds.length === 0).map((w) =>
    chip(w.id, `${w.type.toUpperCase()} ${w.name} (unplaced)`)).join('');
  const tray = arch.securityGroups.map((g) =>
    chip(g.id, `SG ${g.name} (${g.inbound.length})`)).join('');

  mount.innerHTML = `
    <h2>Architecture</h2>
    <p class="arch-mini">Rendered live from your template. Click a node to jump to its definition.</p>
    <div class="cv-surface ${stale ? 'cv-stale' : ''}">
      ${stale ? `<span class="cv-stale-badge">template has ${Number(stale.errors)} error${Number(stale.errors) === 1 ? '' : 's'} — showing last valid design</span>` : ''}
      <div class="cv-internet">🌐 Internet</div>
      <div class="cv-vpc">
        <span class="cv-igw-chip ${arch.vpc.igwAttached ? 'attached' : ''}" data-igw>
          IGW ${arch.vpc.igwAttached ? 'attached' : 'not attached'}</span>
        <span class="cidr">VPC ${escapeHtml(arch.vpc.cidr)}</span>
        ${azsInUse.length
          ? `<div class="cv-az-grid">${azCols}</div>`
          : '<p class="arch-mini">No subnets yet — declare AWS::EC2::Subnet resources in the template.</p>'}
      </div>
      ${unplaced ? `<p class="arch-mini">Unplaced: ${unplaced}</p>` : ''}
      <div class="cv-tray"><span class="arch-mini">Security groups:</span> ${tray || '<span class="arch-mini">none yet</span>'}</div>
      <svg id="arch-edges" aria-hidden="true"></svg>
    </div>
    <p class="cv-legend arch-mini">
      <svg class="cv-legend-line" viewBox="0 0 20 8" aria-hidden="true"><line x1="1" y1="4" x2="19" y2="4" class="route"></line></svg>
      route (where a subnet's traffic goes)
      <span aria-hidden="true">·</span>
      <svg class="cv-legend-line" viewBox="0 0 20 8" aria-hidden="true"><line x1="1" y1="4" x2="19" y2="4" class="sg-rule"></line></svg>
      security-group rule (allowed inbound traffic)
    </p>
    <p class="arch-mini">Simplification: security groups are inbound-only here; outbound is allow-all.</p>`;

  drawEdges(mount, arch);
  wireClicks(mount);
}

// Called by the host page when navigating back to the landing list, so the
// resize handler sees "no canvas mounted" and no-ops.
export function unmountCanvas() {
  lastMount = null;
  lastArgs = null;
}

// Clamps a ray from a rectangle's center toward another point to that
// rectangle's own border (a simple line/box intersection: scale the
// direction vector so it lands on whichever half-extent it reaches first),
// so edge lines start/stop at box borders instead of crossing interiors.
// The parameter t along the segment MUST be clamped to [0, 1]: an
// unclamped t can exceed 1 whenever the two elements are close together or
// overlapping relative to their own size, which would shoot the point past
// the segment; clamping pins degenerate/overlapping boxes (including a
// true zero-length segment, where both scales are Infinity) to the plain
// center-to-center line rather than a NaN or an overshoot.
function clampToBorder(cx, cy, dx, dy, halfW, halfH) {
  const scaleX = dx !== 0 ? halfW / Math.abs(dx) : Infinity;
  const scaleY = dy !== 0 ? halfH / Math.abs(dy) : Infinity;
  const t = Math.min(scaleX, scaleY, 1);
  return { x: cx + dx * t, y: cy + dy * t };
}

// Route edges store just the destination CIDR as `label`; build the fuller
// pill text from the edge's resolved `to` ref. SG-rule edges already carry
// their full text in `label`.
function edgeLabelText(edge) {
  if (edge.kind !== 'route') return edge.label;
  const dest = edge.to.type === 'igw' ? 'IGW' : `NAT ${edge.to.id}`;
  return `${edge.label} → ${dest}`;
}

// Arrows between element edges (not centers), in cv-surface coords, each
// carrying a midpoint label pill so its meaning reads without a hover. The
// invisible fat .hit companion path exists only to give the <title>
// tooltip a hoverable stroke.
function drawEdges(mount, arch) {
  const svg = mount.querySelector('#arch-edges');
  const surface = mount.querySelector('.cv-surface');
  const surfaceBox = surface.getBoundingClientRect();
  const anchor = (r) => {
    let el = null;
    if (r.type === 'igw') el = surface.querySelector('[data-igw]');
    else if (r.type === 'internet') el = surface.querySelector('.cv-internet');
    else el = surface.querySelector(`[data-id="${CSS.escape(r.id)}"]`);
    return el ? el.getBoundingClientRect() : null;
  };
  const paths = [];
  const labels = [];
  derivedEdges(arch).forEach((edge) => {
    const a = anchor(edge.from);
    const b = anchor(edge.to);
    if (!a || !b) return;
    const ax = a.left + a.width / 2 - surfaceBox.left;
    const ay = a.top + a.height / 2 - surfaceBox.top;
    const bx = b.left + b.width / 2 - surfaceBox.left;
    const by = b.top + b.height / 2 - surfaceBox.top;
    const start = clampToBorder(ax, ay, bx - ax, by - ay, a.width / 2, a.height / 2);
    const end = clampToBorder(bx, by, ax - bx, ay - by, b.width / 2, b.height / 2);
    const d = `M ${start.x} ${start.y} L ${end.x} ${end.y}`;
    // Offset the label perpendicular to the line so its pill sits beside
    // the line rather than centered on top of it.
    const dx = end.x - start.x;
    const dy = end.y - start.y;
    const len = Math.hypot(dx, dy) || 1;
    const offset = 9;
    const mx = (start.x + end.x) / 2 + (-dy / len) * offset;
    const my = (start.y + end.y) / 2 + (dx / len) * offset;
    paths.push(`<path class="${edge.kind}" d="${d}" marker-end="url(#cv-arrow)"></path>`);
    paths.push(`<path class="hit" d="${d}"><title>${escapeHtml(edge.label)}</title></path>`);
    labels.push({ kind: edge.kind, x: mx, y: my, text: edgeLabelText(edge) });
  });
  svg.innerHTML = `
    <defs><marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="9" markerHeight="9" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path></marker></defs>
    ${paths.join('')}
    ${labels.map((l) => `<text class="cv-edge-label ${l.kind}" data-kind="${l.kind}" x="${l.x}" y="${l.y}"
      text-anchor="middle" dominant-baseline="middle" pointer-events="none">${escapeHtml(l.text)}</text>`).join('')}`;
  // Second pass: an opaque background rect sized to each label's measured
  // text (only known once the <text> is laid out), inserted right before
  // it so the pill reads clearly over lines/cards.
  svg.querySelectorAll('text.cv-edge-label').forEach((textEl) => {
    const box = textEl.getBBox();
    const padX = 4;
    const padY = 3;
    const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    rect.setAttribute('class', `cv-edge-label-bg ${textEl.dataset.kind}`);
    rect.setAttribute('x', box.x - padX);
    rect.setAttribute('y', box.y - padY);
    rect.setAttribute('width', box.width + padX * 2);
    rect.setAttribute('height', box.height + padY * 2);
    rect.setAttribute('rx', 3);
    rect.setAttribute('pointer-events', 'none');
    textEl.before(rect);
  });
}

// mount.innerHTML is replaced every render but the mount element persists,
// so the delegated click listener attaches once and reads lastArgs for the
// live callback.
function wireClicks(mount) {
  if (mount.dataset.cvWired) return;
  mount.dataset.cvWired = '1';
  mount.addEventListener('click', (event) => {
    const nodeEl = event.target.closest('[data-id]');
    if (nodeEl && lastArgs && lastArgs.onNodeClick) lastArgs.onNodeClick(nodeEl.dataset.id);
  });
  if (!resizeWired) {
    resizeWired = true;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => {
        if (!lastArgs || !lastMount || !lastMount.isConnected) return;
        drawEdges(lastMount, lastArgs.arch);
      }, 100);
    });
  }
}
