# Form-Based Builder (CloudFormation Removed) — Design

**Date:** 2026-07-22
**Status:** Approved (mockup previewed and accepted; CFN dropped entirely by user choice)

## Goal

Replace the CloudFormation text editor with structured forms that edit the
arch model directly. No template anywhere: the vendored CodeMirror/yaml
bundles and every cfn* module are deleted, returning the repo to zero
third-party dependencies. Validation (`archValidate`), goals
(`archGoals`/`archSimulate`), best practices, and the Task panel are
unchanged.

## Decisions

- **Forms are the only input** — sections mirroring the AWS console's
  vocabulary, per the accepted mockup: VPC, Subnets, Route tables (+ NAT
  gateways), Security groups, Workloads.
- **CFN dropped entirely** (user choice over a read-only generated
  preview): delete `aws/js/vendor/`, `cfn-editor.js`, `cfnCompile`,
  `cfnEmit`, `cfnSchema` and their tests; remove the `getArchCfnText`
  family from drift-shared `storage.js` (propagated to all 5 modules).
- **Drafts return to model JSON** via the existing
  `getArchDraft`/`setArchDraft`. CFN text drafts are not migrated back
  (no compiler remains); stale `arch-cfn:*` keys are simply ignored.
  Completion results are untouched.

## Design

### `aws/js/arch-forms.js` (new, DOM only)

`renderForms(mount, { arch, challenge, onChange })` renders the five
sections and applies edits through `archModel` mutators, then calls
`onChange`. Re-renders happen on `change` events (committed edits), so
text inputs keep focus while typing — same discipline as the old canvas.
Delegated listeners attach once to the persistent mount and read a
module-level ctx (established pattern).

- **VPC**: CIDR text input; "Internet gateway attached" checkbox.
- **Subnets**: grid rows — name, AZ select (a/b/c), CIDR, route-table
  select ("main (implicit)" + explicit tables → associate/disassociate),
  delete. Add subnet (defaults AZ a).
- **Route tables**: one bordered block per table. Main renders first,
  name fixed, no delete, association note "implicit"; its routes are
  editable (the model allows main routes; private-egress uses them).
  Explicit tables: name input, "associated: <subnet names>" note, delete
  (blocked for main by the model). Route rows: destination CIDR →
  target select (Internet gateway | each NAT) with delete; Add route.
  NAT gateways live in this card as rows ("NAT in [subnet select]") with
  Add/delete — a NAT's subnet is edited via its select.
- **Security groups**: per SG — name input, delete; inbound rule rows:
  `TCP [from]–[to] from [Anywhere | Custom CIDR | security group…]`
  with the typed-source select pattern from the old console editors;
  Add rule; Add security group.
- **Workloads**: one block per workload — type is fixed at creation
  (separate Add EC2 / Add ALB / Add RDS buttons); name, role select
  (challenge roles + none), port number; subnets: single select for
  EC2, checkbox set for ALB/RDS; SG checkbox set; public IP checkbox
  (EC2), internet-facing checkbox (ALB → `publicIp`), Multi-AZ (RDS);
  delete.
- References are dropdowns/checkboxes built from current model state, so
  dangling references cannot be authored; removal cascades live in
  `archModel` as before.

### `aws/js/arch-challenge.js`

Editor wiring out, `renderForms` in. Draft = model (`setArchDraft` on
every change). Open: draft ?? `startState()` ?? `createArch()`. Reveal:
confirm, `arch = refSolution()`. Reset: confirm, clear draft, start
state. Check/results/hints/completion recording unchanged (compile
gating gone — Check is always enabled; structural errors render in the
results panel as before).

### Page (`architecture-challenge.html`)

Two columns stay: forms left (`minmax(0, 1fr)`), Task panel right
(400px), stacking ≤1100px. Editor styles (`#arch-editor-host`,
`.cfn-hover*`) out; form-section styles in (bordered section cards,
row grids, add/delete buttons — reusing `.arch-row`/`.arch-mini`/
`button.arch-del`-era idioms).

### Copy

Landing paragraph and `aws/README.md` bullet describe form building
(error checking via Check results; no editor/diagram claims).

## Testing

Pure logic is already covered (`archModel`, `archValidate`, `archGoals`,
`archSimulate`, `storage` minus the removed methods). The form module is
DOM-only and is verified in the browser: build ha-web via forms far
enough to exercise every section, plus reveal → Check → all goals green,
reset, draft persistence across reload, dark mode. Suite + check-drift
must pass after the deletion sweep.

## Out of scope

- Any CFN authoring or preview (explicitly dropped).
- Migrating `arch-cfn:*` text drafts back to models.
- Reintroducing the diagram panel.
