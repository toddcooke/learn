import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload, getSecurityGroup,
  effectiveRouteTable, removeWorkload, removeNat,
} from './archModel.js';
import { canDrop, connectionIntent, derivedEdges } from './archCanvasRules.js';

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

test('connectionIntent: internet → workload creates an SG rule (auto-creating the SG)', () => {
  const { arch, web } = fixture();
  const intent = connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch);
  assert.equal(intent.kind, 'sg-rule-internet');
  assert.equal(intent.defaultPort, 80);
  assert.match(intent.description, /0\.0\.0\.0\/0/);
  intent.apply(arch, { port: 443 });
  const sg = getSecurityGroup(arch, web.sgIds[0]);
  assert.equal(sg.name, 'web-1-sg');
  assert.deepEqual(sg.inbound, [{ proto: 'tcp', portFrom: 443, portTo: 443, source: '0.0.0.0/0' }]);
});

test('connectionIntent: workload → workload chains SGs on both sides', () => {
  const { arch, web, db } = fixture();
  const intent = connectionIntent({ type: 'workload', id: web.id }, { type: 'workload', id: db.id }, arch);
  assert.equal(intent.kind, 'sg-rule-chain');
  assert.equal(intent.defaultPort, 5432);
  intent.apply(arch, { port: 5432 });
  const webSg = getSecurityGroup(arch, web.sgIds[0]);
  const dbSg = getSecurityGroup(arch, db.sgIds[0]);
  assert.equal(dbSg.inbound[0].source, `sg:${webSg.id}`);
  assert.equal(dbSg.inbound[0].portFrom, 5432);
});

test('connectionIntent: reuses existing SGs instead of creating duplicates', () => {
  const { arch, web } = fixture();
  const sg = addSecurityGroup(arch, 'my-sg');
  web.sgIds.push(sg.id);
  const intent = connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch);
  intent.apply(arch, { port: 80 });
  assert.equal(arch.securityGroups.length, 1, 'no new SG created');
  assert.equal(sg.inbound.length, 1);
});

test('connectionIntent: subnet → IGW routes via a created-or-extended explicit table', () => {
  const { arch, priv } = fixture();
  const intent = connectionIntent({ type: 'subnet', id: priv.id }, { type: 'igw' }, arch);
  assert.equal(intent.kind, 'route-igw');
  assert.equal(intent.warning, null, 'IGW attached: no warning');
  intent.apply(arch, {});
  const rt = effectiveRouteTable(arch, priv.id);
  assert.equal(rt.isMain, false, 'a new explicit table was created and associated');
  assert.deepEqual(rt.routes, [{ destCidr: '0.0.0.0/0', target: 'igw' }]);

  // Second route intent on the same subnet extends the SAME table.
  const { arch: a2, pub: p2, nat: n2 } = fixture();
  const first = connectionIntent({ type: 'subnet', id: p2.id }, { type: 'nat', id: n2.id }, a2);
  first.apply(a2, {});
  const t2 = effectiveRouteTable(a2, p2.id);
  assert.equal(t2.name, 'public', 'existing explicit table reused');
  assert.equal(t2.routes.length, 2);
});

test('connectionIntent: warns when routing to a detached IGW but still applies', () => {
  const { arch, priv } = fixture();
  arch.vpc.igwAttached = false;
  const intent = connectionIntent({ type: 'subnet', id: priv.id }, { type: 'igw' }, arch);
  assert.match(intent.warning, /not attached/i);
  intent.apply(arch, {});
  assert.equal(effectiveRouteTable(arch, priv.id).routes.length, 1);
});

test('connectionIntent: subnet → NAT routes to that NAT', () => {
  const { arch, priv, nat } = fixture();
  const intent = connectionIntent({ type: 'subnet', id: priv.id }, { type: 'nat', id: nat.id }, arch);
  assert.equal(intent.kind, 'route-nat');
  intent.apply(arch, {});
  assert.deepEqual(effectiveRouteTable(arch, priv.id).routes, [
    { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` },
  ]);
});

test('connectionIntent: illegal pairs return null', () => {
  const { arch, pub, web, nat } = fixture();
  for (const [from, to] of [
    [{ type: 'workload', id: web.id }, { type: 'subnet', id: pub.id }],
    [{ type: 'workload', id: web.id }, { type: 'internet' }],
    [{ type: 'internet' }, { type: 'subnet', id: pub.id }],
    [{ type: 'igw' }, { type: 'subnet', id: pub.id }],
    [{ type: 'nat', id: nat.id }, { type: 'workload', id: web.id }],
    [{ type: 'workload', id: web.id }, { type: 'workload', id: web.id }],
    [{ type: 'internet' }, { type: 'igw' }],
  ]) {
    assert.equal(connectionIntent(from, to, arch), null, `${from.type}->${to.type}`);
  }
});

test('connectionIntent descriptions name real resources', () => {
  const { arch, web, db, priv, nat } = fixture();
  assert.match(connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch).description, /web-1/);
  assert.match(connectionIntent({ type: 'workload', id: web.id }, { type: 'workload', id: db.id }, arch).description, /db-1/);
  assert.match(connectionIntent({ type: 'subnet', id: priv.id }, { type: 'nat', id: nat.id }, arch).description, /private-a/);
});

test('connectionIntent applies are no-op when their target entities vanish', () => {
  const { arch, pub, priv, web, nat } = fixture();
  const sgCountBefore = arch.securityGroups.length;
  const privRtBefore = effectiveRouteTable(arch, priv.id);

  // Get intents before deleting targets.
  const internetToWeb = connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch);
  const privToNat = connectionIntent({ type: 'subnet', id: priv.id }, { type: 'nat', id: nat.id }, arch);

  // Delete the web workload and the NAT.
  removeWorkload(arch, web.id);
  removeNat(arch, nat.id);

  // Apply both intents — should be safe no-ops.
  internetToWeb.apply(arch, { port: 80 });
  privToNat.apply(arch, {});

  // Verify nothing was written.
  assert.equal(arch.securityGroups.length, sgCountBefore, 'no new SGs created');
  assert.equal(effectiveRouteTable(arch, priv.id).routes.length, privRtBefore.routes.length, 'no new routes');
  assert.deepEqual(
    effectiveRouteTable(arch, priv.id).routes,
    privRtBefore.routes,
    'routes unchanged'
  );
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
  connectionIntent({ type: 'subnet', id: priv.id }, { type: 'nat', id: nat.id }, arch).apply(arch, {});
  const edge = derivedEdges(arch).find((e) => e.kind === 'route' && e.from.id === priv.id);
  assert.deepEqual(edge.to, { type: 'nat', id: nat.id });
});

test('derivedEdges: internet, sg-ref, and external-CIDR rule edges', () => {
  const { arch, web, db } = fixture();
  connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch).apply(arch, { port: 80 });
  connectionIntent({ type: 'workload', id: web.id }, { type: 'workload', id: db.id }, arch).apply(arch, {});
  const dbSg = getSecurityGroup(arch, db.sgIds[0]);
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
  connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch).apply(arch, {});
  web2.sgIds = [...web.sgIds];
  const targets = derivedEdges(arch).filter((e) => e.kind === 'sg-rule').map((e) => e.to.id).sort();
  assert.deepEqual(targets, [web.id, web2.id].sort());
});

test('derivedEdges: facts point at the exact rule/route for deletion', () => {
  const { arch, web } = fixture();
  connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch).apply(arch, {});
  const edge = derivedEdges(arch).find((e) => e.kind === 'sg-rule');
  const sg = getSecurityGroup(arch, edge.fact.sgId);
  assert.equal(sg.inbound[edge.fact.index].source, '0.0.0.0/0');
});
