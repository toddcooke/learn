// aws/js/arch-graph-forms.js
//
// CloudFormation-shaped form builder: one card per resource with its
// editable logical id, real CFN type, and real property names — but every
// reference is a dropdown filtered to the right resource kind, so !Ref/
// !GetAtt can never dangle by construction. Cards are generated from the
// cfnSchema catalog (ignored props and Tags are skipped; RoleTag/PortTag
// sugar rows replace tags); per-card problem lines come from
// graphToArch(...).problems. Committed edits on 'change'; the delegated
// listeners attach once to the persistent mount and read a module-level
// ctx so they always see live state.

import { escapeHtml } from './lib/html.js';
import { RESOURCE_TYPES, typeDoc, propDoc } from './lib/cfnSchema.js';
import { DEFAULT_IMAGE_ID, AZ_PREFIX } from './lib/archGraph.js';

let currentCtx = null;

const esc = escapeHtml;
const AZS = ['a', 'b', 'c'];
const WORKLOAD_SUGAR = { RoleTag: 'Role tag', PortTag: 'Port tag' };

const kindOf = (type) => RESOURCE_TYPES[type].kind;

function idsOfKind(graph, kind) {
  return graph.resources.filter((r) => RESOURCE_TYPES[r.type] && kindOf(r.type) === kind).map((r) => r.id);
}

function soleId(graph, kind) {
  const ids = idsOfKind(graph, kind);
  return ids.length === 1 ? ids[0] : undefined;
}

function refSelect(graph, kind, value, attrs, label) {
  const opts = idsOfKind(graph, kind).map((id) =>
    `<option value="${esc(id)}" ${id === value ? 'selected' : ''}>${esc(id)}</option>`).join('');
  return `<select ${attrs} aria-label="${esc(label)}">
    <option value="">(none)</option>${opts}</select>`;
}

function propRow(graph, res, name, spec) {
  const value = res.props[name];
  const attrs = `data-act="prop" data-res="${esc(res.id)}" data-prop="${esc(name)}"`;
  const doc = propDoc(res.type, name);
  const label = `<label class="cg-label" ${doc ? `title="${esc(doc)}"` : ''}>${esc(name)}${spec.required ? ' *' : ''}</label>`;
  let field;
  if (spec.ref) {
    field = refSelect(graph, spec.ref, value, attrs, name);
  } else if (spec.getAtt) {
    field = refSelect(graph, spec.getAtt.kind, value, attrs, name);
  } else if (spec.refList) {
    const boxes = idsOfKind(graph, spec.refList).map((id) => `
      <label class="arch-mini"><input type="checkbox" value="${esc(id)}" data-act="prop-multi"
        data-res="${esc(res.id)}" data-prop="${esc(name)}"
        ${Array.isArray(value) && value.includes(id) ? 'checked' : ''} /> ${esc(id)}</label>`).join(' ');
    field = boxes || '<em class="arch-mini">none available yet</em>';
  } else if (spec.enum) {
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

function sugarRows(graph, res, challenge) {
  const spec = RESOURCE_TYPES[res.type];
  if (spec.kind !== 'workload') return '';
  const roleOpts = ['', ...challenge.roles.map((r) => r.id)].map((id) =>
    `<option value="${esc(id)}" ${(res.props.RoleTag ?? '') === id ? 'selected' : ''}>${esc(id || '(none)')}</option>`).join('');
  const roleRow = challenge.roles.length ? `
    <div class="cg-row">
      <label class="cg-label" title="Sugar for Tags: [{Key: Role}] — binds this workload to a challenge role.">${esc(WORKLOAD_SUGAR.RoleTag)}</label>
      <div class="cg-field"><select data-act="prop" data-res="${esc(res.id)}" data-prop="RoleTag" aria-label="Role tag">${roleOpts}</select></div>
    </div>` : '';
  const portRow = res.type === 'AWS::RDS::DBInstance' ? '' : `
    <div class="cg-row">
      <label class="cg-label" title="Sugar for Tags: [{Key: Port}] — the port this workload listens on (default 80).">${esc(WORKLOAD_SUGAR.PortTag)}</label>
      <div class="cg-field"><input type="number" min="0" max="65535" data-act="prop" data-res="${esc(res.id)}" data-prop="PortTag"
        value="${res.props.PortTag !== undefined ? Number(res.props.PortTag) : ''}" placeholder="80" /></div>
    </div>`;
  return roleRow + portRow;
}

function card(graph, res, challenge, problems) {
  const spec = RESOURCE_TYPES[res.type];
  const rows = Object.entries(spec.props)
    .filter(([name, ps]) => !ps.ignored && ps.check !== 'tags')
    .map(([name, ps]) => propRow(graph, res, name, ps))
    .join('');
  const cardProblems = problems.filter((pr) => pr.id === res.id).map((pr) =>
    `<p class="cg-problem">${esc(pr.message)}</p>`).join('');
  return `
    <div class="cg-card" data-card="${esc(res.id)}">
      <div class="cg-head">
        <input type="text" value="${esc(res.id)}" data-act="res-id" data-res="${esc(res.id)}" aria-label="Logical id" />
        <span class="cg-type" ${typeDoc(res.type) ? `title="${esc(typeDoc(res.type))}"` : ''}>${esc(res.type)}</span>
        <button type="button" class="arch-del" data-act="res-del" data-res="${esc(res.id)}" title="Remove resource">✕</button>
      </div>
      ${cardProblems}
      ${rows || '<p class="arch-mini">No properties — this resource works by being referenced.</p>'}
      ${sugarRows(graph, res, challenge)}
    </div>`;
}

export function renderGraphForms(mount, ctx) {
  currentCtx = ctx;
  const { graph, challenge, problems } = ctx;
  const globalProblems = problems.filter((pr) => pr.id === null).map((pr) =>
    `<p class="cg-problem">${esc(pr.message)}</p>`).join('');
  const typeOpts = Object.keys(RESOURCE_TYPES).map((t) =>
    `<option value="${esc(t)}">${esc(t)}</option>`).join('');
  mount.innerHTML = `
    <h2>Resources</h2>
    ${globalProblems}
    ${graph.resources.map((res) => card(graph, res, challenge, problems)).join('')
      || '<p class="arch-mini">No resources yet — add an AWS::EC2::VPC to start.</p>'}
    <div class="arch-row">
      <select data-act="add-type" aria-label="Resource type">${typeOpts}</select>
      <button type="button" class="fm-add" data-act="res-add">+ Add resource</button>
    </div>
    <p class="arch-mini">References are dropdowns instead of !Ref; hover a property name for its docs.
      Security groups are inbound-only here; outbound is treated as allow-all.</p>`;
  wire(mount);
}

export function unmountGraphForms() {
  currentCtx = null;
}

function wire(mount) {
  if (mount.dataset.cgWired) return;
  mount.dataset.cgWired = '1';
  mount.addEventListener('change', (e) => apply(e, 'change'));
  mount.addEventListener('click', (e) => apply(e, 'click'));
}

// New-card prefills teach the shape without friction: required free-text
// fields start with a plausible value, sole-candidate refs are pre-picked.
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
    // A required enum's select RENDERS its first option as picked, and a
    // browser default selection never fires 'change' — prefill it so the
    // stored value matches what the card shows (Engine on DBInstance).
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

// Renames cascade through every ref-shaped value so dropdown-authored
// references can never dangle; deletes clear them the same way.
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

function apply(event, phase) {
  const el = event.target.closest('[data-act]');
  if (!el || !currentCtx) return;
  if (phase === 'click' && el.tagName !== 'BUTTON') return;
  if (phase === 'change' && el.tagName === 'BUTTON') return;
  if (el.dataset.act === 'add-type') return; // consumed by res-add
  const { graph } = currentCtx;
  const res = graph.resources.find((r) => r.id === el.dataset.res);
  const act = el.dataset.act;

  switch (act) {
    case 'res-add': {
      const type = el.closest('.arch-row').querySelector('[data-act="add-type"]').value;
      const base = type.split('::').pop();
      graph.resources.push({ id: uniqueId(graph, base === 'VPC' ? 'Vpc' : base), type, props: prefills(graph, type) });
      break;
    }
    case 'res-del':
      if (!res) return;
      graph.resources = graph.resources.filter((r) => r !== res);
      replaceRefs(graph, res.id, null);
      break;
    case 'res-id': {
      if (!res) return;
      let next = el.value.trim().replace(/[^A-Za-z0-9]/g, '');
      if (!/^[A-Za-z]/.test(next)) next = '';
      if (!next) { el.value = res.id; return; } // reject empty/invalid, keep old id
      if (next !== res.id) {
        next = uniqueId(graph, next);
        replaceRefs(graph, res.id, next);
        res.id = next;
      }
      break;
    }
    case 'prop': {
      if (!res) return;
      const name = el.dataset.prop;
      const spec = RESOURCE_TYPES[res.type].props[name];
      let value;
      if (el.type === 'checkbox') value = el.checked;
      else if (el.type === 'number') value = el.value === '' ? undefined : Number(el.value);
      else value = el.value;
      if (value === '' || value === undefined || value === false) delete res.props[name];
      else res.props[name] = value;
      // A route takes exactly one target: the two selects are mutually
      // exclusive, matching what CloudFormation would reject at deploy.
      if (res.type === 'AWS::EC2::Route' && value) {
        if (name === 'GatewayId') delete res.props.NatGatewayId;
        if (name === 'NatGatewayId') delete res.props.GatewayId;
      }
      if (spec === undefined && name !== 'RoleTag' && name !== 'PortTag') return;
      break;
    }
    case 'prop-multi': {
      if (!res) return;
      const name = el.dataset.prop;
      const list = Array.isArray(res.props[name]) ? res.props[name] : [];
      res.props[name] = el.checked ? [...list, el.value] : list.filter((id) => id !== el.value);
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
