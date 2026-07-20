# Architecture Challenge Canvas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the Architecture Challenge's form builder with a structured drag-and-drop canvas: palette drops into nested VPC/subnet boxes, chip re-homing, and connection gestures whose popovers create the real SG rules and routes.

**Architecture:** A new pure decision module `js/lib/archCanvasRules.js` (drop legality, connection intents with `apply` mutators, derived arrow list) is the testable core; a new DOM-only `js/arch-canvas.js` renders the canvas (nested boxes + SVG arrow overlay + pointer-event drag + popovers + inspector); `js/arch-challenge.js` slims to page shell, landing, task panel, and Check flow. The architecture state shape, engine modules, challenges, storage, and drafts are untouched.

**Tech Stack:** Vanilla ES modules, Pointer Events (not the HTML5 drag API), one SVG overlay for arrows, `node --test`.

**Spec:** [aws/docs/superpowers/specs/2026-07-20-arch-canvas-design.md](../specs/2026-07-20-arch-canvas-design.md)

## Global Constraints

- All paths relative to `aws/`; commands run from `/Users/toddcooke/IdeaProjects/learn/aws` unless stated.
- Vanilla JS ES modules; no dependencies, no build step. New files are aws-only (nothing in the drift SHARED list changes).
- The architecture state shape MUST NOT change — no layout data is stored; dragging changes parentage only. Existing drafts must open unchanged.
- `archModel.js`, `archSimulate.js`, `archGoals.js`, `archValidate.js`, `js/data/archChallenges.js`, `storage.js` are read-only for this plan (imports only, no edits).
- All data-derived strings rendered into HTML go through `escapeHtml` (`js/lib/html.js`).
- Re-render only on committed changes (the existing `changed()` funnel); during a drag, only transient ghost/highlight DOM may change.
- Every palette item must also work via click-to-add (never drag-only).
- Commit style: imperative, no prefix, ending `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `node --test` and `node scripts/validate-content.mjs` pass at every commit; `node scripts/check-drift.mjs` (repo root) stays clean.

### Shared vocabulary (used by every task)

`ref` objects name canvas endpoints:

```js
{ type: 'internet' }                 // the Internet node (canvas fixture)
{ type: 'igw' }                      // the IGW chip on the VPC border
{ type: 'vpc' }                      // the VPC box (drop target)
{ type: 'sg-tray' }                  // the SG tray (drop target)
{ type: 'subnet',   id: 'subnet-1' }
{ type: 'nat',      id: 'nat-1' }
{ type: 'workload', id: 'ec2-1' }
{ type: 'sg',       id: 'sg-1' }     // tray chip (selectable, not connectable)
```

Palette kinds: `'subnet' | 'nat' | 'ec2' | 'alb' | 'rds' | 'sg'`.

---

### Task 1: Drop legality + connection intents (`archCanvasRules.js`, part 1)

**Files:**
- Create: `js/lib/archCanvasRules.js`
- Test: `js/lib/archCanvasRules.test.mjs` (create)

**Interfaces:**
- Consumes (read-only): `getSubnet`, `getWorkload`, `getNat`, `getSecurityGroup`, `effectiveRouteTable`, `addSubnet`, `addNat`, `addWorkload`, `addSecurityGroup`, `addSgRule`, `addRouteTable`, `addRoute`, `associateSubnet`, `updateWorkload` from `./archModel.js`.
- Produces:
  - `canDrop(kind, targetRef, arch): boolean` — `kind` is a palette kind or an existing node id (`subnet-*`, `nat-*`, `ec2-*`, `alb-*`, `rds-*`, `sg-*`). Palette: `subnet`→vpc, `nat`/`ec2`/`rds`→subnet, `alb`→vpc, `sg`→sg-tray. Existing: subnets→vpc (AZ change is inspector-only; canvas re-home of a subnet is a no-op allowed onto vpc), nat/ec2/rds→a *different existing* subnet, alb→vpc, sg→sg-tray. Everything else false; unknown ids false.
  - `connectionIntent(fromRef, toRef, arch): null | { kind, description, defaultPort, warning, apply(arch, options) }` — kinds `'sg-rule-internet' | 'sg-rule-chain' | 'route-igw' | 'route-nat'`; `options.port` (number) honored by the SG kinds; `warning` is a string or null (set for route-igw when the IGW is detached); `description` is plain English naming real resources. `apply` mutates `arch` via archModel and returns nothing.
  - SG auto-attach helper behavior (internal `ensureSg(arch, workload)`): returns the workload's first attached SG; if none, creates `addSecurityGroup(arch, `${workload.name}-sg`)` and attaches it via `updateWorkload(..., { sgIds: [sg.id] })`.
  - Route helper behavior (internal `ensureOwnRouteTable(arch, subnet)`): the subnet's effective table if explicitly associated to it; otherwise `addRouteTable(arch, `${subnet.name}-rt`)` + `associateSubnet`.

- [ ] **Step 1: Write the failing tests**

Create `js/lib/archCanvasRules.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createArch, addSubnet, addNat, addRouteTable, addRoute, associateSubnet,
  addSecurityGroup, addSgRule, addWorkload, getSecurityGroup,
  effectiveRouteTable,
} from './archModel.js';
import { canDrop, connectionIntent } from './archCanvasRules.js';

function fixture() {
  const arch = createArch();
  arch.vpc.igwAttached = true;
  const pub = addSubnet(arch, { name: 'public-a', az: 'a', cidr: '10.0.1.0/24' });
  const priv = addSubnet(arch, { name: 'private-a', az: 'a', cidr: '10.0.2.0/24' });
  const rt = addRouteTable(arch, 'public');
  addRoute(arch, rt.id, { destCidr: '0.0.0.0/0', target: 'igw' });
  associateSubnet(arch, rt.id, pub.id);
  const web = addWorkload(arch, { type: 'ec2', name: 'web-1', subnetIds: [pub.id], publicIp: true, port: 80 });
  const db = addWorkload(arch, {
    type: 'rds', name: 'db-1',
    subnetIds: [priv.id, addSubnet(arch, { name: 'private-b', az: 'b', cidr: '10.0.3.0/24' }).id],
  });
  const nat = addNat(arch, pub.id);
  return { arch, pub, priv, rt, web, db, nat };
}

test('canDrop: palette placement rules', () => {
  const { arch, pub } = fixture();
  assert.equal(canDrop('subnet', { type: 'vpc' }, arch), true);
  assert.equal(canDrop('alb', { type: 'vpc' }, arch), true);
  assert.equal(canDrop('sg', { type: 'sg-tray' }, arch), true);
  for (const kind of ['nat', 'ec2', 'rds']) {
    assert.equal(canDrop(kind, { type: 'subnet', id: pub.id }, arch), true, kind);
    assert.equal(canDrop(kind, { type: 'vpc' }, arch), false, kind);
  }
  assert.equal(canDrop('subnet', { type: 'subnet', id: pub.id }, arch), false);
  assert.equal(canDrop('sg', { type: 'vpc' }, arch), false);
});

test('canDrop: re-homing existing nodes', () => {
  const { arch, pub, priv, web, nat } = fixture();
  assert.equal(canDrop(web.id, { type: 'subnet', id: priv.id }, arch), true);
  assert.equal(canDrop(web.id, { type: 'subnet', id: pub.id }, arch), false, 'same subnet is a no-op');
  assert.equal(canDrop(nat.id, { type: 'subnet', id: priv.id }, arch), true);
  assert.equal(canDrop(pub.id, { type: 'vpc' }, arch), true);
  assert.equal(canDrop(web.id, { type: 'vpc' }, arch), false);
  assert.equal(canDrop('ec2-99', { type: 'subnet', id: pub.id }, arch), false, 'unknown id');
});

test('connectionIntent: internet → workload creates an SG rule (auto-creating the SG)', () => {
  const { arch, web } = fixture();
  const intent = connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch);
  assert.equal(intent.kind, 'sg-rule-internet');
  assert.equal(intent.defaultPort, 80);
  assert.match(intent.description, /0\.0\.0\.0\/0/);
  intent.apply(arch, { port: 443 });
  const sg = getSecurityGroup(arch, web.sgIds[0]);
  assert.equal(sg.name, 'web-1-sg');
  assert.deepEqual(sg.inbound, [{ proto: 'tcp', portFrom: 443, portTo: 443, source: '0.0.0.0/0' }]);
});

test('connectionIntent: workload → workload chains SGs on both sides', () => {
  const { arch, web, db } = fixture();
  const intent = connectionIntent({ type: 'workload', id: web.id }, { type: 'workload', id: db.id }, arch);
  assert.equal(intent.kind, 'sg-rule-chain');
  assert.equal(intent.defaultPort, 5432);
  intent.apply(arch, { port: 5432 });
  const webSg = getSecurityGroup(arch, web.sgIds[0]);
  const dbSg = getSecurityGroup(arch, db.sgIds[0]);
  assert.equal(dbSg.inbound[0].source, `sg:${webSg.id}`);
  assert.equal(dbSg.inbound[0].portFrom, 5432);
});

test('connectionIntent: reuses existing SGs instead of creating duplicates', () => {
  const { arch, web } = fixture();
  const sg = addSecurityGroup(arch, 'my-sg');
  web.sgIds.push(sg.id);
  const intent = connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch);
  intent.apply(arch, { port: 80 });
  assert.equal(arch.securityGroups.length, 1, 'no new SG created');
  assert.equal(sg.inbound.length, 1);
});

test('connectionIntent: subnet → IGW routes via a created-or-extended explicit table', () => {
  const { arch, priv } = fixture();
  const intent = connectionIntent({ type: 'subnet', id: priv.id }, { type: 'igw' }, arch);
  assert.equal(intent.kind, 'route-igw');
  assert.equal(intent.warning, null, 'IGW attached: no warning');
  intent.apply(arch, {});
  const rt = effectiveRouteTable(arch, priv.id);
  assert.equal(rt.isMain, false, 'a new explicit table was created and associated');
  assert.deepEqual(rt.routes, [{ destCidr: '0.0.0.0/0', target: 'igw' }]);

  // Second route intent on the same subnet extends the SAME table.
  const { arch: a2, pub: p2, nat: n2 } = fixture();
  const first = connectionIntent({ type: 'subnet', id: p2.id }, { type: 'nat', id: n2.id }, a2);
  first.apply(a2, {});
  const t2 = effectiveRouteTable(a2, p2.id);
  assert.equal(t2.name, 'public', 'existing explicit table reused');
  assert.equal(t2.routes.length, 2);
});

test('connectionIntent: warns when routing to a detached IGW but still applies', () => {
  const { arch, priv } = fixture();
  arch.vpc.igwAttached = false;
  const intent = connectionIntent({ type: 'subnet', id: priv.id }, { type: 'igw' }, arch);
  assert.match(intent.warning, /not attached/i);
  intent.apply(arch, {});
  assert.equal(effectiveRouteTable(arch, priv.id).routes.length, 1);
});

test('connectionIntent: subnet → NAT routes to that NAT', () => {
  const { arch, priv, nat } = fixture();
  const intent = connectionIntent({ type: 'subnet', id: priv.id }, { type: 'nat', id: nat.id }, arch);
  assert.equal(intent.kind, 'route-nat');
  intent.apply(arch, {});
  assert.deepEqual(effectiveRouteTable(arch, priv.id).routes, [
    { destCidr: '0.0.0.0/0', target: `nat:${nat.id}` },
  ]);
});

test('connectionIntent: illegal pairs return null', () => {
  const { arch, pub, web, nat } = fixture();
  for (const [from, to] of [
    [{ type: 'workload', id: web.id }, { type: 'subnet', id: pub.id }],
    [{ type: 'workload', id: web.id }, { type: 'internet' }],
    [{ type: 'internet' }, { type: 'subnet', id: pub.id }],
    [{ type: 'igw' }, { type: 'subnet', id: pub.id }],
    [{ type: 'nat', id: nat.id }, { type: 'workload', id: web.id }],
    [{ type: 'workload', id: web.id }, { type: 'workload', id: web.id }],
    [{ type: 'internet' }, { type: 'igw' }],
  ]) {
    assert.equal(connectionIntent(from, to, arch), null, `${from.type}->${to.type}`);
  }
});

test('connectionIntent descriptions name real resources', () => {
  const { arch, web, db, priv, nat } = fixture();
  assert.match(connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch).description, /web-1/);
  assert.match(connectionIntent({ type: 'workload', id: web.id }, { type: 'workload', id: db.id }, arch).description, /db-1/);
  assert.match(connectionIntent({ type: 'subnet', id: priv.id }, { type: 'nat', id: nat.id }, arch).description, /private-a/);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/lib/archCanvasRules.test.mjs`
Expected: FAIL — `Cannot find module '.../js/lib/archCanvasRules.js'`

- [ ] **Step 3: Implement `canDrop` and `connectionIntent`**

Create `js/lib/archCanvasRules.js`:

```js
// aws/js/lib/archCanvasRules.js
//
// Pure decision logic behind the drag-and-drop canvas: which drops are
// legal, what a drawn connection means (as a popover description plus an
// apply() that performs the real archModel mutations), and which arrows to
// draw (derived from the model, never stored). The canvas DOM defers every
// judgment call here so it stays testable under node --test.

import {
  getSubnet, getWorkload, getNat, getSecurityGroup, effectiveRouteTable,
  addSecurityGroup, addSgRule, addRouteTable, addRoute, associateSubnet,
  updateWorkload,
} from './archModel.js';

const PALETTE_KINDS = ['subnet', 'nat', 'ec2', 'alb', 'rds', 'sg'];

function nodeKind(arch, id) {
  if (getSubnet(arch, id)) return 'subnet';
  if (getNat(arch, id)) return 'nat';
  if (getSecurityGroup(arch, id)) return 'sg';
  const wl = getWorkload(arch, id);
  return wl ? wl.type : null;
}

export function canDrop(kind, targetRef, arch) {
  const isPalette = PALETTE_KINDS.includes(kind);
  const resolved = isPalette ? kind : nodeKind(arch, kind);
  if (!resolved) return false;
  switch (resolved) {
    case 'subnet':
    case 'alb':
      return targetRef.type === 'vpc';
    case 'sg':
      return targetRef.type === 'sg-tray';
    case 'nat':
    case 'ec2':
    case 'rds': {
      if (targetRef.type !== 'subnet' || !getSubnet(arch, targetRef.id)) return false;
      if (isPalette) return true;
      // Re-home: dropping onto the container it's already in is a no-op.
      if (resolved === 'nat') return getNat(arch, kind).subnetId !== targetRef.id;
      const wl = getWorkload(arch, kind);
      // EC2 lives in exactly one subnet; RDS drops re-home its whole group's
      // "primary" placement — both treat same-subnet as a no-op.
      return !wl.subnetIds.includes(targetRef.id);
    }
    default:
      return false;
  }
}

// The workload's first attached SG, creating and attaching "<name>-sg" when
// it has none — connections never leave a workload SG-less.
function ensureSg(arch, workload) {
  if (workload.sgIds.length > 0) {
    return getSecurityGroup(arch, workload.sgIds[0]);
  }
  const sg = addSecurityGroup(arch, `${workload.name}-sg`);
  updateWorkload(arch, workload.id, { sgIds: [sg.id] });
  return sg;
}

// The subnet's explicit route table, creating "<name>-rt" and associating it
// when the subnet is (implicitly or explicitly) on main. Route connections
// never edit the main table — sharing tables is an inspector-level choice.
function ensureOwnRouteTable(arch, subnet) {
  const current = effectiveRouteTable(arch, subnet.id);
  if (current && !current.isMain) return current;
  const rt = addRouteTable(arch, `${subnet.name}-rt`);
  associateSubnet(arch, rt.id, subnet.id);
  return rt;
}

export function connectionIntent(fromRef, toRef, arch) {
  // Internet → workload: open the workload's port to 0.0.0.0/0.
  if (fromRef.type === 'internet' && toRef.type === 'workload') {
    const wl = getWorkload(arch, toRef.id);
    if (!wl) return null;
    return {
      kind: 'sg-rule-internet',
      defaultPort: wl.port,
      warning: null,
      description: `Allow TCP {port} to ${wl.name} from the internet (0.0.0.0/0) in its security group`,
      apply(a, options = {}) {
        const target = getWorkload(a, toRef.id);
        const sg = ensureSg(a, target);
        addSgRule(a, sg.id, { portFrom: options.port ?? target.port, source: '0.0.0.0/0' });
      },
    };
  }
  // workload → workload: SG-reference chaining on the destination.
  if (fromRef.type === 'workload' && toRef.type === 'workload' && fromRef.id !== toRef.id) {
    const from = getWorkload(arch, fromRef.id);
    const to = getWorkload(arch, toRef.id);
    if (!from || !to) return null;
    return {
      kind: 'sg-rule-chain',
      defaultPort: to.port,
      warning: null,
      description: `Allow TCP {port} to ${to.name} from ${from.name}'s security group`,
      apply(a, options = {}) {
        const src = ensureSg(a, getWorkload(a, fromRef.id));
        const dst = ensureSg(a, getWorkload(a, toRef.id));
        addSgRule(a, dst.id, { portFrom: options.port ?? getWorkload(a, toRef.id).port, source: `sg:${src.id}` });
      },
    };
  }
  // subnet → IGW / subnet → NAT: default route in the subnet's own table.
  if (fromRef.type === 'subnet' && (toRef.type === 'igw' || toRef.type === 'nat')) {
    const subnet = getSubnet(arch, fromRef.id);
    if (!subnet) return null;
    if (toRef.type === 'nat' && !getNat(arch, toRef.id)) return null;
    const viaNat = toRef.type === 'nat';
    return {
      kind: viaNat ? 'route-nat' : 'route-igw',
      defaultPort: null,
      warning: !viaNat && !arch.vpc.igwAttached
        ? 'The internet gateway is not attached to the VPC yet — this route will be flagged until you attach it.'
        : null,
      description: viaNat
        ? `Route ${subnet.name}'s internet traffic (0.0.0.0/0) through NAT gateway ${toRef.id}`
        : `Route ${subnet.name}'s internet traffic (0.0.0.0/0) out the internet gateway (makes it a public subnet)`,
      apply(a) {
        const s = getSubnet(a, fromRef.id);
        const rt = ensureOwnRouteTable(a, s);
        addRoute(a, rt.id, { destCidr: '0.0.0.0/0', target: viaNat ? `nat:${toRef.id}` : 'igw' });
      },
    };
  }
  return null;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/archCanvasRules.test.mjs`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add js/lib/archCanvasRules.js js/lib/archCanvasRules.test.mjs
git commit -m "Add canvas drop-legality and connection-intent rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Derived arrows (`archCanvasRules.js`, part 2)

**Files:**
- Modify: `js/lib/archCanvasRules.js` (append)
- Test: `js/lib/archCanvasRules.test.mjs` (append)

**Interfaces:**
- Consumes: `parseCidrStrict` from `./vpcMath.js` (add to imports); existing archModel getters.
- Produces: `derivedEdges(arch): [{ from, to, kind, label, fact }]` where `from`/`to` are refs from the shared vocabulary, `kind` is `'route' | 'sg-rule'`, `label` is short display text, and `fact` identifies the underlying model entry for deletion: `{ kind: 'route', rtbId, index }` or `{ kind: 'sg-rule', sgId, index }`.
  - Route edges: for every subnet, for every route in its *effective* table whose target is `igw` (`to: {type:'igw'}`) or `nat:<id>` (`to: {type:'nat', id}`), with `from: {type:'subnet', id}` and label = the destCidr. Shared tables therefore fan out one edge per associated subnet (correct: each subnet genuinely has that route). The `fact.index` is the route's index in `rtbId`'s `routes` array.
  - SG-rule edges: for every workload, for every rule on any of its attached SGs: source `0.0.0.0/0` → edge from `{type:'internet'}` labeled `TCP p`; source `sg:<id>` → one edge from **each** workload that has that SG attached; any other CIDR source → edge from `{type:'internet'}` labeled `cidr → TCP p` (external ranges render from the Internet node). Duplicate (from,to,fact) pairs are naturally distinct by fact index; a rule on an SG attached to two workloads yields edges to both.

- [ ] **Step 1: Write the failing tests**

Append to `js/lib/archCanvasRules.test.mjs` (extend the import from `./archCanvasRules.js` with `derivedEdges`):

```js
test('derivedEdges: route edges from every subnet on a shared table', () => {
  const { arch, pub, rt } = fixture();
  const sb = addSubnet(arch, { name: 'public-b', az: 'b', cidr: '10.0.9.0/24' });
  associateSubnet(arch, rt.id, sb.id);
  const edges = derivedEdges(arch).filter((e) => e.kind === 'route');
  assert.deepEqual(
    edges.map((e) => [e.from.id, e.to.type]).sort(),
    [[pub.id, 'igw'], [sb.id, 'igw']].sort(),
  );
  assert.deepEqual(edges[0].fact, { kind: 'route', rtbId: rt.id, index: 0 });
});

test('derivedEdges: nat route edge targets the nat ref', () => {
  const { arch, priv, nat } = fixture();
  connectionIntent({ type: 'subnet', id: priv.id }, { type: 'nat', id: nat.id }, arch).apply(arch, {});
  const edge = derivedEdges(arch).find((e) => e.kind === 'route' && e.from.id === priv.id);
  assert.deepEqual(edge.to, { type: 'nat', id: nat.id });
});

test('derivedEdges: internet, sg-ref, and external-CIDR rule edges', () => {
  const { arch, web, db } = fixture();
  connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch).apply(arch, { port: 80 });
  connectionIntent({ type: 'workload', id: web.id }, { type: 'workload', id: db.id }, arch).apply(arch, {});
  const dbSg = getSecurityGroup(arch, db.sgIds[0]);
  addSgRule(arch, dbSg.id, { portFrom: 22, source: '203.0.113.0/24' });

  const edges = derivedEdges(arch).filter((e) => e.kind === 'sg-rule');
  const byTo = (id) => edges.filter((e) => e.to.id === id);
  assert.deepEqual(byTo(web.id).map((e) => e.from.type), ['internet']);
  const dbEdges = byTo(db.id);
  assert.equal(dbEdges.length, 2);
  assert.ok(dbEdges.some((e) => e.from.type === 'workload' && e.from.id === web.id), 'sg-ref edge');
  assert.ok(dbEdges.some((e) => e.from.type === 'internet' && /203\.0\.113/.test(e.label)), 'external CIDR renders from internet node');
});

test('derivedEdges: an SG shared by two workloads fans edges to both', () => {
  const { arch, pub, web } = fixture();
  const web2 = addWorkload(arch, { type: 'ec2', name: 'web-2', subnetIds: [pub.id] });
  connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch).apply(arch, {});
  web2.sgIds = [...web.sgIds];
  const targets = derivedEdges(arch).filter((e) => e.kind === 'sg-rule').map((e) => e.to.id).sort();
  assert.deepEqual(targets, [web.id, web2.id].sort());
});

test('derivedEdges: facts point at the exact rule/route for deletion', () => {
  const { arch, web } = fixture();
  connectionIntent({ type: 'internet' }, { type: 'workload', id: web.id }, arch).apply(arch, {});
  const edge = derivedEdges(arch).find((e) => e.kind === 'sg-rule');
  const sg = getSecurityGroup(arch, edge.fact.sgId);
  assert.equal(sg.inbound[edge.fact.index].source, '0.0.0.0/0');
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `node --test js/lib/archCanvasRules.test.mjs`
Expected: FAIL — `derivedEdges` is not exported.

- [ ] **Step 3: Implement `derivedEdges`**

Append to `js/lib/archCanvasRules.js` (add `parseCidrStrict` to the vpcMath imports — new import line `import { parseCidrStrict } from './vpcMath.js';`):

```js
// Arrows are always derived from the model, never stored. Route edges come
// from each subnet's EFFECTIVE table (a shared table fans out one edge per
// associated subnet — each subnet genuinely has that route); SG-rule edges
// come from rules on each workload's attached SGs, with external CIDR
// sources rendered from the Internet node.
export function derivedEdges(arch) {
  const edges = [];
  for (const subnet of arch.subnets) {
    const rt = effectiveRouteTable(arch, subnet.id);
    if (!rt) continue;
    rt.routes.forEach((route, index) => {
      if (route.target === 'igw') {
        edges.push({
          from: { type: 'subnet', id: subnet.id }, to: { type: 'igw' },
          kind: 'route', label: route.destCidr,
          fact: { kind: 'route', rtbId: rt.id, index },
        });
      } else if (typeof route.target === 'string' && route.target.startsWith('nat:')) {
        edges.push({
          from: { type: 'subnet', id: subnet.id }, to: { type: 'nat', id: route.target.slice(4) },
          kind: 'route', label: route.destCidr,
          fact: { kind: 'route', rtbId: rt.id, index },
        });
      }
    });
  }
  for (const wl of arch.workloads) {
    for (const sgId of wl.sgIds) {
      const sg = getSecurityGroup(arch, sgId);
      if (!sg) continue;
      sg.inbound.forEach((rule, index) => {
        const portLabel = rule.portFrom === rule.portTo ? `TCP ${rule.portFrom}` : `TCP ${rule.portFrom}–${rule.portTo}`;
        const fact = { kind: 'sg-rule', sgId, index };
        if (rule.source.startsWith('sg:')) {
          const srcSgId = rule.source.slice(3);
          for (const src of arch.workloads) {
            if (src.sgIds.includes(srcSgId)) {
              edges.push({ from: { type: 'workload', id: src.id }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: portLabel, fact });
            }
          }
        } else if (rule.source === '0.0.0.0/0') {
          edges.push({ from: { type: 'internet' }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: portLabel, fact });
        } else if (parseCidrStrict(rule.source)) {
          edges.push({ from: { type: 'internet' }, to: { type: 'workload', id: wl.id }, kind: 'sg-rule', label: `${rule.source} → ${portLabel}`, fact });
        }
      });
    }
  }
  return edges;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `node --test js/lib/archCanvasRules.test.mjs`
Expected: PASS. Then run the whole suite: `node --test` — PASS (nothing else touched).

- [ ] **Step 5: Commit**

```bash
git add js/lib/archCanvasRules.js js/lib/archCanvasRules.test.mjs
git commit -m "Derive canvas arrows from routes and security-group rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Canvas rendering + page restructure (static canvas, no drag yet)

**Files:**
- Create: `js/arch-canvas.js`
- Modify: `architecture-challenge.html` (layout + styles)
- Modify: `js/arch-challenge.js` (remove builder/diagram, mount canvas)

**Interfaces:**
- Consumes: `derivedEdges` (Task 2); `escapeHtml`; archModel getters/mutators; the existing `changed()` funnel and `challenge`/`arch` state in `arch-challenge.js`.
- Produces: `js/arch-canvas.js` exports
  - `renderCanvas(mount, ctx)` — full re-render of the canvas pane. `ctx = { arch, challenge, selection, onChange(), onSelect(ref) }`; `selection` is a `ref` or `null`. Task 4 adds drag wiring inside this module; Task 5 adds the inspector (rendered by this module into its own `#arch-inspector` region when `selection` is set).
  - Every canvas node element carries `data-node='<JSON ref>'`; every legal drop container carries `data-drop='<JSON targetRef>'`; the SVG overlay has id `arch-edges`. These attributes are the contract Tasks 4–5 build on.
- `arch-challenge.js` after this task: `renderAll()` renders landing/head/task-panel as before, but the center is `renderCanvas(document.getElementById('arch-canvas'), { arch, challenge, selection, onChange: changed, onSelect })`; `renderBuilder`, `renderDiagram`, the builder `ACTIONS` map, and both builder event listeners are DELETED (the IGW toggle, click-to-add, and all editing move into the canvas/inspector). Keep `runCheck`/`renderTask`/hints/reveal/reset untouched.

- [ ] **Step 1: Restructure `architecture-challenge.html`**

Replace the three-pane `.arch-workbench` grid with two panes, and add canvas styles to the `<style>` block. Layout section of the body becomes:

```html
      <div class="arch-workbench">
        <div class="arch-panel" id="arch-canvas" aria-label="Canvas"></div>
        <div class="arch-panel" id="arch-task" aria-label="Task and results"></div>
      </div>
```

Grid CSS change and new styles (append to the `<style>` block; keep every existing rule that other selectors still use, delete only `.arch-vpc-box`/`.arch-az-grid`-era rules that Step 2's canvas replaces — the class names below are new `cv-` names so old rules can simply be removed):

```css
    .arch-workbench { display: grid; grid-template-columns: 1fr 360px; gap: 1rem; align-items: start; }
    @media (max-width: 1100px) { .arch-workbench { grid-template-columns: 1fr; } }

    /* Canvas */
    #arch-canvas { position: relative; overflow: hidden; }
    .cv-palette { display: flex; gap: 0.4rem; flex-wrap: wrap; margin-bottom: 0.75rem; }
    .cv-palette button { background: var(--arch-surface-muted); color: inherit; border: 1px dashed var(--color-border);
                         font-size: 0.8rem; padding: 0.3rem 0.6rem; cursor: grab; touch-action: none; }
    .cv-surface { position: relative; }
    .cv-internet { display: inline-flex; align-items: center; gap: 0.4rem; border: 1px solid var(--color-border);
                   border-radius: 999px; padding: 0.3rem 0.8rem; margin-bottom: 0.9rem; background: var(--arch-surface-muted); }
    .cv-vpc { border: 2px solid var(--color-primary); border-radius: 10px; padding: 1rem 0.75rem 0.75rem; position: relative; min-height: 220px; }
    .cv-igw-chip { position: absolute; top: -0.95rem; left: 1rem; border-radius: 999px; padding: 0.15rem 0.7rem;
                   font-size: 0.75rem; cursor: pointer; border: 1px solid var(--color-primary);
                   background: var(--arch-surface); color: var(--color-muted); }
    .cv-igw-chip.attached { background: var(--color-primary); color: #fff; }
    .cv-az-grid { display: grid; grid-auto-columns: 1fr; grid-auto-flow: column; gap: 0.75rem; margin-top: 0.6rem; }
    .cv-az h4 { margin: 0 0 0.4rem; font-size: 0.75rem; color: var(--color-muted); }
    .cv-subnet { border: 1px solid var(--color-border); border-radius: 8px; padding: 0.5rem; margin-bottom: 0.6rem; min-height: 3.2rem; }
    .cv-subnet.is-public { background: var(--arch-public); }
    .cv-subnet.is-private { background: var(--arch-private); }
    .cv-chip { display: inline-flex; align-items: center; gap: 0.25rem; border: 1px solid var(--color-border);
               background: var(--arch-surface); border-radius: 6px; padding: 0.2rem 0.45rem; font-size: 0.78rem;
               margin: 0.15rem 0.2rem 0 0; cursor: grab; touch-action: none; }
    .cv-selected { outline: 2px solid var(--color-primary); outline-offset: 1px; }
    .cv-handle { cursor: crosshair; opacity: 0.55; font-size: 0.9em; }
    .cv-handle:hover { opacity: 1; }
    .cv-tray { border-top: 1px dashed var(--color-border); margin-top: 0.75rem; padding-top: 0.5rem; }
    .cv-drop-ok { box-shadow: 0 0 0 2px var(--color-success) inset; }
    #arch-edges { position: absolute; inset: 0; pointer-events: none; overflow: visible; }
    #arch-edges path { fill: none; stroke-width: 1.5; }
    #arch-edges path.route { stroke: var(--color-primary); }
    #arch-edges path.sg-rule { stroke: var(--color-success); }
    #arch-edges path.hit { pointer-events: stroke; stroke: transparent; stroke-width: 10; }
    .cv-ghost { position: fixed; pointer-events: none; z-index: 40; opacity: 0.85; }
    .cv-popover { position: absolute; z-index: 50; background: var(--arch-surface); border: 1px solid var(--color-border);
                  border-radius: 8px; padding: 0.7rem; max-width: 320px; box-shadow: 0 4px 16px rgba(0,0,0,0.25); }
    .cv-popover .arch-row { margin-top: 0.5rem; }
    #arch-inspector { border-top: 1px solid var(--color-border); margin-top: 0.75rem; padding-top: 0.6rem; }
```

- [ ] **Step 2: Create `js/arch-canvas.js` — static rendering**

```js
// aws/js/arch-canvas.js
//
// Drag-and-drop canvas for the Architecture Challenge. All judgment calls
// (drop legality, connection meaning, which arrows exist) live in
// js/lib/archCanvasRules.js; this module renders DOM, wires pointer events,
// and applies confirmed intents through ctx.onChange. Dragging changes
// PARENTAGE only — no coordinates are ever stored.

import { escapeHtml } from './lib/html.js';
import {
  AZS, getSubnet, getWorkload, getNat, getSecurityGroup,
  isPublicSubnet, effectiveRouteTable,
} from './lib/archModel.js';
import { derivedEdges } from './lib/archCanvasRules.js';

const PALETTE = [
  { kind: 'subnet', label: '+ Subnet' },
  { kind: 'nat', label: '+ NAT gateway' },
  { kind: 'ec2', label: '+ EC2' },
  { kind: 'alb', label: '+ ALB' },
  { kind: 'rds', label: '+ RDS' },
  { kind: 'sg', label: '+ Security group' },
];

const ref = (obj) => escapeHtml(JSON.stringify(obj));

export function renderCanvas(mount, ctx) {
  const { arch, selection } = ctx;
  const sel = (r) => (selection && JSON.stringify(selection) === JSON.stringify(r) ? 'cv-selected' : '');

  const azsInUse = AZS.filter((az) => arch.subnets.some((s) => s.az === az));
  const azCols = azsInUse.map((az) => {
    const cards = arch.subnets.filter((s) => s.az === az).map((s) => {
      const nodes = [
        ...arch.natGateways.filter((n) => n.subnetId === s.id).map((n) => chip({ type: 'nat', id: n.id }, `NAT ${n.id}`, sel)),
        ...arch.workloads.filter((w) => w.subnetIds.includes(s.id)).map((w) =>
          chip({ type: 'workload', id: w.id }, `${w.type.toUpperCase()} ${w.name}${w.publicIp ? ' ⬆' : ''}`, sel)),
      ].join('');
      const pub = isPublicSubnet(arch, s.id);
      const rt = effectiveRouteTable(arch, s.id);
      return `
        <div class="cv-subnet ${pub ? 'is-public' : 'is-private'} ${sel({ type: 'subnet', id: s.id })}"
             data-node="${ref({ type: 'subnet', id: s.id })}" data-drop="${ref({ type: 'subnet', id: s.id })}">
          <strong>${escapeHtml(s.name)}</strong> <span class="cidr">${escapeHtml(s.cidr)}</span>
          <span class="arch-mini">${pub ? 'public' : 'private'} · ${escapeHtml(rt ? rt.name : '?')}</span>
          <span class="cv-handle" data-connect="${ref({ type: 'subnet', id: s.id })}" title="Draw route">⇢</span>
          <div>${nodes}</div>
        </div>`;
    }).join('');
    return `<div class="cv-az"><h4>AZ ${escapeHtml(az)}</h4>${cards}</div>`;
  }).join('');

  const unplaced = arch.workloads.filter((w) => w.subnetIds.length === 0).map((w) =>
    chip({ type: 'workload', id: w.id }, `${w.type.toUpperCase()} ${w.name} (unplaced)`, sel)).join('');

  const tray = arch.securityGroups.map((g) =>
    chip({ type: 'sg', id: g.id }, `SG ${g.name} (${g.inbound.length})`, sel)).join('');

  mount.innerHTML = `
    <h2>Canvas</h2>
    <div class="cv-palette">
      ${PALETTE.map((p) => `<button type="button" data-palette="${p.kind}">${p.label}</button>`).join('')}
    </div>
    <p class="arch-mini">Drag onto the canvas (or click to add). Drag the ⇢ handle between nodes to connect. Click anything to edit it below.</p>
    <div class="cv-surface">
      <div class="cv-internet ${sel({ type: 'internet' })}" data-node="${ref({ type: 'internet' })}">🌐 Internet
        <span class="cv-handle" data-connect="${ref({ type: 'internet' })}" title="Draw connection">⇢</span>
      </div>
      <div class="cv-vpc" data-drop="${ref({ type: 'vpc' })}">
        <button type="button" class="cv-igw-chip ${arch.vpc.igwAttached ? 'attached' : ''}"
                data-node="${ref({ type: 'igw' })}" data-action="toggle-igw">
          IGW ${arch.vpc.igwAttached ? 'attached' : 'not attached'}</button>
        <span class="cidr">VPC ${escapeHtml(arch.vpc.cidr)}</span>
        ${azsInUse.length
          ? `<div class="cv-az-grid">${azCols}</div>`
          : '<p class="arch-mini">Drag a subnet here to start.</p>'}
      </div>
      ${unplaced ? `<p class="arch-mini">Unplaced: ${unplaced}</p>` : ''}
      <div class="cv-tray" data-drop="${ref({ type: 'sg-tray' })}">
        <span class="arch-mini">Security groups:</span> ${tray || '<span class="arch-mini">none yet</span>'}
      </div>
      <svg id="arch-edges" aria-hidden="true"></svg>
    </div>
    <div id="arch-inspector"></div>
    <p class="arch-mini">Simplification: security groups are inbound-only here; outbound is allow-all.</p>`;

  drawEdges(mount, ctx);
  renderInspector(mount.querySelector('#arch-inspector'), ctx); // Task 5 fills this in
  wireCanvas(mount, ctx);                                       // Task 4 fills this in
}

function chip(r, label, sel) {
  const connectable = r.type === 'workload' || r.type === 'nat';
  return `<span class="cv-chip ${sel(r)}" data-node="${ref(r)}">${escapeHtml(label)}
    ${connectable ? `<span class="cv-handle" data-connect="${ref(r)}" title="Draw connection">⇢</span>` : ''}</span>`;
}

// Straight-line arrows between element edge midpoints, in cv-surface coords.
function drawEdges(mount, ctx) {
  const svg = mount.querySelector('#arch-edges');
  const surface = mount.querySelector('.cv-surface');
  const surfaceBox = surface.getBoundingClientRect();
  const anchor = (r) => {
    const el = r.type === 'igw'
      ? surface.querySelector('[data-action="toggle-igw"]')
      : surface.querySelector(`[data-node='${JSON.stringify(r)}'.replace(/'/g, "&#39;")]`);
    return el ? el.getBoundingClientRect() : null;
  };
  const paths = [];
  derivedEdges(ctx.arch).forEach((edge, i) => {
    const a = anchor(edge.from);
    const b = anchor(edge.to);
    if (!a || !b) return;
    const x1 = a.left + a.width / 2 - surfaceBox.left;
    const y1 = a.top + a.height / 2 - surfaceBox.top;
    const x2 = b.left + b.width / 2 - surfaceBox.left;
    const y2 = b.top + b.height / 2 - surfaceBox.top;
    const d = `M ${x1} ${y1} L ${x2} ${y2}`;
    paths.push(`<path class="${edge.kind}" d="${d}" marker-end="url(#cv-arrow)"><title>${escapeHtml(edge.label)}</title></path>`);
    paths.push(`<path class="hit" d="${d}" data-edge-index="${i}"></path>`);
  });
  svg.innerHTML = `
    <defs><marker id="cv-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
      <path d="M 0 0 L 10 5 L 0 10 z" fill="currentColor"></path></marker></defs>
    ${paths.join('')}`;
}

// Filled in by Task 5.
function renderInspector(mount, ctx) { mount.innerHTML = ''; }

// Filled in by Task 4 (drag/connect/popovers). This task wires only:
// selection clicks, palette click-to-add, and the IGW toggle.
function wireCanvas(mount, ctx) { wireStaticHandlers(mount, ctx); }
```

The `anchor` selector line above contains a deliberate trap to fix while implementing: build the attribute selector safely — compute `const json = JSON.stringify(r).replace(/'/g, "\\'")` then `surface.querySelector(\`[data-node='${json}']\`)`; single quotes never appear in our refs (ids are `[a-z0-9-]`), so plain interpolation `[data-node='${JSON.stringify(r)}']` is also acceptable. Use the plain form.

Also implement `wireStaticHandlers` in this task:

```js
function wireStaticHandlers(mount, ctx) {
  mount.addEventListener('click', (event) => {
    const igw = event.target.closest('[data-action="toggle-igw"]');
    if (igw) {
      ctx.arch.vpc.igwAttached = !ctx.arch.vpc.igwAttached;
      ctx.onChange();
      return;
    }
    const pal = event.target.closest('[data-palette]');
    if (pal) {
      clickToAdd(pal.dataset.palette, ctx);
      return;
    }
    const nodeEl = event.target.closest('[data-node]');
    if (nodeEl && !event.target.closest('[data-connect]')) {
      ctx.onSelect(JSON.parse(nodeEl.dataset.node));
    }
  });
}
```

with `clickToAdd(kind, ctx)` (exported for reuse; adds to the selected container or a sensible default): `subnet` → `addSubnet(arch, { az: 'a', cidr: '' })`; `nat`/`ec2`/`rds` → into the selected subnet if `ctx.selection?.type === 'subnet'`, else the first subnet (no subnets: do nothing); `alb` → `addWorkload(arch, { type: 'alb' })`; `sg` → `addSecurityGroup(arch)`; each followed by `ctx.onChange()`. Import the needed mutators (`addSubnet`, `addNat`, `addWorkload`, `addSecurityGroup`) at the top.

- [ ] **Step 3: Slim `js/arch-challenge.js`**

- Delete: `renderBuilder`, `renderDiagram`, `options()`, the `ACTIONS` map, both `#arch-builder` listeners, and the now-unused archModel imports (keep `createArch` and anything `runCheck`/reset still use).
- Add: `import { renderCanvas } from './arch-canvas.js';`, a module-level `let selection = null;`, `function onSelect(r) { selection = r; renderAll(); }`, reset `selection = null` in `openFromHash`.
- In `renderAll()`, the workbench branch becomes:

```js
  renderHead(document.getElementById('arch-head'));
  renderCanvas(document.getElementById('arch-canvas'), {
    arch, challenge, selection, onChange: changed, onSelect,
  });
  renderTask(document.getElementById('arch-task'));
```

(`changed()` already persists the draft, invalidates results, and re-renders — the canvas inherits autosave for free.)

- [ ] **Step 4: Verify in the browser**

`node --test` first (must stay green — nothing under `js/lib` changed in Steps 1–3). Then on `http://localhost:8000/architecture-challenge.html` (hard-reload):
- Open `#three-tier`, click "Show reference solution" path NOT available (no failed check) — instead open `#fix-broken`: the pre-built state renders as canvas boxes with route arrows (worker subnet → NAT) and an sg-rule arrow (internet → web via 0.0.0.0/0 on port 80 — note the DB's open rule also draws from the Internet node), IGW chip shows attached, SG tray lists three SGs.
- Click-to-add path works: select a subnet, click + EC2 — a chip appears in it.
- Clicking nodes selects them (outline). No console errors. Task panel + Check still work.

- [ ] **Step 5: Commit**

```bash
git add architecture-challenge.html js/arch-canvas.js js/arch-challenge.js
git commit -m "Render the challenge as an interactive canvas with derived arrows

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 4: Drag, drop, and connect gestures

**Files:**
- Modify: `js/arch-canvas.js` (replace the `wireCanvas` stub body; add drag/connect/popover machinery)

**Interfaces:**
- Consumes: `canDrop`, `connectionIntent` (Task 1); the `data-node`/`data-drop`/`data-connect`/`data-palette`/`data-edge-index` attributes and `.cv-ghost`/`.cv-drop-ok`/`.cv-popover` styles from Task 3; archModel mutators `addSubnet`, `addNat`, `addWorkload`, `updateWorkload`, `removeRoute`, `removeSgRule`, plus `getNat`, `getWorkload` (extend the import).
- Produces: pointer-event drag for palette placement and re-homing; rubber-band connect with intent popovers; arrow-click popover with the fact + Delete. Esc cancels any in-flight gesture. Behavior contracts Task 6 verifies in-browser:
  - Placement applies exactly the same mutations as `clickToAdd`, except subnet placement opens an AZ picker popover (a/b/c) at the drop point, and ALB placement opens its subnet-set popover (checkbox per existing subnet, ≥0 checked allowed — structural validation teaches the ≥2 rule).
  - Re-home: EC2 → `updateWorkload(id, { subnetIds: [target] })`; RDS → replace the *dragged-from* subnet id in its group... RDS chips render once per subnet they occupy; dragging one replaces THAT subnet id with the target (`subnetIds.map(sid => sid === fromSubnet ? target : sid)`); NAT → `getNat(arch, id).subnetId = target`. Subnet drops onto the VPC are accepted no-ops (AZ changes live in the inspector).
  - Connect: dropping the rubber band on a legal endpoint (a `[data-node]` whose ref yields a non-null `connectionIntent`, or the IGW chip) opens the intent popover: description (with `{port}` replaced by an `<input type="number">` when `defaultPort` is set), the `warning` line when present, Confirm/Cancel. Confirm runs `intent.apply(arch, { port })` then `ctx.onChange()`.
  - Arrow click (`path.hit`): popover shows the edge label + `Delete this rule/route` button → `removeRoute(arch, fact.rtbId, fact.index)` or `removeSgRule(arch, fact.sgId, fact.index)` then `ctx.onChange()`.

- [ ] **Step 1: Implement the gesture machinery**

Replace `function wireCanvas(mount, ctx) { wireStaticHandlers(mount, ctx); }` with the full implementation. Complete code:

```js
let gesture = null; // one in-flight gesture per page; cleared on drop/cancel

function wireCanvas(mount, ctx) {
  wireStaticHandlers(mount, ctx);
  const surface = mount.querySelector('.cv-surface');

  mount.addEventListener('pointerdown', (event) => {
    if (event.button !== 0) return;
    const handle = event.target.closest('[data-connect]');
    const pal = event.target.closest('[data-palette]');
    const nodeEl = event.target.closest('[data-node]');
    if (handle) {
      startConnect(JSON.parse(handle.dataset.connect), event, mount, ctx);
      event.preventDefault();
    } else if (pal) {
      startDrag({ mode: 'place', kind: pal.dataset.palette, label: pal.textContent }, event, mount, ctx);
    } else if (nodeEl) {
      const r = JSON.parse(nodeEl.dataset.node);
      if (r.type === 'workload' || r.type === 'nat') {
        const fromSubnet = event.target.closest('[data-drop]');
        startDrag({
          mode: 'move', kind: r.id, label: nodeEl.textContent,
          fromSubnet: fromSubnet ? JSON.parse(fromSubnet.dataset.drop).id : null,
        }, event, mount, ctx);
      }
    }
  });

  document.addEventListener('keydown', onEscape);
  surface.addEventListener('click', (event) => {
    const hit = event.target.closest('path.hit');
    if (hit) showEdgePopover(Number(hit.dataset.edgeIndex), event, mount, ctx);
  });
}

function onEscape(event) {
  if (event.key === 'Escape') cancelGesture();
}

function cancelGesture() {
  if (!gesture) return;
  gesture.cleanup();
  gesture = null;
}

// Palette placement and chip re-homing share one drag loop: a ghost chip
// follows the pointer; drop containers highlight when canDrop() says yes.
function startDrag(spec, event, mount, ctx) {
  cancelGesture();
  const ghost = document.createElement('span');
  ghost.className = 'cv-chip cv-ghost';
  ghost.textContent = spec.label.trim();
  document.body.appendChild(ghost);
  let target = null; // targetRef | null

  const move = (e) => {
    ghost.style.left = `${e.clientX + 8}px`;
    ghost.style.top = `${e.clientY + 8}px`;
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-drop]');
    mount.querySelectorAll('.cv-drop-ok').forEach((n) => n.classList.remove('cv-drop-ok'));
    target = null;
    if (el) {
      const targetRef = JSON.parse(el.dataset.drop);
      // Re-homing must not "drop into" the chip's own source subnet card
      // when hovering itself; canDrop already treats same-subnet as false.
      if (canDrop(spec.kind, targetRef, ctx.arch)) {
        el.classList.add('cv-drop-ok');
        target = targetRef;
      }
    }
  };
  const up = (e) => {
    const dropAt = { x: e.clientX, y: e.clientY };
    cancelGesture();
    if (target) applyDrop(spec, target, dropAt, mount, ctx);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  gesture = {
    cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      ghost.remove();
      mount.querySelectorAll('.cv-drop-ok').forEach((n) => n.classList.remove('cv-drop-ok'));
    },
  };
  move(event);
}

function applyDrop(spec, targetRef, dropAt, mount, ctx) {
  const { arch } = ctx;
  if (spec.mode === 'place') {
    if (spec.kind === 'subnet') {
      showPopover(mount, dropAt, `
        <p>Add subnet in which Availability Zone?</p>
        <div class="arch-row">${['a', 'b', 'c'].map((az) => `<button type="button" data-az="${az}">AZ ${az}</button>`).join('')}</div>`,
      (pop) => {
        pop.addEventListener('click', (e) => {
          const az = e.target.closest('[data-az]');
          if (az) { addSubnet(arch, { az: az.dataset.az, cidr: '' }); closePopover(); ctx.onChange(); }
        });
      });
      return;
    }
    if (spec.kind === 'alb') {
      const boxes = arch.subnets.map((s) => `
        <label class="arch-mini"><input type="checkbox" value="${s.id}" /> ${escapeHtml(s.name)}</label>`).join(' ');
      showPopover(mount, dropAt, `
        <p>ALB subnets (needs two AZs to be valid):</p>
        <div class="arch-row">${boxes || '<em class="arch-mini">no subnets yet</em>'}</div>
        <div class="arch-row"><button type="button" data-ok>Add ALB</button> <button type="button" data-cancel>Cancel</button></div>`,
      (pop) => {
        pop.addEventListener('click', (e) => {
          if (e.target.closest('[data-ok]')) {
            const ids = [...pop.querySelectorAll('input:checked')].map((i) => i.value);
            addWorkload(arch, { type: 'alb', subnetIds: ids });
            closePopover(); ctx.onChange();
          }
          if (e.target.closest('[data-cancel]')) closePopover();
        });
      });
      return;
    }
    if (spec.kind === 'sg') { addSecurityGroup(arch); ctx.onChange(); return; }
    if (spec.kind === 'nat') { addNat(arch, targetRef.id); ctx.onChange(); return; }
    addWorkload(arch, { type: spec.kind, subnetIds: [targetRef.id] }); // ec2 | rds
    ctx.onChange();
    return;
  }
  // mode === 'move' (re-home)
  const nat = getNat(arch, spec.kind);
  if (nat) { nat.subnetId = targetRef.id; ctx.onChange(); return; }
  const wl = getWorkload(arch, spec.kind);
  if (!wl) return;
  if (wl.type === 'ec2') {
    updateWorkload(arch, wl.id, { subnetIds: [targetRef.id] });
  } else {
    // ALB/RDS chips render once per occupied subnet; replace the one it was
    // dragged FROM, falling back to appending when the source is unknown.
    const next = spec.fromSubnet && wl.subnetIds.includes(spec.fromSubnet)
      ? wl.subnetIds.map((sid) => (sid === spec.fromSubnet ? targetRef.id : sid))
      : [...wl.subnetIds, targetRef.id];
    updateWorkload(arch, wl.id, { subnetIds: [...new Set(next)] });
  }
  ctx.onChange();
}

// Connect gesture: rubber-band line in the SVG overlay; legal endpoints are
// any [data-node] (or the IGW chip) whose ref yields a non-null intent.
function startConnect(fromRef, event, mount, ctx) {
  cancelGesture();
  const surface = mount.querySelector('.cv-surface');
  const svg = mount.querySelector('#arch-edges');
  const band = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  band.setAttribute('class', 'route');
  band.setAttribute('stroke-dasharray', '4 3');
  svg.appendChild(band);
  const box = () => surface.getBoundingClientRect();
  const start = { x: event.clientX - box().left, y: event.clientY - box().top };
  let toRef = null;

  const refAt = (e) => {
    const el = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-node]');
    return el ? JSON.parse(el.dataset.node) : null;
  };
  const move = (e) => {
    band.setAttribute('d', `M ${start.x} ${start.y} L ${e.clientX - box().left} ${e.clientY - box().top}`);
    mount.querySelectorAll('.cv-drop-ok').forEach((n) => n.classList.remove('cv-drop-ok'));
    toRef = null;
    const candidate = refAt(e);
    if (candidate && connectionIntent(fromRef, candidate, ctx.arch)) {
      const el = document.elementFromPoint(e.clientX, e.clientY).closest('[data-node]');
      el.classList.add('cv-drop-ok');
      toRef = candidate;
    }
  };
  const up = (e) => {
    const dropAt = { x: e.clientX, y: e.clientY };
    const finalTo = toRef;
    cancelGesture();
    if (finalTo) showIntentPopover(fromRef, finalTo, dropAt, mount, ctx);
  };
  window.addEventListener('pointermove', move);
  window.addEventListener('pointerup', up, { once: true });
  gesture = {
    cleanup() {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      band.remove();
      mount.querySelectorAll('.cv-drop-ok').forEach((n) => n.classList.remove('cv-drop-ok'));
    },
  };
}

function showIntentPopover(fromRef, toRef, dropAt, mount, ctx) {
  const intent = connectionIntent(fromRef, toRef, ctx.arch);
  if (!intent) return;
  const portInput = intent.defaultPort !== null
    ? `<input type="number" id="cv-port" value="${intent.defaultPort}" aria-label="Port" />`
    : '';
  const description = escapeHtml(intent.description).replace('{port}', '</span>PORT<span>')
    .split('PORT').join(portInput || '');
  showPopover(mount, dropAt, `
    <p><span>${description}</span></p>
    ${intent.warning ? `<p class="arch-mini">⚠ ${escapeHtml(intent.warning)}</p>` : ''}
    <div class="arch-row"><button type="button" data-ok>Confirm</button> <button type="button" data-cancel>Cancel</button></div>`,
  (pop) => {
    pop.addEventListener('click', (e) => {
      if (e.target.closest('[data-ok]')) {
        const port = pop.querySelector('#cv-port');
        intent.apply(ctx.arch, port ? { port: Number(port.value) } : {});
        closePopover(); ctx.onChange();
      }
      if (e.target.closest('[data-cancel]')) closePopover();
    });
  });
}

function showEdgePopover(index, event, mount, ctx) {
  const edge = derivedEdges(ctx.arch)[index];
  if (!edge) return;
  showPopover(mount, { x: event.clientX, y: event.clientY }, `
    <p>${escapeHtml(edge.kind === 'route' ? 'Route' : 'Security group rule')}: ${escapeHtml(edge.label)}</p>
    <div class="arch-row"><button type="button" data-del>Delete</button> <button type="button" data-cancel>Close</button></div>`,
  (pop) => {
    pop.addEventListener('click', (e) => {
      if (e.target.closest('[data-del]')) {
        if (edge.fact.kind === 'route') removeRoute(ctx.arch, edge.fact.rtbId, edge.fact.index);
        else removeSgRule(ctx.arch, edge.fact.sgId, edge.fact.index);
        closePopover(); ctx.onChange();
      }
      if (e.target.closest('[data-cancel]')) closePopover();
    });
  });
}

// One popover at a time, positioned inside the canvas panel near the drop.
function showPopover(mount, at, html, wire) {
  closePopover();
  const pop = document.createElement('div');
  pop.className = 'cv-popover';
  pop.id = 'cv-popover';
  pop.innerHTML = html;
  const panelBox = mount.getBoundingClientRect();
  pop.style.left = `${Math.max(8, at.x - panelBox.left - 40)}px`;
  pop.style.top = `${Math.max(8, at.y - panelBox.top + 12)}px`;
  mount.appendChild(pop);
  wire(pop);
}

function closePopover() {
  document.getElementById('cv-popover')?.remove();
}
```

Extend the module's imports accordingly: `canDrop`, `connectionIntent` from `./lib/archCanvasRules.js`; `updateWorkload`, `removeRoute`, `removeSgRule` added to the archModel import (alongside the Task 3 additions `addSubnet`, `addNat`, `addWorkload`, `addSecurityGroup`).

- [ ] **Step 2: Verify in the browser**

`node --test` still green, then on a hard-reloaded `#public-web` (Reset first for a clean slate):
- Drag Subnet onto the VPC → AZ picker appears → pick a; set its CIDR via inspector (Task 5 not built yet — set via popover-less path: the subnet renders with empty CIDR; that's fine for this task, use `#sandbox` + structural error to confirm the subnet landed).
- Drag EC2 onto the subnet → chip appears. Drag the chip onto another subnet (add one via click-to-add) → it moves.
- Drag the Internet node's ⇢ onto the EC2 → popover shows "Allow TCP 80 … 0.0.0.0/0" with the port input; Confirm → a green arrow appears; the SG tray shows the auto-created SG.
- Drag the subnet's ⇢ onto the IGW chip → route popover (warning when IGW detached) → Confirm → blue arrow appears; subnet tint flips public once the IGW chip is attached.
- Click the arrow → popover shows the fact; Delete removes it and the arrow disappears.
- Esc cancels a mid-drag ghost and a mid-connect rubber band. No console errors anywhere.

- [ ] **Step 3: Commit**

```bash
git add js/arch-canvas.js
git commit -m "Add drag placement, re-homing, and connection gestures

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 5: Inspector panel + delete

**Files:**
- Modify: `js/arch-canvas.js` (replace the `renderInspector` stub; add Delete-key handling)

**Interfaces:**
- Consumes: the `ctx.selection` ref set by clicks (Task 3); archModel mutators — extend the import with `updateSubnet`, `removeSubnet`, `removeNat`, `removeWorkload`, `removeSecurityGroup`, `addSgRule`, `removeSgRule` (already there), `getRouteTable`, `associateSubnet`, `disassociateSubnet`, `removeRouteTable`.
- Produces: the inspector region (`#arch-inspector`) rendering the selected resource's editable properties; with no selection it shows the VPC CIDR field. Field edits commit on `change` through `ctx.onChange()` (same convention as the old builder: text inputs keep focus while typing). Delete/Backspace with a deletable selection (subnet, nat, workload, sg) and focus outside an input removes it via the archModel cleanup mutators and clears the selection (`ctx.onSelect(null)`).

- [ ] **Step 1: Implement `renderInspector` and its handlers**

Replace the stub. Complete code (delegated `change`/`click` listeners are attached ONCE via a `wired` flag on the mount, since `renderCanvas` re-creates the innerHTML each render):

```js
function renderInspector(mount, ctx) {
  const { arch, challenge, selection } = ctx;
  const sel = selection;
  const roleOpts = (current) => ['', ...challenge.roles.map((r) => r.id)]
    .map((id) => `<option value="${escapeHtml(id)}" ${id === (current || '') ? 'selected' : ''}>${escapeHtml(id || '(none)')}</option>`).join('');

  let html = '';
  if (!sel || sel.type === 'internet' || sel.type === 'igw' || sel.type === 'vpc') {
    html = `<h3>VPC</h3><div class="arch-row">
      <label class="arch-mini">CIDR <input type="text" value="${escapeHtml(arch.vpc.cidr)}" data-ins="vpc-cidr" /></label>
      <span class="arch-mini">Select any node on the canvas to edit it here.</span></div>`;
  } else if (sel.type === 'subnet') {
    const s = getSubnet(arch, sel.id);
    if (s) {
      const rt = effectiveRouteTable(arch, s.id);
      const tables = arch.routeTables.filter((t) => !t.isMain).map((t) =>
        `<option value="${t.id}" ${rt && rt.id === t.id ? 'selected' : ''}>${escapeHtml(t.name)}</option>`).join('');
      html = `<h3>Subnet ${escapeHtml(s.name)}</h3>
        <div class="arch-row">
          <input type="text" value="${escapeHtml(s.name)}" data-ins="subnet-name" aria-label="Name" />
          <select data-ins="subnet-az" aria-label="AZ">${AZS.map((az) => `<option ${az === s.az ? 'selected' : ''}>${az}</option>`).join('')}</select>
          <input type="text" value="${escapeHtml(s.cidr)}" data-ins="subnet-cidr" aria-label="CIDR" placeholder="10.0.1.0/24" />
          <button type="button" class="arch-del" data-ins="delete" title="Delete subnet">✕ delete</button>
        </div>
        <p class="arch-mini">Route table: ${escapeHtml(rt ? rt.name : 'main')}${rt && !rt.isMain ? ` (shared by ${rt.subnetIds.length})` : ''}
          <select data-ins="subnet-rtb" aria-label="Associate route table">
            <option value="">main (implicit)</option>${tables}</select></p>`;
    }
  } else if (sel.type === 'nat') {
    const n = getNat(arch, sel.id);
    if (n) {
      html = `<h3>NAT gateway ${escapeHtml(n.id)}</h3>
        <div class="arch-row"><span class="arch-mini">in ${escapeHtml(getSubnet(arch, n.subnetId)?.name || '?')}
          — drag the chip to move it</span>
          <button type="button" class="arch-del" data-ins="delete">✕ delete</button></div>`;
    }
  } else if (sel.type === 'workload') {
    const w = getWorkload(arch, sel.id);
    if (w) {
      const subnetBoxes = arch.subnets.map((s) => `
        <label class="arch-mini"><input type="checkbox" value="${s.id}" data-ins="wl-subnet"
          ${w.subnetIds.includes(s.id) ? 'checked' : ''} ${w.type === 'ec2' ? 'disabled' : ''} /> ${escapeHtml(s.name)}</label>`).join(' ');
      const sgBoxes = arch.securityGroups.map((g) => `
        <label class="arch-mini"><input type="checkbox" value="${g.id}" data-ins="wl-sg"
          ${w.sgIds.includes(g.id) ? 'checked' : ''} /> ${escapeHtml(g.name)}</label>`).join(' ');
      html = `<h3>${w.type.toUpperCase()} <input type="text" value="${escapeHtml(w.name)}" data-ins="wl-name" aria-label="Name" /></h3>
        <div class="arch-row">
          ${challenge.roles.length ? `<label class="arch-mini">role <select data-ins="wl-role">${roleOpts(w.role)}</select></label>` : ''}
          <label class="arch-mini">port <input type="number" value="${w.port}" data-ins="wl-port" /></label>
          ${w.type === 'ec2' ? `<label class="arch-mini"><input type="checkbox" data-ins="wl-publicip" ${w.publicIp ? 'checked' : ''} /> public IP</label>` : ''}
          ${w.type === 'rds' ? `<label class="arch-mini"><input type="checkbox" data-ins="wl-multiaz" ${w.multiAz ? 'checked' : ''} /> Multi-AZ</label>` : ''}
          <button type="button" class="arch-del" data-ins="delete">✕ delete</button>
        </div>
        <p class="arch-mini">Subnets${w.type === 'ec2' ? ' (drag the chip to move an EC2)' : ''}: ${subnetBoxes || '<em>none</em>'}</p>
        <p class="arch-mini">Security groups: ${sgBoxes || '<em>none — draw a connection to auto-create one</em>'}</p>`;
    }
  } else if (sel.type === 'sg') {
    const g = getSecurityGroup(arch, sel.id);
    if (g) {
      const rows = g.inbound.map((r, i) => `
        <div class="arch-row"><span class="arch-mini">TCP</span>
          <input type="number" value="${r.portFrom}" data-ins="rule-portfrom" data-index="${i}" aria-label="Port from" />
          <span class="arch-mini">–</span>
          <input type="number" value="${r.portTo}" data-ins="rule-portto" data-index="${i}" aria-label="Port to" />
          <span class="arch-mini">from</span>
          <input type="text" value="${escapeHtml(r.source)}" list="cv-sg-sources" data-ins="rule-source" data-index="${i}" aria-label="Source" />
          <button type="button" class="arch-del" data-ins="rule-del" data-index="${i}">✕</button></div>`).join('');
      html = `<h3>SG <input type="text" value="${escapeHtml(g.name)}" data-ins="sg-name" aria-label="Name" />
          <button type="button" class="arch-del" data-ins="delete">✕ delete</button></h3>
        <datalist id="cv-sg-sources"><option value="0.0.0.0/0"></option>
          ${arch.securityGroups.map((o) => `<option value="sg:${o.id}">${escapeHtml(o.name)}</option>`).join('')}</datalist>
        ${rows || '<p class="arch-mini">No inbound rules — denies all inbound.</p>'}
        <button type="button" class="arch-add" data-ins="rule-add">+ inbound rule</button>`;
    }
  }
  mount.innerHTML = html;

  if (!mount.dataset.wired) {
    mount.dataset.wired = '1';
    mount.addEventListener('change', (e) => applyInspector(e, ctx, 'change'));
    mount.addEventListener('click', (e) => applyInspector(e, ctx, 'click'));
  }
}

function applyInspector(event, ctx, phase) {
  const el = event.target.closest('[data-ins]');
  if (!el) return;
  if (phase === 'click' && el.tagName !== 'BUTTON') return;
  if (phase === 'change' && el.tagName === 'BUTTON') return;
  const { arch, selection } = ctx;
  const ins = el.dataset.ins;
  const idx = Number(el.dataset.index);
  const sub = selection && selection.type === 'subnet' ? getSubnet(arch, selection.id) : null;
  const wl = selection && selection.type === 'workload' ? getWorkload(arch, selection.id) : null;
  const sg = selection && selection.type === 'sg' ? getSecurityGroup(arch, selection.id) : null;

  switch (ins) {
    case 'vpc-cidr': arch.vpc.cidr = el.value.trim(); break;
    case 'subnet-name': if (sub) updateSubnet(arch, sub.id, { name: el.value.trim() }); break;
    case 'subnet-az': if (sub) updateSubnet(arch, sub.id, { az: el.value }); break;
    case 'subnet-cidr': if (sub) updateSubnet(arch, sub.id, { cidr: el.value.trim() }); break;
    case 'subnet-rtb':
      if (sub) {
        if (el.value) associateSubnet(arch, el.value, sub.id);
        else disassociateSubnet(arch, sub.id);
      }
      break;
    case 'wl-name': if (wl) updateWorkload(arch, wl.id, { name: el.value.trim() }); break;
    case 'wl-role': if (wl) updateWorkload(arch, wl.id, { role: el.value || null }); break;
    case 'wl-port': if (wl) updateWorkload(arch, wl.id, { port: Number(el.value) }); break;
    case 'wl-publicip': if (wl) updateWorkload(arch, wl.id, { publicIp: el.checked }); break;
    case 'wl-multiaz': if (wl) updateWorkload(arch, wl.id, { multiAz: el.checked }); break;
    case 'wl-subnet':
      if (wl) {
        wl.subnetIds = el.checked
          ? [...wl.subnetIds, el.value]
          : wl.subnetIds.filter((sid) => sid !== el.value);
      }
      break;
    case 'wl-sg':
      if (wl) {
        wl.sgIds = el.checked ? [...wl.sgIds, el.value] : wl.sgIds.filter((gid) => gid !== el.value);
      }
      break;
    case 'sg-name': if (sg) sg.name = el.value.trim(); break;
    case 'rule-add': if (sg) addSgRule(arch, sg.id, { portFrom: 80, source: '0.0.0.0/0' }); break;
    case 'rule-portfrom': if (sg && sg.inbound[idx]) sg.inbound[idx].portFrom = Number(el.value); break;
    case 'rule-portto': if (sg && sg.inbound[idx]) sg.inbound[idx].portTo = Number(el.value); break;
    case 'rule-source': if (sg && sg.inbound[idx]) sg.inbound[idx].source = el.value.trim(); break;
    case 'rule-del': if (sg) removeSgRule(arch, sg.id, idx); break;
    case 'delete': deleteSelection(ctx); return; // deleteSelection calls onSelect+onChange itself
    default: return;
  }
  ctx.onChange();
}

function deleteSelection(ctx) {
  const { arch, selection } = ctx;
  if (!selection) return;
  if (selection.type === 'subnet') removeSubnet(arch, selection.id);
  else if (selection.type === 'nat') removeNat(arch, selection.id);
  else if (selection.type === 'workload') removeWorkload(arch, selection.id);
  else if (selection.type === 'sg') removeSecurityGroup(arch, selection.id);
  else return;
  ctx.onSelect(null); // triggers renderAll; onChange persists
  ctx.onChange();
}
```

Add the Delete-key handler inside `wireCanvas` (after `wireStaticHandlers`):

```js
  document.addEventListener('keydown', (event) => {
    if ((event.key === 'Delete' || event.key === 'Backspace')
        && ctx.selection
        && !/^(INPUT|SELECT|TEXTAREA)$/.test(document.activeElement?.tagName || '')) {
      deleteSelection(ctx);
    }
  });
```

Implementation note: `wireCanvas` runs on every render, so guard BOTH document-level listeners (`keydown` Escape from Task 4 and this one) with a module-level `let documentWired = false;` flag — attach once. The mount-level listeners are safe to re-attach only because `renderCanvas` replaces `mount.innerHTML` (old listeners on `mount` itself would stack) — guard those with `mount.dataset.wired` exactly as `renderInspector` does; restructure Task 4's `wireCanvas` accordingly (one `if (mount.dataset.cvWired) return; mount.dataset.cvWired = '1';` at the top covering the mount-level `pointerdown`/`click` listeners, with the surface click handler re-bound per render since `.cv-surface` is recreated — move the edge-click handling up to the mount listener using `event.target.closest('path.hit')`).

- [ ] **Step 2: Verify in the browser**

Hard-reload, `#two-tier`, Reset:
- Build the whole two-tier solution with canvas + inspector only: subnet CIDRs via inspector, EC2 role via inspector, connections via gestures. Check → all goals green.
- SG rule editing: select the auto-created db SG, add/edit/delete a rule; arrows update.
- Route-table sharing: create a second public subnet, associate it to the first subnet's table via the inspector dropdown; both subnets show public and two route arrows render from one table.
- Delete key removes a selected chip; referential cleanup holds (arrows to it disappear, no console errors).

- [ ] **Step 3: Commit**

```bash
git add js/arch-canvas.js
git commit -m "Add canvas inspector panel and selection deletion

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 6: Walkthrough, docs, and finish

**Files:**
- Modify: `README.md` (Architecture Challenge bullet gains "drag-and-drop")
- Modify: `docs/superpowers/specs/2026-07-20-arch-canvas-design.md` (Status → Implemented note if any deviations arose; record them in the established "(Amended during implementation)" convention)

**Interfaces:** none new.

- [ ] **Step 1: README wording**

In the Architecture Challenge bullet, change "a standalone builder game" to "a standalone drag-and-drop builder game" and append ", built by dragging resources onto a VPC canvas and drawing the connections" before the em-dash clause if it reads naturally; keep it one sentence.

- [ ] **Step 2: Full verification sweep**

```bash
node --test                          # aws suite incl. archCanvasRules
node scripts/validate-content.mjs
cd .. && node scripts/check-drift.mjs && cd aws   # unchanged SHARED files → clean
```

Browser (hard-reload each page):
- Solve `public-web` START TO FINISH using only drag, connect, and inspector (no reveal): completion records, landing badge updates.
- Open `fix-broken`: diagnose via Check traces, fix all three flaws with canvas gestures (drag NAT to the public subnet; connect web subnet → IGW—or associate via inspector; fix the DB SG rule via inspector or arrow-delete + redraw from web), reach completion.
- Reveal on any challenge renders the reference solution's arrows correctly.
- Sandbox, hints, reset, dark + light modes, and the `#/progress` card all still work.
- Old drafts: seed a draft via an earlier commit's builder if available, or hand-write a known-good draft JSON into localStorage — it opens on the canvas unchanged (state shape is identical).

- [ ] **Step 3: Commit**

```bash
git add README.md docs/superpowers/specs/2026-07-20-arch-canvas-design.md
git commit -m "Document the drag-and-drop canvas builder

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Plan self-review notes

- **Spec coverage:** palette/fixtures + click-to-add (T3), placement/re-home/connect/popovers/arrow-delete/Esc (T4), inspector incl. SG rules, route-table sharing, deletion (T5), rules module with all intents/legality/edges tested (T1–2), engine/challenges/drafts untouched (global constraint + T3's slimming leaves runCheck/renderTask alone), walkthrough + docs (T6).
- **Type consistency:** `ref` vocabulary defined once in Global Constraints; `canDrop(kind, targetRef, arch)`, `connectionIntent(fromRef, toRef, arch)` → `{kind, description, defaultPort, warning, apply}`, `derivedEdges(arch)` → `{from, to, kind, label, fact}` used identically in T1/T2 tests, T3 `drawEdges`, T4 popovers. `ctx = {arch, challenge, selection, onChange, onSelect}` consistent across T3–T5.
- **Known accepted risks (called out for reviewers):** listener-stacking is addressed explicitly in T5's implementation note; `drawEdges` anchor lookup uses attribute-selector interpolation (safe for our id alphabet, noted in T3); RDS re-home semantics (replace the dragged-from subnet) defined in T4.




