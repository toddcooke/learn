# AWS Certified Solutions Architect – Associate (SAA-C03) Exam Prep Site

Status: Approved
Date: 2026-07-07

## Purpose

Build a static, local-first website that helps someone study for and pass the
AWS Certified Solutions Architect – Associate exam (SAA-C03). The site
combines a study guide organized by the official exam domains, a large
practice question bank, flashcards, a realistic timed mock exam, and a
progress dashboard — all backed by content researched from the official AWS
exam guide and AWS service documentation (not written from unverified
memory).

## Source of truth for exam structure

Confirmed directly from AWS as of 2026-07-07:

- Exam code: **SAA-C03**
- 65 total questions: **50 scored + 15 unscored** (unscored questions are not
  identified during the exam)
- Duration: **130 minutes**
- Question types: **multiple choice** (1 correct of 4) and **multiple
  response** (2+ correct of 5+ options)
- Scoring: scaled **100–1000**, passing score **720**, compensatory (no
  per-section minimum, only the overall score matters)
- Domains and weightings:
  1. Design Secure Architectures — **30%**
  2. Design Resilient Architectures — **26%**
  3. Design High-Performing Architectures — **24%**
  4. Design Cost-Optimized Architectures — **20%**
- Source pages:
  - https://aws.amazon.com/certification/certified-solutions-architect-associate/
  - https://docs.aws.amazon.com/aws-certification/latest/solutions-architect-associate-03/solutions-architect-associate-03.html
    (and its linked domain 1–4 / in-scope / out-of-scope service pages)

## Content pipeline

Content is treated as a research artifact, not something written from
unverified memory, because a wrong answer key actively hurts a learner.

1. **Fan-out research per domain.** For each of the 4 domains, gather the
   task statements from the official exam guide's domain pages, then fetch
   the AWS documentation for each in-scope service referenced by that
   domain's task statements (e.g. EC2, S3, VPC, IAM, RDS, DynamoDB, Lambda,
   ELB/ASG, Route 53, CloudFront, KMS, SQS/SNS, EFS, Storage Gateway, Well-
   Architected Framework, etc.), cross-checked against the exam guide's
   "In-Scope AWS Services" / "Out-of-Scope AWS Services" pages so content
   doesn't drift into things the real exam won't cover.
2. **Draft per topic.** For each researched topic, produce: study notes
   (concepts, key facts, common gotchas, exam tips) and a batch of draft quiz
   questions with a marked correct answer and explanation, grounded in the
   fetched docs.
3. **Adversarial verification.** Every draft question is independently
   checked by trying to refute the marked correct answer against the source
   docs before it's accepted into the bank. Questions that fail verification
   are discarded or reworked — never shipped with an unverified answer key.
4. **Assembly.** Verified study notes, questions, and flashcards are compiled
   into the static JS data files described below.

### Local doc cache (not checked in)

Every AWS page fetched during research (exam guide pages, service docs, etc.)
is saved verbatim to `.cache/aws-docs/<slug>.md` keyed by a filesystem-safe
slug of its URL, with a `.cache/aws-docs/index.json` mapping URL → slug →
fetch date. Before fetching a URL, the pipeline checks this cache first and
reuses the cached copy if present, so no doc is fetched from AWS more than
once across the whole research effort (including if the pipeline is re-run
later, e.g. to add more questions or refresh content). This directory is
gitignored — it's a local convenience cache, not a content deliverable.

Target volume: 100+ scored practice questions total, distributed roughly by
domain weighting (e.g. ~30 Secure, ~26 Resilient, ~24 High-Performing, ~20
Cost-Optimized, rounded to reasonable batch sizes), plus a flashcard deck
covering the major in-scope services (~60–80 cards).

## Architecture

Static site, **no build step**, opens directly via `file://` (data is
embedded as ES module JS, not fetched JSON, so there's no CORS issue running
without a local server).

```
learn_aws/
  index.html                 - app shell: header, sidebar nav, content mount point
  css/
    style.css                - clean minimal light theme (white background,
                                simple typography, blue/gray accents)
  js/
    app.js                   - hash-based router (#/study/<domain>, #/quiz/<domain>,
                                #/flashcards, #/exam, #/progress) + view mounting
    views/
      home.js                - landing page: exam overview, format, how to use the site
      studyGuide.js           - renders domain -> task statement -> topic content
      quiz.js                 - domain quiz runner: question, options, submit,
                                instant feedback + explanation, running score
      flashcards.js           - flip-card UI, mark known/unknown, filter to unknown
      mockExam.js             - 65-question timed mock exam + results/review screen
      progress.js             - dashboard reading from localStorage history
    data/
      examInfo.js             - domains, weightings, format constants (from exam guide)
      studyContent.js         - per-domain study notes content
      questions.js            - question bank: {id, domain, question, options[],
                                correctIndexes[], explanation, questionType}
      flashcards.js           - flashcard deck: {id, service, front, back}
    lib/
      storage.js              - localStorage read/write helpers for quiz history,
                                flashcard known-state, mock exam attempts
  README.md                   - what this is, how to open it, how content was sourced
```

### Data shapes

```js
// data/examInfo.js
export const DOMAINS = [
  { id: 'secure', name: 'Design Secure Architectures', weight: 30 },
  { id: 'resilient', name: 'Design Resilient Architectures', weight: 26 },
  { id: 'performant', name: 'Design High-Performing Architectures', weight: 24 },
  { id: 'cost', name: 'Design Cost-Optimized Architectures', weight: 20 },
];
export const EXAM_FORMAT = {
  totalQuestions: 65, scoredQuestions: 50, unscoredQuestions: 15,
  durationMinutes: 130, passingScore: 720, minScore: 100, maxScore: 1000,
};

// data/questions.js
export const QUESTIONS = [
  {
    id: 'secure-001',
    domain: 'secure',
    questionType: 'multiple-choice', // or 'multiple-response'
    question: '...',
    options: ['...', '...', '...', '...'],
    correctIndexes: [1],
    explanation: '...',
  },
  // ...100+
];

// data/flashcards.js
export const FLASHCARDS = [
  { id: 'ec2', service: 'Amazon EC2', front: 'What is it for?', back: '...' },
  // ...
];
```

`lib/storage.js` persists: per-domain quiz attempt history, flashcard
known/unknown state, and mock exam attempt history (score, timestamp,
per-domain breakdown) under a namespaced localStorage key.

## Features

- **Study guide** — sidebar organized by the 4 official domains, drilling
  into task statements and topics, with "exam tip" callouts.
- **Domain quizzes** — pick a domain, answer questions drawn from that
  domain's bank, instant per-question feedback with explanation, running
  score at the end.
- **Flashcards** — flip-card per AWS service; mark known/unknown; filter to
  just what still needs review. State persists in localStorage.
- **Mock exam** — 65 questions randomly drawn and weighted by domain
  percentage, 130-minute countdown timer, end-of-exam review screen showing
  a scaled score estimate (100–1000, pass line at 720) and a per-domain
  breakdown.
- **Progress dashboard** — quiz history, mock exam attempts over time, and
  flashcard mastery percentage, all read from localStorage.

## Verification approach

No unit-test framework is warranted for a static content site. Verification
is:

1. The adversarial content-verification pass described above (every quiz
   answer key is checked against source docs before inclusion).
2. A manual end-to-end browser walkthrough before calling the build done:
   study guide navigation across all 4 domains, taking a full domain quiz,
   flipping and filtering flashcards, running a complete 65-question mock
   exam through to the results screen, and confirming progress persists
   across a page reload.

## Explicitly out of scope

- No backend, no build tooling (npm/webpack/etc.), no external database.
- No deployment/hosting setup in this pass — site is for local use
  (`open index.html` or a trivial local static server); GitHub Pages setup
  can be a follow-up if wanted later.
- No user accounts/auth — all state is local to the browser via
  localStorage.
