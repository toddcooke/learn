import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSgRule, addWorkload, addSecurityGroup, updateWorkload, getSecurityGroup,
  effectiveRouteTable,
} from './archModel.js';
import { derivedEdges } from './archCanvasRules.js';

function fixture() {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const priv = addSubnet(arch, { name: 'private-a', az: 'a', cidr: '10.0.2.0/24' });
  const rt = addRouteTable(arch, 'public');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, rt.id, pub.id);
  const web = addWorkload(arch, { type: 'ec2', name: 'web-1', subnetIds: [pub.id], publicIp: true, port: 80 });
  const db = addWorkload(arch, {
    type: 'rds', name: 'db-1',
    subnetIds: [priv.id, addSubnet(arch, { name: 'private-b', az: 'b', cidr: '10.0.3.0/24' }).id],
  });
  const nat = addNat(arch, pub.id);
  return { arch, pub, priv, rt, web, db, nat };
}

test('derivedEdges: route edges from every subnet on a shared table', () => {
  const { arch, pub, rt } = fixture();
  const sb = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.9.0/24' });
  associateSubnet(arch, rt.id, sb.id);
  const edges = derivedEdges(arch).filter((e) => e.kind === 'route');
  assert.deepEqual(
    edges.map((e) => [e.from.id, e.to.type]).sort(),
    [[pub.id, 'igw'], [sb.id, 'igw']].sort(),
  );
  assert.deepEqual(edges[0].fact, { kind: 'route', rtbId: rt.id, index: 0 });
});

test('derivedEdges: nat route edge targets the nat ref', () => {
  const { arch, priv, nat } = fixture();
  const rt = addRouteTable(arch, `${priv.name}-rt`);
  associateSubnet(arch, rt.id, priv.id);
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  const edge = derivedEdges(arch).find((e) => e.kind === 'route' && e.from.id === priv.id);
  assert.deepEqual(edge.to, { type: 'nat', id: nat.id });
});

test('derivedEdges: internet, sg-ref, and external-CIDR rule edges', () => {
  const { arch, web, db } = fixture();
  const webSg = addSecurityGroup(arch, `${web.name}-sg`);
  updateWorkload(arch, web.id, { sgIds: [webSg.id] });
  addSgRule(arch, webSg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const dbSg = addSecurityGroup(arch, `${db.name}-sg`);
  updateWorkload(arch, db.id, { sgIds: [dbSg.id] });
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: `sg:${webSg.id}` });
  addSgRule(arch, dbSg.id, { portFrom: 22, source: '203.0.113.0/24' });

  const edges = derivedEdges(arch).filter((e) => e.kind === 'sg-rule');
  const byTo = (id) => edges.filter((e) => e.to.id === id);
  assert.deepEqual(byTo(web.id).map((e) => e.from.type), ['internet']);
  const dbEdges = byTo(db.id);
  assert.equal(dbEdges.length, 2);
  assert.ok(dbEdges.some((e) => e.from.type === 'workload' && e.from.id === web.id), 'sg-ref edge');
  assert.ok(dbEdges.some((e) => e.from.type === 'internet' && /203\.0\.113/.test(e.label)), 'external CIDR renders from internet node');
});

test('derivedEdges: an SG shared by two workloads fans edges to both', () => {
  const { arch, pub, web } = fixture();
  const web2 = addWorkload(arch, { type: 'ec2', name: 'web-2', subnetIds: [pub.id] });
  const sg = addSecurityGroup(arch, `${web.name}-sg`);
  updateWorkload(arch, web.id, { sgIds: [sg.id] });
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  web2.sgIds = [...web.sgIds];
  const targets = derivedEdges(arch).filter((e) => e.kind === 'sg-rule').map((e) => e.to.id).sort();
  assert.deepEqual(targets, [web.id, web2.id].sort());
});

test('derivedEdges: facts point at the exact rule/route for deletion', () => {
  const { arch, web } = fixture();
  const sg = addSecurityGroup(arch, `${web.name}-sg`);
  updateWorkload(arch, web.id, { sgIds: [sg.id] });
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const edge = derivedEdges(arch).find((e) => e.kind === 'sg-rule');
  const sgFromEdge = getSecurityGroup(arch, edge.fact.sgId);
  assert.equal(sgFromEdge.inbound[edge.fact.index].source, '0.0.0.0/0');
});
