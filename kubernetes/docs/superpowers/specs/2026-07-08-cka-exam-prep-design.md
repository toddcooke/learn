# Certified Kubernetes Administrator (CKA) Exam Prep Site

Status: Approved
Date: 2026-07-08

## Purpose

Build a static, local-first website that helps someone study for the
Certified Kubernetes Administrator (CKA) exam, following the same design
and architecture as the existing AWS SAA-C03 exam prep site
(`learn_aws`, published at https://toddcooke.github.io/learn/aws/). It
combines a study guide organized by the official CKA curriculum's
domains, a large practice question bank, flashcards, a timed mock exam,
and a progress dashboard — content researched from official CNCF/Linux
Foundation and kubernetes.io documentation, not written from unverified
memory.

This is a second "learning module" in the `toddcooke.github.io` hub
(alongside `aws/`), published at `https://toddcooke.github.io/learn/kubernetes/`.

## Naming

- **GitHub repo:** `toddcooke/learn_kubernetes` (confirmed available — no
  naming conflict on GitHub).
- **Local working directory:** `~/IdeaProjects/learn_kubernetes_site` —
  NOT `~/IdeaProjects/learn_kubernetes`, which already contains an
  unrelated, pre-existing hands-on Kubernetes lab tool (`learnctl` CLI,
  lab modules, cluster verifiers, a quiz system, and a Python test
  suite). That project must not be touched, read into, or referenced by
  this work — it is a separate, already-in-progress project belonging to
  the user.
- **Published path:** `https://toddcooke.github.io/learn/kubernetes/`,
  via a submodule at `static/learn/kubernetes` in `toddcooke.github.io`
  (the repo name and the submodule path do not need to match — the
  existing hourly `sync-learn-submodules.yml` workflow in
  `toddcooke.github.io` discovers submodules generically from
  `.gitmodules`, so no changes are needed there for this new module).

## Source of truth for exam structure

Confirmed directly from CNCF and the Linux Foundation as of 2026-07-08:

- Exam: **Certified Kubernetes Administrator (CKA)**, curriculum version
  tied to **Kubernetes v1.35**
- Format: **online, proctored, performance-based** — candidates solve
  tasks from a command line against live clusters. This is fundamentally
  different from AWS SAA-C03's multiple-choice format (see "Format
  honesty" below).
- Duration: **2 hours**; approximately 15–20 performance-based tasks
  (the Linux Foundation does not publish an exact count)
- Passing score: **66%**; certification valid **2 years**
- Domains and weightings:
  1. Cluster Architecture, Installation and Configuration — **25%**
  2. Services and Networking — **20%**
  3. Workloads and Scheduling — **15%**
  4. Storage — **10%**
  5. Troubleshooting — **30%**
- Source pages:
  - https://www.cncf.io/certification/cka/
  - https://github.com/cncf/curriculum (`CKA_Curriculum_v1.35.pdf`,
    `cka/README.md`)
  - https://training.linuxfoundation.org/certification/certified-kubernetes-administrator-cka/
  - https://docs.linuxfoundation.org/tc-docs/certification/faq-cka-ckad-cks

Unlike the AWS exam guide, the CKA curriculum does not subdivide each
domain into numbered task statements — each domain is a flat bullet list
of competencies (see the curriculum PDF/README above for the exact
bullets per domain). The study content design (below) adapts to this by
introducing informal thematic groupings within each domain.

## Format honesty

The real CKA exam has no multiple-choice component at all. This site's
quizzes and mock exam test the *same underlying knowledge* (kubectl
commands, YAML manifests, troubleshooting logic, core concepts) through
multiple-choice and multiple-response questions — the same format the
AWS site uses — but this is explicitly **not** a replica of the real
exam experience. A visible, honest callout appears on the home page and
at the top of the mock exam start screen stating that the real exam is
100% hands-on, that passing this site's mock exam is not equivalent to
being ready for the real exam, and recommending hands-on practice (kind,
minikube, or killer.sh) as the actual exam preparation.

## Architecture: reuse, not rebuild

The AWS site's entire application layer is content-agnostic and requires
**no code changes** for this module:

- `js/app.js` (router), `css/style.css` (base styles), all six
  `js/views/*.js` view components, `js/lib/scoring.js`,
  `scripts/fetch-doc.mjs`, and `scripts/validate-content.mjs` are copied
  over unchanged.
- `js/lib/storage.js` is copied with exactly **one** change: its
  `NAMESPACE` constant must change from `'saa-prep'` to `'cka-prep'`.
  This is not optional — both sites are published under the same
  `toddcooke.github.io` origin, and `localStorage` partitions by origin
  only, not by path. Copying this file truly unchanged would make the
  two modules' quiz history, flashcard state, and mock exam attempts
  silently collide in the same browser.
- `js/lib/scoring.js`'s `estimateScaledScore(correct, total, {minScore,
  maxScore})` already computes a plain percentage when called with
  `minScore: 0, maxScore: 100` — which is exactly what CKA's "66% to
  pass" format needs. No scoring logic changes.
- `scripts/fetch-doc.mjs`'s generic HTML-stripping fallback (used for
  any URL that isn't a `docs.aws.amazon.com` page with a `.md` sibling)
  was verified against a live kubernetes.io page during design and
  produces clean, readable text. No fetch/caching logic changes.
- Only `js/data/examInfo.js` (new domain/format constants),
  `js/data/studyContent.js`, `js/data/questions.js`,
  `js/data/flashcards.js` (new content), and cosmetic copy (site title,
  home page text, the format-honesty disclaimer) are new for this
  module.

### Local doc cache

Same as the AWS site: every fetched page is cached to
`.cache/aws-docs/<slug>.md` (directory name kept as `aws-docs` for
consistency with the copied tooling, even though this project fetches
CNCF/kubernetes.io pages — renaming it would be a purely cosmetic,
zero-value change to working, reviewed code) keyed by URL, via
`scripts/fetch-doc.mjs`. `.cache/` is gitignored.

## File tree

```
learn_kubernetes_site/
  index.html                 - app shell (copied from learn_aws, title/copy updated)
  css/
    style.css                - copied from learn_aws unchanged
  js/
    app.js                   - copied from learn_aws unchanged (router)
    views/
      home.js                - copied, home page text + format-honesty disclaimer updated
      studyGuide.js           - copied unchanged
      quiz.js                 - copied unchanged
      flashcards.js           - copied unchanged
      mockExam.js             - copied unchanged (disclaimer added to start screen)
      progress.js             - copied unchanged
    data/
      examInfo.js             - NEW: CKA domains, weights, mock exam format
      studyContent.js         - NEW: CKA study content
      questions.js             - NEW: CKA question bank
      flashcards.js            - NEW: CKA flashcard deck
    lib/
      storage.js               - copied from learn_aws with NAMESPACE changed
                                  from 'saa-prep' to 'cka-prep' (see
                                  Architecture section — this is required,
                                  not cosmetic)
      storage.test.mjs         - copied from learn_aws unchanged (asserts
                                  behavior, not the namespace string, so
                                  needs no edit)
      scoring.js                - copied from learn_aws unchanged
      scoring.test.mjs          - copied from learn_aws unchanged
  scripts/
    fetch-doc.mjs              - copied from learn_aws unchanged
    validate-content.mjs       - copied from learn_aws unchanged (schema is generic)
  README.md                    - new content, same structure as learn_aws's
  .gitignore                   - copied from learn_aws unchanged
```

### Data shapes

Identical to the AWS site's schema (validated by the same, unmodified
`validate-content.mjs`):

```js
// data/examInfo.js
export const DOMAINS = [
  { id: 'cluster', name: 'Cluster Architecture, Installation and Configuration', weight: 25, mockExamCount: 15 },
  { id: 'services', name: 'Services and Networking', weight: 20, mockExamCount: 12 },
  { id: 'workloads', name: 'Workloads and Scheduling', weight: 15, mockExamCount: 9 },
  { id: 'storage', name: 'Storage', weight: 10, mockExamCount: 6 },
  { id: 'troubleshooting', name: 'Troubleshooting', weight: 30, mockExamCount: 18 },
];
export const EXAM_FORMAT = {
  totalQuestions: 100, // size of the full practice bank, not the mock exam draw
  mockExamQuestions: 60,
  durationMinutes: 90, // mock exam timer; real exam is 120 minutes of hands-on tasks
  passingScore: 66,
  minScore: 0,
  maxScore: 100,
};
```

`DOMAINS[].weight` sums to 100; `DOMAINS[].mockExamCount` sums to 60
(`EXAM_FORMAT.mockExamQuestions`). `questions.js`, `flashcards.js`, and
`studyContent.js` use the exact same shapes as the AWS site
(`{id, domain, questionType, question, options[], correctIndexes[],
explanation}`, `{id, service, front, back}` — renamed conceptually to
"object/concept" instead of "service" but keeping the same field name
for schema/validator reuse — and `{domain, taskStatement, topics:
[{title, body}]}` respectively).

## Content pipeline

Same adversarial-verification approach as the AWS site, since a wrong
answer key is just as harmful here:

1. **Fan-out research per domain.** For each of the 5 domains, gather
   the curriculum's competency bullets (already fetched into this spec's
   source-of-truth section above) and fetch the relevant kubernetes.io
   documentation pages (and CNCF curriculum materials) for each
   referenced concept (Pods, Deployments, Services, Ingress, ConfigMaps/
   Secrets, RBAC, storage classes/PV/PVC, CoreDNS, kubeadm, Helm,
   Kustomize, CNI/CSI/CRI, troubleshooting/`kubectl` debugging commands,
   etc.), cached via `fetch-doc.mjs`.
2. **Draft per topic.** Study notes (grouped thematically per domain,
   since CKA's curriculum has no official sub-task-statement layer) and
   draft quiz questions grounded in the fetched docs.
3. **Adversarial verification.** Every draft question is independently
   checked by trying to refute the marked correct answer against the
   source docs before it's accepted. Questions that fail are discarded
   or reworked.
4. **Verbatim-copying and answer-length checks, built in from the
   start.** During the AWS site's build, two review rounds caught (a)
   near-verbatim copying from source docs in explanations and options,
   and (b) a systematic "longest answer is correct" tell in multiple-
   choice options. Both checks are written into this project's task
   instructions up front rather than discovered via review iteration.
5. **Assembly.** Verified content is compiled into the static JS data
   files above.

Target volume: **100 practice questions total**, matching domain weight
percentages directly as counts (Cluster Architecture 25, Services and
Networking 20, Workloads and Scheduling 15, Storage 10, Troubleshooting
30 — sums to exactly 100), mixed ~80% multiple-choice / 20%
multiple-response to match the AWS site's convention. Flashcard deck:
~60–70 cards covering core Kubernetes objects and concepts (Pod,
Deployment, ReplicaSet, DaemonSet, StatefulSet, Job/CronJob, Service
types, Ingress, NetworkPolicy, ConfigMap, Secret, PersistentVolume/
PersistentVolumeClaim/StorageClass, RBAC primitives (Role, ClusterRole,
RoleBinding, ClusterRoleBinding), Namespace, kubeadm, Helm, Kustomize,
CNI/CSI/CRI, CoreDNS, HorizontalPodAutoscaler, etc.).

## Features

Identical feature set to the AWS site:

- **Study guide** — sidebar organized by the 5 official domains, each
  with thematically-grouped topics and "exam tip" callouts.
- **Domain quizzes** — pick a domain, answer questions drawn from that
  domain's bank, instant per-question feedback with explanation.
- **Flashcards** — flip-card per Kubernetes object/concept; mark known/
  unknown; filter to just what still needs review.
- **Mock exam** — 60 questions drawn and weighted by domain percentage,
  90-minute countdown timer, results screen showing percent correct
  against the 66% passing line and a per-domain breakdown. The mock exam
  start screen carries the format-honesty disclaimer from above.
- **Progress dashboard** — quiz history, mock exam attempts, flashcard
  mastery, all read from localStorage (namespaced separately from the
  AWS site's `saa-prep:` keys, e.g. `cka-prep:`, since both sites will
  eventually share the `toddcooke.github.io` origin under different
  paths but each module's data should stay independent).

## Verification approach

Same as the AWS site: (1) the adversarial content-verification pass
described above, including the verbatim-copying and answer-length
checks; (2) a manual end-to-end browser walkthrough before calling the
build done — study guide navigation across all 5 domains, a full domain
quiz, flashcard flipping/filtering, a complete 60-question mock exam
through to the results screen, and confirming progress persists across a
page reload.

## Explicitly out of scope

- No backend, no build tooling, no external database — same constraints
  as the AWS site.
- No actual hands-on/cluster-verification component (no real `kubectl`
  execution, no live cluster). That is a fundamentally different kind of
  tool from what's being built here — notably, there is already a
  separate, unrelated, pre-existing project at
  `~/IdeaProjects/learn_kubernetes` (`learnctl`) that appears to take
  that hands-on/cluster-verification approach, though it was not
  inspected in detail for this spec. This site is deliberately scoped to
  knowledge reinforcement via multiple-choice, matching the AWS site's
  proven format, and the two projects are independent.
- No deployment/hosting work beyond the submodule + existing sync
  workflow described above — no new GitHub Actions workflow needed.
- No user accounts/auth — all state is local to the browser via
  localStorage.
