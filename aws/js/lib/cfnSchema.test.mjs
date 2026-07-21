import test from 'node:test';
import assert from 'node:assert/strict';
import {
  RESOURCE_TYPES, KNOWN_UNSUPPORTED, ENGINE_DEFAULT_PORTS, KIND_LABELS,
  typeDoc, propDoc,
} from './cfnSchema.js';

test('every supported type has a kind, a doc, and prop specs', () => {
  for (const [name, spec] of Object.entries(RESOURCE_TYPES)) {
    assert.ok(spec.kind, `${name} kind`);
    assert.ok(typeof spec.doc === 'string' && spec.doc.length > 20, `${name} doc`);
    assert.ok(spec.props && typeof spec.props === 'object', `${name} props`);
    assert.ok(KIND_LABELS[spec.kind], `${name} kind label`);
  }
});

test('the 14 spec-mandated types are present', () => {
  const expected = [
    'AWS::EC2::VPC', 'AWS::EC2::Subnet', 'AWS::EC2::InternetGateway',
    'AWS::EC2::VPCGatewayAttachment', 'AWS::EC2::EIP', 'AWS::EC2::NatGateway',
    'AWS::EC2::RouteTable', 'AWS::EC2::Route', 'AWS::EC2::SubnetRouteTableAssociation',
    'AWS::EC2::SecurityGroup', 'AWS::EC2::Instance',
    'AWS::ElasticLoadBalancingV2::LoadBalancer',
    'AWS::RDS::DBSubnetGroup', 'AWS::RDS::DBInstance',
  ];
  for (const t of expected) assert.ok(RESOURCE_TYPES[t], t);
});

test('required properties match the strict-CFN spec decisions', () => {
  const req = (t) => Object.entries(RESOURCE_TYPES[t].props)
    .filter(([, p]) => p.required).map(([n]) => n).sort();
  assert.deepEqual(req('AWS::EC2::Subnet'), ['AvailabilityZone', 'CidrBlock', 'VpcId']);
  assert.deepEqual(req('AWS::EC2::NatGateway'), ['AllocationId', 'SubnetId']);
  assert.deepEqual(req('AWS::EC2::SecurityGroup'), ['GroupDescription', 'VpcId']);
  assert.deepEqual(req('AWS::EC2::Instance'), ['ImageId', 'SubnetId']);
  assert.deepEqual(req('AWS::RDS::DBInstance'), ['DBSubnetGroupName', 'Engine']);
});

test('ref-shaped props declare the kind they must point at', () => {
  assert.equal(RESOURCE_TYPES['AWS::EC2::Subnet'].props.VpcId.ref, 'vpc');
  assert.equal(RESOURCE_TYPES['AWS::EC2::Route'].props.NatGatewayId.ref, 'nat');
  assert.equal(RESOURCE_TYPES['AWS::EC2::Instance'].props.SecurityGroupIds.refList, 'sg');
  assert.deepEqual(RESOURCE_TYPES['AWS::EC2::NatGateway'].props.AllocationId.getAtt,
    { kind: 'eip', attr: 'AllocationId' });
});

test('engine default ports and doc lookups', () => {
  assert.equal(ENGINE_DEFAULT_PORTS.postgres, 5432);
  assert.equal(ENGINE_DEFAULT_PORTS.mysql, 3306);
  assert.ok(typeDoc('AWS::EC2::VPC').length > 20);
  assert.equal(typeDoc('AWS::EC2::Instanc'), null);
  assert.ok(propDoc('AWS::EC2::Subnet', 'MapPublicIpOnLaunch').length > 20);
  assert.equal(propDoc('AWS::EC2::Subnet', 'Nope'), null);
  assert.ok(KNOWN_UNSUPPORTED.includes('AWS::S3::Bucket'));
});
