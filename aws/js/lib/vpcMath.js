// aws/js/lib/vpcMath.js
//
// Pure CIDR/routing math plus the reference-VPC data model behind
// vpc-explorer.html. Nothing in this file touches the DOM, so all of it is
// importable under node:test (see vpcMath.test.mjs). Not in
// scripts/check-drift.mjs's SHARED list — the explorer is aws-specific.
// All CIDR math is computed from first principles (32-bit integer masking)
// — nothing here is a hardcoded lookup table of "if prefix is 20 show
// these numbers" style facts.

// ---------------------------------------------------------------------------
// Core CIDR math (uint32-based)
// ---------------------------------------------------------------------------

export function ipToInt(ip) {
  const parts = ip.split('.').map(Number);
  return ((parts[0] << 24) | (parts[1] << 16) | (parts[2] << 8) | parts[3]) >>> 0;
}

export function intToIp(int) {
  return [24, 16, 8, 0].map((shift) => (int >>> shift) & 0xff).join('.');
}

export function maskForPrefix(prefixLen) {
  return prefixLen === 0 ? 0 : (0xffffffff << (32 - prefixLen)) >>> 0;
}

export function parseCidr(cidr) {
  const [ip, lenStr] = cidr.split('/');
  const prefixLen = Number(lenStr);
  const mask = maskForPrefix(prefixLen);
  const network = (ipToInt(ip) & mask) >>> 0;
  const broadcast = (network | (~mask >>> 0)) >>> 0;
  return { network, broadcast, mask, prefixLen };
}

export function totalAddresses(prefixLen) {
  return 2 ** (32 - prefixLen);
}

export function usableAddresses(prefixLen) {
  // Blocks at /30 and longer hold fewer than the 5 AWS-reserved addresses
  // (AWS's real subnet minimum is /28), so clamp instead of going negative.
  return Math.max(0, totalAddresses(prefixLen) - 5);
}

// AWS reserves 5 addresses in every VPC subnet: network, VPC router, DNS,
// a future-use reservation, and broadcast (unused but still reserved).
export function reservedAddresses(cidr) {
  const { network, broadcast } = parseCidr(cidr);
  return [
    { ip: intToIp(network), label: 'Network address' },
    { ip: intToIp(network + 1), label: 'VPC router' },
    { ip: intToIp(network + 2), label: 'DNS (Amazon-provided, .2 resolver)' },
    { ip: intToIp(network + 3), label: 'Reserved for future use' },
    { ip: intToIp(broadcast), label: 'Broadcast (AWS VPCs don’t support broadcast, still reserved)' },
  ];
}

export function octetOf(int, octetIndexFrom1) {
  const shift = 32 - octetIndexFrom1 * 8;
  return (int >>> shift) & 0xff;
}

// Describes which octet the fixed/free boundary falls in for a given
// prefix length, and (given a concrete network address) what value that
// octet has, its block width, and the block's start/end within that octet.
// Works uniformly for /16 (VPC-sized, degenerate) through /28.
export function describeBoundary(prefixLen, networkInt) {
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

export const AZS = ['a', 'b', 'c'];

export const TIER_DEFS = [
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
export const S3_PREFIX_LIST_NOMINAL_PREFIXLEN = 24;

export function buildRouteTable(tierId, az) {
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

export const SUBNETS = [];
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
export const SUBNETS_BY_ID = Object.fromEntries(SUBNETS.map((s) => [s.id, s]));

// ---------------------------------------------------------------------------
// Route evaluation (real longest-prefix match)
// ---------------------------------------------------------------------------

export function evaluateRouteTable(routeTable, destInput) {
  return routeTable.map((route) => {
    let matched;
    let prefixLen;
    if (route.type === 'prefix-list') {
      matched = destInput.type === 's3';
      prefixLen = S3_PREFIX_LIST_NOMINAL_PREFIXLEN;
    } else {
      const { network, mask, prefixLen: pl } = parseCidr(route.dest);
      if (destInput.type === 'ip') {
        matched = ((ipToInt(destInput.value) & mask) >>> 0) === network;
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

export function pickWinner(evaluated) {
  return evaluated.reduce((best, r) => {
    if (!r.matched) return best;
    if (!best || r.prefixLen > best.prefixLen) return r;
    return best;
  }, null);
}

// ---------------------------------------------------------------------------
// Highlightable element ids
// ---------------------------------------------------------------------------
//
// Three sites in vpc-explorer.js are coupled to these ids: renderMap()
// creates the elements, describeOutcome() emits hop ids to highlight, and
// clearHighlights() walks ALL_HIGHLIGHTABLE_IDS to un-highlight. All three
// derive their ids from the builders and constant below, so the list can't
// silently drift out of sync with the rendered map.

export const IGW_ID = 'igw';
export const S3_ENDPOINT_ID = 's3-endpoint';

export function subnetElId(subnetId) {
  return `subnet-${subnetId}`;
}

export function natElId(az) {
  return `nat-${az}`;
}

export const ALL_HIGHLIGHTABLE_IDS = [
  ...SUBNETS.map((s) => subnetElId(s.id)),
  ...AZS.map((az) => natElId(az)),
  IGW_ID,
  S3_ENDPOINT_ID,
];
