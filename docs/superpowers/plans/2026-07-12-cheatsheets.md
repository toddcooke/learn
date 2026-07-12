# Printable Cheatsheets Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** One printable single-page cheatsheet per module (`<module>/cheatsheet.html` ×5), each fitting on ONE printed page (US Letter AND A4), distilled from that module's own reviewed study content, linked from the module home page and README.

**Architecture:** Standalone static pages (pure HTML + inline CSS, no JS) — same pattern as `aws/vpc-explorer.html`; the shared router stays untouched and `check-drift.mjs` stays green. Content is per-module (legitimately divergent, like `home.js`).

## Global Constraints

- **The one-page contract:** content box ≤ 7.4in wide × 10.2in tall (fits Letter 8.5×11 and A4 210×297 with 0.4in margins). Every sheet ships with: `@page { size: letter portrait; margin: 0.4in; }`, a `.sheet` root element whose screen rendering mirrors print (fixed `width: 7.4in`), `@media print` rules that hide the on-screen header/back-link and force `print-color-adjust: exact` only where needed (prefer grayscale-safe styling — borders and weight, not color, carry meaning on paper).
- **Fit verification is mandatory and measured, not eyeballed:** in the browser at default zoom, `document.querySelector('.sheet').scrollHeight` must be ≤ 979px (10.2in × 96dpi) and `scrollWidth` ≤ 711px (7.4in). Record the measured numbers per sheet in the task report. If content overflows: cut content, don't shrink below 7.5px font.
- **Content is distilled, never invented:** every fact must come from the module's own `js/data/studyContent.js`, `questions.js` explanations, or `flashcards.js`. No new claims. Verbatim reuse of short factual fragments (numbers, names, port lists) is expected and fine here — this is the module's own content restated; the 8-word rule does not apply to self-summarization, but do not copy whole prose sentences (space forbids it anyway).
- Prioritize what a cheatsheet is FOR: tables of exact values (ports, wattages, AD values, limits, quotas), decision discriminators (X vs Y one-liners), ordered lists that must be memorized (OSI layers, methodology stages), formulas. NO prose paragraphs.
- Layout: 2 or 3 columns (CSS columns or grid), compact tables, section headings ≤ 3 words, base font 8-9.5px print, monospace for numbers/CIDRs/commands.
- Each page: title bar with module name + exam id (real certs) or "quick reference" (postgres/sre), a footer line "toddcooke.github.io/learn/<module> — generated from the module's study content".
- Links: `<module>/js/views/home.js` gains a "Printable cheatsheet" link next to the existing extras; `<module>/README.md` one line. (aws home already links the VPC explorer — add alongside.)
- After every task: `node scripts/check-drift.mjs` green; touched module's validator + tests green.

---

### Task 1: aws cheatsheet — establishes the template

**Files:** Create `aws/cheatsheet.html`; modify `aws/js/views/home.js`, `aws/README.md`.

- [ ] Read `aws/js/data/studyContent.js` + `flashcards.js`; distill the SAA-C03 sheet. Must-have sections (adjust to fit): storage-class decision table (S3 tiers + Glacier retrieval times); load balancer discriminators (ALB/NLB/GWLB one-liners); RDS/Aurora/DynamoDB/ElastiCache picks; VPC numbers (CIDR /16–/28, 5 reserved IPs, NAT-per-AZ rule, endpoint types); IAM one-liners (identity vs resource policy, SCP caps-not-grants, STS); KMS rotation facts; EC2 purchase options with % ranges; the 4 exam domains + weights; scaling/decoupling picks (SQS/SNS/EventBridge if in content).
- [ ] Build the page with the Global Constraints' print scaffolding; verify fit by measurement (record numbers); print-preview sanity via the measured mirror.
- [ ] Link from home.js + README. Drift check, aws tests+validator. Commit: `git commit -m "Add printable one-page aws cheatsheet"`.

### Task 2: kubernetes + networking cheatsheets

**Files:** Create `kubernetes/cheatsheet.html`, `networking/cheatsheet.html`; modify both `home.js` + READMEs.

- [ ] Copy Task 1's scaffolding (view-source the aws sheet for the CSS skeleton; content differs). kubernetes must-haves: control-plane components one-liners; workload kinds table (Deployment/StatefulSet/DaemonSet/Job/CronJob); Service types; PV/PVC/StorageClass + access modes; requests vs limits + QoS classes; taints/tolerations vs affinity; probe types; kubectl verbs for troubleshooting; NodePort range; CKA domains + weights.
- [ ] networking must-haves: the port table (all ports the deck teaches: 20/21, 22, 23, 25, 53, 67/68, 69, 80, 110, 123, 143, 161/162, 389, 443, 445, 587, 636, 993, 995, 1433, 1521, 3306, 3389, 5060/5061, 853 — include exactly those the module actually covers); OSI 7 layers ordered with one-word jobs; private ranges + APIPA; AD values; PoE wattage table; Cat5e/6/6a speeds-distances; 2.4GHz channels 1/6/11; WPA2 vs WPA3; DoT/DoH ports; RTO/RPO/MTBF/MTTR one-liners; troubleshooting methodology ordered; N10-009 domains + weights.
- [ ] Same fit measurement + links + checks per module. Commit: `git commit -m "Add printable cheatsheets for kubernetes and networking"`.

### Task 3: postgres + sre cheatsheets

**Files:** Create `postgres/cheatsheet.html`, `sre/cheatsheet.html`; modify both `home.js` + READMEs.

- [ ] postgres must-haves: MVCC/VACUUM/ANALYZE one-liners; index types decision table (btree/hash/GIN/GiST/BRIN); isolation levels + anomalies table; WAL/checkpoint facts; replication modes; key config knobs (shared_buffers 25%/40% guidance, work_mem, autovacuum); EXPLAIN scan types; lock levels if in content; module domains.
- [ ] sre must-haves: SLI/SLO/SLA ladder; error budget = 100% − SLO (+ downtime table for 99.9/99.95/99.99 if in content); burn-rate thresholds (14.4x/1h, 6x/6h, 1x/3d); golden signals; MTTR/MTBF/RTO/RPO; incident roles; DR site types; release patterns (canary/blue-green/feature flags); toil definition; module domains.
- [ ] Same fit measurement + links + checks. Commit: `git commit -m "Add printable cheatsheets for postgres and sre"`.

### Task 4: Final verification + review + push

- [ ] All 5 sheets: measured fit numbers re-confirmed; links work from each home page; drift check; tests+validators ×5; grep each sheet's facts sample (10 per sheet) against module content (reviewer duty).
- [ ] Final review (opus) over the whole range: fact-checks each sheet against its module's content adversarially + fit + print CSS sanity. Fix loop if needed. Push; CI green; trigger site sync; curl each live cheatsheet URL.
