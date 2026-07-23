# Service-Diagram Architecture Challenge (abstraction rebuild)

**Date:** 2026-07-22
**Status:** Approved direction from user: "update the aws architecture challenge so
it's more abstracted, see images. Challenge questions should be added/removed/updated
as needed." The two reference images are AWS solution diagrams: an EV digital-twin
IoT pipeline (SiteWise / TwinMaker / Timestream / Grafana) and the Data Transfer Hub
(CloudFront / S3 / AppSync / Cognito / Lambda / Step Functions / Fargate / ECR /
DynamoDB).

## What changes

The Architecture Challenge moves one level of abstraction UP: from a VPC resource
builder (subnets, CIDRs, route tables, NAT, security groups, CloudFormation-shaped
cards) to a **service diagram builder** matching how AWS reference architectures are
actually drawn — service boxes and directed data-flow arrows. VPC-level learning
stays covered by the VPC & Subnet Explorer page.

- **Nodes** = AWS services or external actors. Catalog (22 types) grouped by
  category: client (Users, IoT devices), edge (CloudFront, API Gateway, AppSync),
  security (Cognito), compute (Lambda, Fargate, EC2), containers (ECR),
  storage (S3), database (DynamoDB, RDS, Timestream), integration (SQS, SNS,
  Step Functions, EventBridge), IoT (IoT Core, IoT SiteWise, IoT TwinMaker),
  observability (Managed Grafana). Each type carries a study doc (hover).
- **Edges** = directed arrows ("data flows / calls / triggers"). Drawn by dragging
  from a card's connect nub onto another card. No self-loops, no duplicates.
- Node cards have an editable display name (traces use it) and, when the challenge
  defines roles, a role dropdown (same pattern as the old Role tag).

## Checking

Same three-band result panel as before:

1. **Structural** (light now): unknown types / dangling edge endpoints (defensive),
   duplicate display names.
2. **Goals** (functional): declarative list per challenge, each rendered with a
   pass/fail row + trace. Selectors are `{ service: <typeId> }` or `{ role: <roleId> }`.
   - `exists { sel, service?, min? }` — node(s) present; role form checks expected type.
   - `edge { from, to }` — a direct arrow exists (existential over selector members).
   - `linked { a, b }` — an arrow exists in either direction.
   - `noEdge { from, to }` — NO direct arrow between any matching pair (universal).
   - `path { from, to, via: [sel...] }` — a directed path exists passing through all
     `via` selectors in order. Trace lists the hops of the found path, or where the
     flow dead-ends.
   - `fanout { from, min }` — a matching node has ≥ min distinct outgoing arrows.
3. **Best practices** (advisory score, per-challenge selection):
   - `cdn-in-front` — users shouldn't fetch straight from S3 when both exist.
   - `auth-on-public-api` — a users-facing API Gateway/AppSync should link to Cognito.
   - `db-behind-compute` — clients never talk directly to databases.
   - `no-lambda-chaining` — no synchronous Lambda→Lambda arrows; buffer or orchestrate.
   - `no-orphan-nodes` — every placed service participates in at least one arrow.

## Challenge set (replaces the old 8)

1. `static-site` — Users → CloudFront → S3; no direct Users→S3.
2. `serverless-api` — Users → API Gateway → Lambda → DynamoDB; clients never skip tiers.
3. `upload-pipeline` — presigned uploads land in an uploads bucket (pre-wired);
   S3 event → resizer Lambda → thumbnails bucket + metadata table. Roles disambiguate
   the two buckets.
4. `queue-worker` — API intake Lambda → SQS → Fargate worker → RDS; intake must not
   write the DB directly.
5. `fanout-events` — publisher Lambda → SNS → (≥2 queues) → email + analytics
   consumers; durable SNS+SQS fan-out.
6. `webapp-hub` — the Data Transfer Hub image: CloudFront+S3 UI, AppSync API with
   Cognito auth, DynamoDB task state, Lambda → Step Functions provisioning workflow
   → Fargate, ECR image supply. No roles — service types are unambiguous.
7. `iot-twin` — the EV digital-twin image: devices → SiteWise ↔ IoT Core →
   maintenance Lambda → Timestream; TwinMaker linked to SiteWise, S3 (scene assets),
   Grafana; TwinMaker → connector Lambda → Timestream. Two Lambda roles.
8. `fix-diagram` — inherited prototype with planted flaws: UI served straight from
   S3 (insert CloudFront), api Lambda synchronously chained to worker Lambda
   (insert SQS), mobile app reading DynamoDB directly (route through the API).
   Missing Cognito is the advisory-only finding (mirrors the old SG finding).

Plus the free-build Sandbox (all best practices, no goals).

No new challenge reuses a retired VPC-era challenge id (`fix-diagram`, not
`fix-broken`), so stale completion records in localStorage can never pre-mark a
new challenge as done.

## Files

New: `js/lib/svcCatalog.js`, `svcModel.js`, `svcFlow.js`, `svcGoals.js`,
`svcValidate.js` (+ `.test.mjs` each), `js/data/svcChallenges.js` (+ test),
`js/svc-canvas.js`. Rewritten: `js/arch-challenge.js`, `architecture-challenge.html`
styles/copy, `aws/README.md`, `js/views/home.js` blurb.

Deleted (dead once the page stops importing them): `archModel`, `archSimulate`,
`archValidate`, `archGoals`, `archGraph`, `cfnSchema`, `archChallenges`,
`arch-graph-canvas.js` and their tests. `vpcMath` stays (VPC Explorer uses it).

Drift-locked shared files updated in ALL five modules (aws/kubernetes/networking/
postgres/sre): `js/lib/storage.js` (drop arch draft/graph accessors, add
`getSvcGraph`/`setSvcGraph`/`clearSvcGraph` keyed `svc-graph:<id>`, keep
`arch-results` for completion badges), `js/lib/storage.test.mjs`,
`scripts/validate-content.mjs` (validateArchChallenges → validateSvcChallenges,
guarded by existsSync so non-aws modules skip).

Storage note: old `arch-draft:*` / `arch-graph:*` localStorage keys are simply
orphaned; new drafts use a fresh namespace, so no migration is attempted (the old
CFN graphs cannot express service nodes).

## Canvas

Same interaction grammar as the previous builder, simplified: dotted free canvas
(no AZ lanes), cards ~200px with a category accent color, one connect nub pair per
card, S-curve edges with arrowheads, click-to-select card/edge + floating delete
toolbar, Escape cancels, Delete deletes, drag persists positions via onLayout
without invalidating Check results. Auto-layout stacks pos-less nodes into columns
by category (client → edge/security → compute/IoT → integration/containers →
data/observability) so revealed reference solutions read left-to-right like the
AWS diagrams.
