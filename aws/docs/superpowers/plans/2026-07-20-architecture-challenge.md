# Architecture Challenge Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a standalone "Architecture Challenge" page to the AWS module: pick a scenario task, build a VPC architecture with a structured form UI, and get three-level validation (structural / functional-via-simulation / best-practice) with plain-English explanations.

**Architecture:** Follows the VPC Explorer precedent: `architecture-challenge.html` + `js/arch-challenge.js` (DOM only), all logic as pure functions in `js/lib/` (`archModel.js` state + mutators, `archValidate.js` structural + best-practice rules, `archSimulate.js` connectivity traces, `archGoals.js` goal evaluation), challenge definitions with reference solutions in `js/data/archChallenges.js`. Drafts and results persist through the existing `js/lib/storage.js` store.

**Tech Stack:** Vanilla ES modules, no build step, `node --test` for unit tests, `python3 -m http.server` (launch.json `aws-site`) to serve.

**Spec:** [aws/docs/superpowers/specs/2026-07-20-architecture-challenge-design.md](../specs/2026-07-20-architecture-challenge-design.md)

## Global Constraints

- All paths below are relative to `aws/`; all commands run from `/Users/toddcooke/IdeaProjects/learn/aws` unless stated otherwise.
- Vanilla JS ES modules only; no npm, no dependencies, no build step, no `package.json`.
- Every data-derived string rendered into HTML goes through `escapeHtml` from `js/lib/html.js`.
- The architecture state object must stay JSON-serializable (localStorage drafts round-trip through `JSON.stringify`); challenge `startState`/`refSolution` are *functions* returning fresh state and are never serialized.
- Security groups model inbound rules only; outbound is implicitly allow-all (stated in the UI). The implicit `local` route is injected by the evaluator, never stored.
- One deviation from the spec, following the VPC Explorer precedent: page-specific styles live in a `<style>` block inside `architecture-challenge.html` (reusing `css/style.css` variables, with a `prefers-color-scheme: dark` override block), not in `css/style.css`. Task 12 records this in the spec.
- Commit messages: imperative mood, no conventional-commit prefix, ending with `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `node --test` and `node scripts/validate-content.mjs` must pass at every commit; `node ../scripts/check-drift.mjs` (run from `aws/`) must stay clean (all new files are aws-only and outside its SHARED list).
- AZs are `'a' | 'b' | 'c'`; workload types are `'ec2' | 'alb' | 'rds'`; route targets are `'igw'` or `'nat:<natId>'`.

---

## Task 1: CIDR helpers in `vpcMath.js` + `archModel.js` (state, mutators, queries)

**Files:**
- Modify: `js/lib/vpcMath.js` (append three functions after `octetOf`, around line 63)
- Create: `js/lib/archModel.js`
- Test: `js/lib/vpcMath.test.mjs` (append), `js/lib/archModel.test.mjs` (create)

**Interfaces:**
- Consumes: `parseCidr`, `maskForPrefix`, `ipToInt` from `js/lib/vpcMath.js` (existing).
- Produces (vpcMath): `parseCidrStrict(cidr: string): {network, broadcast, mask, prefixLen} | null` — like `parseCidr` but returns `null` for anything malformed (bad shape, octet > 255, prefix > 32, non-numeric). `cidrContains(outer, inner): boolean` and `cidrsOverlap(a, b): boolean` — both take *parsed* objects from `parseCidr`/`parseCidrStrict`.
- Produces (archModel): `AZS`, `WORKLOAD_TYPES`, `createArch()`, getters `getSubnet/getNat/getRouteTable/getSecurityGroup/getWorkload(arch, id)`, mutators `addSubnet(arch, {name?, az, cidr})`, `updateSubnet(arch, id, patch)`, `removeSubnet(arch, id)`, `addNat(arch, subnetId)`, `removeNat(arch, id)`, `addRouteTable(arch, name?)`, `removeRouteTable(arch, id)`, `addRoute(arch, rtbId, {destCidr, target})`, `removeRoute(arch, rtbId, index)`, `associateSubnet(arch, rtbId, subnetId)`, `disassociateSubnet(arch, subnetId)`, `addSecurityGroup(arch, name?)`, `removeSecurityGroup(arch, id)`, `addSgRule(arch, sgId, {proto?, portFrom, portTo?, source})`, `removeSgRule(arch, sgId, index)`, `addWorkload(arch, {type, name?, role?, subnetIds?, sgIds?, publicIp?, multiAz?, port?})`, `updateWorkload(arch, id, patch)`, `removeWorkload(arch, id)`, queries `effectiveRouteTable(arch, subnetId)`, `isPublicSubnet(arch, subnetId)`, `workloadsByRole(arch, role)`, `workloadAzs(arch, workload): string[]`. All mutators mutate `arch` in place; `add*` returns the created resource.

The architecture state shape (created by `createArch()`):

```js
{
  vpc: { cidr: '10.0.0.0/16', igwAttached: false },
  subnets: [],        // { id, name, az, cidr }
  natGateways: [],    // { id, subnetId }
  routeTables: [      // { id, name, isMain, routes: [{destCidr, target}], subnetIds: [] }
    { id: 'rtb-main', name: 'main', isMain: true, routes: [], subnetIds: [] },
  ],
  securityGroups: [], // { id, name, inbound: [{proto, portFrom, portTo, source}] }
  workloads: [],      // { id, type, name, role, subnetIds, sgIds, publicIp, multiAz, port }
  counters: { subnet: 0, nat: 0, rtb: 0, sg: 0, wl: 0 },
}
```

`counters` lives inside the state so auto-ids stay unique across draft save/load; removal never decrements. Workload ids use the type as prefix (`ec2-1`, `alb-2`, `rds-3` — one shared `wl` counter) so simulation traces read naturally. SG rule `source` is a CIDR string or `'sg:<sgId>'`.

- [ ] **Step 1: Write the failing vpcMath tests**

Append to `js/lib/vpcMath.test.mjs` (import `parseCidrStrict`, `cidrContains`, `cidrsOverlap` in the existing import block):

```js
// ---------------------------------------------------------------------------
// Strict parsing + containment (architecture challenge helpers)
// ---------------------------------------------------------------------------

test('parseCidrStrict parses valid CIDRs like parseCidr', () => {
  const parsed = parseCidrStrict('10.0.29.200/20');
  assert.equal(intToIp(parsed.network), '10.0.16.0');
  assert.equal(parsed.prefixLen, 20);
});

test('parseCidrStrict rejects malformed input with null', () => {
  for (const bad of [
    '10.0.0.0', '10.0.0.0/', '10.0.0.0/33', '10.0.0.256/24', '10.0.0/24',
    'banana', '', '10.0.0.0/16/24', '10.0.0.-1/24', '10.0.0.0/1x',
  ]) {
    assert.equal(parseCidrStrict(bad), null, `${JSON.stringify(bad)} must be rejected`);
  }
});

test('cidrContains: outer covers inner fully, not partially', () => {
  const vpc = parseCidrStrict('10.0.0.0/16');
  assert.equal(cidrContains(vpc, parseCidrStrict('10.0.1.0/24')), true);
  assert.equal(cidrContains(vpc, parseCidrStrict('10.0.0.0/16')), true);
  assert.equal(cidrContains(vpc, parseCidrStrict('10.1.0.0/24')), false);
  assert.equal(cidrContains(vpc, parseCidrStrict('10.0.0.0/8')), false);
});

test('cidrsOverlap detects any shared address range', () => {
  const a = parseCidrStrict('10.0.1.0/24');
  assert.equal(cidrsOverlap(a, parseCidrStrict('10.0.1.128/25')), true);
  assert.equal(cidrsOverlap(a, parseCidrStrict('10.0.0.0/16')), true);
  assert.equal(cidrsOverlap(a, parseCidrStrict('10.0.2.0/24')), false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/lib/vpcMath.test.mjs`
Expected: FAIL — `parseCidrStrict` is not exported.

- [ ] **Step 3: Implement the three helpers**

Append to `js/lib/vpcMath.js` after `octetOf` (before the `describeBoundary` section):

```js
// Strict variant of parseCidr for user-typed input: returns null instead of
// garbage for anything that isn't a well-formed dotted-quad/prefix. parseCidr
// itself stays permissive — it only ever sees the explorer's hardcoded CIDRs.
const CIDR_RE = /^(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})\/(\d{1,2})$/;

export function parseCidrStrict(cidr) {
  const m = CIDR_RE.exec(String(cidr).trim());
  if (!m) return null;
  const octets = [m[1], m[2], m[3], m[4]].map(Number);
  const prefixLen = Number(m[5]);
  if (octets.some((o) => o > 255) || prefixLen > 32) return null;
  return parseCidr(`${octets.join('.')}/${prefixLen}`);
}

// Both take parsed blocks ({network, broadcast} from parseCidr/parseCidrStrict).
export function cidrContains(outer, inner) {
  return outer.network <= inner.network && inner.broadcast <= outer.broadcast;
}

export function cidrsOverlap(a, b) {
  return a.network <= b.broadcast && b.network <= a.broadcast;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/vpcMath.test.mjs`
Expected: PASS (all existing tests plus the four new ones).

- [ ] **Step 5: Write the failing archModel tests**

Create `js/lib/archModel.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  AZS,
  WORKLOAD_TYPES,
  createArch,
  getSubnet,
  getRouteTable,
  addSubnet,
  updateSubnet,
  removeSubnet,
  addNat,
  removeNat,
  addRouteTable,
  removeRouteTable,
  addRoute,
  removeRoute,
  associateSubnet,
  disassociateSubnet,
  addSecurityGroup,
  removeSecurityGroup,
  addSgRule,
  removeSgRule,
  addWorkload,
  updateWorkload,
  removeWorkload,
  effectiveRouteTable,
  isPublicSubnet,
  workloadsByRole,
  workloadAzs,
} from './archModel.js';

test('createArch starts with a lone main route table and zeroed counters', () => {
  const arch = createArch();
  assert.equal(arch.vpc.cidr, '10.0.0.0/16');
  assert.equal(arch.vpc.igwAttached, false);
  assert.equal(arch.routeTables.length, 1);
  assert.equal(arch.routeTables[0].isMain, true);
  assert.deepEqual(arch.subnets, []);
  assert.deepEqual(AZS, ['a', 'b', 'c']);
  assert.deepEqual(WORKLOAD_TYPES, ['ec2', 'alb', 'rds']);
});

test('createArch state survives a JSON round-trip unchanged', () => {
  const arch = createArch();
  addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  assert.deepEqual(JSON.parse(JSON.stringify(arch)), arch);
});

test('auto-ids never repeat, even after removal', () => {
  const arch = createArch();
  const s1 = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  removeSubnet(arch, s1.id);
  const s2 = addSubnet(arch, { az: 'b', cidr: '10.0.2.0/24' });
  assert.equal(s1.id, 'subnet-1');
  assert.equal(s2.id, 'subnet-2');
});

test('workload ids use the type as prefix and default the port by type', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const web = addWorkload(arch, { type: 'ec2', subnetIds: [s.id] });
  const db = addWorkload(arch, { type: 'rds', subnetIds: [s.id] });
  assert.equal(web.id, 'ec2-1');
  assert.equal(db.id, 'rds-2');
  assert.equal(web.port, 80);
  assert.equal(db.port, 5432);
  assert.equal(web.role, null);
  assert.equal(web.publicIp, false);
});

test('removeSubnet cleans up NATs, their routes, associations, and workload refs', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const keep = addSubnet(arch, { az: 'b', cidr: '10.0.2.0/24' });
  const nat = addNat(arch, s.id);
  const rt = addRouteTable(arch, 'private');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  associateSubnet(arch, rt.id, s.id);
  const wl = addWorkload(arch, { type: 'alb', subnetIds: [s.id, keep.id] });

  removeSubnet(arch, s.id);

  assert.equal(getSubnet(arch, s.id), null);
  assert.deepEqual(arch.natGateways, []);
  assert.deepEqual(getRouteTable(arch, rt.id).routes, []); // nat route removed with the NAT
  assert.deepEqual(getRouteTable(arch, rt.id).subnetIds, []);
  assert.deepEqual(wl.subnetIds, [keep.id]);
});

test('removeNat strips routes that target it', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const nat = addNat(arch, s.id);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  removeNat(arch, nat.id);
  assert.deepEqual(getRouteTable(arch, 'rtb-main').routes, []);
});

test('removeRouteTable refuses the main table and drops custom ones', () => {
  const arch = createArch();
  const rt = addRouteTable(arch, 'public');
  assert.equal(removeRouteTable(arch, 'rtb-main'), false);
  assert.equal(removeRouteTable(arch, rt.id), true);
  assert.equal(arch.routeTables.length, 1);
});

test('associateSubnet moves a subnet between route tables (never duplicates)', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const rt1 = addRouteTable(arch, 'one');
  const rt2 = addRouteTable(arch, 'two');
  associateSubnet(arch, rt1.id, s.id);
  associateSubnet(arch, rt2.id, s.id);
  assert.deepEqual(getRouteTable(arch, rt1.id).subnetIds, []);
  assert.deepEqual(getRouteTable(arch, rt2.id).subnetIds, [s.id]);
  disassociateSubnet(arch, s.id);
  assert.deepEqual(getRouteTable(arch, rt2.id).subnetIds, []);
});

test('removeSecurityGroup cleans workload refs and sg: rule sources', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const web = addSecurityGroup(arch, 'web');
  const db = addSecurityGroup(arch, 'db');
  addSgRule(arch, db.id, { portFrom: 5432, source: `sg:${web.id}` });
  addSgRule(arch, db.id, { portFrom: 22, source: '10.0.0.0/16' });
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [s.id], sgIds: [web.id] });

  removeSecurityGroup(arch, web.id);

  assert.deepEqual(wl.sgIds, []);
  assert.equal(db.inbound.length, 1);
  assert.equal(db.inbound[0].source, '10.0.0.0/16');
});

test('addSgRule defaults proto to tcp and portTo to portFrom', () => {
  const arch = createArch();
  const sg = addSecurityGroup(arch);
  const rule = addSgRule(arch, sg.id, { portFrom: 443, source: '0.0.0.0/0' });
  assert.deepEqual(rule, { proto: 'tcp', portFrom: 443, portTo: 443, source: '0.0.0.0/0' });
});

test('effectiveRouteTable falls back to main when unassociated', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  assert.equal(effectiveRouteTable(arch, s.id).id, 'rtb-main');
  const rt = addRouteTable(arch, 'public');
  associateSubnet(arch, rt.id, s.id);
  assert.equal(effectiveRouteTable(arch, s.id).id, rt.id);
});

test('isPublicSubnet requires an attached IGW and an igw route', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  assert.equal(isPublicSubnet(arch, s.id), false);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: 'igw' });
  assert.equal(isPublicSubnet(arch, s.id), false, 'route alone is not enough');
  arch.vpc.igwAttached = true;
  assert.equal(isPublicSubnet(arch, s.id), true);
});

test('workloadsByRole and workloadAzs (deduped)', () => {
  const arch = createArch();
  const sa = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  const sb = addSubnet(arch, { az: 'b', cidr: '10.0.2.0/24' });
  const alb = addWorkload(arch, { type: 'alb', role: 'lb', subnetIds: [sa.id, sb.id] });
  addWorkload(arch, { type: 'ec2', role: 'web', subnetIds: [sa.id] });
  assert.deepEqual(workloadsByRole(arch, 'lb'), [alb]);
  assert.deepEqual(workloadAzs(arch, alb).sort(), ['a', 'b']);
});

test('update helpers patch in place; remove helpers drop the resource', () => {
  const arch = createArch();
  const s = addSubnet(arch, { az: 'a', cidr: '10.0.1.0/24' });
  updateSubnet(arch, s.id, { name: 'public-a' });
  assert.equal(getSubnet(arch, s.id).name, 'public-a');
  const wl = addWorkload(arch, { type: 'ec2', subnetIds: [s.id] });
  updateWorkload(arch, wl.id, { publicIp: true });
  assert.equal(wl.publicIp, true);
  removeWorkload(arch, wl.id);
  assert.deepEqual(arch.workloads, []);
  const sg = addSecurityGroup(arch);
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  removeSgRule(arch, sg.id, 0);
  assert.deepEqual(sg.inbound, []);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: 'igw' });
  removeRoute(arch, 'rtb-main', 0);
  assert.deepEqual(getRouteTable(arch, 'rtb-main').routes, []);
});
```

- [ ] **Step 6: Run tests to verify they fail**

Run: `node --test js/lib/archModel.test.mjs`
Expected: FAIL — `Cannot find module '.../js/lib/archModel.js'`

- [ ] **Step 7: Implement `js/lib/archModel.js`**

```js
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
```

- [ ] **Step 8: Run tests to verify they pass**

Run: `node --test js/lib/archModel.test.mjs js/lib/vpcMath.test.mjs`
Expected: PASS.

- [ ] **Step 9: Commit**

```bash
git add js/lib/vpcMath.js js/lib/vpcMath.test.mjs js/lib/archModel.js js/lib/archModel.test.mjs
git commit -m "Add architecture state model and strict CIDR helpers

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 2: Structural validation (`archValidate.js`, part 1)

**Files:**
- Create: `js/lib/archValidate.js`
- Test: `js/lib/archValidate.test.mjs` (create)

**Interfaces:**
- Consumes: `parseCidrStrict`, `cidrContains`, `cidrsOverlap` from `vpcMath.js`; `getSubnet`, `getNat`, `getSecurityGroup`, `workloadAzs` from `archModel.js`.
- Produces: `validateStructure(arch): {errors: [{ruleId, message, resourceIds}]}` — `resourceIds` is an array of the offending resource ids (may be empty for VPC-level errors). Task 5's goal evaluation and Task 11's UI treat `errors.length > 0` as "goals not evaluated".

Structural rules and their `ruleId`s (each message is plain English and names the resources by their user-visible `name`):

| ruleId | fires when |
|---|---|
| `vpc-cidr-invalid` | VPC CIDR fails `parseCidrStrict` |
| `vpc-cidr-prefix` | VPC prefix outside /16–/28 |
| `subnet-cidr-invalid` | subnet CIDR fails `parseCidrStrict` |
| `subnet-cidr-prefix` | subnet prefix outside /16–/28 |
| `subnet-outside-vpc` | subnet block not fully inside the VPC block (only checked when both parse) |
| `subnet-overlap` | any pair of subnet blocks overlaps (one error per offending pair) |
| `route-dest-invalid` | a route's destCidr fails `parseCidrStrict` |
| `route-igw-unattached` | a route targets `igw` while `vpc.igwAttached` is false |
| `route-nat-missing` | a route targets `nat:<id>` for a NAT that doesn't exist |
| `route-target-unknown` | a route target is neither `igw` nor a `nat:` reference |
| `nat-subnet-missing` | a NAT's `subnetId` doesn't resolve |
| `subnet-multi-assoc` | a subnet appears in more than one route table's `subnetIds` |
| `workload-subnet-missing` | a workload references a subnet id that doesn't resolve |
| `workload-sg-missing` | a workload references an SG id that doesn't resolve |
| `ec2-subnet-count` | an EC2 workload has `subnetIds.length !== 1` |
| `alb-subnet-spread` | an ALB has fewer than 2 subnets or they span fewer than 2 AZs |
| `rds-subnet-spread` | an RDS subnet group has fewer than 2 subnets or spans fewer than 2 AZs |

- [ ] **Step 1: Write the failing tests**

Create `js/lib/archValidate.test.mjs`:

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/lib/archValidate.test.mjs`
Expected: FAIL — `Cannot find module '.../js/lib/archValidate.js'`

- [ ] **Step 3: Implement `validateStructure`**

Create `js/lib/archValidate.js`:

```js
// aws/js/lib/archValidate.js
//
// Structural validation ("would AWS accept this at all") for the
// Architecture Challenge. Best-practice rules are added to this file by a
// later task. Every error carries a ruleId (stable, test-asserted), a
// plain-English message naming resources by their user-visible name, and
// the offending resource ids.

import { parseCidrStrict, cidrContains, cidrsOverlap } from './vpcMath.js';
import { getSubnet, getSecurityGroup, workloadAzs } from './archModel.js';

const VPC_PREFIX_MIN = 16; // AWS allows /16 (largest block)…
const VPC_PREFIX_MAX = 28; // …through /28 (smallest) for VPCs and subnets.

export function validateStructure(arch) {
  const errors = [];
  const err = (ruleId, message, resourceIds = []) => {
    errors.push({ ruleId, message, resourceIds });
  };

  // --- VPC CIDR ---
  const vpcBlock = parseCidrStrict(arch.vpc.cidr);
  if (!vpcBlock) {
    err('vpc-cidr-invalid', `VPC CIDR "${arch.vpc.cidr}" is not a valid IPv4 CIDR block.`);
  } else if (vpcBlock.prefixLen < VPC_PREFIX_MIN || vpcBlock.prefixLen > VPC_PREFIX_MAX) {
    err('vpc-cidr-prefix', `VPC CIDR must be between /16 and /28 (got /${vpcBlock.prefixLen}).`);
  }

  // --- Subnets ---
  const subnetBlocks = new Map(); // id -> parsed block (only valid ones)
  for (const s of arch.subnets) {
    const block = parseCidrStrict(s.cidr);
    if (!block) {
      err('subnet-cidr-invalid', `Subnet ${s.name}: "${s.cidr}" is not a valid IPv4 CIDR block.`, [s.id]);
      continue;
    }
    if (block.prefixLen < VPC_PREFIX_MIN || block.prefixLen > VPC_PREFIX_MAX) {
      err('subnet-cidr-prefix', `Subnet ${s.name}: prefix must be between /16 and /28 (got /${block.prefixLen}).`, [s.id]);
      continue;
    }
    if (vpcBlock && !cidrContains(vpcBlock, block)) {
      err('subnet-outside-vpc', `Subnet ${s.name} (${s.cidr}) is not inside the VPC CIDR ${arch.vpc.cidr}.`, [s.id]);
      continue;
    }
    subnetBlocks.set(s.id, block);
  }
  const checked = [...subnetBlocks.entries()];
  for (let i = 0; i < checked.length; i++) {
    for (let j = i + 1; j < checked.length; j++) {
      if (cidrsOverlap(checked[i][1], checked[j][1])) {
        const a = getSubnet(arch, checked[i][0]);
        const b = getSubnet(arch, checked[j][0]);
        err('subnet-overlap', `Subnets ${a.name} (${a.cidr}) and ${b.name} (${b.cidr}) overlap.`, [a.id, b.id]);
      }
    }
  }

  // --- NAT gateways ---
  for (const nat of arch.natGateways) {
    if (!getSubnet(arch, nat.subnetId)) {
      err('nat-subnet-missing', `NAT gateway ${nat.id} is not placed in an existing subnet.`, [nat.id]);
    }
  }

  // --- Route tables ---
  const natIds = new Set(arch.natGateways.map((n) => n.id));
  for (const rt of arch.routeTables) {
    for (const route of rt.routes) {
      if (!parseCidrStrict(route.destCidr)) {
        err('route-dest-invalid', `Route table ${rt.name}: destination "${route.destCidr}" is not a valid CIDR.`, [rt.id]);
      }
      if (route.target === 'igw') {
        if (!arch.vpc.igwAttached) {
          err('route-igw-unattached', `Route table ${rt.name} routes to an internet gateway, but no IGW is attached to the VPC.`, [rt.id]);
        }
      } else if (typeof route.target === 'string' && route.target.startsWith('nat:')) {
        if (!natIds.has(route.target.slice(4))) {
          err('route-nat-missing', `Route table ${rt.name} routes to NAT "${route.target.slice(4)}", which doesn't exist.`, [rt.id]);
        }
      } else {
        err('route-target-unknown', `Route table ${rt.name}: unknown route target "${route.target}".`, [rt.id]);
      }
    }
  }

  // --- Associations ---
  const assocCount = new Map();
  for (const rt of arch.routeTables) {
    for (const sid of rt.subnetIds) {
      assocCount.set(sid, (assocCount.get(sid) || 0) + 1);
    }
  }
  for (const [sid, count] of assocCount) {
    if (count > 1) {
      const s = getSubnet(arch, sid);
      err('subnet-multi-assoc', `Subnet ${s ? s.name : sid} is associated with ${count} route tables; AWS allows exactly one.`, [sid]);
    }
  }

  // --- Workloads ---
  const TYPE_LABEL = { ec2: 'EC2 instance', alb: 'load balancer', rds: 'RDS instance' };
  for (const wl of arch.workloads) {
    const label = `${TYPE_LABEL[wl.type]} ${wl.name}`;
    if (wl.subnetIds.some((sid) => !getSubnet(arch, sid))) {
      err('workload-subnet-missing', `${label} references a subnet that doesn't exist.`, [wl.id]);
    }
    if (wl.sgIds.some((gid) => !getSecurityGroup(arch, gid))) {
      err('workload-sg-missing', `${label} references a security group that doesn't exist.`, [wl.id]);
    }
    const azs = workloadAzs(arch, wl);
    if (wl.type === 'ec2' && wl.subnetIds.length !== 1) {
      err('ec2-subnet-count', `${label} must live in exactly one subnet (has ${wl.subnetIds.length}).`, [wl.id]);
    }
    if (wl.type === 'alb' && (wl.subnetIds.length < 2 || azs.length < 2)) {
      err('alb-subnet-spread', `${label} needs at least two subnets in two different AZs.`, [wl.id]);
    }
    if (wl.type === 'rds' && (wl.subnetIds.length < 2 || azs.length < 2)) {
      err('rds-subnet-spread', `${label}: a DB subnet group needs at least two subnets across two AZs.`, [wl.id]);
    }
  }

  return { errors };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/archValidate.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/lib/archValidate.js js/lib/archValidate.test.mjs
git commit -m "Add structural validation for architecture challenge designs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 3: Connectivity simulation (`archSimulate.js`)

**Files:**
- Create: `js/lib/archSimulate.js`
- Test: `js/lib/archSimulate.test.mjs` (create)

**Interfaces:**
- Consumes: `parseCidrStrict`, `cidrContains`, `cidrContainsIp` (new, this task), `ipToInt`, `intToIp` from `vpcMath.js` — actually `cidrContainsIp` lives here in `archSimulate.js` as a private helper built on `parseCidrStrict` + `ipToInt`; `effectiveRouteTable`, `getSubnet`, `getNat`, `getSecurityGroup`, `getWorkload` from `archModel.js`.
- Produces:
  - `INTERNET_TEST_IP = '198.51.100.1'` (TEST-NET-2; never inside an RFC1918 VPC block).
  - `resolveRoute(arch, subnetId, destIp): {target, destCidr} | null` — longest-prefix match over the subnet's effective route table plus the implicit local route (`{destCidr: vpc.cidr, target: 'local'}`); routes with unparseable destinations are skipped; `null` means no route matches.
  - `sourceToWorkload(arch, source, workloadId, port): {ok, trace}` where `source` is `{type: 'internet'}` or `{type: 'cidr', cidr}`. `trace` is an array of `{label, ok}` steps, fully evaluated even after the first failure.
  - `internetToWorkload(arch, workloadId, port)` — sugar for `sourceToWorkload` with `{type: 'internet'}`.
  - `workloadToWorkload(arch, fromId, toId, port): {ok, trace}`.
  - `workloadToInternet(arch, workloadId): {ok, trace}` — outbound/egress.
  - `isInternetOpen(arch, workloadId): boolean` — has a public inbound path (EC2: public IP + public subnet + IGW; ALB: all subnets public + IGW; RDS: never) AND some attached SG rule with source `0.0.0.0/0`. Used by the `noInternetReach` goal.
- Trace step labels are user-facing sentences (rendered escaped by the UI); tests assert on `ok` flags and a few key substrings, not exact copy.

Semantics fixed by this task (Task 5 and the challenge data rely on them):
- Inbound to a multi-subnet workload (ALB) requires **all** its subnets to pass the routing check.
- SG matching: a workload with **no SG attached denies all inbound** ("no security group attached" trace step). A rule matches when `proto` is `tcp` or `all`, `portFrom ≤ port ≤ portTo`, and the source matches: `sg:<id>` sources match when the *sending workload* has that SG attached; CIDR sources match internet sources when the rule block contains `INTERNET_TEST_IP`, match `{type:'cidr'}` sources when the rule block contains the whole source block, and match workload sources when the rule block contains **all** of the sender's subnet blocks.
- Egress via `nat:<id>` requires the NAT's own subnet to route `INTERNET_TEST_IP` to an attached IGW (a NAT in a private subnet dead-ends, with a trace step saying exactly that).
- Egress via `igw` requires `publicIp` for EC2 (trace step "route goes straight to the IGW but the instance has no public IP"); ALB/RDS never originate egress in our model, but the function still evaluates routing so sandbox traces make sense.

- [ ] **Step 1: Write the failing tests**

Create `js/lib/archSimulate.test.mjs`:

```js
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
```

(The ALB test associates `public-b` with the same "public" table — `associateSubnet` only re-homes the subnet named in the call, so `pub` stays associated and both subnets end up public.)

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/lib/archSimulate.test.mjs`
Expected: FAIL — `Cannot find module '.../js/lib/archSimulate.js'`

- [ ] **Step 3: Implement `js/lib/archSimulate.js`**

```js
// aws/js/lib/archSimulate.js
//
// Connectivity simulation for the Architecture Challenge. Every evaluator
// returns { ok, trace } where trace is an ordered list of { label, ok }
// steps written as user-facing sentences; the whole trace is evaluated even
// after a failure so the results panel can show everything that's wrong
// with a path, not just the first broken hop. Security groups are inbound-
// only (outbound is implicitly allow-all — stated in the UI).

import { parseCidrStrict, ipToInt } from './vpcMath.js';
import {
  effectiveRouteTable, getSubnet, getNat, getSecurityGroup, getWorkload,
} from './archModel.js';

// TEST-NET-2: representative "somewhere on the internet" address. Never
// inside the RFC1918 blocks the challenges use for VPC CIDRs.
export const INTERNET_TEST_IP = '198.51.100.1';

function blockContainsIp(block, ip) {
  const int = ipToInt(ip);
  return block.network <= int && int <= block.broadcast;
}

function ruleCidrCovers(ruleSource, block) {
  const ruleBlock = parseCidrStrict(ruleSource);
  return !!ruleBlock && ruleBlock.network <= block.network && block.broadcast <= ruleBlock.broadcast;
}

// Longest-prefix match over the subnet's effective route table plus the
// implicit local route. Routes with unparseable destinations are skipped
// (structural validation reports them). Returns null when nothing matches.
export function resolveRoute(arch, subnetId, destIp) {
  const rt = effectiveRouteTable(arch, subnetId);
  const candidates = [{ destCidr: arch.vpc.cidr, target: 'local' }, ...(rt ? rt.routes : [])];
  let best = null;
  let bestLen = -1;
  for (const route of candidates) {
    const block = parseCidrStrict(route.destCidr);
    if (!block || !blockContainsIp(block, destIp)) continue;
    if (block.prefixLen > bestLen) {
      best = { target: route.target, destCidr: route.destCidr };
      bestLen = block.prefixLen;
    }
  }
  return best;
}

// source: { type: 'internet' } | { type: 'cidr', cidr } | { type: 'workload', workload }
function sgAllows(arch, workload, port, source) {
  if (workload.sgIds.length === 0) {
    return { ok: false, label: `${workload.name} has no security group attached — all inbound traffic is denied` };
  }
  const senderBlocks = source.type === 'workload'
    ? source.workload.subnetIds
        .map((sid) => getSubnet(arch, sid))
        .filter(Boolean)
        .map((s) => parseCidrStrict(s.cidr))
        .filter(Boolean)
    : null;
  for (const sgId of workload.sgIds) {
    const sg = getSecurityGroup(arch, sgId);
    if (!sg) continue;
    for (const rule of sg.inbound) {
      if (rule.proto !== 'tcp' && rule.proto !== 'all') continue;
      if (port < rule.portFrom || port > rule.portTo) continue;
      if (rule.source.startsWith('sg:')) {
        if (source.type === 'workload' && source.workload.sgIds.includes(rule.source.slice(3))) {
          return { ok: true, label: `Security group ${sg.name} allows TCP ${port} from security group ${describeSgSource(arch, rule.source)}` };
        }
        continue;
      }
      if (source.type === 'internet' && ruleCidrCovers(rule.source, parseCidrStrict(`${INTERNET_TEST_IP}/32`))) {
        return { ok: true, label: `Security group ${sg.name} allows TCP ${port} from ${rule.source}` };
      }
      if (source.type === 'cidr') {
        const srcBlock = parseCidrStrict(source.cidr);
        if (srcBlock && ruleCidrCovers(rule.source, srcBlock)) {
          return { ok: true, label: `Security group ${sg.name} allows TCP ${port} from ${rule.source}` };
        }
      }
      if (source.type === 'workload' && senderBlocks.length > 0
          && senderBlocks.every((b) => ruleCidrCovers(rule.source, b))) {
        return { ok: true, label: `Security group ${sg.name} allows TCP ${port} from ${rule.source} (covers ${source.workload.name}'s subnets)` };
      }
    }
  }
  const from = source.type === 'internet' ? 'the internet'
    : source.type === 'cidr' ? source.cidr
    : source.workload.name;
  return { ok: false, label: `No security group on ${workload.name} allows TCP ${port} from ${from}` };
}

function describeSgSource(arch, sgSource) {
  const sg = getSecurityGroup(arch, sgSource.slice(3));
  return sg ? sg.name : sgSource.slice(3);
}

// Inbound from outside the VPC. For EC2 the packet needs: attached IGW, a
// public-subnet route back out, a public IP on the instance, and an SG
// rule. For an ALB every one of its subnets must be public (an
// internet-facing ALB in a private subnet is a classic broken setup).
export function sourceToWorkload(arch, source, workloadId, port) {
  const wl = getWorkload(arch, workloadId);
  const trace = [];
  const testIp = source.type === 'cidr'
    ? (() => { const b = parseCidrStrict(source.cidr); return b ? intToIpSafe(b.network + 1) : INTERNET_TEST_IP; })()
    : INTERNET_TEST_IP;
  trace.push({
    label: arch.vpc.igwAttached
      ? 'Internet gateway is attached to the VPC'
      : 'No internet gateway is attached to the VPC',
    ok: arch.vpc.igwAttached,
  });
  for (const sid of wl.subnetIds) {
    const subnet = getSubnet(arch, sid);
    if (!subnet) continue; // structural validation reports dangling refs
    const route = resolveRoute(arch, sid, testIp);
    const viaIgw = !!route && route.target === 'igw';
    trace.push({
      label: viaIgw
        ? `Subnet ${subnet.name} routes internet traffic to the IGW (public subnet)`
        : `Subnet ${subnet.name} has no route to the internet gateway — it's a private subnet`,
      ok: viaIgw,
    });
  }
  if (wl.type === 'ec2') {
    trace.push({
      label: wl.publicIp
        ? `${wl.name} has a public IP`
        : `${wl.name} has no public IP — the internet can't address it`,
      ok: wl.publicIp,
    });
  }
  trace.push(sgAllows(arch, wl, port, source));
  return { ok: trace.every((s) => s.ok), trace };
}

function intToIpSafe(int) {
  return [24, 16, 8, 0].map((shift) => (int >>> shift) & 0xff).join('.');
}

export function internetToWorkload(arch, workloadId, port) {
  return sourceToWorkload(arch, { type: 'internet' }, workloadId, port);
}

// Intra-VPC traffic: the implicit local route always covers it, so the
// interesting check is the destination's security group.
export function workloadToWorkload(arch, fromId, toId, port) {
  const from = getWorkload(arch, fromId);
  const to = getWorkload(arch, toId);
  const trace = [
    { label: `${from.name} → ${to.name} stays inside the VPC — the implicit local route covers it`, ok: true },
    sgAllows(arch, to, port, { type: 'workload', workload: from }),
  ];
  return { ok: trace.every((s) => s.ok), trace };
}

// Outbound to the internet. Public-IP instances go straight out the IGW;
// everything else needs a NAT gateway that itself lives in a public subnet.
export function workloadToInternet(arch, workloadId) {
  const wl = getWorkload(arch, workloadId);
  const trace = [];
  for (const sid of wl.subnetIds) {
    const subnet = getSubnet(arch, sid);
    if (!subnet) continue;
    const route = resolveRoute(arch, sid, INTERNET_TEST_IP);
    if (!route) {
      trace.push({ label: `Subnet ${subnet.name} has no route to the internet (add a 0.0.0.0/0 route)`, ok: false });
      continue;
    }
    if (route.target === 'local') {
      trace.push({ label: `Subnet ${subnet.name} only routes locally — no path to the internet`, ok: false });
      continue;
    }
    if (route.target === 'igw') {
      const ok = arch.vpc.igwAttached && (wl.type !== 'ec2' || wl.publicIp);
      trace.push({
        label: !arch.vpc.igwAttached
          ? `Subnet ${subnet.name} routes to an IGW that isn't attached`
          : ok
            ? `Subnet ${subnet.name} routes straight out the attached IGW${wl.type === 'ec2' ? ` and ${wl.name} has a public IP` : ''}`
            : `Subnet ${subnet.name} routes straight to the IGW, but ${wl.name} has no public IP — return traffic has nowhere to go`,
        ok,
      });
      continue;
    }
    // nat:<id>
    const nat = getNat(arch, route.target.slice(4));
    if (!nat) {
      trace.push({ label: `Subnet ${subnet.name} routes to a NAT gateway that doesn't exist`, ok: false });
      continue;
    }
    const natSubnet = getSubnet(arch, nat.subnetId);
    const natRoute = natSubnet ? resolveRoute(arch, natSubnet.id, INTERNET_TEST_IP) : null;
    const natOk = !!natRoute && natRoute.target === 'igw' && arch.vpc.igwAttached;
    trace.push({
      label: natOk
        ? `Subnet ${subnet.name} routes through NAT ${nat.id} in public subnet ${natSubnet.name}, then out the IGW`
        : `Subnet ${subnet.name} routes to NAT ${nat.id}, but the NAT's own subnet${natSubnet ? ` (${natSubnet.name})` : ''} has no IGW route — a NAT gateway must live in a public subnet`,
      ok: natOk,
    });
  }
  if (trace.length === 0) {
    trace.push({ label: `${wl.name} isn't placed in any subnet`, ok: false });
  }
  return { ok: trace.every((s) => s.ok), trace };
}

// "Open to the internet": a public inbound path AND any SG rule whose
// source is 0.0.0.0/0. RDS never has a public path in this model (no
// public-IP concept) — placement in a public subnet is a best-practice
// warning instead.
export function isInternetOpen(arch, workloadId) {
  const wl = getWorkload(arch, workloadId);
  if (wl.type === 'rds') return false;
  if (!arch.vpc.igwAttached) return false;
  if (wl.type === 'ec2' && !wl.publicIp) return false;
  const subnets = wl.subnetIds.map((sid) => getSubnet(arch, sid)).filter(Boolean);
  if (subnets.length === 0) return false;
  const allPublic = subnets.every((s) => {
    const route = resolveRoute(arch, s.id, INTERNET_TEST_IP);
    return !!route && route.target === 'igw';
  });
  if (!allPublic) return false;
  return wl.sgIds.some((sgId) => {
    const sg = getSecurityGroup(arch, sgId);
    return !!sg && sg.inbound.some((r) => r.source === '0.0.0.0/0');
  });
}
```

Implementation note: `intToIpSafe` duplicates `vpcMath.intToIp` — during implementation just import `intToIp` from `./vpcMath.js` instead and delete the local copy (shown inline here only to keep the snippet self-contained).

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/archSimulate.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/lib/archSimulate.js js/lib/archSimulate.test.mjs
git commit -m "Add connectivity simulation with human-readable traces

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 4: Best-practice rules (`archValidate.js`, part 2)

**Files:**
- Modify: `js/lib/archValidate.js` (append)
- Test: `js/lib/archValidate.test.mjs` (append)

**Interfaces:**
- Consumes: `isPublicSubnet`, `getSubnet`, `getSecurityGroup`, `workloadAzs` from `archModel.js`; `resolveRoute`, `INTERNET_TEST_IP` from `archSimulate.js`; `parseCidrStrict`, `cidrContains` from `vpcMath.js`.
- Produces: `BEST_PRACTICE_RULE_IDS: string[]` (for the content validator) and `evaluateBestPractices(arch, ruleIds = 'all'): [{ruleId, applicable, ok, message, why}]` — one entry per *selected* rule, in the fixed rule order. `applicable: false` entries are excluded from scoring by callers; `message` states what was checked (pass) or what's wrong (fail); `why` is a one-sentence rationale.

The seven rules:

| ruleId | applicable when | ok when |
|---|---|---|
| `db-in-private-subnet` | any RDS workload exists | every RDS subnet is private (`!isPublicSubnet`) |
| `no-open-ssh` | any SG has inbound rules | no rule allows TCP 22 (within its port range) from `0.0.0.0/0` |
| `no-open-db-port` | any RDS workload with an attached SG | no SG **attached to an RDS workload** allows that workload's port from `0.0.0.0/0` |
| `least-privilege-sg` | any SG rule has a CIDR source | no rule's source CIDR sits inside the VPC CIDR (intra-VPC access should use SG references) |
| `nat-per-az` | subnets in ≥ 2 AZs default-route to a NAT | every such AZ contains at least one NAT gateway in that same AZ |
| `single-az` | any workload has subnets | the union of all workloads' AZs spans ≥ 2 |
| `unused-resources` | always | no NAT unreferenced by routes, no SG unattached to workloads and unreferenced by `sg:` rules, no non-main route table with zero associated subnets |

- [ ] **Step 1: Write the failing tests**

Append to `js/lib/archValidate.test.mjs` (extend the archModel import with `addRouteTable`… already imported; add `evaluateBestPractices`, `BEST_PRACTICE_RULE_IDS` to the archValidate import):

```js
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
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/lib/archValidate.test.mjs`
Expected: FAIL — `evaluateBestPractices` is not exported.

- [ ] **Step 3: Implement the best-practice rules**

Append to `js/lib/archValidate.js` (extend its imports: `isPublicSubnet`, `workloadAzs` are already imported; add `getNat` if unused elsewhere — final import list from archModel: `getSubnet`, `getSecurityGroup`, `isPublicSubnet`, `workloadAzs`; from archSimulate: `resolveRoute`, `INTERNET_TEST_IP`; from vpcMath additionally `cidrContains`):

```js
// ---------------------------------------------------------------------------
// Best-practice rules (advisory). Each evaluator returns
// { applicable, ok, message } — `why` comes from the rule table. Callers
// score passed ÷ applicable; inapplicable rules are skipped entirely.
// ---------------------------------------------------------------------------

function ruleCoversPort(rule, port) {
  return (rule.proto === 'tcp' || rule.proto === 'all') && rule.portFrom <= port && port <= rule.portTo;
}

const BEST_PRACTICE_RULES = [
  {
    id: 'db-in-private-subnet',
    why: 'Databases should never be directly addressable from the internet; put them in subnets with no IGW route.',
    evaluate(arch) {
      const dbs = arch.workloads.filter((w) => w.type === 'rds');
      if (dbs.length === 0) return { applicable: false };
      const exposed = dbs.filter((db) => db.subnetIds.some((sid) => isPublicSubnet(arch, sid)));
      return exposed.length === 0
        ? { applicable: true, ok: true, message: 'Every database subnet is private.' }
        : { applicable: true, ok: false, message: `${exposed.map((d) => d.name).join(', ')}: DB subnet group includes a public subnet.` };
    },
  },
  {
    id: 'no-open-ssh',
    why: 'SSH open to 0.0.0.0/0 invites brute-force scans; restrict it to a known CIDR or use SSM Session Manager.',
    evaluate(arch) {
      const sgs = arch.securityGroups.filter((sg) => sg.inbound.length > 0);
      if (sgs.length === 0) return { applicable: false };
      const open = sgs.filter((sg) => sg.inbound.some((r) => r.source === '0.0.0.0/0' && ruleCoversPort(r, 22)));
      return open.length === 0
        ? { applicable: true, ok: true, message: 'No security group exposes SSH to the whole internet.' }
        : { applicable: true, ok: false, message: `${open.map((g) => g.name).join(', ')}: allows TCP 22 from 0.0.0.0/0.` };
    },
  },
  {
    id: 'no-open-db-port',
    why: 'The database port should only accept traffic from the application tier, never the internet.',
    evaluate(arch) {
      const dbs = arch.workloads.filter((w) => w.type === 'rds' && w.sgIds.length > 0);
      if (dbs.length === 0) return { applicable: false };
      const exposed = dbs.filter((db) => db.sgIds.some((sgId) => {
        const sg = getSecurityGroup(arch, sgId);
        return !!sg && sg.inbound.some((r) => r.source === '0.0.0.0/0' && ruleCoversPort(r, db.port));
      }));
      return exposed.length === 0
        ? { applicable: true, ok: true, message: 'No database port is open to the internet.' }
        : { applicable: true, ok: false, message: `${exposed.map((d) => d.name).join(', ')}: DB port open to 0.0.0.0/0.` };
    },
  },
  {
    id: 'least-privilege-sg',
    why: 'Referencing a security group instead of a CIDR keeps the rule correct even as instances and subnets change.',
    evaluate(arch) {
      const vpcBlock = parseCidrStrict(arch.vpc.cidr);
      const cidrRules = [];
      for (const sg of arch.securityGroups) {
        for (const r of sg.inbound) {
          if (!r.source.startsWith('sg:')) cidrRules.push({ sg, r });
        }
      }
      if (cidrRules.length === 0 || !vpcBlock) return { applicable: false };
      const broad = cidrRules.filter(({ r }) => {
        const block = parseCidrStrict(r.source);
        return !!block && cidrContains(vpcBlock, block);
      });
      return broad.length === 0
        ? { applicable: true, ok: true, message: 'Intra-VPC traffic is allowed via SG references, not CIDR ranges.' }
        : { applicable: true, ok: false, message: `${[...new Set(broad.map(({ sg }) => sg.name))].join(', ')}: allows intra-VPC CIDR ranges — reference the source security group instead.` };
    },
  },
  {
    id: 'nat-per-az',
    why: 'A single NAT gateway is a single point of failure and adds cross-AZ data charges for other AZs.',
    evaluate(arch) {
      const natAzsNeeded = new Set();
      for (const s of arch.subnets) {
        const route = resolveRoute(arch, s.id, INTERNET_TEST_IP);
        if (route && route.target.startsWith('nat:')) natAzsNeeded.add(s.az);
      }
      if (natAzsNeeded.size < 2) return { applicable: false };
      const natAzs = new Set(
        arch.natGateways.map((n) => getSubnet(arch, n.subnetId)).filter(Boolean).map((s) => s.az),
      );
      const uncovered = [...natAzsNeeded].filter((az) => !natAzs.has(az));
      return uncovered.length === 0
        ? { applicable: true, ok: true, message: 'Every AZ that egresses through NAT has its own NAT gateway.' }
        : { applicable: true, ok: false, message: `AZ ${uncovered.join(', ')} egresses through a NAT gateway in another AZ.` };
    },
  },
  {
    id: 'single-az',
    why: 'An AZ outage takes down everything in it; spreading workloads across AZs is the base layer of AWS high availability.',
    evaluate(arch) {
      const azs = new Set();
      let any = false;
      for (const wl of arch.workloads) {
        for (const az of workloadAzs(arch, wl)) { azs.add(az); any = true; }
      }
      if (!any) return { applicable: false };
      return azs.size >= 2
        ? { applicable: true, ok: true, message: 'Workloads span multiple Availability Zones.' }
        : { applicable: true, ok: false, message: 'Everything runs in a single Availability Zone.' };
    },
  },
  {
    id: 'unused-resources',
    why: 'Idle NAT gateways bill hourly, and orphaned SGs/route tables make the design harder to reason about.',
    evaluate(arch) {
      const unused = [];
      const routedNats = new Set();
      for (const rt of arch.routeTables) {
        for (const r of rt.routes) {
          if (typeof r.target === 'string' && r.target.startsWith('nat:')) routedNats.add(r.target.slice(4));
        }
      }
      for (const nat of arch.natGateways) {
        if (!routedNats.has(nat.id)) unused.push(`NAT gateway ${nat.id} (no route uses it)`);
      }
      for (const sg of arch.securityGroups) {
        const attached = arch.workloads.some((w) => w.sgIds.includes(sg.id));
        const referenced = arch.securityGroups.some((other) => other.inbound.some((r) => r.source === `sg:${sg.id}`));
        if (!attached && !referenced) unused.push(`security group ${sg.name} (attached to nothing)`);
      }
      for (const rt of arch.routeTables) {
        if (!rt.isMain && rt.subnetIds.length === 0) unused.push(`route table ${rt.name} (no subnets associated)`);
      }
      return unused.length === 0
        ? { applicable: true, ok: true, message: 'No unused NAT gateways, security groups, or route tables.' }
        : { applicable: true, ok: false, message: `Unused: ${unused.join('; ')}.` };
    },
  },
];

export const BEST_PRACTICE_RULE_IDS = BEST_PRACTICE_RULES.map((r) => r.id);

export function evaluateBestPractices(arch, ruleIds = 'all') {
  const selected = ruleIds === 'all'
    ? BEST_PRACTICE_RULES
    : BEST_PRACTICE_RULES.filter((r) => ruleIds.includes(r.id));
  return selected.map((rule) => {
    const result = rule.evaluate(arch);
    return {
      ruleId: rule.id,
      applicable: result.applicable,
      ok: result.applicable ? result.ok : true,
      message: result.applicable ? result.message : 'Not applicable to this design.',
      why: rule.why,
    };
  });
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/archValidate.test.mjs`
Expected: PASS (structural + best-practice tests).

- [ ] **Step 5: Commit**

```bash
git add js/lib/archValidate.js js/lib/archValidate.test.mjs
git commit -m "Add advisory best-practice rules with scoring metadata

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 5: Goal evaluation (`archGoals.js`)

**Files:**
- Create: `js/lib/archGoals.js`
- Test: `js/lib/archGoals.test.mjs` (create)

**Interfaces:**
- Consumes: `workloadsByRole`, `workloadAzs`, `isPublicSubnet`, `getSubnet` from `archModel.js`; `sourceToWorkload`, `internetToWorkload`, `workloadToWorkload`, `workloadToInternet`, `isInternetOpen` from `archSimulate.js`; `parseCidrStrict`, `usableAddresses` from `vpcMath.js`.
- Produces:
  - `GOAL_TYPES: string[]` — `['exists', 'internetReaches', 'cidrReaches', 'noInternetReach', 'reaches', 'hasEgress', 'spansAzs', 'multiAz', 'vpcCidrIs', 'subnetPlan']` (the content validator checks challenge data against this).
  - `evaluateGoals(arch, challenge): [{goal, label, ok, detail, traces}]` — one row per challenge goal, in order. `label` is the human sentence (built with the challenge's role labels), `detail` is a short outcome note (e.g. which pair failed, or "no workload assigned to role …"), `traces` is an array of simulation traces (possibly empty for non-simulation goals).
- Role-quantifier semantics (fixed here, relied on by challenge data): a goal referencing a role with **zero assigned workloads fails** with detail `No workload is assigned the role "<label>".` — except that role-emptiness is exactly what `exists` checks, so briefs should always include an `exists` goal per role. `internetReaches`/`cidrReaches`/`hasEgress` must hold for **every** workload with the role; `reaches` for **every from × to pair**; `noInternetReach` requires **no** workload with the role to be internet-open; `spansAzs` counts the union of AZs across the role's workloads.

Goal shapes (author-facing, used in `archChallenges.js`):

```js
{ type: 'exists', role, workloadType }            // workloadType optional: any type
{ type: 'internetReaches', role, port }
{ type: 'cidrReaches', cidr, cidrLabel, role, port } // cidrLabel e.g. 'the office'
{ type: 'noInternetReach', role }
{ type: 'reaches', fromRole, toRole, port }
{ type: 'hasEgress', role }
{ type: 'spansAzs', role, min }
{ type: 'multiAz', role }
{ type: 'vpcCidrIs', cidr }
{ type: 'subnetPlan', count, minUsableHosts, minAzs, publicCount, privateCount }
```

- [ ] **Step 1: Write the failing tests**

Create `js/lib/archGoals.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload,
} from './archModel.js';
import { GOAL_TYPES, evaluateGoals } from './archGoals.js';

const CH = {
  roles: [
    { id: 'web', label: 'web server', expectedType: 'ec2' },
    { id: 'db', label: 'database', expectedType: 'rds' },
  ],
};

function goals(arch, goalList) {
  return evaluateGoals(arch, { ...CH, goals: goalList });
}

function publicWebArch() {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const s = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const rt = addRouteTable(arch, 'public');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, rt.id, s.id);
  const sg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  addWorkload(arch, { type: 'ec2', role: 'web', subnetIds: [s.id], sgIds: [sg.id], publicIp: true });
  return arch;
}

test('GOAL_TYPES is the fixed vocabulary', () => {
  assert.deepEqual(GOAL_TYPES, [
    'exists', 'internetReaches', 'cidrReaches', 'noInternetReach', 'reaches',
    'hasEgress', 'spansAzs', 'multiAz', 'vpcCidrIs', 'subnetPlan',
  ]);
});

test('exists checks role assignment and type', () => {
  const arch = publicWebArch();
  const [r1] = goals(arch, [{ type: 'exists', role: 'web', workloadType: 'ec2' }]);
  assert.equal(r1.ok, true);
  const [r2] = goals(arch, [{ type: 'exists', role: 'db', workloadType: 'rds' }]);
  assert.equal(r2.ok, false);
  assert.match(r2.detail, /database/);
});

test('internetReaches passes for the public web arch and fails once broken', () => {
  const arch = publicWebArch();
  const [r] = goals(arch, [{ type: 'internetReaches', role: 'web', port: 80 }]);
  assert.equal(r.ok, true);
  assert.equal(r.traces.length, 1);
  arch.vpc.igwAttached = false;
  const [r2] = goals(arch, [{ type: 'internetReaches', role: 'web', port: 80 }]);
  assert.equal(r2.ok, false);
});

test('goals referencing an empty role fail with a helpful detail', () => {
  const arch = createArch();
  for (const g of [
    { type: 'internetReaches', role: 'web', port: 80 },
    { type: 'hasEgress', role: 'web' },
    { type: 'spansAzs', role: 'web', min: 2 },
    { type: 'multiAz', role: 'db' },
    { type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 },
  ]) {
    const [r] = goals(arch, [g]);
    assert.equal(r.ok, false, g.type);
    assert.match(r.detail, /No workload is assigned/i, g.type);
  }
});

test('noInternetReach: open SG + public path fails it; closing either passes it', () => {
  const arch = publicWebArch();
  const [r] = goals(arch, [{ type: 'noInternetReach', role: 'web' }]);
  assert.equal(r.ok, false, 'web is internet-open');
  arch.workloads[0].publicIp = false;
  const [r2] = goals(arch, [{ type: 'noInternetReach', role: 'web' }]);
  assert.equal(r2.ok, true);
});

test('noInternetReach passes when the role is empty (nothing is exposed)', () => {
  const [r] = goals(createArch(), [{ type: 'noInternetReach', role: 'web' }]);
  assert.equal(r.ok, true);
});

test('reaches evaluates every from×to pair', () => {
  const arch = publicWebArch();
  const priv = addSubnet(arch, { name: 'private-a', az: 'a', cidr: '10.0.2.0/24' });
  const privB = addSubnet(arch, { name: 'private-b', az: 'b', cidr: '10.0.3.0/24' });
  const dbSg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: 'sg:sg-1' }); // web-sg is sg-1
  addWorkload(arch, { type: 'rds', role: 'db', subnetIds: [priv.id, privB.id], sgIds: [dbSg.id] });
  const [r] = goals(arch, [{ type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 }]);
  assert.equal(r.ok, true);
  dbSg.inbound.length = 0;
  const [r2] = goals(arch, [{ type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 }]);
  assert.equal(r2.ok, false);
});

test('spansAzs, multiAz, vpcCidrIs', () => {
  const arch = publicWebArch();
  const [az1] = goals(arch, [{ type: 'spansAzs', role: 'web', min: 2 }]);
  assert.equal(az1.ok, false);
  const sb = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.4.0/24' });
  associateSubnet(arch, arch.routeTables.find((t) => t.name === 'public').id, sb.id);
  addWorkload(arch, { type: 'ec2', role: 'web', subnetIds: [sb.id], sgIds: ['sg-1'], publicIp: true });
  const [az2] = goals(arch, [{ type: 'spansAzs', role: 'web', min: 2 }]);
  assert.equal(az2.ok, true);

  const priv = addSubnet(arch, { az: 'a', cidr: '10.0.5.0/24' });
  const privB = addSubnet(arch, { az: 'b', cidr: '10.0.6.0/24' });
  const db = addWorkload(arch, { type: 'rds', role: 'db', subnetIds: [priv.id, privB.id], multiAz: false });
  const [ma1] = goals(arch, [{ type: 'multiAz', role: 'db' }]);
  assert.equal(ma1.ok, false);
  db.multiAz = true;
  const [ma2] = goals(arch, [{ type: 'multiAz', role: 'db' }]);
  assert.equal(ma2.ok, true);

  const [vc1] = goals(arch, [{ type: 'vpcCidrIs', cidr: '10.0.0.0/16' }]);
  assert.equal(vc1.ok, true);
  const [vc2] = goals(arch, [{ type: 'vpcCidrIs', cidr: '10.0.0.0/24' }]);
  assert.equal(vc2.ok, false);
});

test('subnetPlan checks count, sizing, AZ spread, and public/private split', () => {
  const arch = createArch();
  arch.vpc.cidr = '10.0.0.0/24';
  arch.vpc.igwAttached = true;
  const plan = { type: 'subnetPlan', count: 4, minUsableHosts: 50, minAzs: 2, publicCount: 2, privateCount: 2 };
  assert.equal(goals(arch, [plan])[0].ok, false, 'empty fails');
  const pubA = addSubnet(arch, { az: 'a', cidr: '10.0.0.0/26' });
  const pubB = addSubnet(arch, { az: 'b', cidr: '10.0.0.64/26' });
  addSubnet(arch, { az: 'a', cidr: '10.0.0.128/26' });
  addSubnet(arch, { az: 'b', cidr: '10.0.0.192/26' });
  const rt = addRouteTable(arch, 'public');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, rt.id, pubA.id);
  associateSubnet(arch, rt.id, pubB.id);
  assert.equal(goals(arch, [plan])[0].ok, true);
  assert.equal(goals(arch, [{ ...plan, minUsableHosts: 60 }])[0].ok, false, '/26 has 59 usable');
});

test('every goal row carries a non-empty human label', () => {
  const arch = publicWebArch();
  const rows = goals(arch, [
    { type: 'exists', role: 'web', workloadType: 'ec2' },
    { type: 'internetReaches', role: 'web', port: 80 },
    { type: 'cidrReaches', cidr: '203.0.113.0/24', cidrLabel: 'the office', role: 'web', port: 22 },
  ]);
  for (const row of rows) {
    assert.equal(typeof row.label, 'string');
    assert.ok(row.label.length > 10, row.label);
  }
  assert.match(rows[2].label, /the office/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/lib/archGoals.test.mjs`
Expected: FAIL — `Cannot find module '.../js/lib/archGoals.js'`

- [ ] **Step 3: Implement `js/lib/archGoals.js`**

```js
// aws/js/lib/archGoals.js
//
// Turns a challenge's declarative goal list into evaluated results. Each
// row: { goal, label, ok, detail, traces }. Quantifiers: role goals apply
// to EVERY workload carrying the role (reaches: every from×to pair);
// spansAzs counts the union. A goal referencing an empty role fails —
// except noInternetReach, where an empty role trivially exposes nothing.

import {
  workloadsByRole, workloadAzs, isPublicSubnet, getSubnet,
} from './archModel.js';
import {
  sourceToWorkload, internetToWorkload, workloadToWorkload,
  workloadToInternet, isInternetOpen,
} from './archSimulate.js';
import { parseCidrStrict, usableAddresses } from './vpcMath.js';

export const GOAL_TYPES = [
  'exists', 'internetReaches', 'cidrReaches', 'noInternetReach', 'reaches',
  'hasEgress', 'spansAzs', 'multiAz', 'vpcCidrIs', 'subnetPlan',
];

const TYPE_LABEL = { ec2: 'an EC2 instance', alb: 'an Application Load Balancer', rds: 'an RDS database' };

function roleLabel(challenge, roleId) {
  const role = challenge.roles.find((r) => r.id === roleId);
  return role ? role.label : roleId;
}

function emptyRoleResult(goal, label, challenge, roleId) {
  return {
    goal, label, ok: false,
    detail: `No workload is assigned the role "${roleLabel(challenge, roleId)}".`,
    traces: [],
  };
}

export function evaluateGoals(arch, challenge) {
  return challenge.goals.map((goal) => evaluateGoal(arch, challenge, goal));
}

function evaluateGoal(arch, challenge, goal) {
  const rl = (id) => roleLabel(challenge, id);
  switch (goal.type) {
    case 'exists': {
      const wanted = goal.workloadType ? TYPE_LABEL[goal.workloadType] : 'a workload';
      const label = `The design includes ${wanted} serving as the ${rl(goal.role)}`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const wrong = goal.workloadType ? members.filter((w) => w.type !== goal.workloadType) : [];
      return wrong.length === 0
        ? { goal, label, ok: true, detail: `${members.map((w) => w.name).join(', ')} fills the role.`, traces: [] }
        : { goal, label, ok: false, detail: `${wrong.map((w) => w.name).join(', ')} is not ${wanted}.`, traces: [] };
    }
    case 'internetReaches':
    case 'cidrReaches': {
      const fromText = goal.type === 'internetReaches' ? 'the internet' : (goal.cidrLabel || goal.cidr);
      const label = `The ${rl(goal.role)} is reachable from ${fromText} on port ${goal.port}`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const traces = [];
      let ok = true;
      for (const wl of members) {
        const res = goal.type === 'internetReaches'
          ? internetToWorkload(arch, wl.id, goal.port)
          : sourceToWorkload(arch, { type: 'cidr', cidr: goal.cidr }, wl.id, goal.port);
        traces.push({ title: `${fromText} → ${wl.name}:${goal.port}`, ...res });
        ok = ok && res.ok;
      }
      return { goal, label, ok, detail: ok ? 'Reachable.' : 'At least one path fails — see the trace.', traces };
    }
    case 'noInternetReach': {
      const label = `The ${rl(goal.role)} is NOT directly reachable from the internet`;
      const members = workloadsByRole(arch, goal.role);
      const open = members.filter((wl) => isInternetOpen(arch, wl.id));
      return open.length === 0
        ? { goal, label, ok: true, detail: 'Nothing in this role is internet-open.', traces: [] }
        : { goal, label, ok: false, detail: `${open.map((w) => w.name).join(', ')} has a public path and a security group rule open to 0.0.0.0/0.`, traces: [] };
    }
    case 'reaches': {
      const label = `The ${rl(goal.fromRole)} can reach the ${rl(goal.toRole)} on port ${goal.port}`;
      const from = workloadsByRole(arch, goal.fromRole);
      const to = workloadsByRole(arch, goal.toRole);
      if (from.length === 0) return emptyRoleResult(goal, label, challenge, goal.fromRole);
      if (to.length === 0) return emptyRoleResult(goal, label, challenge, goal.toRole);
      const traces = [];
      let ok = true;
      for (const f of from) {
        for (const t of to) {
          const res = workloadToWorkload(arch, f.id, t.id, goal.port);
          traces.push({ title: `${f.name} → ${t.name}:${goal.port}`, ...res });
          ok = ok && res.ok;
        }
      }
      return { goal, label, ok, detail: ok ? 'All pairs connect.' : 'At least one pair is blocked — see the trace.', traces };
    }
    case 'hasEgress': {
      const label = `The ${rl(goal.role)} can reach the internet outbound (for updates and APIs)`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const traces = [];
      let ok = true;
      for (const wl of members) {
        const res = workloadToInternet(arch, wl.id);
        traces.push({ title: `${wl.name} → internet`, ...res });
        ok = ok && res.ok;
      }
      return { goal, label, ok, detail: ok ? 'Outbound path exists.' : 'Egress is broken — see the trace.', traces };
    }
    case 'spansAzs': {
      const label = `The ${rl(goal.role)} spans at least ${goal.min} Availability Zones`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const azs = new Set();
      for (const wl of members) for (const az of workloadAzs(arch, wl)) azs.add(az);
      const ok = azs.size >= goal.min;
      return { goal, label, ok, detail: `Covers ${azs.size} AZ${azs.size === 1 ? '' : 's'} (${[...azs].sort().join(', ') || 'none'}).`, traces: [] };
    }
    case 'multiAz': {
      const label = `The ${rl(goal.role)} uses RDS Multi-AZ for automatic failover`;
      const members = workloadsByRole(arch, goal.role);
      if (members.length === 0) return emptyRoleResult(goal, label, challenge, goal.role);
      const off = members.filter((w) => !(w.type === 'rds' && w.multiAz));
      return off.length === 0
        ? { goal, label, ok: true, detail: 'Multi-AZ is enabled.', traces: [] }
        : { goal, label, ok: false, detail: `${off.map((w) => w.name).join(', ')}: Multi-AZ is off (or not an RDS instance).`, traces: [] };
    }
    case 'vpcCidrIs': {
      const label = `The VPC uses the assigned CIDR block ${goal.cidr}`;
      const want = parseCidrStrict(goal.cidr);
      const got = parseCidrStrict(arch.vpc.cidr);
      const ok = !!want && !!got && want.network === got.network && want.prefixLen === got.prefixLen;
      return { goal, label, ok, detail: ok ? 'CIDR matches.' : `VPC CIDR is ${arch.vpc.cidr}.`, traces: [] };
    }
    case 'subnetPlan': {
      const label = `Subnet plan: ${goal.count} subnets (${goal.publicCount} public / ${goal.privateCount} private) across ${goal.minAzs}+ AZs, each with ≥ ${goal.minUsableHosts} usable IPs`;
      const problems = [];
      const parsed = arch.subnets.map((s) => ({ s, block: parseCidrStrict(s.cidr) }));
      if (arch.subnets.length < goal.count) problems.push(`only ${arch.subnets.length} of ${goal.count} subnets exist`);
      const small = parsed.filter(({ block }) => block && usableAddresses(block.prefixLen) < goal.minUsableHosts);
      if (small.length > 0) problems.push(`${small.map(({ s }) => s.name).join(', ')}: fewer than ${goal.minUsableHosts} usable IPs`);
      const azs = new Set(arch.subnets.map((s) => s.az));
      if (azs.size < goal.minAzs) problems.push(`subnets cover ${azs.size} AZ(s), need ${goal.minAzs}`);
      const publicCount = arch.subnets.filter((s) => isPublicSubnet(arch, s.id)).length;
      const privateCount = arch.subnets.length - publicCount;
      if (publicCount < goal.publicCount) problems.push(`${publicCount} public subnet(s), need ${goal.publicCount}`);
      if (privateCount < goal.privateCount) problems.push(`${privateCount} private subnet(s), need ${goal.privateCount}`);
      return {
        goal, label,
        ok: problems.length === 0,
        detail: problems.length === 0 ? 'Plan satisfied.' : problems.join('; ') + '.',
        traces: [],
      };
    }
    default:
      return { goal, label: `Unknown goal type "${goal.type}"`, ok: false, detail: 'Unknown goal type.', traces: [] };
  }
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/archGoals.test.mjs`
Expected: PASS.

- [ ] **Step 5: Run the whole lib suite and commit**

Run: `node --test js/lib/`
Expected: PASS (all lib tests).

```bash
git add js/lib/archGoals.js js/lib/archGoals.test.mjs
git commit -m "Add declarative goal evaluation over the connectivity simulator

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 6: Challenge data, part 1 — challenges 1–5 (`js/data/archChallenges.js`)

**Files:**
- Create: `js/data/archChallenges.js`
- Test: `js/data/archChallenges.test.mjs` (create)

**Interfaces:**
- Consumes: builder helpers from `../lib/archModel.js` (challenge `refSolution`/`startState` are functions constructing state with the same mutators the UI uses); goal shapes from Task 5.
- Produces: `ARCH_CHALLENGES: [{id, title, brief, roles, startState, goals, bestPractices, hints, refSolution}]` — `startState: null | () => arch`, `refSolution: () => arch`, `bestPractices: 'all' | string[]` (rule ids from Task 4), `hints: string[]` (ordered, revealed one at a time). Task 10's page and Task 9's validator import `ARCH_CHALLENGES`.
- The test file's generic harness ("every challenge: clean refSolution, all goals pass, empty arch fails") is written ONCE in this task and automatically covers challenges added in Task 7.

**Challenge content (all five, written exactly as shown, briefs may be lightly wordsmithed):**

1. `public-web` — **Public web server.** Roles: `web`/"web server"/ec2. Goals: exists(web, ec2); internetReaches(web, 80). bestPractices: `['no-open-ssh', 'least-privilege-sg', 'unused-resources']`. Hints: attach an IGW → route 0.0.0.0/0 to it → public IP on the instance → SG inbound 80. refSolution: /16 VPC, IGW attached, one public subnet (10.0.1.0/24, AZ a) on a "public" route table with `0.0.0.0/0 → igw`, `web-sg` allowing TCP 80 from 0.0.0.0/0, one EC2 (`role: 'web'`, publicIp, port 80).
2. `private-egress` — **Private worker with NAT egress.** Roles: `worker`/"worker instance"/ec2. Goals: exists(worker, ec2); hasEgress(worker); noInternetReach(worker). bestPractices: `['unused-resources', 'least-privilege-sg']`. Hints: two subnets (public+private) → NAT in the *public* one → private table 0.0.0.0/0 → NAT → no public IP. refSolution: public 10.0.1.0/24 (a) with igw route, private 10.0.2.0/24 (a) on main table with `0.0.0.0/0 → nat`, NAT in the public subnet, worker EC2 in the private subnet, no public IP, `worker-sg` with no inbound rules.
3. `two-tier` — **Two-tier web + database.** Roles: `web`/ec2, `db`/"database"/rds. Goals: exists ×2; internetReaches(web, 443); reaches(web, db, 5432); noInternetReach(db). bestPractices: `['db-in-private-subnet', 'no-open-db-port', 'no-open-ssh', 'least-privilege-sg', 'unused-resources']`. refSolution: public 10.0.1.0/24 (a); private 10.0.2.0/24 (a) + 10.0.3.0/24 (b) for the DB subnet group; `web-sg` 443 from 0.0.0.0/0; `db-sg` 5432 from `sg:web-sg`; web EC2 public+publicIp port 443; RDS in the two private subnets.
4. `ha-web` — **HA web tier behind a load balancer.** Roles: `lb`/"load balancer"/alb, `web`/"web tier"/ec2. Goals: exists ×2; internetReaches(lb, 443); reaches(lb, web, 80); noInternetReach(web); spansAzs(web, 2). bestPractices: `['single-az', 'least-privilege-sg', 'no-open-ssh', 'unused-resources']`. refSolution: public 10.0.1.0/24 (a) + 10.0.2.0/24 (b) on the public table; private 10.0.11.0/24 (a) + 10.0.12.0/24 (b); `alb-sg` 443 from 0.0.0.0/0; `web-sg` 80 from `sg:alb-sg`; ALB across both public subnets (port 443); two web EC2s (one per private subnet, port 80, no public IP).
5. `three-tier` — **Three-tier HA application.** Roles: `lb`/alb, `app`/"application tier"/ec2, `db`/rds. Goals: exists ×3; internetReaches(lb, 443); reaches(lb, app, 8080); reaches(app, db, 5432); noInternetReach(app); noInternetReach(db); spansAzs(app, 2); hasEgress(app); multiAz(db). bestPractices: `'all'`. refSolution: public 10.0.1.0/24 (a) + 10.0.2.0/24 (b); app-private 10.0.11.0/24 (a) + 10.0.12.0/24 (b); db-private 10.0.21.0/24 (a) + 10.0.22.0/24 (b); per-AZ NATs in the public subnets; two private route tables (`private-a`: 0.0.0.0/0 → nat-in-a, associated with 10.0.11.0/24 and 10.0.21.0/24; `private-b`: likewise for b); `alb-sg` 443 open; `app-sg` 8080 from `sg:alb-sg`; `db-sg` 5432 from `sg:app-sg`; ALB in publics; app EC2s ×2 (port 8080); RDS multiAz across the db subnets.

- [ ] **Step 1: Write the failing generic harness test**

Create `js/data/archChallenges.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_CHALLENGES } from './archChallenges.js';
import { createArch } from '../lib/archModel.js';
import { validateStructure, evaluateBestPractices } from '../lib/archValidate.js';
import { evaluateGoals } from '../lib/archGoals.js';

test('there are at least 5 challenges with unique ids', () => {
  assert.ok(ARCH_CHALLENGES.length >= 5);
  const ids = ARCH_CHALLENGES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const ch of ARCH_CHALLENGES) {
  test(`challenge "${ch.id}": reference solution is structurally clean`, () => {
    const arch = ch.refSolution();
    assert.deepEqual(validateStructure(arch).errors, []);
  });

  test(`challenge "${ch.id}": reference solution passes every goal`, () => {
    const arch = ch.refSolution();
    for (const row of evaluateGoals(arch, ch)) {
      assert.equal(row.ok, true, `${row.label}\n${row.detail}\n${JSON.stringify(row.traces, null, 2)}`);
    }
  });

  test(`challenge "${ch.id}": reference solution passes every applicable best practice`, () => {
    const arch = ch.refSolution();
    for (const row of evaluateBestPractices(arch, ch.bestPractices)) {
      assert.equal(row.ok, true, `${row.ruleId}: ${row.message}`);
    }
  });

  test(`challenge "${ch.id}": an empty architecture does not pass`, () => {
    const start = ch.startState ? ch.startState() : createArch();
    const rows = evaluateGoals(start, ch);
    assert.ok(rows.some((r) => !r.ok), 'at least one goal must fail before any work is done');
  });

  test(`challenge "${ch.id}": startState (when present) is structurally clean`, () => {
    if (!ch.startState) return;
    assert.deepEqual(validateStructure(ch.startState()).errors, []);
  });

  test(`challenge "${ch.id}": refSolution returns a fresh object each call`, () => {
    assert.notEqual(ch.refSolution(), ch.refSolution());
  });
}
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/data/archChallenges.test.mjs`
Expected: FAIL — `Cannot find module '.../js/data/archChallenges.js'`

- [ ] **Step 3: Implement challenges 1–5**

Create `js/data/archChallenges.js`:

```js
// aws/js/data/archChallenges.js
//
// Challenge definitions for the Architecture Challenge page. startState and
// refSolution are FUNCTIONS returning fresh architecture state built with
// the same archModel mutators the UI uses — never shared objects (the UI
// mutates what it loads) and never serialized. Every challenge's
// refSolution is proven by js/data/archChallenges.test.mjs to validate
// clean, pass all its goals, and pass its selected best practices.

import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload,
} from '../lib/archModel.js';

// Shared fixture: /16 VPC with an attached IGW and a "public" route table
// (0.0.0.0/0 → igw). Returns { arch, publicRt }.
function vpcWithIgw() {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const publicRt = addRouteTable(arch, 'public');
  addRoute(arch, publicRt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  return { arch, publicRt };
}

function publicWebSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const s = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  associateSubnet(arch, publicRt.id, s.id);
  const sg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' });
  addWorkload(arch, {
    type: 'ec2', name: 'web-1', role: 'web',
    subnetIds: [s.id], sgIds: [sg.id], publicIp: true, port: 80,
  });
  return arch;
}

function privateEgressSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  associateSubnet(arch, publicRt.id, pub.id);
  const priv = addSubnet(arch, { name: 'private-a', az: 'a', cidr: '10.0.2.0/24' });
  const nat = addNat(arch, pub.id);
  addRoute(arch, 'rtb-main', { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  const sg = addSecurityGroup(arch, 'worker-sg'); // no inbound: nothing needs in
  addWorkload(arch, {
    type: 'ec2', name: 'worker-1', role: 'worker',
    subnetIds: [priv.id], sgIds: [sg.id], publicIp: false,
  });
  return arch;
}

function twoTierSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  associateSubnet(arch, publicRt.id, pub.id);
  const dbA = addSubnet(arch, { name: 'db-a', az: 'a', cidr: '10.0.2.0/24' });
  const dbB = addSubnet(arch, { name: 'db-b', az: 'b', cidr: '10.0.3.0/24' });
  const webSg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, webSg.id, { portFrom: 443, source: '0.0.0.0/0' });
  const dbSg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: `sg:${webSg.id}` });
  addWorkload(arch, {
    type: 'ec2', name: 'web-1', role: 'web',
    subnetIds: [pub.id], sgIds: [webSg.id], publicIp: true, port: 443,
  });
  addWorkload(arch, {
    type: 'rds', name: 'app-db', role: 'db',
    subnetIds: [dbA.id, dbB.id], sgIds: [dbSg.id],
  });
  return arch;
}

function haWebSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pubA = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const pubB = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.2.0/24' });
  associateSubnet(arch, publicRt.id, pubA.id);
  associateSubnet(arch, publicRt.id, pubB.id);
  const privA = addSubnet(arch, { name: 'web-a', az: 'a', cidr: '10.0.11.0/24' });
  const privB = addSubnet(arch, { name: 'web-b', az: 'b', cidr: '10.0.12.0/24' });
  const albSg = addSecurityGroup(arch, 'alb-sg');
  addSgRule(arch, albSg.id, { portFrom: 443, source: '0.0.0.0/0' });
  const webSg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, webSg.id, { portFrom: 80, source: `sg:${albSg.id}` });
  addWorkload(arch, {
    type: 'alb', name: 'web-alb', role: 'lb',
    subnetIds: [pubA.id, pubB.id], sgIds: [albSg.id], port: 443,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'web-1', role: 'web',
    subnetIds: [privA.id], sgIds: [webSg.id], port: 80,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'web-2', role: 'web',
    subnetIds: [privB.id], sgIds: [webSg.id], port: 80,
  });
  return arch;
}

function threeTierSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pubA = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const pubB = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.2.0/24' });
  associateSubnet(arch, publicRt.id, pubA.id);
  associateSubnet(arch, publicRt.id, pubB.id);
  const appA = addSubnet(arch, { name: 'app-a', az: 'a', cidr: '10.0.11.0/24' });
  const appB = addSubnet(arch, { name: 'app-b', az: 'b', cidr: '10.0.12.0/24' });
  const dbA = addSubnet(arch, { name: 'db-a', az: 'a', cidr: '10.0.21.0/24' });
  const dbB = addSubnet(arch, { name: 'db-b', az: 'b', cidr: '10.0.22.0/24' });
  const natA = addNat(arch, pubA.id);
  const natB = addNat(arch, pubB.id);
  const rtA = addRouteTable(arch, 'private-a');
  addRoute(arch, rtA.id, { destCidr: '0.0.0.0/0', target: `nat:${natA.id}` });
  associateSubnet(arch, rtA.id, appA.id);
  associateSubnet(arch, rtA.id, dbA.id);
  const rtB = addRouteTable(arch, 'private-b');
  addRoute(arch, rtB.id, { destCidr: '0.0.0.0/0', target: `nat:${natB.id}` });
  associateSubnet(arch, rtB.id, appB.id);
  associateSubnet(arch, rtB.id, dbB.id);
  const albSg = addSecurityGroup(arch, 'alb-sg');
  addSgRule(arch, albSg.id, { portFrom: 443, source: '0.0.0.0/0' });
  const appSg = addSecurityGroup(arch, 'app-sg');
  addSgRule(arch, appSg.id, { portFrom: 8080, source: `sg:${albSg.id}` });
  const dbSg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: `sg:${appSg.id}` });
  addWorkload(arch, {
    type: 'alb', name: 'app-alb', role: 'lb',
    subnetIds: [pubA.id, pubB.id], sgIds: [albSg.id], port: 443,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'app-1', role: 'app',
    subnetIds: [appA.id], sgIds: [appSg.id], port: 8080,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'app-2', role: 'app',
    subnetIds: [appB.id], sgIds: [appSg.id], port: 8080,
  });
  addWorkload(arch, {
    type: 'rds', name: 'app-db', role: 'db',
    subnetIds: [dbA.id, dbB.id], sgIds: [dbSg.id], multiAz: true,
  });
  return arch;
}

export const ARCH_CHALLENGES = [
  {
    id: 'public-web',
    title: 'Public web server',
    brief: 'Your team is launching a simple marketing site on a single EC2 instance. '
      + 'Visitors on the internet must be able to reach it over HTTP (port 80). '
      + 'Build the smallest VPC setup that makes the instance publicly reachable.',
    roles: [{ id: 'web', label: 'web server', expectedType: 'ec2' }],
    startState: null,
    goals: [
      { type: 'exists', role: 'web', workloadType: 'ec2' },
      { type: 'internetReaches', role: 'web', port: 80 },
    ],
    bestPractices: ['no-open-ssh', 'least-privilege-sg', 'unused-resources'],
    hints: [
      'Internet traffic can only enter a VPC through an internet gateway — attach one first.',
      'A subnet is "public" when its route table sends 0.0.0.0/0 to the internet gateway.',
      'The instance needs a public IP, and its security group must allow TCP 80 from 0.0.0.0/0.',
    ],
    refSolution: publicWebSolution,
  },
  {
    id: 'private-egress',
    title: 'Private worker with NAT egress',
    brief: 'A batch worker needs to call external APIs and pull OS updates, but it must '
      + 'not be reachable from the internet — no public IP, no inbound exposure. '
      + 'Give it outbound-only internet access.',
    roles: [{ id: 'worker', label: 'worker instance', expectedType: 'ec2' }],
    startState: null,
    goals: [
      { type: 'exists', role: 'worker', workloadType: 'ec2' },
      { type: 'hasEgress', role: 'worker' },
      { type: 'noInternetReach', role: 'worker' },
    ],
    bestPractices: ['least-privilege-sg', 'unused-resources'],
    hints: [
      'You need two subnets: a public one (for the NAT gateway) and a private one (for the worker).',
      'The NAT gateway itself must sit in the PUBLIC subnet — it needs the IGW to pass traffic out.',
      "Route the private subnet's 0.0.0.0/0 to the NAT gateway, and leave the worker without a public IP.",
    ],
    refSolution: privateEgressSolution,
  },
  {
    id: 'two-tier',
    title: 'Two-tier web + database',
    brief: 'A web app takes HTTPS traffic from the internet and stores data in PostgreSQL. '
      + 'The web server must be publicly reachable on 443; the database must accept '
      + 'connections only from the web server and never from the internet.',
    roles: [
      { id: 'web', label: 'web server', expectedType: 'ec2' },
      { id: 'db', label: 'database', expectedType: 'rds' },
    ],
    startState: null,
    goals: [
      { type: 'exists', role: 'web', workloadType: 'ec2' },
      { type: 'exists', role: 'db', workloadType: 'rds' },
      { type: 'internetReaches', role: 'web', port: 443 },
      { type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 },
      { type: 'noInternetReach', role: 'db' },
    ],
    bestPractices: ['db-in-private-subnet', 'no-open-db-port', 'no-open-ssh', 'least-privilege-sg', 'unused-resources'],
    hints: [
      'An RDS DB subnet group needs at least two subnets in two different AZs — keep both private.',
      "Chain security groups: allow 5432 on the DB's SG from the web server's SG, not from a CIDR.",
      'Only the web subnet gets the internet-gateway route; the DB subnets stay on a table without one.',
    ],
    refSolution: twoTierSolution,
  },
  {
    id: 'ha-web',
    title: 'HA web tier behind a load balancer',
    brief: 'Traffic is growing and one instance in one AZ is no longer acceptable. Put an '
      + 'Application Load Balancer in front of a web tier that survives an AZ outage. '
      + 'Only the load balancer may face the internet.',
    roles: [
      { id: 'lb', label: 'load balancer', expectedType: 'alb' },
      { id: 'web', label: 'web tier', expectedType: 'ec2' },
    ],
    startState: null,
    goals: [
      { type: 'exists', role: 'lb', workloadType: 'alb' },
      { type: 'exists', role: 'web', workloadType: 'ec2' },
      { type: 'internetReaches', role: 'lb', port: 443 },
      { type: 'reaches', fromRole: 'lb', toRole: 'web', port: 80 },
      { type: 'noInternetReach', role: 'web' },
      { type: 'spansAzs', role: 'web', min: 2 },
    ],
    bestPractices: ['single-az', 'no-open-ssh', 'least-privilege-sg', 'unused-resources'],
    hints: [
      'An internet-facing ALB needs subnets in at least two AZs — and every one of them must be public.',
      'Web instances go in PRIVATE subnets with no public IPs; the ALB forwards to them over the VPC network.',
      "Allow web port 80 from the ALB's security group; allow 443 on the ALB from 0.0.0.0/0.",
    ],
    refSolution: haWebSolution,
  },
  {
    id: 'three-tier',
    title: 'Three-tier HA application',
    brief: 'The full production build-out: an internet-facing ALB, an application tier '
      + 'across two AZs that can reach the internet for updates, and a Multi-AZ '
      + 'PostgreSQL database. Only the ALB may be exposed to the internet.',
    roles: [
      { id: 'lb', label: 'load balancer', expectedType: 'alb' },
      { id: 'app', label: 'application tier', expectedType: 'ec2' },
      { id: 'db', label: 'database', expectedType: 'rds' },
    ],
    startState: null,
    goals: [
      { type: 'exists', role: 'lb', workloadType: 'alb' },
      { type: 'exists', role: 'app', workloadType: 'ec2' },
      { type: 'exists', role: 'db', workloadType: 'rds' },
      { type: 'internetReaches', role: 'lb', port: 443 },
      { type: 'reaches', fromRole: 'lb', toRole: 'app', port: 8080 },
      { type: 'reaches', fromRole: 'app', toRole: 'db', port: 5432 },
      { type: 'noInternetReach', role: 'app' },
      { type: 'noInternetReach', role: 'db' },
      { type: 'spansAzs', role: 'app', min: 2 },
      { type: 'hasEgress', role: 'app' },
      { type: 'multiAz', role: 'db' },
    ],
    bestPractices: 'all',
    hints: [
      'Six subnets is the classic layout: public, app-private, and db-private — one of each per AZ.',
      'The app tier egresses through NAT gateways — one per AZ, each in that AZ\'s public subnet.',
      'Per-AZ private route tables keep AZ-a subnets on the AZ-a NAT (and likewise for b).',
      'Chain the SGs: internet → alb-sg:443 → app-sg:8080 → db-sg:5432.',
    ],
    refSolution: threeTierSolution,
  },
];
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/data/archChallenges.test.mjs`
Expected: PASS — every challenge's refSolution validates clean, passes all goals and selected best practices; empty arch fails each.

- [ ] **Step 5: Commit**

```bash
git add js/data/archChallenges.js js/data/archChallenges.test.mjs
git commit -m "Add architecture challenges 1-5 with proven reference solutions

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 7: Challenge data, part 2 — challenges 6–8

**Files:**
- Modify: `js/data/archChallenges.js` (append three entries + their builders)
- Test: `js/data/archChallenges.test.mjs` (append one broken-start assertion; the generic per-challenge harness picks the new entries up automatically)

**Interfaces:**
- Consumes/Produces: same shapes as Task 6.

**Challenge content:**

6. `fix-broken` — **Fix the broken architecture.** Roles: `web`/ec2, `db`/rds, `worker`/ec2. `startState` is a pre-built two-tier + worker design with three planted flaws: (a) the web subnet was never associated with the public route table (so it falls to main, which has no IGW route — web unreachable); (b) the worker's NAT gateway sits in the *private* worker subnet (egress dead-ends); (c) the DB security group allows 5432 from 0.0.0.0/0 (best-practice failures on `no-open-db-port` and `least-privilege-sg`). Goals: exists ×3; internetReaches(web, 80); reaches(web, db, 5432); noInternetReach(db); hasEgress(worker). bestPractices: `['db-in-private-subnet', 'no-open-db-port', 'least-privilege-sg', 'no-open-ssh', 'unused-resources']`. The startState must be **structurally clean** (all flaws are functional/best-practice, so the player diagnoses via Check, not via red structural errors). `refSolution` = same builder with the three flaws corrected.
7. `cidr-plan` — **CIDR planning in a /24.** No roles (`roles: []`). Goals: vpcCidrIs('10.0.0.0/24'); subnetPlan {count: 4, minUsableHosts: 50, minAzs: 2, publicCount: 2, privateCount: 2}. bestPractices: `['unused-resources']`. Brief: corporate IPAM assigned exactly 10.0.0.0/24; carve it into 2 public + 2 private subnets across two AZs, each with ≥ 50 usable IPs (remember AWS reserves 5 per subnet). startState: `() => { const a = createArch(); a.vpc.cidr = '10.0.0.0/24'; a.vpc.igwAttached = true; return a; }` (the point is subnetting, not IGW plumbing). refSolution: four /26s (10.0.0.0/26 a, 10.0.0.64/26 b public on an igw table; 10.0.0.128/26 a, 10.0.0.192/26 b private on main).
8. `bastion` — **Locked-down bastion host.** Roles: `bastion`/ec2, `app`/ec2. Brief: admins SSH in only from the office (203.0.113.0/24); app instances live in a private subnet, reachable over SSH only through the bastion, and never directly from the internet. Goals: exists ×2; cidrReaches {cidr: '203.0.113.0/24', cidrLabel: 'the office', role: 'bastion', port: 22}; noInternetReach(bastion) (public IP is fine — but no 0.0.0.0/0 rule); reaches(bastion, app, 22); noInternetReach(app). bestPractices: `['no-open-ssh', 'least-privilege-sg', 'unused-resources']`. refSolution: public subnet (bastion, publicIp, `bastion-sg` 22 from 203.0.113.0/24); private subnet (app, `app-sg` 22 from `sg:bastion-sg`).

- [ ] **Step 1: Extend the test file**

Append to `js/data/archChallenges.test.mjs`:

```js
test('fix-broken: the shipped startState fails its functional goals as planted', () => {
  const ch = ARCH_CHALLENGES.find((c) => c.id === 'fix-broken');
  const rows = evaluateGoals(ch.startState(), ch);
  const byType = (t) => rows.filter((r) => r.goal.type === t);
  assert.ok(byType('internetReaches').some((r) => !r.ok), 'web must start unreachable');
  assert.ok(byType('hasEgress').some((r) => !r.ok), 'worker egress must start broken');
  const bp = evaluateBestPractices(ch.startState(), ch.bestPractices);
  assert.ok(bp.some((r) => r.ruleId === 'no-open-db-port' && !r.ok), 'DB port must start open');
});

test('there are exactly 8 challenges', () => {
  assert.equal(ARCH_CHALLENGES.length, 8);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/data/archChallenges.test.mjs`
Expected: FAIL — `fix-broken` not found / length is 5.

- [ ] **Step 3: Implement challenges 6–8**

Append the builders to `js/data/archChallenges.js` (before `ARCH_CHALLENGES`) and the three entries to the array:

```js
// Challenge 6 start/solution share one builder; `fixed` toggles the three
// planted flaws: (a) web subnet never associated with the public table,
// (b) NAT gateway placed in the private worker subnet, (c) DB port open to
// the world. The start state is structurally CLEAN on purpose — the player
// finds the flaws through Check, not through red structural errors.
function fixBrokenBuild(fixed) {
  const { arch, publicRt } = vpcWithIgw();
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  if (fixed) associateSubnet(arch, publicRt.id, pub.id); // flaw (a)
  const workerSub = addSubnet(arch, { name: 'worker-a', az: 'a', cidr: '10.0.2.0/24' });
  const dbA = addSubnet(arch, { name: 'db-a', az: 'a', cidr: '10.0.3.0/24' });
  const dbB = addSubnet(arch, { name: 'db-b', az: 'b', cidr: '10.0.4.0/24' });
  const nat = addNat(arch, fixed ? pub.id : workerSub.id); // flaw (b)
  const workerRt = addRouteTable(arch, 'worker-private');
  addRoute(arch, workerRt.id, { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` });
  associateSubnet(arch, workerRt.id, workerSub.id);
  const webSg = addSecurityGroup(arch, 'web-sg');
  addSgRule(arch, webSg.id, { portFrom: 80, source: '0.0.0.0/0' });
  const dbSg = addSecurityGroup(arch, 'db-sg');
  addSgRule(arch, dbSg.id, { portFrom: 5432, source: fixed ? `sg:${webSg.id}` : '0.0.0.0/0' }); // flaw (c)
  const workerSg = addSecurityGroup(arch, 'worker-sg');
  addWorkload(arch, {
    type: 'ec2', name: 'web-1', role: 'web',
    subnetIds: [pub.id], sgIds: [webSg.id], publicIp: true, port: 80,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'worker-1', role: 'worker',
    subnetIds: [workerSub.id], sgIds: [workerSg.id], publicIp: false,
  });
  addWorkload(arch, {
    type: 'rds', name: 'app-db', role: 'db',
    subnetIds: [dbA.id, dbB.id], sgIds: [dbSg.id],
  });
  return arch;
}

function cidrPlanStart() {
  const arch = createArch();
  arch.vpc.cidr = '10.0.0.0/24';
  arch.vpc.igwAttached = true; // the point of this one is subnetting, not IGW plumbing
  return arch;
}

function cidrPlanSolution() {
  const arch = cidrPlanStart();
  const publicRt = addRouteTable(arch, 'public');
  addRoute(arch, publicRt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  const pubA = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.0.0/26' });
  const pubB = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.0.64/26' });
  associateSubnet(arch, publicRt.id, pubA.id);
  associateSubnet(arch, publicRt.id, pubB.id);
  addSubnet(arch, { name: 'private-a', az: 'a', cidr: '10.0.0.128/26' });
  addSubnet(arch, { name: 'private-b', az: 'b', cidr: '10.0.0.192/26' });
  return arch;
}

function bastionSolution() {
  const { arch, publicRt } = vpcWithIgw();
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  associateSubnet(arch, publicRt.id, pub.id);
  const priv = addSubnet(arch, { name: 'app-a', az: 'a', cidr: '10.0.2.0/24' });
  const bastionSg = addSecurityGroup(arch, 'bastion-sg');
  addSgRule(arch, bastionSg.id, { portFrom: 22, source: '203.0.113.0/24' });
  const appSg = addSecurityGroup(arch, 'app-sg');
  addSgRule(arch, appSg.id, { portFrom: 22, source: `sg:${bastionSg.id}` });
  addWorkload(arch, {
    type: 'ec2', name: 'bastion-1', role: 'bastion',
    subnetIds: [pub.id], sgIds: [bastionSg.id], publicIp: true, port: 22,
  });
  addWorkload(arch, {
    type: 'ec2', name: 'app-1', role: 'app',
    subnetIds: [priv.id], sgIds: [appSg.id], publicIp: false, port: 22,
  });
  return arch;
}
```

The three array entries:

```js
  {
    id: 'fix-broken',
    title: 'Fix the broken architecture',
    brief: 'You inherited this "finished" environment from a contractor: a public web '
      + 'server, a PostgreSQL database, and a private batch worker. Users report the '
      + 'site never loads, the worker can\'t download updates, and security flagged '
      + 'the database. Find and fix all three problems — nothing here is missing, '
      + 'some of it is just wrong.',
    roles: [
      { id: 'web', label: 'web server', expectedType: 'ec2' },
      { id: 'db', label: 'database', expectedType: 'rds' },
      { id: 'worker', label: 'batch worker', expectedType: 'ec2' },
    ],
    startState: () => fixBrokenBuild(false),
    goals: [
      { type: 'exists', role: 'web', workloadType: 'ec2' },
      { type: 'exists', role: 'db', workloadType: 'rds' },
      { type: 'exists', role: 'worker', workloadType: 'ec2' },
      { type: 'internetReaches', role: 'web', port: 80 },
      { type: 'reaches', fromRole: 'web', toRole: 'db', port: 5432 },
      { type: 'noInternetReach', role: 'db' },
      { type: 'hasEgress', role: 'worker' },
    ],
    bestPractices: ['db-in-private-subnet', 'no-open-db-port', 'least-privilege-sg', 'no-open-ssh', 'unused-resources'],
    hints: [
      'Run Check and read the traces — each failing goal names the hop that breaks.',
      "The public route table exists and has the right route. Which subnets actually use it?",
      'A NAT gateway only works from inside a public subnet.',
      "The database's security group should trust the web server's SG, not the whole internet.",
    ],
    refSolution: () => fixBrokenBuild(true),
  },
  {
    id: 'cidr-plan',
    title: 'CIDR planning in a /24',
    brief: 'Corporate IPAM assigned your project exactly 10.0.0.0/24 — not one address '
      + 'more. Carve it into two public and two private subnets across two AZs, each '
      + 'with at least 50 usable IPs. Remember AWS reserves 5 addresses in every '
      + 'subnet, and subnets must not overlap.',
    roles: [],
    startState: cidrPlanStart,
    goals: [
      { type: 'vpcCidrIs', cidr: '10.0.0.0/24' },
      { type: 'subnetPlan', count: 4, minUsableHosts: 50, minAzs: 2, publicCount: 2, privateCount: 2 },
    ],
    bestPractices: ['unused-resources'],
    hints: [
      'Four equal slices of a /24 are /26s: .0, .64, .128, .192.',
      'A /26 holds 64 addresses; minus the 5 AWS reserves leaves 59 usable — enough.',
      'Public = associated with a route table that sends 0.0.0.0/0 to the IGW.',
    ],
    refSolution: cidrPlanSolution,
  },
  {
    id: 'bastion',
    title: 'Locked-down bastion host',
    brief: 'Admins need SSH access to private app servers, but the security team\'s '
      + 'rules are strict: SSH into the bastion only from the office network '
      + '(203.0.113.0/24), app servers reachable only through the bastion, and '
      + 'nothing open to 0.0.0.0/0.',
    roles: [
      { id: 'bastion', label: 'bastion host', expectedType: 'ec2' },
      { id: 'app', label: 'app server', expectedType: 'ec2' },
    ],
    startState: null,
    goals: [
      { type: 'exists', role: 'bastion', workloadType: 'ec2' },
      { type: 'exists', role: 'app', workloadType: 'ec2' },
      { type: 'cidrReaches', cidr: '203.0.113.0/24', cidrLabel: 'the office', role: 'bastion', port: 22 },
      { type: 'noInternetReach', role: 'bastion' },
      { type: 'reaches', fromRole: 'bastion', toRole: 'app', port: 22 },
      { type: 'noInternetReach', role: 'app' },
    ],
    bestPractices: ['no-open-ssh', 'least-privilege-sg', 'unused-resources'],
    hints: [
      'The bastion needs a public IP and a public subnet — but its SSH rule uses the office CIDR, not 0.0.0.0/0.',
      "App servers allow SSH from the bastion's security group, and get no public IP at all.",
    ],
    refSolution: bastionSolution,
  },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/data/archChallenges.test.mjs`
Expected: PASS — 8 challenges, all harness assertions green (including the planted-flaw assertions).

- [ ] **Step 5: Commit**

```bash
git add js/data/archChallenges.js js/data/archChallenges.test.mjs
git commit -m "Add fix-broken, CIDR-planning, and bastion challenges

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 8: Storage extension (`js/lib/storage.js`)

**Files:**
- Modify: `js/lib/storage.js` (add getters/setters inside `createStore`'s returned object)
- Test: `js/lib/storage.test.mjs` (append)

**Interfaces:**
- Consumes: the existing `load`/`save`/`loadObject` helpers and validated-shape pattern in `storage.js`.
- Produces (on the store object): `getArchResults(): {[challengeId]: {completedAt, bpPassed, bpApplicable}}`; `recordArchResult(challengeId, result)` — keeps the BEST result per challenge: overwrite when the new `bpPassed/bpApplicable` ratio is ≥ the stored one (an `bpApplicable === 0` ratio counts as 1); `getArchDraft(challengeId): object | null`; `setArchDraft(challengeId, state)`; `clearArchDraft(challengeId)`. Storage keys: `arch-results` (one object) and `arch-draft:<challengeId>` (sandbox uses the id `'sandbox'`).

- [ ] **Step 1: Write the failing tests**

Append to `js/lib/storage.test.mjs` (it already has a `memBackend()`-style helper — reuse whatever in-memory backend pattern the existing tests use; shown here as `fakeBackend()`, adapt the name to match the file):

```js
test('arch results: records and keeps the best score per challenge', () => {
  const store = createStore(fakeBackend());
  assert.deepEqual(store.getArchResults(), {});
  store.recordArchResult('public-web', { completedAt: 1, bpPassed: 1, bpApplicable: 3 });
  store.recordArchResult('public-web', { completedAt: 2, bpPassed: 3, bpApplicable: 3 });
  assert.equal(store.getArchResults()['public-web'].bpPassed, 3);
  store.recordArchResult('public-web', { completedAt: 3, bpPassed: 0, bpApplicable: 3 });
  assert.equal(store.getArchResults()['public-web'].bpPassed, 3, 'worse result must not clobber');
  assert.equal(store.getArchResults()['public-web'].completedAt, 2);
});

test('arch drafts: set/get/clear round-trip per challenge id', () => {
  const store = createStore(fakeBackend());
  assert.equal(store.getArchDraft('two-tier'), null);
  store.setArchDraft('two-tier', { vpc: { cidr: '10.0.0.0/16' } });
  assert.deepEqual(store.getArchDraft('two-tier'), { vpc: { cidr: '10.0.0.0/16' } });
  assert.equal(store.getArchDraft('sandbox'), null, 'ids are independent');
  store.clearArchDraft('two-tier');
  assert.equal(store.getArchDraft('two-tier'), null);
});

test('arch getters survive a wrong-shape stored value', () => {
  const backend = fakeBackend();
  const store = createStore(backend);
  backend.setItem('saa-prep:arch-results', JSON.stringify(['not', 'an', 'object']));
  backend.setItem('saa-prep:arch-draft:x', JSON.stringify(42));
  assert.deepEqual(store.getArchResults(), {});
  assert.equal(store.getArchDraft('x'), null);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/lib/storage.test.mjs`
Expected: FAIL — `store.getArchResults is not a function`.

- [ ] **Step 3: Implement**

Add to the object returned by `createStore` in `js/lib/storage.js` (after the flashcard-session block, before `clearQuizHistory`):

```js
    getArchResults() {
      return loadObject(b, 'arch-results');
    },
    recordArchResult(challengeId, result) {
      const results = loadObject(b, 'arch-results');
      const prev = results[challengeId];
      const ratio = (r) => (r.bpApplicable > 0 ? r.bpPassed / r.bpApplicable : 1);
      if (!prev || ratio(result) >= ratio(prev)) {
        results[challengeId] = result;
        save(b, 'arch-results', results);
      }
    },
    getArchDraft(challengeId) {
      const value = load(b, `arch-draft:${challengeId}`, null);
      return isPlainObject(value) ? value : null;
    },
    setArchDraft(challengeId, state) {
      save(b, `arch-draft:${challengeId}`, state);
    },
    clearArchDraft(challengeId) {
      try {
        b.removeItem(`${NAMESPACE}:arch-draft:${challengeId}`);
      } catch {
        /* ignore */
      }
    },
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/storage.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/lib/storage.js js/lib/storage.test.mjs
git commit -m "Persist architecture challenge results and drafts

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 9: Content validation (`scripts/validate-content.mjs`)

**Files:**
- Modify: `scripts/validate-content.mjs` (new `validateArchChallenges()` following the existing validators' pattern: skipped with a note if the data file doesn't exist, `check(condition, message)` for each assertion, wired into the bottom `await`/run sequence exactly like `validateServices`)

**Interfaces:**
- Consumes: `ARCH_CHALLENGES` from `../js/data/archChallenges.js`; `GOAL_TYPES` from `../js/lib/archGoals.js`; `BEST_PRACTICE_RULE_IDS` from `../js/lib/archValidate.js`; `WORKLOAD_TYPES` from `../js/lib/archModel.js`.
- Produces: validation failures print via the existing `check`/`errors` mechanism; exit code non-zero on failure.

Checks (one `check(...)` per bullet, iterating challenges):

- `ARCH_CHALLENGES` is a non-empty array; ids unique, non-empty kebab-case; `title` and `brief` non-empty strings (brief ≥ 80 chars — it's a scenario, not a caption).
- `roles` is an array; each role has non-empty `id`/`label`; `expectedType`, when present, is in `WORKLOAD_TYPES`; role ids unique within the challenge.
- `goals` non-empty; every `goal.type` is in `GOAL_TYPES`; every `role`/`fromRole`/`toRole` a goal names exists in the challenge's `roles`; `internetReaches`/`cidrReaches`/`reaches` carry a numeric `port`; `cidrReaches` carries `cidr` and `cidrLabel`; `spansAzs` a numeric `min`; `vpcCidrIs` a `cidr`; `subnetPlan` numeric `count`/`minUsableHosts`/`minAzs`/`publicCount`/`privateCount`.
- `bestPractices` is `'all'` or a non-empty array whose every entry is in `BEST_PRACTICE_RULE_IDS`.
- `hints` is a non-empty array of non-empty strings.
- `refSolution` is a function; `startState` is `null` or a function.
- Every role id is referenced by at least one goal (an unassignable role would be dead UI).

- [ ] **Step 1: Implement `validateArchChallenges()` and wire it in**

Follow `validateServices()` (line ~123) as the template — same existsSync skip, same `check` style, same registration at the file's bottom run block. (No separate failing-test step: this script IS the test; verify it catches errors by temporarily breaking one field in `archChallenges.js` — e.g. change a goal type to `'bogus'` — seeing the failure, then reverting.)

- [ ] **Step 2: Run and verify both directions**

Run: `node scripts/validate-content.mjs`
Expected: PASS (mentions arch challenges among the validated files).
Then temporarily set one goal's type to `'bogus'`, re-run, expect a printed failure and non-zero exit; revert.

- [ ] **Step 3: Commit**

```bash
git add scripts/validate-content.mjs
git commit -m "Validate architecture challenge data shape

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 10: Page shell, landing, and builder panel

**Files:**
- Create: `architecture-challenge.html`
- Create: `js/arch-challenge.js`

**Interfaces:**
- Consumes: everything above — `escapeHtml` (`js/lib/html.js`), `createStore` (Task 8 additions), `ARCH_CHALLENGES`, the archModel mutators/queries, `validateStructure`, `evaluateBestPractices`, `evaluateGoals`.
- Produces: the working page with landing + builder; Task 11 fills in `renderDiagram(...)` and `renderTask(...)` which this task stubs as empty functions (declared, called from `renderAll`, bodies added in Task 11).

No unit tests (DOM-only, matching `vpc-explorer.js`); verification is in-browser. Two UI decisions fixed here:

- **Re-render on `change`, not `input`** — the whole builder re-renders after each committed edit (blur/Enter), so text inputs don't lose focus mid-typing.
- **Event delegation** — one `click` and one `change` listener on the builder container; controls carry `data-action` (+ `data-id`/`data-index` where needed) mapping onto archModel mutators.

- [ ] **Step 1: Create `architecture-challenge.html`**

Structure (mirroring `vpc-explorer.html`'s conventions — same header/footer classes, `<link rel="stylesheet" href="css/style.css" />`, then a page `<style>` block):

```html
<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>Architecture Challenge — AWS SAA-C03 Prep</title>
  <link rel="stylesheet" href="css/style.css" />
  <style>
    /* Page-specific styles; reuses css/style.css variables. Dark mode:
       page-local @media (prefers-color-scheme: dark) override block
       re-mapping the site palette exactly like vpc-explorer.html does —
       copy that block's --color-* overrides verbatim, then the arch-*
       surface variables below. */
    :root {
      --arch-surface: #fff;
      --arch-surface-muted: #f3f4f6;
      --arch-public: #ecfdf3;   /* public-subnet tint */
      --arch-private: #eff6ff;  /* private-subnet tint */
      --arch-fail-bg: #fef2f2;
      --arch-ok-bg: #f0fdf4;
    }
    @media (prefers-color-scheme: dark) {
      :root {
        color-scheme: dark;
        /* --color-* overrides copied from vpc-explorer.html … */
        --arch-surface: #1e293b;
        --arch-surface-muted: #334155;
        --arch-public: #14532d;
        --arch-private: #172554;
        --arch-fail-bg: #450a0a;
        --arch-ok-bg: #052e16;
      }
    }
    #arch-content { max-width: 1400px; margin: 0 auto; padding: 1.5rem; }
    /* Landing */
    .arch-cards { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; }
    .arch-card { border: 1px solid var(--color-border); border-radius: 8px; padding: 1rem;
                 background: var(--arch-surface); text-decoration: none; color: inherit; display: block; }
    .arch-card:hover { border-color: var(--color-primary); }
    .arch-card .badge-done { color: var(--color-success); font-weight: 600; }
    /* Workbench: three columns, stacking on narrow screens */
    .arch-workbench { display: grid; grid-template-columns: 340px 1fr 360px; gap: 1rem; align-items: start; }
    @media (max-width: 1100px) { .arch-workbench { grid-template-columns: 1fr; } }
    .arch-panel { border: 1px solid var(--color-border); border-radius: 8px;
                  background: var(--arch-surface); padding: 1rem; }
    .arch-panel h2 { font-size: 1rem; margin: 0 0 0.75rem; }
    .arch-section { border-top: 1px solid var(--color-border); padding: 0.75rem 0; }
    .arch-section h3 { font-size: 0.85rem; margin: 0 0 0.5rem; text-transform: uppercase;
                       letter-spacing: 0.04em; color: var(--color-muted); }
    .arch-row { display: flex; flex-wrap: wrap; gap: 0.4rem; align-items: center; margin-bottom: 0.4rem; }
    .arch-row input, .arch-row select { font: inherit; padding: 0.25rem 0.4rem; border: 1px solid var(--color-border);
                                        border-radius: 4px; background: var(--arch-surface); color: inherit; }
    .arch-row input[type="text"] { width: 8.5rem; }
    .arch-row input[type="number"] { width: 5rem; }
    .arch-mini { font-size: 0.8rem; color: var(--color-muted); }
    button.arch-del { background: transparent; color: var(--color-danger); border: none; padding: 0 0.3rem; font-size: 1rem; }
    button.arch-add { background: transparent; color: var(--color-primary); border: 1px dashed var(--color-border); width: 100%; }
    /* Diagram */
    .arch-vpc-box { border: 2px solid var(--color-primary); border-radius: 10px; padding: 0.75rem; position: relative; }
    .arch-igw-chip { position: absolute; top: -0.9rem; left: 1rem; background: var(--color-primary); color: #fff;
                     border-radius: 999px; padding: 0.1rem 0.6rem; font-size: 0.75rem; }
    .arch-az-grid { display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; gap: 0.75rem; margin-top: 0.75rem; }
    .arch-az h4 { margin: 0 0 0.5rem; font-size: 0.8rem; color: var(--color-muted); }
    .arch-subnet { border: 1px solid var(--color-border); border-radius: 8px; padding: 0.5rem; margin-bottom: 0.6rem; }
    .arch-subnet.is-public { background: var(--arch-public); }
    .arch-subnet.is-private { background: var(--arch-private); }
    .arch-subnet .cidr { font-family: ui-monospace, monospace; font-size: 0.8rem; }
    .arch-chip { display: inline-block; border: 1px solid var(--color-border); background: var(--arch-surface);
                 border-radius: 6px; padding: 0.15rem 0.45rem; font-size: 0.78rem; margin: 0.15rem 0.15rem 0 0; }
    /* Task panel */
    .arch-goal { border-left: 3px solid var(--color-border); padding: 0.4rem 0.6rem; margin-bottom: 0.5rem; }
    .arch-goal.ok { border-left-color: var(--color-success); background: var(--arch-ok-bg); }
    .arch-goal.fail { border-left-color: var(--color-danger); background: var(--arch-fail-bg); }
    .arch-trace { font-size: 0.82rem; margin: 0.3rem 0 0; padding-left: 1.1rem; }
    .arch-trace li.ok::marker { content: "✓ "; color: var(--color-success); }
    .arch-trace li.fail::marker { content: "✗ "; color: var(--color-danger); }
    .arch-score { font-size: 1.4rem; font-weight: 700; }
    .visually-hidden { position: absolute; width: 1px; height: 1px; overflow: hidden; clip: rect(0 0 0 0); }
  </style>
</head>
<body>
  <header class="site-header">
    <h1>Architecture Challenge</h1>
    <nav id="nav"><a href="index.html">← SAA-C03 Prep Home</a> <a href="vpc-explorer.html">VPC Explorer</a></nav>
  </header>
  <main id="arch-content">
    <section id="arch-landing" hidden></section>
    <section id="arch-workbench" hidden>
      <div id="arch-head"></div>
      <div class="arch-workbench">
        <div class="arch-panel" id="arch-builder" aria-label="Builder"></div>
        <div class="arch-panel" id="arch-diagram" aria-label="Diagram"></div>
        <div class="arch-panel" id="arch-task" aria-label="Task and results"></div>
      </div>
    </section>
  </main>
  <footer class="site-footer">
    <p>Unofficial study tool. Not affiliated with AWS. Progress stored locally in your browser.</p>
  </footer>
  <script type="module" src="js/arch-challenge.js"></script>
</body>
</html>
```

While implementing, copy the exact `--color-*` dark overrides from `vpc-explorer.html`'s `@media (prefers-color-scheme: dark)` block into the marked spot (they're the page-local dark palette the site relies on for standalone pages).

- [ ] **Step 2: Create `js/arch-challenge.js` — state, router, landing, and the render skeleton**

```js
// aws/js/arch-challenge.js
//
// Standalone page logic for architecture-challenge.html. Not part of the
// hash-router SPA and not in scripts/check-drift.mjs's SHARED list. All
// validation/simulation logic lives in js/lib/ (pure, node --test covered);
// this file only renders and wires the DOM. Re-renders happen on 'change'
// (committed edits), so text inputs keep focus while typing.

import { escapeHtml } from './lib/html.js';
import { createStore } from './lib/storage.js';
import { ARCH_CHALLENGES } from './data/archChallenges.js';
import {
  AZS, createArch,
  getSubnet, getRouteTable, getSecurityGroup,
  addSubnet, updateSubnet, removeSubnet, addNat, removeNat,
  addRouteTable, removeRouteTable, addRoute, removeRoute,
  associateSubnet, disassociateSubnet,
  addSecurityGroup, removeSecurityGroup, addSgRule, removeSgRule,
  addWorkload, updateWorkload, removeWorkload,
  isPublicSubnet, effectiveRouteTable,
} from './lib/archModel.js';
import { validateStructure, evaluateBestPractices } from './lib/archValidate.js';
import { evaluateGoals } from './lib/archGoals.js';

const store = createStore();

const SANDBOX = {
  id: 'sandbox',
  title: 'Sandbox',
  brief: 'Free build: no goals, no grading. Structural checks and every best-practice '
    + 'rule run against whatever you design. Security groups model inbound rules only '
    + '(outbound is treated as allow-all).',
  roles: [],
  goals: [],
  bestPractices: 'all',
  hints: [],
  startState: null,
  refSolution: null,
};

let challenge = null; // null = landing
let arch = null;
let results = null;      // { errors, goalRows, bpRows } from the last Check
let hintsShown = 0;
let failedChecks = 0;

function findChallenge(id) {
  if (id === 'sandbox') return SANDBOX;
  return ARCH_CHALLENGES.find((c) => c.id === id) || null;
}

function openFromHash() {
  const id = window.location.hash.replace(/^#\/?/, '');
  challenge = findChallenge(id);
  results = null;
  hintsShown = 0;
  failedChecks = 0;
  if (challenge) {
    arch = store.getArchDraft(challenge.id)
      || (challenge.startState ? challenge.startState() : createArch());
  } else {
    arch = null;
  }
  renderAll();
}

// Every committed edit funnels through here: persist the draft, invalidate
// stale results, re-render everything.
function changed() {
  store.setArchDraft(challenge.id, arch);
  results = null;
  renderAll();
}

function renderAll() {
  const landing = document.getElementById('arch-landing');
  const workbench = document.getElementById('arch-workbench');
  landing.hidden = !!challenge;
  workbench.hidden = !challenge;
  if (!challenge) {
    renderLanding(landing);
    return;
  }
  renderHead(document.getElementById('arch-head'));
  renderBuilder(document.getElementById('arch-builder'));
  renderDiagram(document.getElementById('arch-diagram'));
  renderTask(document.getElementById('arch-task'));
}

function renderLanding(mount) {
  const done = store.getArchResults();
  const cards = ARCH_CHALLENGES.map((ch, i) => {
    const result = done[ch.id];
    const badge = result
      ? `<p class="badge-done">✓ Completed — best practices ${result.bpPassed}/${result.bpApplicable || '–'}</p>`
      : '<p class="arch-mini">Not completed yet</p>';
    return `
      <a class="arch-card" href="#${ch.id}">
        <h3>${i + 1}. ${escapeHtml(ch.title)}</h3>
        <p class="arch-mini">${escapeHtml(ch.brief.slice(0, 110))}…</p>
        ${badge}
      </a>`;
  }).join('');
  mount.innerHTML = `
    <p>Each challenge gives you a scenario; build the architecture that satisfies it.
       Your design is checked three ways: <strong>structural</strong> (would AWS accept it),
       <strong>functional</strong> (a connectivity simulation of the scenario's goals), and
       <strong>best practices</strong> (advisory score). Drafts autosave locally.</p>
    <div class="arch-cards">
      ${cards}
      <a class="arch-card" href="#sandbox"><h3>Sandbox</h3>
        <p class="arch-mini">Free build with live structural + best-practice checks. No goals.</p></a>
    </div>`;
}

function renderHead(mount) {
  mount.innerHTML = `
    <p><a href="#">← All challenges</a></p>
    <h2>${escapeHtml(challenge.title)}</h2>
    <p>${escapeHtml(challenge.brief)}</p>`;
}

window.addEventListener('hashchange', openFromHash);
openFromHash();
```

(`renderBuilder`, `renderDiagram`, `renderTask` don't exist yet — declare them as empty stub functions at the bottom of this step and fill `renderBuilder` in Step 3, the other two in Task 11.)

- [ ] **Step 3: Implement `renderBuilder` + event delegation**

Append to `js/arch-challenge.js`:

```js
function options(list, selected, labelFor) {
  return list.map((item) => {
    const value = typeof item === 'string' ? item : item.id;
    const label = labelFor ? labelFor(item) : value;
    return `<option value="${escapeHtml(value)}" ${value === selected ? 'selected' : ''}>${escapeHtml(label)}</option>`;
  }).join('');
}

function renderBuilder(mount) {
  const subnetOpts = (sel) => options(arch.subnets, sel, (s) => `${s.name} (${s.cidr}, AZ ${s.az})`);
  const roleOpts = ['', ...challenge.roles.map((r) => r.id)];

  const subnetRows = arch.subnets.map((s) => `
    <div class="arch-row">
      <input type="text" value="${escapeHtml(s.name)}" data-action="subnet-name" data-id="${s.id}" aria-label="Subnet name" />
      <select data-action="subnet-az" data-id="${s.id}" aria-label="AZ">${options(AZS, s.az, null)}</select>
      <input type="text" value="${escapeHtml(s.cidr)}" data-action="subnet-cidr" data-id="${s.id}" aria-label="Subnet CIDR" />
      <button type="button" class="arch-del" data-action="subnet-del" data-id="${s.id}" title="Delete subnet">✕</button>
    </div>`).join('');

  const natRows = arch.natGateways.map((n) => `
    <div class="arch-row">
      <span class="arch-mini">${n.id} in</span>
      <select data-action="nat-subnet" data-id="${n.id}">${subnetOpts(n.subnetId)}</select>
      <button type="button" class="arch-del" data-action="nat-del" data-id="${n.id}" title="Delete NAT">✕</button>
    </div>`).join('');

  const targetOpts = (sel) => options(
    ['igw', ...arch.natGateways.map((n) => `nat:${n.id}`)], sel, null,
  );
  const rtSections = arch.routeTables.map((rt) => {
    const routeRows = rt.routes.map((r, i) => `
      <div class="arch-row">
        <input type="text" value="${escapeHtml(r.destCidr)}" data-action="route-dest" data-id="${rt.id}" data-index="${i}" aria-label="Destination CIDR" />
        <span class="arch-mini">→</span>
        <select data-action="route-target" data-id="${rt.id}" data-index="${i}">${targetOpts(r.target)}</select>
        <button type="button" class="arch-del" data-action="route-del" data-id="${rt.id}" data-index="${i}">✕</button>
      </div>`).join('');
    const assocBoxes = arch.subnets.map((s) => {
      const isHere = rt.subnetIds.includes(s.id);
      return `<label class="arch-mini"><input type="checkbox" data-action="rt-assoc" data-id="${rt.id}" data-subnet="${s.id}" ${isHere ? 'checked' : ''}/> ${escapeHtml(s.name)}</label>`;
    }).join(' ');
    return `
      <div class="arch-section">
        <h3>${escapeHtml(rt.name)}${rt.isMain ? ' (main)' : ''}
          ${rt.isMain ? '' : `<button type="button" class="arch-del" data-action="rt-del" data-id="${rt.id}">✕</button>`}</h3>
        <p class="arch-mini">local route (${escapeHtml(arch.vpc.cidr)}) is implicit</p>
        ${routeRows}
        <button type="button" class="arch-add" data-action="route-add" data-id="${rt.id}">+ route</button>
        <p class="arch-mini">Associated subnets: ${assocBoxes || '<em>none (subnets default to main)</em>'}</p>
      </div>`;
  }).join('');

  const sgSections = arch.securityGroups.map((sg) => {
    const ruleRows = sg.inbound.map((r, i) => `
      <div class="arch-row">
        <span class="arch-mini">TCP</span>
        <input type="number" value="${r.portFrom}" data-action="rule-portfrom" data-id="${sg.id}" data-index="${i}" aria-label="Port from" />
        <span class="arch-mini">–</span>
        <input type="number" value="${r.portTo}" data-action="rule-portto" data-id="${sg.id}" data-index="${i}" aria-label="Port to" />
        <span class="arch-mini">from</span>
        <input type="text" value="${escapeHtml(r.source)}" list="arch-sg-sources" data-action="rule-source" data-id="${sg.id}" data-index="${i}" aria-label="Source" />
        <button type="button" class="arch-del" data-action="rule-del" data-id="${sg.id}" data-index="${i}">✕</button>
      </div>`).join('');
    return `
      <div class="arch-section">
        <h3><input type="text" value="${escapeHtml(sg.name)}" data-action="sg-name" data-id="${sg.id}" aria-label="Security group name" />
          <button type="button" class="arch-del" data-action="sg-del" data-id="${sg.id}">✕</button></h3>
        ${ruleRows || '<p class="arch-mini">No inbound rules — denies all inbound.</p>'}
        <button type="button" class="arch-add" data-action="rule-add" data-id="${sg.id}">+ inbound rule</button>
      </div>`;
  }).join('');

  const wlSections = arch.workloads.map((wl) => {
    const subnetBoxes = arch.subnets.map((s) => `
      <label class="arch-mini"><input type="checkbox" data-action="wl-subnet" data-id="${wl.id}" data-subnet="${s.id}"
        ${wl.subnetIds.includes(s.id) ? 'checked' : ''}/> ${escapeHtml(s.name)}</label>`).join(' ');
    const sgBoxes = arch.securityGroups.map((g) => `
      <label class="arch-mini"><input type="checkbox" data-action="wl-sg" data-id="${wl.id}" data-sg="${g.id}"
        ${wl.sgIds.includes(g.id) ? 'checked' : ''}/> ${escapeHtml(g.name)}</label>`).join(' ');
    const roleSelect = challenge.roles.length === 0 ? '' : `
      <label class="arch-mini">role
        <select data-action="wl-role" data-id="${wl.id}">
          ${options(roleOpts, wl.role || '', (id) => id || '(none)')}
        </select></label>`;
    const typeBits = wl.type === 'ec2'
      ? `<label class="arch-mini"><input type="checkbox" data-action="wl-publicip" data-id="${wl.id}" ${wl.publicIp ? 'checked' : ''}/> public IP</label>`
      : wl.type === 'rds'
        ? `<label class="arch-mini"><input type="checkbox" data-action="wl-multiaz" data-id="${wl.id}" ${wl.multiAz ? 'checked' : ''}/> Multi-AZ</label>`
        : '';
    return `
      <div class="arch-section">
        <h3>${wl.type.toUpperCase()}
          <input type="text" value="${escapeHtml(wl.name)}" data-action="wl-name" data-id="${wl.id}" aria-label="Workload name" />
          <button type="button" class="arch-del" data-action="wl-del" data-id="${wl.id}">✕</button></h3>
        <div class="arch-row">${roleSelect}
          <label class="arch-mini">port <input type="number" value="${wl.port}" data-action="wl-port" data-id="${wl.id}" /></label>
          ${typeBits}</div>
        <p class="arch-mini">Subnets: ${subnetBoxes || '<em>create subnets first</em>'}</p>
        <p class="arch-mini">Security groups: ${sgBoxes || '<em>none defined</em>'}</p>
      </div>`;
  }).join('');

  mount.innerHTML = `
    <h2>Builder</h2>
    <datalist id="arch-sg-sources">
      <option value="0.0.0.0/0"></option>
      ${arch.securityGroups.map((g) => `<option value="sg:${g.id}">${escapeHtml(g.name)}</option>`).join('')}
    </datalist>
    <div class="arch-section">
      <h3>VPC</h3>
      <div class="arch-row">
        <label class="arch-mini">CIDR <input type="text" value="${escapeHtml(arch.vpc.cidr)}" data-action="vpc-cidr" /></label>
        <label class="arch-mini"><input type="checkbox" data-action="vpc-igw" ${arch.vpc.igwAttached ? 'checked' : ''}/> Internet gateway attached</label>
      </div>
    </div>
    <div class="arch-section"><h3>Subnets</h3>${subnetRows}
      <button type="button" class="arch-add" data-action="subnet-add">+ subnet</button></div>
    <div class="arch-section"><h3>NAT gateways</h3>${natRows}
      <button type="button" class="arch-add" data-action="nat-add" ${arch.subnets.length ? '' : 'disabled'}>+ NAT gateway</button></div>
    ${rtSections}
    <button type="button" class="arch-add" data-action="rt-add">+ route table</button>
    ${sgSections}
    <button type="button" class="arch-add" data-action="sg-add">+ security group</button>
    ${wlSections}
    <div class="arch-row">
      <button type="button" data-action="wl-add" data-type="ec2" ${arch.subnets.length ? '' : 'disabled'}>+ EC2</button>
      <button type="button" data-action="wl-add" data-type="alb" ${arch.subnets.length ? '' : 'disabled'}>+ ALB</button>
      <button type="button" data-action="wl-add" data-type="rds" ${arch.subnets.length ? '' : 'disabled'}>+ RDS</button>
    </div>
    <p class="arch-mini">Simplification: security groups are inbound-only here; outbound is allow-all.</p>`;
}

// One delegated handler pair drives every builder control.
const ACTIONS = {
  'vpc-cidr': (el) => { arch.vpc.cidr = el.value.trim(); },
  'vpc-igw': (el) => { arch.vpc.igwAttached = el.checked; },
  'subnet-add': () => { addSubnet(arch, { az: 'a', cidr: '' }); },
  'subnet-name': (el) => { updateSubnet(arch, el.dataset.id, { name: el.value.trim() }); },
  'subnet-az': (el) => { updateSubnet(arch, el.dataset.id, { az: el.value }); },
  'subnet-cidr': (el) => { updateSubnet(arch, el.dataset.id, { cidr: el.value.trim() }); },
  'subnet-del': (el) => { removeSubnet(arch, el.dataset.id); },
  'nat-add': () => { addNat(arch, arch.subnets[0].id); },
  'nat-subnet': (el) => { const nat = arch.natGateways.find((n) => n.id === el.dataset.id); if (nat) nat.subnetId = el.value; },
  'nat-del': (el) => { removeNat(arch, el.dataset.id); },
  'rt-add': () => { addRouteTable(arch); },
  'rt-del': (el) => { removeRouteTable(arch, el.dataset.id); },
  'route-add': (el) => { addRoute(arch, el.dataset.id, { destCidr: '0.0.0.0/0', target: 'igw' }); },
  'route-dest': (el) => { getRouteTable(arch, el.dataset.id).routes[el.dataset.index].destCidr = el.value.trim(); },
  'route-target': (el) => { getRouteTable(arch, el.dataset.id).routes[el.dataset.index].target = el.value; },
  'route-del': (el) => { removeRoute(arch, el.dataset.id, Number(el.dataset.index)); },
  'rt-assoc': (el) => {
    if (el.checked) associateSubnet(arch, el.dataset.id, el.dataset.subnet);
    else disassociateSubnet(arch, el.dataset.subnet);
  },
  'sg-add': () => { addSecurityGroup(arch); },
  'sg-name': (el) => { const sg = getSecurityGroup(arch, el.dataset.id); if (sg) sg.name = el.value.trim(); },
  'sg-del': (el) => { removeSecurityGroup(arch, el.dataset.id); },
  'rule-add': (el) => { addSgRule(arch, el.dataset.id, { portFrom: 80, source: '0.0.0.0/0' }); },
  'rule-portfrom': (el) => { getSecurityGroup(arch, el.dataset.id).inbound[el.dataset.index].portFrom = Number(el.value); },
  'rule-portto': (el) => { getSecurityGroup(arch, el.dataset.id).inbound[el.dataset.index].portTo = Number(el.value); },
  'rule-source': (el) => { getSecurityGroup(arch, el.dataset.id).inbound[el.dataset.index].source = el.value.trim(); },
  'rule-del': (el) => { removeSgRule(arch, el.dataset.id, Number(el.dataset.index)); },
  'wl-add': (el) => { addWorkload(arch, { type: el.dataset.type }); },
  'wl-name': (el) => { updateWorkload(arch, el.dataset.id, { name: el.value.trim() }); },
  'wl-role': (el) => { updateWorkload(arch, el.dataset.id, { role: el.value || null }); },
  'wl-port': (el) => { updateWorkload(arch, el.dataset.id, { port: Number(el.value) }); },
  'wl-publicip': (el) => { updateWorkload(arch, el.dataset.id, { publicIp: el.checked }); },
  'wl-multiaz': (el) => { updateWorkload(arch, el.dataset.id, { multiAz: el.checked }); },
  'wl-subnet': (el) => {
    const wl = arch.workloads.find((w) => w.id === el.dataset.id);
    wl.subnetIds = el.checked
      ? [...wl.subnetIds, el.dataset.subnet]
      : wl.subnetIds.filter((sid) => sid !== el.dataset.subnet);
  },
  'wl-sg': (el) => {
    const wl = arch.workloads.find((w) => w.id === el.dataset.id);
    wl.sgIds = el.checked
      ? [...wl.sgIds, el.dataset.sg]
      : wl.sgIds.filter((gid) => gid !== el.dataset.sg);
  },
  'wl-del': (el) => { removeWorkload(arch, el.dataset.id); },
};

function dispatchAction(event, kinds) {
  const el = event.target.closest('[data-action]');
  if (!el || !kinds.includes(el.tagName)) return;
  const fn = ACTIONS[el.dataset.action];
  if (!fn) return;
  fn(el);
  changed();
}

document.getElementById('arch-builder').addEventListener('click', (e) => dispatchAction(e, ['BUTTON']));
document.getElementById('arch-builder').addEventListener('change', (e) => dispatchAction(e, ['INPUT', 'SELECT']));
```

- [ ] **Step 4: Verify in the browser**

Start the `aws-site` dev server (launch.json) and open `http://localhost:8000/architecture-challenge.html`:
- Landing shows 8 numbered cards + sandbox; every card links to `#<id>`.
- Open `#public-web`: builder renders; add a subnet, set its CIDR, attach the IGW, add a route table with a `0.0.0.0/0 → igw` route, associate the subnet, add an SG + rule, add an EC2 — every control round-trips and the page re-renders without console errors.
- Reload: the draft restores (autosave works). Back-link returns to landing.
- Check the browser console for errors after each interaction.

- [ ] **Step 5: Commit**

```bash
git add architecture-challenge.html js/arch-challenge.js
git commit -m "Add architecture challenge page shell, landing, and builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 11: Diagram, Check results, hints, reveal, reset

**Files:**
- Modify: `js/arch-challenge.js` (replace the `renderDiagram`/`renderTask` stubs; add `runCheck` and task-panel actions)

**Interfaces:**
- Consumes: `validateStructure`, `evaluateBestPractices`, `evaluateGoals`, `isPublicSubnet`, `effectiveRouteTable`, storage methods from Task 8.
- Produces: the finished page. Completion recording semantics fixed here: a challenge is **completed** when a Check finds zero structural errors and every goal passes (sandbox and role-less checks never record); `bpPassed`/`bpApplicable` count only `applicable` best-practice rows; a failed Check increments `failedChecks`, and the "Show reference solution" button appears once `failedChecks >= 1` (with a `confirm()` since it overwrites the draft).

- [ ] **Step 1: Implement `renderDiagram`**

Replace the stub:

```js
function renderDiagram(mount) {
  const azsInUse = AZS.filter((az) => arch.subnets.some((s) => s.az === az));
  const azCols = azsInUse.map((az) => {
    const cards = arch.subnets.filter((s) => s.az === az).map((s) => {
      const rt = effectiveRouteTable(arch, s.id);
      const nats = arch.natGateways.filter((n) => n.subnetId === s.id)
        .map((n) => `<span class="arch-chip">NAT ${escapeHtml(n.id)}</span>`).join('');
      const wls = arch.workloads.filter((w) => w.subnetIds.includes(s.id))
        .map((w) => `<span class="arch-chip">${escapeHtml(w.type.toUpperCase())} ${escapeHtml(w.name)}${w.publicIp ? ' ⬆︎' : ''}</span>`).join('');
      const pub = isPublicSubnet(arch, s.id);
      return `
        <div class="arch-subnet ${pub ? 'is-public' : 'is-private'}">
          <strong>${escapeHtml(s.name)}</strong> <span class="cidr">${escapeHtml(s.cidr)}</span>
          <span class="arch-mini">${pub ? 'public' : 'private'} · ${escapeHtml(rt ? rt.name : '?')}</span>
          <div>${nats}${wls}</div>
        </div>`;
    }).join('');
    return `<div class="arch-az"><h4>AZ ${escapeHtml(az)}</h4>${cards}</div>`;
  }).join('');
  const unplaced = arch.workloads.filter((w) => w.subnetIds.length === 0)
    .map((w) => `<span class="arch-chip">${escapeHtml(w.type.toUpperCase())} ${escapeHtml(w.name)}</span>`).join('');
  mount.innerHTML = `
    <h2>Diagram</h2>
    <div class="arch-vpc-box">
      ${arch.vpc.igwAttached ? '<span class="arch-igw-chip">IGW</span>' : ''}
      <span class="cidr">VPC ${escapeHtml(arch.vpc.cidr)}</span>
      ${azsInUse.length ? `<div class="arch-az-grid">${azCols}</div>` : '<p class="arch-mini">No subnets yet — the map fills in as you build.</p>'}
    </div>
    ${unplaced ? `<p class="arch-mini">Not placed in any subnet: ${unplaced}</p>` : ''}
    <p class="arch-mini">Public subnets are tinted green (route to an attached IGW); private are blue. ⬆︎ = public IP.</p>`;
}
```

- [ ] **Step 2: Implement `runCheck` and `renderTask`**

```js
function runCheck() {
  const { errors } = validateStructure(arch);
  const goalRows = errors.length === 0 ? evaluateGoals(arch, challenge) : null;
  const bpRows = evaluateBestPractices(arch, challenge.bestPractices);
  results = { errors, goalRows, bpRows };
  const complete = errors.length === 0 && challenge.goals.length > 0
    && goalRows.every((r) => r.ok);
  if (complete && challenge.id !== 'sandbox') {
    const applicable = bpRows.filter((r) => r.applicable);
    store.recordArchResult(challenge.id, {
      completedAt: Date.now(),
      bpPassed: applicable.filter((r) => r.ok).length,
      bpApplicable: applicable.length,
    });
  } else if (!complete) {
    failedChecks += 1;
  }
  renderAll();
}

function renderTask(mount) {
  const rolesHtml = challenge.roles.map((role) => {
    const assigned = arch.workloads.filter((w) => w.role === role.id);
    return `<li>${escapeHtml(role.label)}: ${assigned.length
      ? escapeHtml(assigned.map((w) => w.name).join(', '))
      : '<em>unassigned — set a workload\'s role</em>'}</li>`;
  }).join('');

  let resultsHtml = '';
  if (results) {
    if (results.errors.length > 0) {
      resultsHtml += `<h3>Structural problems (fix these first)</h3>
        ${results.errors.map((e) => `<div class="arch-goal fail">${escapeHtml(e.message)}</div>`).join('')}`;
    } else if (results.goalRows && results.goalRows.length > 0) {
      const allOk = results.goalRows.every((r) => r.ok);
      resultsHtml += `<h3>Goals ${allOk ? '— all satisfied 🎉' : ''}</h3>`;
      resultsHtml += results.goalRows.map((row) => {
        const traces = row.traces.map((t) => `
          <details ${t.ok ? '' : 'open'}><summary class="arch-mini">${escapeHtml(t.title)}</summary>
            <ul class="arch-trace">${t.trace.map((s) => `<li class="${s.ok ? 'ok' : 'fail'}">${escapeHtml(s.label)}</li>`).join('')}</ul>
          </details>`).join('');
        return `<div class="arch-goal ${row.ok ? 'ok' : 'fail'}">
          ${escapeHtml(row.label)}
          <p class="arch-mini">${escapeHtml(row.detail)}</p>${traces}</div>`;
      }).join('');
    }
    const applicable = results.bpRows.filter((r) => r.applicable);
    if (applicable.length > 0) {
      const passed = applicable.filter((r) => r.ok).length;
      resultsHtml += `<h3>Best practices</h3>
        <p class="arch-score">${passed}/${applicable.length}</p>
        ${applicable.map((r) => `<div class="arch-goal ${r.ok ? 'ok' : 'fail'}">
          ${escapeHtml(r.message)}${r.ok ? '' : `<p class="arch-mini">Why: ${escapeHtml(r.why)}</p>`}</div>`).join('')}`;
    }
  }

  const hintsHtml = challenge.hints.length === 0 ? '' : `
    ${challenge.hints.slice(0, hintsShown).map((h) => `<p class="arch-mini">💡 ${escapeHtml(h)}</p>`).join('')}
    ${hintsShown < challenge.hints.length
      ? `<button type="button" data-action="hint">Hint ${hintsShown + 1}/${challenge.hints.length}</button>` : ''}`;

  const reveal = challenge.refSolution && failedChecks >= 1
    ? '<button type="button" data-action="reveal">Show reference solution</button>' : '';

  mount.innerHTML = `
    <h2>${challenge.id === 'sandbox' ? 'Checks' : 'Task'}</h2>
    ${challenge.roles.length ? `<ul>${rolesHtml}</ul>` : ''}
    <div class="arch-row">
      <button type="button" data-action="check">Check architecture</button>
      <button type="button" data-action="reset">Reset</button>
      ${reveal}
    </div>
    ${hintsHtml}
    ${results ? resultsHtml : '<p class="arch-mini">Build, then hit Check. Results explain every pass and fail.</p>'}`;
}

document.getElementById('arch-task').addEventListener('click', (event) => {
  const el = event.target.closest('button[data-action]');
  if (!el) return;
  if (el.dataset.action === 'check') runCheck();
  if (el.dataset.action === 'hint') { hintsShown += 1; renderAll(); }
  if (el.dataset.action === 'reveal'
      && window.confirm('Replace your current design with the reference solution?')) {
    arch = challenge.refSolution();
    changed();
  }
  if (el.dataset.action === 'reset'
      && window.confirm('Discard your design and start this challenge over?')) {
    store.clearArchDraft(challenge.id);
    arch = challenge.startState ? challenge.startState() : createArch();
    results = null;
    renderAll();
  }
});
```

- [ ] **Step 3: Verify the full loop in the browser**

On `http://localhost:8000/architecture-challenge.html`:
- Solve `#public-web` by hand (IGW → public subnet → route → SG 80 → EC2 with role `web` + public IP): Check turns every goal green, best-practice score shows, landing card now shows ✓ with the score.
- Break it (untick public IP), Check: the `internetReaches` goal fails and its open trace names the public-IP step; "Show reference solution" appears; clicking it (accept the confirm) loads a passing design.
- Open `#fix-broken`: the start state renders pre-populated; Check shows the two failing goals and the DB best-practice warning; hints reveal one at a time.
- Open `#sandbox`: no roles/goals; Check shows structural + all best practices only.
- Reset restores the start state and clears the draft (confirm dialog).
- Toggle OS dark mode: panels, tints, and traces stay legible.
- No console errors throughout.

- [ ] **Step 4: Commit**

```bash
git add js/arch-challenge.js
git commit -m "Add diagram, three-level check results, hints, and reveal flow

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Task 12: Wiring, docs, and final walkthrough

**Files:**
- Modify: `js/views/home.js` (link line after the VPC Explorer link, ~line 25)
- Modify: `js/views/progress.js` (small "Architecture challenges" card)
- Modify: `README.md` ("What's here" list)
- Modify: `docs/superpowers/specs/2026-07-20-architecture-challenge-design.md` (record the styles-inline deviation)

**Interfaces:**
- Consumes: `ARCH_CHALLENGES` and `store.getArchResults()` in the progress view.

- [ ] **Step 1: Home link**

In `js/views/home.js`, directly after the existing VPC Explorer line, add:

```js
      <p><a href="architecture-challenge.html">Interactive: Architecture Challenge</a> — get a scenario, build the VPC to satisfy it, and have the design checked for correctness and best practices.</p>
```

- [ ] **Step 2: Progress card**

In `js/views/progress.js`, add an "Architecture challenges" section following the file's existing card/section pattern (import `ARCH_CHALLENGES` from `../data/archChallenges.js`; the view already creates a store): completed count headline (`N of ${ARCH_CHALLENGES.length} completed`) and one line per completed challenge with its title and `bpPassed/bpApplicable` best-practice score, reading `store.getArchResults()`. Follow the markup/classes of the neighboring sections exactly; link the section heading to `architecture-challenge.html`.

- [ ] **Step 3: README bullet**

In `README.md`'s "What's here" list, after the VPC Explorer bullet:

```markdown
- **[Architecture Challenge](architecture-challenge.html)** — a standalone builder game (linked from Home): each challenge hands you a scenario (public web server, 3-tier HA app, broken-architecture fix-it…) and validates your VPC design three ways — structural correctness, a connectivity simulation of the scenario's goals, and a best-practice score with explanations.
```

- [ ] **Step 4: Spec deviation note**

In the spec's Design section, amend the styles sentence to record reality: page-specific styles live in `architecture-challenge.html`'s `<style>` block (matching `vpc-explorer.html`), not `css/style.css`, with an "(amended during implementation)" note.

- [ ] **Step 5: Full verification sweep**

From `aws/`:

```bash
node --test                          # every lib + data test passes
node scripts/validate-content.mjs    # includes validateArchChallenges
node ../scripts/check-drift.mjs      # run from repo root as: node scripts/check-drift.mjs — must stay clean
```

Then in the browser: Home shows the new link; Progress shows the architecture card (with the earlier completion recorded in Task 11's walkthrough); the exported Anki flow is untouched (`node ../scripts/export-anki.mjs aws` still runs — the challenge data is not a flashcard deck and must NOT appear in it).

- [ ] **Step 6: Commit**

```bash
git add js/views/home.js js/views/progress.js README.md docs/superpowers/specs/2026-07-20-architecture-challenge-design.md
git commit -m "Wire architecture challenge into home, progress, and docs

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Plan self-review notes

- **Spec coverage:** state shape + mutators (T1), structural rules (T2), simulator + traces (T3), best practices (T4), goal vocabulary (T5), 8 challenges with proven refSolutions + hints (T6–7), storage keys + Progress card (T8, T12), content validation (T9), landing/builder/diagram/results/reveal UI (T10–11), Home/README wiring + spec amendment (T12). The spec's "styles in css/style.css" line is superseded by the Global Constraints deviation, recorded in T12.
- **Type consistency spot-checks:** `evaluateBestPractices` rows `{ruleId, applicable, ok, message, why}` consumed identically in T6 harness and T11 UI; goal rows `{goal, label, ok, detail, traces:[{title, ok, trace:[{label, ok}]}]}` consumed in T6 harness and T11 `renderTask`; `recordArchResult({completedAt, bpPassed, bpApplicable})` written in T11, read in T10 landing and T12 progress card.
- **Known simplifications (by design, stated in UI or spec):** inbound-only SGs; no NACLs/IPv6/peering/endpoints; internet-facing ALBs only; RDS never internet-open (placement is a best-practice concern).









