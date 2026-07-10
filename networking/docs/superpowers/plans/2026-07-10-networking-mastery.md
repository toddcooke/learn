# Networking (CompTIA Network+ N10-009) Mastery Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, locally-served website that teaches general computer networking organized around the real CompTIA Network+ N10-009 exam blueprint — a study guide across the 5 official domains, a 100+ question practice bank, flashcards, a timed self-test mirroring the real exam's own format, and a progress dashboard — as the fifth learning module in the `learn` monorepo, alongside `aws/`, `kubernetes/`, `postgres/`, `sre/`.

**Architecture:** Reuses the sibling modules' entire application layer verbatim — router, base styles, storage/scoring libraries, content-tooling scripts. Only content data files, the home view's copy, and one wording edit to the mock exam view are new. Unlike Postgres/SRE, this module IS tied to a real, current, industry-standard certification with a real published blueprint (like AWS/CKA), so domains/weights/format come directly from CompTIA's own exam objectives PDF rather than being self-authored. Content is sourced via a tiered strategy (IETF RFCs, NIST Special Publications, Cisco's free public documentation, official man pages) since — unlike every prior module — there is no single official docs site for this content.

**Tech Stack:** Identical to every sibling module: vanilla HTML/CSS/JS, no build step, no npm.

## Global Constraints

- **This project's own working directory is `/Users/toddcooke/IdeaProjects/learn_aws/networking`.** All file paths in this plan are relative to that directory unless given as a `../aws/`, `../kubernetes/`, `../postgres/`, or `../sre/` sibling-copy source path. This is a subdirectory of the `learn_aws` git repository — `git add`/`git commit` work fine from inside `networking/`. A single push to `main` is the entire deployment step.
- **No per-module `.gitignore` needed.** The repo root's `.gitignore` already matches `.cache/`/`.worktrees/` at any depth.
- **No npm/build tooling of any kind.**
- Served via `python3 -m http.server`. A working preview config named `networking-site` (port 8004) already exists in the repo root's `.claude/launch.json` — use `preview_start` with name `networking-site`.
- **Node version note:** this environment runs Node v25.5.0, where `node --test js/lib` (bare directory) fails. Use `node --test "js/lib/*.test.mjs"` instead.
- All exam content lives in `js/data/*.js` as ES module exports.
- Every question must satisfy `node scripts/validate-content.mjs` and be adversarially verified against cached source documentation.
- **Every question and study-content topic must satisfy all of these, mandatory in every content task, not an afterthought:**
  1. **Verbatim copying** — 8+ consecutive words matching a cached source doc. Reword any hit. Sanity-check the checker with a planted violation before trusting a "0 hits" result. Write the checker as a SCRATCH script only — do NOT commit a checker script to the repo (a prior module's task mistakenly did this and it had to be removed in a follow-up fix).
  2. **Answer-length balance** — correct MC option must not be the single longest option in a majority of questions.
  3. **Answer-position balance, checked SEPARATELY for MC and MR** — MC: no index >40% of a domain's questions. MR: correct-index sets must not cluster at the same 1-2 positions (a prior module had every MR question in a domain land at exactly `[0,1]`, found only by that task's reviewer). Avoid a rigid repeating cycle even when aggregate counts are balanced.
  4. **Explanations describe distractors by content, never ordinal position** ("the option claiming X is false," not "option 3 is false") — makes explanations immune to later reshuffling for position balance.
- **Total practice question bank must reach a MINIMUM of 100**, as per-domain FLOORS matching the real exam's own weights as counts: Networking Concepts ≥ 23, Network Implementation ≥ 20, Network Operations ≥ 19, Network Security ≥ 14, Network Troubleshooting ≥ 24. Overshooting any floor is expected and fine — state floors only, never "exactly N" (an inconsistency a prior module's Global Constraints introduced and its final review had to reconcile).
- `js/lib/storage.js`'s `NAMESPACE` constant must be `'net-prep'` — distinct from every sibling module's namespace, since all five modules share the `toddcooke.github.io` origin.
- **`scripts/validate-content.mjs` must be copied from `../kubernetes/scripts/validate-content.mjs`.** This module has exactly 5 domains — the same count as CKA — so its domain-count check should already read `DOMAINS.length === 5` with **no edit needed**. Verify this, don't assume it.
- **`js/views/mockExam.js` must be copied from `../sre/js/views/mockExam.js`, NOT `../aws/`'s.** `sre/`'s copy already has the `estimateScaledScore()` fix (explicit `{minScore, maxScore}` options) — required here too, since this module's `maxScore` (900) differs from `scoring.js`'s default (1000) even though `minScore` (100) happens to match the default. **Only the results-screen text needs rewriting** — NOT to `sre/`'s "not tied to a certification" wording (this module IS tied to a real, current certification), but to wording closer to AWS's original framing: state the real exam facts, note the real scaled-score formula isn't published, and disclose that the real exam also includes performance-based (simulation) questions this site's multiple-choice/multiple-response format doesn't replicate.
- **`js/views/home.js` uses `../kubernetes/js/views/home.js`'s structure as a template** (it already has the `.exam-note` disclaimer-paragraph pattern this module also needs) — but with **real exam facts, not CKA's "100% hands-on" framing**: N10-009, max 90 questions, 90 minutes, passing score 720 on a 100–900 scale, recommended prerequisites (CompTIA A+ + 9–12 months experience), plus the performance-based-questions honesty note.
- Every other file (`css/style.css`, `js/app.js`, `js/lib/storage.js` pattern, `js/lib/scoring.js`, `js/views/{studyGuide,quiz,flashcards,progress}.js`, `scripts/fetch-doc.mjs`) is identical across every sibling module — source doesn't matter, pick any (this plan uses `../sre/` throughout for consistency, since it's the most recently built).
- Content is sourced via a **tiered strategy**, confirmed reachable 2026-07-10 (no single official docs site exists for this content, unlike every prior module):
  1. **IETF RFCs** (`rfc-editor.org/rfc/rfcNNNN`) for anything tied to an actual internet protocol.
  2. **NIST Special Publications** (`csrc.nist.gov/pubs/...`) for security/continuity concepts without a specific protocol RFC.
  3. **Cisco's free public documentation** (`cisco.com/...`) for vendor/hardware-oriented implementation topics where RFCs are too dry for study purposes — explicitly disclosed in content as vendor documentation, not equal-authority to RFCs/NIST, and not implying the exam is Cisco-specific.
  4. **Official man pages** (`man7.org/linux/man-pages/...`) or **tool docs** (`nmap.org/book/...`) for CLI troubleshooting tools.
  Some sub-topics (OSI model layers, rack units, TIA/EIA cabling standards, CompTIA's own 7-step troubleshooting methodology, generic tool-category vocabulary) have **no single canonical free source** in any tier — this is confirmed during planning research, not a task-time surprise. Where a task brief says a sub-topic has no citable source, write it as standard, well-established networking vocabulary rather than forcing a bad-fit citation.
- No user accounts, auth, or backend. All persistence is `localStorage`, namespaced `net-prep:`.
- Every doc page fetched must go through `scripts/fetch-doc.mjs` (checks `.cache/aws-docs/index.json` first).
- Reference spec: [docs/superpowers/specs/2026-07-10-networking-mastery-design.md](../specs/2026-07-10-networking-mastery-design.md).

---

## Task 1: Project scaffold — shell, router, base styles, view stubs

**Files:**
- Create: `index.html` (new content)
- Copy from `../sre/`: `css/style.css`, `js/app.js` (unchanged; source doesn't matter, identical across siblings)
- Create: `js/views/home.js`, `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/mockExam.js`, `js/views/progress.js` (stubs)
- Create: `README.md` (stub)

**Interfaces:**
- Produces: every `js/views/*.js` module exports `function render(mount, ...params)`.

- [ ] **Step 1: Copy the router and base styles unchanged**

```bash
mkdir -p js/views js/data js/lib css scripts
cp ../sre/js/app.js js/app.js
cp ../sre/css/style.css css/style.css
```

Run: `diff ../sre/js/app.js js/app.js && diff ../sre/css/style.css css/style.css`
Expected: no output.

- [ ] **Step 2: Create the six view stub modules**

Each of `js/views/home.js`, `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/mockExam.js`, `js/views/progress.js` gets this content:

```js
// js/views/home.js
export function render(mount) {
  mount.innerHTML = '<p>Coming soon.</p>';
}
```

(Repeat verbatim for the other five files.)

- [ ] **Step 3: Create the HTML shell**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>Network+ N10-009 Prep</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="site-header">
    <h1>CompTIA Network+ (N10-009) Prep</h1>
    <nav id="nav">
      <a href="#/" data-view="home">Home</a>
      <a href="#/study" data-view="study">Study Guide</a>
      <a href="#/quiz" data-view="quiz">Quizzes</a>
      <a href="#/flashcards" data-view="flashcards">Flashcards</a>
      <a href="#/exam" data-view="exam">Mock Exam</a>
      <a href="#/progress" data-view="progress">Progress</a>
    </nav>
  </header>
  <main id="app-content"></main>
  <footer class="site-footer">
    <p>Unofficial study aid. Not affiliated with or endorsed by CompTIA.</p>
  </footer>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

(Nav says "Mock Exam" — unlike Postgres/SRE, this module's real exam does include genuine multiple-choice questions, so "mock exam" isn't misleading the way it would be for a 100%-hands-on exam; this also matches AWS's and CKA's nav wording.)

- [ ] **Step 4: Create the README stub**

```markdown
# CompTIA Network+ (N10-009) Prep

An unofficial study site for the CompTIA Network+ certification (exam N10-009). Not affiliated with or endorsed by CompTIA.

Status: under construction.
```

- [ ] **Step 5: Verify in the browser**

Start the server (`preview_start` with name `networking-site`), load `http://localhost:8004/`.

Expected: page loads with the header "CompTIA Network+ (N10-009) Prep", nav links, "Coming soon." in the content area, hash-based navigation working, no console errors.

- [ ] **Step 6: Commit**

```bash
git add index.html css/style.css js/app.js js/views README.md
git commit -m "Add networking site scaffold: shell, router (copied from sre/), base styles, view stubs"
```

---

## Task 2: Core infrastructure — exam data, storage, scoring, and content tooling

**Files:**
- Create: `js/data/examInfo.js`
- Copy from `../sre/`, then edit: `js/lib/storage.js` (NAMESPACE change)
- Copy from `../sre/` unchanged: `js/lib/storage.test.mjs`, `js/lib/scoring.js`, `js/lib/scoring.test.mjs`, `scripts/fetch-doc.mjs`
- Copy from `../kubernetes/` unchanged (verify, don't assume): `scripts/validate-content.mjs`

**Interfaces:**
- Produces: `DOMAINS` (array of `{id, name, weight, mockExamCount}`, **5 entries**) and `EXAM_FORMAT` (`{totalQuestions, durationMinutes, passingScore, minScore, maxScore}`) from `js/data/examInfo.js`.
- Produces: `createStore`, namespaced `'net-prep'`. `isCorrect`, `estimateScaledScore`, `drawMockExam` — identical signatures to every sibling module.

- [ ] **Step 1: Write the exam info data**

```js
// js/data/examInfo.js
export const DOMAINS = [
  { id: 'concepts', name: 'Networking Concepts', weight: 23, mockExamCount: 21 },
  { id: 'implementation', name: 'Network Implementation', weight: 20, mockExamCount: 18 },
  { id: 'operations', name: 'Network Operations', weight: 19, mockExamCount: 17 },
  { id: 'security', name: 'Network Security', weight: 14, mockExamCount: 12 },
  { id: 'troubleshooting', name: 'Network Troubleshooting', weight: 24, mockExamCount: 22 },
];

export const EXAM_FORMAT = {
  totalQuestions: 90, // matches the real N10-009's max question count
  durationMinutes: 90, // matches the real exam's time limit
  passingScore: 720, // matches the real exam's passing score
  minScore: 100,
  maxScore: 900, // matches the real exam's 100-900 scale
};
```

(`weight` sums to 100 — these are the real official CompTIA percentages, not self-authored. `mockExamCount` sums to 90, matching `EXAM_FORMAT.totalQuestions`. Every number in `EXAM_FORMAT` matches the real N10-009 exam exactly — the first module where this is possible, since a real exam format exists to mirror.)

- [ ] **Step 2: Copy the storage library and fix the namespace**

```bash
cp ../sre/js/lib/storage.js js/lib/storage.js
cp ../sre/js/lib/storage.test.mjs js/lib/storage.test.mjs
```

Open `js/lib/storage.js` and change:

```js
const NAMESPACE = 'sre-prep';
```

to:

```js
const NAMESPACE = 'net-prep';
```

Only this line should differ from `sre/`'s copy.

Run: `node --test js/lib/storage.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 3: Copy the scoring library and its test unchanged**

```bash
cp ../sre/js/lib/scoring.js js/lib/scoring.js
cp ../sre/js/lib/scoring.test.mjs js/lib/scoring.test.mjs
```

Run: `diff ../sre/js/lib/scoring.js js/lib/scoring.js`
Expected: no output.

Run: `node --test js/lib/scoring.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 4: Copy the doc-fetch cache script unchanged**

```bash
cp ../sre/scripts/fetch-doc.mjs scripts/fetch-doc.mjs
```

Run: `node scripts/fetch-doc.mjs https://www.rfc-editor.org/rfc/rfc791`
Expected: prints a path under `.cache/aws-docs/`, cached file contains readable text about the Internet Protocol (the generic HTML-stripping fallback already proven against four other doc types in prior modules). Running the same command again is a near-instant cache hit.

- [ ] **Step 5: Copy the content validator and verify the domain count**

```bash
cp ../kubernetes/scripts/validate-content.mjs scripts/validate-content.mjs
```

Open `scripts/validate-content.mjs` and find this line inside `validateExamInfo()`:

```js
  check(Array.isArray(DOMAINS) && DOMAINS.length === 5, 'DOMAINS must have exactly 5 entries');
```

Confirm it already reads `5` (this module also has exactly 5 domains, matching `kubernetes/`'s count) — no edit needed. If it reads a different number for any reason, change it to `5` and note the discrepancy in your report.

Run: `node scripts/validate-content.mjs`
Expected: `studyContent.js not present yet, skipping`, `questions.js not present yet, skipping`, `flashcards.js not present yet, skipping`, then `All content validated successfully.`

- [ ] **Step 6: Commit**

```bash
git add js/data/examInfo.js js/lib/storage.js js/lib/storage.test.mjs js/lib/scoring.js js/lib/scoring.test.mjs scripts/fetch-doc.mjs scripts/validate-content.mjs
git commit -m "Add exam data, storage (namespaced net-prep)/scoring libs, and content tooling"
```

---

## Task 3: Home view

**Files:**
- Modify: `js/views/home.js`

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js` (Task 2).

New content, structured like `kubernetes/`'s home view (which already has the `.exam-note` disclaimer pattern) but with this module's own real facts — this module IS tied to a real, current certification, so the framing states real exam facts honestly (like AWS/CKA), not a "not tied to a certification" note.

- [ ] **Step 1: Replace the stub with the real home view**

```js
// js/views/home.js
import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About the Exam</h2>
      <p>CompTIA Network+ (N10-009)</p>
      <ul class="exam-facts">
        <li>Real exam: maximum ${EXAM_FORMAT.totalQuestions} questions (multiple-choice and performance-based), ${EXAM_FORMAT.durationMinutes} minutes</li>
        <li>Scaled score ${EXAM_FORMAT.minScore}–${EXAM_FORMAT.maxScore}, passing score ${EXAM_FORMAT.passingScore}</li>
        <li>Recommended: CompTIA A+ certification, with 9–12 months of hands-on experience in a junior network administrator or network support technician role</li>
      </ul>
      <p class="exam-note">Heads up: the real N10-009 exam also includes performance-based (simulation) questions — this site's quizzes and mock exam (${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes) are multiple-choice/multiple-response only and don't replicate those simulations. Pair this with hands-on lab practice (e.g. Cisco Packet Tracer or GNS3) for genuine exam readiness.</p>
      <h3>Domains</h3>
      <ul class="domain-list">
        ${DOMAINS.map((d) => `<li><a href="#/study/${d.id}">${d.name}</a> — ${d.weight}%</li>`).join('')}
      </ul>
      <h3>How to use this site</h3>
      <ol>
        <li>Read the <a href="#/study">Study Guide</a> for each domain.</li>
        <li>Test yourself with <a href="#/quiz">domain quizzes</a>.</li>
        <li>Drill weak spots with <a href="#/flashcards">flashcards</a>.</li>
        <li>Simulate exam day with the <a href="#/exam">mock exam</a>.</li>
        <li>Track improvement on the <a href="#/progress">progress dashboard</a>.</li>
      </ol>
    </section>
  `;
}
```

(`.exam-note`, `.home`, `.exam-facts`, `.domain-list` are existing unstyled classes from the copied `css/style.css` — no CSS changes needed.)

- [ ] **Step 2: Verify in the browser**

Reload `http://localhost:8004/#/`. Expected: real exam facts (max 90 questions, 90 minutes, 100–900 scale, passing 720, A+ prerequisite note), the performance-based-questions disclaimer, and all 5 domains with weights (23/20/19/14/24) render. Domain links navigate to `#/study/<id>` (still "Coming soon" until Task 15).

- [ ] **Step 3: Commit**

```bash
git add js/views/home.js
git commit -m "Implement home view with real N10-009 exam facts and performance-based-question disclaimer"
```

---

## Task 4: Networking Concepts — study content

**Files:**
- Create: `js/data/studyContent.js`

**Interfaces:**
- Consumes: `domain: 'concepts'` id from `js/data/examInfo.js`.
- Produces: `STUDY_CONTENT` array.

This domain (23% weight, official CompTIA objective 1.0) covers: OSI model; networking appliances/applications/functions; cloud concepts; common ports/protocols/services/traffic types; transmission media/transceivers; network topologies; IPv4 addressing; evolving use cases (SDN/SD-WAN, zero trust, IPv6).

- [ ] **Step 1: Fetch supporting docs**

Fetch via `node scripts/fetch-doc.mjs <url>` (all verified live during planning; if any 404s, WebSearch for the current URL):

```
https://www.ciscopress.com/articles/article.asp?p=3192417&seqNum=6
https://www.cisco.com/site/us/en/learn/topics/small-business/what-is-a-router.html
https://www.cisco.com/site/us/en/learn/topics/security/what-is-a-firewall.html
https://www.rfc-editor.org/rfc/rfc791
https://csrc.nist.gov/pubs/sp/800/145/final
https://www.rfc-editor.org/rfc/rfc959
https://www.rfc-editor.org/rfc/rfc1035
https://www.rfc-editor.org/rfc/rfc2131
https://www.rfc-editor.org/rfc/rfc9110
https://www.rfc-editor.org/rfc/rfc792
https://www.rfc-editor.org/rfc/rfc9293
https://www.rfc-editor.org/rfc/rfc768
https://www.rfc-editor.org/rfc/rfc1112
https://www.rfc-editor.org/rfc/rfc919
https://www.rfc-editor.org/rfc/rfc4291
https://www.cisco.com/site/us/en/learn/topics/networking/what-is-ethernet.html
https://www.cisco.com/site/us/en/learn/topics/networking/what-is-wi-fi.html
https://www.cisco.com/site/us/en/learn/topics/networking/what-is-network-topology.html
https://www.rfc-editor.org/rfc/rfc1918
https://www.rfc-editor.org/rfc/rfc3927
https://www.rfc-editor.org/rfc/rfc4632
https://csrc.nist.gov/pubs/sp/800/207/final
https://www.rfc-editor.org/rfc/rfc7348
https://www.rfc-editor.org/rfc/rfc8200
```

**Known gaps, confirmed during planning — do not spend time searching for a source for these, cite them as standard vocabulary instead:** the OSI model has no free RFC/NIST/cisco.com source (it's ISO/IEC 7498-1, paywalled — the Cisco Press article above is the best available stand-in); SMB and RDP are Microsoft proprietary protocols with no RFC; VPC/security-groups are AWS/Azure/GCP vendor terms (use NIST SP 800-145 for the general cloud-model framing only); satellite transmission media has no citable source (standard vocabulary: GEO/MEO/LEO, ~500-600ms round-trip for GEO).

- [ ] **Step 2: Write study notes grounded in the fetched docs**

Create `js/data/studyContent.js` with 4 sections for `domain: 'concepts'`, each with 3-6 `{title, body}` topics:

```js
// js/data/studyContent.js
export const STUDY_CONTENT = [
  {
    domain: 'concepts',
    taskStatement: 'Foundations: OSI Model & Network Appliances',
    topics: [
      // Cover: the 7 OSI layers (Physical through Application) and what
      // each does; routers/switches/firewalls/IDS/IPS (the precise
      // inline-vs-passive distinction — an IDS operates on a traffic
      // copy and can only alert, an IPS sits inline and can actively
      // block); load balancers, proxies, NAS/SAN, wireless APs/
      // controllers, CDN, VPN/IPSec, QoS/DSCP marking, TTL (note: TTL
      // is a hop-count limiter despite the name, decremented by
      // exactly 1 per hop regardless of elapsed time, per RFC 791).
    ],
  },
  {
    domain: 'concepts',
    taskStatement: 'Protocols, Ports & Traffic Types',
    topics: [
      // Cover: common protocols and their ports (FTP's TWO ports —
      // TCP 21 control, TCP 20 data; SSH 22; DNS 53; DHCP 67/68; HTTP
      // 80; HTTPS/TLS 443; SNMP 161/162; LDAP 389; SIP 5060/5061),
      // ICMP/TCP/UDP/GRE/IPSec IP types, and the four traffic types
      // (unicast one-to-one, multicast one-to-many-all-recipients per
      // RFC 1112, anycast one-to-nearest per RFC 4291, broadcast
      // one-to-all-on-segment per RFC 919) — the anycast-vs-multicast
      // distinction especially, since it's a common mix-up.
    ],
  },
  {
    domain: 'concepts',
    taskStatement: 'Transmission Media, Topologies & IPv4 Addressing',
    topics: [
      // Cover: wired (802.3/Ethernet, fiber, coax) vs wireless
      // (802.11, cellular, satellite) media and connector types;
      // network topologies (mesh, star/hub-spoke, spine-leaf, three-
      // tier, collapsed core, N-S/E-W traffic flows); IPv4 addressing
      // — public/private (RFC 1918's three ranges), APIPA (RFC 3927,
      // 169.254.0.0/16, indicates DHCP FAILURE — distinct from
      // intentional RFC 1918 private addressing), subnetting/VLSM/
      // CIDR (RFC 4632), and the historical address classes.
    ],
  },
  {
    domain: 'concepts',
    taskStatement: 'Cloud Concepts & Evolving Network Architectures',
    topics: [
      // Cover: NFV, cloud deployment/service models and elasticity/
      // multitenancy (NIST SP 800-145's formal definitions), SDN and
      // SD-WAN, VXLAN (RFC 7348), zero trust architecture (NIST SP
      // 800-207 — policy-based authentication, least privilege), SASE/
      // SSE, infrastructure as code, and IPv6 (RFC 8200) including
      // dual-stack/tunneling/NAT64 compatibility approaches.
    ],
  },
];
```

Replace each comment with 3-6 real `{ title, body }` topic objects (body >= 2-3 sentences, your own words, grounded in the fetched docs).

**Mandatory verbatim-copying check:** sanity-check your checker (plant a violation, confirm caught) before trusting a clean result. Do NOT commit the checker script.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors mentioning `studyContent` or `concepts`; `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Networking Concepts domain study content"
```

---

## Task 5: Networking Concepts — quiz questions

**Files:**
- Create: `js/data/questions.js`

**Interfaces:**
- Produces: `QUESTIONS` array.

**Mandatory verification method for every question in every question task (this one and Tasks 7, 9, 11, 13):**

1. **Re-verify each answer key** against the exact cached doc passage before adding a question — confirm the correct option is right AND every distractor is genuinely wrong.
2. **Verbatim-copying check before committing**: 8+ consecutive words matching cached docs = reword. Sanity-check the checker first. Do NOT commit the checker script.
3. **Answer-length balance**: correct option not longest in a majority of MC questions.
4. **Answer-position balance, checked SEPARATELY for MC and MR**: no MC index >40%; MR correct-index sets must not cluster at the same 1-2 positions; avoid a rigid repeating cycle.
5. **Explanations describe distractors by content, never ordinal position.**

Write at least 23 questions covering the domain's sub-themes (OSI/appliances, protocols/ports/traffic-types, media/topologies/IPv4, cloud/evolving-architectures). ~80% MC / ~20% MR. IDs `concepts-001` through `concepts-0NN`.

Grounding notes from planning research (Network+ favors exact port numbers and precise "which of these is NOT X" distinctions — fold these in where they make a good, defensible distractor):
- FTP uses TWO ports: TCP 21 (control) and TCP 20 (data) — a distractor giving only one port is incomplete.
- TTL (RFC 791) is a hop-count limiter, decremented by exactly 1 per router hop regardless of elapsed time — NOT a wall-clock timer despite the name.
- Anycast (RFC 4291) delivers to the NEAREST of multiple interfaces sharing an address — distinct from multicast (all recipients, RFC 1112) and from load-balancing/round-robin (randomly/evenly chosen).
- APIPA (169.254.0.0/16, RFC 3927) indicates a DHCP FAILURE and is not routable — distinct from RFC 1918 private ranges (10.0.0.0/8, 172.16.0.0/12, 192.168.0.0/16), which are intentional administrator/DHCP-server assignments.
- IDS (passive, traffic copy, can only alert) vs. IPS (inline, can actively block) is a precise, testable distinction — a device "that only alerts and never blocks" is an IDS even with IPS-style signatures.

- [ ] **Step 1: Draft and verify at least 23 questions for the Networking Concepts domain**

Using docs cached in Task 4 (fetch more as needed), write questions distributed across the domain's 4 sub-themes (at least 5-6 each). Mix `multiple-choice`/`multiple-response` at roughly 80/20.

Create `js/data/questions.js`:

```js
// js/data/questions.js
export const QUESTIONS = [
  {
    id: 'concepts-001',
    domain: 'concepts',
    questionType: 'multiple-choice',
    question: '...',
    options: ['...', '...', '...', '...'],
    correctIndexes: [0],
    explanation: '...',
  },
  // ... continue through at least concepts-023
];
```

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors; `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number >= 23.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Networking Concepts domain quiz questions"
```

---

## Task 6: Network Implementation — study content

**Files:**
- Modify: `js/data/studyContent.js`

**Interfaces:**
- Consumes: existing `STUDY_CONTENT` array from Task 4 — append, don't restructure.

This domain (20% weight, official objective 2.0) covers: routing technologies; switching technologies/features; wireless devices/technologies; physical installation factors.

- [ ] **Step 1: Fetch supporting docs**

```
https://www.rfc-editor.org/rfc/rfc4271
https://www.rfc-editor.org/rfc/rfc2328
https://www.rfc-editor.org/rfc/rfc7868
https://www.cisco.com/c/en/us/support/docs/ip/border-gateway-protocol-bgp/15986-admin-distance.html
https://www.rfc-editor.org/rfc/rfc3022
https://www.rfc-editor.org/rfc/rfc5798
https://www.rfc-editor.org/rfc/rfc2281
https://www.cisco.com/site/us/en/products/networking/software/ios-nx-os/first-hop-redundancy-protocol-fhrp/index.html
https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9200/software/release/16-12/configuration_guide/lyr2/b_1612_lyr2_9200_cg/configuring_spanning_tree_protocol.html
https://www.rfc-editor.org/rfc/rfc894
https://www.rfc-editor.org/rfc/rfc1191
https://csrc.nist.gov/pubs/sp/800/153/final
https://www.rfc-editor.org/rfc/rfc2865
https://www.rfc-editor.org/rfc/rfc3748
```

**Known gaps, confirmed during planning:** IDF/MDF, rack units (EIA-310, "1U = 1.75in"), and cabling/patch-panel standards (TIA/EIA-568) are all paywalled ANSI/TIA/EIA standards with no free canonical source — cite as standard structured-cabling vocabulary; the specific numeric facts (19-inch rack width, 1U=1.75in) are safe to state directly without a citation.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'implementation'`):

- **"Routing Technologies & High Availability"** — static vs. dynamic routing (BGP/OSPF/EIGRP), route selection via administrative distance (connected=0, static=1, EIGRP=90, OSPF=110, RIP=120 — lower wins; distinct from metric, which picks the best path WITHIN one protocol), NAT/PAT, FHRP (HSRP is Cisco-proprietary using multicast 224.0.0.2/UDP 1985; VRRP, RFC 5798, is the open IETF standard using virtual MACs in the `0000.5E00.01xx` range — the two are not interoperable), virtual IP.
- **"Switching & the Layer 2/3 Boundary"** — VLANs, SVI, 802.1Q tagging/trunking, link aggregation (LACP/EtherChannel), spanning tree (STP/RSTP port states/roles), MTU/jumbo frames (RFC 894's baseline 1500-byte Ethernet MTU, RFC 1191 Path MTU Discovery).
- **"Wireless Devices & Security"** — channels/frequency bands (2.4GHz has only 3 non-overlapping 20MHz channels in the US — 1/6/11 — despite 11-14 being numbered, due to 5MHz spacing vs. ~22MHz channel width; 5GHz has more non-overlapping channels but several UNII-2 ranges require Dynamic Frequency Selection to detect/avoid radar), SSID/BSSID/ESSID, network types (infrastructure vs. ad hoc), WPA2 (AES-CCMP, 4-way handshake, vulnerable to offline dictionary/KRACK) vs. WPA3 (SAE/"Dragonfly" replaces the PSK handshake, resists offline brute-force even against weak passwords — WPA3 does NOT eliminate pre-shared keys, it changes how the exchange resists attack), guest networks, PSK vs. Enterprise auth (RADIUS/EAP), antenna types.
- **"Physical Installation Factors"** — IDF/MDF, rack sizing, cabling/patch panels (cite as standard vocabulary per the gap note above), power (UPS/PDU), environmental factors (temperature/humidity/fire suppression).

**Mandatory verbatim-copying check**: run before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Network Implementation domain study content"
```

---

## Task 7: Network Implementation — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- Administrative distance (connected=0, static=1, EIGRP=90, OSPF=110, RIP=120) picks between different routing SOURCES for the same destination; metric picks the best path within one protocol. If both OSPF and EIGRP advertise the same route, EIGRP wins (AD 90 < AD 110) even though OSPF might seem "better" by other measures.
- RADIUS auth uses UDP 1812 (1645 was the old deprecated port), RADIUS accounting uses UDP 1813; TACACS+ uses TCP port 49 — a favorite Network+ distractor mixes up UDP-vs-TCP and the exact port numbers.
- HSRP (Cisco-proprietary) vs. VRRP (RFC 5798, open standard) is a classic "which is proprietary" trap.
- The 2.4GHz band has only 3 non-overlapping channels (1/6/11) in the US despite 11-14 being numbered.

- [ ] **Step 1: Draft and verify at least 20 questions for the Network Implementation domain**

Using docs cached in Task 6 (fetch more as needed), write questions covering routing/HA, switching, wireless, and physical installation (20 minimum, roughly evenly split). IDs `implementation-001` through `implementation-0NN`. Mix ~80/20 MC/MR.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'implementation').length))"`
Expected: >= 20.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Network Implementation domain quiz questions"
```

---

## Task 8: Network Operations — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (19% weight, official objective 3.0) covers: organizational processes; network monitoring technologies; disaster recovery concepts; IPv4/IPv6 network services; network access/management methods.

- [ ] **Step 1: Fetch supporting docs**

```
https://csrc.nist.gov/pubs/sp/800/128/upd1/final
https://csrc.nist.gov/pubs/sp/800/53/r5/upd1/final
https://www.rfc-editor.org/rfc/rfc3411
https://www.rfc-editor.org/rfc/rfc7011
https://man7.org/linux/man-pages/man1/tcpdump.1.html
https://nmap.org/book/man.html
https://csrc.nist.gov/pubs/sp/800/34/r1/upd1/final
https://www.rfc-editor.org/rfc/rfc2131
https://www.rfc-editor.org/rfc/rfc4862
https://www.rfc-editor.org/rfc/rfc1035
https://www.rfc-editor.org/rfc/rfc4033
https://www.rfc-editor.org/rfc/rfc8484
https://www.rfc-editor.org/rfc/rfc7858
https://www.rfc-editor.org/rfc/rfc5905
https://www.rfc-editor.org/rfc/rfc4301
```

**Known gaps, confirmed during planning:** documentation/network-diagram conventions and IPAM as a standalone discipline have no single canonical source (built from DHCP/DNS RFCs + NIST SP 800-53's asset-inventory controls); PTP/IEEE 1588 itself is paywalled (use a Cisco config guide as a practical stand-in); MTBF/MTTR are reliability-engineering terms NOT defined in NIST SP 800-34 (confirmed by full-text search) — teach them as a related-but-distinct pair from the NIST-sourced RTO/RPO/MTD trio, without citing NIST SP 800-34 as their origin.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'operations'`):

- **"Organizational Processes & Documentation"** — documentation/diagrams (standard vocabulary, no canonical source), asset inventory, IPAM, SLA, life-cycle/change/configuration management (NIST SP 800-128).
- **"Monitoring, Logging & Discovery"** — SNMP (RFC 3411 — versions v1/v2c use only cleartext community strings for access control, effectively an unencrypted shared password; v2c's real addition over v1 was functionality like GetBulkRequest, NOT security; real authentication/encryption via the User-based Security Model only arrived in SNMPv3 — a common wrong answer credits v2 with adding encryption), flow data/NetFlow (RFC 7011), packet capture, log aggregation/SIEM, port mirroring (SPAN/RSPAN), network discovery.
- **"Business Continuity & High Availability"** — DR metrics (per NIST SP 800-34 Rev.1: RTO is forward-looking, max acceptable downtime, a subset consideration of MTD; RPO is backward-looking, the point data must be recoverable to, based on last backup — the doc states verbatim "unlike RTO, RPO is not considered as part of MTD"), DR site types (cold/warm/hot), HA approaches, testing (tabletop/validation), plus MTBF/MTTR taught as a separate reliability-engineering pair (see gap note above).
- **"IP Services & Secure Access Methods"** — DHCP (RFC 2131/2132), SLAAC, DNS record types/zone types/DNSSEC, DoH (RFC 8484 — rides over ordinary HTTPS port 443, no dedicated port, indistinguishable from regular web traffic at the transport layer — a deliberate design choice, not an oversight) vs. DoT (RFC 7858 — uses dedicated TCP port 853, the opposite design), NTP/PTP, VPN types, connection methods, jump box, in-band vs. out-of-band management.

**Mandatory verbatim-copying check**: run before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Network Operations domain study content"
```

---

## Task 9: Network Operations — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- RPO (backward-looking, last-backup recovery point) vs. RTO (forward-looking, max downtime, a subset of MTD) — NIST SP 800-34 explicitly states RPO is NOT part of MTD, unlike RTO.
- DoT uses a dedicated TCP port 853; DoH has NO dedicated port, riding over HTTPS port 443 — exam distractors often invent a "DoH port."
- SNMPv1/v2c security is cleartext community strings only; real auth/encryption (SNMPv3, User-based Security Model) is the SNMPv3-only addition — a common wrong answer credits SNMPv2 with adding encryption.
- HSRP is Cisco-proprietary; VRRP (RFC 5798) is the open standard.

- [ ] **Step 1: Draft and verify at least 19 questions for the Network Operations domain**

Using docs cached in Task 8 (fetch more as needed), write questions covering organizational processes, monitoring, DR/HA, and IP services/access methods (19 minimum). IDs `operations-001` through `operations-0NN`. Mix ~80/20 MC/MR.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'operations').length))"`
Expected: >= 19.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Network Operations domain quiz questions"
```

---

## Task 10: Network Security — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (14% weight, official objective 4.0, the smallest) covers: basic network security concepts; attack types; security features/defense techniques.

- [ ] **Step 1: Fetch supporting docs**

```
https://csrc.nist.gov/pubs/sp/800/175/b/r1/final
https://www.rfc-editor.org/rfc/rfc5280
https://csrc.nist.gov/pubs/sp/800/63/b/4/final
https://www.rfc-editor.org/rfc/rfc2865
https://www.rfc-editor.org/rfc/rfc8907
https://csrc.nist.gov/pubs/fips/199/final
https://csrc.nist.gov/pubs/sp/800/82/r3/final
https://www.rfc-editor.org/rfc/rfc4732
https://www.rfc-editor.org/rfc/rfc826
https://www.rfc-editor.org/rfc/rfc5452
https://csrc.nist.gov/pubs/sp/800/50/r1/final
https://csrc.nist.gov/pubs/sp/800/83/r1/final
https://csrc.nist.gov/pubs/sp/800/123/final
https://www.cisco.com/c/en/us/td/docs/switches/lan/catalyst9300/software/release/16-6/configuration_guide/sec/b_166_sec_9300_cg/configuring_ieee_802_1x_port_based_authentication.html
```

**Known gaps, confirmed during planning:** PCI DSS and GDPR are industry/legal standards outside the 4-tier system — cite their own official governing bodies directly (PCI Security Standards Council; EUR-Lex for GDPR 2016/679) as the only genuinely authoritative source, rather than forcing an RFC/NIST fit. On-path attack (MITM) has no single defining standard — it's a generic pattern implemented via ARP poisoning/evil twin/DNS spoofing/rogue DHCP, each already sourced separately.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'security'`):

- **"Identity, Access & Trust"** — encryption, PKI/X.509 (RFC 5280), MFA/authenticator assurance levels (NIST SP 800-63B — AAL1 single-factor, AAL2 requires two distinct factors, AAL3 requires a hardware cryptographic authenticator; the canonical factor categories are something you know/have/are, plus somewhere you are and something you do — two passwords is still single-factor, since both are "something you know"), SSO/SAML, RADIUS vs. TACACS+ (RADIUS/RFC 2865 runs UDP, encrypts ONLY the password in Access-Request, combines authN+authZ into one response; TACACS+/RFC 8907 runs TCP port 49, encrypts the ENTIRE packet body, separates authN/authZ/accounting into three distinct exchanges), LDAP, key management.
- **"Governance, Physical Security & Compliance"** — the CIA triad with FIPS 199's precise legal definitions (confidentiality = unauthorized disclosure; integrity = unauthorized modification/destruction, which also encompasses non-repudiation/authenticity; availability = disruption of access — altering data without disclosing it violates integrity, not confidentiality, a common mix-up), physical security, deception technology (honeypots/honeynets), PCI DSS/GDPR (cited per the gap note above), segmentation (IoT/SCADA/ICS/OT via NIST SP 800-82, BYOD).
- **"Network & Endpoint Attacks"** — DoS/DDoS, VLAN hopping (two distinct techniques: switch spoofing, which exploits Dynamic Trunking Protocol and is bidirectional once a trunk forms; double tagging, which is a ONE-WAY-only attack, prepending two 802.1Q tags so the outer tag matching the native VLAN gets stripped, exposing the inner tag), MAC flooding/CAM table overflow, ARP poisoning (RFC 826), DNS poisoning/spoofing (RFC 5452), rogue devices, evil twin, on-path attack, social engineering, malware.
- **"Defense & Hardening Techniques"** — device hardening, NAC/802.1X port-based auth, MAC filtering, ACLs, URL/content filtering, security zones/DMZ.

**Mandatory verbatim-copying check**: run before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Network Security domain study content"
```

---

## Task 11: Network Security — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- RADIUS (UDP, port-1812-auth, encrypts only the password) vs. TACACS+ (TCP port 49, encrypts the entire packet, separates authN/authZ/accounting) is a favorite "which of these is TRUE about X but not Y" trap.
- FIPS 199: altering data without disclosing it violates INTEGRITY, not confidentiality — a common mix-up.
- VLAN hopping via double tagging is one-way only (no return traffic to the attacker); switch spoofing is bidirectional once a trunk is negotiated — a subtle, testable distinction.
- MFA factor categories: two passwords (or password+PIN) is still single-factor, since both are "something you know" — a classic "is this really MFA" trap.

- [ ] **Step 1: Draft and verify at least 14 questions for the Network Security domain**

Using docs cached in Task 10 (fetch more as needed), write questions covering identity/access/trust, governance/physical-security/compliance, attacks, and defense/hardening (14 minimum). IDs `security-001` through `security-0NN`. Mix ~80/20 MC/MR.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'security').length))"`
Expected: >= 14.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Network Security domain quiz questions"
```

---

## Task 12: Network Troubleshooting — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (24% weight, official objective 5.0, the largest) covers: troubleshooting methodology; cabling/physical interface issues; network services issues; performance issues; tools/protocols.

- [ ] **Step 1: Fetch supporting docs**

```
https://www.cisco.com/en/US/docs/internetworking/troubleshooting/guide/tr1901.html
https://www.cisco.com/site/us/en/learn/topics/networking/what-is-power-over-ethernet.html
https://www.cisco.com/c/en/us/support/docs/lan-switching/spanning-tree-protocol/10556-16.html
https://www.rfc-editor.org/rfc/rfc2131
https://www.rfc-editor.org/rfc/rfc950
https://www.rfc-editor.org/rfc/rfc1918
https://www.rfc-editor.org/rfc/rfc2914
https://www.rfc-editor.org/rfc/rfc3550
https://www.rfc-editor.org/rfc/rfc792
https://man7.org/linux/man-pages/man8/ping.8.html
https://man7.org/linux/man-pages/man8/traceroute.8.html
https://man7.org/linux/man-pages/man1/tcpdump.1.html
https://nmap.org/book/man.html
```

**Known gaps, confirmed during planning:** CompTIA's own exact 7-step troubleshooting methodology has no external citable source (it's CompTIA's own copyrighted exam phrasing — Cisco's general troubleshooting-methodology docs are the closest authoritative analog for the underlying concept, but the exact 7 step names/order are standard exam vocabulary, not an external standard); cable testers as a distinct handheld tool category, and "Wi-Fi analyzer" as a generic tool category, both have no canonical source (Cisco's own docs describe specific products, not the generic category) — treat as standard vocabulary illustrated by the verified Cisco docs, not defined by them.

- [ ] **Step 2: Append study notes**

Insert 4 new section objects (`domain: 'troubleshooting'`):

- **"Troubleshooting Methodology"** — the CompTIA 7-step process (identify the problem → establish a theory of probable cause → test the theory → establish a plan of action → implement the solution → verify full system functionality → document findings), framed via Cisco's general structured-troubleshooting concepts (top-down/bottom-up/divide-and-conquer approaches) since the exact 7-step naming itself has no external citable source (see gap note above).
- **"Physical Layer & Cabling Problems"** — cable types/categories (Cat6 can carry 10Gbps only up to ~37-55m depending on alien-crosstalk conditions — it was not certified for 10GBASE-T at the full 100m; Cat6a is required to guarantee 10Gbps for the full 100m due to added shielding — a 90-meter run needing 10Gbps requires Cat6a, not Cat6, even though Cat6 supports 10GBASE-T at short range), signal degradation (crosstalk/interference/attenuation), improper termination, interface counters/CRC errors (CRC errors climbing while collisions stay at zero points to a physical-layer problem, since frame corruption isn't a collision-domain event; LATE collisions specifically — not just any error — are the signature of a duplex mismatch), PoE power budgets (802.3af/Type1 delivers up to 15.4W at the port but guarantees only 12.95W at the device due to cable loss; 802.3at/PoE+/Type2 up to 30W at the port, 25.5W guaranteed at the device; 802.3bt/PoE++ Type3 up to 60W/51W and Type4 up to 90-100W/~71.3W — questions giving a device's power draw require using the device-side guaranteed figure, not the port-side maximum), transceivers.
- **"Network & Service-Layer Issues"** — STP loops, VLAN assignment issues, ACL misconfiguration, routing table issues, DHCP problems (DHCP uses UDP 67 server/68 client — easy to confuse with TFTP's adjacent port 69; DHCPDECLINE is sent BY THE CLIENT when it detects the offered address is already in use via a failed ARP probe, while DHCPNAK is sent BY THE SERVER to refuse a client's request), incorrect gateway/IP/subnet mask, duplicate IP addresses.
- **"Performance Issues & Diagnostic Tooling"** — congestion/bottlenecking/bandwidth, latency, packet loss, jitter (RFC 3550's formal definition — the mean deviation of relative transit-time difference between consecutive packets via exponential smoothing, carried in RTCP receiver reports — NOT just casual "variation in delay"), wireless interference/coverage/roaming issues, and the diagnostic toolkit (protocol analyzers, `ping`, `traceroute`, `nslookup`/`dig`, `tcpdump`, `nmap`, LLDP/CDP, cable testers, Wi-Fi analyzers, device `show` commands).

**Mandatory verbatim-copying check**: run before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Network Troubleshooting domain study content"
```

---

## Task 13: Network Troubleshooting — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's five-part method.

Grounding notes from planning research:
- PoE power-budget questions must use the device-side GUARANTEED figure (802.3af: 12.95W; 802.3at: 25.5W; 802.3bt Type3: 51W; Type4: ~71.3W), not the port-side maximum.
- Cat6 vs. Cat6a for 10GBASE-T is distance-dependent, not a flat yes/no — a 90m run needing 10Gbps requires Cat6a.
- CRC errors (physical-layer problem) vs. LATE collisions specifically (duplex-mismatch signature) is a precise diagnostic distinction — not just "any interface error means duplex mismatch."
- DHCP uses UDP 67(server)/68(client) — easy to confuse with TFTP's adjacent port 69. DHCPDECLINE is client-sourced; DHCPNAK is server-sourced.
- This is the largest domain (24% weight, at least 24 questions) — make sure coverage is proportionally thorough across all 4 sub-themes, especially the tooling/performance sub-theme (Network+ tests specific CLI tool syntax and output interpretation heavily).

- [ ] **Step 1: Draft and verify at least 24 questions for the Network Troubleshooting domain**

Using docs cached in Task 12 (fetch more as needed), write questions distributed across troubleshooting methodology, cabling/physical issues, network/service-layer issues, and performance/tooling (24 minimum — this is the largest domain). IDs `troubleshooting-001` through `troubleshooting-0NN`. Mix ~80/20 MC/MR.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: >= 100 (the full bank across all 5 domains — confirms the Global Constraints floor is met).

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Network Troubleshooting domain quiz questions"
```

---

## Task 14: Flashcard deck

**Files:**
- Create: `js/data/flashcards.js`

**Interfaces:**
- Produces: `FLASHCARDS` array.

- [ ] **Step 1: Build the deck from already-cached research**

Most material is already cached from Tasks 4-13 — reuse it, don't refetch. Only fetch new pages for concepts not yet researched.

Target ~65-70 cards spanning all 5 domains, covering core Network+ vocabulary: OSI layer names (all 7), TCP, UDP, ICMP, common protocol/port pairs (FTP 20/21, SSH 22, DNS 53, DHCP 67/68, HTTP 80, HTTPS 443, SNMP 161/162, RDP 3389, SIP 5060/5061), unicast/multicast/anycast/broadcast, VLAN, trunk/802.1Q, spanning tree, link aggregation, BGP, OSPF, EIGRP, administrative distance, NAT/PAT, HSRP, VRRP, FHRP, subnetting/CIDR/VLSM, RFC 1918, APIPA, SSID/BSSID, WPA2, WPA3, RADIUS, TACACS+, LDAP, SAML, MFA, CIA triad, PKI, VLAN hopping, ARP poisoning, evil twin, on-path attack, DoS/DDoS, honeypot, IDS, IPS, ACL, DMZ, NAC/802.1X, RPO, RTO, MTTR, MTBF, hot/warm/cold site, SNMP, SIEM, DoH, DoT, jitter, latency, CRC, PoE standards, crosstalk, attenuation, `traceroute`, `nslookup`, `tcpdump`, `nmap`, spine-leaf, SDN, zero trust, VXLAN.

```js
// js/data/flashcards.js
export const FLASHCARDS = [
  {
    id: 'osi-model',
    service: 'OSI Model',
    front: 'What is it?',
    back: '...',
  },
  // ... ~65-70 cards total
];
```

(`service` field name kept for schema/validator compatibility with the copied `validate-content.mjs`.)

**Mandatory verbatim-copying check**: run before committing. Do NOT commit the checker script.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 3: Commit**

```bash
git add js/data/flashcards.js
git commit -m "Add flashcard deck"
```

---

## Task 15: Copy the remaining views

**Files:**
- Copy from `../sre/` unchanged: `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/progress.js`
- Copy from `../sre/`, then edit: `js/views/mockExam.js` (one wording edit — the scoring logic is already correct)

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js`; `STUDY_CONTENT` from `js/data/studyContent.js`; `QUESTIONS` from `js/data/questions.js`; `FLASHCARDS` from `js/data/flashcards.js`; `isCorrect`, `estimateScaledScore`, `drawMockExam` from `js/lib/scoring.js`; `createStore` from `js/lib/storage.js` — all already produced by Tasks 2, 4-14.

These four views are entirely content-agnostic. `mockExam.js` copied from `sre/` already has the correct `estimateScaledScore()` call — only its results-screen wording needs to change, from "not tied to a certification" framing to real-exam framing plus the performance-based-questions disclosure.

- [ ] **Step 1: Copy the four unchanged views**

```bash
cp ../sre/js/views/studyGuide.js js/views/studyGuide.js
cp ../sre/js/views/quiz.js js/views/quiz.js
cp ../sre/js/views/flashcards.js js/views/flashcards.js
cp ../sre/js/views/progress.js js/views/progress.js
```

Run: `for f in studyGuide.js quiz.js flashcards.js progress.js; do diff ../sre/js/views/$f js/views/$f; done`
Expected: no output.

- [ ] **Step 2: Copy mockExam.js from `sre/` and apply the one required text edit**

```bash
cp ../sre/js/views/mockExam.js js/views/mockExam.js
```

Open `js/views/mockExam.js` and confirm the `estimateScaledScore` call inside `finishExam()` already reads:

```js
  const score = estimateScaledScore(correctCount, exam.length, {
    minScore: EXAM_FORMAT.minScore,
    maxScore: EXAM_FORMAT.maxScore,
  });
```

**Do not change this call** — it's already correct.

Then find this line in the same function's returned HTML:

```js
    <p class="exam-note">This is an estimate based on percent correct on a simplified 0–${EXAM_FORMAT.maxScore} scale — there's no official SRE exam or scaling formula behind it, since this module isn't tied to a certification. Passing score is ${EXAM_FORMAT.passingScore}.</p>
```

Replace it with:

```js
    <p class="exam-note">This is an estimate based on percent correct on the real exam's ${EXAM_FORMAT.minScore}–${EXAM_FORMAT.maxScore} scale — CompTIA's own scaled-score formula isn't published (similar to how AWS's isn't). Also, this is a multiple-choice-only self-test; the real N10-009 exam also includes performance-based questions this site doesn't simulate. Passing score is ${EXAM_FORMAT.passingScore}.</p>
```

This is the only change to the file.

Run: `diff ../sre/js/views/mockExam.js js/views/mockExam.js`
Expected: a single-hunk diff showing only this text change.

- [ ] **Step 3: Verify all five views in the browser**

With the server running (`preview_start` with name `networking-site`):

1. `#/study` → click through all 5 domains — content renders for each, no console errors.
2. `#/quiz` → pick a domain, answer a question, submit — instant feedback + explanation, results screen at the end.
3. `#/flashcards` → flip a card, mark known, toggle "show only unknown" filtering.
4. `#/exam` → start the mock exam, confirm 90 questions total and the countdown timer starts near 90:00; answer through to the end and submit — results screen shows the estimated score against the 100–900 scale (NOT 0–1000 or 0-100) with the correct pass/fail line at 720, the new results text (real exam facts, performance-based-question disclosure, no mention of SRE/PostgreSQL), and a per-domain breakdown summing to 90.
5. `#/progress` → confirm the quiz and mock exam attempts show up.
6. Check `preview_console_logs` at level `'error'` — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add js/views/studyGuide.js js/views/quiz.js js/views/flashcards.js js/views/progress.js js/views/mockExam.js
git commit -m "Add remaining views (copied from sre/; mock exam scoring already correct, only results text updated)"
```

---

## Task 16: Final integration, README, and full walkthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the full automated check suite**

```bash
node --test "js/lib/*.test.mjs"
node scripts/validate-content.mjs
```

Expected: all `node --test` cases pass (6 tests: 3 storage + 3 scoring); validator prints `All content validated successfully.`

Also run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"` and record the actual total — the README below must state this exact number (it may exceed 100, since domain counts are floors, not exact targets).

- [ ] **Step 2: Write the final README**

```markdown
# CompTIA Network+ (N10-009) Prep

An unofficial study site for the CompTIA Network+ certification (exam N10-009). Not affiliated with or endorsed by CompTIA.

Live at https://toddcooke.github.io/learn/networking/. A companion to https://toddcooke.github.io/learn/aws/, https://toddcooke.github.io/learn/kubernetes/, https://toddcooke.github.io/learn/postgres/, and https://toddcooke.github.io/learn/sre/.

## Running it

No install step. From this directory:

```
python3 -m http.server 8004
```

Then open http://localhost:8004/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## A note on format

The real N10-009 exam is a maximum of 90 questions (multiple-choice AND performance-based/simulation), 90 minutes, passing score 720 on a 100–900 scale. This site's quizzes and mock exam test the same underlying knowledge in multiple-choice/multiple-response form only — the performance-based simulation questions aren't replicated here. Pair this with hands-on lab practice (e.g. Cisco Packet Tracer or GNS3) for genuine exam readiness.

## What's here

- **Study guide** — organized by the exam's 5 official domains: Networking Concepts, Network Implementation, Network Operations, Network Security, Network Troubleshooting.
- **Domain quizzes** — [ACTUAL COUNT FROM STEP 1] practice questions with instant feedback and explanations.
- **Flashcards** — a cheat-sheet deck of core networking vocabulary with known/unknown tracking.
- **Mock exam** — a 90-question, 90-minute timed exam weighted by domain, scored against the real exam's 100-900 scale and 720 passing line.
- **Progress dashboard** — quiz and mock exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).

## How the content was sourced

Unlike this repo's other modules, there's no single official documentation site for Network+ content, so this module uses a tiered sourcing strategy: IETF RFCs for internet protocols, NIST Special Publications for security/continuity concepts, Cisco's free public documentation for vendor/hardware implementation topics, and official man pages for CLI tools — confirmed reachable 2026-07-10. Domain weights and the exam format come directly from CompTIA's own official N10-009 exam objectives (fetched 2026-07-10). Every quiz question was drafted from and checked against the relevant cached documentation before being added. Fetched pages are cached locally under `.cache/aws-docs/` (gitignored; directory name kept for consistency with tooling shared across all five modules).

## Development

This project's application code (router, storage/scoring libraries, view components, content tooling) is shared architecture with the sibling [`aws/`](../aws), [`kubernetes/`](../kubernetes), [`postgres/`](../postgres), and [`sre/`](../sre) modules in this repo — only the content data files and one small mock-exam wording edit differ.

- `node --test "js/lib/*.test.mjs"` — runs unit tests for the pure storage/scoring logic (the bare-directory form `node --test js/lib` fails on some Node versions; use the glob form).
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.
```

Replace `[ACTUAL COUNT FROM STEP 1]` with the real number before committing.

- [ ] **Step 3: Full manual walkthrough**

With the server running (`preview_start` with name `networking-site`), walk through every feature end to end:

1. `#/` — real exam facts and performance-based-question disclosure render correctly, all 5 domains shown.
2. `#/study` → click through all 5 domains — content renders for each, no console errors.
3. `#/quiz` → run one domain quiz to completion.
4. `#/flashcards` → flip a few cards, mark some known, toggle the "unknown only" filter.
5. `#/exam` → start a mock exam, answer through to the end, submit — results screen renders with a per-domain breakdown summing to 90 and a score on the 100-900 scale against the 720 line, with the new results text (no SRE/PostgreSQL references).
6. `#/progress` → confirm all activity shows up.
7. Reload the page and revisit `#/progress` — expected: everything persisted.
8. Check `preview_console_logs` with `level: 'error'` — expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Finalize README and complete end-to-end verification"
```
