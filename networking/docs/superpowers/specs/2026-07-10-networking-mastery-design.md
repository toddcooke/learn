# Networking (CompTIA Network+ N10-009) Mastery Site

Status: Approved
Date: 2026-07-10

## Purpose

Build a static, local-first website that helps someone learn general
computer networking in depth, organized around the CompTIA Network+
N10-009 exam blueprint — a study guide, a large practice question bank,
flashcards, a timed self-test, and a progress dashboard — following the
same design and architecture as the existing AWS SAA-C03, CKA,
PostgreSQL, and SRE modules (`aws/`, `kubernetes/`, `postgres/`, `sre/`)
in this repo. This is the fifth module in the `learn` monorepo, published
at `https://toddcooke.github.io/learn/networking/`.

## Tied to a real, current certification

Unlike the PostgreSQL and SRE modules, this one **is** built around a
real, currently-active, industry-standard certification — CompTIA
Network+, exam code **N10-009 (V9)**. Confirmed directly from
`comptia.org` and CompTIA's own official exam objectives PDF
("CompTIA Network+ N10-009 Certification Exam: Exam Objectives Version
4.0", copyright 2023 CompTIA, fetched 2026-07-10):

- Launched June 20, 2024; estimated retirement ~2027 (three years after
  launch, per CompTIA's typical refresh cycle).
- Format: **maximum 90 questions** (mix of multiple-choice and
  performance-based/simulation questions), **90 minutes**, **passing
  score 720** on a **100–900 scale**.
- Recommended prerequisites: CompTIA A+ certification, with 9–12 months
  of hands-on experience in a junior network administrator or network
  support technician role.

The home page and mock-exam framing follow the AWS/CKA pattern (state
real exam facts honestly), not the Postgres/SRE "not tied to a
certification" pattern. One honesty note is still required, though: the
real exam includes **performance-based (simulation) questions** this
site cannot replicate — only multiple-choice/multiple-response, matching
every other module's question format. This is disclosed on the home page
and mock-exam start screen, in the same spirit as CKA's disclaimer about
its own real exam being hands-on-only, just softer (Network+'s real exam
does include genuine multiple-choice questions too, unlike CKA's).

## Domain taxonomy and weights

Directly from CompTIA's official exam objectives (not self-authored —
verbatim domain names, weights, and sub-objectives from the source PDF):

| Domain | id | Weight |
|---|---|---|
| Networking Concepts | `concepts` | 23% |
| Network Implementation | `implementation` | 20% |
| Network Operations | `operations` | 19% |
| Network Security | `security` | 14% |
| Network Troubleshooting | `troubleshooting` | 24% |

Official sub-objectives per domain (condensed from the source PDF's
numbered objectives 1.1–5.5; the full objective text and every bulleted
example will be re-fetched/re-read from the cached PDF during
plan-writing and content tasks, not re-typed from memory at that point):

- **1.0 Networking Concepts**: OSI model (1.1); networking
  appliances/applications/functions — routers, switches, firewalls,
  IDS/IPS, load balancers, proxies, NAS/SAN, wireless APs, CDN, VPN, QoS,
  TTL (1.2); cloud concepts — NFV, VPC, security groups, cloud gateways,
  deployment/service models, scalability/elasticity/multitenancy (1.3);
  common ports/protocols/services/traffic types — FTP, SSH, DNS, DHCP,
  HTTP(S), SNMP, LDAP, SMB, RDP, SIP, ICMP/TCP/UDP/GRE/IPSec, unicast/
  multicast/anycast/broadcast (1.4); transmission media/transceivers —
  wireless 802.11/cellular/satellite, wired 802.3/fiber/coax, connectors,
  form factors (1.5); topologies/architectures — mesh, star, spine-leaf,
  three-tier, collapsed core, N-S/E-W traffic flows (1.6); IPv4
  addressing — public/private, APIPA, RFC1918, subnetting/VLSM/CIDR,
  address classes (1.7); evolving use cases — SDN/SD-WAN, VXLAN, zero
  trust, SASE/SSE, infrastructure as code, IPv6 (1.8).
- **2.0 Network Implementation**: routing technologies — static/dynamic
  (BGP/EIGRP/OSPF), route selection, NAT/PAT, FHRP, VIP (2.1); switching
  — VLANs, SVI, 802.1Q tagging, link aggregation, spanning tree, MTU/
  jumbo frames (2.2); wireless devices — channels, frequency bands,
  SSID/BSSID, network types, WPA2/WPA3, guest networks, PSK/Enterprise
  auth, antennas (2.3); physical installation — IDF/MDF, rack size,
  cabling/patch panels, power (UPS/PDU), environmental factors (2.4).
- **3.0 Network Operations**: organizational processes — documentation
  (diagrams, asset inventory, IPAM, SLA), life-cycle/change/configuration
  management (3.1); network monitoring — SNMP, flow data, packet
  capture, log aggregation/SIEM, port mirroring, network discovery (3.2);
  disaster recovery — RPO/RTO/MTTR/MTBF, DR sites, HA approaches, testing
  (3.3); IPv4/IPv6 network services — DHCP, SLAAC, DNS record types/zone
  types/DNSSEC/DoH/DoT, NTP/PTP (3.4); network access/management — site-
  to-site/client-to-site VPN, SSH/GUI/API/console, jump box, in-band vs.
  out-of-band (3.5).
- **4.0 Network Security**: basic security concepts — encryption, PKI,
  IAM/authentication (MFA/SSO/RADIUS/LDAP/SAML/TACACS+), physical
  security, deception tech, CIA triad, PCI DSS/GDPR, segmentation
  (IoT/SCADA/ICS/OT/BYOD) (4.1); attack types — DoS/DDoS, VLAN hopping,
  MAC flooding, ARP/DNS poisoning/spoofing, rogue devices, evil twin,
  on-path, social engineering, malware (4.2); security features/defense
  — device hardening, NAC (802.1X/MAC filtering), key management, ACLs/
  URL/content filtering, zones (4.3).
- **5.0 Network Troubleshooting**: troubleshooting methodology — the
  7-step CompTIA process (identify problem → establish theory → test
  theory → plan of action → implement → verify → document) (5.1);
  cabling/physical interface issues — cable types/categories, signal
  degradation, improper termination, interface counters/CRC, PoE,
  transceivers (5.2); network services issues — STP loops, VLAN
  assignment, ACLs, routing table issues, DHCP/gateway/IP/subnet
  problems (5.3); performance issues — congestion, bandwidth, latency,
  packet loss, jitter, wireless interference/coverage/roaming (5.4);
  tools/protocols — software tools (protocol analyzer, `ping`,
  `traceroute`, `nslookup`, `dig`, `tcpdump`, `nmap`, LLDP/CDP), hardware
  tools (toner, cable tester, Wi-Fi analyzer), device commands (`show
  mac-address-table`, `show route`, etc.) (5.5).

## Source of truth for content

Unlike every prior module, there is no single official documentation
site to source from (no `docs.provider.com` equivalent — CompTIA doesn't
publish a free study reference). Content is grounded using a **tiered
sourcing strategy**, confirmed reachable as of 2026-07-10:

1. **IETF RFCs** (`rfc-editor.org`, free, authoritative) for anything
   tied to an actual internet protocol — e.g. `rfc-editor.org/rfc/rfc791`
   (IP), `rfc-editor.org/rfc/rfc1035` (DNS), `rfc-editor.org/rfc/rfc2131`
   (DHCP) — all confirmed reachable.
2. **NIST Special Publications** (`csrc.nist.gov`, free, authoritative)
   for security/continuity concepts without a specific protocol RFC —
   e.g. `csrc.nist.gov/pubs/sp/800/63/b/upd2/final` (authentication),
   `csrc.nist.gov/pubs/sp/800/34/r1/final` (contingency planning/DR) —
   both confirmed reachable.
3. **Cisco's free public documentation** (`cisco.com`) for vendor/
   hardware-oriented implementation topics (VLANs, routing protocol
   configuration, wireless) where RFCs are too dry for study purposes —
   e.g. `cisco.com/c/en/us/support/docs/lan-switching/vlan/10023-3.html`,
   confirmed reachable. Explicitly disclosed in study content as vendor
   documentation used for pedagogical clarity, not treated as
   equal-authority to RFCs/NIST, and not implying the exam is
   Cisco-specific.
4. **Official man pages / tool docs** (`man7.org`, `nmap.org`) for the
   CLI tools in the troubleshooting domain — e.g.
   `man7.org/linux/man-pages/man8/traceroute.8.html`,
   `nmap.org/book/man.html`, both confirmed reachable.

`scripts/fetch-doc.mjs`'s existing generic HTML-stripping fallback will
be used against all four source types, same as every prior module — but
extraction quality is expected to vary more than prior modules (a single
homogeneous doc site produces predictable extraction; four heterogeneous
source types will not). This will be verified per-domain during content
tasks, same discipline as every prior module's "test the fallback
against a real page" step, just applied per-source-type here instead of
once.

## Architecture: reuse, not rebuild

Same content-agnostic application layer as the four sibling modules.
Built directly as a new sibling subdirectory, `networking/`, inside the
existing monorepo checkout — no separate repo, no `git subtree` import,
no new deployment wiring. A single push to `main` is sufficient.

### Copy-source guidance

- **`scripts/validate-content.mjs` copies from `kubernetes/`, not
  `postgres/`/`sre/`.** This module has exactly 5 domains — the same
  count as CKA — so copying from `kubernetes/` needs **zero edits** to
  the domain-count check (it already reads `DOMAINS.length === 5`),
  mirroring the exact optimization discovered when Postgres/SRE (both
  6-domain modules) copied from each other. Confirm this, don't assume
  it — a prior module's plan stated a zero-edit expectation and it did
  turn out to be zero edits, but that was verified at implementation
  time, not assumed at design time.
- **`js/views/mockExam.js` copies from `sre/`, not `aws/`.** `sre/`'s
  copy already has the `estimateScaledScore()` fix (explicit
  `{minScore, maxScore}` options) — required here too, since this
  module's `maxScore` (900) differs from `scoring.js`'s default (1000)
  even though `minScore` (100) matches the default. Only the
  results-screen text needs rewriting — not to SRE's "not tied to a
  certification" wording (this module *is* tied to one), but to
  something closer to AWS's original framing: real exam facts plus "the
  real scoring/scaled-score formula isn't published."
- **`js/views/home.js` uses `aws/`'s or `kubernetes/`'s home view as its
  structural template** (real exam facts, not postgres/sre's "not a
  certification" framing) — adapted for Network+'s specific facts and
  the performance-based-questions honesty note.
- Every other file (`css/style.css`, `js/app.js`, `js/lib/storage.js`
  pattern, `js/lib/scoring.js`, `js/views/{studyGuide,quiz,flashcards,
  progress}.js`, `scripts/fetch-doc.mjs`) is identical across all four
  existing modules — source doesn't matter, pick any.

### Local doc cache

Same as every prior module: `.cache/aws-docs/<slug>.md`, gitignored at
the repo root (already covers this subdirectory).

## Data shapes

```js
// data/examInfo.js
export const DOMAINS = [
  { id: 'concepts', name: 'Networking Concepts', weight: 23, mockExamCount: 21 },
  { id: 'implementation', name: 'Network Implementation', weight: 20, mockExamCount: 18 },
  { id: 'operations', name: 'Network Operations', weight: 19, mockExamCount: 17 },
  { id: 'security', name: 'Network Security', weight: 14, mockExamCount: 12 },
  { id: 'troubleshooting', name: 'Network Troubleshooting', weight: 24, mockExamCount: 22 },
];
export const EXAM_FORMAT = {
  totalQuestions: 90, // matches the real exam's max question count
  durationMinutes: 90, // matches the real exam's time limit
  passingScore: 720, // matches the real exam's passing score
  minScore: 100,
  maxScore: 900, // matches the real exam's 100-900 scale
};
```

`DOMAINS[].weight` sums to 100 (the real exam's official percentages);
`DOMAINS[].mockExamCount` sums to 90 (`EXAM_FORMAT.totalQuestions`),
apportioned from the weights via largest-remainder rounding. This is the
first module whose `EXAM_FORMAT` numbers are the *real* exam's own
numbers throughout (question count, duration, passing score, and scale
all match N10-009 exactly) — a level of authenticity only possible
because, unlike Postgres/SRE, a real exam format actually exists to
mirror.

`js/lib/storage.js`'s `NAMESPACE` constant must be `'net-prep'` —
distinct from `saa-prep`/`cka-prep`/`pg-prep`/`sre-prep`, since all five
modules will share the `toddcooke.github.io` origin.

## Content pipeline

Same adversarial-verification approach and all three mandatory
integrity checks (verbatim-copying, answer-length-balance,
answer-position-balance) from task 1, per every prior module's
established discipline.

Target volume: **100 practice questions as domain floors** (23, 20, 19,
14, 24 — matching weights as counts, summing to exactly 100), not an
exact target — per the process fix Postgres's final review established
(a prior module's Global Constraints said "exactly 100" while every task
said "at least N," an inconsistency this and future modules avoid by
only ever stating floors). ~65-70 card flashcard deck covering core
Network+ vocabulary spanning all 5 domains (OSI layer names, TCP/UDP,
common protocols and their ports, VLAN, subnetting/CIDR terms, routing
protocol names, DR metrics, security terms, attack types, CLI tools,
etc.).

## Features

Identical five to every prior module — study guide, domain quizzes,
flashcards, practice exam (90Q/90min/100-900 scale/720 passing,
performance-based-questions honesty note), progress dashboard
(`localStorage` namespaced `net-prep:`).

## Verification approach

Same as every prior module: adversarial content-verification pass with
all three integrity checks, plus a manual end-to-end browser walkthrough
before calling the build done. Given this module's `EXAM_FORMAT` uses a
non-default scale (100–900) exactly like Postgres/SRE did (0–100), the
controller will personally live-check the mock-exam scoring boundary
(0/90 → 100, 90/90 → 900) after the views task, the same discipline
applied to every prior module.

## Explicitly out of scope

- No performance-based/simulation question type — every question in
  this site's bank is multiple-choice or multiple-response, like every
  prior module; the home page and mock-exam screens disclose this gap
  honestly rather than attempting to simulate it.
- No backend, no build tooling, no external services.
- No new deployment/hosting work — building inside the existing
  monorepo and pushing to `main` is the entire deployment step.
- No user accounts/auth — all state is local to the browser via
  `localStorage`.
