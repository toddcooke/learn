# CloudFormation Editor Workbench (Canvas Becomes Read-Only) — Design

**Date:** 2026-07-21
**Status:** Approved

## Goal

Replace the Architecture Challenge's drag-and-drop editing with a
CloudFormation-first workbench: the user authors a CFN YAML template in a
rich IntelliJ-grade editor on the left half of the screen, and the right
half shows the live-rendered architecture diagram plus the existing
Task/Check panel. The canvas stops being an input surface and becomes a
read-only visualization of whatever the template compiles to.

## Decisions made during brainstorming

- **Replace, don't toggle**: CFN YAML is the only way to build. No
  visual-edit mode remains, so there is no two-way sync problem. The
  palette, placement drag, chip re-homing, popovers, console-style
  route/SG form editors, and the inspector are all removed.
- **Vendor CodeMirror 6**: first third-party code in the repo, checked in
  as a one-time prebuilt ESM bundle under `aws/js/vendor/`. Runtime stays
  buildless (static site, ES modules, no bundler).
- **Strict real-CFN wiring**: templates use the real resource graph — IGW
  attaches via `AWS::EC2::VPCGatewayAttachment`, NAT needs an
  `AWS::EC2::EIP` + `!GetAtt <Eip>.AllocationId`, RDS needs an
  `AWS::RDS::DBSubnetGroup`, subnets bind to route tables via
  `AWS::EC2::SubnetRouteTableAssociation`, SGs need `GroupDescription`.
- **Parsing approach A**: vendor `yaml` (eemeli/yaml v2) alongside
  CodeMirror. Its AST carries exact node offsets, resolves CFN's
  `!Ref`/`!GetAtt` short-form tags via custom tags, and reports precise
  syntax-error positions. CodeMirror's Lezer tree is used only for
  highlighting.

## Design

### Layout (`architecture-challenge.html`)

- Workbench grid becomes editor-left / result-right (roughly 55/45):
  left is the CodeMirror editor filling the panel height (~70vh min);
  right stacks `#arch-canvas` (read-only diagram) above `#arch-task`.
  Narrow screens (≤1100px) stack editor, then diagram, then task.
- Canvas-editing CSS (palette, ghost, popover, drop-ok, tray) is deleted;
  editor panel styles added. CodeMirror injects its own base CSS; the
  theme (below) maps colors to the site's `--color-*` variables, dark
  mode included.

### Vendored libraries (`aws/js/vendor/`)

- `codemirror.js` — single prebuilt ESM bundle re-exporting the needed
  symbols from `@codemirror/state`, `view`, `commands`, `language`,
  `lint`, `autocomplete`, `search`, `@codemirror/lang-yaml`, and
  `@lezer/highlight`.
- `yaml.js` — eemeli/yaml v2 ESM bundle.
- `README.md` — pinned package versions, the exact esbuild command that
  produced each bundle, and MIT license texts. Bundles are committed;
  rebuilding is a documented one-time offline step, never a runtime or
  CI dependency.

### `lib/cfnSchema.js` (new, pure data + helpers, node-tested)

Catalog of supported resource types. Per type: required properties,
optional properties (including real-world props we accept but don't
simulate), enum values, which resource kind each ref-shaped property must
point at, and short hover-docs (type-level and property-level) written as
SAA-C03 study content. Unknown types get no docs — the editor shows
"No documentation found."

Supported types and their mapping into the arch model:

| CFN type | Model effect | Required props |
|---|---|---|
| `AWS::EC2::VPC` (exactly one) | `vpc.cidr` | `CidrBlock` |
| `AWS::EC2::Subnet` | subnet (name from `Tags` `Name`, else logical id); `MapPublicIpOnLaunch` gives its EC2 workloads `publicIp` | `VpcId`, `CidrBlock`, `AvailabilityZone` |
| `AWS::EC2::InternetGateway` (max one) | exists only to be attached | — |
| `AWS::EC2::VPCGatewayAttachment` | `vpc.igwAttached = true` | `VpcId`, `InternetGatewayId` |
| `AWS::EC2::EIP` | referenced by NAT via `!GetAtt x.AllocationId` | — |
| `AWS::EC2::NatGateway` | NAT in its subnet | `SubnetId`, `AllocationId` |
| `AWS::EC2::RouteTable` | explicit route table | `VpcId` |
| `AWS::EC2::Route` | route on its table; target from exactly one of `GatewayId` / `NatGatewayId` | `RouteTableId`, `DestinationCidrBlock`, one target |
| `AWS::EC2::SubnetRouteTableAssociation` | association (max one per subnet) | `SubnetId`, `RouteTableId` |
| `AWS::EC2::SecurityGroup` | SG (name from `GroupName`, else logical id); `SecurityGroupIngress` rows → inbound rules (`IpProtocol`, `FromPort`/`ToPort`, one of `CidrIp` / `SourceSecurityGroupId`); `SecurityGroupEgress` accepted with info "outbound is not simulated (allow-all)" | `GroupDescription`, `VpcId` |
| `AWS::EC2::Instance` | ec2 workload | `ImageId`, `SubnetId` |
| `AWS::ElasticLoadBalancingV2::LoadBalancer` | alb workload; `Scheme: internet-facing` (the real default) → `publicIp`; `Type` must be `application` if present | `Subnets` |
| `AWS::RDS::DBSubnetGroup` | subnet set for a DB instance | `DBSubnetGroupDescription`, `SubnetIds` |
| `AWS::RDS::DBInstance` | rds workload; `MultiAZ`, `Port` (default by `Engine`: postgres 5432, mysql/mariadb 3306) | `Engine`, `DBSubnetGroupName` |

Cross-cutting conventions:

- **Roles** assign via `Tags: [{Key: Role, Value: web}]` on Instance /
  LoadBalancer / DBInstance. Compile is challenge-agnostic; the existing
  roles panel reports unassigned roles, and autocomplete suggests the
  open challenge's role ids.
- **Names** come from a `Name` tag (or `GroupName`), else the logical id.
- **Listening port**: model default per workload type; overridable via a
  `Port` tag on Instance/LoadBalancer (documented in hover docs; RDS uses
  its real `Port` property).
- **AvailabilityZone** accepts `<region><letter>` (e.g. `us-east-1a`);
  the trailing letter must be a/b/c (the model's AZs).
- **Intrinsics**: `!Ref`/`Ref:` and `!GetAtt`/`Fn::GetAtt` (dotted or
  list form) only. Anything else (`!Sub`, `!Join`, …) is an error where
  it appears.

### `lib/cfnCompile.js` (new, pure, node-tested)

`compile(templateText)` → `{ arch, diagnostics, sourceMap, idMap }`.

- `diagnostics`: `{ from, to, severity: 'error'|'warning'|'info',
  message }` with exact text ranges from the YAML AST.
- `arch`: a normal arch model, produced only when there are **no
  error-severity diagnostics** (warnings/infos don't block). Compilation
  is total: it never throws on any input text.
- `sourceMap`: logicalId → ranges (resource key, `Type` value, per-prop)
  for squiggle placement, click-to-navigate, and cursor-highlight.
- `idMap`: model resource id ↔ logical id, for mapping Check-time
  structural errors back to template lines.

Diagnostic catalog (severity):

- YAML syntax errors, duplicate logical ids/keys (error, from `yaml`).
- Missing/empty `Resources` section (error).
- **Unknown resource type** — exact IntelliJ wording: `Unknown
  CloudFormation resource type: <Type>` (error, squiggle on the Type
  value).
- Real-but-unsupported AWS type (warning; resource ignored; message
  lists the supported set).
- Missing required property; unknown property on a known type (error /
  warning respectively).
- `!Ref`/`!GetAtt` to a missing logical id, or to a resource of the
  wrong kind for that property (error). NAT `AllocationId` must be
  `!GetAtt <EIP>.AllocationId`.
- Route with both or neither of `GatewayId`/`NatGatewayId`; second
  `SubnetRouteTableAssociation` for the same subnet; second VPC or IGW;
  non-`application` LoadBalancer `Type`; invalid enum values; malformed
  CIDR; AZ letter outside a/b/c (errors).
- `Parameters`/`Mappings`/`Conditions`/`Outputs` sections: info,
  "ignored by the simulator". `Description`/`AWSTemplateFormatVersion`
  accepted silently.

The implicit main route table: CFN cannot address it, so it compiles to
an empty (local-only) `rtb-main`, and unassociated subnets fall back to
it — exactly AWS behavior. Users must write explicit tables and
associations for any non-local routing.

### `lib/cfnEmit.js` (new, pure, node-tested)

`emit(arch)` → canonical strict-CFN YAML text. Keeps the existing
model-builder `startState()`/`refSolution()` functions in
`archChallenges.js` working with zero data rewrite: they are serialized
on demand. Normalizations:

- PascalCase logical ids derived from resource names, uniquified.
- IGW attachment → `InternetGateway` + `VPCGatewayAttachment`; each NAT
  → an `EIP` + `NatGateway`; RDS → `DBSubnetGroup` + `DBInstance`.
- Routes on `rtb-main` (challenge 2's start state) are rewritten to an
  explicit route table associated with every subnet that effectively
  used main — CFN can't touch the real main table.
- Workload `publicIp` → `MapPublicIpOnLaunch: true` on its subnet (ec2)
  or `Scheme: internet-facing` (alb).
- Non-default ports → `Port` tag (Instance/ALB) or `Port` property (RDS).
- Roles/names → `Tags`.

### `cfn-editor.js` (new, DOM glue, no node tests)

Mounts CodeMirror with: YAML highlighting; a site-palette theme
(`EditorView.theme` + `HighlightStyle` reading the page's CSS variables,
dark mode via the existing `prefers-color-scheme` overrides); line
numbers; lint gutter + squiggles fed by the orchestrator's cached
compile (lint delay ~300ms); hover tooltips that show diagnostics plus
schema quick-docs for the token under the cursor ("No documentation
found." for unknown types); autocompletion for resource types after
`Type:`, property names per resource context, `!Ref` targets filtered to
the expected kind, enum values, and the challenge's role ids inside a
Role tag; undo/redo, search, bracket matching (free with CodeMirror).

API: `createCfnEditor(mount, callbacks)` returning `{ setText,
revealResource(logicalId), destroy }`; callbacks `onDocChange(text)`
(debounced ~250ms), `onCursorResource(logicalId|null)`, and
`getDiagnostics(text)` — the lint source pulls from the orchestrator's
cached compile so text is only ever compiled once per change.

### `arch-canvas.js` (slimmed to a pure renderer)

Deletes the palette, drag ghost, drop targets, popovers, console-style
route/SG editors, inspector, keyboard delete, and mutation wiring
(roughly halves the file). Keeps: internet node, VPC/IGW chip, AZ grid,
subnet cards with public/private tint, workload/NAT chips, derived
arrows via `archCanvasRules.derivedEdges`, edge-label pills, legend.
New interface: `renderCanvas(mount, { arch, highlight, stale, onNodeClick })`
— `highlight` outlines the node for the resource under the editor
cursor, `stale: { errors: n }` dims the diagram and shows a "template
has N errors" badge, `onNodeClick(modelId)` lets the orchestrator scroll
the editor to that resource's definition. `unmountCanvas()` and the
module-level ctx/keydown listener go away with editing.

### `arch-challenge.js` (orchestrator)

- State: `templateText` (source of truth), last good `arch` +
  `sourceMap`/`idMap`, `diagnostics`, `results`.
- On editor change: compile; update squiggles; on success re-render the
  diagram and autosave; on errors keep the last good diagram, dimmed,
  with the error-count badge.
- **Drafts**: stored as YAML text via new shared-storage methods. On
  open: text draft if present; else a legacy JSON arch draft is migrated
  (`emit` → save text → clear JSON draft); else `emit(startState())` /
  an empty-skeleton template for sandbox.
- **Check architecture**: unchanged semantics (structure → goals →
  best practices) run on the compiled arch; the button is disabled
  while the template has error-severity diagnostics. Structural errors additionally squiggle
  inline when `idMap` + `sourceMap` can place them (best-effort;
  unmappable ones show only in the panel, as today).
- **Reveal solution**: confirm, then `setText(emit(refSolution()))`.
  **Reset**: confirm, then start-state text; clears stored drafts.
- Diagram click → `revealResource`; cursor moves → diagram highlight
  (replaces the old selection system).
- Landing copy: "build" language becomes "write the CloudFormation
  template".

### `storage.js` (shared — drift rule applies)

New methods `getArchCfnText(id)` / `setArchCfnText(id, text)` /
`clearArchCfnText(id)` beside the existing arch-draft methods. Any edit
to `storage.js` and `storage.test.mjs` must be propagated byte-identical
(except the NAMESPACE line) to all 5 modules and pass
`scripts/check-drift.mjs`.

## Error-handling philosophy

Compile diagnostics are inline and live (squiggles + gutter + hover),
like IntelliJ inspections. Check-time results (structural errors, goal
traces, best-practice score) stay in the results panel, with structural
errors mirrored inline when mappable. The diagram never renders a
half-broken model: errors freeze it at the last good state, visibly
dimmed.

## Testing

- `node --test` suites for `cfnSchema` (docs/props sanity),
  `cfnCompile` (one case per diagnostic, exact ranges for key cases —
  including the unknown-resource-type message; happy-path template →
  expected model), `cfnEmit` (canonical output shape).
- Round-trip regression: for every challenge's `startState` and
  `refSolution`, `compile(emit(model))` produces an equivalent model
  (deep-compare modulo ids), `validateStructure` passes, and each
  compiled `refSolution` passes its own challenge's goals.
- `storage.test.mjs` updated (shared, propagated); `check-drift.mjs`
  passes.
- Editor/diagram glue verified in the preview browser (use cache-busted
  imports — the preview caches modules from `python3 -m http.server`).

## Out of scope

- Simulating `Parameters`/`Mappings`/`Conditions`/`Outputs` (accepted,
  ignored, info diagnostic).
- `!Sub`/`!Join`/other intrinsics; JSON-format templates.
- ALB `Listener`/`TargetGroup` resources, NACLs, VPC peering, multiple
  VPCs, EC2 `NetworkInterfaces` (public IPs come from
  `MapPublicIpOnLaunch`).
- Anki export (arch challenges stay excluded by design).

Note: the previously parked "no UI path to delete an orphaned route
table" fast-follow dissolves — orphaned resources are just YAML lines
you delete.
