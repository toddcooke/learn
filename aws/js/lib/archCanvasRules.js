// aws/js/lib/archCanvasRules.js
//
// Pure decision logic behind the read-only architecture diagram: which
// arrows to draw, derived from the model (routes and security-group
// rules), never stored. The canvas DOM defers every judgment call here so
// it stays testable under node --test.

import { getSecurityGroup, effectiveRouteTable } from './archModel.js';
import { parseCidrStrict } from './vpcMath.js';

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
