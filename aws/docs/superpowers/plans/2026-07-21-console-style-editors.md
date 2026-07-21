# Console-Style Editors Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the canvas's ⇢ connect handles with console-style form editors (route Destination/Target rows in the subnet inspector, typed Source controls for SG rules, an Inbound-rules section on workloads), keeping placement drag and derived arrows.

**Architecture:** The deleted `connectionIntent`'s semantics survive as two exported, tested helpers in `js/lib/archCanvasRules.js` (`addSubnetRoute`, `ensureWorkloadSg`); `js/arch-canvas.js` loses its gesture machinery and gains inspector sections that call those helpers plus existing archModel mutators. Arrows (`derivedEdges`) and placement (`canDrop`) are untouched.

**Tech Stack:** Vanilla ES modules, `node --test`.

**Spec:** [aws/docs/superpowers/specs/2026-07-21-console-style-editors-design.md](../specs/2026-07-21-console-style-editors-design.md)

## Global Constraints

- Paths relative to `aws/`; commands run from `/Users/toddcooke/IdeaProjects/learn/aws`.
- Vanilla ES modules; no dependencies; aws-only files (drift SHARED list untouched); state shape unchanged.
- Preserve the file's established architecture: mount-level listeners attach once (`mount.dataset.cvWired`) and read the module-level `currentCtx`; `#arch-inspector` listeners re-attach per render on the fresh node; every data-derived string through `escapeHtml`.
- Stored model values unchanged: rule `source` stays `'0.0.0.0/0'` | CIDR string | `'sg:<id>'`; route `target` stays `'igw'` | `'nat:<id>'` — the new dropdowns are presentation only.
- Adding routes NEVER edits the main table (create-or-extend the subnet's own table).
- Commit style: imperative, no prefix, trailer `Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>`.
- `node --test`, `node scripts/validate-content.mjs` green at every commit; `node scripts/check-drift.mjs` (repo root) clean.

---

### Task 1: Extracted helpers replace `connectionIntent` (`archCanvasRules.js`)

**Files:**
- Modify: `js/lib/archCanvasRules.js` (delete `connectionIntent` at :82-150; export reworked helpers)
- Test: `js/lib/archCanvasRules.test.mjs` (delete the connectionIntent tests; add helper tests; keep canDrop/derivedEdges tests verbatim)

**Interfaces:**
- Consumes: existing archModel imports already in the file (`getSubnet`, `getWorkload`, `getNat`, `getSecurityGroup`, `effectiveRouteTable`, `addSecurityGroup`, `addRouteTable`, `addRoute`, `associateSubnet`, `updateWorkload`, `addSgRule` — prune any import left unused after the deletion, keep the rest).
- Produces (Task 2 depends on these exact signatures):
  - `addSubnetRoute(arch, subnetId, destCidr, target): routeTable | null` — `target` `'igw'` or `'nat:<id>'`. Null-safe no-op (returns null) when the subnet doesn't exist or a `nat:` target references a missing NAT. Otherwise writes `{destCidr, target}` into the subnet's own explicit table — reusing the private `ensureOwnRouteTable` (unchanged: creates `` `${subnet.name}-rt` `` + associates when the subnet is on main, else reuses the explicit table) — and returns that table.
  - `ensureWorkloadSg(arch, workloadId): sg | null` — null when the workload doesn't exist; else the first attached SG, creating+attaching `` `${workload.name}-sg` `` when none (reuse the private `ensureSg` body; `ensureWorkloadSg` is the exported id-taking wrapper).

- [ ] **Step 1: Rewrite the test file's intent section**

In `js/lib/archCanvasRules.test.mjs`: remove every `connectionIntent` test (all tests whose name starts with `connectionIntent`) and the `connectionIntent` import; add `addSubnetRoute, ensureWorkloadSg` to the import from `./archCanvasRules.js` and `removeWorkload, removeNat` to the archModel import if not present. Append:

```js
test('addSubnetRoute: creates and associates an own table when the subnet is on main', () => {
  const { arch, priv } = fixture();
  const rt = addSubnetRoute(arch, priv.id, '0.0.0.0/0', 'igw');
  assert.equal(rt.isMain, false);
  assert.equal(rt.name, 'private-a-rt');
  assert.deepEqual(effectiveRouteTable(arch, priv.id).routes, [{ destCidr: '0.0.0.0/0', target: 'igw' }]);
});

test('addSubnetRoute: extends an existing explicit table instead of creating another', () => {
  const { arch, pub, nat } = fixture();
  const rt = addSubnetRoute(arch, pub.id, '0.0.0.0/0', `nat:${nat.id}`);
  assert.equal(rt.name, 'public', 'reused the fixture\'s explicit table');
  assert.equal(rt.routes.length, 2);
});

test('addSubnetRoute: never touches the main table', () => {
  const { arch, priv } = fixture();
  addSubnetRoute(arch, priv.id, '0.0.0.0/0', 'igw');
  assert.deepEqual(arch.routeTables.find((t) => t.isMain).routes, []);
});

test('addSubnetRoute: null-safe for missing subnet and missing NAT', () => {
  const { arch, priv } = fixture();
  assert.equal(addSubnetRoute(arch, 'subnet-99', '0.0.0.0/0', 'igw'), null);
  assert.equal(addSubnetRoute(arch, priv.id, '0.0.0.0/0', 'nat:nat-99'), null);
  assert.equal(effectiveRouteTable(arch, priv.id).isMain, true, 'no table was created');
});

test('ensureWorkloadSg: reuses an attached SG, creates one when missing, null for unknown id', () => {
  const { arch, web } = fixture();
  const sg = ensureWorkloadSg(arch, web.id);
  assert.equal(sg.name, 'web-1-sg');
  assert.deepEqual(web.sgIds, [sg.id]);
  assert.equal(ensureWorkloadSg(arch, web.id), sg, 'second call reuses');
  assert.equal(ensureWorkloadSg(arch, 'ec2-99'), null);
});
```

(The fixture already exists at the top of the file — `fixture()` returns `{ arch, pub, priv, rt, web, db, nat }` with `priv` named `private-a` and an explicit `public` table on `pub`.)

- [ ] **Step 2: Run to verify the new tests fail and old ones still run**

Run: `node --test js/lib/archCanvasRules.test.mjs`
Expected: FAIL — `addSubnetRoute` is not exported (canDrop/derivedEdges tests still pass).

- [ ] **Step 3: Implement in `archCanvasRules.js`**

Delete `connectionIntent` (:82-150). Keep `ensureSg` and `ensureOwnRouteTable` private helpers as-is. Add:

```js
// Console-editor entry points. These carry the exact semantics the old
// connect gestures had: routes go in the subnet's OWN table (never main),
// and rule-authoring on a bare workload creates and attaches "<name>-sg".
// Both are null-safe no-ops when their targets don't exist.
export function addSubnetRoute(arch, subnetId, destCidr, target) {
  const subnet = getSubnet(arch, subnetId);
  if (!subnet) return null;
  if (typeof target === 'string' && target.startsWith('nat:') && !getNat(arch, target.slice(4))) return null;
  const rt = ensureOwnRouteTable(arch, subnet);
  addRoute(arch, rt.id, { destCidr, target });
  return rt;
}

export function ensureWorkloadSg(arch, workloadId) {
  const wl = getWorkload(arch, workloadId);
  if (!wl) return null;
  return ensureSg(arch, wl);
}
```

Prune imports the deletion orphaned (likely `addSgRule` if only connectionIntent used it — verify with grep before removing; `updateWorkload` stays for `ensureSg`).

- [ ] **Step 4: Run tests to verify green**

Run: `node --test js/lib/archCanvasRules.test.mjs` then full `node --test`
Expected: PASS. (Full suite count drops by the deleted intent tests and rises by the 5 new ones — report the exact number.)

- [ ] **Step 5: Commit**

```bash
git add js/lib/archCanvasRules.js js/lib/archCanvasRules.test.mjs
git commit -m "Extract console-editor helpers from the connect-intent rules

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 2: Remove gestures, add console-style editors (`arch-canvas.js`)

**Files:**
- Modify: `js/arch-canvas.js`

**Interfaces:**
- Consumes: `addSubnetRoute`, `ensureWorkloadSg` (Task 1); existing archModel mutators (`addSgRule`, `removeSgRule`, `removeRoute`, `getRouteTable` — extend the archModel import with `getRouteTable` and `removeRoute` if absent); `derivedEdges`, `canDrop` unchanged.
- Produces: the finished editor UI. No new exports beyond the existing `renderCanvas`/`unmountCanvas`/`clickToAdd`.

**Removals (verify each leaves no dangling references — grep after):**
- The three `data-connect` handle emissions: subnet card (:61), Internet node (:82), `chip()` (:117-124 — delete the `connectable` logic so chips render label only).
- The `pointerdown` branch dispatching `startConnect` (:373-378) and the `[data-connect]` exclusion in the click-selection branch (:366 — simplify to plain `nodeEl` selection).
- `startConnect` (:563-606) and `showIntentPopover` (:608-…) entirely.
- The canvas hint line becomes: `Drag onto the canvas (or click to add). Click anything to edit its properties, routes, and rules below.`
- `.cv-handle` CSS rules in `architecture-challenge.html` may be deleted (they're now unused) — optional, include for tidiness.

**Additions — complete code:**

1. **Subnet inspector Routes section.** In `renderInspector`'s subnet branch, after the existing route-table association paragraph, append (inside the same `html` template; `rt` is the effective table already computed there):

```js
      const natOpts = arch.natGateways.map((n) => {
        const home = getSubnet(arch, n.subnetId);
        return `<option value="nat:${escapeHtml(n.id)}">NAT gateway ${escapeHtml(n.id)} — in ${escapeHtml(home ? home.name : '?')}</option>`;
      }).join('');
      const targetOpts = (selected) => `
        <option value="igw" ${selected === 'igw' ? 'selected' : ''}>Internet gateway</option>
        ${arch.natGateways.map((n) => `<option value="nat:${escapeHtml(n.id)}" ${selected === `nat:${n.id}` ? 'selected' : ''}>NAT gateway ${escapeHtml(n.id)} — in ${escapeHtml(getSubnet(arch, n.subnetId)?.name || '?')}</option>`).join('')}`;
      const routeRows = (rt && !rt.isMain ? rt.routes : []).map((route, i) => `
        <div class="arch-row">
          <input type="text" value="${escapeHtml(route.destCidr)}" data-ins="route-dest" data-rtb="${escapeHtml(rt.id)}" data-index="${i}" aria-label="Destination" />
          <span class="arch-mini">→</span>
          <select data-ins="route-target" data-rtb="${escapeHtml(rt.id)}" data-index="${i}" aria-label="Target">${targetOpts(route.target)}</select>
          <button type="button" class="arch-del" data-ins="route-del" data-rtb="${escapeHtml(rt.id)}" data-index="${i}">✕</button>
        </div>`).join('');
      const sharedNote = rt && !rt.isMain && rt.subnetIds.length > 1
        ? ` <span class="arch-mini">(shared by ${rt.subnetIds.length} subnets — edits affect all)</span>` : '';
      html += `
        <h3>Routes${sharedNote}</h3>
        <p class="arch-mini">${escapeHtml(arch.vpc.cidr)} — local (implicit)</p>
        ${routeRows}
        <div class="arch-row">
          <input type="text" value="0.0.0.0/0" data-ins="route-new-dest" aria-label="New route destination" />
          <span class="arch-mini">→</span>
          <select data-ins="route-new-target" aria-label="New route target">${targetOpts('igw')}</select>
          <button type="button" data-ins="route-add">Add route</button>
        </div>`;
```

(Note `html +=` — restructure the subnet branch so `html` is built incrementally; the existing name/AZ/CIDR + association markup becomes the first `html =` chunk.)

2. **Typed Source controls.** Add a module-level helper + use it in BOTH the SG inspector's rule rows (replacing the free-text source input + datalist) and the new workload add-rule row:

```js
// Console-style source control: a type select plus a conditional field.
// Presentation only — the stored value stays '0.0.0.0/0' | CIDR | 'sg:<id>'.
function sourceControls(arch, source, insPrefix, dataAttrs) {
  const kind = source === '0.0.0.0/0' ? 'anywhere' : source.startsWith('sg:') ? 'sg' : 'cidr';
  const sgOpts = arch.securityGroups.map((g) =>
    `<option value="sg:${escapeHtml(g.id)}" ${source === `sg:${g.id}` ? 'selected' : ''}>${escapeHtml(g.name)}</option>`).join('');
  return `
    <select data-ins="${insPrefix}-srctype" ${dataAttrs} aria-label="Source type">
      <option value="anywhere" ${kind === 'anywhere' ? 'selected' : ''}>Anywhere-IPv4 (0.0.0.0/0)</option>
      <option value="cidr" ${kind === 'cidr' ? 'selected' : ''}>Custom CIDR</option>
      <option value="sg" ${kind === 'sg' ? 'selected' : ''} ${arch.securityGroups.length === 0 ? 'disabled' : ''}>Security group</option>
    </select>
    ${kind === 'cidr' ? `<input type="text" value="${escapeHtml(source)}" data-ins="${insPrefix}-srccidr" ${dataAttrs} aria-label="Source CIDR" />` : ''}
    ${kind === 'sg' ? `<select data-ins="${insPrefix}-srcsg" ${dataAttrs} aria-label="Source security group">${sgOpts}</select>` : ''}`;
}
```

SG-inspector rule row: replace the source `<input ... data-ins="rule-source" ...>` and the `cv-sg-sources` datalist with `${sourceControls(arch, r.source, 'rule', `data-index="${i}"`)}` (the SG id comes from `currentCtx.selection` exactly as the other rule-* cases already do).

3. **Workload Inbound-rules section.** In the workload branch, after the SG-checkbox paragraph:

```js
      const attachedRules = w.sgIds.flatMap((gid) => {
        const g = getSecurityGroup(arch, gid);
        return g ? g.inbound.map((r) => {
          const srcLabel = r.source === '0.0.0.0/0' ? 'anywhere (0.0.0.0/0)'
            : r.source.startsWith('sg:') ? (getSecurityGroup(arch, r.source.slice(3))?.name || r.source) : r.source;
          const ports = r.portFrom === r.portTo ? r.portFrom : `${r.portFrom}–${r.portTo}`;
          return `<p class="arch-mini">${escapeHtml(g.name)}: TCP ${escapeHtml(String(ports))} from ${escapeHtml(srcLabel)}</p>`;
        }) : [];
      }).join('');
      html += `
        <h3>Inbound rules</h3>
        ${attachedRules || '<p class="arch-mini">No inbound rules — all inbound traffic is denied.</p>'}
        <div class="arch-row">
          <label class="arch-mini">port <input type="number" value="${w.port}" data-ins="wlrule-port" /></label>
          ${sourceControls(arch, '0.0.0.0/0', 'wlrule', '')}
          <button type="button" data-ins="wlrule-add">Add rule</button>
        </div>`;
```

4. **`applyInspector` cases.** Remove the old `rule-source` case; add (following the existing style — `sub`/`wl`/`sg` locals exist; read sibling controls via `el.closest('.arch-row')`):

```js
    case 'route-dest': {
      const rt = getRouteTable(arch, el.dataset.rtb);
      if (rt && rt.routes[el.dataset.index]) rt.routes[el.dataset.index].destCidr = el.value.trim();
      break;
    }
    case 'route-target': {
      const rt = getRouteTable(arch, el.dataset.rtb);
      if (rt && rt.routes[el.dataset.index]) rt.routes[el.dataset.index].target = el.value;
      break;
    }
    case 'route-del': if (getRouteTable(arch, el.dataset.rtb)) removeRoute(arch, el.dataset.rtb, Number(el.dataset.index)); break;
    case 'route-add': {
      if (!sub) return;
      const row = el.closest('.arch-row');
      addSubnetRoute(arch, sub.id, row.querySelector('[data-ins="route-new-dest"]').value.trim(),
        row.querySelector('[data-ins="route-new-target"]').value);
      break;
    }
    case 'rule-srctype': case 'rule-srccidr': case 'rule-srcsg': {
      if (!sg || !sg.inbound[idx]) return;
      sg.inbound[idx].source = readSourceControls(el.closest('.arch-row'), 'rule');
      break;
    }
    case 'wlrule-add': {
      if (!wl) return;
      const row = el.closest('.arch-row');
      const target = ensureWorkloadSg(arch, wl.id);
      if (!target) return;
      addSgRule(arch, target.id, {
        portFrom: Number(row.querySelector('[data-ins="wlrule-port"]').value) || wl.port,
        source: readSourceControls(row, 'wlrule'),
      });
      break;
    }
    case 'wlrule-port': case 'wlrule-srctype': case 'wlrule-srccidr': case 'wlrule-srcsg': return; // committed by wlrule-add
```

with the shared reader (module level):

```js
// Reads the sourceControls trio back into a stored source string.
function readSourceControls(row, prefix) {
  const kind = row.querySelector(`[data-ins="${prefix}-srctype"]`).value;
  if (kind === 'anywhere') return '0.0.0.0/0';
  if (kind === 'sg') return row.querySelector(`[data-ins="${prefix}-srcsg"]`)?.value || '0.0.0.0/0';
  return row.querySelector(`[data-ins="${prefix}-srccidr"]`)?.value.trim() || '0.0.0.0/0';
}
```

Subtlety the implementer must handle: switching the Source *type* select re-renders (it flows through the inspector `change` listener). For `rule-srctype` the case above immediately rewrites the stored source (anywhere→'0.0.0.0/0'; cidr→the text field which doesn't exist yet → fallback '0.0.0.0/0'; sg→first SG). To make cidr/sg selection usable, `readSourceControls` falls back sensibly and the re-render then shows the conditional field initialized from the stored value — for 'cidr' store the previous source when it was a CIDR, else `'10.0.0.0/16'` as an editable starting value is friendlier than 0.0.0.0/0; implement `readSourceControls`'s cidr fallback as `|| '10.0.0.0/16'` for the `rule-` prefix path. For `wlrule-*` types nothing is stored until Add (the `return` cases), so the conditional field must appear without a model write: in the workload add-row ONLY, handle `wlrule-srctype` by re-rendering the inspector (call `renderInspector`'s mount refresh via `ctx.onChange()`-free path — simplest correct approach: keep a module-level `wlruleDraft = { port: null, source: '0.0.0.0/0' }` updated by the `wlrule-*` cases (which then `renderInspector(mount, currentCtx)` directly instead of returning), consumed and reset by `wlrule-add`). Keep it small; document with one comment.

- [ ] **Step 1: Apply removals; grep `data-connect\|startConnect\|showIntentPopover\|connectionIntent` → zero hits in js/.**
- [ ] **Step 2: Add the editors per the code above; `node --check js/arch-canvas.js`.**
- [ ] **Step 3: `node --test` (unchanged counts from Task 1) + `node scripts/validate-content.mjs`.**
- [ ] **Step 4: Commit**

```bash
git add js/arch-canvas.js architecture-challenge.html
git commit -m "Replace connect handles with console-style route and rule editors

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

### Task 3: Walkthrough, hint-copy check, docs

**Files:**
- Modify: `js/data/archChallenges.js` ONLY IF any hint/brief text references drawing, handles, or connecting by gesture (grep `drag\|draw\|handle\|connect` in that file; the known texts reference routing/SG concepts, not gestures — change nothing if so).
- Modify: `docs/superpowers/specs/2026-07-21-console-style-editors-design.md` (record any implementation deviations with the established "(Amended during implementation)" convention; none expected).

**Steps:**

- [ ] **Step 1: Grep challenge copy** as above; adjust only genuinely gesture-referencing text (keep the validator's brief-length floor in mind).
- [ ] **Step 2: Full sweep** — `node --test`, `node scripts/validate-content.mjs`, repo-root `node scripts/check-drift.mjs`.
- [ ] **Step 3: Controller browser walkthrough** (not the implementer): solve `public-web` using placement + the Routes editor + workload Inbound-rules row (no handles exist anymore); solve `fix-broken` (NAT re-home by drag + route fix via Routes editor + DB rule fix via the typed Source control); arrows appear as facts are authored and arrow-delete still works; SG-inspector source dropdown round-trips all three types; shared-table note shows when two subnets share a table; light+dark; console clean.
- [ ] **Step 4: Commit** (only if files changed in Steps 1/aws docs):

```bash
git add js/data/archChallenges.js docs/superpowers/specs/2026-07-21-console-style-editors-design.md
git commit -m "Align challenge copy and spec with the console-style editors

Co-Authored-By: Claude Fable 5 <noreply@anthropic.com>"
```

---

## Plan self-review notes

- **Spec coverage:** removals (T2), helpers with never-main/null-safety semantics (T1), Routes section incl. local row + shared note + effective-table editing (T2), typed Source in SG inspector + workload Inbound-rules with `ensureWorkloadSg` (T2), hint-line copy (T2), arrows/placement untouched (constraints), hint-copy check + walkthrough + amendments (T3).
- **Type consistency:** `addSubnetRoute(arch, subnetId, destCidr, target)` and `ensureWorkloadSg(arch, workloadId)` identical in T1 tests/impl and T2 `applyInspector`; `sourceControls`/`readSourceControls` prefixes `'rule'`/`'wlrule'` consistent between render and apply.
- **Known judgment point (called out for the implementer):** the wlrule add-row draft-state mechanism (module-level `wlruleDraft`) is specified in prose with its contract; the implementer should keep it under ~10 lines and reset it in `wlrule-add` and on selection change.
