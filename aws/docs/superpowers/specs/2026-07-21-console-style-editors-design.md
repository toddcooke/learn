# Console-Style Route/Rule Editors (Connect Handles Removed) — Design

**Date:** 2026-07-21
**Status:** Approved

## Goal

Replace the canvas's ⇢ connect handles and rubber-band gesture with
console-style form editors, matching how the real AWS console works
(Destination/Target dropdowns for routes, typed source rows for security
group rules). Placement drag, chip re-homing, and the derived arrows stay;
arrows become read-only visualization of what the forms author.

## Decision made during brainstorming

- **Handles → forms only**: the connect gesture is removed entirely; routes
  and SG rules are authored in the inspector with console-style controls.
  Palette drag + click-to-add, chip re-homing, the AZ picker, and the ALB
  subnet-set popover are unchanged. Arrows remain derived-only, with
  click-to-see-fact + Delete.

## Design

### Removed

- The ⇢ handle on every node (`data-connect`, the `chip()` connectable
  logic, the subnet-card and Internet-node handles).
- `startConnect`, the rubber-band SVG band, and `showIntentPopover` in
  `js/arch-canvas.js`.
- `connectionIntent` in `js/lib/archCanvasRules.js` and its tests.
- The Internet node stays as a visual fixture (arrows from internet/CIDR
  sources still originate there); it is no longer interactive beyond
  selection.
- The canvas hint line becomes: "Drag onto the canvas (or click to add).
  Click anything to edit its properties, routes, and rules below."

### Extracted helpers (`js/lib/archCanvasRules.js`, exported + tested)

The reusable semantics of the deleted intents survive as pure functions:

- `addSubnetRoute(arch, subnetId, destCidr, target)` — `target` is `'igw'`
  or `'nat:<natId>'`. Adds the route to the subnet's own explicit table,
  creating `<name>-rt` and associating it when the subnet is (implicitly or
  explicitly) on main — never edits the main table. Null-safe no-op when
  the subnet (or a referenced NAT) doesn't exist. Returns the route table
  it wrote to (or null).
- `ensureWorkloadSg(arch, workloadId)` — the workload's first attached SG,
  creating and attaching `<name>-sg` when it has none; null when the
  workload doesn't exist.

`canDrop` and `derivedEdges` are untouched.

### Subnet inspector — Routes section (console route-table editor)

Below the existing name/AZ/CIDR row and route-table association dropdown:

- A read-only row for the implicit local route: `<vpc-cidr> — local`.
- One row per route in the subnet's **effective** table:
  `[Destination text] [Target select] [✕]`. Destination edits and target
  changes write through to the owning table; Remove deletes that route.
  Target select options: `Internet gateway` (`igw`) and one per NAT —
  `NAT gateway <id> — in <subnet name>`.
- An **Add route** row: Destination text (default `0.0.0.0/0`) + the same
  Target select + Add button, applied via `addSubnetRoute` (create-or-
  extend own table; adding never touches main).
- When the effective table is explicit and shared, the section header notes
  `(shared by N subnets — edits affect all)`. When the subnet sits on
  main, the section shows only the local row + Add row (main is never
  edited; the first Add creates the subnet's own table).

### SG rules — console-style source (SG inspector + workload inspector)

- **SG inspector**: each inbound rule row becomes
  `[port from] – [port to] [Source type select] [conditional control] [✕]`
  where Source type is `Anywhere-IPv4 (0.0.0.0/0)` | `Custom CIDR` (shows
  a CIDR text field) | `Security group` (shows a select of the account's
  SGs by name). The stored model value is unchanged (`'0.0.0.0/0'`, a CIDR
  string, or `'sg:<id>'`); the dropdown is presentation only, initialized
  from the stored value. The add-rule button stays.
- **Workload inspector** gains an **Inbound rules** section (like the
  console's instance Security tab): a read-only list of every rule on the
  workload's attached SGs (`<sg name>: TCP <ports> from <source label>`),
  plus an add-rule row (port prefilled with the workload's `port`, same
  Source-type controls). Adding via a workload uses `ensureWorkloadSg`, so
  a workload with no SG gets `<name>-sg` auto-created and attached —
  preserving the existing teaching flow. Rule deletion for these rows
  happens in the SG inspector or via arrow-delete (no duplicate delete
  surface here beyond the add row; keep the section compact).

So the former gestures map to: *make subnet public* = subnet → Add route
`0.0.0.0/0` → Internet gateway; *web talks to db* = select db → Add
inbound rule, port 5432, Source type Security group → `web-1-sg`;
*internet reaches ALB* = select ALB → Add inbound rule, port 443, Source
Anywhere-IPv4.

### Unchanged

- Palette placement (drag + click-to-add), chip re-homing, AZ picker, ALB
  subnet-set popover, selection, Delete key, IGW chip toggle.
- Derived arrows (`derivedEdges`) with click-to-see-fact + Delete popover.
- Engine modules, challenges, storage, drafts, state shape, task panel.
- attach-once/live-`currentCtx` listener architecture; `escapeHtml`
  discipline; resize redraw.

### Testing

- `archCanvasRules.test.mjs`: connectionIntent tests replaced with
  `addSubnetRoute` tests (create-or-extend, never-main, reuse of an
  existing explicit table, NAT target, null-safety for missing subnet/NAT)
  and `ensureWorkloadSg` tests (reuse, auto-create+attach, null-safety).
  `canDrop`/`derivedEdges` tests untouched.
- Browser walkthrough: solve `public-web` and `fix-broken` end-to-end
  using only placement + the new editors; arrows appear as facts are
  authored; hints still read correctly (hint copy mentioning "route ...
  to the NAT gateway" stays accurate — check challenge hints for any that
  reference drawing/handles and adjust wording if found).

## Out of scope

- Any change to placement gestures or the diagram layout.
- New resource types or new goal/rule vocabulary.
- Free-text route targets beyond IGW/NAT (no peering/endpoints yet).
