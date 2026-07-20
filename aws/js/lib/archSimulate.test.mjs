import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload,
} from './archModel.js';
import {
  INTERNET_TEST_IP, resolveRoute, internetToWorkload, sourceToWorkload,
  workloadToWorkload, workloadToInternet, isInternetOpen,
} from './archSimulate.js';

// Shared fixture: public subnet a, private subnet b, IGW attached.
function baseArch() {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const priv = addSubnet(arch, { name: 'private-a', az: 'a', cidr: '10.0.2.0/24' });
  const rt = addRouteTable(arch, 'public');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, rt.id, pub.id);
  return { arch, pub, priv, rt };
}

test('resolveRoute prefers the longest prefix and injects the implicit local route', () => {
  const { arch, pub } = baseArch();
  assert.equal(resolveRoute(arch, pub.id, '10.0.2.7').target, 'local'); // /16 local beats /0 igw
  assert.equal(resolveRoute(arch, pub.id, INTERNET_TEST_IP).target, 'igw');
});

test('resolveRoute returns null when nothing matches (no default route)', () => {
  const { arch, priv } = baseArch();
  assert.equal(resolveRoute(arch, priv.id, INTERNET_TEST_IP), null);
});

test('internetToWorkload passes for a public EC2 with an open SG', () => {
  const { arch, pub } = baseArch();
  const sg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [sg.id], publicIp: true });
  const { ok, trace } = internetToWorkload(arch, wl.id, 80);
  assert.equal(ok, true);
  assert.ok(trace.length >= 4);
  assert.ok(trace.every((s) => s.ok));
});

test('internetToWorkload fails without a public IP, and the trace says so', () => {
  const { arch, pub } = baseArch();
  const sg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [sg.id], publicIp: false });
  const { ok, trace } = internetToWorkload(arch, wl.id, 80);
  assert.equal(ok, false);
  const failed = trace.filter((s) => !s.ok);
  assert.equal(failed.length, 1);
  assert.match(failed[0].label, /public IP/i);
});

test('internetToWorkload fails when the IGW is detached or the subnet is private', () => {
  const { arch, pub, priv } = baseArch();
  const sg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const inPriv = addWorkload(arch, { type: 'ec2', subnetIds: [priv.id], sgIds: [sg.id], publicIp: true });
  assert.equal(internetToWorkload(arch, inPriv.id, 80).ok, false);

  const inPub = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [sg.id], publicIp: true });
  arch.vpc.igwAttached = false;
  assert.equal(internetToWorkload(arch, inPub.id, 80).ok, false);
});

test('a workload with no SG attached denies all inbound', () => {
  const { arch, pub } = baseArch();
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [], publicIp: true });
  const { ok, trace } = internetToWorkload(arch, wl.id, 80);
  assert.equal(ok, false);
  assert.ok(trace.some((s) => !s.ok && /no security group/i.test(s.label)));
});

test('ALB inbound requires ALL its subnets to be public', () => {
  const { arch, pub, priv } = baseArch();
  const sb = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.3.0/24' });
  const rt = arch.routeTables.find((t) => t.name === 'public');
  associateSubnet(arch, rt.id, sb.id); // only moves sb; pub's association is untouched
  const sg = addSecurityGroup(arch, 'alb-sg');
  addSgRule(arch, sg.id, { portFrom: 443, source: '0.0.0.0/0' });
  const alb = addWorkload(arch, { type: 'alb', subnetIds: [pub.id, priv.id], sgIds: [sg.id] });
  assert.equal(internetToWorkload(arch, alb.id, 443).ok, false, 'one private subnet sinks it');
  const alb2 = addWorkload(arch, { type: 'alb', subnetIds: [pub.id, sb.id], sgIds: [sg.id] });
  assert.equal(internetToWorkload(arch, alb2.id, 443).ok, true);
});

test('sourceToWorkload with a CIDR source: rule must cover the whole source block', () => {
  const { arch, pub } = baseArch();
  const sg = addSecurityGroup(arch, 'bastion-sg');
  addSgRule(arch, sg.id, { portFrom: 22, source: '203.0.113.0/24' });
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [sg.id], publicIp: true });
  assert.equal(sourceToWorkload(arch, { type: 'cidr', cidr: '203.0.113.0/24' }, wl.id, 22).ok, true);
  assert.equal(sourceToWorkload(arch, { type: 'cidr', cidr: '198.51.100.0/24' }, wl.id, 22).ok, false);
  assert.equal(internetToWorkload(arch, wl.id, 22).ok, false, 'office CIDR is not internet-open');
});

test('workloadToWorkload: sg-reference chaining and CIDR coverage both work', () => {
  const { arch, pub, priv } = baseArch();
  const webSg = addSecurityGroup(arch, 'web-sg');
  const dbSg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: `sg:${webSg.id}` });
  const sb = addSubnet(arch, { name: 'private-b', az: 'b', cidr: '10.0.4.0/24' });
  const web = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [webSg.id], publicIp: true });
  const db = addWorkload(arch, { type: 'rds', subnetIds: [priv.id, sb.id], sgIds: [dbSg.id] });
  assert.equal(workloadToWorkload(arch, web.id, db.id, 5432).ok, true);

  const lone = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [], publicIp: false });
  assert.equal(workloadToWorkload(arch, lone.id, db.id, 5432).ok, false, 'lone has no web-sg');

  addSgRule(arch, dbSg.id, { portFrom: 5432, source: '10.0.1.0/24' });
  assert.equal(workloadToWorkload(arch, lone.id, db.id, 5432).ok, true, 'CIDR covering the sender subnet');
});

test('workloadToInternet: public-IP path, healthy NAT path, and NAT-in-private-subnet failure', () => {
  const { arch, pub, priv } = baseArch();
  const pubWl = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [], publicIp: true });
  assert.equal(workloadToInternet(arch, pubWl.id).ok, true);

  const noIp = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [], publicIp: false });
  assert.equal(workloadToInternet(arch, noIp.id).ok, false, 'IGW route but no public IP');

  const privWl = addWorkload(arch, { type: 'ec2', subnetIds: [priv.id], sgIds: [] });
  assert.equal(workloadToInternet(arch, privWl.id).ok, false, 'no route at all');

  const nat = addNat(arch, pub.id);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  assert.equal(workloadToInternet(arch, privWl.id).ok, true, 'NAT in a public subnet works');

  // Move the NAT into the private subnet: egress must now dead-end.
  nat.subnetId = priv.id;
  const res = workloadToInternet(arch, privWl.id);
  assert.equal(res.ok, false);
  assert.ok(res.trace.some((s) => !s.ok && /NAT/.test(s.label)));
});

test('inbound to an unplaced workload (no subnets) fails even with all other conditions met', () => {
  const { arch } = baseArch();
  const sg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [], sgIds: [sg.id], publicIp: true });
  const { ok, trace } = internetToWorkload(arch, wl.id, 80);
  assert.equal(ok, false);
  assert.ok(trace.some((s) => !s.ok && /isn't placed/.test(s.label)));
});

test('isInternetOpen needs both a public path and a 0.0.0.0/0 rule', () => {
  const { arch, pub } = baseArch();
  const sg = addSecurityGroup(arch, 'web-sg');
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [pub.id], sgIds: [sg.id], publicIp: true });
  assert.equal(isInternetOpen(arch, wl.id), false, 'no open rule yet');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  assert.equal(isInternetOpen(arch, wl.id), true);
  wl.publicIp = false;
  assert.equal(isInternetOpen(arch, wl.id), false, 'open rule but no public path');
});
