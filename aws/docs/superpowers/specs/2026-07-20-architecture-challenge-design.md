# Architecture Challenge — Design

**Date:** 2026-07-20
**Status:** Approved

## Goal

Add an interactive "Architecture Challenge" tool to the AWS SAA-C03 module:
the user is given a scenario task ("host a public website", "3-tier HA app
with a private database"), builds an architecture out of VPC networking
resources (VPC, subnets, IGW, NAT gateways, route tables, security groups,
EC2/ALB/RDS workloads), and the tool validates the design on three levels —
would AWS accept it at all, does it functionally satisfy the task, and does
it follow best practices — with plain-English explanations for every
verdict.

## Decisions made during brainstorming

- **Standalone page in the `aws/` module** (`architecture-challenge.html`),
  following the VPC Explorer precedent: linked from Home and the README, not
  part of the hash-router SPA, not in `check-drift`'s SHARED list.
- **Structured builder UI**, not drag-and-drop or a DSL: forms/dropdowns in
  a panel build the architecture; a live auto-drawn diagram (nested HTML
  boxes, like the vpc-explorer map) is generated output, not the input
  surface.
- **Scope: core VPC networking** — VPC, subnets, IGW, NAT gateways, route
  tables, security groups, and three placeable workload types (EC2, ALB,
  RDS). Single VPC, single region, AZs `a`/`b`/`c`.
- **Challenges + sandbox**: ~8 curated scenario challenges with graded
  validation and localStorage-persisted results, plus a free-build sandbox
  that runs the same structural/best-practice validators without goals.
- **Every challenge ships a reference solution**, asserted in tests to pass
  its own goals — a challenge can never be unsolvable.

## Design

### Architecture state (the user's design)

A plain serializable JS object; one VPC per challenge:

```js
{
  vpc: { cidr: '10.0.0.0/16', igwAttached: false },
  subnets: [{ id, name, az, cidr }],                    // az ∈ 'a'|'b'|'c'
  natGateways: [{ id, subnetId }],
  routeTables: [{ id, name, isMain, routes: [{ destCidr, target }], subnetIds: [] }],
  securityGroups: [{ id, name, inbound: [{ proto, portFrom, portTo, source }] }],
  workloads: [{ id, type, name, role, subnetIds, sgIds, publicIp, multiAz, port }],
}
```

- Route `target` is `'igw'` or `'nat:<natId>'`; the `local` route is
  implicit (always present, injected by the evaluator), matching AWS.
- Exactly one route table has `isMain: true`; subnets not explicitly
  associated with a route table use the main one. A subnet may appear in at
  most one route table's `subnetIds`.
- Security groups model **inbound rules only**; outbound is implicitly
  allow-all (AWS's default SG outbound rule). This simplification is stated
  in the UI. A rule `source` is either a CIDR string or `'sg:<sgId>'`
  (SG-reference chaining).
- Workload shapes by `type`:
  - `ec2`: exactly one subnet in `subnetIds`, `publicIp` boolean
    (auto-assign public IP), `port` (the service port it listens on).
  - `alb`: internet-facing only in v1; `subnetIds` ≥ 2 in distinct AZs;
    `port` is the listener port.
  - `rds`: `subnetIds` is its subnet group (≥ 2 subnets in ≥ 2 AZs, as AWS
    requires); `multiAz` boolean; `port` defaults to 5432.
- `role` tags which challenge role a workload fulfills (see Challenges);
  `null` in sandbox mode.
- IDs are auto-generated (`subnet-1`, `sg-2`, …); names are user-editable
  labels.

### Modules

All pure logic lives in `aws/js/lib/`, covered by `node --test`; the page
script only renders and wires the DOM.

- **`js/lib/archModel.js`** — state factory and mutation helpers
  (add/update/remove for each resource kind, with referential cleanup:
  deleting a subnet detaches it from route tables, NATs, workloads);
  derived queries used everywhere else: `effectiveRouteTable(arch,
  subnetId)`, `isPublicSubnet(arch, subnetId)` (effective route table has an
  active IGW route), `workloadsByRole(arch, role)`.
- **`js/lib/archValidate.js`** — structural validation and best-practice
  rules (below). Returns `{ errors: [...], warnings: [...] }`, each entry
  `{ ruleId, message, resourceIds }`.
- **`js/lib/archSimulate.js`** — connectivity simulation. Core evaluators,
  each returning `{ ok, trace }` where `trace` is an ordered list of
  human-readable steps with pass/fail (used verbatim in the results panel):
  - `internetToWorkload(arch, workloadId, port)` — EC2 needs public IP +
    public subnet + IGW attached + SG inbound allowing the port from the
    internet; ALB needs public subnets + IGW + SG.
  - `cidrToWorkload(arch, cidr, workloadId, port)` — like the above but for
    a specific external source CIDR (bastion/office scenarios).
  - `workloadToWorkload(arch, fromId, toId, port)` — intra-VPC via the
    implicit local route; destination SG must allow the port from the
    source (matching an `sg:` reference to one of the source's SGs, or a
    CIDR covering the source's subnet).
  - `workloadToInternet(arch, workloadId)` — egress: the effective route
    table routes `0.0.0.0/0` (longest-prefix match) to an attached IGW
    (public-IP workloads) or to a NAT gateway that itself sits in a public
    subnet.
  - Route resolution reuses `vpcMath.js` CIDR primitives (`parseCidr`,
    `ipToInt`, containment math); route-table evaluation is reimplemented
    against the new route shape (vpcMath's `evaluateRouteTable` is bound to
    the explorer's fixed reference VPC shape).
- **`js/data/archChallenges.js`** — challenge definitions (below) plus each
  challenge's reference solution.
- **`js/arch-challenge.js`** — standalone page script: state, rendering,
  event wiring, storage calls.
- **`architecture-challenge.html`** — page shell, styles (in
  `css/style.css` under an `arch-` prefix, dark-mode aware like the rest).
  **(Amended during implementation):** page-specific styles actually live
  inline in `architecture-challenge.html`'s own `<style>` block, matching the
  `vpc-explorer.html` precedent, not in `css/style.css`.

### Validation level 1 — structural ("would AWS accept this")

Errors; any error blocks goal evaluation (results panel says "fix
structural problems first" but still lists them all):

- VPC CIDR is valid IPv4/prefix, /16–/28. Subnet CIDRs valid, /16–/28,
  fully inside the VPC CIDR, mutually non-overlapping.
- Every route's `destCidr` is valid; `igw` targets require the IGW to be
  attached; `nat:` targets must reference an existing NAT gateway.
- NAT gateways must sit in an existing subnet.
- Exactly one main route table; no subnet associated with two route tables.
- ALB: ≥ 2 subnets in ≥ 2 distinct AZs. RDS: subnet group of ≥ 2 subnets
  spanning ≥ 2 AZs. EC2: exactly one subnet.
- All resource references (subnetIds, sgIds) resolve.

### Validation level 2 — functional goals

Each challenge declares goals as declarative assertions over **roles**. The
workload form includes a role dropdown populated from the challenge's role
list; the user tags which resource fulfills which role. Goal vocabulary
(v1):

| Goal | Passes when |
|---|---|
| `exists { role, workloadType }` | ≥ 1 workload with that role and type |
| `internetReaches { role, port }` | every workload with the role is reachable from the internet on the port (simulated) |
| `cidrReaches { cidr, role, port }` | reachable from the given external CIDR on the port |
| `noInternetReach { role }` | no workload with the role has both a public path and any SG rule open to `0.0.0.0/0` |
| `reaches { fromRole, toRole, port }` | every from-workload can reach every to-workload on the port |
| `hasEgress { role }` | every workload with the role can reach the internet outbound |
| `spansAzs { role, min }` | workloads with the role cover ≥ min distinct AZs |
| `multiAz { role }` | the role's RDS instance has `multiAz: true` |
| `vpcCidrIs { cidr }` | VPC CIDR equals the given block |
| `subnetPlan { count, minUsableHosts, minAzs, publicCount, privateCount }` | subnet layout meets the stated plan (usable hosts = size − 5 AWS-reserved) |

Each goal renders with a human label and, after a check, its simulation
trace explaining the pass/fail.

### Validation level 3 — best practices (advisory)

Warnings with explanations; never block completion. Score = passed ÷
applicable. Rules (each has an id, message, and a "why" grounded in the
study-guide content):

- `db-in-private-subnet` — RDS instances should live in private subnets.
- `no-open-ssh` — no SG inbound rule for port 22 from `0.0.0.0/0`.
- `no-open-db-port` — no SG inbound rule for the DB port from `0.0.0.0/0`.
- `least-privilege-sg` — tier-to-tier SG rules should reference SGs, not
  broad CIDRs.
- `nat-per-az` — when private workloads span ≥ 2 AZs and egress via NAT,
  there should be a NAT gateway per used AZ.
- `single-az` — all workloads in one AZ (informational nudge toward HA).
- `unused-resources` — NAT gateways, SGs, or route tables that nothing
  uses (cost/hygiene).

Challenges may scope which rules apply (`bestPractices: 'all'` or a list of
rule ids); sandbox applies all.

### Challenges (`js/data/archChallenges.js`)

Each: `{ id, title, brief, roles: [{ id, label, expectedType }], startState,
goals, bestPractices, hints, refSolution }`. `startState: null` means an
empty VPC. The set, ordered by difficulty:

1. **Public web server** — one EC2 reachable on 80 from the internet.
2. **Private worker with NAT egress** — EC2 with outbound internet but no
   inbound exposure.
3. **Two-tier web + DB** — public web EC2, private RDS, SG-chained 5432.
4. **HA web behind an ALB** — internet → ALB:443 → web EC2s on 80, web
   tier across 2 AZs, web not directly internet-reachable.
5. **Three-tier HA app** — ALB → app tier (2 AZs, NAT egress) → Multi-AZ
   RDS; nothing but the ALB internet-reachable.
6. **Fix the broken architecture** — `startState` is a pre-built flawed
   design (NAT in a private subnet, DB SG open to the world, missing
   route); same goal machinery, but the work is diagnosis.
7. **CIDR planning** — fit 4 subnets (2 public / 2 private, 2 AZs, ≥ 50
   usable hosts each) into a `/24` without overlap.
8. **Locked-down bastion** — SSH into a bastion only from a given office
   CIDR, app instances reachable only via the bastion.

`hints` is a short ordered list revealed one at a time on request. A "show
reference solution" button (enabled after ≥ 1 failed check, with a confirm)
loads `refSolution` into the builder.

### Page UI

Three regions:

- **Landing** — card per challenge with completion badge and best-practice
  score, plus a sandbox card. In-page `location.hash` (`#challenge-id`)
  deep-links; no SPA router involvement.
- **Builder (left panel)** — collapsible sections: VPC (CIDR, IGW toggle),
  Subnets, NAT Gateways, Route Tables (routes + subnet associations),
  Security Groups (inbound rules), Workloads (type-dependent fields, role
  dropdown). Add/edit/delete; every change re-renders the diagram and
  autosaves the draft.
  **(Amended during implementation):** sections shipped as plain,
  non-collapsing sections, not collapsible — no requirement emerged during
  implementation to hide a section, and collapsing state would have been
  one more thing to autosave.
- **Diagram (center)** — auto-drawn nested boxes: VPC border with CIDR +
  IGW chip; a column per in-use AZ; subnet cards tinted public/private
  (derived from routing) showing their CIDR, route-table badge, NAT chips,
  and workload chips (ALB chips appear in each of its subnets).
- **Task panel (right)** — brief, roles checklist (which roles are still
  unassigned), Check architecture button, then results: structural errors,
  goal pass/fail with traces, best-practice score with per-rule
  explanations. Sandbox shows structural + best-practice only.

### Persistence (`js/lib/storage.js`)

Extend the existing store (same namespace/validation patterns):

- `getArchResults()` / `recordArchResult(challengeId, { completedAt,
  bpScore, bpTotal })` — best result per challenge (object keyed by id).
- `getArchDraft(challengeId)` / `setArchDraft(challengeId, state)` /
  `clearArchDraft(challengeId)` — autosaved builder state per challenge
  (sandbox uses id `'sandbox'`).

The Progress view gains a small "Architecture challenges" card (completed
count + per-challenge badges) reading `getArchResults()`.

**(Amended during implementation):** the shipped field names are
`{ completedAt, bpPassed, bpApplicable }`, not `{ completedAt, bpScore,
bpTotal }` — `bpPassed`/`bpApplicable` read more clearly at call sites
(`recordArchResult`, the landing badge, the Progress card) than a
score/total pair would.

**(Amended during implementation):** `js/views/progress.js` is a
drift-SHARED file (byte-identical across all five modules), so it cannot
statically import `js/data/archChallenges.js`, which exists only in `aws/`.
The Progress card instead loads it via a dynamic `import()` and hides its
own section (`.catch()`) in every module that has no such data file.

### Wiring

- Home view: link card next to the VPC Explorer link.
- `aws/README.md`: feature bullet.
- `scripts/validate-content.mjs`: new `validateArchChallenges()` — shape
  checks, unique ids, known goal types, goals reference declared roles,
  `refSolution` present, hints non-empty strings.

### Testing

- `archModel.test.mjs` — mutation helpers incl. referential cleanup;
  `effectiveRouteTable`; `isPublicSubnet`.
- `archValidate.test.mjs` — each structural rule and each best-practice
  rule, positive and negative fixtures.
- `archSimulate.test.mjs` — traces for: public EC2 reachable; missing IGW;
  NAT-in-private-subnet egress failure; SG-reference chaining; CIDR-source
  reachability; longest-prefix route selection.
- `archChallenges.test.mjs` — for every challenge: `refSolution` passes
  structural validation and **all** goals; an empty architecture fails at
  least one goal; challenge 6's `startState` fails its goals as shipped.
- `node scripts/validate-content.mjs` passes; `node scripts/check-drift.mjs`
  stays clean (new files are aws-only, not in the SHARED list).

## Out of scope (v1)

- NACLs, IPv6, outbound SG rules (assumed allow-all).
- VPC peering, Transit Gateway, VPC endpoints, multi-VPC challenges.
- Internal (non-internet-facing) ALBs, target-group health checks.
- Drag-and-drop canvas, free-form diagram editing.
- Cost estimation, VPN/Direct Connect/on-prem, multi-region.
