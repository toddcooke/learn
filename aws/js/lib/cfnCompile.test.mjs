import test from 'node:test';
import assert from 'node:assert/strict';
import { compile } from './cfnCompile.js';

const errs = (r) => r.diagnostics.filter((d) => d.severity === 'error');
const warns = (r) => r.diagnostics.filter((d) => d.severity === 'warning');
const infos = (r) => r.diagnostics.filter((d) => d.severity === 'info');
const messages = (list) => list.map((d) => d.message);

// A minimal valid template most tests extend.
const VPC_ONLY = `AWSTemplateFormatVersion: "2010-09-09"
Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
`;

test('vpc-only template compiles to a bare arch', () => {
  const r = compile(VPC_ONLY);
  assert.deepEqual(errs(r), []);
  assert.ok(r.arch);
  assert.equal(r.arch.vpc.cidr, '10.0.0.0/16');
  assert.equal(r.arch.vpc.igwAttached, false);
  assert.equal(r.idMap.logicalToModel.Vpc, 'vpc');
  assert.equal(r.kinds.Vpc, 'vpc');
});

test('unknown resource type: exact message and squiggle range (the screenshot case)', () => {
  const text = `AWSTemplateFormatVersion: "2010-09-09"
Description:
Resources:
  DummyServer:
    Type: AWS::EC2::Instanc
    Properties:
`;
  const r = compile(text);
  const d = r.diagnostics.find((x) => x.message === 'Unknown CloudFormation resource type: AWS::EC2::Instanc');
  assert.ok(d, 'diagnostic present');
  assert.equal(d.severity, 'error');
  assert.equal(text.slice(d.from, d.to), 'AWS::EC2::Instanc');
  assert.equal(r.arch, null, 'errors block the arch');
});

test('real-but-unsupported type is a warning and the resource is ignored', () => {
  const r = compile(`${VPC_ONLY}  Bucket:
    Type: AWS::S3::Bucket
`);
  assert.deepEqual(errs(r), []);
  assert.match(messages(warns(r))[0], /AWS::S3::Bucket is real CloudFormation/);
  assert.ok(r.arch);
});

test('YAML syntax errors surface with positions and null arch', () => {
  const r = compile('Resources:\n  Vpc:\n   bad indent: [unclosed\n');
  assert.ok(errs(r).length > 0);
  assert.equal(r.arch, null);
});

test('empty or missing Resources is an error', () => {
  assert.ok(messages(errs(compile('Description: hi\n'))).some((m) => /Resources/.test(m)));
  assert.ok(messages(errs(compile('Resources: {}\n'))).some((m) => /Resources/.test(m)));
});

test('exactly one VPC required; a second is an error', () => {
  const r = compile(`${VPC_ONLY}  Vpc2:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.1.0.0/16
`);
  assert.ok(messages(errs(r)).some((m) => /Only 1 AWS::EC2::VPC/.test(m)));
  const none = compile('Resources:\n  Igw:\n    Type: AWS::EC2::InternetGateway\n');
  assert.ok(messages(errs(none)).some((m) => /exactly one AWS::EC2::VPC/.test(m)));
});

test('ignored sections are info, unknown top-level sections are warnings', () => {
  const r = compile(`Outputs:
  X:
    Value: y
Banana: true
${VPC_ONLY}`);
  assert.ok(messages(infos(r)).includes('Outputs is ignored by this simulator.'));
  assert.ok(messages(warns(r)).some((m) => /Unknown top-level section "Banana"/.test(m)));
  assert.ok(r.arch, 'info/warning do not block the arch');
});

test('missing required property and unknown property', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
      Sprocket: 7
  SubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
`);
  assert.ok(messages(errs(r)).some((m) => m === 'Missing required property "AvailabilityZone" for AWS::EC2::Subnet.'));
  assert.ok(messages(warns(r)).some((m) => m === 'Unknown property "Sprocket" for AWS::EC2::VPC.'));
});

test('!Ref to a missing id and to a wrong-kind resource', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  SubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Ghost
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
  SubnetB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref SubnetA
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: us-east-1b
`);
  assert.ok(messages(errs(r)).some((m) => m === '"Ghost" does not refer to a resource in this template.'));
  assert.ok(messages(errs(r)).some((m) => m === 'Expected a reference to a VPC, but "SubnetA" is a subnet.'));
});

test('a plain string where a !Ref is required is an error', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  SubnetA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
`);
  assert.ok(messages(errs(r)).some((m) => m === 'Expected a !Ref to a VPC.'));
});

test('unsupported intrinsics are errors', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: !Sub "10.0.0.0/16"
`);
  assert.ok(messages(errs(r)).some((m) => m === 'The !Sub intrinsic is not supported by this simulator.'));
});

test('AZ validation: format and a/b/c letter', () => {
  const bad = (az) => compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  S:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: ${az}
`);
  assert.ok(messages(errs(bad('banana'))).some((m) => /not an availability zone name/.test(m)));
  assert.ok(messages(errs(bad('us-east-1f'))).some((m) => /must end in a, b, or c/.test(m)));
  assert.deepEqual(errs(bad('eu-west-2b')), []);
});

test('route target: exactly one of GatewayId/NatGatewayId', () => {
  const base = `Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  Igw:
    Type: AWS::EC2::InternetGateway
  Rt:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
  R:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref Rt
      DestinationCidrBlock: 0.0.0.0/0
`;
  assert.ok(messages(errs(compile(base))).some((m) => /exactly one target/.test(m)));
  const both = compile(`${base}      GatewayId: !Ref Igw
      NatGatewayId: !Ref Igw
`);
  assert.ok(messages(errs(both)).some((m) => /exactly one target/.test(m)));
});

test('NAT AllocationId must be !GetAtt <eip>.AllocationId', () => {
  const make = (alloc) => compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  S:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
  Eip:
    Type: AWS::EC2::EIP
  Nat:
    Type: AWS::EC2::NatGateway
    Properties:
      SubnetId: !Ref S
      AllocationId: ${alloc}
`);
  assert.deepEqual(errs(make('!GetAtt Eip.AllocationId')), []);
  assert.ok(messages(errs(make('!Ref Eip'))).some((m) => /AllocationId must be !GetAtt/.test(m)));
  assert.ok(messages(errs(make('!GetAtt Eip.PublicIp'))).some((m) => /AllocationId must be !GetAtt/.test(m)));
});

test('second association for the same subnet is an error', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  S:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
  RtA:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
  RtB:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
  A1:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref S
      RouteTableId: !Ref RtA
  A2:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref S
      RouteTableId: !Ref RtB
`);
  assert.ok(messages(errs(r)).some((m) => /already has a route table association/.test(m)));
});

test('ingress rules: protocol, ports, exactly one source', () => {
  const make = (rule) => compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  Sg:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: web
      VpcId: !Ref Vpc
      SecurityGroupIngress:
${rule}
`);
  const ok = make('        - IpProtocol: tcp\n          FromPort: 80\n          ToPort: 80\n          CidrIp: 0.0.0.0/0');
  assert.deepEqual(errs(ok), []);
  assert.deepEqual(ok.arch.securityGroups[0].inbound,
    [{ proto: 'tcp', portFrom: 80, portTo: 80, source: '0.0.0.0/0' }]);
  const noSrc = make('        - IpProtocol: tcp\n          FromPort: 80\n          ToPort: 80');
  assert.ok(messages(errs(noSrc)).some((m) => /exactly one source/.test(m)));
  const noPorts = make('        - IpProtocol: tcp\n          CidrIp: 0.0.0.0/0');
  assert.ok(messages(errs(noPorts)).some((m) => /FromPort and ToPort/.test(m)));
  const allProto = make('        - IpProtocol: "-1"\n          CidrIp: 0.0.0.0/0');
  assert.deepEqual(errs(allProto), []);
  assert.deepEqual(allProto.arch.securityGroups[0].inbound,
    [{ proto: 'all', portFrom: 0, portTo: 65535, source: '0.0.0.0/0' }]);
});

test('happy path: a full public-web template compiles to the expected model', () => {
  const r = compile(`AWSTemplateFormatVersion: "2010-09-09"
Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  PublicSubnet:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
      MapPublicIpOnLaunch: true
      Tags:
        - Key: Name
          Value: public-a
  InternetGateway:
    Type: AWS::EC2::InternetGateway
  Attach:
    Type: AWS::EC2::VPCGatewayAttachment
    Properties:
      VpcId: !Ref Vpc
      InternetGatewayId: !Ref InternetGateway
  PublicRouteTable:
    Type: AWS::EC2::RouteTable
    Properties:
      VpcId: !Ref Vpc
      Tags:
        - Key: Name
          Value: public
  DefaultRoute:
    Type: AWS::EC2::Route
    Properties:
      RouteTableId: !Ref PublicRouteTable
      DestinationCidrBlock: 0.0.0.0/0
      GatewayId: !Ref InternetGateway
  Assoc:
    Type: AWS::EC2::SubnetRouteTableAssociation
    Properties:
      SubnetId: !Ref PublicSubnet
      RouteTableId: !Ref PublicRouteTable
  WebSg:
    Type: AWS::EC2::SecurityGroup
    Properties:
      GroupDescription: allow http
      VpcId: !Ref Vpc
      GroupName: web-sg
      SecurityGroupIngress:
        - IpProtocol: tcp
          FromPort: 80
          ToPort: 80
          CidrIp: 0.0.0.0/0
  Web1:
    Type: AWS::EC2::Instance
    Properties:
      ImageId: ami-123
      SubnetId: !Ref PublicSubnet
      SecurityGroupIds:
        - !Ref WebSg
      Tags:
        - Key: Name
          Value: web-1
        - Key: Role
          Value: web
`);
  assert.deepEqual(errs(r), []);
  const a = r.arch;
  assert.equal(a.vpc.igwAttached, true);
  assert.equal(a.subnets.length, 1);
  assert.equal(a.subnets[0].name, 'public-a');
  assert.equal(a.subnets[0].az, 'a');
  const rt = a.routeTables.find((t) => !t.isMain);
  assert.deepEqual(rt.routes, [{ destCidr: '0.0.0.0/0', target: 'igw' }]);
  assert.deepEqual(rt.subnetIds, [a.subnets[0].id]);
  const wl = a.workloads[0];
  assert.equal(wl.type, 'ec2');
  assert.equal(wl.role, 'web');
  assert.equal(wl.publicIp, true, 'MapPublicIpOnLaunch drives publicIp');
  assert.equal(wl.port, 80);
  assert.deepEqual(wl.sgIds, [a.securityGroups[0].id]);
  assert.equal(r.idMap.modelToLogical[wl.id], 'Web1');
  assert.equal(r.kinds.Web1, 'ec2');
  assert.ok(r.sourceMap.Web1.key[0] < r.sourceMap.Web1.key[1]);
  assert.ok(r.sourceMap.Web1.props.SubnetId);
});

test('ALB and RDS map scheme, engine port, multi-az, and Port tag', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  SubA:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.1.0/24
      AvailabilityZone: us-east-1a
  SubB:
    Type: AWS::EC2::Subnet
    Properties:
      VpcId: !Ref Vpc
      CidrBlock: 10.0.2.0/24
      AvailabilityZone: us-east-1b
  Alb:
    Type: AWS::ElasticLoadBalancingV2::LoadBalancer
    Properties:
      Subnets:
        - !Ref SubA
        - !Ref SubB
      Scheme: internet-facing
      Tags:
        - Key: Port
          Value: "443"
        - Key: Role
          Value: lb
  DbGroup:
    Type: AWS::RDS::DBSubnetGroup
    Properties:
      DBSubnetGroupDescription: db subnets
      SubnetIds:
        - !Ref SubA
        - !Ref SubB
  Db:
    Type: AWS::RDS::DBInstance
    Properties:
      Engine: mysql
      DBSubnetGroupName: !Ref DbGroup
      MultiAZ: true
`);
  assert.deepEqual(errs(r), []);
  const alb = r.arch.workloads.find((w) => w.type === 'alb');
  assert.equal(alb.publicIp, true);
  assert.equal(alb.port, 443);
  assert.equal(alb.role, 'lb');
  assert.equal(alb.subnetIds.length, 2);
  const db = r.arch.workloads.find((w) => w.type === 'rds');
  assert.equal(db.port, 3306, 'engine default port');
  assert.equal(db.multiAz, true);
  assert.equal(db.subnetIds.length, 2, 'subnets come from the DB subnet group');
});

test('duplicate logical ids are errors (yaml unique-key rule)', () => {
  const r = compile(`Resources:
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.0.0.0/16
  Vpc:
    Type: AWS::EC2::VPC
    Properties:
      CidrBlock: 10.1.0.0/16
`);
  assert.ok(errs(r).length > 0);
});

test('compile never throws on garbage', () => {
  for (const text of ['', ':', '\t', 'Resources: 3', 'Resources:\n  X: 4', '[1,2', 'a: *anchor']) {
    assert.doesNotThrow(() => compile(text), text);
  }
});
