// aws/js/vpc-explorer.js
//
// Standalone page logic for vpc-explorer.html. Not part of the hash-router
// SPA and not in scripts/check-drift.mjs's SHARED list, so it's free to be
// aws-specific. All CIDR math below is computed from first principles
// (32-bit integer masking) — nothing here is a hardcoded lookup table of
// "if prefix is 20 show these numbers" style facts.

// ---------------------------------------------------------------------------
// Core CIDR math (uint32-based)
// ---------------------------------------------------------------------------

function ipToInt(ip) {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

function intToIp(int) {
  return [24, 16, 8, 0].map((shift) => (int >>> shift) & 0xff).join('.');
}

function maskForPrefix(prefixLen) {
  return prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
}

function parseCidr(cidr) {
  const [ip, lenStr] = cidr.split('/');
  const prefixLen = Number(lenStr);
  const mask = maskForPrefix(prefixLen);
  const network = (ipToInt(ip) & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { network, broadcast, mask, prefixLen };
}

function totalAddresses(prefixLen) {
  return 2 ** (32 - prefixLen);
}

function usableAddresses(prefixLen) {
  return totalAddresses(prefixLen) - 5;
}

// AWS reserves 5 addresses in every VPC subnet: network, VPC router, DNS,
// a future-use reservation, and broadcast (unused but still reserved).
function reservedAddresses(cidr) {
  const { network, broadcast, prefixLen } = parseCidr(cidr);
  return [
    { ip: intToIp(network), label: 'Network address' },
    { ip: intToIp(network + 1), label: 'VPC router' },
    { ip: intToIp(network + 2), label: 'DNS (Amazon-provided, .2 resolver)' },
    { ip: intToIp(network + 3), label: 'Reserved for future use' },
    { ip: intToIp(broadcast), label: 'Broadcast (AWS VPCs don’t support broadcast, still reserved)' },
  ];
}

const ORDINALS = ['zeroth', 'first', 'second', 'third', 'fourth'];
function ordinal(n) {
  return ORDINALS[n] || `${n}th`;
}

function octetOf(int, octetIndexFrom1) {
  const shift = 32 - octetIndexFrom1 * 8;
  return (int >>> shift) & 0xff;
}

// Renders the 32-bit representation of ipInt as four octet groups of
// <span> bits, with the first prefixLen bits marked "fixed" (real 0/1 from
// the address) and the rest marked "free" (rendered as x, since those bits
// vary across every address in the block).
function bitDiagramHtml(ipInt, prefixLen) {
  const bits = ipInt.toString(2).padStart(32, '0').split('');
  let html = '';
  for (let octet = 0; octet < 4; octet++) {
    html += '<span class="octet-group">';
    for (let i = 0; i < 8; i++) {
      const bitIndex = octet * 8 + i;
      const isFixed = bitIndex < prefixLen;
      const ch = isFixed ? bits[bitIndex] : 'x';
      html += `<span class="bit ${isFixed ? 'bit-fixed' : 'bit-free'}">${ch}</span>`;
    }
    html += '</span>';
  }
  return html;
}

// Describes which octet the fixed/free boundary falls in for a given
// prefix length, and (given a concrete network address) what value that
// octet has, its block width, and the block's start/end within that octet.
// Works uniformly for /16 (VPC-sized, degenerate) through /28.
function describeBoundary(prefixLen, networkInt) {
  if (prefixLen <= 16) {
    return {
      interestingOctetIndex: null,
      degenerate: true,
    };
  }
  const interestingOctetIndex = Math.ceil(prefixLen / 8); // 3 or 4 for prefixLen in 17..28
  const fixedBitsInOctet = prefixLen - 8 * (interestingOctetIndex - 1); // 1..8
  const freeBitsInOctet = 8 - fixedBitsInOctet;
  const blockWidth = 2 ** freeBitsInOctet;
  const val = octetOf(networkInt, interestingOctetIndex);
  const fixedBitsStr = val.toString(2).padStart(8, '0').slice(0, fixedBitsInOctet);
  const freeBitsStr = 'x'.repeat(freeBitsInOctet);
  const blockStart = Math.floor(val / blockWidth) * blockWidth;
  const blockEnd = blockStart + blockWidth - 1;
  return {
    degenerate: false,
    interestingOctetIndex,
    fixedBitsInOctet,
    freeBitsInOctet,
    blockWidth,
    val,
    fixedBitsStr,
    freeBitsStr,
    blockStart,
    blockEnd,
  };
}

// ---------------------------------------------------------------------------
// Reference VPC data model — 10.0.0.0/16, 3 AZs, 3 tiers
// ---------------------------------------------------------------------------

const AZS = ['a', 'b', 'c'];

const TIER_DEFS = [
  {
    id: 'public',
    label: 'Public',
    cidrs: { a: '10.0.0.0/24', b: '10.0.1.0/24', c: '10.0.2.0/24' },
    contents: 'ALB node + NAT gateway',
  },
  {
    id: 'app',
    label: 'App',
    cidrs: { a: '10.0.16.0/20', b: '10.0.32.0/20', c: '10.0.48.0/20' },
    contents: 'ECS / EC2 application instances',
  },
  {
    id: 'data',
    label: 'Data',
    cidrs: { a: '10.0.4.0/24', b: '10.0.5.0/24', c: '10.0.6.0/24' },
    contents: 'RDS primary / standby / replica',
  },
];

// S3's real AWS-managed prefix list holds many CIDR ranges, each more
// specific than the 0.0.0.0/0 default route. We can't enumerate AWS's
// actual list client-side, so we use a representative prefix length (24)
// purely so the longest-prefix-match comparison below picks it over /0,
// which mirrors how AWS itself evaluates it.
const S3_PREFIX_LIST_NOMINAL_PREFIXLEN = 24;

function buildRouteTable(tierId, az) {
  if (tierId === 'public') {
    return [
      { dest: '10.0.0.0/16', target: 'local', type: 'cidr' },
      { dest: '0.0.0.0/0', target: 'igw', type: 'cidr' },
    ];
  }
  if (tierId === 'app') {
    return [
      { dest: '10.0.0.0/16', target: 'local', type: 'cidr' },
      { dest: '0.0.0.0/0', target: `nat-${az}`, type: 'cidr' },
      { dest: 'pl-xxxxxxxx (Amazon S3)', target: 'vpce-s3', type: 'prefix-list' },
    ];
  }
  // data tier: local only, deliberately isolated
  return [{ dest: '10.0.0.0/16', target: 'local', type: 'cidr' }];
}

const SUBNETS = [];
for (const tier of TIER_DEFS) {
  for (const az of AZS) {
    SUBNETS.push({
      id: `${tier.id}-${az}`,
      tier: tier.id,
      tierLabel: tier.label,
      az,
      cidr: tier.cidrs[az],
      contents: tier.contents,
      routeTable: buildRouteTable(tier.id, az),
    });
  }
}
const SUBNETS_BY_ID = Object.fromEntries(SUBNETS.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// Route evaluation (real longest-prefix match)
// ---------------------------------------------------------------------------

function routeDestLabel(route) {
  return route.dest;
}

function evaluateRouteTable(routeTable, destInput) {
  return routeTable.map((route) => {
    let matched;
    let prefixLen;
    if (route.type === 'prefix-list') {
      matched = destInput.type === 's3';
      prefixLen = S3_PREFIX_LIST_NOMINAL_PREFIXLEN;
    } else {
      const { network, mask, prefixLen: pl } = parseCidr(route.dest);
      if (destInput.type === 'ip') {
        matched = (ipToInt(destInput.value) & mask) >>> 0 === network;
      } else {
        // S3 destination: we don't model a concrete IP for it (it's really
        // a whole prefix list of public AWS ranges), so a CIDR route can
        // only match it if that CIDR covers all possible addresses — i.e.
        // the 0.0.0.0/0 default route. A VPC-local route like 10.0.0.0/16
        // never matches, since S3's ranges are outside the VPC.
        matched = pl === 0;
      }
      prefixLen = pl;
    }
    return { ...route, matched, prefixLen };
  });
}

function pickWinner(evaluated) {
  return evaluated.reduce((best, r) => {
    if (!r.matched) return best;
    if (!best || r.prefixLen > best.prefixLen) return r;
    return best;
  }, null);
}

// ---------------------------------------------------------------------------
// Panel 1 — VPC map + subnet inspector
// ---------------------------------------------------------------------------

function renderMap(container) {
  const usedTotal = SUBNETS.reduce((sum, s) => sum + totalAddresses(parseCidr(s.cidr).prefixLen), 0);
  const vpcTotal = totalAddresses(16);
  const unallocated = vpcTotal - usedTotal;
  const unallocatedPct = ((unallocated / vpcTotal) * 100).toFixed(1);

  const rows = TIER_DEFS.map((tier) => {
    const buttons = AZS.map((az) => {
      const subnet = SUBNETS_BY_ID[`${tier.id}-${az}`];
      const natBadge = tier.id === 'public'
        ? `<span class="nat-badge" id="nat-${az}">NAT-${az}</span>`
        : '';
      return `
        <button type="button" class="subnet-btn tier-${tier.id}" id="subnet-${subnet.id}" data-subnet-id="${subnet.id}" aria-pressed="false">
          <span class="subnet-cidr">${subnet.cidr}</span>
          <span class="subnet-az">AZ ${az}</span>
          ${natBadge}
        </button>`;
    }).join('');
    return `
      <div class="tier-row">
        <div class="tier-label">${tier.label}<br /><small>${tier.contents}</small></div>
        ${buttons}
      </div>`;
  }).join('');

  container.innerHTML = `
    <div class="edge-box" id="igw">Internet Gateway (igw) &mdash; VPC edge</div>
    <div class="vpc-map">
      ${rows}
    </div>
    <div class="edge-box edge-box--endpoint" id="s3-endpoint">S3 Gateway Endpoint (vpce-s3) &mdash; private AWS network, not a subnet</div>
    <p class="unallocated-note">
      ${unallocatedPct}% of the VPC (${unallocated.toLocaleString()} of ${vpcTotal.toLocaleString()} addresses) is unallocated,
      including the entire upper half of the range (<code>10.0.128.0/17</code>) &mdash; left free for future subnets or AZs.
    </p>
  `;

  container.querySelectorAll('.subnet-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      container.querySelectorAll('.subnet-btn').forEach((b) => {
        b.classList.toggle('selected', b === btn);
        b.setAttribute('aria-pressed', String(b === btn));
      });
      renderInspector(SUBNETS_BY_ID[btn.dataset.subnetId]);
    });
  });
}

function routeTableHtml(rows) {
  return `
    <table class="history-table route-table">
      <thead><tr><th>Destination</th><th>Target</th></tr></thead>
      <tbody>
        ${rows.map((r) => `<tr><td>${routeDestLabel(r)}</td><td>${r.target}</td></tr>`).join('')}
      </tbody>
    </table>`;
}

function renderInspector(subnet) {
  const inspector = document.getElementById('subnet-inspector');
  const { network, broadcast, prefixLen } = parseCidr(subnet.cidr);
  const total = totalAddresses(prefixLen);
  const usable = usableAddresses(prefixLen);
  const reserved = reservedAddresses(subnet.cidr);
  const boundary = describeBoundary(prefixLen, network);

  let breakdownText;
  if (boundary.degenerate) {
    breakdownText = `/${prefixLen} is the VPC's own prefix &mdash; no further octets are fixed beyond it.`;
  } else if (boundary.freeBitsInOctet === 0) {
    breakdownText = `The ${ordinal(boundary.interestingOctetIndex)} octet is fully fixed (<code>${boundary.fixedBitsStr}</code>); the ${ordinal(boundary.interestingOctetIndex + 1)} octet is fully free.`;
  } else {
    breakdownText = `The ${ordinal(boundary.interestingOctetIndex)} octet is <code>${boundary.fixedBitsStr} | ${boundary.freeBitsStr}</code> (fixed | free) &mdash; covers ${boundary.blockStart}&ndash;${boundary.blockEnd}.`;
  }

  inspector.innerHTML = `
    <h3><code>${subnet.cidr}</code> &mdash; ${subnet.tierLabel} tier, AZ ${subnet.az}</h3>
    <p>${subnet.contents}</p>

    <h4>Binary breakdown</h4>
    <p class="bit-diagram">${bitDiagramHtml(network, prefixLen)}</p>
    <p>${breakdownText}</p>

    <h4>Address range</h4>
    <p><code>${intToIp(network)}</code> &ndash; <code>${intToIp(broadcast)}</code></p>

    <h4>Capacity</h4>
    <p>${total.toLocaleString()} total addresses (2<sup>32&minus;${prefixLen}</sup>), ${usable.toLocaleString()} usable (total &minus; 5 AWS-reserved).</p>
    <ul class="reserved-list">
      ${reserved.map((r) => `<li><code>${r.ip}</code> &mdash; ${r.label}</li>`).join('')}
    </ul>

    <h4>Route table</h4>
    ${routeTableHtml(subnet.routeTable)}
  `;
}

// ---------------------------------------------------------------------------
// Panel 2 — packet tracer
// ---------------------------------------------------------------------------

const TRACE_SOURCES = [
  { value: 'app-a', label: 'App instance 10.0.16.25 (AZ a)', ip: '10.0.16.25', subnetId: 'app-a' },
  { value: 'app-b', label: 'App instance 10.0.32.40 (AZ b)', ip: '10.0.32.40', subnetId: 'app-b' },
  { value: 'data-a', label: 'Database 10.0.4.10 (data tier, AZ a)', ip: '10.0.4.10', subnetId: 'data-a' },
];

const TRACE_DESTS = [
  { value: 'data-a', label: 'Database 10.0.4.10', ip: '10.0.4.10', subnetId: 'data-a', kind: 'ip' },
  { value: 'app-c', label: 'App instance 10.0.48.7 (AZ c)', ip: '10.0.48.7', subnetId: 'app-c', kind: 'ip' },
  { value: 'internet', label: 'Internet API 93.184.216.34', ip: '93.184.216.34', subnetId: null, kind: 'ip' },
  { value: 's3', label: 'Amazon S3 (prefix-list destination)', ip: null, subnetId: null, kind: 's3' },
];

const ALL_HIGHLIGHTABLE_IDS = [
  ...SUBNETS.map((s) => `subnet-${s.id}`),
  ...AZS.map((az) => `nat-${az}`),
  'igw',
  's3-endpoint',
];

function clearHighlights() {
  ALL_HIGHLIGHTABLE_IDS.forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.classList.remove('hop-active-ok', 'hop-active-fail');
  });
}

function highlight(id, variant) {
  const el = document.getElementById(id);
  if (el) el.classList.add(variant === 'fail' ? 'hop-active-fail' : 'hop-active-ok');
}

function tierLabelFor(subnetId) {
  return SUBNETS_BY_ID[subnetId].tierLabel.toLowerCase();
}

function natIdForSource(source) {
  const az = source.subnetId.split('-')[1];
  return `nat-${az}`;
}

function runTrace(sourceKey, destKey) {
  const source = TRACE_SOURCES.find((s) => s.value === sourceKey);
  const dest = TRACE_DESTS.find((d) => d.value === destKey);
  const subnet = SUBNETS_BY_ID[source.subnetId];

  if (dest.kind === 'ip' && dest.ip === source.ip) {
    return { sameHost: true, source, dest, subnet };
  }

  const destInput = dest.kind === 's3' ? { type: 's3' } : { type: 'ip', value: dest.ip };
  const evaluated = evaluateRouteTable(subnet.routeTable, destInput);
  const matched = evaluated.filter((r) => r.matched);
  const winner = pickWinner(evaluated);

  return { source, dest, subnet, evaluated, matched, winner };
}

function describeOutcome(result) {
  if (result.sameHost) {
    return {
      ok: true,
      pathText: `${result.source.label} → (same host as destination)`,
      explanation: 'Source and destination are the same address, so there is no network hop to trace — the packet never leaves the host.',
      hops: [`subnet-${result.subnet.id}`],
    };
  }

  const { winner, subnet, source, dest, matched } = result;

  if (!winner) {
    return {
      ok: false,
      pathText: `${source.label} → ✕ NO MATCHING ROUTE — packet dropped`,
      explanation: `The ${tierLabelFor(source.subnetId)} tier's route table only has a local route for 10.0.0.0/16. ${dest.label} is outside the VPC's CIDR block, no route matches, and there is no default route to fall back on — so the packet is dropped before it ever leaves the subnet. This is exactly why the data tier is isolated: with no NAT gateway, internet gateway, or VPC endpoint route, it cannot reach anything outside the VPC.`,
      hops: [`subnet-${subnet.id}`],
    };
  }

  if (winner.target === 'local') {
    return {
      ok: true,
      pathText: `${source.label} → local route (stays inside the VPC) → ${dest.label}`,
      explanation: matched.length > 1
        ? 'Both the 10.0.0.0/16 local route and the 0.0.0.0/0 default route matched, but route tables always prefer the most specific (longest-prefix) match, so the /16 local route wins over the /0 default. Traffic to another address inside the VPC never needs to leave through a gateway, even when it crosses an Availability Zone boundary.'
        : "Only the 10.0.0.0/16 local route matched — this tier's route table has no default route at all, so addresses inside the VPC are the only destinations it can reach. Traffic to another address inside the VPC never needs to leave through a gateway, even when it crosses an Availability Zone boundary.",
      hops: [`subnet-${subnet.id}`, dest.subnetId ? `subnet-${dest.subnetId}` : null].filter(Boolean),
    };
  }

  if (winner.target.startsWith('nat-')) {
    const natId = natIdForSource(source);
    return {
      ok: true,
      pathText: `${source.label} → NAT gateway ${natId} (same AZ) → Internet Gateway → ${dest.label}`,
      explanation: `No local or endpoint route matched, so the 0.0.0.0/0 default route wins and sends the packet to this AZ's own NAT gateway, which forwards it out through the internet gateway. Each AZ gets its own NAT gateway so that one AZ's outage can't cut off another AZ's outbound path.`,
      hops: [`subnet-${subnet.id}`, natId, 'igw'],
    };
  }

  // vpce-s3
  return {
    ok: true,
    pathText: `${source.label} → S3 gateway endpoint (vpce-s3) → Amazon S3`,
    explanation: 'The S3 prefix-list route is more specific than the 0.0.0.0/0 default, so it wins even though both matched: traffic to S3 goes over the gateway endpoint on the AWS network instead of through the NAT gateway, avoiding NAT processing charges and never touching the internet gateway.',
    hops: [`subnet-${subnet.id}`, 's3-endpoint'],
  };
}

function evaluatedRouteTableHtml(result) {
  if (result.sameHost) return '';
  const { evaluated, winner } = result;
  const rows = evaluated.map((r) => {
    const state = r === winner ? 'winner' : r.matched ? 'matched' : 'unmatched';
    const stateLabel = r === winner ? 'Matched — winner' : r.matched ? 'Matched' : 'Not matched';
    return `<tr class="route-row route-row--${state}"><td>${routeDestLabel(r)}</td><td>${r.target}</td><td>${stateLabel}</td></tr>`;
  }).join('');
  const note = result.matched.length > 1
    ? '<p class="note">More than one route matched — the most specific (longest-prefix) route wins.</p>'
    : '';
  return `
    <table class="history-table route-table">
      <thead><tr><th>Destination</th><th>Target</th><th>Evaluation</th></tr></thead>
      <tbody>${rows}</tbody>
    </table>
    ${note}
  `;
}

function renderTraceResult(result) {
  const out = document.getElementById('tracer-result');
  const outcome = describeOutcome(result);

  clearHighlights();
  outcome.hops.forEach((id) => highlight(id, outcome.ok ? 'ok' : 'fail'));

  out.classList.toggle('trace-ok', outcome.ok && !result.sameHost);
  out.classList.toggle('trace-fail', !outcome.ok);
  out.classList.toggle('trace-neutral', !!result.sameHost);

  out.innerHTML = `
    <p class="trace-path"><strong>${outcome.pathText}</strong></p>
    ${evaluatedRouteTableHtml(result)}
    <p class="trace-explanation">${outcome.explanation}</p>
  `;
}

function populateSelect(select, options) {
  select.innerHTML = options.map((o) => `<option value="${o.value}">${o.label}</option>`).join('');
}

function initTracer() {
  const sourceSelect = document.getElementById('tracer-source');
  const destSelect = document.getElementById('tracer-dest');
  const form = document.getElementById('tracer-form');

  populateSelect(sourceSelect, TRACE_SOURCES);
  populateSelect(destSelect, TRACE_DESTS);
  destSelect.value = 'app-c';

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    const result = runTrace(sourceSelect.value, destSelect.value);
    renderTraceResult(result);
  });
}

// ---------------------------------------------------------------------------
// Panel 3 — CIDR explorer
// ---------------------------------------------------------------------------

const CIDR_PROBE_IP = '10.0.29.200';

function renderCidrExplorer(prefixLen) {
  const output = document.getElementById('cidr-explorer-output');
  const valueLabel = document.getElementById('cidr-slider-value');
  valueLabel.textContent = `/${prefixLen}`;

  const probeInt = ipToInt(CIDR_PROBE_IP);
  const mask = maskForPrefix(prefixLen);
  const networkInt = (probeInt & mask) >>> 0;
  const total = totalAddresses(prefixLen);
  const usable = usableAddresses(prefixLen);
  const boundary = describeBoundary(prefixLen, networkInt);

  let interestingOctetText;
  let incrementsHtml;
  if (boundary.degenerate) {
    interestingOctetText = 'No subdivision below /16 — the base 10.0.0.0/16 is already the whole block, so there is no "interesting" octet yet.';
    incrementsHtml = '<em>n/a &mdash; this prefix length is the VPC-sized block itself.</em>';
  } else if (boundary.freeBitsInOctet === 0) {
    interestingOctetText = `The prefix ends exactly on an octet boundary: the ${ordinal(boundary.interestingOctetIndex)} octet is fully fixed and every later octet is fully free, so each block is exactly one ${ordinal(boundary.interestingOctetIndex)}-octet value wide.`;
    incrementsHtml = `any value 0&ndash;255 &mdash; consecutive blocks step by 1 in the ${ordinal(boundary.interestingOctetIndex)} octet`;
  } else {
    interestingOctetText = `The ${ordinal(boundary.interestingOctetIndex)} octet is the interesting one: ${boundary.fixedBitsInOctet} fixed bit${boundary.fixedBitsInOctet === 1 ? '' : 's'}, ${boundary.freeBitsInOctet} free bit${boundary.freeBitsInOctet === 1 ? '' : 's'} (block width ${boundary.blockWidth} within that octet).`;
    const starts = [];
    for (let v = 0; v < 256; v += boundary.blockWidth) starts.push(v);
    incrementsHtml = starts.length > 24
      ? `${starts.slice(0, 24).join(', ')}, &hellip; (${starts.length} total, every multiple of ${boundary.blockWidth})`
      : starts.join(', ');
  }

  const blockCidr = `${intToIp(networkInt)}/${prefixLen}`;

  output.innerHTML = `
    <p class="bit-diagram">${bitDiagramHtml(probeInt, prefixLen)}</p>
    <dl class="cidr-stats">
      <div><dt>Block size</dt><dd>2<sup>32&minus;${prefixLen}</sup> = ${total.toLocaleString()} addresses</dd></div>
      <div><dt>Usable in an AWS subnet</dt><dd>${usable.toLocaleString()} (total &minus; 5)</dd></div>
      <div><dt>Interesting octet</dt><dd>${boundary.degenerate ? 'n/a' : ordinal(boundary.interestingOctetIndex)}</dd></div>
    </dl>
    <p>${interestingOctetText}</p>
    <p><strong>Valid block-start increments in that octet:</strong> ${incrementsHtml}</p>
    <p class="worked-example">Worked example: <code>${CIDR_PROBE_IP}</code> falls in block <code>${blockCidr}</code>.</p>
  `;
}

function initCidrExplorer() {
  const slider = document.getElementById('cidr-slider');
  renderCidrExplorer(Number(slider.value));
  slider.addEventListener('input', () => renderCidrExplorer(Number(slider.value)));
}

// ---------------------------------------------------------------------------
// Boot
// ---------------------------------------------------------------------------

function init() {
  renderMap(document.getElementById('vpc-map-container'));
  initTracer();
  initCidrExplorer();
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', init);
} else {
  init();
}
