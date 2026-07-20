// aws/js/lib/archSimulate.js
//
// Connectivity simulation for the Architecture Challenge. Every evaluator
// returns { ok, trace } where trace is an ordered list of { label, ok }
// steps written as user-facing sentences; the whole trace is evaluated even
// after a failure so the results panel can show everything that's wrong
// with a path, not just the first broken hop. Security groups are inbound-
// only (outbound is implicitly allow-all — stated in the UI).

import { parseCidrStrict, ipToInt, intToIp } from './vpcMath.js';
import {
  effectiveRouteTable, getSubnet, getNat, getSecurityGroup, getWorkload,
} from './archModel.js';

// TEST-NET-2: representative "somewhere on the internet" address. Never
// inside the RFC1918 blocks the challenges use for VPC CIDRs.
export const INTERNET_TEST_IP = '198.51.100.1';

function blockContainsIp(block, ip) {
  const int = ipToInt(ip);
  return block.network <= int && int <= block.broadcast;
}

function ruleCidrCovers(ruleSource, block) {
  const ruleBlock = parseCidrStrict(ruleSource);
  return !!ruleBlock && ruleBlock.network <= block.network && block.broadcast <= ruleBlock.broadcast;
}

// Longest-prefix match over the subnet's effective route table plus the
// implicit local route. Routes with unparseable destinations are skipped
// (structural validation reports them). Returns null when nothing matches.
export function resolveRoute(arch, subnetId, destIp) {
  const rt = effectiveRouteTable(arch, subnetId);
  const candidates = [{ destCidr: arch.vpc.cidr, target: 'local' }, ...(rt ? rt.routes : [])];
  let best = null;
  let bestLen = -1;
  for (const route of candidates) {
    const block = parseCidrStrict(route.destCidr);
    if (!block || !blockContainsIp(block, destIp)) continue;
    if (block.prefixLen > bestLen) {
      best = { target: route.target, destCidr: route.destCidr };
      bestLen = block.prefixLen;
    }
  }
  return best;
}

// source: { type: 'internet' } | { type: 'cidr', cidr } | { type: 'workload', workload }
function sgAllows(arch, workload, port, source) {
  if (workload.sgIds.length === 0) {
    return { ok: false, label: `${workload.name} has no security group attached — all inbound traffic is denied` };
  }
  const senderBlocks = source.type === 'workload'
    ? source.workload.subnetIds
        .map((sid) => getSubnet(arch, sid))
        .filter(Boolean)
        .map((s) => parseCidrStrict(s.cidr))
        .filter(Boolean)
    : null;
  for (const sgId of workload.sgIds) {
    const sg = getSecurityGroup(arch, sgId);
    if (!sg) continue;
    for (const rule of sg.inbound) {
      if (rule.proto !== 'tcp' && rule.proto !== 'all') continue;
      if (port < rule.portFrom || port > rule.portTo) continue;
      if (rule.source.startsWith('sg:')) {
        if (source.type === 'workload' && source.workload.sgIds.includes(rule.source.slice(3))) {
          return { ok: true, label: `Security group ${sg.name} allows TCP ${port} from security group ${describeSgSource(arch, rule.source)}` };
        }
        continue;
      }
      if (source.type === 'internet' && ruleCidrCovers(rule.source, parseCidrStrict(`${INTERNET_TEST_IP}/32`))) {
        return { ok: true, label: `Security group ${sg.name} allows TCP ${port} from ${rule.source}` };
      }
      if (source.type === 'cidr') {
        const srcBlock = parseCidrStrict(source.cidr);
        if (srcBlock && ruleCidrCovers(rule.source, srcBlock)) {
          return { ok: true, label: `Security group ${sg.name} allows TCP ${port} from ${rule.source}` };
        }
      }
      if (source.type === 'workload' && senderBlocks.length > 0
          && senderBlocks.every((b) => ruleCidrCovers(rule.source, b))) {
        return { ok: true, label: `Security group ${sg.name} allows TCP ${port} from ${rule.source} (covers ${source.workload.name}'s subnets)` };
      }
    }
  }
  const from = source.type === 'internet' ? 'the internet'
    : source.type === 'cidr' ? source.cidr
    : source.workload.name;
  return { ok: false, label: `No security group on ${workload.name} allows TCP ${port} from ${from}` };
}

function describeSgSource(arch, sgSource) {
  const sg = getSecurityGroup(arch, sgSource.slice(3));
  return sg ? sg.name : sgSource.slice(3);
}

// Inbound from outside the VPC. For EC2 the packet needs: attached IGW, a
// public-subnet route back out, a public IP on the instance, and an SG
// rule. For an ALB every one of its subnets must be public (an
// internet-facing ALB in a private subnet is a classic broken setup).
export function sourceToWorkload(arch, source, workloadId, port) {
  const wl = getWorkload(arch, workloadId);
  const trace = [];
  const testIp = source.type === 'cidr'
    ? (() => { const b = parseCidrStrict(source.cidr); return b ? intToIp(b.network + 1) : INTERNET_TEST_IP; })()
    : INTERNET_TEST_IP;
  trace.push({
    label: arch.vpc.igwAttached
      ? 'Internet gateway is attached to the VPC'
      : 'No internet gateway is attached to the VPC',
    ok: arch.vpc.igwAttached,
  });
  for (const sid of wl.subnetIds) {
    const subnet = getSubnet(arch, sid);
    if (!subnet) continue; // structural validation reports dangling refs
    const route = resolveRoute(arch, sid, testIp);
    const viaIgw = !!route && route.target === 'igw';
    trace.push({
      label: viaIgw
        ? `Subnet ${subnet.name} routes internet traffic to the IGW (public subnet)`
        : `Subnet ${subnet.name} has no route to the internet gateway — it's a private subnet`,
      ok: viaIgw,
    });
  }
  if (wl.type === 'ec2') {
    trace.push({
      label: wl.publicIp
        ? `${wl.name} has a public IP`
        : `${wl.name} has no public IP — the internet can't address it`,
      ok: wl.publicIp,
    });
  }
  trace.push(sgAllows(arch, wl, port, source));
  return { ok: trace.every((s) => s.ok), trace };
}

export function internetToWorkload(arch, workloadId, port) {
  return sourceToWorkload(arch, { type: 'internet' }, workloadId, port);
}

// Intra-VPC traffic: the implicit local route always covers it, so the
// interesting check is the destination's security group.
export function workloadToWorkload(arch, fromId, toId, port) {
  const from = getWorkload(arch, fromId);
  const to = getWorkload(arch, toId);
  const trace = [
    { label: `${from.name} → ${to.name} stays inside the VPC — the implicit local route covers it`, ok: true },
    sgAllows(arch, to, port, { type: 'workload', workload: from }),
  ];
  return { ok: trace.every((s) => s.ok), trace };
}

// Outbound to the internet. Public-IP instances go straight out the IGW;
// everything else needs a NAT gateway that itself lives in a public subnet.
export function workloadToInternet(arch, workloadId) {
  const wl = getWorkload(arch, workloadId);
  const trace = [];
  for (const sid of wl.subnetIds) {
    const subnet = getSubnet(arch, sid);
    if (!subnet) continue;
    const route = resolveRoute(arch, sid, INTERNET_TEST_IP);
    if (!route) {
      trace.push({ label: `Subnet ${subnet.name} has no route to the internet (add a 0.0.0.0/0 route)`, ok: false });
      continue;
    }
    if (route.target === 'local') {
      trace.push({ label: `Subnet ${subnet.name} only routes locally — no path to the internet`, ok: false });
      continue;
    }
    if (route.target === 'igw') {
      const ok = arch.vpc.igwAttached && (wl.type !== 'ec2' || wl.publicIp);
      trace.push({
        label: !arch.vpc.igwAttached
          ? `Subnet ${subnet.name} routes to an IGW that isn't attached`
          : ok
            ? `Subnet ${subnet.name} routes straight out the attached IGW${wl.type === 'ec2' ? ` and ${wl.name} has a public IP` : ''}`
            : `Subnet ${subnet.name} routes straight to the IGW, but ${wl.name} has no public IP — return traffic has nowhere to go`,
        ok,
      });
      continue;
    }
    // nat:<id>
    const nat = getNat(arch, route.target.slice(4));
    if (!nat) {
      trace.push({ label: `Subnet ${subnet.name} routes to a NAT gateway that doesn't exist`, ok: false });
      continue;
    }
    const natSubnet = getSubnet(arch, nat.subnetId);
    const natRoute = natSubnet ? resolveRoute(arch, natSubnet.id, INTERNET_TEST_IP) : null;
    const natOk = !!natRoute && natRoute.target === 'igw' && arch.vpc.igwAttached;
    trace.push({
      label: natOk
        ? `Subnet ${subnet.name} routes through NAT ${nat.id} in public subnet ${natSubnet.name}, then out the IGW`
        : `Subnet ${subnet.name} routes to NAT ${nat.id}, but the NAT's own subnet${natSubnet ? ` (${natSubnet.name})` : ''} has no IGW route — a NAT gateway must live in a public subnet`,
      ok: natOk,
    });
  }
  if (trace.length === 0) {
    trace.push({ label: `${wl.name} isn't placed in any subnet`, ok: false });
  }
  return { ok: trace.every((s) => s.ok), trace };
}

// "Open to the internet": a public inbound path AND any SG rule whose
// source is 0.0.0.0/0. RDS never has a public path in this model (no
// public-IP concept) — placement in a public subnet is a best-practice
// warning instead.
export function isInternetOpen(arch, workloadId) {
  const wl = getWorkload(arch, workloadId);
  if (wl.type === 'rds') return false;
  if (!arch.vpc.igwAttached) return false;
  if (wl.type === 'ec2' && !wl.publicIp) return false;
  const subnets = wl.subnetIds.map((sid) => getSubnet(arch, sid)).filter(Boolean);
  if (subnets.length === 0) return false;
  const allPublic = subnets.every((s) => {
    const route = resolveRoute(arch, s.id, INTERNET_TEST_IP);
    return !!route && route.target === 'igw';
  });
  if (!allPublic) return false;
  return wl.sgIds.some((sgId) => {
    const sg = getSecurityGroup(arch, sgId);
    return !!sg && sg.inbound.some((r) => r.source === '0.0.0.0/0');
  });
}
