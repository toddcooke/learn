import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload,
} from './archModel.js';
import { validateStructure, BEST_PRACTICE_RULE_IDS, evaluateBestPractices } from './archValidate.js';

function ruleIds(arch) {
  return validateStructure(arch).errors.map((e) => e.ruleId).sort();
}

test('a fresh empty architecture has no structural errors', () => {
  assert.deepEqual(ruleIds(createArch()), []);
});

test('flags invalid and out-of-range VPC CIDRs', () => {
  const arch = createArch();
  arch.vpc.cidr = 'nonsense';
  assert.deepEqual(ruleIds(arch), ['vpc-cidr-invalid']);
  arch.vpc.cidr = '10.0.0.0/12';
  assert.deepEqual(ruleIds(arch), ['vpc-cidr-prefix']);
});

test('flags subnet CIDR problems: invalid, prefix, outside VPC, overlap', () => {
  const arch = createArch();
  addSubnet(arch, { az: 'a', cidr: 'bad' });
  assert.deepEqual(ruleIds(arch), ['subnet-cidr-invalid']);

  const arch2 = createArch();
  addSubnet(arch2, { az: 'a', cidr: '10.0.0.0/30' });
  assert.deepEqual(ruleIds(arch2), ['subnet-cidr-prefix']);

  const arch3 = createArch();
  addSubnet(arch3, { az: 'a', cidr: '192.168.0.0/24' });
  assert.deepEqual(ruleIds(arch3), ['subnet-outside-vpc']);

  const arch4 = createArch();
  addSubnet(arch4, { az: 'a', cidr: '10.0.1.0/24' });
  addSubnet(arch4, { az: 'b', cidr: '10.0.1.128/25' });
  assert.deepEqual(ruleIds(arch4), ['subnet-overlap']);
});

test('flags route problems: bad dest, unattached IGW, missing NAT, unknown target', () => {
  const arch = createArch();
  addRoute(arch, 'rtb-main', { destCidr: 'junk', target: 'igw' });
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: 'igw' });
  addRoute(arch, 'rtb-main', { destCidr: '198.51.100.0/24', target: 'nat:nat-99' });
  addRoute(arch, 'rtb-main', { destCidr: '203.0.113.0/24', target: 'vgw' });
  assert.deepEqual(ruleIds(arch), [
    'route-dest-invalid', 'route-igw-unattached', 'route-igw-unattached', 'route-nat-missing', 'route-target-unknown',
  ]);
  arch.vpc.igwAttached = true;
  assert.ok(!ruleIds(arch).includes('route-igw-unattached'));
});

test('reports every offending route: two missing NATs produce two route-nat-missing errors', () => {
  const arch = createArch();
  addRoute(arch, 'rtb-main', { destCidr: '198.51.100.0/24', target: 'nat:missing-1' });
  addRoute(arch, 'rtb-main', { destCidr: '203.0.113.0/24', target: 'nat:missing-2' });
  const errors = validateStructure(arch).errors;
  const natMissingErrors = errors.filter((e) => e.ruleId === 'route-nat-missing');
  assert.equal(natMissingErrors.length, 2, 'should have exactly 2 route-nat-missing errors');
  assert.ok(
    natMissingErrors.some((e) => e.message.includes('missing-1')),
    'first error should name missing-1'
  );
  assert.ok(
    natMissingErrors.some((e) => e.message.includes('missing-2')),
    'second error should name missing-2'
  );
});

test('flags a NAT whose subnet is gone (hand-built state)', () => {
  const arch = createArch();
  arch.natGateways.push({ id: 'nat-1', subnetId: 'subnet-99' });
  assert.deepEqual(ruleIds(arch), ['nat-subnet-missing']);
});

test('flags a subnet associated with two route tables (hand-built state)', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const rt1 = addRouteTable(arch, 'one');
  const rt2 = addRouteTable(arch, 'two');
  associateSubnet(arch, rt1.id, s.id);
  rt2.subnetIds.push(s.id); // bypass the mutator to build the invalid state
  assert.deepEqual(ruleIds(arch), ['subnet-multi-assoc']);
});

test('flags dangling workload refs and per-type subnet layout rules', () => {
  const arch = createArch();
  addWorkload(arch, { type: 'ec2', subnetIds: ['subnet-99'], sgIds: ['sg-99'] });
  assert.deepEqual(ruleIds(arch), ['workload-sg-missing', 'workload-subnet-missing']);

  const arch2 = createArch();
  const sa = addSubnet(arch2, { az: 'a', cidr: '10.0.1.0/24' });
  const sb = addSubnet(arch2, { az: 'a', cidr: '10.0.2.0/24' }); // same AZ
  addWorkload(arch2, { type: 'ec2', subnetIds: [sa.id, sb.id] });
  addWorkload(arch2, { type: 'alb', subnetIds: [sa.id, sb.id] });
  addWorkload(arch2, { type: 'rds', subnetIds: [sb.id] });
  assert.deepEqual(ruleIds(arch2), ['alb-subnet-spread', 'ec2-subnet-count', 'rds-subnet-spread']);
});

test('a correct small architecture validates clean', () => {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const rt = addRouteTable(arch, 'public');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, rt.id, s.id);
  const nat = addNat(arch, s.id);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  const sg = addSecurityGroup(arch, 'web');
  addWorkload(arch, { type: 'ec2', subnetIds: [s.id], sgIds: [sg.id], publicIp: true });
  assert.deepEqual(ruleIds(arch), []);
});

// ---------------------------------------------------------------------------
// Best-practice rules
// ---------------------------------------------------------------------------

function bp(arch, ids = 'all') {
  const out = {};
  for (const r of evaluateBestPractices(arch, ids)) out[r.ruleId] = r;
  return out;
}

test('BEST_PRACTICE_RULE_IDS lists the seven rules in order', () => {
  assert.deepEqual(BEST_PRACTICE_RULE_IDS, [
    'db-in-private-subnet', 'no-open-ssh', 'no-open-db-port', 'least-privilege-sg',
    'nat-per-az', 'single-az', 'unused-resources',
  ]);
});

test('db-in-private-subnet: applicable only with RDS, fails on a public subnet', () => {
  const arch = createArch();
  assert.equal(bp(arch)['db-in-private-subnet'].applicable, false);
  arch.vpc.igwAttached = true;
  const pub = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const priv = addSubnet(arch, { az: 'b', cidr: '10.0.2.0/24' });
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: 'igw' }); // main table public!
  addWorkload(arch, { type: 'rds', subnetIds: [pub.id, priv.id] });
  const r = bp(arch)['db-in-private-subnet'];
  assert.equal(r.applicable, true);
  assert.equal(r.ok, false);
});

test('no-open-ssh and no-open-db-port catch 0.0.0.0/0 exposure', () => {
  const arch = createArch();
  const sg = addSecurityGroup(arch, 'wide-open');
  addSgRule(arch, sg.id, { portFrom: 0, portTo: 65535, source: '0.0.0.0/0' });
  assert.equal(bp(arch)['no-open-ssh'].ok, false, 'port range covering 22 counts');

  const sa = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const sb = addSubnet(arch, { az: 'b', cidr: '10.0.2.0/24' });
  addWorkload(arch, { type: 'rds', subnetIds: [sa.id, sb.id], sgIds: [sg.id] });
  assert.equal(bp(arch)['no-open-db-port'].ok, false);
});

test('least-privilege-sg flags intra-VPC CIDR rules but not external ones', () => {
  const arch = createArch();
  const sg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, sg.id, { portFrom: 5432, source: '10.0.0.0/16' });
  assert.equal(bp(arch)['least-privilege-sg'].ok, false);
  sg.inbound[0].source = '203.0.113.0/24';
  assert.equal(bp(arch)['least-privilege-sg'].ok, true, 'external CIDR is fine');
  sg.inbound[0].source = `sg:${sg.id}`;
  assert.equal(bp(arch)['least-privilege-sg'].applicable, false, 'no CIDR rules left');
});

test('nat-per-az wants a NAT in every AZ that egresses through NAT', () => {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const pubA = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const privA = addSubnet(arch, { az: 'a', cidr: '10.0.2.0/24' });
  const privB = addSubnet(arch, { az: 'b', cidr: '10.0.3.0/24' });
  const pubRt = addRouteTable(arch, 'public');
  addRoute(arch, pubRt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, pubRt.id, pubA.id);
  const nat = addNat(arch, pubA.id);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  // privA and privB (both on main) egress via the single NAT in AZ a.
  const r = bp(arch)['nat-per-az'];
  assert.equal(r.applicable, true);
  assert.equal(r.ok, false, 'AZ b has no NAT');

  const pubB = addSubnet(arch, { az: 'b', cidr: '10.0.4.0/24' });
  associateSubnet(arch, pubRt.id, pubB.id);
  addNat(arch, pubB.id);
  assert.equal(bp(arch)['nat-per-az'].ok, true);
});

test('single-az nudges toward multi-AZ; unused-resources flags dead weight', () => {
  const arch = createArch();
  const sa = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  addWorkload(arch, { type: 'ec2', subnetIds: [sa.id] });
  assert.equal(bp(arch)['single-az'].ok, false);

  addNat(arch, sa.id);                 // no route references it
  addSecurityGroup(arch, 'orphan');    // attached to nothing
  addRouteTable(arch, 'empty');        // no subnets associated
  const r = bp(arch)['unused-resources'];
  assert.equal(r.ok, false);
  assert.match(r.message, /NAT/);
  assert.match(r.message, /orphan/);
  assert.match(r.message, /empty/);
});

test('rule selection: only requested rules are returned', () => {
  const arch = createArch();
  const rows = evaluateBestPractices(arch, ['no-open-ssh', 'single-az']);
  assert.deepEqual(rows.map((r) => r.ruleId), ['no-open-ssh', 'single-az']);
});
