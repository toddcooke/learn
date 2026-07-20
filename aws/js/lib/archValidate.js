// aws/js/lib/archValidate.js
//
// Structural validation ("would AWS accept this at all") for the
// Architecture Challenge. Best-practice rules are added to this file by a
// later task. Every error carries a ruleId (stable, test-asserted), a
// plain-English message naming resources by their user-visible name, and
// the offending resource ids.

import { parseCidrStrict, cidrContains, cidrsOverlap } from './vpcMath.js';
import { getSubnet, getSecurityGroup, isPublicSubnet, workloadAzs } from './archModel.js';
import { resolveRoute, INTERNET_TEST_IP } from './archSimulate.js';

const VPC_PREFIX_MIN = 16; // AWS allows /16 (largest block)…
const VPC_PREFIX_MAX = 28; // …through /28 (smallest) for VPCs and subnets.

export function validateStructure(arch) {
  const errors = [];
  const err = (ruleId, message, resourceIds = []) => {
    errors.push({ ruleId, message, resourceIds });
  };

  // --- VPC CIDR ---
  const vpcBlock = parseCidrStrict(arch.vpc.cidr);
  if (!vpcBlock) {
    err('vpc-cidr-invalid', `VPC CIDR "${arch.vpc.cidr}" is not a valid IPv4 CIDR block.`);
  } else if (vpcBlock.prefixLen < VPC_PREFIX_MIN || vpcBlock.prefixLen > VPC_PREFIX_MAX) {
    err('vpc-cidr-prefix', `VPC CIDR must be between /16 and /28 (got /${vpcBlock.prefixLen}).`);
  }

  // --- Subnets ---
  const subnetBlocks = new Map(); // id -> parsed block (only valid ones)
  for (const s of arch.subnets) {
    const block = parseCidrStrict(s.cidr);
    if (!block) {
      err('subnet-cidr-invalid', `Subnet ${s.name}: "${s.cidr}" is not a valid IPv4 CIDR block.`, [s.id]);
      continue;
    }
    if (block.prefixLen < VPC_PREFIX_MIN || block.prefixLen > VPC_PREFIX_MAX) {
      err('subnet-cidr-prefix', `Subnet ${s.name}: prefix must be between /16 and /28 (got /${block.prefixLen}).`, [s.id]);
      continue;
    }
    if (vpcBlock && !cidrContains(vpcBlock, block)) {
      err('subnet-outside-vpc', `Subnet ${s.name} (${s.cidr}) is not inside the VPC CIDR ${arch.vpc.cidr}.`, [s.id]);
      continue;
    }
    subnetBlocks.set(s.id, block);
  }
  const checked = [...subnetBlocks.entries()];
  for (let i = 0; i < checked.length; i++) {
    for (let j = i + 1; j < checked.length; j++) {
      if (cidrsOverlap(checked[i][1], checked[j][1])) {
        const a = getSubnet(arch, checked[i][0]);
        const b = getSubnet(arch, checked[j][0]);
        err('subnet-overlap', `Subnets ${a.name} (${a.cidr}) and ${b.name} (${b.cidr}) overlap.`, [a.id, b.id]);
      }
    }
  }

  // --- NAT gateways ---
  for (const nat of arch.natGateways) {
    if (!getSubnet(arch, nat.subnetId)) {
      err('nat-subnet-missing', `NAT gateway ${nat.id} is not placed in an existing subnet.`, [nat.id]);
    }
  }

  // --- Route tables ---
  const natIds = new Set(arch.natGateways.map((n) => n.id));
  for (const rt of arch.routeTables) {
    for (const route of rt.routes) {
      if (!parseCidrStrict(route.destCidr)) {
        err('route-dest-invalid', `Route table ${rt.name}: destination "${route.destCidr}" is not a valid CIDR.`, [rt.id]);
      }
      if (route.target === 'igw') {
        if (!arch.vpc.igwAttached) {
          err('route-igw-unattached', `Route table ${rt.name} routes to an internet gateway, but no IGW is attached to the VPC.`, [rt.id]);
        }
      } else if (typeof route.target === 'string' && route.target.startsWith('nat:')) {
        if (!natIds.has(route.target.slice(4))) {
          err('route-nat-missing', `Route table ${rt.name} routes to NAT "${route.target.slice(4)}", which doesn't exist.`, [rt.id]);
        }
      } else {
        err('route-target-unknown', `Route table ${rt.name}: unknown route target "${route.target}".`, [rt.id]);
      }
    }
  }

  // --- Associations ---
  const assocCount = new Map();
  for (const rt of arch.routeTables) {
    for (const sid of rt.subnetIds) {
      assocCount.set(sid, (assocCount.get(sid) || 0) + 1);
    }
  }
  for (const [sid, count] of assocCount) {
    if (count > 1) {
      const s = getSubnet(arch, sid);
      err('subnet-multi-assoc', `Subnet ${s ? s.name : sid} is associated with ${count} route tables; AWS allows exactly one.`, [sid]);
    }
  }

  // --- Workloads ---
  const TYPE_LABEL = { ec2: 'EC2 instance', alb: 'load balancer', rds: 'RDS instance' };
  for (const wl of arch.workloads) {
    const label = `${TYPE_LABEL[wl.type]} ${wl.name}`;
    if (wl.subnetIds.some((sid) => !getSubnet(arch, sid))) {
      err('workload-subnet-missing', `${label} references a subnet that doesn't exist.`, [wl.id]);
    }
    if (wl.sgIds.some((gid) => !getSecurityGroup(arch, gid))) {
      err('workload-sg-missing', `${label} references a security group that doesn't exist.`, [wl.id]);
    }
    const azs = workloadAzs(arch, wl);
    if (wl.type === 'ec2' && wl.subnetIds.length !== 1) {
      err('ec2-subnet-count', `${label} must live in exactly one subnet (has ${wl.subnetIds.length}).`, [wl.id]);
    }
    if (wl.type === 'alb' && (wl.subnetIds.length < 2 || azs.length < 2)) {
      err('alb-subnet-spread', `${label} needs at least two subnets in two different AZs.`, [wl.id]);
    }
    if (wl.type === 'rds' && (wl.subnetIds.length < 2 || azs.length < 2)) {
      err('rds-subnet-spread', `${label}: a DB subnet group needs at least two subnets across two AZs.`, [wl.id]);
    }
  }

  return { errors };
}

// ---------------------------------------------------------------------------
// Best-practice rules (advisory). Each evaluator returns
// { applicable, ok, message } — `why` comes from the rule table. Callers
// score passed ÷ applicable; inapplicable rules are skipped entirely.
// ---------------------------------------------------------------------------

function ruleCoversPort(rule, port) {
  return (rule.proto === 'tcp' || rule.proto === 'all') && rule.portFrom <= port && port <= rule.portTo;
}

const BEST_PRACTICE_RULES = [
  {
    id: 'db-in-private-subnet',
    why: 'Databases should never be directly addressable from the internet; put them in subnets with no IGW route.',
    evaluate(arch) {
      const dbs = arch.workloads.filter((w) => w.type === 'rds');
      if (dbs.length === 0) return { applicable: false };
      const exposed = dbs.filter((db) => db.subnetIds.some((sid) => isPublicSubnet(arch, sid)));
      return exposed.length === 0
        ? { applicable: true, ok: true, message: 'Every database subnet is private.' }
        : { applicable: true, ok: false, message: `${exposed.map((d) => d.name).join(', ')}: DB subnet group includes a public subnet.` };
    },
  },
  {
    id: 'no-open-ssh',
    why: 'SSH open to 0.0.0.0/0 invites brute-force scans; restrict it to a known CIDR or use SSM Session Manager.',
    evaluate(arch) {
      const sgs = arch.securityGroups.filter((sg) => sg.inbound.length > 0);
      if (sgs.length === 0) return { applicable: false };
      const open = sgs.filter((sg) => sg.inbound.some((r) => r.source === '0.0.0.0/0' && ruleCoversPort(r, 22)));
      return open.length === 0
        ? { applicable: true, ok: true, message: 'No security group exposes SSH to the whole internet.' }
        : { applicable: true, ok: false, message: `${open.map((g) => g.name).join(', ')}: allows TCP 22 from 0.0.0.0/0.` };
    },
  },
  {
    id: 'no-open-db-port',
    why: 'The database port should only accept traffic from the application tier, never the internet.',
    evaluate(arch) {
      const dbs = arch.workloads.filter((w) => w.type === 'rds' && w.sgIds.length > 0);
      if (dbs.length === 0) return { applicable: false };
      const exposed = dbs.filter((db) => db.sgIds.some((sgId) => {
        const sg = getSecurityGroup(arch, sgId);
        return !!sg && sg.inbound.some((r) => r.source === '0.0.0.0/0' && ruleCoversPort(r, db.port));
      }));
      return exposed.length === 0
        ? { applicable: true, ok: true, message: 'No database port is open to the internet.' }
        : { applicable: true, ok: false, message: `${exposed.map((d) => d.name).join(', ')}: DB port open to 0.0.0.0/0.` };
    },
  },
  {
    id: 'least-privilege-sg',
    why: 'Referencing a security group instead of a CIDR keeps the rule correct even as instances and subnets change.',
    evaluate(arch) {
      const vpcBlock = parseCidrStrict(arch.vpc.cidr);
      const cidrRules = [];
      for (const sg of arch.securityGroups) {
        for (const r of sg.inbound) {
          if (!r.source.startsWith('sg:')) cidrRules.push({ sg, r });
        }
      }
      if (cidrRules.length === 0 || !vpcBlock) return { applicable: false };
      const broad = cidrRules.filter(({ r }) => {
        const block = parseCidrStrict(r.source);
        return !!block && cidrContains(vpcBlock, block);
      });
      return broad.length === 0
        ? { applicable: true, ok: true, message: 'Intra-VPC traffic is allowed via SG references, not CIDR ranges.' }
        : { applicable: true, ok: false, message: `${[...new Set(broad.map(({ sg }) => sg.name))].join(', ')}: allows intra-VPC CIDR ranges — reference the source security group instead.` };
    },
  },
  {
    id: 'nat-per-az',
    why: 'A single NAT gateway is a single point of failure and adds cross-AZ data charges for other AZs.',
    evaluate(arch) {
      const natAzsNeeded = new Set();
      for (const s of arch.subnets) {
        const route = resolveRoute(arch, s.id, INTERNET_TEST_IP);
        if (route && route.target.startsWith('nat:')) natAzsNeeded.add(s.az);
      }
      if (natAzsNeeded.size < 2) return { applicable: false };
      const natAzs = new Set(
        arch.natGateways.map((n) => getSubnet(arch, n.subnetId)).filter(Boolean).map((s) => s.az),
      );
      const uncovered = [...natAzsNeeded].filter((az) => !natAzs.has(az));
      return uncovered.length === 0
        ? { applicable: true, ok: true, message: 'Every AZ that egresses through NAT has its own NAT gateway.' }
        : { applicable: true, ok: false, message: `AZ ${uncovered.join(', ')} egresses through a NAT gateway in another AZ.` };
    },
  },
  {
    id: 'single-az',
    why: 'An AZ outage takes down everything in it; spreading workloads across AZs is the base layer of AWS high availability.',
    evaluate(arch) {
      const azs = new Set();
      let any = false;
      for (const wl of arch.workloads) {
        for (const az of workloadAzs(arch, wl)) { azs.add(az); any = true; }
      }
      if (!any) return { applicable: false };
      return azs.size >= 2
        ? { applicable: true, ok: true, message: 'Workloads span multiple Availability Zones.' }
        : { applicable: true, ok: false, message: 'Everything runs in a single Availability Zone.' };
    },
  },
  {
    id: 'unused-resources',
    why: 'Idle NAT gateways bill hourly, and orphaned SGs/route tables make the design harder to reason about.',
    evaluate(arch) {
      const unused = [];
      const routedNats = new Set();
      for (const rt of arch.routeTables) {
        for (const r of rt.routes) {
          if (typeof r.target === 'string' && r.target.startsWith('nat:')) routedNats.add(r.target.slice(4));
        }
      }
      for (const nat of arch.natGateways) {
        if (!routedNats.has(nat.id)) unused.push(`NAT gateway ${nat.id} (no route uses it)`);
      }
      for (const sg of arch.securityGroups) {
        const attached = arch.workloads.some((w) => w.sgIds.includes(sg.id));
        const referenced = arch.securityGroups.some((other) => other.inbound.some((r) => r.source === `sg:${sg.id}`));
        if (!attached && !referenced) unused.push(`security group ${sg.name} (attached to nothing)`);
      }
      for (const rt of arch.routeTables) {
        if (!rt.isMain && rt.subnetIds.length === 0) unused.push(`route table ${rt.name} (no subnets associated)`);
      }
      return unused.length === 0
        ? { applicable: true, ok: true, message: 'No unused NAT gateways, security groups, or route tables.' }
        : { applicable: true, ok: false, message: `Unused: ${unused.join('; ')}.` };
    },
  },
];

export const BEST_PRACTICE_RULE_IDS = BEST_PRACTICE_RULES.map((r) => r.id);

export function evaluateBestPractices(arch, ruleIds = 'all') {
  const selected = ruleIds === 'all'
    ? BEST_PRACTICE_RULES
    : BEST_PRACTICE_RULES.filter((r) => ruleIds.includes(r.id));
  return selected.map((rule) => {
    const result = rule.evaluate(arch);
    return {
      ruleId: rule.id,
      applicable: result.applicable,
      ok: result.applicable ? result.ok : true,
      message: result.applicable ? result.message : 'Not applicable to this design.',
      why: rule.why,
    };
  });
}
