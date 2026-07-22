// aws/js/arch-forms.js
//
// Form-based builder for the Architecture Challenge: five sections (VPC,
// Subnets, Route tables + NATs, Security groups, Workloads) that edit the
// arch model directly through js/lib/archModel.js mutators. References are
// dropdowns/checkboxes built from current model state, so dangling refs
// cannot be authored; removal cascades live in the model. Re-renders happen
// on 'change' events (committed edits), so text inputs keep focus while
// typing. The delegated listeners attach once to the persistent mount and
// read a module-level ctx so they always see live state.

import { escapeHtml } from './lib/html.js';
import {
  AZS, getSubnet, getRouteTable, getSecurityGroup, getWorkload,
  addSubnet, updateSubnet, removeSubnet,
  addNat, removeNat,
  addRouteTable, removeRouteTable, addRoute, removeRoute,
  associateSubnet, disassociateSubnet,
  addSecurityGroup, removeSecurityGroup, addSgRule, removeSgRule,
  addWorkload, updateWorkload, removeWorkload,
  effectiveRouteTable,
} from './lib/archModel.js';

let currentCtx = null;

const esc = escapeHtml;

function subnetOptions(arch, selected) {
  return arch.subnets.map((s) =>
    `<option value="${esc(s.id)}" ${s.id === selected ? 'selected' : ''}>${esc(s.name)}</option>`).join('');
}

function targetOptions(arch, selected) {
  const nats = arch.natGateways.map((n) => {
    const host = getSubnet(arch, n.subnetId);
    return `<option value="nat:${esc(n.id)}" ${selected === `nat:${n.id}` ? 'selected' : ''}>NAT ${esc(n.id)} — in ${esc(host ? host.name : '?')}</option>`;
  }).join('');
  return `<option value="igw" ${selected === 'igw' ? 'selected' : ''}>Internet gateway</option>${nats}`;
}

// Console-style source control: a type select plus a conditional field.
// Presentation only — the stored value stays '0.0.0.0/0' | CIDR | 'sg:<id>'.
function sourceControls(arch, source, dataAttrs) {
  const kind = source === '0.0.0.0/0' ? 'anywhere' : source.startsWith('sg:') ? 'sg' : 'cidr';
  const sgOpts = arch.securityGroups.map((g) =>
    `<option value="sg:${esc(g.id)}" ${source === `sg:${g.id}` ? 'selected' : ''}>${esc(g.name)}</option>`).join('');
  return `
    <select data-act="rule-srctype" ${dataAttrs} aria-label="Source type">
      <option value="anywhere" ${kind === 'anywhere' ? 'selected' : ''}>Anywhere (0.0.0.0/0)</option>
      <option value="cidr" ${kind === 'cidr' ? 'selected' : ''}>Custom CIDR</option>
      <option value="sg" ${kind === 'sg' ? 'selected' : ''} ${arch.securityGroups.length === 0 ? 'disabled' : ''}>Security group</option>
    </select>
    ${kind === 'cidr' ? `<input type="text" value="${esc(source)}" data-act="rule-srccidr" ${dataAttrs} aria-label="Source CIDR" />` : ''}
    ${kind === 'sg' ? `<select data-act="rule-srcsg" ${dataAttrs} aria-label="Source security group">${sgOpts}</select>` : ''}`;
}

// Reads the sourceControls trio back into a stored source string. The type
// select's value reflects the user's latest pick even before a re-render,
// but the conditional field it implies may not exist in the DOM yet (first
// switch to that type) — fall back to a value that classifies as the
// intended kind so the next render keeps it.
function readSourceControls(row, arch) {
  const kind = row.querySelector('[data-act="rule-srctype"]').value;
  if (kind === 'anywhere') return '0.0.0.0/0';
  if (kind === 'sg') {
    const picked = row.querySelector('[data-act="rule-srcsg"]')?.value;
    return picked || (arch.securityGroups[0] ? `sg:${arch.securityGroups[0].id}` : '0.0.0.0/0');
  }
  return row.querySelector('[data-act="rule-srccidr"]')?.value.trim() || '10.0.0.0/16';
}

function vpcSection(arch) {
  return `
    <div class="fm-section">
      <h3>VPC</h3>
      <div class="arch-row">
        <label class="arch-mini">CIDR <input type="text" value="${esc(arch.vpc.cidr)}" data-act="vpc-cidr" /></label>
        <label class="arch-mini"><input type="checkbox" data-act="vpc-igw" ${arch.vpc.igwAttached ? 'checked' : ''} /> Internet gateway attached</label>
      </div>
    </div>`;
}

function subnetsSection(arch) {
  const explicit = arch.routeTables.filter((t) => !t.isMain);
  const rows = arch.subnets.map((s) => {
    const eff = effectiveRouteTable(arch, s.id);
    const current = eff && !eff.isMain ? eff.id : '';
    const tables = explicit.map((t) =>
      `<option value="${esc(t.id)}" ${t.id === current ? 'selected' : ''}>${esc(t.name)}</option>`).join('');
    return `
      <div class="fm-grid-subnet" data-subnet="${esc(s.id)}">
        <input type="text" value="${esc(s.name)}" data-act="subnet-name" aria-label="Subnet name" />
        <select data-act="subnet-az" aria-label="AZ">${AZS.map((az) => `<option ${az === s.az ? 'selected' : ''}>${az}</option>`).join('')}</select>
        <input type="text" value="${esc(s.cidr)}" data-act="subnet-cidr" placeholder="10.0.1.0/24" aria-label="Subnet CIDR" />
        <select data-act="subnet-rtb" aria-label="Route table">
          <option value="">main (implicit)</option>${tables}</select>
        <button type="button" class="arch-del" data-act="subnet-del" title="Delete subnet">✕</button>
      </div>`;
  }).join('');
  return `
    <div class="fm-section">
      <h3>Subnets</h3>
      ${arch.subnets.length ? `
        <div class="fm-grid-subnet fm-grid-head arch-mini">
          <span>Name</span><span>AZ</span><span>CIDR</span><span>Route table</span><span></span>
        </div>${rows}` : '<p class="arch-mini">No subnets yet.</p>'}
      <button type="button" class="fm-add" data-act="subnet-add">+ Add subnet</button>
    </div>`;
}

function routeTablesSection(arch) {
  const tableBlock = (rt) => {
    // Raw names only — esc() is applied once where `assoc` is interpolated;
    // escaping the names here too would double-encode & < > in them.
    const assoc = rt.isMain
      ? 'implicit — subnets without an association use this table'
      : (rt.subnetIds.length
        ? `associated: ${rt.subnetIds.map((sid) => getSubnet(arch, sid)?.name || '?').join(', ')}`
        : 'no subnets associated');
    const routes = rt.routes.map((route, i) => `
      <div class="arch-row">
        <input type="text" value="${esc(route.destCidr)}" data-act="route-dest" data-rtb="${esc(rt.id)}" data-index="${i}" aria-label="Destination CIDR" />
        <span class="arch-mini">→</span>
        <select data-act="route-target" data-rtb="${esc(rt.id)}" data-index="${i}" aria-label="Target">${targetOptions(arch, route.target)}</select>
        <button type="button" class="arch-del" data-act="route-del" data-rtb="${esc(rt.id)}" data-index="${i}" title="Delete route">✕</button>
      </div>`).join('');
    return `
      <div class="fm-block" data-rtb-block="${esc(rt.id)}">
        <div class="arch-row">
          ${rt.isMain
            ? '<strong class="fm-name">main</strong>'
            : `<input type="text" value="${esc(rt.name)}" data-act="rtb-name" data-rtb="${esc(rt.id)}" aria-label="Route table name" />`}
          <span class="arch-mini">${esc(assoc)}</span>
          ${rt.isMain ? '' : `<button type="button" class="arch-del" data-act="rtb-del" data-rtb="${esc(rt.id)}" title="Delete route table">✕</button>`}
        </div>
        <p class="arch-mini">${esc(arch.vpc.cidr)} — local (implicit)</p>
        ${routes}
        <button type="button" class="fm-add" data-act="route-add" data-rtb="${esc(rt.id)}">+ Add route</button>
      </div>`;
  };
  const main = arch.routeTables.find((t) => t.isMain);
  const rest = arch.routeTables.filter((t) => !t.isMain);
  const nats = arch.natGateways.map((n) => `
    <div class="arch-row">
      <span class="arch-mini">NAT ${esc(n.id)} in</span>
      <select data-act="nat-subnet" data-nat="${esc(n.id)}" aria-label="NAT subnet">${subnetOptions(arch, n.subnetId)}</select>
      <button type="button" class="arch-del" data-act="nat-del" data-nat="${esc(n.id)}" title="Delete NAT gateway">✕</button>
    </div>`).join('');
  return `
    <div class="fm-section">
      <h3>Route tables</h3>
      ${[main, ...rest].filter(Boolean).map(tableBlock).join('')}
      <div class="arch-row">
        <button type="button" class="fm-add" data-act="rtb-add">+ Add route table</button>
        <button type="button" class="fm-add" data-act="nat-add" ${arch.subnets.length === 0 ? 'disabled title="NAT gateways live in a subnet — add one first"' : ''}>+ Add NAT gateway</button>
      </div>
      ${nats}
    </div>`;
}

function securityGroupsSection(arch) {
  const blocks = arch.securityGroups.map((g) => {
    const rules = g.inbound.map((r, i) => {
      const attrs = `data-sg="${esc(g.id)}" data-index="${i}"`;
      return `
        <div class="arch-row">
          <span class="arch-mini">TCP</span>
          <input type="number" value="${Number(r.portFrom)}" data-act="rule-portfrom" ${attrs} aria-label="Port from" />
          <span class="arch-mini">–</span>
          <input type="number" value="${Number(r.portTo)}" data-act="rule-portto" ${attrs} aria-label="Port to" />
          <span class="arch-mini">from</span>
          ${sourceControls(arch, r.source, attrs)}
          <button type="button" class="arch-del" data-act="rule-del" ${attrs} title="Delete rule">✕</button>
        </div>`;
    }).join('');
    return `
      <div class="fm-block" data-sg-block="${esc(g.id)}">
        <div class="arch-row">
          <input type="text" value="${esc(g.name)}" data-act="sg-name" data-sg="${esc(g.id)}" aria-label="Security group name" />
          <button type="button" class="arch-del" data-act="sg-del" data-sg="${esc(g.id)}" title="Delete security group">✕</button>
        </div>
        ${rules || '<p class="arch-mini">No inbound rules — all inbound traffic is denied.</p>'}
        <button type="button" class="fm-add" data-act="rule-add" data-sg="${esc(g.id)}">+ Add inbound rule</button>
      </div>`;
  }).join('');
  return `
    <div class="fm-section">
      <h3>Security groups</h3>
      ${blocks || '<p class="arch-mini">No security groups yet. Outbound is treated as allow-all; rules here are inbound only.</p>'}
      <button type="button" class="fm-add" data-act="sg-add">+ Add security group</button>
    </div>`;
}

function workloadsSection(arch, challenge) {
  const roleOpts = (current) => ['', ...challenge.roles.map((r) => r.id)]
    .map((id) => `<option value="${esc(id)}" ${id === (current || '') ? 'selected' : ''}>${esc(id || '(none)')}</option>`).join('');
  const blocks = arch.workloads.map((w) => {
    const subnetPick = w.type === 'ec2'
      ? `<label class="arch-mini">subnet <select data-act="wl-subnet-single" data-wl="${esc(w.id)}" aria-label="Subnet">
           ${arch.subnets.length ? subnetOptions(arch, w.subnetIds[0]) : '<option value="">(none)</option>'}</select></label>`
      : `<span class="arch-mini">subnets:</span> ${arch.subnets.map((s) => `
          <label class="arch-mini"><input type="checkbox" value="${esc(s.id)}" data-act="wl-subnet-multi" data-wl="${esc(w.id)}"
            ${w.subnetIds.includes(s.id) ? 'checked' : ''} /> ${esc(s.name)}</label>`).join(' ') || '<em class="arch-mini">none</em>'}`;
    const sgPick = arch.securityGroups.map((g) => `
      <label class="arch-mini"><input type="checkbox" value="${esc(g.id)}" data-act="wl-sg" data-wl="${esc(w.id)}"
        ${w.sgIds.includes(g.id) ? 'checked' : ''} /> ${esc(g.name)}</label>`).join(' ');
    return `
      <div class="fm-block" data-wl-block="${esc(w.id)}">
        <div class="arch-row">
          <strong class="fm-name">${esc(w.type.toUpperCase())}</strong>
          <input type="text" value="${esc(w.name)}" data-act="wl-name" data-wl="${esc(w.id)}" aria-label="Workload name" />
          ${challenge.roles.length ? `<label class="arch-mini">role <select data-act="wl-role" data-wl="${esc(w.id)}">${roleOpts(w.role)}</select></label>` : ''}
          <label class="arch-mini">port <input type="number" value="${Number(w.port)}" data-act="wl-port" data-wl="${esc(w.id)}" /></label>
          ${w.type === 'ec2' ? `<label class="arch-mini"><input type="checkbox" data-act="wl-publicip" data-wl="${esc(w.id)}" ${w.publicIp ? 'checked' : ''} /> public IP</label>` : ''}
          ${w.type === 'alb' ? `<label class="arch-mini"><input type="checkbox" data-act="wl-publicip" data-wl="${esc(w.id)}" ${w.publicIp ? 'checked' : ''} /> internet-facing</label>` : ''}
          ${w.type === 'rds' ? `<label class="arch-mini"><input type="checkbox" data-act="wl-multiaz" data-wl="${esc(w.id)}" ${w.multiAz ? 'checked' : ''} /> Multi-AZ</label>` : ''}
          <button type="button" class="arch-del" data-act="wl-del" data-wl="${esc(w.id)}" title="Delete workload">✕</button>
        </div>
        <div class="arch-row">${subnetPick}</div>
        <div class="arch-row"><span class="arch-mini">security groups:</span> ${sgPick || '<em class="arch-mini">none yet</em>'}</div>
      </div>`;
  }).join('');
  return `
    <div class="fm-section">
      <h3>Workloads</h3>
      ${blocks || '<p class="arch-mini">No workloads yet.</p>'}
      <div class="arch-row">
        <button type="button" class="fm-add" data-act="wl-add" data-type="ec2" ${arch.subnets.length === 0 ? 'disabled title="EC2 instances live in a subnet — add one first"' : ''}>+ Add EC2</button>
        <button type="button" class="fm-add" data-act="wl-add" data-type="alb">+ Add ALB</button>
        <button type="button" class="fm-add" data-act="wl-add" data-type="rds">+ Add RDS</button>
      </div>
    </div>`;
}

export function renderForms(mount, ctx) {
  currentCtx = ctx;
  const { arch, challenge } = ctx;
  mount.innerHTML = `
    <h2>Design</h2>
    ${vpcSection(arch)}
    ${subnetsSection(arch)}
    ${routeTablesSection(arch)}
    ${securityGroupsSection(arch)}
    ${workloadsSection(arch, challenge)}
    <p class="arch-mini">Simplification: security groups are inbound-only here; outbound is treated as allow-all.</p>`;
  wire(mount);
}

// mount.innerHTML is replaced every render but the mount element persists,
// so the delegated listeners attach once and read currentCtx for live state.
function wire(mount) {
  if (mount.dataset.fmWired) return;
  mount.dataset.fmWired = '1';
  mount.addEventListener('change', (e) => apply(e, 'change'));
  mount.addEventListener('click', (e) => apply(e, 'click'));
}

function apply(event, phase) {
  const el = event.target.closest('[data-act]');
  if (!el || !currentCtx) return;
  if (phase === 'click' && el.tagName !== 'BUTTON') return;
  if (phase === 'change' && el.tagName === 'BUTTON') return;
  const { arch } = currentCtx;
  const act = el.dataset.act;
  const idx = Number(el.dataset.index);
  const subnetId = el.closest('[data-subnet]')?.dataset.subnet;

  switch (act) {
    case 'vpc-cidr': arch.vpc.cidr = el.value.trim(); break;
    case 'vpc-igw': arch.vpc.igwAttached = el.checked; break;

    case 'subnet-add': addSubnet(arch, { az: 'a', cidr: '' }); break;
    case 'subnet-name': if (subnetId) updateSubnet(arch, subnetId, { name: el.value.trim() }); break;
    case 'subnet-az': if (subnetId) updateSubnet(arch, subnetId, { az: el.value }); break;
    case 'subnet-cidr': if (subnetId) updateSubnet(arch, subnetId, { cidr: el.value.trim() }); break;
    case 'subnet-rtb':
      if (subnetId) {
        if (el.value) associateSubnet(arch, el.value, subnetId);
        else disassociateSubnet(arch, subnetId);
      }
      break;
    case 'subnet-del': if (subnetId) removeSubnet(arch, subnetId); break;

    case 'rtb-add': addRouteTable(arch); break;
    case 'rtb-name': { const rt = getRouteTable(arch, el.dataset.rtb); if (rt) rt.name = el.value.trim(); break; }
    case 'rtb-del': removeRouteTable(arch, el.dataset.rtb); break;
    case 'route-add': addRoute(arch, el.dataset.rtb, { destCidr: '0.0.0.0/0', target: 'igw' }); break;
    case 'route-dest': { const rt = getRouteTable(arch, el.dataset.rtb); if (rt && rt.routes[idx]) rt.routes[idx].destCidr = el.value.trim(); break; }
    case 'route-target': { const rt = getRouteTable(arch, el.dataset.rtb); if (rt && rt.routes[idx]) rt.routes[idx].target = el.value; break; }
    case 'route-del': removeRoute(arch, el.dataset.rtb, idx); break;

    case 'nat-add': if (arch.subnets[0]) addNat(arch, arch.subnets[0].id); break;
    case 'nat-subnet': { const nat = arch.natGateways.find((n) => n.id === el.dataset.nat); if (nat) nat.subnetId = el.value; break; }
    case 'nat-del': removeNat(arch, el.dataset.nat); break;

    case 'sg-add': addSecurityGroup(arch); break;
    case 'sg-name': { const g = getSecurityGroup(arch, el.dataset.sg); if (g) g.name = el.value.trim(); break; }
    case 'sg-del': removeSecurityGroup(arch, el.dataset.sg); break;
    case 'rule-add': addSgRule(arch, el.dataset.sg, { portFrom: 80, source: '0.0.0.0/0' }); break;
    case 'rule-portfrom': { const g = getSecurityGroup(arch, el.dataset.sg); if (g && g.inbound[idx]) g.inbound[idx].portFrom = Number(el.value); break; }
    case 'rule-portto': { const g = getSecurityGroup(arch, el.dataset.sg); if (g && g.inbound[idx]) g.inbound[idx].portTo = Number(el.value); break; }
    case 'rule-del': removeSgRule(arch, el.dataset.sg, idx); break;
    case 'rule-srctype': case 'rule-srccidr': case 'rule-srcsg': {
      const g = getSecurityGroup(arch, el.dataset.sg);
      if (!g || !g.inbound[idx]) return;
      g.inbound[idx].source = readSourceControls(el.closest('.arch-row'), arch);
      break;
    }

    case 'wl-add': {
      const type = el.dataset.type;
      addWorkload(arch, { type, subnetIds: type === 'ec2' && arch.subnets[0] ? [arch.subnets[0].id] : [] });
      break;
    }
    case 'wl-name': updateWorkload(arch, el.dataset.wl, { name: el.value.trim() }); break;
    case 'wl-role': updateWorkload(arch, el.dataset.wl, { role: el.value || null }); break;
    case 'wl-port': updateWorkload(arch, el.dataset.wl, { port: Number(el.value) }); break;
    case 'wl-publicip': updateWorkload(arch, el.dataset.wl, { publicIp: el.checked }); break;
    case 'wl-multiaz': updateWorkload(arch, el.dataset.wl, { multiAz: el.checked }); break;
    case 'wl-subnet-single': updateWorkload(arch, el.dataset.wl, { subnetIds: el.value ? [el.value] : [] }); break;
    case 'wl-subnet-multi': {
      const wl = getWorkload(arch, el.dataset.wl);
      if (wl) {
        wl.subnetIds = el.checked
          ? [...wl.subnetIds, el.value]
          : wl.subnetIds.filter((sid) => sid !== el.value);
      }
      break;
    }
    case 'wl-sg': {
      const wl = getWorkload(arch, el.dataset.wl);
      if (wl) {
        wl.sgIds = el.checked ? [...wl.sgIds, el.value] : wl.sgIds.filter((gid) => gid !== el.value);
      }
      break;
    }
    case 'wl-del': removeWorkload(arch, el.dataset.wl); break;
    default: return;
  }
  currentCtx.onChange();
}

// Called when navigating back to the landing list so the listeners see "no
// form mounted" and no-op on any stray event.
export function unmountForms() {
  currentCtx = null;
}
