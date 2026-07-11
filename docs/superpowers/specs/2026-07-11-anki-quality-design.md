# Anki Deck Quality Pass — Design

Date: 2026-07-11. Scope approved by Todd: all seven improvements from the
best-practices audit (3 web-research agents on Wozniak's Twenty Rules,
Matuschak's prompt-writing properties, Nielsen, the Anki manual, and
cert-prep community guidance; 1 audit agent measuring all 344 cards).

## Audit baseline (measured 2026-07-11)

344 cards (aws 73, kubernetes 64, postgres 70, sre 67, networking 70).
Already compliant: self-contained fronts with context cue, one-way policy,
house style (344/344 punctuated backs, 337/344 question fronts), 6.1%
answer-echo rate, comparison cards pin one axis, only 14 backs scatter
discrete numeric facts. Gaps: no stable-id export column (front edits
duplicate notes on re-import; `role` id collides across kubernetes and
postgres); 13 enumeration/port-bundle cards; zero distinguisher cards for
ALB/NLB, VACUUM/ANALYZE, 802.1Q/802.1X, and no MTBF card; 9 binary fronts;
5 template-identical AWS comparison fronts; card-per-tag taxonomy (339
tags/344 cards); ~14 two-ask fronts hiding a discrete second fact; aws has
0% scenario-style fronts (networking: 10%).

## Decisions

1. **Export format v2 (script-only)**: 4 columns — `ID\tFront\tBack\tTags`
   with headers `#separator:tab`, `#html:false`, `#tags column:4`, plus a
   comment line `# exported <YYYY-MM-DD> from toddcooke/learn <module>`.
   ID = `<module>-<card id>` (module prefix kills the cross-deck `role`
   collision). Tags become hierarchical: `<module>::<slug(service)>`.
   Anki setup (one-time, documented in README): create a note type with
   fields ID/Front/Back (ID first; sort field Front; ID not on templates),
   import mapping col1→ID col2→Front col3→Back col4→tags; subsequent
   re-imports match on ID and update in place. Existing imported decks
   migrate once (delete old Basic notes, import fresh).
2. **Enumeration splits (networking only)**: split `file-remote-ports`,
   `mgmt-signaling-ports`, `name-resolution-ports` into one card per
   protocol; decompose `osi-model` and `troubleshooting-methodology` into
   per-member cards while KEEPING one ordered anchor card each (N10-009
   tests the order itself). 3-4-member closed lists (dhcp-dora, golden
   signals, access modes, job-completion-modes) stay — borderline per the
   audit, and dhcp-dora was just reviewed.
3. **Distinguisher cards (4, additive)**: aws `alb-vs-nlb`, postgres
   `vacuum-vs-analyze`, networking `dot1q-vs-dot1x`, sre `mtbf`. Each pins
   a single contrast axis; grounded in the module's own reviewed
   studyContent/questions or cached docs.
4. **Binary-front rewrites (9)**: postgres/view; networking icmp, vlan,
   wpa3, mtd, dnssec, mfa, evil-twin-on-path, latency-vs-packet-loss —
   rephrase as which/what/why; backs unchanged unless a rewrite forces a
   first-word tweak.
5. **De-template 5 AWS comparison fronts**: control-tower,
   global-accelerator, sns, efs, budgets — each front pins its one
   contrast axis instead of the shared "How is it different from X?".
6. **Two-ask splits (~14)**: only cards where the second ask is an
   independently forgettable discrete fact (numeric-fact-in-sentence-2
   heuristic; known members include aws/acm, aws/kms, aws/savings-plans,
   kubernetes/namespace) — original card keeps the what/why, companion
   card gets the discrete fact. NOT a mass rewrite of all 80 two-ask
   fronts.
7. **AWS scenario cards (~8-10, additive)**: "best fit" mini-scenarios
   ("Fleet of instances needs a shared POSIX file system — which
   service?") mirroring networking's 10% scenario share; grounded in
   existing aws content.

## Explicitly out of scope (audit verdicts)

Shortening prose backs (site-content churn, mostly compliant as
explanation prompts); HTML in exports; per-card date stamps; reversibility
(settled); mass rewrite of all 80 two-ask fronts; a data-layer `domain`
field (future option for better tag granularity).

## Constraints carried from house discipline

Cards double as site content — every data change must keep the site
rendering correctly. New factual claims must be grounded in the module's
own reviewed content or cached docs, with the standard verbatim-copy check
(8+ words, scratch script only). All fronts unique per deck
(case-insensitive) after every task. `validate-content.mjs` green ×5;
export regenerates clean; cross-deck ID uniqueness enforced by module
prefix.
