import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addWorkload,
} from './archModel.js';
import { validateStructure } from './archValidate.js';

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
    'route-dest-invalid', 'route-igw-unattached', 'route-nat-missing', 'route-target-unknown',
  ]);
  arch.vpc.igwAttached = true;
  assert.ok(!ruleIds(arch).includes('route-igw-unattached'));
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
