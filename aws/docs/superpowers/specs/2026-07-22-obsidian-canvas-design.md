# Obsidian-Style Canvas for the CFN Card Builder — Design

**Date:** 2026-07-22
**Status:** Approved in spirit (user supplied Obsidian Canvas screenshots as
the target look/feel: "make it like obsidian's canvas boxes and arrows";
AZ-regions requirement from the prior message stands)

## Goal

Replace the vertical card list with a spatial canvas in Obsidian Canvas's
visual language: dotted background, free-floating rounded resource cards,
smooth bezier arrows connecting card edges, edge-dot link dragging, accent
selection outline with a floating delete toolbar, and Delete-key support.
Reference properties are authored by dragging arrows between cards; text
properties stay as inline form fields; AZs are lanes — dropping a Subnet
card in a lane sets its `AvailabilityZone`.

## Interaction model

- **Canvas**: a scrollable panel (~75vh) over a large inner surface with a
  dotted-grid background. Left column: "VPC and global". Three labeled AZ
  lanes (`us-east-1a/b/c`) fill the rest, divided by dashed rules.
- **Cards**: the CFN resource cards, absolutely positioned (`pos: {x, y}`
  stored on each graph resource — presentation metadata `graphToArch`
  ignores). Header keeps the logical-id input + type label (hover doc);
  body keeps text/enum/bool fields, the ingress editor, Role/Port sugar,
  and per-card problem lines. Ref props render as read-only status rows
  (`VpcId → Vpc`, or "drag from a dot to set" when unset).
- **Moving**: drag anywhere on a card that isn't a field/button. Drop
  commits `pos`. A Subnet dropped in a lane takes that lane's
  `AvailabilityZone` (its card shows an "AZ x — set by placement" badge);
  lanes mean nothing for other types.
- **Linking**: hovering/selecting a card shows four edge-midpoint dots.
  Dragging from a dot draws a dashed bezier to the cursor; cards whose
  kind matches some ref prop of the source highlight as drop targets.
  Dropping infers the property from the target kind (always unambiguous
  in this schema — checked at build time), sets scalar refs / adds to
  list refs, and the arrow becomes permanent with a small property-name
  label pill. `SourceSecurityGroupId` stays inside the ingress rule rows
  (per-rule, not card-level).
- **Selection**: click a card → accent outline + floating toolbar (delete).
  Click an arrow (fat hit path) → accent highlight + floating delete.
  Delete/Backspace removes the selection (card → resource with ref
  cascade; arrow → clears the scalar ref / removes the list entry).
  Escape cancels a drag or clears selection.
- **Add resource** row stays above the canvas; new cards spawn staggered
  near the viewport origin of their column (subnets in lane a).

## Layout

`layoutGraph(graph)` (pure, in archGraph.js, node-tested) assigns `pos` to
resources missing one: subnets stack top-down in their AZ lane; Instances
and NAT gateways stack beneath the subnet they reference (same lane);
everything else stacks in the global column in graph order, using
estimated card heights. Runs after `archToGraph` (start states, reveals,
migration) and for any resource added without a position. User drags
overwrite `pos`; card moves persist via the draft without invalidating
Check results (semantic edits still do).

## Unchanged

Resource graph draft shape (plus optional `pos`), `graphToArch` semantics
and problems, storage, Task panel, Check/goals/best practices, the
add-resource picker, cfnSchema catalog and docs.

## Out of scope

- Zoom/pan-with-space (canvas scrolls natively; can be added later).
- Obsidian toolbar features beyond delete (color, zoom-to, edit mode).
- Edge labels beyond the property name; multi-select; lasso.
