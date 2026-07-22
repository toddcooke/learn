# CloudFormation-Shaped Form Builder — Design

**Date:** 2026-07-22
**Status:** Approved (mockup accepted; full strict resource graph chosen)

## Goal

Rebuild the Architecture Challenge's input as CloudFormation-shaped forms:
one card per resource with an editable logical id, the real CFN type, and
the real CFN property names — but every reference is a dropdown filtered
to the right resource kind (no `!Ref`), `AllocationId` is a dropdown of
EIP resources (no `!GetAtt`), enums are selects, booleans checkboxes.
Full-graph fidelity: `VPCGatewayAttachment`, each `Route`, each
`SubnetRouteTableAssociation`, `EIP` + `NatGateway`, and `DBSubnetGroup`
are their own cards, exactly as in a real template. Validation
(`archValidate`), goals, best practices, and the Task panel are unchanged.

## Data model

The draft is a **resource graph**: `{ resources: [{ id, type, props }] }`,
order-preserving, JSON-serializable. Ref props store logical ids; refList
props store id arrays; `SecurityGroupIngress` stores CFN-shaped rule
objects (`IpProtocol`, `FromPort`, `ToPort`, `CidrIp` or
`SourceSecurityGroupId`). Sugar fields on workload types: `RoleTag`
(challenge role) and `PortTag` (listening port; DBInstance uses its real
`Port` property). Model names are the logical ids — no Name tags.

## Components

- **`aws/js/lib/cfnSchema.js`** — restored from git history (90d19a6)
  unchanged: the 14-type catalog with required/optional props, ref kinds,
  enums, and per-type/per-prop study docs. Forms skip `ignored: true`
  props and `Tags` (replaced by the sugar fields); docs render as hover
  tooltips (`title=`) on field labels.
- **`aws/js/lib/archGraph.js`** (new, pure, node-tested):
  - `graphToArch(graph)` → `{ arch, problems }` — the old cfnCompile
    pass-3 semantics minus YAML: exactly-one-VPC, attachment → `igwAttached`,
    AZ letter from `us-east-1x`, `MapPublicIpOnLaunch` → EC2 `publicIp`,
    NAT needs an EIP's `AllocationId`, routes need exactly one target,
    one association per subnet, `Scheme` → ALB `publicIp`,
    `ENGINE_DEFAULT_PORTS` for RDS. `problems` carry `{ id, message }`
    for per-card inline warnings (missing required prop, duplicate
    association, both/neither route targets, no/extra VPC…). Total —
    never throws; unset refs are skipped, cascades handled by rendering
    dropdowns from live state.
  - `archToGraph(arch)` — the old cfnEmit normalizations minus YAML:
    PascalCase unique logical ids from names, IGW + attachment when
    attached, EIP synthesized per NAT, main-table routes materialized as
    an explicit `MainRouteTable` with associations, `MapPublicIpOnLaunch`
    on subnets hosting public EC2s, `Scheme` from ALB `publicIp`,
    `DBSubnetGroup` per RDS, Role/Port sugar. Powers start states,
    reference solutions, and one-time migration of old model drafts.
  - Round-trip regression: `graphToArch(archToGraph(m))` fingerprint-equal
    (id-free projection) for every challenge start state and reference
    solution; every converted refSolution passes structure + its goals.
- **`aws/js/arch-graph-forms.js`** (new, DOM): schema-driven card
  renderer. Card header: logical-id input (rename cascades through every
  ref in the graph; collisions auto-suffix), CFN type label (hover doc),
  delete (removing a resource clears refs to it). Body: one row per
  schema prop — ref → select (`(none)` + matching-kind ids), refList →
  checkbox set, enum → select, bool → checkbox, cidr/port/string →
  input, `AvailabilityZone` → `us-east-1a/b/c` select; ingress rules get
  a sub-row editor (proto select incl. `-1`, FromPort–ToPort, source
  select: `CidrIp: 0.0.0.0/0` / custom CIDR / each SG). Route target
  selects are mutually exclusive (setting `GatewayId` clears
  `NatGatewayId` and vice versa). Per-card problem lines render from
  `graphToArch(...).problems`. Add-resource: type select (14 types) +
  button; new cards get teaching prefills (Instance `ImageId`
  pre-filled, Route `DestinationCidrBlock: 0.0.0.0/0`, SG description,
  DBSubnetGroup description) and auto ids (`Subnet2`, …). Committed
  edits on `change`; delegated attach-once listeners reading module ctx.
- **`aws/js/arch-challenge.js`** — draft = graph via new storage methods;
  `changed()` recomputes `graphToArch` once per edit (roles list +
  problems + Check share it). Check prepends mapper problems to the
  structural-errors list. Reveal = `archToGraph(refSolution())`; Reset =
  start graph. One-time migration: existing model-JSON draft →
  `archToGraph` → graph draft, old draft cleared.
- **Storage** (drift-shared ×5): add `getArchGraph(id)` (shape-checked:
  object with a `resources` array) / `setArchGraph` / `clearArchGraph`
  beside the kept arch-draft trio.
- **Page**: card styles per the accepted mockup (mono logical ids/type
  labels, label+field grid); landing/README copy updated.
- **Deleted**: `aws/js/arch-forms.js` (superseded console-style forms).

## Testing

`archGraph.test.mjs`: problem-case table, normalization cases, the
round-trip + goals regression (fingerprint helper adapted from the old
cfnEmit tests). Suite + check-drift green. Browser: reveal → Check all
green on ha-web, add-resource flow, id-rename cascade, per-card problem
line, draft persistence, dark mode.

## Out of scope

- YAML anywhere; unsupported CFN types; per-property free-form Tags.
- Reintroducing the diagram or text editor.
