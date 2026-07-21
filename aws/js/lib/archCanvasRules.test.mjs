import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload, getSecurityGroup,
  effectiveRouteTable, removeWorkload, removeNat,
} from './archModel.js';
import { canDrop, addSubnetRoute, ensureWorkloadSg, derivedEdges } from './archCanvasRules.js';

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

test('canDrop: palette placement rules', () => {
  const { arch, pub } = fixture();
  assert.equal(canDrop('subnet', { type: 'vpc' }, arch), true);
  assert.equal(canDrop('alb', { type: 'vpc' }, arch), true);
  assert.equal(canDrop('sg', { type: 'sg-tray' }, arch), true);
  for (const kind of ['nat', 'ec2', 'rds']) {
    assert.equal(canDrop(kind, { type: 'subnet', id: pub.id }, arch), true, kind);
    assert.equal(canDrop(kind, { type: 'vpc' }, arch), false, kind);
  }
  assert.equal(canDrop('subnet', { type: 'subnet', id: pub.id }, arch), false);
  assert.equal(canDrop('sg', { type: 'vpc' }, arch), false);
});

test('canDrop: re-homing existing nodes', () => {
  const { arch, pub, priv, web, nat } = fixture();
  assert.equal(canDrop(web.id, { type: 'subnet', id: priv.id }, arch), true);
  assert.equal(canDrop(web.id, { type: 'subnet', id: pub.id }, arch), false, 'same subnet is a no-op');
  assert.equal(canDrop(nat.id, { type: 'subnet', id: priv.id }, arch), true);
  assert.equal(canDrop(pub.id, { type: 'vpc' }, arch), true);
  assert.equal(canDrop(web.id, { type: 'vpc' }, arch), false);
  assert.equal(canDrop('ec2-99', { type: 'subnet', id: pub.id }, arch), false, 'unknown id');
});

test('canDrop: ALB re-home targets an unoccupied subnet, not its own subnet or the VPC background', () => {
  const { arch, pub, priv } = fixture();
  const sb = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.9.0/24' });
  const alb = addWorkload(arch, { type: 'alb', subnetIds: [pub.id, priv.id] });
  assert.equal(canDrop(alb.id, { type: 'subnet', id: sb.id }, arch), true, 'unoccupied subnet');
  assert.equal(canDrop(alb.id, { type: 'subnet', id: pub.id }, arch), false, 'already-occupied subnet');
  assert.equal(canDrop(alb.id, { type: 'vpc' }, arch), false, 'vpc is not a re-home target for an existing ALB');
  assert.equal(canDrop('alb', { type: 'vpc' }, arch), true, 'palette ALB still targets the vpc background');
});

test('addSubnetRoute: creates and associates an own table when the subnet is on main', () => {
  const { arch, priv } = fixture();
  const rt = addSubnetRoute(arch, priv.id, '0.0.0.0/0', 'igw');
  assert.equal(rt.isMain, false);
  assert.equal(rt.name, 'private-a-rt');
  assert.deepEqual(effectiveRouteTable(arch, priv.id).routes, [{ destCidr: '0.0.0.0/0', target: 'igw' }]);
});

test('addSubnetRoute: extends an existing explicit table instead of creating another', () => {
  const { arch, pub, nat } = fixture();
  const rt = addSubnetRoute(arch, pub.id, '0.0.0.0/0', `nat:${nat.id}`);
  assert.equal(rt.name, 'public', 'reused the fixture\'s explicit table');
  assert.equal(rt.routes.length, 2);
});

test('addSubnetRoute: never touches the main table', () => {
  const { arch, priv } = fixture();
  addSubnetRoute(arch, priv.id, '0.0.0.0/0', 'igw');
  assert.deepEqual(arch.routeTables.find((t) => t.isMain).routes, []);
});

test('addSubnetRoute: null-safe for missing subnet and missing NAT', () => {
  const { arch, priv } = fixture();
  assert.equal(addSubnetRoute(arch, 'subnet-99', '0.0.0.0/0', 'igw'), null);
  assert.equal(addSubnetRoute(arch, priv.id, '0.0.0.0/0', 'nat:nat-99'), null);
  assert.equal(effectiveRouteTable(arch, priv.id).isMain, true, 'no table was created');
});

test('ensureWorkloadSg: reuses an attached SG, creates one when missing, null for unknown id', () => {
  const { arch, web } = fixture();
  const sg = ensureWorkloadSg(arch, web.id);
  assert.equal(sg.name, 'web-1-sg');
  assert.deepEqual(web.sgIds, [sg.id]);
  assert.equal(ensureWorkloadSg(arch, web.id), sg, 'second call reuses');
  assert.equal(ensureWorkloadSg(arch, 'ec2-99'), null);
});

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
  addSubnetRoute(arch, priv.id, '0.0.0.0/0', `nat:${nat.id}`);
  const edge = derivedEdges(arch).find((e) => e.kind === 'route' && e.from.id === priv.id);
  assert.deepEqual(edge.to, { type: 'nat', id: nat.id });
});

test('derivedEdges: internet, sg-ref, and external-CIDR rule edges', () => {
  const { arch, web, db } = fixture();
  const webSg = ensureWorkloadSg(arch, web.id);
  addSgRule(arch, webSg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const dbSg = ensureWorkloadSg(arch, db.id);
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
  const sg = ensureWorkloadSg(arch, web.id);
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  web2.sgIds = [...web.sgIds];
  const targets = derivedEdges(arch).filter((e) => e.kind === 'sg-rule').map((e) => e.to.id).sort();
  assert.deepEqual(targets, [web.id, web2.id].sort());
});

test('derivedEdges: facts point at the exact rule/route for deletion', () => {
  const { arch, web } = fixture();
  const sg = ensureWorkloadSg(arch, web.id);
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const edge = derivedEdges(arch).find((e) => e.kind === 'sg-rule');
  const sgFromEdge = getSecurityGroup(arch, edge.fact.sgId);
  assert.equal(sgFromEdge.inbound[edge.fact.index].source, '0.0.0.0/0');
});
