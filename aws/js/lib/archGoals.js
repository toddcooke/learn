// aws/js/lib/archGoals.js
//
// Turns a challenge's declarative goal list into evaluated results. Each
// row: { goal, label, ok, detail, traces }. Quantifiers: role goals apply
// to EVERY workload carrying the role (reaches: every from×to pair);
// spansAzs counts the union. A goal referencing an empty role fails —
// except noInternetReach, where an empty role trivially exposes nothing.

import {
  workloadsByRole, workloadAzs, isPublicSubnet,
} from './archModel.js';
import {
  sourceToWorkload, internetToWorkload, workloadToWorkload,
  workloadToInternet, isInternetOpen,
} from './archSimulate.js';
import { parseCidrStrict, usableAddresses } from './vpcMath.js';

export const GOAL_TYPES = [
  'exists', 'internetReaches', 'cidrReaches', 'noInternetReach', 'reaches',
  'hasEgress', 'spansAzs', 'multiAz', 'vpcCidrIs', 'subnetPlan',
];

const TYPE_LABEL = { ec2: 'an EC2 instance', alb: 'an Application Load Balancer', rds: 'an RDS database' };

function roleLabel(challenge, roleId) {
  const role = challenge.roles.find((r) => r.id === roleId);
  return role ? role.label : roleId;
}

function emptyRoleResult(goal, label, challenge, roleId) {
  return {
    goal, label, ok: false,
    detail: `No workload is assigned the role "${roleLabel(challenge, roleId)}".`,
    traces: [],
  };
}

export function evaluateGoals(arch, challenge) {
  return challenge.goals.map((goal) => evaluateGoal(arch, challenge, goal));
}

function evaluateGoal(arch, challenge, goal) {
  const rl = (id) => roleLabel(challenge, id);
  switch (goal.type) {
    case 'exists': {
      const wanted = goal.workloadType ? TYPE_LABEL[goal.workloadType] : 'a workload';
      const label = `The design includes ${wanted} serving as the ${rl(goal.role)}`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const wrong = goal.workloadType ? members.filter((w) => w.type !== goal.workloadType) : [];
      return wrong.length === 0
        ? { goal, label, ok: true, detail: `${members.map((w) => w.name).join(', ')} fills the role.`, traces: [] }
        : { goal, label, ok: false, detail: `${wrong.map((w) => w.name).join(', ')} is not ${wanted}.`, traces: [] };
    }
    case 'internetReaches':
    case 'cidrReaches': {
      const fromText = goal.type === 'internetReaches' ? 'the internet' : (goal.cidrLabel || goal.cidr);
      const label = `The ${rl(goal.role)} is reachable from ${fromText} on port ${goal.port}`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const traces = [];
      let ok = true;
      for (const wl of members) {
        const res = goal.type === 'internetReaches'
          ? internetToWorkload(arch, wl.id, goal.port)
          : sourceToWorkload(arch, { type: 'cidr', cidr: goal.cidr }, wl.id, goal.port);
        traces.push({ title: `${fromText} → ${wl.name}:${goal.port}`, ...res });
        ok = ok && res.ok;
      }
      return { goal, label, ok, detail: ok ? 'Reachable.' : 'At least one path fails — see the trace.', traces };
    }
    case 'noInternetReach': {
      const label = `The ${rl(goal.role)} is NOT directly reachable from the internet`;
      const members = workloadsByRole(arch, goal.role);
      const open = members.filter((wl) => isInternetOpen(arch, wl.id));
      return open.length === 0
        ? { goal, label, ok: true, detail: 'Nothing in this role is internet-open.', traces: [] }
        : { goal, label, ok: false, detail: `${open.map((w) => w.name).join(', ')} has a public path and a security group rule open to 0.0.0.0/0.`, traces: [] };
    }
    case 'reaches': {
      const label = `The ${rl(goal.fromRole)} can reach the ${rl(goal.toRole)} on port ${goal.port}`;
      const from = workloadsByRole(arch, goal.fromRole);
      const to = workloadsByRole(arch, goal.toRole);
      if (from.length === 0) return emptyRoleResult(goal, label, challenge, goal.fromRole);
      if (to.length === 0) return emptyRoleResult(goal, label, challenge, goal.toRole);
      const traces = [];
      let ok = true;
      for (const f of from) {
        for (const t of to) {
          const res = workloadToWorkload(arch, f.id, t.id, goal.port);
          traces.push({ title: `${f.name} → ${t.name}:${goal.port}`, ...res });
          ok = ok && res.ok;
        }
      }
      return { goal, label, ok, detail: ok ? 'All pairs connect.' : 'At least one pair is blocked — see the trace.', traces };
    }
    case 'hasEgress': {
      const label = `The ${rl(goal.role)} can reach the internet outbound (for updates and APIs)`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const traces = [];
      let ok = true;
      for (const wl of members) {
        const res = workloadToInternet(arch, wl.id);
        traces.push({ title: `${wl.name} → internet`, ...res });
        ok = ok && res.ok;
      }
      return { goal, label, ok, detail: ok ? 'Outbound path exists.' : 'Egress is broken — see the trace.', traces };
    }
    case 'spansAzs': {
      const label = `The ${rl(goal.role)} spans at least ${goal.min} Availability Zones`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const azs = new Set();
      for (const wl of members) for (const az of workloadAzs(arch, wl)) azs.add(az);
      const ok = azs.size >= goal.min;
      return { goal, label, ok, detail: `Covers ${azs.size} AZ${azs.size === 1 ? '' : 's'} (${[...azs].sort().join(', ') || 'none'}).`, traces: [] };
    }
    case 'multiAz': {
      const label = `The ${rl(goal.role)} uses RDS Multi-AZ for automatic failover`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const off = members.filter((w) => !(w.type === 'rds' && w.multiAz));
      return off.length === 0
        ? { goal, label, ok: true, detail: 'Multi-AZ is enabled.', traces: [] }
        : { goal, label, ok: false, detail: `${off.map((w) => w.name).join(', ')}: Multi-AZ is off (or not an RDS instance).`, traces: [] };
    }
    case 'vpcCidrIs': {
      const label = `The VPC uses the assigned CIDR block ${goal.cidr}`;
      const want = parseCidrStrict(goal.cidr);
      const got = parseCidrStrict(arch.vpc.cidr);
      const ok = !!want && !!got && want.network === got.network && want.prefixLen === got.prefixLen;
      return { goal, label, ok, detail: ok ? 'CIDR matches.' : `VPC CIDR is ${arch.vpc.cidr}.`, traces: [] };
    }
    case 'subnetPlan': {
      const label = `Subnet plan: ${goal.count} subnets (${goal.publicCount} public / ${goal.privateCount} private) across ${goal.minAzs}+ AZs, each with ≥ ${goal.minUsableHosts} usable IPs`;
      const problems = [];
      const parsed = arch.subnets.map((s) => ({ s, block: parseCidrStrict(s.cidr) }));
      if (arch.subnets.length < goal.count) problems.push(`only ${arch.subnets.length} of ${goal.count} subnets exist`);
      const small = parsed.filter(({ block }) => block && usableAddresses(block.prefixLen) < goal.minUsableHosts);
      if (small.length > 0) problems.push(`${small.map(({ s }) => s.name).join(', ')}: fewer than ${goal.minUsableHosts} usable IPs`);
      const azs = new Set(arch.subnets.map((s) => s.az));
      if (azs.size < goal.minAzs) problems.push(`subnets cover ${azs.size} AZ(s), need ${goal.minAzs}`);
      const publicCount = arch.subnets.filter((s) => isPublicSubnet(arch, s.id)).length;
      const privateCount = arch.subnets.length - publicCount;
      if (publicCount < goal.publicCount) problems.push(`${publicCount} public subnet(s), need ${goal.publicCount}`);
      if (privateCount < goal.privateCount) problems.push(`${privateCount} private subnet(s), need ${goal.privateCount}`);
      return {
        goal, label,
        ok: problems.length === 0,
        detail: problems.length === 0 ? 'Plan satisfied.' : problems.join('; ') + '.',
        traces: [],
      };
    }
    default:
      return { goal, label: `Unknown goal type "${goal.type}"`, ok: false, detail: 'Unknown goal type.', traces: [] };
  }
}
