// aws/js/svc-canvas.js
//
// Obsidian-style canvas for the service-diagram builder: free-floating
// service cards on a dotted surface, directed data-flow edges authored by
// dragging from a card's ○ nub onto another card. Each card carries an
// editable display name, a category accent, and (when the challenge
// defines roles) a Role dropdown. Committed edits go through
// ctx.onChange; card moves persist via ctx.onLayout without invalidating
// Check results. Delegated listeners attach once and read a module-level
// ctx — the same pattern the VPC-era canvas used.

import { escapeHtml } from './lib/html.js';
import { CATEGORIES, SERVICE_TYPES, serviceLabel, serviceCategory, serviceDoc } from './lib/svcCatalog.js';
import { getNode, addNode, updateNode, removeNode, addEdge, removeEdge } from './lib/svcModel.js';

let currentCtx = null;
let sel = null;          // { kind: 'node', id } | { kind: 'edge', from, to } | null
let gesture = null;      // in-flight drag { cleanup(), revert?() }
let docWired = false;

const esc = escapeHtml;

// ---------------------------------------------------------------------------
// Geometry + auto-layout. pos is presentation metadata on each node;
// evaluators ignore it. Categories collapse into diagram columns so
// pos-less graphs (start states, revealed reference solutions) read
// left-to-right like an AWS architecture diagram.
// ---------------------------------------------------------------------------

export const CANVAS = {
  cardWidth: 210,
  colWidth: 250,
  leftX: 24,
  topY: 24,
  gapY: 16,
};

const CATEGORY_COLUMN = {
  client: 0,
  edge: 1,
  security: 1,
  compute: 2,
  iot: 2,
  integration: 3,
  containers: 3,
  storage: 4,
  database: 4,
  observability: 4,
};

export function estimateCardHeight(challenge) {
  return 96 + (challenge.roles.length > 0 ? 30 : 0);
}

// Assigns pos to every node that lacks one: stack into the node's
// category column, below anything already positioned there.
export function layoutGraph(graph, challenge) {
  const nodes = Array.isArray(graph?.nodes) ? graph.nodes : [];
  const categoryCol = (node) => CATEGORY_COLUMN[serviceCategory(node.type)] ?? 2;
  // Positioned cards raise the floor of the column they actually SIT in
  // (they may have been dragged out of their category column), so a new
  // card is never auto-placed on top of a user-moved one.
  const occupiedCol = (n) => Math.max(0, Math.round((n.pos.x - CANVAS.leftX) / CANVAS.colWidth));
  const bottoms = new Map(); // column index -> stacking floor
  const hasPos = (n) => n.pos && Number.isFinite(n.pos.x) && Number.isFinite(n.pos.y);
  for (const n of nodes) {
    if (!hasPos(n)) continue;
    const col = occupiedCol(n);
    bottoms.set(col, Math.max(bottoms.get(col) ?? CANVAS.topY, n.pos.y + estimateCardHeight(challenge) + CANVAS.gapY));
  }
  for (const n of nodes) {
    if (hasPos(n)) continue;
    const col = categoryCol(n);
    const y = bottoms.get(col) ?? CANVAS.topY;
    // auto marks estimate-placed cards; the canvas re-packs them once with
    // MEASURED heights after the first render, then clears the flag.
    n.pos = { x: CANVAS.leftX + col * CANVAS.colWidth, y, auto: true };
    bottoms.set(col, y + estimateCardHeight(challenge) + CANVAS.gapY);
  }
  return graph;
}

// ---------------------------------------------------------------------------
// Rendering
// ---------------------------------------------------------------------------

function card(node, challenge) {
  const category = serviceCategory(node.type);
  const doc = serviceDoc(node.type);
  const roleOpts = ['', ...challenge.roles.map((r) => r.id)].map((id) => {
    const role = challenge.roles.find((r) => r.id === id);
    return `<option value="${esc(id)}" ${(node.role ?? '') === id ? 'selected' : ''}>${esc(role ? role.label : '(none)')}</option>`;
  }).join('');
  const roleRow = challenge.roles.length ? `
    <div class="oc-role">
      <label class="cg-label" title="Binds this card to a challenge role so goals can refer to it.">Role</label>
      <select data-act="node-role" data-node="${esc(node.id)}" aria-label="Role">${roleOpts}</select>
    </div>` : '';
  const pos = node.pos || { x: CANVAS.leftX, y: CANVAS.topY };
  return `
    <div class="oc-card oc-cat-${esc(category || 'compute')} ${sel?.kind === 'node' && sel.id === node.id ? 'oc-selected' : ''}"
         data-node="${esc(node.id)}"
         style="left: ${Number(pos.x)}px; top: ${Number(pos.y)}px; width: ${CANVAS.cardWidth}px;">
      <input type="text" class="oc-name" value="${esc(node.name)}" data-act="node-name" data-node="${esc(node.id)}" aria-label="Name" />
      <div class="oc-type" ${doc ? `title="${esc(doc)}"` : ''}>${esc(serviceLabel(node.type))}</div>
      ${roleRow}
      <span class="oc-fdot oc-fdot-w" title="Drag onto another card to draw a data-flow arrow"></span>
      <span class="oc-fdot oc-fdot-e" title="Drag onto another card to draw a data-flow arrow"></span>
    </div>`;
}

export function renderGraphCanvas(mount, ctx) {
  currentCtx = ctx;
  const { graph, challenge } = ctx;
  layoutGraph(graph, challenge);
  if (sel?.kind === 'node' && !getNode(graph, sel.id)) sel = null;
  if (sel?.kind === 'edge' && !graph.edges.some((e) => e.from === sel.from && e.to === sel.to)) sel = null;

  // Scroll only carries across re-renders of the SAME challenge.
  const prevCanvas = mount.querySelector('.oc-canvas');
  const scroll = prevCanvas && prevCanvas.dataset.graphFor === challenge.id
    ? { left: prevCanvas.scrollLeft, top: prevCanvas.scrollTop } : null;

  const est = estimateCardHeight(challenge);
  const surfaceW = Math.max(1290, ...graph.nodes.map((n) => (n.pos?.x ?? 0) + CANVAS.cardWidth + 80));
  const surfaceH = Math.max(640, ...graph.nodes.map((n) => (n.pos?.y ?? 0) + est + 160));
  const chipRows = CATEGORIES.map((cat) => {
    const chips = Object.entries(SERVICE_TYPES)
      .filter(([, spec]) => spec.category === cat.id)
      .map(([type, spec]) => `
        <button type="button" class="oc-add-chip oc-cat-${esc(cat.id)}" data-act="node-add" data-type="${esc(type)}"
          title="${esc(spec.doc)}">+ ${esc(spec.label)}</button>`).join('');
    return `<span class="oc-chip-group"><span class="oc-chip-label">${esc(cat.label)}</span>${chips}</span>`;
  }).join('');

  mount.innerHTML = `
    <h2>Services</h2>
    <div class="arch-row cg-add-row">${chipRows}</div>
    <div class="oc-canvas" data-graph-for="${esc(challenge.id)}">
      <div class="oc-surface" style="width: ${surfaceW}px; height: ${surfaceH}px;">
        <svg class="oc-edges" aria-hidden="true"></svg>
        ${graph.nodes.map((node) => card(node, challenge)).join('')}
        <div class="oc-toolbar" hidden><button type="button" data-act="tb-del" title="Delete">🗑</button></div>
      </div>
    </div>
    <p class="arch-mini">Drag cards to arrange. Each card has a ○ nub on its edges: drag it onto
      another card to draw a directed data-flow arrow (the arrowhead points at the receiver).
      Click an arrow or a card to select it; Delete removes it. Hover a card's service name
      for what the service does.</p>`;

  const canvas = mount.querySelector('.oc-canvas');
  if (scroll) { canvas.scrollLeft = scroll.left; canvas.scrollTop = scroll.top; }
  packAutoPlaced(mount, ctx);
  redrawEdges(mount);
  positionToolbar(mount);
  wire(mount);
}

// Estimate-placed cards (pos.auto) get one measured re-pack after the DOM
// exists; user-positioned cards define the floors and are never moved.
function packAutoPlaced(mount, ctx) {
  const { graph } = ctx;
  const columns = new Map();
  for (const node of graph.nodes) {
    if (!node.pos) continue;
    const col = Math.round((node.pos.x - CANVAS.leftX) / CANVAS.colWidth);
    if (!columns.has(col)) columns.set(col, []);
    columns.get(col).push(node);
  }
  let movedAny = false;
  for (const nodes of columns.values()) {
    nodes.sort((a, b) => a.pos.y - b.pos.y);
    let bottom = 0;
    for (const node of nodes) {
      const rect = cardRect(mount, node.id);
      if (!rect) continue;
      if (node.pos.auto) {
        if (node.pos.y < bottom) {
          node.pos.y = bottom;
          rect.el.style.top = `${bottom}px`;
        }
        delete node.pos.auto;
        movedAny = true; // flag removal must persist too
      }
      bottom = Math.max(bottom, node.pos.y + rect.el.offsetHeight + CANVAS.gapY);
    }
  }
  if (movedAny) ctx.onLayout();
}

export function unmountGraphCanvas() {
  currentCtx = null;
  sel = null;
  cancelGesture();
}

// discard=true (Escape) also reverts any live visual state the gesture
// changed; a normal pointerup commits instead, so it never discards.
function cancelGesture(discard = false) {
  if (!gesture) return;
  if (discard && gesture.revert) gesture.revert();
  gesture.cleanup();
  gesture = null;
}

function surfaceEl(mount) { return mount.querySelector('.oc-surface'); }

function cardRect(mount, id) {
  const el = surfaceEl(mount)?.querySelector(`[data-node="${CSS.escape(id)}"]`);
  if (!el || !el.classList.contains('oc-card')) return null;
  return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, el };
}

// Arrows leave from the card edge facing the target, at mid-height.
function cardAnchor(rect, towardX) {
  const dir = towardX >= rect.x + rect.w / 2 ? 1 : -1;
  return { x: dir > 0 ? rect.x + rect.w : rect.x, y: rect.y + rect.h / 2, dir };
}

// Obsidian-style S-curve from an anchor into the facing side of the
// target rect.
function edgePathFrom(a, b) {
  const bcx = b.x + b.w / 2; const bcy = b.y + b.h / 2;
  const dx = bcx - a.x; const dy = bcy - a.y;
  const k = Math.max(40, Math.min(90, Math.hypot(dx, dy) / 2));
  const c1x = a.x + k * a.dir; const c1y = a.y;
  let tx; let ty; let c2x; let c2y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    tx = dx > 0 ? b.x : b.x + b.w; ty = bcy;
    c2x = tx + (dx > 0 ? -k : k); c2y = ty;
  } else {
    tx = bcx; ty = dy > 0 ? b.y : b.y + b.h;
    c2x = tx; c2y = ty + (dy > 0 ? -k : k);
  }
  return { d: `M ${a.x} ${a.y} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`, mx: (a.x + tx) / 2, my: (a.y + ty) / 2 };
}

function redrawEdges(mount) {
  const svg = mount.querySelector('.oc-edges');
  if (!svg || !currentCtx) return;
  const paths = [];
  for (const edge of currentCtx.graph.edges) {
    const aRect = cardRect(mount, edge.from);
    const b = cardRect(mount, edge.to);
    if (!aRect || !b) continue;
    const a = cardAnchor(aRect, b.x + b.w / 2);
    const { d } = edgePathFrom(a, b);
    const selected = sel?.kind === 'edge' && sel.from === edge.from && sel.to === edge.to;
    paths.push(`<path class="oc-edge ${selected ? 'oc-edge-selected' : ''}" d="${d}"
      marker-end="url(#${selected ? 'oc-arr-sel' : 'oc-arr'})"></path>`);
    paths.push(`<path class="oc-hit" d="${d}" data-from="${esc(edge.from)}" data-to="${esc(edge.to)}"></path>`);
  }
  svg.innerHTML = `
    <defs>
      <marker id="oc-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" class="oc-arrhead"></path></marker>
      <marker id="oc-arr-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" class="oc-arrhead-selected"></path></marker>
    </defs>
    ${paths.join('')}`;
}

function positionToolbar(mount) {
  const tb = mount.querySelector('.oc-toolbar');
  if (!tb) return;
  if (!sel) { tb.hidden = true; return; }
  if (sel.kind === 'node') {
    const rect = cardRect(mount, sel.id);
    if (!rect) { tb.hidden = true; return; }
    tb.style.left = `${rect.x + rect.w / 2 - 20}px`;
    tb.style.top = `${Math.max(4, rect.y - 42)}px`;
    tb.querySelector('button').title = 'Delete service';
    tb.hidden = false;
  } else {
    const aRect = cardRect(mount, sel.from);
    const b = cardRect(mount, sel.to);
    if (!aRect || !b) { tb.hidden = true; return; }
    const { mx, my } = edgePathFrom(cardAnchor(aRect, b.x + b.w / 2), b);
    tb.style.left = `${mx - 20}px`;
    tb.style.top = `${my - 48}px`;
    tb.querySelector('button').title = 'Delete arrow';
    tb.hidden = false;
  }
}

function select(mount, next) {
  sel = next;
  for (const el of mount.querySelectorAll('.oc-card.oc-selected')) el.classList.remove('oc-selected');
  if (sel?.kind === 'node') {
    cardRect(mount, sel.id)?.el.classList.add('oc-selected');
  }
  redrawEdges(mount);
  positionToolbar(mount);
}

function deleteSelection(mount) {
  if (!sel || !currentCtx) return;
  const { graph } = currentCtx;
  if (sel.kind === 'node') removeNode(graph, sel.id);
  else removeEdge(graph, sel.from, sel.to);
  sel = null;
  currentCtx.onChange();
}

function beginMove(mount, cardEl, event) {
  cancelGesture();
  const startX = event.clientX; const startY = event.clientY;
  const origLeft = cardEl.offsetLeft; const origTop = cardEl.offsetTop;
  let moved = false;
  let raf = null;
  const move = (e) => {
    const dx = e.clientX - startX; const dy = e.clientY - startY;
    if (!moved && Math.hypot(dx, dy) < 5) return;
    if (!moved) { moved = true; cardEl.classList.add('oc-dragging'); }
    cardEl.style.left = `${Math.max(4, origLeft + dx)}px`;
    cardEl.style.top = `${Math.max(4, origTop + dy)}px`;
    if (!raf) raf = requestAnimationFrame(() => { raf = null; redrawEdges(mount); positionToolbar(mount); });
  };
  const up = () => {
    cancelGesture();
    const id = cardEl.dataset.node;
    if (!moved) { select(mount, { kind: 'node', id }); return; }
    // A re-render mid-drag detaches cardEl; a detached element reads
    // offsetLeft/Top 0,0 — never persist that as a position.
    if (!cardEl.isConnected) return;
    const node = getNode(currentCtx.graph, id);
    if (!node) return;
    node.pos = { x: cardEl.offsetLeft, y: cardEl.offsetTop };
    currentCtx.onLayout();
    redrawEdges(mount);
    positionToolbar(mount);
  };
  const cancel = () => cancelGesture(true);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
  gesture = {
    cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      cardEl.classList.remove('oc-dragging');
      if (raf) cancelAnimationFrame(raf);
    },
    // Escape mid-drag: the card must snap back — leaving it at the cursor
    // position LOOKS committed while node.pos was never written.
    revert() {
      cardEl.style.left = `${origLeft}px`;
      cardEl.style.top = `${origTop}px`;
      redrawEdges(mount);
      positionToolbar(mount);
    },
  };
}

function beginLink(mount, cardEl, event) {
  cancelGesture();
  const { graph } = currentCtx;
  const source = getNode(graph, cardEl.dataset.node);
  if (!source) return;
  const candidates = [...surfaceEl(mount).querySelectorAll('.oc-card')]
    .filter((el) => el !== cardEl);
  for (const el of candidates) el.classList.add('oc-can-accept');
  const svg = mount.querySelector('.oc-edges');
  const temp = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  temp.setAttribute('class', 'oc-edge oc-edge-temp');
  svg.appendChild(temp);
  const surface = surfaceEl(mount);
  const toSurface = (e) => {
    const box = surface.getBoundingClientRect();
    return { x: e.clientX - box.left, y: e.clientY - box.top };
  };
  const move = (e) => {
    const p = toSurface(e);
    const rect = cardRect(mount, source.id);
    if (!rect) return;
    const a = cardAnchor(rect, p.x);
    const { d } = edgePathFrom(a, { x: p.x - 1, y: p.y - 1, w: 2, h: 2 });
    temp.setAttribute('d', d);
  };
  // Geometric drop detection (not elementsFromPoint): deterministic under
  // overlays. Topmost wins on overlap: later DOM order paints on top, so
  // take the LAST containing candidate.
  const up = (e) => {
    const p = toSurface(e);
    const hits = candidates.filter((el) => p.x >= el.offsetLeft && p.x <= el.offsetLeft + el.offsetWidth
      && p.y >= el.offsetTop && p.y <= el.offsetTop + el.offsetHeight);
    const hitCard = hits[hits.length - 1];
    cancelGesture();
    if (!hitCard) return;
    if (addEdge(graph, source.id, hitCard.dataset.node)) currentCtx.onChange();
  };
  const cancel = () => cancelGesture(true);
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  window.addEventListener('pointercancel', cancel, { once: true });
  gesture = {
    cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      temp.remove();
      for (const el of candidates) el.classList.remove('oc-can-accept');
    },
  };
  move(event);
}

function wire(mount) {
  if (!mount.dataset.ocWired) {
    mount.dataset.ocWired = '1';
    mount.addEventListener('change', applyForm);
    mount.addEventListener('click', (event) => {
      if (!currentCtx) return;
      const btn = event.target.closest('button[data-act]');
      if (btn) { applyButton(mount, btn); return; }
      const hit = event.target.closest('.oc-hit');
      if (hit) {
        select(mount, { kind: 'edge', from: hit.dataset.from, to: hit.dataset.to });
        return;
      }
      if (!event.target.closest('.oc-card') && event.target.closest('.oc-surface')) {
        select(mount, null);
      }
    });

    mount.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !currentCtx) return;
      const dot = event.target.closest('.oc-fdot');
      if (dot) {
        event.preventDefault();
        beginLink(mount, dot.closest('.oc-card'), event);
        return;
      }
      const cardEl = event.target.closest('.oc-card');
      if (cardEl && !event.target.closest('input, select, button, textarea, label')) {
        event.preventDefault();
        beginMove(mount, cardEl, event);
      }
    });
  }

  if (!docWired) {
    docWired = true;
    document.addEventListener('keydown', (event) => {
      if (!currentCtx) return;
      if (event.key === 'Escape') { cancelGesture(true); select(mountOf(), null); return; }
      // A delete mid-gesture would re-render the canvas and detach the
      // card being dragged — finish or cancel the gesture first.
      if ((event.key === 'Delete' || event.key === 'Backspace') && sel && !gesture
          && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) {
        deleteSelection(mountOf());
      }
    });
  }
}

// The canvas mount persists for the page's lifetime; the document-level
// keydown handler needs it without a render threading it through.
function mountOf() {
  return document.getElementById('arch-forms');
}

function applyButton(mount, btn) {
  const { graph } = currentCtx;
  if (btn.dataset.act === 'tb-del') { deleteSelection(mount); return; }
  if (btn.dataset.act === 'node-add') {
    addNode(graph, btn.dataset.type);
    currentCtx.onChange();
  }
}

function applyForm(event) {
  const el = event.target.closest('[data-act]');
  if (!el || !currentCtx || el.tagName === 'BUTTON') return;
  const { graph } = currentCtx;
  const node = getNode(graph, el.dataset.node);
  if (!node) return;
  if (el.dataset.act === 'node-name') {
    const next = el.value.trim();
    if (!next) { el.value = node.name; return; }
    if (next === node.name) return;
    updateNode(graph, node.id, { name: next });
    // The commit fires on blur — usually mid-click on whatever the user is
    // pressing next. A synchronous re-render would destroy that click's
    // target and swallow the press, so persist now and defer the re-render
    // to a macrotask. Existing Check results stay (a rename only changes
    // labels); the next Check re-reads names anyway.
    currentCtx.onLayout();
    setTimeout(() => { if (currentCtx) currentCtx.onSoftChange(); }, 0);
  }
  if (el.dataset.act === 'node-role') {
    updateNode(graph, node.id, { role: el.value || null });
    currentCtx.onChange();
  }
}
