// aws/js/lib/archCanvasRules.js
//
// Pure decision logic behind the drag-and-drop canvas: which drops are
// legal, what a drawn connection means (as a popover description plus an
// apply() that performs the real archModel mutations), and which arrows to
// draw (derived from the model, never stored). The canvas DOM defers every
// judgment call here so it stays testable under node --test.

import {
  getSubnet, getWorkload, getNat, getSecurityGroup, effectiveRouteTable,
  addSecurityGroup, addRouteTable, addRoute, associateSubnet,
  updateWorkload,
} from './archModel.js';
import { parseCidrStrict } from './vpcMath.js';

const PALETTE_KINDS = ['subnet', 'nat', 'ec2', 'alb', 'rds', 'sg'];

function nodeKind(arch, id) {
  if (getSubnet(arch, id)) return 'subnet';
  if (getNat(arch, id)) return 'nat';
  if (getSecurityGroup(arch, id)) return 'sg';
  const wl = getWorkload(arch, id);
  return wl ? wl.type : null;
}

export function canDrop(kind, targetRef, arch) {
  const isPalette = PALETTE_KINDS.includes(kind);
  const resolved = isPalette ? kind : nodeKind(arch, kind);
  if (!resolved) return false;
  switch (resolved) {
    case 'subnet':
      return targetRef.type === 'vpc';
    case 'sg':
      return targetRef.type === 'sg-tray';
    case 'alb':
      // Palette: ALBs are placed on the VPC background (their subnet set is
      // chosen in a popover). Existing ALBs re-home like RDS — dropped onto
      // a subnet they don't already occupy; the VPC background is no longer
      // a sensible target once an ALB already has subnets.
      if (isPalette) return targetRef.type === 'vpc';
      if (targetRef.type !== 'subnet' || !getSubnet(arch, targetRef.id)) return false;
      return !getWorkload(arch, kind).subnetIds.includes(targetRef.id);
    case 'nat':
    case 'ec2':
    case 'rds': {
      if (targetRef.type !== 'subnet' || !getSubnet(arch, targetRef.id)) return false;
      if (isPalette) return true;
      // Re-home: dropping onto the container it's already in is a no-op.
      if (resolved === 'nat') return getNat(arch, kind).subnetId !== targetRef.id;
      const wl = getWorkload(arch, kind);
      // EC2 lives in exactly one subnet; RDS drops re-home its whole group's
      // "primary" placement — both treat same-subnet as a no-op.
      return !wl.subnetIds.includes(targetRef.id);
    }
    default:
      return false;
  }
}

// The workload's first attached SG, creating and attaching "<name>-sg" when
// it has none — connections never leave a workload SG-less.
function ensureSg(arch, workload) {
  if (workload.sgIds.length > 0) {
    return getSecurityGroup(arch, workload.sgIds[0]);
  }
  const sg = addSecurityGroup(arch, `${workload.name}-sg`);
  updateWorkload(arch, workload.id, { sgIds: [sg.id] });
  return sg;
}

// The subnet's explicit route table, creating "<name>-rt" and associating it
// when the subnet is (implicitly or explicitly) on main. Route connections
// never edit the main table — sharing tables is an inspector-level choice.
function ensureOwnRouteTable(arch, subnet) {
  const current = effectiveRouteTable(arch, subnet.id);
  if (current && !current.isMain) return current;
  const rt = addRouteTable(arch, `${subnet.name}-rt`);
  associateSubnet(arch, rt.id, subnet.id);
  return rt;
}

// Console-editor entry points. These carry the exact semantics the old
// connect gestures had: routes go in the subnet's OWN table (never main),
// and rule-authoring on a bare workload creates and attaches "<name>-sg".
// Both are null-safe no-ops when their targets don't exist.
export function addSubnetRoute(arch, subnetId, destCidr, target) {
  const subnet = getSubnet(arch, subnetId);
  if (!subnet) return null;
  if (typeof target === 'string' && target.startsWith('nat:') && !getNat(arch, target.slice(4))) return null;
  const rt = ensureOwnRouteTable(arch, subnet);
  addRoute(arch, rt.id, { destCidr, target });
  return rt;
}

export function ensureWorkloadSg(arch, workloadId) {
  const wl = getWorkload(arch, workloadId);
  if (!wl) return null;
  return ensureSg(arch, wl);
}

// Arrows are always derived from the model, never stored. Route edges come
// from each subnet's EFFECTIVE table (a shared table fans out one edge per
// associated subnet — each subnet genuinely has that route); SG-rule edges
// come from rules on each workload's attached SGs, with external CIDR
// sources rendered from the Internet node.
export function derivedEdges(arch) {
  const edges = [];
  for (const subnet of arch.subnets) {
    const rt = effectiveRouteTable(arch, subnet.id);
    if (!rt) continue;
    rt.routes.forEach((route, index) => {
      if (route.target === 'igw') {
        edges.push({
          from: { type: 'subnet', id: subnet.id }, to: { type: 'igw' },
          kind: 'route', label: route.destCidr,
          fact: { kind: 'route', rtbId: rt.id, index },
        });
      } else if (typeof route.target === 'string' && route.target.startsWith('nat:')) {
        edges.push({
          from: { type: 'subnet', id: subnet.id }, to: { type: 'nat', id: route.target.slice(4) },
          kind: 'route', label: route.destCidr,
          fact: { kind: 'route', rtbId: rt.id, index },
        });
      }
    });
  }
  for (const wl of arch.workloads) {
    for (const sgId of wl.sgIds) {
      const sg = getSecurityGroup(arch, sgId);
      if (!sg) continue;
      sg.inbound.forEach((rule, index) => {
        const portLabel = rule.portFrom === rule.portTo ? `TCP ${rule.portFrom}` : `TCP ${rule.portFrom}–${rule.portTo}`;
        const fact = { kind: 'sg-rule', sgId, index };
        if (rule.source.startsWith('sg:')) {
          const srcSgId = rule.source.slice(3);
          for (const src of arch.workloads) {
            if (src.sgIds.includes(srcSgId)) {
              edges.push({ from: { type: 'workload', id: src.id }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: portLabel, fact });
            }
          }
        } else if (rule.source === '0.0.0.0/0') {
          edges.push({ from: { type: 'internet' }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: portLabel, fact });
        } else if (parseCidrStrict(rule.source)) {
          edges.push({ from: { type: 'internet' }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: `${rule.source} → ${portLabel}`, fact });
        }
      });
    }
  }
  return edges;
}
