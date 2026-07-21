# Canvas Arrow Legibility — Design

**Date:** 2026-07-21
**Status:** Approved

## Goal

Make the canvas's derived arrows self-explanatory. Today they anchor to
element centers (a route line ends in the empty middle of a wide subnet
card), carry their meaning only in hover tooltips, and have no legend.

## Design (all inside `js/arch-canvas.js`'s arrow rendering + page CSS)

- **Edge anchoring**: each line runs between the nearest points on the two
  elements' border rectangles (clamp the center-to-center segment to each
  box's edges), so lines start and stop at box borders instead of crossing
  interiors or ending in empty space.
- **Midpoint label pills**: render each edge's existing `label` (already in
  `derivedEdges`) as a small SVG text with a rounded background at the line
  midpoint — routes as `<destCidr> → IGW` / `<destCidr> → NAT <id>`, SG
  rules as their existing `TCP <port>`-style label (prefix `from` sources
  as today). Labels are escaped; pointer-events none (the fat `.hit` path
  keeps handling clicks).
- **Legend**: one muted line under the canvas surface:
  `— route (where a subnet's traffic goes) · — security-group rule
  (allowed inbound traffic)`, with short colored line samples matching the
  route/sg-rule stroke colors.
- **Bigger arrowheads**: enlarge the SVG marker so direction reads at a
  glance.
- Everything remains derived-only; no model, state, or engine changes; no
  new files.

## Testing

No unit surface (pure rendering); browser verification: solved public-web
shows the route line from the subnet's top edge to the IGW chip with a
`0.0.0.0/0 → IGW` pill and the green rule line labeled `TCP 80` ending at
the EC2 chip's edge; legend visible in light + dark; arrow click/delete
still works; console clean.

## Out of scope

Orthogonal/elbow routing, line avoidance, animation.
