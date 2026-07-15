import test from 'node:test';
import assert from 'node:assert/strict';
import {
  ipToInt,
  intToIp,
  maskForPrefix,
  parseCidr,
  totalAddresses,
  usableAddresses,
  reservedAddresses,
  describeBoundary,
  evaluateRouteTable,
  pickWinner,
  AZS,
  SUBNETS,
  subnetElId,
  natElId,
  IGW_ID,
  S3_ENDPOINT_ID,
  ALL_HIGHLIGHTABLE_IDS,
} from './vpcMath.js';

// ---------------------------------------------------------------------------
// Core CIDR math
// ---------------------------------------------------------------------------

test('ipToInt/intToIp round-trip, staying unsigned for high-bit addresses', () => {
  assert.equal(ipToInt('10.0.0.0'), 167772160);
  assert.equal(ipToInt('128.0.0.0'), 2147483648); // would be negative without >>> 0
  assert.equal(ipToInt('255.255.255.255'), 4294967295);
  for (const ip of ['0.0.0.0', '10.0.29.200', '93.184.216.34', '203.0.113.7', '255.255.255.255']) {
    assert.equal(intToIp(ipToInt(ip)), ip);
    assert.ok(ipToInt(ip) >= 0, `${ip} must convert to an unsigned int`);
  }
});

test('maskForPrefix covers /0 through /32 without sign errors', () => {
  assert.equal(maskForPrefix(0), 0);
  assert.equal(maskForPrefix(16), 0xffff0000);
  assert.equal(maskForPrefix(24), 0xffffff00);
  assert.equal(maskForPrefix(31), 0xfffffffe);
  assert.equal(maskForPrefix(32), 0xffffffff);
  for (let p = 0; p <= 32; p++) {
    assert.ok(maskForPrefix(p) >= 0, `/${p} mask must be unsigned`);
  }
});

test('parseCidr computes network and broadcast', () => {
  const { network, broadcast, prefixLen } = parseCidr('10.0.29.200/20');
  assert.equal(intToIp(network), '10.0.16.0');
  assert.equal(intToIp(broadcast), '10.0.31.255');
  assert.equal(prefixLen, 20);
});

test('parseCidr stays unsigned for networks with the high bit set', () => {
  const { network, broadcast } = parseCidr('192.168.1.130/25');
  assert.ok(network > 0, 'high-bit network must be a positive number');
  assert.equal(intToIp(network), '192.168.1.128');
  assert.equal(intToIp(broadcast), '192.168.1.255');
});

test('totalAddresses is a pure power of two', () => {
  assert.equal(totalAddresses(16), 65536);
  assert.equal(totalAddresses(24), 256);
  assert.equal(totalAddresses(28), 16);
  assert.equal(totalAddresses(32), 1);
});

test('usableAddresses subtracts the 5 AWS-reserved addresses', () => {
  assert.equal(usableAddresses(16), 65531);
  assert.equal(usableAddresses(24), 251);
  assert.equal(usableAddresses(28), 11);
});

test('usableAddresses clamps to 0 for /30, /31, and /32 instead of going negative', () => {
  assert.equal(usableAddresses(30), 0); // 4 - 5 would be -1
  assert.equal(usableAddresses(31), 0); // 2 - 5 would be -3
  assert.equal(usableAddresses(32), 0); // 1 - 5 would be -4
});

test('reservedAddresses lists the 5 reserved IPs in order', () => {
  const reserved = reservedAddresses('10.0.0.0/24');
  assert.deepEqual(reserved.map((r) => r.ip), ['10.0.0.0', '10.0.0.1', '10.0.0.2', '10.0.0.3', '10.0.0.255']);
  assert.equal(reserved.length, 5);
});

test('describeBoundary is degenerate at the VPC prefix and below', () => {
  assert.equal(describeBoundary(16, ipToInt('10.0.0.0')).degenerate, true);
  assert.equal(describeBoundary(8, ipToInt('10.0.0.0')).degenerate, true);
});

test('describeBoundary finds the interesting octet and block for /20', () => {
  const b = describeBoundary(20, ipToInt('10.0.16.0'));
  assert.equal(b.degenerate, false);
  assert.equal(b.interestingOctetIndex, 3);
  assert.equal(b.fixedBitsInOctet, 4);
  assert.equal(b.freeBitsInOctet, 4);
  assert.equal(b.blockWidth, 16);
  assert.equal(b.val, 16);
  assert.equal(b.blockStart, 16);
  assert.equal(b.blockEnd, 31);
});

test('describeBoundary handles octet-aligned prefixes and fourth-octet splits', () => {
  const aligned = describeBoundary(24, ipToInt('10.0.5.0'));
  assert.equal(aligned.interestingOctetIndex, 3);
  assert.equal(aligned.freeBitsInOctet, 0);
  assert.equal(aligned.blockWidth, 1);

  const fourth = describeBoundary(28, ipToInt('10.0.29.192'));
  assert.equal(fourth.interestingOctetIndex, 4);
  assert.equal(fourth.fixedBitsInOctet, 4);
  assert.equal(fourth.blockWidth, 16);
  assert.equal(fourth.blockStart, 192);
  assert.equal(fourth.blockEnd, 207);
});

// ---------------------------------------------------------------------------
// Route evaluation (longest-prefix match)
// ---------------------------------------------------------------------------

const LOCAL = { dest: '10.0.0.0/16', target: 'local', type: 'cidr' };
const DEFAULT_IGW = { dest: '0.0.0.0/0', target: 'igw', type: 'cidr' };
const S3_PL = { dest: 'pl-xxxxxxxx (Amazon S3)', target: 'vpce-s3', type: 'prefix-list' };

test('evaluateRouteTable matches CIDR routes with high-bit networks (unsigned comparison)', () => {
  const table = [{ dest: '198.51.100.0/24', target: 'tgw', type: 'cidr' }];
  assert.equal(evaluateRouteTable(table, { type: 'ip', value: '198.51.100.7' })[0].matched, true);
  assert.equal(evaluateRouteTable(table, { type: 'ip', value: '198.51.101.7' })[0].matched, false);
});

test('longest-prefix match: local /16 beats the /0 default for in-VPC traffic', () => {
  const evaluated = evaluateRouteTable([LOCAL, DEFAULT_IGW], { type: 'ip', value: '10.0.48.7' });
  assert.deepEqual(evaluated.map((r) => r.matched), [true, true]);
  assert.equal(pickWinner(evaluated).target, 'local');
});

test('longest-prefix match: S3 prefix list (/24 nominal) beats the /0 default', () => {
  const evaluated = evaluateRouteTable([LOCAL, DEFAULT_IGW, S3_PL], { type: 's3' });
  assert.deepEqual(evaluated.map((r) => r.matched), [false, true, true]);
  assert.equal(pickWinner(evaluated).target, 'vpce-s3');
});

test('longest-prefix tie-breaking: first matched route wins on equal prefix length', () => {
  const table = [
    { dest: '10.0.0.0/16', target: 'first', type: 'cidr' },
    { dest: '10.0.0.0/16', target: 'second', type: 'cidr' },
  ];
  const evaluated = evaluateRouteTable(table, { type: 'ip', value: '10.0.1.1' });
  assert.equal(pickWinner(evaluated).target, 'first');
});

test('pickWinner returns null when nothing matches (isolated data tier drops the packet)', () => {
  const evaluated = evaluateRouteTable([LOCAL], { type: 'ip', value: '93.184.216.34' });
  assert.deepEqual(evaluated.map((r) => r.matched), [false]);
  assert.equal(pickWinner(evaluated), null);
});

test('invariant: the local route matches every in-VPC destination in every subnet', () => {
  const inVpcIps = ['10.0.0.0', '10.0.4.10', '10.0.48.7', '10.0.128.1', '10.0.255.255'];
  for (const subnet of SUBNETS) {
    for (const ip of inVpcIps) {
      const evaluated = evaluateRouteTable(subnet.routeTable, { type: 'ip', value: ip });
      const local = evaluated.find((r) => r.target === 'local');
      assert.equal(local.matched, true, `local route must match ${ip} in ${subnet.id}`);
      assert.equal(pickWinner(evaluated).target, 'local', `local must win for ${ip} in ${subnet.id}`);
    }
  }
});

test('the local route never matches the S3 prefix-list destination', () => {
  for (const subnet of SUBNETS) {
    const evaluated = evaluateRouteTable(subnet.routeTable, { type: 's3' });
    const local = evaluated.find((r) => r.target === 'local');
    assert.equal(local.matched, false, `local route must not match S3 in ${subnet.id}`);
  }
});

// ---------------------------------------------------------------------------
// Highlightable ids
// ---------------------------------------------------------------------------

test('ALL_HIGHLIGHTABLE_IDS covers every subnet, NAT badge, and both edge boxes exactly once', () => {
  const expected = [
    ...SUBNETS.map((s) => subnetElId(s.id)),
    ...AZS.map((az) => natElId(az)),
    IGW_ID,
    S3_ENDPOINT_ID,
  ];
  assert.deepEqual(ALL_HIGHLIGHTABLE_IDS, expected);
  assert.equal(new Set(ALL_HIGHLIGHTABLE_IDS).size, ALL_HIGHLIGHTABLE_IDS.length);
  assert.equal(ALL_HIGHLIGHTABLE_IDS.length, SUBNETS.length + AZS.length + 2);
  assert.ok(ALL_HIGHLIGHTABLE_IDS.includes('subnet-app-c'));
  assert.ok(ALL_HIGHLIGHTABLE_IDS.includes('nat-b'));
});
