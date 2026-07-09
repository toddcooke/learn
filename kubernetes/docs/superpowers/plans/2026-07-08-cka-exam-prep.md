# CKA Exam Prep Site Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a static, locally-served website that teaches the Certified Kubernetes Administrator (CKA) exam's curriculum and lets someone practice with 100+ verified questions, flashcards, and a timed mock exam — a second learning module alongside the existing AWS SAA-C03 site.

**Architecture:** This project reuses the AWS SAA-C03 site's (`~/IdeaProjects/learn_aws`) entire application layer verbatim — the router, base styles, storage/scoring libraries, and content-tooling scripts are content-agnostic and require no code changes. Only the content data files (`js/data/*.js`), the home view's copy, and one small addition to the mock exam's start screen are new. Content is sourced from the official CNCF CKA curriculum and kubernetes.io documentation, adversarially verified before being added — the same discipline the AWS site used, with two specific lessons (verbatim-copying and "longest answer" tells) built into every task's instructions from the start instead of discovered via review.

**Tech Stack:** Identical to `learn_aws`: vanilla HTML/CSS/JS, no build step, no npm. Node.js only for two standalone helper scripts and `node --test` unit tests, copied unchanged from `learn_aws`.

## Global Constraints

- **Source repo for copying:** `/Users/toddcooke/IdeaProjects/learn_aws` — every "copy from learn_aws" instruction in this plan refers to this exact local path. Do NOT touch or read from `/Users/toddcooke/IdeaProjects/learn_kubernetes` — that is a separate, unrelated, pre-existing project (a hands-on lab tool called `learnctl`) and must not be modified, read into, or referenced.
- This project's own working directory is `/Users/toddcooke/IdeaProjects/learn_kubernetes_site`. All file paths in this plan are relative to that directory unless given as an absolute `learn_aws` source path.
- No npm/build tooling of any kind — same as `learn_aws`.
- The site is served via `python3 -m http.server` for local use, not opened via `file://` (ES module imports are blocked by browsers under `file://`).
- All exam content lives in `js/data/*.js` as ES module exports.
- Every question in `js/data/questions.js` must satisfy `node scripts/validate-content.mjs` and must have been adversarially verified against cached source documentation before being added.
- **Every question and study-content topic must be checked for verbatim copying (8+ consecutive words matching a source doc) and, for questions, for a "longest answer is correct" tell — both checks are mandatory in every content task's steps below, not an afterthought.**
- Total practice question count must reach **at least 100**, distributed by domain weight as counts: Cluster Architecture 25, Services and Networking 20, Workloads and Scheduling 15, Storage 10, Troubleshooting 30.
- `js/lib/storage.js`'s `NAMESPACE` constant must be `'cka-prep'`, NOT `'saa-prep'` (copied from `learn_aws`) — both sites share the `toddcooke.github.io` origin, so an unchanged copy would collide with the AWS site's localStorage data.
- `scripts/validate-content.mjs`'s domain-count check must expect **5** domains, not 4 (copied from `learn_aws`, which hardcoded 4) — see Task 2.
- CKA domains, weights, and the exam format are fixed per the official CNCF curriculum (`CKA_Curriculum_v1.35.pdf`) and Linux Foundation FAQ, fetched 2026-07-08 (recorded in the design spec) — do not alter without re-checking the source.
- No user accounts, auth, or backend. All persistence is `localStorage`, namespaced under the `cka-prep:` key prefix.
- Every doc page fetched during content research must go through `scripts/fetch-doc.mjs`, which checks `.cache/aws-docs/index.json` first (directory kept as `aws-docs` for consistency with the copied, unmodified tooling — see the spec).
- Reference spec: [docs/superpowers/specs/2026-07-08-cka-exam-prep-design.md](../specs/2026-07-08-cka-exam-prep-design.md).

---

## Task 1: Project scaffold — shell, router, base styles, view stubs

**Files:**
- Create: `index.html` (new content — title/copy changed from `learn_aws`)
- Copy from `learn_aws`: `css/style.css`, `js/app.js`, `.gitignore` (all unchanged)
- Create: `js/views/home.js`, `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/mockExam.js`, `js/views/progress.js` (stubs — real implementations come later)
- Create: `README.md` (stub), `.claude/launch.json`

**Interfaces:**
- Produces: every `js/views/*.js` module exports `function render(mount, ...params)` — identical contract to `learn_aws`, since `js/app.js` is copied unchanged and calls views this way.

- [ ] **Step 1: Copy the router, base styles, and gitignore unchanged**

```bash
cp /Users/toddcooke/IdeaProjects/learn_aws/js/app.js js/app.js
mkdir -p css
cp /Users/toddcooke/IdeaProjects/learn_aws/css/style.css css/style.css
cp /Users/toddcooke/IdeaProjects/learn_aws/.gitignore .gitignore
```

Run: `diff /Users/toddcooke/IdeaProjects/learn_aws/js/app.js js/app.js && diff /Users/toddcooke/IdeaProjects/learn_aws/css/style.css css/style.css`
Expected: no output (files identical).

- [ ] **Step 2: Create the six view stub modules**

Each of `js/views/home.js`, `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/mockExam.js`, `js/views/progress.js` gets this content:

```js
// js/views/home.js
export function render(mount) {
  mount.innerHTML = '<p>Coming soon.</p>';
}
```

(Repeat verbatim for the other five files — they're replaced with real implementations in later tasks.)

- [ ] **Step 3: Create the HTML shell**

```html
<!-- index.html -->
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>CKA Exam Prep</title>
  <link rel="stylesheet" href="css/style.css" />
</head>
<body>
  <header class="site-header">
    <h1>Certified Kubernetes Administrator Prep</h1>
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
    <p>Unofficial study aid. Not affiliated with or endorsed by the Linux Foundation or CNCF.</p>
  </footer>
  <script type="module" src="js/app.js"></script>
</body>
</html>
```

- [ ] **Step 4: Create the launch config for the preview server**

```json
{
  "version": "0.0.1",
  "configurations": [
    {
      "name": "site",
      "runtimeExecutable": "python3",
      "runtimeArgs": ["-m", "http.server", "8001"],
      "port": 8001
    }
  ]
}
```

Save as `.claude/launch.json`. Note the port is **8001**, not 8000 — this avoids colliding with a `learn_aws` preview server if both happen to be running at once.

- [ ] **Step 5: Create the README stub**

```markdown
# CKA Exam Prep

An unofficial study site for the Certified Kubernetes Administrator (CKA) exam. Not affiliated with or endorsed by the Linux Foundation or CNCF.

Status: under construction.
```

- [ ] **Step 6: Verify in the browser**

Start the server (via the preview tool's `preview_start` with name `site`, or manually with `python3 -m http.server 8001`), then load `http://localhost:8001/`.

Expected: page loads with the header "Certified Kubernetes Administrator Prep", nav links, and "Coming soon." in the content area. Clicking each nav link changes the URL hash and keeps showing "Coming soon." with that link highlighted. Check the browser console (`preview_console_logs`) — expect no errors.

- [ ] **Step 7: Commit**

```bash
git add index.html css/style.css js/app.js .gitignore js/views README.md .claude/launch.json
git commit -m "Add site scaffold: shell, router (copied from learn_aws), base styles, view stubs"
```

---

## Task 2: Core infrastructure — exam data, storage, scoring, and content tooling

**Files:**
- Create: `js/data/examInfo.js` (new content)
- Copy from `learn_aws`, then edit: `js/lib/storage.js` (NAMESPACE change)
- Copy from `learn_aws` unchanged: `js/lib/storage.test.mjs`, `js/lib/scoring.js`, `js/lib/scoring.test.mjs`, `scripts/fetch-doc.mjs`
- Copy from `learn_aws`, then edit: `scripts/validate-content.mjs` (domain-count change)

**Interfaces:**
- Produces: `DOMAINS` (array of `{id, name, weight, mockExamCount}`, **5 entries**) and `EXAM_FORMAT` (`{totalQuestions, durationMinutes, passingScore, minScore, maxScore}`) from `js/data/examInfo.js`.
- Produces: `createStore(backend = globalThis.localStorage)` from `js/lib/storage.js`, identical shape to `learn_aws`'s — `{getQuizHistory, recordQuizAttempt, getFlashcardState, setFlashcardKnown, getMockExamHistory, recordMockExamAttempt}` — but namespaced under `'cka-prep'`.
- Produces: `isCorrect`, `estimateScaledScore`, `drawMockExam` from `js/lib/scoring.js` — identical signatures to `learn_aws`.
- Produces: `node scripts/fetch-doc.mjs <url>` and `node scripts/validate-content.mjs` — identical behavior to `learn_aws`, except the validator now expects 5 domains.

- [ ] **Step 1: Write the exam info data**

```js
// js/data/examInfo.js
export const DOMAINS = [
  { id: 'cluster', name: 'Cluster Architecture, Installation and Configuration', weight: 25, mockExamCount: 15 },
  { id: 'services', name: 'Services and Networking', weight: 20, mockExamCount: 12 },
  { id: 'workloads', name: 'Workloads and Scheduling', weight: 15, mockExamCount: 9 },
  { id: 'storage', name: 'Storage', weight: 10, mockExamCount: 6 },
  { id: 'troubleshooting', name: 'Troubleshooting', weight: 30, mockExamCount: 18 },
];

export const EXAM_FORMAT = {
  totalQuestions: 60,
  durationMinutes: 90,
  passingScore: 66,
  minScore: 0,
  maxScore: 100,
};
```

(`weight` sums to 100; `mockExamCount` sums to 60, matching `EXAM_FORMAT.totalQuestions` — this field means "mock exam draw size" here, not "real exam question count," since the real CKA exam isn't question-based. The full practice bank target of 100 questions is a Global Constraint above, not a stored field, matching how `learn_aws` handled it.)

- [ ] **Step 2: Copy the storage library and fix the namespace**

```bash
cp /Users/toddcooke/IdeaProjects/learn_aws/js/lib/storage.js js/lib/storage.js
cp /Users/toddcooke/IdeaProjects/learn_aws/js/lib/storage.test.mjs js/lib/storage.test.mjs
```

Open `js/lib/storage.js` and change:

```js
const NAMESPACE = 'saa-prep';
```

to:

```js
const NAMESPACE = 'cka-prep';
```

This is the only line that should differ from `learn_aws`'s copy.

Run: `node --test js/lib/storage.test.mjs`
Expected: 3 tests pass (the test file doesn't assert on the literal namespace string, so it needs no changes and still passes).

- [ ] **Step 3: Copy the scoring library and its test unchanged**

```bash
cp /Users/toddcooke/IdeaProjects/learn_aws/js/lib/scoring.js js/lib/scoring.js
cp /Users/toddcooke/IdeaProjects/learn_aws/js/lib/scoring.test.mjs js/lib/scoring.test.mjs
```

Run: `diff /Users/toddcooke/IdeaProjects/learn_aws/js/lib/scoring.js js/lib/scoring.js`
Expected: no output.

Run: `node --test js/lib/scoring.test.mjs`
Expected: 3 tests pass.

- [ ] **Step 4: Copy the doc-fetch cache script unchanged**

```bash
mkdir -p scripts
cp /Users/toddcooke/IdeaProjects/learn_aws/scripts/fetch-doc.mjs scripts/fetch-doc.mjs
```

Run: `node scripts/fetch-doc.mjs https://kubernetes.io/docs/concepts/workloads/pods/`
Expected: prints a path under `.cache/aws-docs/`, and the cached file contains readable text about Kubernetes Pods (the script's generic HTML-stripping fallback handles kubernetes.io pages, which don't have a markdown-sibling like AWS docs do — this was verified during design). Running the exact same command again prints the same path near-instantly (cache hit, no fetch).

- [ ] **Step 5: Copy the content validator and fix the domain count**

```bash
cp /Users/toddcooke/IdeaProjects/learn_aws/scripts/validate-content.mjs scripts/validate-content.mjs
```

Open `scripts/validate-content.mjs` and find this line inside `validateExamInfo()`:

```js
  check(Array.isArray(DOMAINS) && DOMAINS.length === 4, 'DOMAINS must have exactly 4 entries');
```

Change it to:

```js
  check(Array.isArray(DOMAINS) && DOMAINS.length === 5, 'DOMAINS must have exactly 5 entries');
```

This is the only line that should differ from `learn_aws`'s copy — every other check in the file (weight-sum, mock-count-sum, per-domain shape, question/flashcard/study-content shape) is already generic and needs no changes.

Run: `node scripts/validate-content.mjs`
Expected: `studyContent.js not present yet, skipping`, `questions.js not present yet, skipping`, `flashcards.js not present yet, skipping`, then `All content validated successfully.` (exit 0).

- [ ] **Step 6: Commit**

```bash
git add js/data/examInfo.js js/lib/storage.js js/lib/storage.test.mjs js/lib/scoring.js js/lib/scoring.test.mjs scripts/fetch-doc.mjs scripts/validate-content.mjs
git commit -m "Add exam data, storage (namespaced cka-prep)/scoring libs, and content tooling"
```

---

## Task 3: Home view

**Files:**
- Modify: `js/views/home.js`

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js` (Task 2).

This is new content, not a copy — it needs CKA-specific facts and the format-honesty disclaimer required by the spec.

- [ ] **Step 1: Replace the stub with the real home view**

```js
// js/views/home.js
import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About the Exam</h2>
      <p>Certified Kubernetes Administrator (CKA)</p>
      <ul class="exam-facts">
        <li>Real exam: 2-hour, 100% hands-on performance-based test (command line, live clusters)</li>
        <li>Passing score: ${EXAM_FORMAT.passingScore}%, certification valid 2 years</li>
      </ul>
      <p class="exam-note">Heads up: the real CKA exam has no multiple-choice questions at all — you solve tasks in a live cluster via the command line. This site's quizzes and mock exam (${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes) test the same underlying knowledge, but passing them isn't equivalent to being ready for the real exam. Pair this with hands-on practice using <a href="https://kind.sigs.k8s.io/" target="_blank" rel="noopener">kind</a>, <a href="https://minikube.sigs.k8s.io/" target="_blank" rel="noopener">minikube</a>, or <a href="https://killer.sh/" target="_blank" rel="noopener">killer.sh</a> for genuine exam readiness.</p>
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

(`.exam-note` is a class name already used — unstyled, plain paragraph — in `learn_aws`'s copied `css/style.css`; reusing it here means no CSS changes are needed.)

- [ ] **Step 2: Verify in the browser**

Reload `http://localhost:8001/#/`. Expected: exam facts, the disclaimer paragraph (with working links to kind/minikube/killer.sh, opening in new tabs), and all 5 domains with their weights (25/20/15/10/30) render. Clicking a domain link navigates to `#/study/<id>` (still "Coming soon" until Task 15).

- [ ] **Step 3: Commit**

```bash
git add js/views/home.js
git commit -m "Implement home view with exam overview and format-honesty disclaimer"
```

---

## Task 4: Cluster Architecture, Installation and Configuration — study content

**Files:**
- Create: `js/data/studyContent.js`

**Interfaces:**
- Consumes: `domain: 'cluster'` id from `js/data/examInfo.js`.
- Produces: `STUDY_CONTENT` array (consumed by `validateStudyContent` in Task 2's validator, and by `js/views/studyGuide.js` in Task 15).

This domain (25% weight) covers the following competencies, verbatim from the official CNCF CKA curriculum (`CKA_Curriculum_v1.35.pdf`, fetched 2026-07-08):

- Manage role based access control (RBAC)
- Prepare underlying infrastructure for installing a Kubernetes cluster
- Create and manage Kubernetes clusters using kubeadm
- Manage the lifecycle of Kubernetes clusters
- Implement and configure a highly-available control plane
- Use Helm and Kustomize to install cluster components
- Understand extension interfaces (CNI, CSI, CRI, etc.)
- Understand CRDs, install and configure operators

Unlike the AWS site's exam guide, CKA's curriculum has no official sub-task-statement numbering — it's a flat bullet list per domain. Group these 8 bullets into thematic sections yourself (a reasonable split: RBAC & access control; infrastructure prep & kubeadm cluster creation; cluster lifecycle & HA control planes; package/extension tooling — Helm, Kustomize, CNI/CSI/CRI, CRDs/operators). Use a descriptive label you write for each group's `taskStatement` field (there's no official numbered name to quote, unlike AWS's "Task 1.1: ...").

- [ ] **Step 1: Fetch supporting docs**

Fetch these via `node scripts/fetch-doc.mjs <url>` (if any 404s, use WebSearch for "<topic> kubernetes.io documentation" and fetch the correct current URL instead — kubernetes.io occasionally reorganizes pages):

- `https://kubernetes.io/docs/reference/access-authn-authz/rbac/`
- `https://kubernetes.io/docs/setup/production-environment/` (infrastructure prep)
- `https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/create-cluster-kubeadm/`
- `https://kubernetes.io/docs/tasks/administer-cluster/kubeadm/kubeadm-upgrade/` (cluster lifecycle/upgrades)
- `https://kubernetes.io/docs/setup/production-environment/tools/kubeadm/high-availability/`
- `https://helm.sh/docs/intro/using_helm/`
- `https://kubernetes.io/docs/tasks/manage-kubernetes-objects/kustomization/`
- `https://kubernetes.io/docs/concepts/architecture/cri/` and `https://kubernetes.io/docs/concepts/extend-kubernetes/compute-storage-net/network-plugins/` (CNI) and `https://kubernetes.io/docs/concepts/storage/volumes/#csi` (CSI)
- `https://kubernetes.io/docs/concepts/extend-kubernetes/api-extension/custom-resources/` (CRDs and operators)

- [ ] **Step 2: Write study notes grounded in the fetched docs**

Create `js/data/studyContent.js` with 3-4 sections for this domain (`domain: 'cluster'`), each with 3-6 `topics` (prose paragraphs, not copied bullet lists) covering every knowledge item listed above, grounded in the docs fetched in Step 1:

```js
// js/data/studyContent.js
export const STUDY_CONTENT = [
  {
    domain: 'cluster',
    taskStatement: 'RBAC and access control',
    topics: [
      // Cover: Roles vs ClusterRoles, RoleBindings vs ClusterRoleBindings,
      // ServiceAccounts, the principle of least privilege for cluster access.
    ],
  },
  {
    domain: 'cluster',
    taskStatement: 'Preparing infrastructure and creating clusters with kubeadm',
    topics: [
      // Cover: production-environment prerequisites (container runtime,
      // network requirements, swap), kubeadm init/join workflow, node
      // roles (control-plane vs worker).
    ],
  },
  {
    domain: 'cluster',
    taskStatement: 'Cluster lifecycle and high availability',
    topics: [
      // Cover: kubeadm upgrade workflow, HA control-plane topologies
      // (stacked etcd vs external etcd), backing up etcd.
    ],
  },
  {
    domain: 'cluster',
    taskStatement: 'Extending the cluster: Helm, Kustomize, CNI/CSI/CRI, CRDs and operators',
    topics: [
      // Cover: Helm charts/releases, Kustomize overlays, the purpose of
      // the CNI/CSI/CRI extension interfaces, CustomResourceDefinitions
      // and the operator pattern.
    ],
  },
];
```

Replace each comment with 3-6 real `{ title, body }` topic objects (body >= 2-3 sentences each, in your own words, factually grounded in the fetched docs — not copied verbatim).

**Mandatory verbatim-copying check:** before committing, write a quick script (or manually compare) checking every topic body's most doc-adjacent sentence against the source doc it was drawn from, for any run of 8+ consecutive matching words. Reword any hit. Short technical terms and proper nouns (service/resource names, acronyms) don't count as copying; multi-word descriptive clauses lifted intact do. (This exact issue was found in review during the AWS site's build — catch it yourself here instead.)

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors mentioning `studyContent` or `cluster`; still reports `questions.js not present yet, skipping` and `flashcards.js not present yet, skipping`; ends with `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Cluster Architecture domain study content"
```

---

## Task 5: Cluster Architecture, Installation and Configuration — quiz questions

**Files:**
- Create: `js/data/questions.js`

**Interfaces:**
- Produces: `QUESTIONS` array (consumed by `validateQuestions` in Task 2's validator, and by `js/views/quiz.js`/`js/views/mockExam.js` in Tasks 16/18).

**Mandatory verification method for every question in every question task (this one and Tasks 7, 9, 11, 13):**

1. Before adding a question, re-read the exact source passage it's based on and explicitly confirm two things: (a) the option marked correct in `correctIndexes` is actually what the docs say, and (b) every other option is actually wrong per the docs (not just "less good"). Never add a question whose answer key you haven't just re-confirmed against the cached doc text.
2. Before committing, run an 8-word verbatim-overlap check (question + all options + explanation, against every cached doc) and reword any hit. This is mandatory, not a response to review feedback — it was a real issue found twice during the AWS site's build.
3. Before committing, check option-length balance: for multiple-choice questions, the correct option should not be the single longest option in a majority of your questions, and should not be conspicuously longer/more detailed than its distractors in any individual question. This was also a real issue found during the AWS site's build — check for it proactively rather than waiting for review to flag it.

- [ ] **Step 1: Draft and verify at least 25 questions for the Cluster Architecture domain**

Using the docs cached in Task 4 (fetch more via `fetch-doc.mjs` as needed — e.g. specific `kubectl` command references for RBAC/kubeadm), write questions distributed across the domain's sub-themes: at least 6 on RBAC, 6 on infrastructure/kubeadm cluster creation, 6 on cluster lifecycle/HA, and 6 on Helm/Kustomize/CNI/CSI/CRI/CRDs (25 minimum total). Mix `multiple-choice` (exactly 4 options, 1 correct) and `multiple-response` (5+ options, 2+ correct) — aim for roughly 80% multiple-choice / 20% multiple-response, matching the AWS site's convention.

Create `js/data/questions.js`:

```js
// js/data/questions.js
export const QUESTIONS = [
  {
    id: 'cluster-001',
    domain: 'cluster',
    questionType: 'multiple-choice',
    question: '...',
    options: ['...', '...', '...', '...'],
    correctIndexes: [0],
    explanation: '...',
  },
  // ... continue through at least cluster-025, each following the
  // verification method above before being added.
];
```

Use IDs `cluster-001` through `cluster-0NN` in order.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: no errors; `flashcards.js not present yet, skipping`; `All content validated successfully.`

Also run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number >= 25.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Cluster Architecture domain quiz questions"
```

---

## Task 6: Services and Networking — study content

**Files:**
- Modify: `js/data/studyContent.js`

**Interfaces:**
- Consumes: existing `STUDY_CONTENT` array structure from Task 4 — append new sections, don't restructure existing ones.

This domain (20% weight) covers, verbatim from the curriculum:

- Understand connectivity between Pods
- Define and enforce Network Policies
- Use ClusterIP, NodePort, LoadBalancer service types and endpoints
- Use the Gateway API to manage Ingress traffic
- Know how to use Ingress controllers and Ingress resources
- Understand and use CoreDNS

- [ ] **Step 1: Fetch supporting docs**

```
https://kubernetes.io/docs/concepts/cluster-administration/networking/
https://kubernetes.io/docs/concepts/services-networking/network-policies/
https://kubernetes.io/docs/concepts/services-networking/service/
https://kubernetes.io/docs/concepts/services-networking/gateway/
https://kubernetes.io/docs/concepts/services-networking/ingress/
https://kubernetes.io/docs/concepts/services-networking/ingress-controllers/
https://kubernetes.io/docs/concepts/services-networking/dns-pod-service/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes**

Insert 2-3 new section objects (`domain: 'services'`) before the closing `];` of `STUDY_CONTENT` — e.g. "Pod connectivity and Network Policies", "Service types and endpoints", "Ingress, the Gateway API, and CoreDNS" — each with 3-6 topics grounded in the fetched docs, covering every bullet listed above.

**Mandatory verbatim-copying check** (same method as Task 4, Step 2): run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Services and Networking domain study content"
```

---

## Task 7: Services and Networking — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Interfaces:**
- Consumes: existing `QUESTIONS` array from Task 5 — append, don't restructure existing entries.

**Verification method for every question in this task:** identical to Task 5's three-part method (re-verify each answer key against the source doc; mandatory verbatim-overlap check before committing; mandatory option-length-balance check before committing).

- [ ] **Step 1: Draft and verify at least 20 questions for the Services and Networking domain**

Using docs cached in Task 6 (fetch more as needed), write questions covering Pod connectivity/Network Policies, Service types/endpoints, and Ingress/Gateway API/CoreDNS (20 minimum, roughly evenly split). IDs `services-001` through `services-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'services').length))"`
Expected: a number >= 20.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Services and Networking domain quiz questions"
```

---

## Task 8: Workloads and Scheduling — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (15% weight) covers, verbatim from the curriculum:

- Understand application deployments and how to perform rolling update and rollbacks
- Use ConfigMaps and Secrets to configure applications
- Configure workload autoscaling
- Understand the primitives used to create robust, self-healing, application deployments
- Configure Pod admission and scheduling (limits, node affinity, etc.)

- [ ] **Step 1: Fetch supporting docs**

```
https://kubernetes.io/docs/concepts/workloads/controllers/deployment/
https://kubernetes.io/docs/concepts/configuration/configmap/
https://kubernetes.io/docs/concepts/configuration/secret/
https://kubernetes.io/docs/tasks/run-application/horizontal-pod-autoscale/
https://kubernetes.io/docs/concepts/workloads/controllers/replicaset/
https://kubernetes.io/docs/concepts/workloads/controllers/statefulset/
https://kubernetes.io/docs/concepts/workloads/controllers/daemonset/
https://kubernetes.io/docs/concepts/workloads/controllers/job/
https://kubernetes.io/docs/concepts/scheduling-eviction/assign-pod-node/
https://kubernetes.io/docs/concepts/policy/resource-quotas/
https://kubernetes.io/docs/concepts/configuration/manage-resources-containers/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes**

Insert 3-4 new section objects (`domain: 'workloads'`) — e.g. "Deployments, rolling updates, and rollbacks", "Configuring applications with ConfigMaps and Secrets", "Self-healing workload primitives (ReplicaSet, StatefulSet, DaemonSet, Job)", "Pod scheduling and admission (resource limits, node affinity)" — each with 3-6 topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Workloads and Scheduling domain study content"
```

---

## Task 9: Workloads and Scheduling — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's three-part method.

- [ ] **Step 1: Draft and verify at least 15 questions for the Workloads and Scheduling domain**

Using docs cached in Task 8, write questions covering deployments/rolling updates, ConfigMaps/Secrets, autoscaling, self-healing primitives (ReplicaSet/StatefulSet/DaemonSet/Job), and Pod scheduling/admission (15 minimum). IDs `workloads-001` through `workloads-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'workloads').length))"`
Expected: a number >= 15.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Workloads and Scheduling domain quiz questions"
```

---

## Task 10: Storage — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (10% weight) covers, verbatim from the curriculum:

- Implement storage classes and dynamic volume provisioning
- Configure volume types, access modes and reclaim policies
- Manage persistent volumes and persistent volume claims

- [ ] **Step 1: Fetch supporting docs**

```
https://kubernetes.io/docs/concepts/storage/storage-classes/
https://kubernetes.io/docs/concepts/storage/persistent-volumes/
https://kubernetes.io/docs/concepts/storage/volumes/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404.

- [ ] **Step 2: Append study notes**

Insert 2-3 new section objects (`domain: 'storage'`) — e.g. "StorageClasses and dynamic provisioning", "Volume types, access modes, and reclaim policies", "PersistentVolumes and PersistentVolumeClaims" — each with 3-6 topics grounded in the fetched docs.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Storage domain study content"
```

---

## Task 11: Storage — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's three-part method.

- [ ] **Step 1: Draft and verify at least 10 questions for the Storage domain**

Using docs cached in Task 10, write questions covering storage classes/dynamic provisioning, volume types/access modes/reclaim policies, and PV/PVC management (10 minimum). IDs `storage-001` through `storage-0NN`. Mix `multiple-choice`/`multiple-response` at roughly 80/20. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.filter(q => q.domain === 'storage').length))"`
Expected: a number >= 10.

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Storage domain quiz questions"
```

---

## Task 12: Troubleshooting — study content

**Files:**
- Modify: `js/data/studyContent.js`

This domain (30% weight, the largest) covers, verbatim from the curriculum:

- Troubleshoot clusters and nodes
- Troubleshoot cluster components
- Monitor cluster and application resource usage
- Manage and evaluate container output streams
- Troubleshoot services and networking

- [ ] **Step 1: Fetch supporting docs**

```
https://kubernetes.io/docs/tasks/debug/debug-cluster/
https://kubernetes.io/docs/tasks/debug/debug-cluster/resource-metrics-pipeline/
https://kubernetes.io/docs/tasks/debug/debug-application/debug-running-pod/
https://kubernetes.io/docs/concepts/cluster-administration/logging/
https://kubernetes.io/docs/tasks/debug/debug-application/debug-service/
https://kubernetes.io/docs/tasks/debug/debug-cluster/troubleshoot-clusters/
```

Fetch each via `node scripts/fetch-doc.mjs <url>`; use WebSearch for any that 404 (this domain's docs are more spread across "tasks/debug/" than a single concept page, so expect a couple of substitutions).

- [ ] **Step 2: Append study notes**

Insert 4-5 new section objects (`domain: 'troubleshooting'`) — e.g. "Troubleshooting clusters and nodes", "Troubleshooting cluster components (control plane, kubelet)", "Monitoring resource usage (metrics-server, kubectl top)", "Container logs and output streams", "Troubleshooting services and networking" — each with 3-6 topics grounded in the fetched docs, since this is the largest and most heavily-weighted domain.

**Mandatory verbatim-copying check**: run it before committing.

- [ ] **Step 3: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 4: Commit**

```bash
git add js/data/studyContent.js
git commit -m "Add Troubleshooting domain study content"
```

---

## Task 13: Troubleshooting — quiz questions

**Files:**
- Modify: `js/data/questions.js`

**Verification method for every question in this task:** identical to Task 5's three-part method.

- [ ] **Step 1: Draft and verify at least 30 questions for the Troubleshooting domain**

Using docs cached in Task 12, write questions distributed across cluster/node troubleshooting, cluster component troubleshooting, resource monitoring, container logs/output streams, and services/networking troubleshooting (30 minimum — this is the largest domain). Mix `multiple-choice`/`multiple-response` at roughly 80/20. IDs `troubleshooting-001` through `troubleshooting-0NN`. Insert before the closing `];` of `QUESTIONS`.

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

Run: `node -e "import('./js/data/questions.js').then(m => console.log(m.QUESTIONS.length))"`
Expected: a number >= 100 (this is the full bank across all 5 domains — confirms the Global Constraints minimum is met).

- [ ] **Step 3: Commit**

```bash
git add js/data/questions.js
git commit -m "Add Troubleshooting domain quiz questions"
```

---

## Task 14: Flashcard deck

**Files:**
- Create: `js/data/flashcards.js`

**Interfaces:**
- Produces: `FLASHCARDS` array (consumed by `validateFlashcards` in Task 2's validator, and by `js/views/flashcards.js` in Task 15).

- [ ] **Step 1: Build the deck from already-cached research**

Most of the material needed is already in `.cache/aws-docs/` from Tasks 4-13 (every major concept used across the 5 domains was fetched during those tasks). For concepts covered in earlier tasks, write the flashcard directly from the cached doc already on disk — don't refetch. Only fetch new pages for concepts not yet researched (e.g. specific object kinds mentioned only in passing during earlier tasks).

Target ~65 cards covering core Kubernetes objects and concepts referenced across the study content: Pod, ReplicaSet, Deployment, DaemonSet, StatefulSet, Job, CronJob, Namespace, Service (ClusterIP/NodePort/LoadBalancer), Ingress, Ingress Controller, Gateway API, NetworkPolicy, ConfigMap, Secret, Volume, PersistentVolume, PersistentVolumeClaim, StorageClass, Role, RoleBinding, ClusterRole, ClusterRoleBinding, ServiceAccount, kubeadm, Helm, Kustomize, CNI, CSI, CRI, CoreDNS, HorizontalPodAutoscaler, Taints and Tolerations, Node Affinity, Static Pods, kubelet, kube-apiserver, kube-scheduler, kube-controller-manager, etcd, kube-proxy, Liveness/Readiness/Startup Probes, Resource Requests/Limits, LimitRange, ResourceQuota, PodDisruptionBudget, CustomResourceDefinition, Operator pattern, Admission Controllers, Metrics Server.

```js
// js/data/flashcards.js
export const FLASHCARDS = [
  {
    id: 'pod',
    service: 'Pod',
    front: 'What is it?',
    back: '...',
  },
  // ... ~65 cards total
];
```

(The field is still named `service` for schema/validator compatibility with the copied `validate-content.mjs`, even though these are Kubernetes objects/concepts rather than AWS services — renaming it would require also editing the validator and view code, for zero behavioral benefit.)

**Mandatory verbatim-copying check**: run it before committing (same method as the study-content tasks).

- [ ] **Step 2: Validate**

Run: `node scripts/validate-content.mjs`
Expected: `All content validated successfully.`

- [ ] **Step 3: Commit**

```bash
git add js/data/flashcards.js
git commit -m "Add flashcard deck"
```

---

## Task 15: Copy the remaining views from learn_aws

**Files:**
- Copy from `learn_aws` unchanged: `js/views/studyGuide.js`, `js/views/quiz.js`, `js/views/flashcards.js`, `js/views/progress.js`
- Copy from `learn_aws`, then edit: `js/views/mockExam.js` (add the format-honesty disclaimer to the start screen)

**Interfaces:**
- Consumes: `DOMAINS`, `EXAM_FORMAT` from `js/data/examInfo.js`; `STUDY_CONTENT` from `js/data/studyContent.js`; `QUESTIONS` from `js/data/questions.js`; `FLASHCARDS` from `js/data/flashcards.js`; `isCorrect`, `estimateScaledScore`, `drawMockExam` from `js/lib/scoring.js`; `createStore` from `js/lib/storage.js` — all already produced by Tasks 2, 4-14.

These four views (`studyGuide.js`, `quiz.js`, `flashcards.js`, `progress.js`) are entirely content-agnostic — they only reference the generic data shapes above, which are identical between `learn_aws` and this project. `mockExam.js` is 99% identical but needs the disclaimer text added to its start screen.

- [ ] **Step 1: Copy the four unchanged views**

```bash
cp /Users/toddcooke/IdeaProjects/learn_aws/js/views/studyGuide.js js/views/studyGuide.js
cp /Users/toddcooke/IdeaProjects/learn_aws/js/views/quiz.js js/views/quiz.js
cp /Users/toddcooke/IdeaProjects/learn_aws/js/views/flashcards.js js/views/flashcards.js
cp /Users/toddcooke/IdeaProjects/learn_aws/js/views/progress.js js/views/progress.js
```

Run: `for f in studyGuide.js quiz.js flashcards.js progress.js; do diff /Users/toddcooke/IdeaProjects/learn_aws/js/views/$f js/views/$f; done`
Expected: no output (all four files identical).

- [ ] **Step 2: Copy mockExam.js and add the disclaimer**

```bash
cp /Users/toddcooke/IdeaProjects/learn_aws/js/views/mockExam.js js/views/mockExam.js
```

Open `js/views/mockExam.js` and find the `render(mount)` function (the exam's start screen, before `startExam` is called):

```js
export function render(mount) {
  mount.innerHTML = `
    <h2>Mock Exam</h2>
    <p>${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam.</p>
    <button type="button" id="start-exam">Start Mock Exam</button>
  `;
  document.getElementById('start-exam').addEventListener('click', () => startExam(mount));
}
```

Replace it with:

```js
export function render(mount) {
  mount.innerHTML = `
    <h2>Mock Exam</h2>
    <p>${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam's domains.</p>
    <p class="exam-note">The real CKA exam is 100% hands-on (command-line tasks in a live cluster), not multiple-choice. This mock exam reinforces the same knowledge but isn't a replica of the real exam experience — pair it with hands-on practice (kind, minikube, killer.sh).</p>
    <button type="button" id="start-exam">Start Mock Exam</button>
  `;
  document.getElementById('start-exam').addEventListener('click', () => startExam(mount));
}
```

This is the only change to the file — every other function (`startExam`, `finishExam`, timer logic, results rendering) stays exactly as copied.

Run: `diff /Users/toddcooke/IdeaProjects/learn_aws/js/views/mockExam.js js/views/mockExam.js`
Expected: a small diff showing only the `render(mount)` function's template string changed (the added `<p class="exam-note">...</p>` line and the tweaked first sentence).

- [ ] **Step 3: Verify all five views in the browser**

With the server running (`preview_start` with name `site`):

1. `#/study` → click through all 5 domains — content renders for each (no "Coming soon"), no console errors.
2. `#/quiz` → pick a domain, answer a question, submit — instant feedback + explanation, "Next Question" advances, results screen shows a score at the end.
3. `#/flashcards` → flip a card, mark it known, toggle "show only unknown" — filtering works.
4. `#/exam` → confirm the disclaimer paragraph renders on the start screen before clicking "Start Mock Exam"; start the exam, confirm 60 questions total and the countdown timer starts near 90:00; answer through to the end and submit — results screen shows percent correct against the 66% passing line and a per-domain breakdown summing to 60.
5. `#/progress` → confirm the quiz and mock exam attempts from steps 2 and 4 show up.
6. Check `preview_console_logs` at level `'error'` across the whole walkthrough — expect no errors.

- [ ] **Step 4: Commit**

```bash
git add js/views/studyGuide.js js/views/quiz.js js/views/flashcards.js js/views/progress.js js/views/mockExam.js
git commit -m "Add remaining views (copied from learn_aws; mock exam start screen carries the format-honesty disclaimer)"
```

---

## Task 16: Final integration, README, and full walkthrough

**Files:**
- Modify: `README.md`

- [ ] **Step 1: Run the full automated check suite**

```bash
node --test js/lib
node scripts/validate-content.mjs
```

Expected: all `node --test` cases pass; validator prints `All content validated successfully.`

- [ ] **Step 2: Write the final README**

```markdown
# CKA Exam Prep

An unofficial study site for the Certified Kubernetes Administrator (CKA) exam. Not affiliated with or endorsed by the Linux Foundation or CNCF.

Live at https://toddcooke.github.io/learn/kubernetes/. A companion to https://toddcooke.github.io/learn/aws/.

## Running it

No install step. From this directory:

```
python3 -m http.server 8001
```

Then open http://localhost:8001/ in a browser. (A plain `file://` open won't work — browsers block ES module imports over `file://`.)

## A note on format

The real CKA exam is 100% hands-on — you solve tasks in a live cluster via the command line, not multiple-choice questions. This site's quizzes and mock exam test the same underlying knowledge in multiple-choice form, which is easier to self-check but is not a replica of the real exam. Pair this with hands-on practice using [kind](https://kind.sigs.k8s.io/), [minikube](https://minikube.sigs.k8s.io/), or [killer.sh](https://killer.sh/) for genuine exam readiness.

## What's here

- **Study guide** — organized by the exam's 5 official curriculum domains.
- **Domain quizzes** — 100+ practice questions with instant feedback and explanations.
- **Flashcards** — a cheat-sheet deck of core Kubernetes objects and concepts with known/unknown tracking.
- **Mock exam** — a 60-question, 90-minute timed exam weighted by domain, scored against the real exam's 66% passing line.
- **Progress dashboard** — quiz and mock exam history, flashcard mastery, all stored locally in your browser (`localStorage`, nothing sent anywhere).

## How the content was sourced

Exam structure, domain weightings, and the curriculum come from the official CNCF CKA curriculum (github.com/cncf/curriculum) and Linux Foundation training/FAQ pages, fetched 2026-07-08 — see [docs/superpowers/specs/2026-07-08-cka-exam-prep-design.md](docs/superpowers/specs/2026-07-08-cka-exam-prep-design.md) for details. Every quiz question was drafted from and checked against the relevant kubernetes.io documentation before being added. Fetched doc pages are cached locally under `.cache/aws-docs/` (gitignored; directory name kept for consistency with tooling shared with the AWS exam prep site) so re-running the content pipeline doesn't re-hit the network for pages already fetched.

## Development

This project's application code (router, storage/scoring libraries, view components, content tooling) is shared architecture with [learn_aws](https://github.com/toddcooke/learn_aws) — only the content data files and the mock exam's disclaimer differ. See that project's README for more on the tooling itself.

- `node --test js/lib` — runs unit tests for the pure storage/scoring logic.
- `node scripts/validate-content.mjs` — validates the shape of every `js/data/*.js` file.
- `node scripts/fetch-doc.mjs <url>` — fetches and caches a doc page for content research.
```

- [ ] **Step 3: Full manual walkthrough**

With the server running (`preview_start` with name `site`), walk through every feature end to end (this repeats Task 15 Step 3's walkthrough as a final full-system check, now that the README and final commit are in place):

1. `#/` — exam overview and disclaimer render correctly.
2. `#/study` → click through all 5 domains — content renders for each, no console errors.
3. `#/quiz` → run one domain quiz to completion — feedback, scoring, and results all work.
4. `#/flashcards` → flip a few cards, mark 2-3 known, toggle the "unknown only" filter — filtering works.
5. `#/exam` → start a mock exam, answer through to the end, submit — results screen renders with a per-domain breakdown summing to 60 and a percent-correct score against the 66% line.
6. `#/progress` → confirm all of the above activity shows up.
7. Reload the page and revisit `#/progress` — expected: everything persisted.
8. Check `preview_console_logs` with `level: 'error'` across the whole walkthrough — expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add README.md
git commit -m "Finalize README and complete end-to-end verification"
```
