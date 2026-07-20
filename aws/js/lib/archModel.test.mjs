import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AZS,
  WORKLOAD_TYPES,
  createArch,
  getSubnet,
  getRouteTable,
  addSubnet,
  updateSubnet,
  removeSubnet,
  addNat,
  removeNat,
  addRouteTable,
  removeRouteTable,
  addRoute,
  removeRoute,
  associateSubnet,
  disassociateSubnet,
  addSecurityGroup,
  removeSecurityGroup,
  addSgRule,
  removeSgRule,
  addWorkload,
  updateWorkload,
  removeWorkload,
  effectiveRouteTable,
  isPublicSubnet,
  workloadsByRole,
  workloadAzs,
} from './archModel.js';

test('createArch starts with a lone main route table and zeroed counters', () => {
  const arch = createArch();
  assert.equal(arch.vpc.cidr, '10.0.0.0/16');
  assert.equal(arch.vpc.igwAttached, false);
  assert.equal(arch.routeTables.length, 1);
  assert.equal(arch.routeTables[0].isMain, true);
  assert.deepEqual(arch.subnets, []);
  assert.deepEqual(AZS, ['a', 'b', 'c']);
  assert.deepEqual(WORKLOAD_TYPES, ['ec2', 'alb', 'rds']);
});

test('createArch state survives a JSON round-trip unchanged', () => {
  const arch = createArch();
  addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  assert.deepEqual(JSON.parse(JSON.stringify(arch)), arch);
});

test('auto-ids never repeat, even after removal', () => {
  const arch = createArch();
  const s1 = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  removeSubnet(arch, s1.id);
  const s2 = addSubnet(arch, { az: 'b', cidr: '10.0.2.0/24' });
  assert.equal(s1.id, 'subnet-1');
  assert.equal(s2.id, 'subnet-2');
});

test('workload ids use the type as prefix and default the port by type', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const web = addWorkload(arch, { type: 'ec2', subnetIds: [s.id] });
  const db = addWorkload(arch, { type: 'rds', subnetIds: [s.id] });
  assert.equal(web.id, 'ec2-1');
  assert.equal(db.id, 'rds-2');
  assert.equal(web.port, 80);
  assert.equal(db.port, 5432);
  assert.equal(web.role, null);
  assert.equal(web.publicIp, false);
});

test('removeSubnet cleans up NATs, their routes, associations, and workload refs', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const keep = addSubnet(arch, { az: 'b', cidr: '10.0.2.0/24' });
  const nat = addNat(arch, s.id);
  const rt = addRouteTable(arch, 'private');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  associateSubnet(arch, rt.id, s.id);
  const wl = addWorkload(arch, { type: 'alb', subnetIds: [s.id, keep.id] });

  removeSubnet(arch, s.id);

  assert.equal(getSubnet(arch, s.id), null);
  assert.deepEqual(arch.natGateways, []);
  assert.deepEqual(getRouteTable(arch, rt.id).routes, []); // nat route removed with the NAT
  assert.deepEqual(getRouteTable(arch, rt.id).subnetIds, []);
  assert.deepEqual(wl.subnetIds, [keep.id]);
});

test('removeNat strips routes that target it', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const nat = addNat(arch, s.id);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  removeNat(arch, nat.id);
  assert.deepEqual(getRouteTable(arch, 'rtb-main').routes, []);
});

test('removeRouteTable refuses the main table and drops custom ones', () => {
  const arch = createArch();
  const rt = addRouteTable(arch, 'public');
  assert.equal(removeRouteTable(arch, 'rtb-main'), false);
  assert.equal(removeRouteTable(arch, rt.id), true);
  assert.equal(arch.routeTables.length, 1);
});

test('associateSubnet moves a subnet between route tables (never duplicates)', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const rt1 = addRouteTable(arch, 'one');
  const rt2 = addRouteTable(arch, 'two');
  associateSubnet(arch, rt1.id, s.id);
  associateSubnet(arch, rt2.id, s.id);
  assert.deepEqual(getRouteTable(arch, rt1.id).subnetIds, []);
  assert.deepEqual(getRouteTable(arch, rt2.id).subnetIds, [s.id]);
  disassociateSubnet(arch, s.id);
  assert.deepEqual(getRouteTable(arch, rt2.id).subnetIds, []);
});

test('removeSecurityGroup cleans workload refs and sg: rule sources', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const web = addSecurityGroup(arch, 'web');
  const db = addSecurityGroup(arch, 'db');
  addSgRule(arch, db.id, { portFrom: 5432, source: `sg:${web.id}` });
  addSgRule(arch, db.id, { portFrom: 22, source: '10.0.0.0/16' });
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [s.id], sgIds: [web.id] });

  removeSecurityGroup(arch, web.id);

  assert.deepEqual(wl.sgIds, []);
  assert.equal(db.inbound.length, 1);
  assert.equal(db.inbound[0].source, '10.0.0.0/16');
});

test('addSgRule defaults proto to tcp and portTo to portFrom', () => {
  const arch = createArch();
  const sg = addSecurityGroup(arch);
  const rule = addSgRule(arch, sg.id, { portFrom: 443, source: '0.0.0.0/0' });
  assert.deepEqual(rule, { proto: 'tcp', portFrom: 443, portTo: 443, source: '0.0.0.0/0' });
});

test('effectiveRouteTable falls back to main when unassociated', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  assert.equal(effectiveRouteTable(arch, s.id).id, 'rtb-main');
  const rt = addRouteTable(arch, 'public');
  associateSubnet(arch, rt.id, s.id);
  assert.equal(effectiveRouteTable(arch, s.id).id, rt.id);
});

test('isPublicSubnet requires an attached IGW and an igw route', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  assert.equal(isPublicSubnet(arch, s.id), false);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: 'igw' });
  assert.equal(isPublicSubnet(arch, s.id), false, 'route alone is not enough');
  arch.vpc.igwAttached = true;
  assert.equal(isPublicSubnet(arch, s.id), true);
});

test('workloadsByRole and workloadAzs (deduped)', () => {
  const arch = createArch();
  const sa = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const sb = addSubnet(arch, { az: 'b', cidr: '10.0.2.0/24' });
  const alb = addWorkload(arch, { type: 'alb', role: 'lb', subnetIds: [sa.id, sb.id] });
  addWorkload(arch, { type: 'ec2', role: 'web', subnetIds: [sa.id] });
  assert.deepEqual(workloadsByRole(arch, 'lb'), [alb]);
  assert.deepEqual(workloadAzs(arch, alb).sort(), ['a', 'b']);
});

test('update helpers patch in place; remove helpers drop the resource', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  updateSubnet(arch, s.id, { name: 'public-a' });
  assert.equal(getSubnet(arch, s.id).name, 'public-a');
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [s.id] });
  updateWorkload(arch, wl.id, { publicIp: true });
  assert.equal(wl.publicIp, true);
  removeWorkload(arch, wl.id);
  assert.deepEqual(arch.workloads, []);
  const sg = addSecurityGroup(arch);
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  removeSgRule(arch, sg.id, 0);
  assert.deepEqual(sg.inbound, []);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: 'igw' });
  removeRoute(arch, 'rtb-main', 0);
  assert.deepEqual(getRouteTable(arch, 'rtb-main').routes, []);
});
