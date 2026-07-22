import test from 'node:test';
import assert from 'node:assert/strict';
import {
  graphToArch, archToGraph, createGraph, pascal,
  layoutGraph, laneForX, laneX, CANVAS,
} from './archGraph.js';
import { createArch, getSubnet, getSecurityGroup, effectiveRouteTable } from './archModel.js';
import { validateStructure } from './archValidate.js';
import { evaluateGoals } from './archGoals.js';
import { ARCH_CHALLENGES } from '../data/archChallenges.js';

// Normalized, id-free projection so graph round-trips can be compared
// across renamed resources. Names are pascal-normalized because the graph
// side names things by PascalCase logical id ('web-sg' becomes 'WebSg').
function fingerprint(arch) {
  const subnetName = (id) => pascal(getSubnet(arch, id)?.name || '?');
  const sgName = (id) => pascal(getSecurityGroup(arch, id)?.name || '?');
  const natSubnet = (natId) => {
    const nat = arch.natGateways.find((n) => n.id === natId);
    return nat ? subnetName(nat.subnetId) : '?';
  };
  const routeKey = (r) => (r.target === 'igw' ? `${r.destCidr}→igw` : `${r.destCidr}→nat@${natSubnet(r.target.slice(4))}`);
  const sourceKey = (s) => (s.startsWith('sg:') ? `sg:${sgName(s.slice(3))}` : s);
  return {
    vpc: { cidr: arch.vpc.cidr, igwAttached: arch.vpc.igwAttached },
    subnets: arch.subnets.map((s) => ({ name: pascal(s.name), az: s.az, cidr: s.cidr }))
      .sort((a, b) => a.name.localeCompare(b.name)),
    nats: arch.natGateways.map((n) => subnetName(n.subnetId)).sort(),
    routing: arch.subnets.map((s) => ({
      subnet: pascal(s.name),
      routes: (effectiveRouteTable(arch, s.id)?.routes || []).map(routeKey).sort(),
    })).sort((a, b) => a.subnet.localeCompare(b.subnet)),
    sgs: arch.securityGroups.map((g) => ({
      name: pascal(g.name),
      rules: g.inbound.map((r) => `${r.proto}:${r.portFrom}-${r.portTo}<${sourceKey(r.source)}`).sort(),
    })).sort((a, b) => a.name.localeCompare(b.name)),
    workloads: arch.workloads.map((w) => ({
      type: w.type,
      name: pascal(w.name),
      role: w.role,
      port: w.port,
      publicIp: w.publicIp,
      multiAz: !!w.multiAz,
      subnets: w.subnetIds.map(subnetName).sort(),
      sgs: w.sgIds.map(sgName).sort(),
    })).sort((a, b) => a.name.localeCompare(b.name)),
  };
}

test('archToGraph(createArch()) is a clean VPC-only graph', () => {
  const { arch, problems } = graphToArch(archToGraph(createArch()));
  assert.deepEqual(problems, []);
  assert.equal(arch.vpc.cidr, '10.0.0.0/16');
  assert.equal(arch.vpc.igwAttached, false);
});

for (const ch of ARCH_CHALLENGES) {
  test(`round-trip: ${ch.id} start state and reference solution survive archToGraph→graphToArch`, () => {
    for (const build of [ch.startState, ch.refSolution].filter(Boolean)) {
      const model = build();
      const { arch, problems } = graphToArch(archToGraph(model));
      assert.deepEqual(problems, [], ch.id);
      assert.deepEqual(fingerprint(arch), fingerprint(model));
    }
  });
  if (ch.refSolution && ch.goals.length > 0) {
    test(`converted reference solution passes its own goals: ${ch.id}`, () => {
      const { arch } = graphToArch(archToGraph(ch.refSolution()));
      assert.deepEqual(validateStructure(arch).errors, []);
      for (const row of evaluateGoals(arch, ch)) {
        assert.ok(row.ok, `${ch.id}: ${row.label} — ${row.detail}`);
      }
    });
  }
}

test('routes on the implicit main table materialize as an explicit table', () => {
  const model = ARCH_CHALLENGES.find((c) => c.id === 'private-egress').refSolution();
  const graph = archToGraph(model);
  assert.ok(graph.resources.some((r) => r.id === 'MainRouteTable'));
  const { arch } = graphToArch(graph);
  assert.deepEqual(arch.routeTables.find((t) => t.isMain).routes, []);
  const priv = arch.subnets.find((s) => s.name === 'PrivateA');
  const rt = effectiveRouteTable(arch, priv.id);
  assert.equal(rt.isMain, false);
  assert.match(rt.routes[0].target, /^nat:/);
});

test('problems: empty graph, missing required props, duplicate association', () => {
  const empty = graphToArch(createGraph());
  assert.ok(empty.problems.some((p) => /Add an AWS::EC2::VPC/.test(p.message)));

  const g = {
    resources: [
      { id: 'Vpc', type: 'AWS::EC2::VPC', props: {} },
      { id: 'S', type: 'AWS::EC2::Subnet', props: { VpcId: 'Vpc', CidrBlock: '10.0.1.0/24', AvailabilityZone: 'us-east-1a' } },
      { id: 'Rt', type: 'AWS::EC2::RouteTable', props: { VpcId: 'Vpc' } },
      { id: 'A1', type: 'AWS::EC2::SubnetRouteTableAssociation', props: { SubnetId: 'S', RouteTableId: 'Rt' } },
      { id: 'A2', type: 'AWS::EC2::SubnetRouteTableAssociation', props: { SubnetId: 'S', RouteTableId: 'Rt' } },
    ],
  };
  const { problems } = graphToArch(g);
  assert.ok(problems.some((p) => p.id === 'Vpc' && /CidrBlock is required/.test(p.message)));
  assert.ok(problems.some((p) => p.id === 'A2' && /exactly one/.test(p.message)));
});

test('problems: route with both or neither targets; dangling ref degrades gracefully', () => {
  const base = (routeProps) => ({
    resources: [
      { id: 'Vpc', type: 'AWS::EC2::VPC', props: { CidrBlock: '10.0.0.0/16' } },
      { id: 'Igw', type: 'AWS::EC2::InternetGateway', props: {} },
      { id: 'Rt', type: 'AWS::EC2::RouteTable', props: { VpcId: 'Vpc' } },
      { id: 'R', type: 'AWS::EC2::Route', props: { RouteTableId: 'Rt', DestinationCidrBlock: '0.0.0.0/0', ...routeProps } },
    ],
  });
  const both = graphToArch(base({ GatewayId: 'Igw', NatGatewayId: 'Igw' }));
  assert.ok(both.problems.some((p) => p.id === 'R' && /not both/.test(p.message)));
  const neither = graphToArch(base({}));
  assert.ok(neither.problems.some((p) => p.id === 'R' && /Pick a target/.test(p.message)));
  const dangling = graphToArch(base({ GatewayId: 'Ghost' }));
  assert.ok(dangling.problems.some((p) => p.id === 'R'));
  assert.equal(dangling.arch.routeTables.find((t) => !t.isMain).routes.length, 0);
});

test('ingress rules map protocols and sources; -1 becomes all', () => {
  const g = {
    resources: [
      { id: 'Vpc', type: 'AWS::EC2::VPC', props: { CidrBlock: '10.0.0.0/16' } },
      {
        id: 'WebSg',
        type: 'AWS::EC2::SecurityGroup',
        props: {
          GroupDescription: 'web',
          VpcId: 'Vpc',
          SecurityGroupIngress: [
            { IpProtocol: 'tcp', FromPort: 443, ToPort: 443, CidrIp: '0.0.0.0/0' },
            { IpProtocol: '-1', CidrIp: '10.0.0.0/16' },
            { IpProtocol: 'tcp', FromPort: 5432, ToPort: 5432, SourceSecurityGroupId: 'WebSg' },
          ],
        },
      },
    ],
  };
  const { arch, problems } = graphToArch(g);
  assert.deepEqual(problems, []);
  const sg = arch.securityGroups[0];
  assert.deepEqual(sg.inbound[0], { proto: 'tcp', portFrom: 443, portTo: 443, source: '0.0.0.0/0' });
  assert.deepEqual(sg.inbound[1], { proto: 'all', portFrom: 0, portTo: 65535, source: '10.0.0.0/16' });
  assert.equal(sg.inbound[2].source, `sg:${sg.id}`);
});

test('MapPublicIpOnLaunch drives EC2 publicIp; Scheme drives ALB publicIp', () => {
  const g = {
    resources: [
      { id: 'Vpc', type: 'AWS::EC2::VPC', props: { CidrBlock: '10.0.0.0/16' } },
      { id: 'Pub', type: 'AWS::EC2::Subnet', props: { VpcId: 'Vpc', CidrBlock: '10.0.1.0/24', AvailabilityZone: 'us-east-1a', MapPublicIpOnLaunch: true } },
      { id: 'Priv', type: 'AWS::EC2::Subnet', props: { VpcId: 'Vpc', CidrBlock: '10.0.2.0/24', AvailabilityZone: 'us-east-1b' } },
      { id: 'Web', type: 'AWS::EC2::Instance', props: { ImageId: 'ami-1', SubnetId: 'Pub', SecurityGroupIds: [], RoleTag: 'web', PortTag: 443 } },
      { id: 'App', type: 'AWS::EC2::Instance', props: { ImageId: 'ami-1', SubnetId: 'Priv', SecurityGroupIds: [] } },
      { id: 'Lb', type: 'AWS::ElasticLoadBalancingV2::LoadBalancer', props: { Subnets: ['Pub', 'Priv'], SecurityGroups: [], Scheme: 'internal' } },
    ],
  };
  const { arch, problems } = graphToArch(g);
  assert.deepEqual(problems, []);
  const web = arch.workloads.find((w) => w.name === 'Web');
  assert.equal(web.publicIp, true);
  assert.equal(web.port, 443);
  assert.equal(web.role, 'web');
  assert.equal(arch.workloads.find((w) => w.name === 'App').publicIp, false);
  assert.equal(arch.workloads.find((w) => w.name === 'Lb').publicIp, false);
});

test('RDS engine default ports and DBSubnetGroup wiring', () => {
  const g = {
    resources: [
      { id: 'Vpc', type: 'AWS::EC2::VPC', props: { CidrBlock: '10.0.0.0/16' } },
      { id: 'A', type: 'AWS::EC2::Subnet', props: { VpcId: 'Vpc', CidrBlock: '10.0.1.0/24', AvailabilityZone: 'us-east-1a' } },
      { id: 'B', type: 'AWS::EC2::Subnet', props: { VpcId: 'Vpc', CidrBlock: '10.0.2.0/24', AvailabilityZone: 'us-east-1b' } },
      { id: 'Grp', type: 'AWS::RDS::DBSubnetGroup', props: { DBSubnetGroupDescription: 'db', SubnetIds: ['A', 'B'] } },
      { id: 'Db', type: 'AWS::RDS::DBInstance', props: { Engine: 'mysql', DBSubnetGroupName: 'Grp', VPCSecurityGroups: [], MultiAZ: true } },
    ],
  };
  const { arch, problems } = graphToArch(g);
  assert.deepEqual(problems, []);
  const db = arch.workloads[0];
  assert.equal(db.port, 3306);
  assert.equal(db.multiAz, true);
  assert.equal(db.subnetIds.length, 2);
});

test('graphToArch is total on malformed input', () => {
  for (const bad of [null, {}, { resources: null }, { resources: [{}, { id: 1 }, { id: 'X', type: 'Nope' }] }]) {
    assert.doesNotThrow(() => graphToArch(bad));
  }
});

test('ports are range-validated: ingress rules and the RDS Port property', () => {
  const g = {
    resources: [
      { id: 'Vpc', type: 'AWS::EC2::VPC', props: { CidrBlock: '10.0.0.0/16' } },
      { id: 'A', type: 'AWS::EC2::Subnet', props: { VpcId: 'Vpc', CidrBlock: '10.0.1.0/24', AvailabilityZone: 'us-east-1a' } },
      { id: 'B', type: 'AWS::EC2::Subnet', props: { VpcId: 'Vpc', CidrBlock: '10.0.2.0/24', AvailabilityZone: 'us-east-1b' } },
      {
        id: 'Sg',
        type: 'AWS::EC2::SecurityGroup',
        props: {
          GroupDescription: 'x',
          VpcId: 'Vpc',
          SecurityGroupIngress: [{ IpProtocol: 'tcp', FromPort: -1, ToPort: 100000, CidrIp: '0.0.0.0/0' }],
        },
      },
      { id: 'Grp', type: 'AWS::RDS::DBSubnetGroup', props: { DBSubnetGroupDescription: 'db', SubnetIds: ['A', 'B'] } },
      { id: 'Db', type: 'AWS::RDS::DBInstance', props: { Engine: 'postgres', DBSubnetGroupName: 'Grp', Port: 99999999 } },
    ],
  };
  const { arch, problems } = graphToArch(g);
  assert.ok(problems.some((p) => p.id === 'Sg' && /FromPort "-1" is not a valid port/.test(p.message)));
  assert.equal(arch.securityGroups[0].inbound.length, 0, 'out-of-range rule is not stored');
  assert.ok(problems.some((p) => p.id === 'Db' && /Port "99999999" is not a valid port/.test(p.message)));
  assert.equal(arch.workloads[0].port, 5432, 'invalid Port falls back to the engine default');
});

test('an empty required ref list reads as missing', () => {
  const g = {
    resources: [
      { id: 'Vpc', type: 'AWS::EC2::VPC', props: { CidrBlock: '10.0.0.0/16' } },
      { id: 'Lb', type: 'AWS::ElasticLoadBalancingV2::LoadBalancer', props: { Subnets: [], SecurityGroups: [] } },
    ],
  };
  const { problems } = graphToArch(g);
  assert.ok(problems.some((p) => p.id === 'Lb' && /Subnets is required/.test(p.message)));
  assert.ok(!problems.some((p) => /SecurityGroups/.test(p.message)), 'optional empty lists stay silent');
});

test('layoutGraph places subnets in their AZ lane and members beneath their subnet', () => {
  const model = ARCH_CHALLENGES.find((c) => c.id === 'ha-web').refSolution();
  const graph = layoutGraph(archToGraph(model));
  for (const r of graph.resources) {
    assert.ok(r.pos && Number.isFinite(r.pos.x) && Number.isFinite(r.pos.y), `${r.id} has pos`);
  }
  const byId = (id) => graph.resources.find((r) => r.id === id);
  for (const r of graph.resources.filter((x) => x.type === 'AWS::EC2::Subnet')) {
    const az = String(r.props.AvailabilityZone).slice(-1);
    assert.equal(laneForX(r.pos.x + CANVAS.cardWidth / 2), az, `${r.id} sits in lane ${az}`);
  }
  const web1 = byId('Web1');
  const homeLane = laneForX(byId(web1.props.SubnetId).pos.x + CANVAS.cardWidth / 2);
  assert.equal(laneForX(web1.pos.x + CANVAS.cardWidth / 2), homeLane, 'instance shares its subnet lane');
  // Stacked cards in one column never overlap vertically.
  const columns = new Map();
  for (const r of graph.resources) {
    const lane = laneForX(r.pos.x + CANVAS.cardWidth / 2) || 'global';
    if (!columns.has(lane)) columns.set(lane, []);
    columns.get(lane).push(r);
  }
  for (const cards of columns.values()) {
    const sorted = [...cards].sort((a, b) => a.pos.y - b.pos.y);
    for (let i = 1; i < sorted.length; i += 1) {
      assert.ok(sorted[i].pos.y >= sorted[i - 1].pos.y, 'stacking is ordered');
    }
  }
  assert.equal(laneForX(laneX('b') + 10), 'b');
  assert.equal(laneForX(CANVAS.globalX + 10), null);
});

test('layoutGraph leaves existing positions alone', () => {
  const graph = { resources: [{ id: 'Vpc', type: 'AWS::EC2::VPC', props: { CidrBlock: '10.0.0.0/16' }, pos: { x: 500, y: 300 } }] };
  layoutGraph(graph);
  assert.deepEqual(graph.resources[0].pos, { x: 500, y: 300 });
});

test('archToGraph tolerates legacy drafts that pass the shallow storage gate', () => {
  // storage.getArchDraft only checks the five top-level arrays; inner
  // elements from older draft eras can be missing fields entirely.
  const legacy = {
    vpc: { cidr: '10.0.0.0/16', igwAttached: true },
    subnets: [{ id: 'subnet-1', name: 'pub', az: 'a', cidr: '10.0.1.0/24' }, null, 'junk'],
    natGateways: [{}],
    routeTables: [{ id: 'rtb-main', isMain: true, routes: [{ destCidr: '0.0.0.0/0' }] }],
    securityGroups: [{ id: 'sg-1' }],
    workloads: [{ id: 'wl-1', type: 'ec2', name: 'web' }],
  };
  let graph;
  assert.doesNotThrow(() => { graph = archToGraph(legacy); });
  assert.ok(graph.resources.some((r) => r.type === 'AWS::EC2::VPC'));
  assert.ok(graph.resources.some((r) => r.id === 'Web' && r.type === 'AWS::EC2::Instance'));
  assert.doesNotThrow(() => graphToArch(graph));
});
