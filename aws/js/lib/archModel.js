// aws/js/lib/archModel.js
//
// State factory, mutation helpers, and derived queries for the Architecture
// Challenge builder. The state is a plain JSON-serializable object (drafts
// round-trip through localStorage), so mutators work in place on the passed
// state; add* helpers return the resource they created. Referential
// integrity lives here: removing a resource also removes every reference to
// it, so the validators and simulator never see dangling ids.

export const AZS = ['a', 'b', 'c'];
export const WORKLOAD_TYPES = ['ec2', 'alb', 'rds'];

export function createArch() {
  return {
    vpc: { cidr: '10.0.0.0/16', igwAttached: false },
    subnets: [],
    natGateways: [],
    routeTables: [
      { id: 'rtb-main', name: 'main', isMain: true, routes: [], subnetIds: [] },
    ],
    securityGroups: [],
    workloads: [],
    counters: { subnet: 0, nat: 0, rtb: 0, sg: 0, wl: 0 },
  };
}

// Counters never decrement, so ids stay unique for the lifetime of a draft
// even across removals (stale ids in old traces can never alias a new
// resource).
function nextId(arch, kind, prefix) {
  arch.counters[kind] += 1;
  return `${prefix}-${arch.counters[kind]}`;
}

function byId(list, id) {
  return list.find((item) => item.id === id) || null;
}

export function getSubnet(arch, id) { return byId(arch.subnets, id); }
export function getNat(arch, id) { return byId(arch.natGateways, id); }
export function getRouteTable(arch, id) { return byId(arch.routeTables, id); }
export function getSecurityGroup(arch, id) { return byId(arch.securityGroups, id); }
export function getWorkload(arch, id) { return byId(arch.workloads, id); }

export function addSubnet(arch, { name, az, cidr }) {
  const id = nextId(arch, 'subnet', 'subnet');
  const subnet = { id, name: name || id, az, cidr };
  arch.subnets.push(subnet);
  return subnet;
}

export function updateSubnet(arch, id, patch) {
  const subnet = getSubnet(arch, id);
  if (subnet) Object.assign(subnet, patch);
  return subnet;
}

export function removeSubnet(arch, id) {
  for (const nat of arch.natGateways.filter((n) => n.subnetId === id)) {
    removeNat(arch, nat.id);
  }
  for (const rt of arch.routeTables) {
    rt.subnetIds = rt.subnetIds.filter((sid) => sid !== id);
  }
  for (const wl of arch.workloads) {
    wl.subnetIds = wl.subnetIds.filter((sid) => sid !== id);
  }
  arch.subnets = arch.subnets.filter((s) => s.id !== id);
}

export function addNat(arch, subnetId) {
  const id = nextId(arch, 'nat', 'nat');
  const nat = { id, subnetId };
  arch.natGateways.push(nat);
  return nat;
}

export function removeNat(arch, id) {
  arch.natGateways = arch.natGateways.filter((n) => n.id !== id);
  for (const rt of arch.routeTables) {
    rt.routes = rt.routes.filter((r) => r.target !== `nat:${id}`);
  }
}

export function addRouteTable(arch, name) {
  const id = nextId(arch, 'rtb', 'rtb');
  const rt = { id, name: name || id, isMain: false, routes: [], subnetIds: [] };
  arch.routeTables.push(rt);
  return rt;
}

export function removeRouteTable(arch, id) {
  const rt = getRouteTable(arch, id);
  if (!rt || rt.isMain) return false;
  arch.routeTables = arch.routeTables.filter((t) => t.id !== id);
  return true;
}

export function addRoute(arch, rtbId, { destCidr, target }) {
  const rt = getRouteTable(arch, rtbId);
  if (!rt) return null;
  const route = { destCidr, target };
  rt.routes.push(route);
  return route;
}

export function removeRoute(arch, rtbId, index) {
  const rt = getRouteTable(arch, rtbId);
  if (rt) rt.routes.splice(index, 1);
}

export function associateSubnet(arch, rtbId, subnetId) {
  disassociateSubnet(arch, subnetId);
  const rt = getRouteTable(arch, rtbId);
  if (rt) rt.subnetIds.push(subnetId);
}

export function disassociateSubnet(arch, subnetId) {
  for (const rt of arch.routeTables) {
    rt.subnetIds = rt.subnetIds.filter((sid) => sid !== subnetId);
  }
}

export function addSecurityGroup(arch, name) {
  const id = nextId(arch, 'sg', 'sg');
  const sg = { id, name: name || id, inbound: [] };
  arch.securityGroups.push(sg);
  return sg;
}

export function removeSecurityGroup(arch, id) {
  arch.securityGroups = arch.securityGroups.filter((g) => g.id !== id);
  for (const sg of arch.securityGroups) {
    sg.inbound = sg.inbound.filter((r) => r.source !== `sg:${id}`);
  }
  for (const wl of arch.workloads) {
    wl.sgIds = wl.sgIds.filter((gid) => gid !== id);
  }
}

export function addSgRule(arch, sgId, { proto = 'tcp', portFrom, portTo = portFrom, source }) {
  const sg = getSecurityGroup(arch, sgId);
  if (!sg) return null;
  const rule = { proto, portFrom, portTo, source };
  sg.inbound.push(rule);
  return rule;
}

export function removeSgRule(arch, sgId, index) {
  const sg = getSecurityGroup(arch, sgId);
  if (sg) sg.inbound.splice(index, 1);
}

const DEFAULT_PORTS = { ec2: 80, alb: 80, rds: 5432 };

export function addWorkload(arch, {
  type, name, role = null, subnetIds = [], sgIds = [],
  publicIp = false, multiAz = false, port,
}) {
  const id = nextId(arch, 'wl', type);
  const wl = {
    id,
    type,
    name: name || id,
    role,
    subnetIds: [...subnetIds],
    sgIds: [...sgIds],
    publicIp,
    multiAz,
    port: port ?? DEFAULT_PORTS[type],
  };
  arch.workloads.push(wl);
  return wl;
}

export function updateWorkload(arch, id, patch) {
  const wl = getWorkload(arch, id);
  if (wl) Object.assign(wl, patch);
  return wl;
}

export function removeWorkload(arch, id) {
  arch.workloads = arch.workloads.filter((w) => w.id !== id);
}

// Explicit association wins (even an explicit association to main); an
// unassociated subnet implicitly uses the main table, as in AWS.
export function effectiveRouteTable(arch, subnetId) {
  return (
    arch.routeTables.find((rt) => rt.subnetIds.includes(subnetId))
    || arch.routeTables.find((rt) => rt.isMain)
  );
}

// "Public subnet" in the AWS sense: its effective route table sends some
// traffic to an internet gateway that is actually attached.
export function isPublicSubnet(arch, subnetId) {
  if (!arch.vpc.igwAttached) return false;
  const rt = effectiveRouteTable(arch, subnetId);
  return rt ? rt.routes.some((r) => r.target === 'igw') : false;
}

export function workloadsByRole(arch, role) {
  return arch.workloads.filter((w) => w.role === role);
}

export function workloadAzs(arch, workload) {
  const azs = new Set();
  for (const sid of workload.subnetIds) {
    const subnet = getSubnet(arch, sid);
    if (subnet) azs.add(subnet.az);
  }
  return [...azs];
}
