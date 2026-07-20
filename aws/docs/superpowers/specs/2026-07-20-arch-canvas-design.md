# Architecture Challenge Canvas (Drag-and-Drop Builder) — Design

**Date:** 2026-07-20
**Status:** Approved

## Goal

Replace the Architecture Challenge's form-based builder with a drag-and-drop
canvas: drag resources from a palette into the VPC/subnet boxes, drag chips
between containers to re-home them, and draw connections that create the
real underlying AWS facts (security-group rules, routes) via confirmation
popovers — in the style of an AWS architecture diagram. The validation
engine, challenges, and saved state are untouched.

## Decisions made during brainstorming

- **Same resource set, canvas first**: no new AWS services in this phase.
  The palette covers the existing model (subnets, NAT, EC2, ALB, RDS,
  security groups; VPC and IGW are canvas fixtures). ASG/API Gateway etc.
  are a future phase with their own simulation semantics and challenges.
- **Arrows create real facts via popover** (not auto-magic wiring, not
  decoration): each drawn connection opens a small popover stating exactly
  the SG rule or route it will create; confirming applies the archModel
  mutation. Rendered arrows are always derived from the model.
- **The canvas fully replaces the form builder.** A click-to-open
  inspector handles non-drawable properties. The old builder panel and the
  separate read-only diagram panel are removed (the canvas *is* the
  diagram).
- **Structured drag-and-drop, not a free canvas** (approach A): dragging
  changes *parentage*, never pixel coordinates. Layout stays automatic
  (nested boxes + AZ lanes, like the current diagram), so no geometry is
  persisted — the architecture state shape does not change and existing
  drafts, tests, challenges, and validators all keep working.

## Design

### Page layout

Two panes replace the previous three:

- **Canvas** (wide): a palette strip on its edge plus the diagram surface —
  the VPC box (always present; CIDR badge and an IGW chip that toggles
  attachment on its border), AZ lanes that appear per used AZ, subnet
  cards, resource chips, and an **Internet node** rendered outside the VPC
  box. An SVG overlay draws connection arrows between element edges,
  recomputed on every render.
- **Task panel** (unchanged): brief, roles checklist, Check architecture,
  results with traces, best-practice score, hints, reveal, reset.

Palette items: Subnet, NAT gateway, EC2, ALB, RDS, Security group. Route
tables are not palette items — they materialize from route connections and
stay editable through the inspector.

### Interactions

- **Place**: drag a palette item over the canvas; legal drop targets
  highlight, illegal ones don't react. Subnet → VPC (an AZ picker chooses
  a/b/c on drop). EC2/RDS/NAT → a subnet. ALB → the VPC (its subnet set is
  chosen in the popover on drop and editable in the inspector). Security
  group → anywhere on the canvas (SGs are listed in a small tray on the
  canvas edge; they attach via the inspector or implicitly via
  connections). Every palette item also supports **click-to-add** (adds to
  the currently selected container, or the VPC default) — the keyboard and
  mobile path; the tool is never drag-only.
- **Re-home**: drag an existing chip into another container (move an EC2
  between subnets, move a NAT from private to public — the fix-broken
  move). Same legality rules as placement.
- **Connect**: every node exposes a connect handle; dragging it
  rubber-bands a line and highlights legal endpoints. Dropping opens a
  popover stating the fact to create; Confirm applies it:
  - **Internet → workload**: SG inbound rule from `0.0.0.0/0` on the
    workload's port (editable in the popover). Creates and attaches
    `<name>-sg` if the workload has no SG.
  - **workload → workload**: SG inbound rule on the destination from the
    source's SG (SG-reference chaining; auto-creates/attaches SGs on
    either side as needed). Port defaults to the destination's `port`.
  - **subnet → IGW**: route `0.0.0.0/0 → igw` for that subnet. If the
    subnet has no explicit route table, one is created and associated; if
    it has one, the route is added to it. (Popover warns when the IGW is
    detached; the fact is still created — structural validation teaches
    the rest.)
  - **subnet → NAT**: route `0.0.0.0/0 → nat:<id>` with the same
    create-or-extend table behavior.
  - Anything else (e.g. workload → subnet) is not a legal connection.
- **Arrows rendered**: derived from the model only — route edges
  (subnet → IGW/NAT) and SG-rule edges (Internet/workload → workload,
  drawn when a rule's source resolves to the internet, a CIDR, or another
  workload's SG). Clicking an arrow shows the underlying fact with a
  delete action (removes the rule/route).
- **Inspect**: clicking a node opens the inspector panel for non-drawable
  properties: subnet name/AZ/CIDR; workload name/role/port/public-IP/
  Multi-AZ/subnet set (ALB, RDS)/SG attachment; SG name and full inbound
  rule list (including CIDR sources the connect gesture can't express);
  route-table name, membership, and sharing across subnets; VPC CIDR.
  Deletion (✕ in the inspector or Delete key on the selection) uses the
  existing referential-cleanup mutators.
- **Cancel/undo affordances**: Esc cancels an in-flight drag or connect;
  popovers have Cancel; there is no undo stack in this phase (parity with
  the old builder).

### What explicitly does not change

- The architecture state shape (drafts are forward/backward compatible;
  no layout data is stored).
- `archModel.js`, `archSimulate.js`, `archGoals.js`, `archValidate.js`,
  `archChallenges.js` (all 8 challenges + reference solutions + harness),
  `storage.js`, the content validator, and every existing test.
- The Check flow, results rendering, hints, reveal, reset, completion
  recording, landing page, Home/Progress/README wiring.
- Nothing new touches the drift-guard SHARED list (all new files are
  aws-only).

### Code structure

- **`aws/js/lib/archCanvasRules.js`** (new, pure, `node --test` covered) —
  the decision logic the canvas defers to:
  - `canDrop(kind, targetRef, arch)` — legality of palette drops and
    re-homes (`kind` is a palette type or an existing node id; `targetRef`
    identifies the VPC, a subnet, or the SG tray).
  - `connectionIntent(fromRef, toRef, arch)` → `null` for illegal pairs,
    else `{ description, apply(arch, options) }` where `description`
    feeds the popover copy and `apply` performs the archModel mutations
    (including SG auto-create/attach and route-table create-or-extend).
  - `derivedEdges(arch)` → the arrow list `[{ from, to, kind, fact }]`
    the SVG overlay renders and the arrow-click UI deletes through.
- **`aws/js/arch-canvas.js`** (new, DOM-only) — canvas rendering, drag
  handlers (pointer events), SVG overlay, popovers, inspector, selection.
- **`aws/js/arch-challenge.js`** (slimmed) — page shell, landing, task
  panel, Check flow; mounts the canvas and passes it the shared
  `changed()` re-render/autosave funnel.
- Styles stay inline in `architecture-challenge.html`'s `<style>` block.

### Testing

- `archCanvasRules.test.mjs`: every drop-legality case; every
  connection-intent mapping (including SG auto-creation, sg-ref chaining,
  route-table create-or-extend, detached-IGW warning flag, illegal
  pairs); `derivedEdges` against architectures with routes, sg-refs, CIDR
  and internet-open rules; intents applied to reference solutions leave
  them goal-passing.
- Existing suites must stay green untouched.
- Browser walkthrough: solve `public-web` and `fix-broken` end-to-end
  using only drag, connect, and inspector edits; verify arrows match the
  model after reveal; dark/light modes; click-to-add fallback path.

## Out of scope

- New AWS services (ASG, API Gateway, SQS…) — future phase.
- Free-form node positioning, pan/zoom, undo/redo stack.
- Persisting any canvas layout state.
- Touch-optimized drag (tap-based click-to-add is the mobile path).
