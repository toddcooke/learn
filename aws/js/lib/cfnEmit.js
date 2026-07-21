// aws/js/lib/cfnEmit.js
//
// Serializes an arch model to canonical strict-CFN YAML. This is how the
// existing model-builder startState()/refSolution() functions (and legacy
// visual-builder drafts) enter the CFN-editor world without a data rewrite:
// the page emits them to text on demand. Emission is deterministic; the
// cfnEmit tests prove compile(emit(model)) is equivalent for every
// challenge fixture. Two normalizations are deliberate:
//  - Routes on the implicit main table become an explicit "MainRouteTable"
//    associated with every subnet that effectively used main — CFN cannot
//    address the real main table.
//  - EC2 publicIp becomes MapPublicIpOnLaunch on the hosting subnet (the
//    real-CFN mechanism); ALB publicIp becomes Scheme.

import { effectiveRouteTable } from './archModel.js';

const REGION = 'us-east-1';
const DEFAULT_WORKLOAD_PORTS = { ec2: 80, alb: 80, rds: 5432 };

function pascal(name) {
  const cleaned = String(name || '').replace(/[^a-zA-Z0-9]+/g, ' ').trim();
  const p = cleaned.split(' ').filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1)).join('');
  if (!p) return 'Resource';
  return /^[A-Za-z]/.test(p) ? p : `R${p}`;
}

function allocator() {
  const used = new Set();
  return (base) => {
    let id = base;
    let n = 2;
    while (used.has(id)) { id = `${base}${n}`; n += 1; }
    used.add(id);
    return id;
  };
}

export function emit(arch) {
  const lines = [];
  const out = (s) => lines.push(s);
  const nextId = allocator();

  out('AWSTemplateFormatVersion: "2010-09-09"');
  out('Description: Architecture Challenge design');
  out('Resources:');

  const vpcId = nextId('Vpc');
  out(`  ${vpcId}:`);
  out('    Type: AWS::EC2::VPC');
  out('    Properties:');
  out(`      CidrBlock: ${arch.vpc.cidr}`);

  // Real-CFN public IPs: mark the subnets that host a public EC2 instance.
  const publicIpSubnets = new Set();
  for (const wl of arch.workloads) {
    if (wl.type === 'ec2' && wl.publicIp) for (const sid of wl.subnetIds) publicIpSubnets.add(sid);
  }

  const subnetIds = {};
  for (const s of arch.subnets) {
    const lid = nextId(`${pascal(s.name)}Subnet`);
    subnetIds[s.id] = lid;
    out(`  ${lid}:`);
    out('    Type: AWS::EC2::Subnet');
    out('    Properties:');
    out(`      VpcId: !Ref ${vpcId}`);
    out(`      CidrBlock: ${s.cidr}`);
    out(`      AvailabilityZone: ${REGION}${s.az}`);
    if (publicIpSubnets.has(s.id)) out('      MapPublicIpOnLaunch: true');
    out('      Tags:');
    out('        - Key: Name');
    out(`          Value: ${s.name}`);
  }

  // The model can hold igw routes without an attached IGW (broken starts):
  // emit the gateway whenever anything needs to reference it, but the
  // attachment only when the model says attached.
  const needIgw = arch.vpc.igwAttached
    || arch.routeTables.some((rt) => rt.routes.some((r) => r.target === 'igw'));
  let igwId = null;
  if (needIgw) {
    igwId = nextId('InternetGateway');
    out(`  ${igwId}:`);
    out('    Type: AWS::EC2::InternetGateway');
    if (arch.vpc.igwAttached) {
      const attachId = nextId('VpcGatewayAttachment');
      out(`  ${attachId}:`);
      out('    Type: AWS::EC2::VPCGatewayAttachment');
      out('    Properties:');
      out(`      VpcId: !Ref ${vpcId}`);
      out(`      InternetGatewayId: !Ref ${igwId}`);
    }
  }

  const natIds = {};
  arch.natGateways.forEach((nat, i) => {
    if (!subnetIds[nat.subnetId]) return; // dangling NAT: nothing to anchor it to
    const eipId = nextId(`NatEip${i + 1}`);
    const natId = nextId(`NatGateway${i + 1}`);
    natIds[nat.id] = natId;
    out(`  ${eipId}:`);
    out('    Type: AWS::EC2::EIP');
    out('    Properties:');
    out('      Domain: vpc');
    out(`  ${natId}:`);
    out('    Type: AWS::EC2::NatGateway');
    out('    Properties:');
    out(`      SubnetId: !Ref ${subnetIds[nat.subnetId]}`);
    out(`      AllocationId: !GetAtt ${eipId}.AllocationId`);
  });

  const routeTargetLine = (target) => (target === 'igw'
    ? `      GatewayId: !Ref ${igwId}`
    : `      NatGatewayId: !Ref ${natIds[target.slice(4)]}`);
  const emitTable = (lid, name, routes, subnetModelIds) => {
    out(`  ${lid}:`);
    out('    Type: AWS::EC2::RouteTable');
    out('    Properties:');
    out(`      VpcId: !Ref ${vpcId}`);
    out('      Tags:');
    out('        - Key: Name');
    out(`          Value: ${name}`);
    routes.forEach((route, i) => {
      if (route.target !== 'igw' && !natIds[route.target.slice(4)]) return; // dangling NAT route
      const rid = nextId(`${lid}Route${i + 1}`);
      out(`  ${rid}:`);
      out('    Type: AWS::EC2::Route');
      out('    Properties:');
      out(`      RouteTableId: !Ref ${lid}`);
      out(`      DestinationCidrBlock: ${route.destCidr}`);
      out(routeTargetLine(route.target));
    });
    for (const sid of subnetModelIds) {
      if (!subnetIds[sid]) continue;
      const aid = nextId(`${subnetIds[sid]}Association`);
      out(`  ${aid}:`);
      out('    Type: AWS::EC2::SubnetRouteTableAssociation');
      out('    Properties:');
      out(`      SubnetId: !Ref ${subnetIds[sid]}`);
      out(`      RouteTableId: !Ref ${lid}`);
    }
  };

  for (const rt of arch.routeTables.filter((t) => !t.isMain)) {
    emitTable(nextId(`${pascal(rt.name)}RouteTable`), rt.name, rt.routes, rt.subnetIds);
  }
  const main = arch.routeTables.find((t) => t.isMain);
  if (main && main.routes.length > 0) {
    const users = arch.subnets.filter((s) => effectiveRouteTable(arch, s.id) === main).map((s) => s.id);
    emitTable(nextId('MainRouteTable'), 'main', main.routes, users);
  }

  // SG logical ids are allocated before bodies so rules can reference any
  // group (forward refs are legal in CFN).
  const sgIds = {};
  for (const sg of arch.securityGroups) sgIds[sg.id] = nextId(pascal(sg.name));
  for (const sg of arch.securityGroups) {
    out(`  ${sgIds[sg.id]}:`);
    out('    Type: AWS::EC2::SecurityGroup');
    out('    Properties:');
    out(`      GroupDescription: ${sg.name}`);
    out(`      VpcId: !Ref ${vpcId}`);
    out(`      GroupName: ${sg.name}`);
    if (sg.inbound.length > 0) {
      out('      SecurityGroupIngress:');
      for (const r of sg.inbound) {
        const proto = r.proto === 'all' ? '"-1"' : (r.proto || 'tcp');
        out(`        - IpProtocol: ${proto}`);
        if (r.proto !== 'all' && r.proto !== 'icmp') {
          out(`          FromPort: ${r.portFrom}`);
          out(`          ToPort: ${r.portTo}`);
        }
        if (typeof r.source === 'string' && r.source.startsWith('sg:')) {
          out(`          SourceSecurityGroupId: !Ref ${sgIds[r.source.slice(3)]}`);
        } else {
          out(`          CidrIp: ${r.source}`);
        }
      }
    }
  }

  const emitTags = (wl, portAsTag) => {
    out('      Tags:');
    out('        - Key: Name');
    out(`          Value: ${wl.name}`);
    if (wl.role) {
      out('        - Key: Role');
      out(`          Value: ${wl.role}`);
    }
    if (portAsTag && wl.port !== undefined && wl.port !== DEFAULT_WORKLOAD_PORTS[wl.type]) {
      out('        - Key: Port');
      out(`          Value: "${wl.port}"`);
    }
  };
  const emitRefList = (label, ids, table) => {
    if (ids.length === 0) return;
    out(`      ${label}:`);
    for (const id of ids) if (table[id]) out(`        - !Ref ${table[id]}`);
  };

  for (const wl of arch.workloads) {
    const lid = nextId(pascal(wl.name));
    if (wl.type === 'ec2') {
      out(`  ${lid}:`);
      out('    Type: AWS::EC2::Instance');
      out('    Properties:');
      out('      ImageId: ami-0c02fb55956c7d316');
      if (wl.subnetIds[0] && subnetIds[wl.subnetIds[0]]) out(`      SubnetId: !Ref ${subnetIds[wl.subnetIds[0]]}`);
      emitRefList('SecurityGroupIds', wl.sgIds, sgIds);
      emitTags(wl, true);
    } else if (wl.type === 'alb') {
      out(`  ${lid}:`);
      out('    Type: AWS::ElasticLoadBalancingV2::LoadBalancer');
      out('    Properties:');
      out('      Type: application');
      out(`      Scheme: ${wl.publicIp ? 'internet-facing' : 'internal'}`);
      emitRefList('Subnets', wl.subnetIds, subnetIds);
      emitRefList('SecurityGroups', wl.sgIds, sgIds);
      emitTags(wl, true);
    } else { // rds
      const groupId = nextId(`${lid}SubnetGroup`);
      out(`  ${groupId}:`);
      out('    Type: AWS::RDS::DBSubnetGroup');
      out('    Properties:');
      out(`      DBSubnetGroupDescription: Subnets for ${wl.name}`);
      emitRefList('SubnetIds', wl.subnetIds, subnetIds);
      out(`  ${lid}:`);
      out('    Type: AWS::RDS::DBInstance');
      out('    Properties:');
      out('      Engine: postgres');
      out(`      DBSubnetGroupName: !Ref ${groupId}`);
      emitRefList('VPCSecurityGroups', wl.sgIds, sgIds);
      if (wl.multiAz) out('      MultiAZ: true');
      if (wl.port !== undefined && wl.port !== 5432) out(`      Port: ${wl.port}`);
      emitTags(wl, false);
    }
  }

  return `${lines.join('\n')}\n`;
}
