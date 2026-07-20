// aws/js/lib/archValidate.js
//
// Structural validation ("would AWS accept this at all") for the
// Architecture Challenge. Best-practice rules are added to this file by a
// later task. Every error carries a ruleId (stable, test-asserted), a
// plain-English message naming resources by their user-visible name, and
// the offending resource ids.

import { parseCidrStrict, cidrContains, cidrsOverlap } from './vpcMath.js';
import { getSubnet, getSecurityGroup, workloadAzs } from './archModel.js';

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
  const reportedErrors = new Set(); // Track ruleId+resourceId to avoid duplicates
  for (const rt of arch.routeTables) {
    for (const route of rt.routes) {
      if (!parseCidrStrict(route.destCidr)) {
        const key = `route-dest-invalid:${rt.id}`;
        if (!reportedErrors.has(key)) {
          err('route-dest-invalid', `Route table ${rt.name}: destination "${route.destCidr}" is not a valid CIDR.`, [rt.id]);
          reportedErrors.add(key);
        }
      }
      if (route.target === 'igw') {
        if (!arch.vpc.igwAttached) {
          const key = `route-igw-unattached:${rt.id}`;
          if (!reportedErrors.has(key)) {
            err('route-igw-unattached', `Route table ${rt.name} routes to an internet gateway, but no IGW is attached to the VPC.`, [rt.id]);
            reportedErrors.add(key);
          }
        }
      } else if (typeof route.target === 'string' && route.target.startsWith('nat:')) {
        if (!natIds.has(route.target.slice(4))) {
          const key = `route-nat-missing:${rt.id}`;
          if (!reportedErrors.has(key)) {
            err('route-nat-missing', `Route table ${rt.name} routes to NAT "${route.target.slice(4)}", which doesn't exist.`, [rt.id]);
            reportedErrors.add(key);
          }
        }
      } else {
        const key = `route-target-unknown:${rt.id}`;
        if (!reportedErrors.has(key)) {
          err('route-target-unknown', `Route table ${rt.name}: unknown route target "${route.target}".`, [rt.id]);
          reportedErrors.add(key);
        }
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
