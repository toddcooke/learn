// aws/js/lib/archGraph.js
//
// Two-way bridge between the CloudFormation-shaped resource graph the form
// builder edits and the arch model the validators/goals engines consume.
// The graph is plain JSON: { resources: [{ id, type, props }] } in card
// order; ref props hold logical ids (dropdowns author them, so they are
// normally valid — every read here is still defensive), refList props hold
// id arrays, SecurityGroupIngress holds CFN-shaped rule objects, and
// RoleTag/PortTag are the form's sugar for what the CFN editor expressed
// as tags. graphToArch is TOTAL: it always returns an arch plus per-card
// problems (missing required props, dangling refs, both/neither route
// targets, duplicate associations, VPC count) instead of ever throwing.
// archToGraph carries the strict-CFN normalizations the old emitter had:
// IGW + attachment pair, an EIP per NAT, main-table routes materialized as
// an explicit table, MapPublicIpOnLaunch derived from public EC2s.

import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload, effectiveRouteTable,
} from './archModel.js';
import { RESOURCE_TYPES, ENGINE_DEFAULT_PORTS } from './cfnSchema.js';

export const DEFAULT_IMAGE_ID = 'ami-0c02fb55956c7d316';
export const AZ_PREFIX = 'us-east-1';

// 'web-sg' -> 'WebSg'; idempotent on PascalCase ids.
export function pascal(name) {
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

export function createGraph() {
  return { resources: [] };
}

// ---------------------------------------------------------------------------
// graph -> arch
// ---------------------------------------------------------------------------

const kindOf = (type) => {
  const spec = RESOURCE_TYPES[type];
  return spec ? spec.kind : null;
};

export function graphToArch(graph) {
  const problems = [];
  const problem = (id, message) => problems.push({ id, message });
  const arch = createArch();
  const resources = Array.isArray(graph?.resources)
    ? graph.resources.filter((r) => r && typeof r.id === 'string' && RESOURCE_TYPES[r.type])
    : [];
  const byKind = (k) => resources.filter((r) => kindOf(r.type) === k);
  const kinds = {};
  for (const r of resources) kinds[r.id] = kindOf(r.type);
  const logicalToModel = {};

  // Empty arrays count as absent so required ref-lists (ALB Subnets,
  // DBSubnetGroup SubnetIds) get the same immediate "is required" card
  // feedback as every other required prop — new cards prefill them as [].
  const p = (r, name) => {
    const v = r.props ? r.props[name] : undefined;
    if (v === undefined || v === null || v === '') return undefined;
    if (Array.isArray(v) && v.length === 0) return undefined;
    return v;
  };
  const validPort = (rid, label, v) => {
    const n = Number(v);
    if (!Number.isInteger(n) || n < 0 || n > 65535) {
      problem(rid, `${label} "${v}" is not a valid port (0–65535).`);
      return undefined;
    }
    return n;
  };
  // A ref is usable when it names a live resource of the expected kind;
  // renames cascade and deletes clear refs, but a hand-edited draft (or a
  // bug) must degrade to a problem, not a crash.
  const ref = (r, name, expectedKind) => {
    const target = p(r, name);
    if (target === undefined) return undefined;
    if (kinds[target] !== expectedKind) {
      problem(r.id, `${name}: "${target}" is not an existing ${expectedKind === 'igw' ? 'internet gateway' : expectedKind} resource.`);
      return undefined;
    }
    return target;
  };
  const requireProps = (r, names) => {
    let ok = true;
    for (const name of names) {
      if (p(r, name) === undefined) {
        problem(r.id, `${name} is required.`);
        ok = false;
      }
    }
    return ok;
  };

  // --- VPC (exactly one) ---
  const vpcs = byKind('vpc');
  if (vpcs.length === 0) problem(null, 'Add an AWS::EC2::VPC resource — everything else lives inside it.');
  for (const extra of vpcs.slice(1)) problem(extra.id, 'Only one VPC is supported; this one is ignored.');
  const vpcRes = vpcs[0];
  if (vpcRes) {
    requireProps(vpcRes, ['CidrBlock']);
    arch.vpc.cidr = String(p(vpcRes, 'CidrBlock') ?? '');
    logicalToModel[vpcRes.id] = 'vpc';
  }

  // --- Subnets ---
  const subnetPublicIp = new Map();
  for (const r of byKind('subnet')) {
    requireProps(r, ['VpcId', 'CidrBlock', 'AvailabilityZone']);
    ref(r, 'VpcId', 'vpc');
    const azRaw = String(p(r, 'AvailabilityZone') ?? `${AZ_PREFIX}a`);
    let az = azRaw.slice(-1);
    if (!['a', 'b', 'c'].includes(az)) {
      problem(r.id, `AvailabilityZone must end in a, b, or c (got "${azRaw}").`);
      az = 'a';
    }
    const subnet = addSubnet(arch, { name: r.id, az, cidr: String(p(r, 'CidrBlock') ?? '') });
    subnetPublicIp.set(subnet.id, p(r, 'MapPublicIpOnLaunch') === true);
    logicalToModel[r.id] = subnet.id;
  }

  // --- IGW + attachment ---
  const igws = byKind('igw');
  for (const extra of igws.slice(1)) problem(extra.id, 'Only one internet gateway is supported; this one is ignored.');
  for (const r of byKind('igwAttachment')) {
    if (!requireProps(r, ['VpcId', 'InternetGatewayId'])) continue;
    const vpcOk = ref(r, 'VpcId', 'vpc');
    const igwOk = ref(r, 'InternetGatewayId', 'igw');
    if (vpcOk && igwOk) arch.vpc.igwAttached = true;
  }

  // --- NAT gateways (AllocationId must name an EIP resource) ---
  for (const r of byKind('nat')) {
    requireProps(r, ['SubnetId', 'AllocationId']);
    ref(r, 'AllocationId', 'eip');
    const subnetLogical = ref(r, 'SubnetId', 'subnet');
    const nat = addNat(arch, subnetLogical ? logicalToModel[subnetLogical] : null);
    logicalToModel[r.id] = nat.id;
  }

  // --- Route tables, routes, associations ---
  for (const r of byKind('rtb')) {
    requireProps(r, ['VpcId']);
    ref(r, 'VpcId', 'vpc');
    const rt = addRouteTable(arch, r.id);
    logicalToModel[r.id] = rt.id;
  }
  for (const r of byKind('route')) {
    requireProps(r, ['RouteTableId', 'DestinationCidrBlock']);
    const rtbLogical = ref(r, 'RouteTableId', 'rtb');
    const gw = ref(r, 'GatewayId', 'igw');
    const nat = ref(r, 'NatGatewayId', 'nat');
    if (p(r, 'GatewayId') !== undefined && p(r, 'NatGatewayId') !== undefined) {
      problem(r.id, 'A route takes exactly one target — GatewayId or NatGatewayId, not both.');
      continue;
    }
    if (gw === undefined && nat === undefined) {
      problem(r.id, 'Pick a target: GatewayId (internet gateway) or NatGatewayId.');
      continue;
    }
    const dest = p(r, 'DestinationCidrBlock');
    if (rtbLogical && dest !== undefined) {
      addRoute(arch, logicalToModel[rtbLogical], {
        destCidr: String(dest),
        target: gw !== undefined ? 'igw' : `nat:${logicalToModel[nat]}`,
      });
    }
  }
  const associated = new Set();
  for (const r of byKind('assoc')) {
    if (!requireProps(r, ['SubnetId', 'RouteTableId'])) continue;
    const subnetLogical = ref(r, 'SubnetId', 'subnet');
    const rtbLogical = ref(r, 'RouteTableId', 'rtb');
    if (!subnetLogical || !rtbLogical) continue;
    if (associated.has(subnetLogical)) {
      problem(r.id, `"${subnetLogical}" already has a route table association; AWS allows exactly one.`);
      continue;
    }
    associated.add(subnetLogical);
    associateSubnet(arch, logicalToModel[rtbLogical], logicalToModel[subnetLogical]);
  }

  // --- Security groups (rules resolve after every SG exists) ---
  for (const r of byKind('sg')) {
    requireProps(r, ['GroupDescription', 'VpcId']);
    ref(r, 'VpcId', 'vpc');
    const sg = addSecurityGroup(arch, r.id);
    logicalToModel[r.id] = sg.id;
  }
  for (const r of byKind('sg')) {
    const rules = Array.isArray(p(r, 'SecurityGroupIngress')) ? r.props.SecurityGroupIngress : [];
    rules.forEach((rule, i) => {
      if (!rule || typeof rule !== 'object') return;
      const proto = String(rule.IpProtocol ?? 'tcp');
      let portFrom = 0;
      let portTo = 65535;
      if (proto === 'tcp' || proto === 'udp') {
        if (rule.FromPort === undefined || rule.ToPort === undefined) {
          problem(r.id, `Ingress rule ${i + 1}: tcp/udp rules need FromPort and ToPort.`);
          return;
        }
        // Out-of-range ports would silently poison ruleCoversPort-based
        // best-practice checks (-1..100000 "covers" SSH), so reject here.
        portFrom = validPort(r.id, `Ingress rule ${i + 1} FromPort`, rule.FromPort);
        portTo = validPort(r.id, `Ingress rule ${i + 1} ToPort`, rule.ToPort);
        if (portFrom === undefined || portTo === undefined) return;
      }
      let source;
      if (rule.SourceSecurityGroupId !== undefined && rule.SourceSecurityGroupId !== '') {
        if (kinds[rule.SourceSecurityGroupId] !== 'sg') {
          problem(r.id, `Ingress rule ${i + 1}: source security group "${rule.SourceSecurityGroupId}" no longer exists.`);
          return;
        }
        source = `sg:${logicalToModel[rule.SourceSecurityGroupId]}`;
      } else if (rule.CidrIp !== undefined && rule.CidrIp !== '') {
        source = String(rule.CidrIp);
      } else {
        problem(r.id, `Ingress rule ${i + 1}: pick a source (CidrIp or a security group).`);
        return;
      }
      addSgRule(arch, logicalToModel[r.id], {
        proto: proto === '-1' ? 'all' : proto, portFrom, portTo, source,
      });
    });
  }

  // --- DB subnet groups (recorded for DBInstance lookups) ---
  const dbGroupSubnets = {};
  for (const r of byKind('dbsubnetgroup')) {
    requireProps(r, ['DBSubnetGroupDescription', 'SubnetIds']);
    const ids = Array.isArray(p(r, 'SubnetIds')) ? r.props.SubnetIds : [];
    dbGroupSubnets[r.id] = ids.filter((sid) => kinds[sid] === 'subnet').map((sid) => logicalToModel[sid]);
    if (ids.length && dbGroupSubnets[r.id].length !== ids.length) {
      problem(r.id, 'SubnetIds references a subnet that no longer exists.');
    }
  }

  // --- Workloads ---
  const refList = (r, name) => (Array.isArray(p(r, name)) ? r.props[name] : [])
    .filter((sid) => kinds[sid] === 'sg').map((sid) => logicalToModel[sid]);
  const portTag = (r) => {
    const v = p(r, 'PortTag');
    return v === undefined ? undefined : validPort(r.id, 'Port tag', v);
  };
  for (const r of resources.filter((x) => kindOf(x.type) === 'workload')) {
    const workloadType = RESOURCE_TYPES[r.type].workloadType;
    const role = p(r, 'RoleTag') !== undefined ? String(p(r, 'RoleTag')) : null;
    if (workloadType === 'ec2') {
      requireProps(r, ['ImageId', 'SubnetId']);
      const subnetLogical = ref(r, 'SubnetId', 'subnet');
      const modelSubnet = subnetLogical ? logicalToModel[subnetLogical] : null;
      const wl = addWorkload(arch, {
        type: 'ec2', name: r.id, role,
        subnetIds: modelSubnet ? [modelSubnet] : [],
        sgIds: refList(r, 'SecurityGroupIds'),
        publicIp: modelSubnet ? subnetPublicIp.get(modelSubnet) === true : false,
        port: portTag(r),
      });
      logicalToModel[r.id] = wl.id;
    } else if (workloadType === 'alb') {
      requireProps(r, ['Subnets']);
      const subnets = (Array.isArray(p(r, 'Subnets')) ? r.props.Subnets : [])
        .filter((sid) => kinds[sid] === 'subnet').map((sid) => logicalToModel[sid]);
      const wl = addWorkload(arch, {
        type: 'alb', name: r.id, role,
        subnetIds: subnets,
        sgIds: refList(r, 'SecurityGroups'),
        publicIp: p(r, 'Scheme') !== 'internal',
        port: portTag(r),
      });
      logicalToModel[r.id] = wl.id;
    } else {
      requireProps(r, ['Engine', 'DBSubnetGroupName']);
      const groupLogical = ref(r, 'DBSubnetGroupName', 'dbsubnetgroup');
      const engine = String(p(r, 'Engine') ?? 'postgres');
      const explicitPort = p(r, 'Port') !== undefined ? validPort(r.id, 'Port', p(r, 'Port')) : undefined;
      const wl = addWorkload(arch, {
        type: 'rds', name: r.id, role,
        subnetIds: groupLogical ? dbGroupSubnets[groupLogical] : [],
        sgIds: refList(r, 'VPCSecurityGroups'),
        publicIp: false,
        multiAz: p(r, 'MultiAZ') === true,
        port: explicitPort ?? ENGINE_DEFAULT_PORTS[engine],
      });
      logicalToModel[r.id] = wl.id;
    }
  }

  return { arch, problems };
}

// ---------------------------------------------------------------------------
// arch -> graph (start states, reference solutions, draft migration)
// ---------------------------------------------------------------------------

// storage.getArchDraft's shape gate only checks the five top-level arrays,
// so a legacy draft can reach here with elements missing inner fields.
// Normalize first: a migration must degrade to partial cards (whose gaps
// surface as card problems), never throw and orphan the user's draft.
function sanitize(arch) {
  const objs = (v) => (Array.isArray(v) ? v.filter((x) => x && typeof x === 'object') : []);
  const ids = (v) => (Array.isArray(v) ? v : []);
  return {
    vpc: {
      cidr: typeof arch?.vpc?.cidr === 'string' ? arch.vpc.cidr : '',
      igwAttached: arch?.vpc?.igwAttached === true,
    },
    subnets: objs(arch?.subnets).map((s) => ({
      id: s.id, name: s.name ?? 'subnet', az: s.az ?? 'a', cidr: s.cidr ?? '',
    })),
    natGateways: objs(arch?.natGateways).map((n) => ({ id: n.id, subnetId: n.subnetId })),
    routeTables: objs(arch?.routeTables).map((t) => ({
      id: t.id,
      name: t.name ?? 'rt',
      isMain: t.isMain === true,
      routes: objs(t.routes).filter((r) => r.target === 'igw'
        || (typeof r.target === 'string' && r.target.startsWith('nat:')))
        .map((r) => ({ destCidr: r.destCidr ?? '', target: r.target })),
      subnetIds: ids(t.subnetIds),
    })),
    securityGroups: objs(arch?.securityGroups).map((g) => ({
      id: g.id, name: g.name ?? 'sg', inbound: objs(g.inbound),
    })),
    workloads: objs(arch?.workloads).map((w) => ({
      ...w,
      name: w.name ?? 'workload',
      subnetIds: ids(w.subnetIds),
      sgIds: ids(w.sgIds),
    })),
  };
}

export function archToGraph(rawArch) {
  const arch = sanitize(rawArch);
  const resources = [];
  const nextId = allocator();
  const add = (id, type, props) => {
    resources.push({ id, type, props });
    return id;
  };

  const vpcId = add(nextId('Vpc'), 'AWS::EC2::VPC', { CidrBlock: arch.vpc.cidr });

  const publicIpSubnets = new Set();
  for (const wl of arch.workloads) {
    if (wl.type === 'ec2' && wl.publicIp) for (const sid of wl.subnetIds) publicIpSubnets.add(sid);
  }
  const subnetIds = {};
  for (const s of arch.subnets) {
    subnetIds[s.id] = add(nextId(pascal(s.name)), 'AWS::EC2::Subnet', {
      VpcId: vpcId,
      CidrBlock: s.cidr,
      AvailabilityZone: `${AZ_PREFIX}${s.az}`,
      ...(publicIpSubnets.has(s.id) ? { MapPublicIpOnLaunch: true } : {}),
    });
  }

  const needIgw = arch.vpc.igwAttached
    || arch.routeTables.some((rt) => rt.routes.some((r) => r.target === 'igw'));
  let igwId = null;
  if (needIgw) {
    igwId = add(nextId('InternetGateway'), 'AWS::EC2::InternetGateway', {});
    if (arch.vpc.igwAttached) {
      add(nextId('GatewayAttachment'), 'AWS::EC2::VPCGatewayAttachment', {
        VpcId: vpcId, InternetGatewayId: igwId,
      });
    }
  }

  const natIds = {};
  arch.natGateways.forEach((nat, i) => {
    if (!subnetIds[nat.subnetId]) return;
    const eipId = add(nextId(`NatEip${i + 1}`), 'AWS::EC2::EIP', {});
    natIds[nat.id] = add(nextId(`NatGateway${i + 1}`), 'AWS::EC2::NatGateway', {
      SubnetId: subnetIds[nat.subnetId], AllocationId: eipId,
    });
  });

  const emitTable = (name, routes, assocSubnets) => {
    const tableId = add(nextId(`${pascal(name)}RouteTable`), 'AWS::EC2::RouteTable', { VpcId: vpcId });
    routes.forEach((route, i) => {
      const isIgw = route.target === 'igw';
      if (!isIgw && !natIds[route.target.slice(4)]) return;
      add(nextId(`${tableId}Route${i + 1}`), 'AWS::EC2::Route', {
        RouteTableId: tableId,
        DestinationCidrBlock: route.destCidr,
        ...(isIgw ? { GatewayId: igwId } : { NatGatewayId: natIds[route.target.slice(4)] }),
      });
    });
    for (const sid of assocSubnets) {
      if (!subnetIds[sid]) continue;
      add(nextId(`${subnetIds[sid]}Association`), 'AWS::EC2::SubnetRouteTableAssociation', {
        SubnetId: subnetIds[sid], RouteTableId: tableId,
      });
    }
    return tableId;
  };
  for (const rt of arch.routeTables.filter((t) => !t.isMain)) {
    emitTable(rt.name, rt.routes, rt.subnetIds);
  }
  // CFN cannot address the implicit main table: materialize its routes as
  // an explicit table associated with every subnet that effectively used it.
  const main = arch.routeTables.find((t) => t.isMain);
  if (main && main.routes.length > 0) {
    const users = arch.subnets.filter((s) => effectiveRouteTable(arch, s.id) === main).map((s) => s.id);
    emitTable('Main', main.routes, users);
  }

  const sgIds = {};
  for (const sg of arch.securityGroups) sgIds[sg.id] = nextId(pascal(sg.name));
  for (const sg of arch.securityGroups) {
    resources.push({
      id: sgIds[sg.id],
      type: 'AWS::EC2::SecurityGroup',
      props: {
        GroupDescription: sg.name,
        VpcId: vpcId,
        SecurityGroupIngress: sg.inbound.map((r) => ({
          IpProtocol: r.proto === 'all' ? '-1' : (r.proto || 'tcp'),
          ...(r.proto !== 'all' && r.proto !== 'icmp'
            ? { FromPort: r.portFrom, ToPort: r.portTo } : {}),
          ...(typeof r.source === 'string' && r.source.startsWith('sg:')
            ? { SourceSecurityGroupId: sgIds[r.source.slice(3)] }
            : { CidrIp: r.source }),
        })),
      },
    });
  }

  const sugar = (wl, defaultPort) => ({
    ...(wl.role ? { RoleTag: wl.role } : {}),
    ...(wl.port !== undefined && wl.port !== defaultPort ? { PortTag: wl.port } : {}),
  });
  for (const wl of arch.workloads) {
    const wlId = nextId(pascal(wl.name));
    if (wl.type === 'ec2') {
      add(wlId, 'AWS::EC2::Instance', {
        ImageId: DEFAULT_IMAGE_ID,
        ...(wl.subnetIds[0] && subnetIds[wl.subnetIds[0]] ? { SubnetId: subnetIds[wl.subnetIds[0]] } : {}),
        SecurityGroupIds: wl.sgIds.map((g) => sgIds[g]).filter(Boolean),
        ...sugar(wl, 80),
      });
    } else if (wl.type === 'alb') {
      add(wlId, 'AWS::ElasticLoadBalancingV2::LoadBalancer', {
        Subnets: wl.subnetIds.map((s) => subnetIds[s]).filter(Boolean),
        SecurityGroups: wl.sgIds.map((g) => sgIds[g]).filter(Boolean),
        Scheme: wl.publicIp === false ? 'internal' : 'internet-facing',
        ...sugar(wl, 80),
      });
    } else {
      const groupId = add(nextId(`${wlId}SubnetGroup`), 'AWS::RDS::DBSubnetGroup', {
        DBSubnetGroupDescription: `Subnets for ${wl.name}`,
        SubnetIds: wl.subnetIds.map((s) => subnetIds[s]).filter(Boolean),
      });
      add(wlId, 'AWS::RDS::DBInstance', {
        Engine: 'postgres',
        DBSubnetGroupName: groupId,
        VPCSecurityGroups: wl.sgIds.map((g) => sgIds[g]).filter(Boolean),
        ...(wl.multiAz ? { MultiAZ: true } : {}),
        ...(wl.port !== undefined && wl.port !== 5432 ? { Port: wl.port } : {}),
        ...(wl.role ? { RoleTag: wl.role } : {}),
      });
    }
  }

  return { resources };
}
