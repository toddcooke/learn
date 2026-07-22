// aws/js/arch-graph-canvas.js
//
// Obsidian-style canvas for the CloudFormation card builder: free-floating
// resource cards on a dotted surface with AZ lanes, reference properties
// authored by dragging an arrow from a card's edge dot onto a target card,
// and smooth bezier edges labeling the property they set. Text properties
// stay inline form fields on the cards. The property a dropped arrow sets
// is inferred from the target's kind — unambiguous in this schema (checked
// at module load). Dropping a Subnet card in a lane sets AvailabilityZone.
// Committed edits on 'change'; card moves persist via onLayout without
// invalidating Check results. Delegated listeners attach once and read a
// module-level ctx.

import { escapeHtml } from './lib/html.js';
import { RESOURCE_TYPES, typeDoc, propDoc } from './lib/cfnSchema.js';
import {
  DEFAULT_IMAGE_ID, AZ_PREFIX, CANVAS, laneForX, layoutGraph, estimateCardHeight,
} from './lib/archGraph.js';

let currentCtx = null;
let sel = null;          // { kind: 'card', id } | { kind: 'edge', res, prop, target } | null
let gesture = null;      // in-flight drag { cleanup() }
let docWired = false;

const esc = escapeHtml;
const kindOf = (type) => RESOURCE_TYPES[type].kind;
const displayKind = (type) => RESOURCE_TYPES[type].workloadType || RESOURCE_TYPES[type].kind;

// targetKind -> { prop, list } per source type; a dropped arrow uses this
// to pick the property. Ambiguity would be a schema bug — fail loudly.
const ACCEPTS = {};
for (const [type, spec] of Object.entries(RESOURCE_TYPES)) {
  ACCEPTS[type] = {};
  for (const [name, ps] of Object.entries(spec.props)) {
    if (ps.ignored || ps.check === 'tags' || ps.check === 'ingress') continue;
    const kind = ps.ref || ps.refList || (ps.getAtt && ps.getAtt.kind);
    if (!kind) continue;
    if (ACCEPTS[type][kind]) throw new Error(`ambiguous ref target kind ${kind} on ${type}`);
    ACCEPTS[type][kind] = { prop: name, list: !!ps.refList };
  }
}

function idsOfKind(graph, kind) {
  return graph.resources.filter((r) => RESOURCE_TYPES[r.type] && kindOf(r.type) === kind).map((r) => r.id);
}

function soleId(graph, kind) {
  const ids = idsOfKind(graph, kind);
  return ids.length === 1 ? ids[0] : undefined;
}

const AZS = ['a', 'b', 'c'];

function refStatus(res, name, spec, value) {
  const doc = propDoc(res.type, name);
  const label = `<label class="cg-label" ${doc ? `title="${esc(doc)}"` : ''}>${esc(name)}${spec.required ? ' *' : ''}</label>`;
  let status;
  if (spec.refList) {
    status = Array.isArray(value) && value.length
      ? `→ ${value.map(esc).join(', ')}`
      : '<span class="oc-unset">drag from a dot to add</span>';
  } else {
    status = value !== undefined && value !== ''
      ? `→ ${esc(String(value))}`
      : '<span class="oc-unset">drag from a dot to set</span>';
  }
  return `<div class="cg-row">${label}<div class="cg-field oc-ref">${status}</div></div>`;
}

function propRow(graph, res, name, spec) {
  const value = res.props[name];
  if (spec.ref || spec.getAtt || spec.refList) return refStatus(res, name, spec, value);
  if (res.type === 'AWS::EC2::Subnet' && name === 'AvailabilityZone') return ''; // lane placement owns it
  const attrs = `data-act="prop" data-res="${esc(res.id)}" data-prop="${esc(name)}"`;
  const doc = propDoc(res.type, name);
  const label = `<label class="cg-label" ${doc ? `title="${esc(doc)}"` : ''}>${esc(name)}${spec.required ? ' *' : ''}</label>`;
  let field;
  if (spec.enum) {
    field = `<select ${attrs} aria-label="${esc(name)}">
      ${spec.enum.map((v) => `<option value="${esc(String(v))}" ${String(value ?? spec.enum[0]) === String(v) ? 'selected' : ''}>${esc(String(v))}</option>`).join('')}</select>`;
  } else if (spec.check === 'bool') {
    field = `<input type="checkbox" ${attrs} ${value === true ? 'checked' : ''} />`;
  } else if (spec.check === 'az') {
    field = `<select ${attrs} aria-label="${esc(name)}">
      ${AZS.map((az) => `<option value="${AZ_PREFIX}${az}" ${value === `${AZ_PREFIX}${az}` ? 'selected' : ''}>${AZ_PREFIX}${az}</option>`).join('')}</select>`;
  } else if (spec.check === 'port') {
    field = `<input type="number" min="0" max="65535" ${attrs} value="${value !== undefined ? Number(value) : ''}" />`;
  } else if (spec.check === 'ingress') {
    field = ingressEditor(graph, res, name, value);
  } else {
    field = `<input type="text" ${attrs} value="${esc(value !== undefined ? String(value) : '')}" />`;
  }
  return `<div class="cg-row">${label}<div class="cg-field">${field}</div></div>`;
}

function ingressEditor(graph, res, name, rules) {
  const sgIds = idsOfKind(graph, 'sg');
  const rows = (Array.isArray(rules) ? rules : []).map((rule, i) => {
    const attrs = (part) => `data-act="rule-${part}" data-res="${esc(res.id)}" data-index="${i}"`;
    const srcKind = rule.SourceSecurityGroupId ? `sg:${rule.SourceSecurityGroupId}`
      : rule.CidrIp === '0.0.0.0/0' ? 'anywhere' : 'cidr';
    const tcpish = rule.IpProtocol === 'tcp' || rule.IpProtocol === 'udp';
    return `
      <div class="arch-row">
        <select ${attrs('proto')} aria-label="IpProtocol">
          ${['tcp', 'udp', 'icmp', '-1'].map((pr) => `<option value="${pr}" ${rule.IpProtocol === pr ? 'selected' : ''}>${pr}</option>`).join('')}</select>
        ${tcpish ? `
          <input type="number" min="0" max="65535" ${attrs('portfrom')} value="${rule.FromPort !== undefined ? Number(rule.FromPort) : ''}" aria-label="FromPort" placeholder="from" />
          <span class="arch-mini">–</span>
          <input type="number" min="0" max="65535" ${attrs('portto')} value="${rule.ToPort !== undefined ? Number(rule.ToPort) : ''}" aria-label="ToPort" placeholder="to" />` : ''}
        <span class="arch-mini">from</span>
        <select ${attrs('srckind')} aria-label="Source kind">
          <option value="anywhere" ${srcKind === 'anywhere' ? 'selected' : ''}>CidrIp: 0.0.0.0/0</option>
          <option value="cidr" ${srcKind === 'cidr' ? 'selected' : ''}>CidrIp: custom</option>
          ${sgIds.map((id) => `<option value="sg:${esc(id)}" ${srcKind === `sg:${id}` ? 'selected' : ''}>Source: ${esc(id)}</option>`).join('')}</select>
        ${srcKind === 'cidr' ? `<input type="text" ${attrs('srccidr')} value="${esc(rule.CidrIp ?? '')}" aria-label="CidrIp" placeholder="203.0.113.0/24" />` : ''}
        <button type="button" class="arch-del" ${attrs('del')} title="Delete rule">✕</button>
      </div>`;
  }).join('');
  return `${rows}
    <button type="button" class="fm-add" data-act="rule-add" data-res="${esc(res.id)}" data-prop="${esc(name)}">+ Add rule</button>`;
}

function sugarRows(res, challenge) {
  const spec = RESOURCE_TYPES[res.type];
  if (spec.kind !== 'workload') return '';
  const roleOpts = ['', ...challenge.roles.map((r) => r.id)].map((id) =>
    `<option value="${esc(id)}" ${(res.props.RoleTag ?? '') === id ? 'selected' : ''}>${esc(id || '(none)')}</option>`).join('');
  const roleRow = challenge.roles.length ? `
    <div class="cg-row">
      <label class="cg-label" title="Sugar for Tags: [{Key: Role}] — binds this workload to a challenge role.">Role tag</label>
      <div class="cg-field"><select data-act="prop" data-res="${esc(res.id)}" data-prop="RoleTag" aria-label="Role tag">${roleOpts}</select></div>
    </div>` : '';
  const portRow = res.type === 'AWS::RDS::DBInstance' ? '' : `
    <div class="cg-row">
      <label class="cg-label" title="Sugar for Tags: [{Key: Port}] — the port this workload listens on (default 80).">Port tag</label>
      <div class="cg-field"><input type="number" min="0" max="65535" data-act="prop" data-res="${esc(res.id)}" data-prop="PortTag"
        value="${res.props.PortTag !== undefined ? Number(res.props.PortTag) : ''}" placeholder="80" /></div>
    </div>`;
  return roleRow + portRow;
}

function card(graph, res, challenge, problems) {
  const spec = RESOURCE_TYPES[res.type];
  const rows = Object.entries(spec.props)
    .filter(([, ps]) => !ps.ignored && ps.check !== 'tags')
    .map(([name, ps]) => propRow(graph, res, name, ps))
    .join('');
  const cardProblems = problems.filter((pr) => pr.id === res.id).map((pr) =>
    `<p class="cg-problem">${esc(pr.message)}</p>`).join('');
  const azBadge = res.type === 'AWS::EC2::Subnet'
    ? `<div class="oc-az-badge">AZ ${esc(String(res.props.AvailabilityZone ?? `${AZ_PREFIX}a`).slice(-1))} — set by placement</div>` : '';
  const pos = res.pos || { x: CANVAS.globalX, y: CANVAS.topY };
  return `
    <div class="oc-card ${sel?.kind === 'card' && sel.id === res.id ? 'oc-selected' : ''}" data-card="${esc(res.id)}"
         style="left: ${Number(pos.x)}px; top: ${Number(pos.y)}px; width: ${CANVAS.cardWidth}px;">
      <span class="oc-dot" data-side="n"></span><span class="oc-dot" data-side="e"></span>
      <span class="oc-dot" data-side="s"></span><span class="oc-dot" data-side="w"></span>
      <div class="cg-head">
        <input type="text" value="${esc(res.id)}" data-act="res-id" data-res="${esc(res.id)}" aria-label="Logical id" />
      </div>
      <div class="cg-type" ${typeDoc(res.type) ? `title="${esc(typeDoc(res.type))}"` : ''}>${esc(res.type)}</div>
      ${azBadge}
      ${cardProblems}
      ${rows || '<p class="arch-mini">No properties — this resource works by being referenced.</p>'}
      ${sugarRows(res, challenge)}
    </div>`;
}

// All edges implied by ref-shaped props: one per scalar ref, one per list
// element. The svg draws them; the labels layer names the property.
function edgesOf(graph) {
  const edges = [];
  const alive = new Set(graph.resources.map((r) => r.id));
  for (const res of graph.resources) {
    const spec = RESOURCE_TYPES[res.type];
    for (const [name, ps] of Object.entries(spec.props)) {
      if (ps.ignored || ps.check === 'tags' || ps.check === 'ingress') continue;
      if (ps.ref || ps.getAtt) {
        const v = res.props[name];
        if (typeof v === 'string' && alive.has(v)) edges.push({ res: res.id, prop: name, target: v });
      } else if (ps.refList && Array.isArray(res.props[name])) {
        for (const v of res.props[name]) if (alive.has(v)) edges.push({ res: res.id, prop: name, target: v });
      }
    }
  }
  return edges;
}

export function renderGraphCanvas(mount, ctx) {
  currentCtx = ctx;
  const { graph, challenge, problems } = ctx;
  layoutGraph(graph); // assign pos to anything new
  if (sel?.kind === 'card' && !graph.resources.some((r) => r.id === sel.id)) sel = null;
  if (sel?.kind === 'edge') {
    // The selected edge may have been renamed away or cleared since the
    // last render; a stale selection would make Delete a silent no-op.
    const res = graph.resources.find((r) => r.id === sel.res);
    const v = res?.props?.[sel.prop];
    const alive = Array.isArray(v) ? v.includes(sel.target) : v === sel.target;
    if (!alive) sel = null;
  }

  // Scroll only carries across re-renders of the SAME challenge — a stale
  // canvas from a previous challenge must not scroll the new one.
  const prevCanvas = mount.querySelector('.oc-canvas');
  const scroll = prevCanvas && prevCanvas.dataset.graphFor === challenge.id
    ? { left: prevCanvas.scrollLeft, top: prevCanvas.scrollTop } : null;

  const surfaceW = CANVAS.lanesX + 3 * CANVAS.laneWidth + 40;
  const maxBottom = Math.max(760, ...graph.resources.map((r) => (r.pos?.y ?? 0) + estimateCardHeight(r) + 200));
  const globalProblems = problems.filter((pr) => pr.id === null).map((pr) =>
    `<p class="cg-problem">${esc(pr.message)}</p>`).join('');
  const addChips = Object.keys(RESOURCE_TYPES).map((t) => `
    <button type="button" class="oc-add-chip" data-act="res-add" data-type="${esc(t)}"
      title="${esc(t)}${typeDoc(t) ? ` — ${typeDoc(t)}` : ''}">+ ${esc(t.split('::').pop())}</button>`).join('');
  const lanes = AZS.map((az, i) => `
    <div class="oc-lane" style="left: ${CANVAS.lanesX + i * CANVAS.laneWidth}px; width: ${CANVAS.laneWidth}px; height: ${maxBottom}px;">
      <span class="oc-lane-label">${AZ_PREFIX}${az}</span>
    </div>`).join('');

  mount.innerHTML = `
    <h2>Resources</h2>
    <div class="arch-row cg-add-row">${addChips}</div>
    ${globalProblems}
    <div class="oc-canvas" data-graph-for="${esc(challenge.id)}">
      <div class="oc-surface" style="width: ${surfaceW}px; height: ${maxBottom}px;">
        <div class="oc-lane oc-lane-global" style="left: 0; width: ${CANVAS.lanesX}px; height: ${maxBottom}px;">
          <span class="oc-lane-label">VPC and global</span>
        </div>
        ${lanes}
        <svg class="oc-edges" aria-hidden="true"></svg>
        ${graph.resources.map((res) => card(graph, res, challenge, problems)).join('')}
        <div class="oc-labels"></div>
        <div class="oc-toolbar" hidden><button type="button" data-act="tb-del" title="Delete">🗑</button></div>
      </div>
    </div>
    <p class="arch-mini">Drag cards to arrange — a subnet's lane sets its AvailabilityZone. Drag a ○ dot
      onto another card to set that reference; click an arrow to select it, Delete removes it.
      Security groups are inbound-only here; outbound is treated as allow-all.</p>`;

  const canvas = mount.querySelector('.oc-canvas');
  if (scroll) { canvas.scrollLeft = scroll.left; canvas.scrollTop = scroll.top; }
  redrawEdges(mount);
  positionToolbar(mount);
  wire(mount);
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
  const el = surfaceEl(mount)?.querySelector(`[data-card="${CSS.escape(id)}"]`);
  if (!el) return null;
  return { x: el.offsetLeft, y: el.offsetTop, w: el.offsetWidth, h: el.offsetHeight, el };
}

// Obsidian-style edge: leave/enter on facing sides with an S-curve.
function edgePath(a, b) {
  const acx = a.x + a.w / 2; const acy = a.y + a.h / 2;
  const bcx = b.x + b.w / 2; const bcy = b.y + b.h / 2;
  const dx = bcx - acx; const dy = bcy - acy;
  let sx; let sy; let tx; let ty; let c1x; let c1y; let c2x; let c2y;
  if (Math.abs(dx) >= Math.abs(dy)) {
    const dir = dx > 0 ? 1 : -1;
    sx = a.x + (dir > 0 ? a.w : 0); sy = acy;
    tx = b.x + (dir > 0 ? 0 : b.w); ty = bcy;
    const k = Math.max(40, Math.min(90, Math.abs(dx) / 2));
    c1x = sx + k * dir; c1y = sy; c2x = tx - k * dir; c2y = ty;
  } else {
    const dir = dy > 0 ? 1 : -1;
    sx = acx; sy = a.y + (dir > 0 ? a.h : 0);
    tx = bcx; ty = b.y + (dir > 0 ? 0 : b.h);
    const k = Math.max(40, Math.min(90, Math.abs(dy) / 2));
    c1x = sx; c1y = sy + k * dir; c2x = tx; c2y = ty - k * dir;
  }
  return { d: `M ${sx} ${sy} C ${c1x} ${c1y}, ${c2x} ${c2y}, ${tx} ${ty}`, mx: (sx + tx) / 2, my: (sy + ty) / 2 };
}

function redrawEdges(mount) {
  const svg = mount.querySelector('.oc-edges');
  const labels = mount.querySelector('.oc-labels');
  if (!svg || !currentCtx) return;
  const paths = [];
  const labelHtml = [];
  for (const edge of edgesOf(currentCtx.graph)) {
    const a = cardRect(mount, edge.res);
    const b = cardRect(mount, edge.target);
    if (!a || !b) continue;
    const { d, mx, my } = edgePath(a, b);
    const selected = sel?.kind === 'edge' && sel.res === edge.res && sel.prop === edge.prop && sel.target === edge.target;
    const ref = esc(JSON.stringify(edge));
    paths.push(`<path class="oc-edge ${selected ? 'oc-edge-selected' : ''}" d="${d}"
      marker-end="url(#${selected ? 'oc-arr-sel' : 'oc-arr'})"></path>`);
    paths.push(`<path class="oc-hit" d="${d}" data-edge="${ref}"></path>`);
    labelHtml.push(`<span class="oc-label ${selected ? 'oc-label-selected' : ''}" style="left:${mx}px; top:${my}px;">${esc(edge.prop)}</span>`);
  }
  svg.innerHTML = `
    <defs>
      <marker id="oc-arr" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" class="oc-arrhead"></path></marker>
      <marker id="oc-arr-sel" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="8" markerHeight="8" orient="auto">
        <path d="M 0 0 L 10 5 L 0 10 z" class="oc-arrhead-selected"></path></marker>
    </defs>
    ${paths.join('')}`;
  labels.innerHTML = labelHtml.join('');
}

function positionToolbar(mount) {
  const tb = mount.querySelector('.oc-toolbar');
  if (!tb) return;
  if (!sel) { tb.hidden = true; return; }
  if (sel.kind === 'card') {
    const rect = cardRect(mount, sel.id);
    if (!rect) { tb.hidden = true; return; }
    tb.style.left = `${rect.x + rect.w / 2 - 20}px`;
    tb.style.top = `${Math.max(4, rect.y - 42)}px`;
    tb.querySelector('button').title = 'Delete resource';
    tb.hidden = false;
  } else {
    const a = cardRect(mount, sel.res);
    const b = cardRect(mount, sel.target);
    if (!a || !b) { tb.hidden = true; return; }
    const { mx, my } = edgePath(a, b);
    tb.style.left = `${mx - 20}px`;
    tb.style.top = `${my - 48}px`;
    tb.querySelector('button').title = 'Delete reference';
    tb.hidden = false;
  }
}

function select(mount, next) {
  sel = next;
  for (const el of mount.querySelectorAll('.oc-card.oc-selected')) el.classList.remove('oc-selected');
  if (sel?.kind === 'card') {
    surfaceEl(mount)?.querySelector(`[data-card="${CSS.escape(sel.id)}"]`)?.classList.add('oc-selected');
  }
  redrawEdges(mount);
  positionToolbar(mount);
}

function deleteSelection(mount) {
  if (!sel || !currentCtx) return;
  const { graph } = currentCtx;
  if (sel.kind === 'card') {
    const res = graph.resources.find((r) => r.id === sel.id);
    if (!res) return;
    graph.resources = graph.resources.filter((r) => r !== res);
    replaceRefs(graph, res.id, null);
  } else {
    const res = graph.resources.find((r) => r.id === sel.res);
    if (!res) return;
    const spec = RESOURCE_TYPES[res.type].props[sel.prop];
    if (spec?.refList && Array.isArray(res.props[sel.prop])) {
      res.props[sel.prop] = res.props[sel.prop].filter((id) => id !== sel.target);
    } else {
      delete res.props[sel.prop];
    }
  }
  sel = null;
  currentCtx.onChange();
}

// Renames cascade through every ref-shaped value; deletes clear them.
function replaceRefs(graph, oldId, newId) {
  for (const res of graph.resources) {
    const spec = RESOURCE_TYPES[res.type];
    for (const [name, ps] of Object.entries(spec.props)) {
      if ((ps.ref || ps.getAtt) && res.props[name] === oldId) {
        if (newId === null) delete res.props[name];
        else res.props[name] = newId;
      }
      if (ps.refList && Array.isArray(res.props[name])) {
        res.props[name] = res.props[name]
          .map((id) => (id === oldId ? newId : id))
          .filter((id) => id !== null);
      }
      if (ps.check === 'ingress' && Array.isArray(res.props[name])) {
        res.props[name] = res.props[name]
          .filter((rule) => !(newId === null && rule.SourceSecurityGroupId === oldId))
          .map((rule) => (rule.SourceSecurityGroupId === oldId ? { ...rule, SourceSecurityGroupId: newId } : rule));
      }
    }
  }
}

function prefills(graph, type) {
  const props = {};
  const spec = RESOURCE_TYPES[type];
  for (const [name, ps] of Object.entries(spec.props)) {
    if (ps.ignored || ps.check === 'tags') continue;
    if (ps.ref && soleId(graph, ps.ref)) props[name] = soleId(graph, ps.ref);
    if (ps.getAtt && soleId(graph, ps.getAtt.kind)) props[name] = soleId(graph, ps.getAtt.kind);
    if (ps.refList) props[name] = [];
    if (ps.check === 'az') props[name] = `${AZ_PREFIX}a`;
    if (ps.check === 'ingress') props[name] = [];
    if (ps.enum && ps.required) props[name] = String(ps.enum[0]);
  }
  if (type === 'AWS::EC2::VPC') props.CidrBlock = '10.0.0.0/16';
  if (type === 'AWS::EC2::Route') props.DestinationCidrBlock = '0.0.0.0/0';
  if (type === 'AWS::EC2::Instance') props.ImageId = DEFAULT_IMAGE_ID;
  if (type === 'AWS::EC2::SecurityGroup') props.GroupDescription = 'Allow traffic';
  if (type === 'AWS::RDS::DBSubnetGroup') props.DBSubnetGroupDescription = 'DB subnets';
  return props;
}

function uniqueId(graph, base) {
  const used = new Set(graph.resources.map((r) => r.id));
  if (!used.has(base)) return base;
  let n = 2;
  while (used.has(`${base}${n}`)) n += 1;
  return `${base}${n}`;
}

// Sets the inferred property for a dot-drag dropped on `target`.
function applyLink(graph, source, target) {
  const accepts = ACCEPTS[source.type];
  const entry = accepts[displayKindSafe(graph, target.id)] || accepts[kindOf(target.type)];
  if (!entry) return false;
  if (entry.list) {
    const list = Array.isArray(source.props[entry.prop]) ? source.props[entry.prop] : [];
    if (!list.includes(target.id)) source.props[entry.prop] = [...list, target.id];
  } else {
    source.props[entry.prop] = target.id;
    // A route takes exactly one target, as CloudFormation would reject both.
    if (source.type === 'AWS::EC2::Route') {
      if (entry.prop === 'GatewayId') delete source.props.NatGatewayId;
      if (entry.prop === 'NatGatewayId') delete source.props.GatewayId;
    }
  }
  return true;
}

function displayKindSafe(graph, id) {
  const res = graph.resources.find((r) => r.id === id);
  return res ? kindOf(res.type) : null;
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
    const id = cardEl.dataset.card;
    if (!moved) { select(mount, { kind: 'card', id }); return; }
    const { graph } = currentCtx;
    const res = graph.resources.find((r) => r.id === id);
    if (!res) return;
    res.pos = { x: cardEl.offsetLeft, y: cardEl.offsetTop };
    if (res.type === 'AWS::EC2::Subnet') {
      const lane = laneForX(res.pos.x + cardEl.offsetWidth / 2);
      const azNow = String(res.props.AvailabilityZone ?? `${AZ_PREFIX}a`);
      if (lane && `${AZ_PREFIX}${lane}` !== azNow) {
        res.props.AvailabilityZone = `${AZ_PREFIX}${lane}`;
        currentCtx.onChange(); // semantic: the subnet moved AZs
        return;
      }
    }
    currentCtx.onLayout();
    redrawEdges(mount);
    positionToolbar(mount);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  gesture = {
    cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      cardEl.classList.remove('oc-dragging');
      if (raf) cancelAnimationFrame(raf);
    },
    // Escape mid-drag: the card must snap back — leaving it at the cursor
    // position LOOKS committed while res.pos was never written, and the
    // next re-render would silently jump it back.
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
  const source = graph.resources.find((r) => r.id === cardEl.dataset.card);
  if (!source) return;
  const acceptKinds = new Set(Object.keys(ACCEPTS[source.type]));
  const candidates = [...surfaceEl(mount).querySelectorAll('.oc-card')].filter((el) => {
    if (el === cardEl) return false;
    const res = graph.resources.find((r) => r.id === el.dataset.card);
    return res && acceptKinds.has(kindOf(res.type));
  });
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
  const a = cardRect(mount, source.id);
  const move = (e) => {
    const p = toSurface(e);
    const { d } = edgePath(a, { x: p.x - 1, y: p.y - 1, w: 2, h: 2 });
    temp.setAttribute('d', d);
  };
  // Geometric drop detection (not elementsFromPoint): deterministic under
  // overlays and works even when the embedding viewport can't hit-test.
  const up = (e) => {
    const p = toSurface(e);
    const hitCard = candidates.find((el) => p.x >= el.offsetLeft && p.x <= el.offsetLeft + el.offsetWidth
      && p.y >= el.offsetTop && p.y <= el.offsetTop + el.offsetHeight);
    cancelGesture();
    if (!hitCard) return;
    const target = graph.resources.find((r) => r.id === hitCard.dataset.card);
    if (target && applyLink(graph, source, target)) currentCtx.onChange();
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  gesture = {
    cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      temp.remove();
      for (const el of candidates) el.classList.remove('oc-can-accept');
    },
  };
  move(event);
}

function wire(mount) {
  if (!mount.dataset.ocWired) {
    mount.dataset.ocWired = '1';
    mount.addEventListener('change', (e) => applyForm(e, 'change'));
    mount.addEventListener('click', (e) => applyForm(e, 'click'));

    mount.addEventListener('pointerdown', (event) => {
      if (event.button !== 0 || !currentCtx) return;
      const dot = event.target.closest('.oc-dot');
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

    mount.addEventListener('click', (event) => {
      if (!currentCtx) return;
      const hit = event.target.closest('.oc-hit');
      if (hit) {
        // data-edge carries only {res, prop, target} — kind must be added
        // here or every sel.kind === 'edge' check silently fails.
        select(mount, { kind: 'edge', ...JSON.parse(hit.dataset.edge) });
        return;
      }
      if (event.target.closest('.oc-toolbar')) return;
      if (!event.target.closest('.oc-card') && event.target.closest('.oc-surface')) {
        select(mount, null);
      }
    });
  }

  if (!docWired) {
    docWired = true;
    document.addEventListener('keydown', (event) => {
      if (!currentCtx) return;
      if (event.key === 'Escape') { cancelGesture(true); select(mountOf(), null); return; }
      if ((event.key === 'Delete' || event.key === 'Backspace') && sel
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

function applyForm(event, phase) {
  const el = event.target.closest('[data-act]');
  if (!el || !currentCtx) return;
  if (phase === 'click' && el.tagName !== 'BUTTON') return;
  if (phase === 'change' && el.tagName === 'BUTTON') return;
  const { graph } = currentCtx;
  const res = graph.resources.find((r) => r.id === el.dataset.res);
  const act = el.dataset.act;

  switch (act) {
    case 'tb-del': deleteSelection(mountOf()); return;
    case 'res-add': {
      const type = el.dataset.type;
      const base = type.split('::').pop();
      graph.resources.push({ id: uniqueId(graph, base === 'VPC' ? 'Vpc' : base), type, props: prefills(graph, type) });
      break;
    }
    case 'res-id': {
      if (!res) return;
      let next = el.value.trim().replace(/[^A-Za-z0-9]/g, '');
      if (!/^[A-Za-z]/.test(next)) next = '';
      if (!next) { el.value = res.id; return; }
      if (next !== res.id) {
        next = uniqueId(graph, next);
        replaceRefs(graph, res.id, next);
        if (sel?.kind === 'card' && sel.id === res.id) sel = { kind: 'card', id: next };
        if (sel?.kind === 'edge') {
          if (sel.res === res.id) sel = { ...sel, res: next };
          if (sel.target === res.id) sel = { ...sel, target: next };
        }
        res.id = next;
      }
      break;
    }
    case 'prop': {
      if (!res) return;
      const name = el.dataset.prop;
      let value;
      if (el.type === 'checkbox') value = el.checked;
      else if (el.type === 'number') value = el.value === '' ? undefined : Number(el.value);
      else value = el.value;
      if (value === '' || value === undefined || value === false) delete res.props[name];
      else res.props[name] = value;
      break;
    }
    case 'rule-add': {
      if (!res) return;
      const name = el.dataset.prop;
      if (!Array.isArray(res.props[name])) res.props[name] = [];
      res.props[name].push({ IpProtocol: 'tcp', FromPort: 80, ToPort: 80, CidrIp: '0.0.0.0/0' });
      break;
    }
    case 'rule-proto': case 'rule-portfrom': case 'rule-portto': case 'rule-srckind': case 'rule-srccidr': case 'rule-del': {
      if (!res) return;
      const rules = res.props.SecurityGroupIngress;
      const idx = Number(el.dataset.index);
      if (!Array.isArray(rules) || !rules[idx]) return;
      const rule = rules[idx];
      if (act === 'rule-del') rules.splice(idx, 1);
      else if (act === 'rule-proto') {
        rule.IpProtocol = el.value;
        if (el.value !== 'tcp' && el.value !== 'udp') { delete rule.FromPort; delete rule.ToPort; }
        else { rule.FromPort = rule.FromPort ?? 80; rule.ToPort = rule.ToPort ?? 80; }
      } else if (act === 'rule-portfrom') rule.FromPort = Number(el.value);
      else if (act === 'rule-portto') rule.ToPort = Number(el.value);
      else if (act === 'rule-srckind') {
        const v = el.value;
        delete rule.CidrIp;
        delete rule.SourceSecurityGroupId;
        if (v === 'anywhere') rule.CidrIp = '0.0.0.0/0';
        else if (v === 'cidr') rule.CidrIp = '10.0.0.0/16';
        else rule.SourceSecurityGroupId = v.slice(3);
      } else if (act === 'rule-srccidr') rule.CidrIp = el.value.trim();
      break;
    }
    default: return;
  }
  currentCtx.onChange();
}
