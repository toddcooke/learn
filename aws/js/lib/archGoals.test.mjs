import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload,
} from './archModel.js';
import { GOAL_TYPES, evaluateGoals } from './archGoals.js';

const CH = {
  roles: [
    { id: 'web', label: 'web server', expectedType: 'ec2' },
    { id: 'db', label: 'database', expectedType: 'rds' },
  ],
};

function goals(arch, goalList) {
  return evaluateGoals(arch, { ...CH, goals: goalList });
}

function publicWebArch() {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const s = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const rt = addRouteTable(arch, 'public');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, rt.id, s.id);
  const sg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  addWorkload(arch, { type: 'ec2', role: 'web', subnetIds: [s.id], sgIds: [sg.id], publicIp: true });
  return arch;
}

test('GOAL_TYPES is the fixed vocabulary', () => {
  assert.deepEqual(GOAL_TYPES, [
    'exists', 'internetReaches', 'cidrReaches', 'noInternetReach', 'reaches',
    'hasEgress', 'spansAzs', 'multiAz', 'vpcCidrIs', 'subnetPlan',
  ]);
});

test('exists checks role assignment and type', () => {
  const arch = publicWebArch();
  const [r1] = goals(arch, [{ type: 'exists', role: 'web', workloadType: 'ec2' }]);
  assert.equal(r1.ok, true);
  const [r2] = goals(arch, [{ type: 'exists', role: 'db', workloadType: 'rds' }]);
  assert.equal(r2.ok, false);
  assert.match(r2.detail, /database/);
});

test('internetReaches passes for the public web arch and fails once broken', () => {
  const arch = publicWebArch();
  const [r] = goals(arch, [{ type: 'internetReaches', role: 'web', port: 80 }]);
  assert.equal(r.ok, true);
  assert.equal(r.traces.length, 1);
  arch.vpc.igwAttached = false;
  const [r2] = goals(arch, [{ type: 'internetReaches', role: 'web', port: 80 }]);
  assert.equal(r2.ok, false);
});

test('goals referencing an empty role fail with a helpful detail', () => {
  const arch = createArch();
  for (const g of [
    { type: 'internetReaches', role: 'web', port: 80 },
    { type: 'hasEgress', role: 'web' },
    { type: 'spansAzs', role: 'web', min: 2 },
    { type: 'multiAz', role: 'db' },
    { type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 },
  ]) {
    const [r] = goals(arch, [g]);
    assert.equal(r.ok, false, g.type);
    assert.match(r.detail, /No workload is assigned/i, g.type);
  }
});

test('noInternetReach: open SG + public path fails it; closing either passes it', () => {
  const arch = publicWebArch();
  const [r] = goals(arch, [{ type: 'noInternetReach', role: 'web' }]);
  assert.equal(r.ok, false, 'web is internet-open');
  arch.workloads[0].publicIp = false;
  const [r2] = goals(arch, [{ type: 'noInternetReach', role: 'web' }]);
  assert.equal(r2.ok, true);
});

test('noInternetReach passes when the role is empty (nothing is exposed)', () => {
  const [r] = goals(createArch(), [{ type: 'noInternetReach', role: 'web' }]);
  assert.equal(r.ok, true);
});

test('reaches evaluates every from×to pair', () => {
  const arch = publicWebArch();
  const priv = addSubnet(arch, { name: 'private-a', az: 'a', cidr: '10.0.2.0/24' });
  const privB = addSubnet(arch, { name: 'private-b', az: 'b', cidr: '10.0.3.0/24' });
  const dbSg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: 'sg:sg-1' }); // web-sg is sg-1
  addWorkload(arch, { type: 'rds', role: 'db', subnetIds: [priv.id, privB.id], sgIds: [dbSg.id] });
  const [r] = goals(arch, [{ type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 }]);
  assert.equal(r.ok, true);
  dbSg.inbound.length = 0;
  const [r2] = goals(arch, [{ type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 }]);
  assert.equal(r2.ok, false);
});

test('spansAzs, multiAz, vpcCidrIs', () => {
  const arch = publicWebArch();
  const [az1] = goals(arch, [{ type: 'spansAzs', role: 'web', min: 2 }]);
  assert.equal(az1.ok, false);
  const sb = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.4.0/24' });
  associateSubnet(arch, arch.routeTables.find((t) => t.name === 'public').id, sb.id);
  addWorkload(arch, { type: 'ec2', role: 'web', subnetIds: [sb.id], sgIds: ['sg-1'], publicIp: true });
  const [az2] = goals(arch, [{ type: 'spansAzs', role: 'web', min: 2 }]);
  assert.equal(az2.ok, true);

  const priv = addSubnet(arch, { az: 'a', cidr: '10.0.5.0/24' });
  const privB = addSubnet(arch, { az: 'b', cidr: '10.0.6.0/24' });
  const db = addWorkload(arch, { type: 'rds', role: 'db', subnetIds: [priv.id, privB.id], multiAz: false });
  const [ma1] = goals(arch, [{ type: 'multiAz', role: 'db' }]);
  assert.equal(ma1.ok, false);
  db.multiAz = true;
  const [ma2] = goals(arch, [{ type: 'multiAz', role: 'db' }]);
  assert.equal(ma2.ok, true);

  const [vc1] = goals(arch, [{ type: 'vpcCidrIs', cidr: '10.0.0.0/16' }]);
  assert.equal(vc1.ok, true);
  const [vc2] = goals(arch, [{ type: 'vpcCidrIs', cidr: '10.0.0.0/24' }]);
  assert.equal(vc2.ok, false);
});

test('subnetPlan checks count, sizing, AZ spread, and public/private split', () => {
  const arch = createArch();
  arch.vpc.cidr = '10.0.0.0/24';
  arch.vpc.igwAttached = true;
  const plan = { type: 'subnetPlan', count: 4, minUsableHosts: 50, minAzs: 2, publicCount: 2, privateCount: 2 };
  assert.equal(goals(arch, [plan])[0].ok, false, 'empty fails');
  const pubA = addSubnet(arch, { az: 'a', cidr: '10.0.0.0/26' });
  const pubB = addSubnet(arch, { az: 'b', cidr: '10.0.0.64/26' });
  addSubnet(arch, { az: 'a', cidr: '10.0.0.128/26' });
  addSubnet(arch, { az: 'b', cidr: '10.0.0.192/26' });
  const rt = addRouteTable(arch, 'public');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, rt.id, pubA.id);
  associateSubnet(arch, rt.id, pubB.id);
  assert.equal(goals(arch, [plan])[0].ok, true);
  assert.equal(goals(arch, [{ ...plan, minUsableHosts: 60 }])[0].ok, false, '/26 has 59 usable');
});

test('every goal row carries a non-empty human label', () => {
  const arch = publicWebArch();
  const rows = goals(arch, [
    { type: 'exists', role: 'web', workloadType: 'ec2' },
    { type: 'internetReaches', role: 'web', port: 80 },
    { type: 'cidrReaches', cidr: '203.0.113.0/24', cidrLabel: 'the office', role: 'web', port: 22 },
  ]);
  for (const row of rows) {
    assert.equal(typeof row.label, 'string');
    assert.ok(row.label.length > 10, row.label);
  }
  assert.match(rows[2].label, /the office/);
});
