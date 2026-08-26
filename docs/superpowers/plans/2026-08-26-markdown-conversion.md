# Markdown Conversion Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the five browser-based study modules with plain markdown read locally, rewire the Anki export to read that markdown, and sever this repo's publishing relationship with `toddcooke.github.io`.

**Architecture:** A one-shot converter script (run from the scratchpad, never committed) reads each module's `js/data/*.js` and emits markdown. A verifier re-parses that markdown and asserts it reproduces every source record byte-for-byte. Only after verification passes — and after the rewritten Anki exporter is proven to produce output identical to today's — is the application layer deleted. The permanent new code is a small, tested flashcard-markdown parser that the Anki exporter consumes.

**Tech Stack:** Node 22, ESM, `node:test` + `node:assert/strict`. No dependencies.

## Global Constraints

- **No npm dependencies, no build step, no framework.** Node built-ins only (`node:fs`, `node:path`, `node:url`, `node:test`, `node:assert/strict`). This is a standing repo rule repeated in every module's plan.
- **Prose is carried verbatim.** Never reword, retitle, reorder, or reformat any content. This is a format migration, not an editing pass.
- **ESM only.** Scripts are `.mjs` and use `import`/`export`.
- **The Anki output contract is frozen.** Note IDs (`<module>-<card id>`), tags (`<module>::<slugified domain>`), front composition (`<service> — <front>`), the four-column tab-separated shape, and the three `#` header lines must not change. Any change duplicates 579 notes in Todd's decks instead of updating them.
- **Nothing is deleted before verification passes.** `js/data/*.js` must survive until both the round-trip verifier (Task 1-4) and the golden Anki diff (Task 5) are green.
- **Tag-like placeholders are backtick-wrapped on emit and unwrapped on parse.** Bare tokens such as `<name>` and `<pod>` match CommonMark's raw-HTML open-tag grammar, so every markdown renderer passes them through as HTML and the browser drops them — `kubectl get svc <name>` would display as `kubectl get svc`. The app escaped every field before rendering, so this would be a regression, not a pre-existing flaw. Every emitter runs interpolated prose through `mdText`; every parser reverses it with `unmdText`. 74 tokens are affected, all in kubernetes (29 study, 20 questions, 25 flashcards). Verified safe: none already sits inside a backticked span, and no source prose contains a backticked tag-like token, so the inverse is exact.
- **Commit after every task.** Never batch two tasks into one commit.
- **Work on the `markdown-conversion` branch.** Do not commit to `main`.

## Deviation from the spec, deliberately

The spec states CI drops to a single step (`node scripts/export-anki.mjs`). This plan uses **two** steps, adding `node --test scripts/lib/*.test.mjs`. Reason: the migration deletes 22 test files and introduces new parsing logic that is the sole thing protecting the Anki sync. Shipping that parser untested would be a net regression in a change whose stated goal includes keeping the decks working. The spec's intent — "CI's remaining job is protecting the Anki sync" — is preserved and strengthened.

---

## File Structure

**Created and committed:**

| Path | Responsibility |
|---|---|
| `<module>/study/NN-<domain-id>.md` (27 files) | One exam domain of study prose |
| `<module>/questions.md` (5 files) | That module's whole question bank |
| `<module>/flashcards.md` (5 files) | That module's whole flashcard deck; parsed by the Anki exporter |
| `aws/services.md` | The 74-entry AWS services reference |
| `scripts/lib/flashcard-md.mjs` | Parse `flashcards.md` into card records. Pure, no I/O. |
| `scripts/lib/flashcard-md.test.mjs` | Tests for the parser, including every failure mode |

**Modified:** `scripts/export-anki.mjs` (input source only), `.github/workflows/ci.yml`, `README.md`, five `<module>/README.md`, five `<module>/cheatsheet.html`, `aws/vpc-explorer.html`.

**Deleted (127 tracked files):** every `<module>/index.html` (5), `<module>/js/**` (111), `<module>/css/**` (5), `<module>/scripts/validate-content.mjs` (5), `scripts/check-drift.mjs` (1).

**Created but NOT committed** (scratchpad only): `convert.mjs`, `verify.mjs`, `golden/`.

Throughout this plan, `$SCRATCH` means the session scratchpad directory. All `node` commands are run **from the repo root**, because the converter resolves modules relative to `process.cwd()`.

---

### Task 1: Converter scaffold and study markdown

**Files:**
- Create: `$SCRATCH/convert.mjs`
- Create: `$SCRATCH/verify.mjs`
- Create: `aws/study/01-secure.md` … `networking/study/05-troubleshooting.md` (27 files)

**Interfaces:**
- Produces: `convert.mjs` exports `MODULES` (sorted string array), `load(module, file)` (dynamic import of a `js/data` file), `MODULE_TITLES` (record), `pad(n)`, and `studyMarkdown(domain, sections)`. Tasks 2-4 add emitters to this same file and reuse `MODULES`, `load`, `MODULE_TITLES`, and `pad`.
- Produces: `verify.mjs` exports nothing; it is run directly and exits non-zero on any mismatch. Tasks 2-4 extend it.

**Context the implementer needs:**

`js/data/studyContent.js` exports `STUDY_CONTENT`, an array of `{ domain, taskStatement, topics }` where `topics` is `[{ title, body }]`. `js/data/examInfo.js` exports `DOMAINS`, an array of `{ id, name, weight, mockExamCount }`. Sections are already contiguous and in `DOMAINS` order in every module, but the converter groups by `domain.id` anyway rather than relying on that.

One body in `postgres` (`schema-design` → "Declaring a Foreign Key") contains two paragraphs separated by a blank line. Every other body across all 593 topics is a single line. The parser must preserve internal blank lines, so it captures everything between headings and trims only the outer whitespace.

- [ ] **Step 1: Write the converter scaffold and study emitter**

Create `$SCRATCH/convert.mjs`:

```js
// convert.mjs — one-shot migration of js/data/*.js to markdown.
// Run from the repo root: node "$SCRATCH/convert.mjs"
// Not committed: once js/data is deleted this script has no further use.
import { mkdirSync, writeFileSync, readdirSync, existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';
import { join } from 'node:path';

const REPO = process.cwd();

export const MODULES = readdirSync(REPO, { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(join(REPO, e.name, 'js/data/studyContent.js')))
  .map((e) => e.name)
  .sort();

export const load = (module, file) =>
  import(pathToFileURL(join(REPO, module, 'js/data', file)).href);

// Display titles for the H1 of questions.md / flashcards.md / services.md.
// The directory name alone reads poorly as a document title.
export const MODULE_TITLES = {
  aws: 'AWS SAA-C03',
  kubernetes: 'CKA',
  networking: 'CompTIA Network+',
  postgres: 'PostgreSQL',
  sre: 'Site Reliability Engineering',
};

export const pad = (n) => String(n).padStart(2, '0');

// Bare placeholders like <name> or <pod> match CommonMark's raw-HTML open-tag
// grammar, so every markdown renderer passes them through as HTML and the
// browser drops them as empty unknown elements — "kubectl get svc <name>"
// would display as "kubectl get svc". The old app escaped every field before
// rendering, so these displayed correctly; markdown must not regress that.
// Wrapping each token in backticks renders it as inline code, which is what
// these placeholders are. Verified against the source: 74 such tokens exist
// (all in kubernetes), none already sits inside a backticked span, and no
// source prose contains a backticked tag-like token — so unmdText in
// verify.mjs and in scripts/lib/flashcard-md.mjs is an exact inverse.
const TAG_LIKE = /<\/?[A-Za-z][A-Za-z0-9-]*\s*\/?>/g;

export const mdText = (text) => text.replace(TAG_LIKE, (t) => `\`${t}\``);

export function studyMarkdown(domain, sections) {
  const topicCount = sections.reduce((n, s) => n + s.topics.length, 0);
  const out = [
    `# ${mdText(domain.name)}`,
    '',
    `${domain.weight}% of the exam · ${topicCount} topics`,
    '',
  ];
  for (const section of sections) {
    out.push(`## ${mdText(section.taskStatement)}`, '');
    for (const topic of section.topics) {
      out.push(`### ${mdText(topic.title)}`, '', mdText(topic.body), '');
    }
  }
  return out.join('\n').replace(/\n+$/, '') + '\n';
}

export async function convertStudy(module) {
  const { DOMAINS } = await load(module, 'examInfo.js');
  const { STUDY_CONTENT } = await load(module, 'studyContent.js');
  mkdirSync(join(REPO, module, 'study'), { recursive: true });
  DOMAINS.forEach((domain, i) => {
    const sections = STUDY_CONTENT.filter((s) => s.domain === domain.id);
    if (sections.length === 0) {
      throw new Error(`${module}: no study sections for domain "${domain.id}"`);
    }
    writeFileSync(
      join(REPO, module, 'study', `${pad(i + 1)}-${domain.id}.md`),
      studyMarkdown(domain, sections),
    );
  });
  const unknown = [...new Set(STUDY_CONTENT.map((s) => s.domain))]
    .filter((d) => !DOMAINS.some((x) => x.id === d));
  if (unknown.length > 0) {
    throw new Error(`${module}: study sections in unknown domains: ${unknown.join(', ')}`);
  }
  return DOMAINS.length;
}

if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const module of MODULES) {
    const n = await convertStudy(module);
    console.log(`${module}: ${n} study files`);
  }
}
```

- [ ] **Step 2: Run the converter**

Run: `node "$SCRATCH/convert.mjs"`

Expected: five lines, `aws: 4 study files` through `sre: 6 study files`, totalling 27.

- [ ] **Step 3: Write the verifier**

Create `$SCRATCH/verify.mjs`. This re-parses the generated markdown and deep-compares it against `js/data`. It must never be softened to "close enough" — a mismatch is a failed migration.

```js
// verify.mjs — asserts the generated markdown reproduces js/data exactly.
// Run from the repo root: node "$SCRATCH/verify.mjs"
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import assert from 'node:assert/strict';
import { MODULES, load, pad } from './convert.mjs';

const REPO = process.cwd();
const read = (...p) => readFileSync(join(REPO, ...p), 'utf8');
const counts = { topics: 0, questions: 0, flashcards: 0, services: 0 };

// Exact inverse of convert.mjs's mdText. Only strips backticks that wrap a
// tag-like token, so genuinely backticked prose in the source is untouched.
const BACKTICKED_TAG = /`(<\/?[A-Za-z][A-Za-z0-9-]*\s*\/?>)`/g;

export const unmdText = (text) => text.replace(BACKTICKED_TAG, '$1');

export function parseStudy(text) {
  const sections = [];
  let section = null;
  let topic = null;
  let buf = [];
  const flush = () => {
    if (topic) {
      topic.body = unmdText(buf.join('\n').trim());
      section.topics.push(topic);
      topic = null;
    }
    buf = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      section = { taskStatement: unmdText(line.slice(3).trim()), topics: [] };
      sections.push(section);
    } else if (line.startsWith('### ')) {
      flush();
      topic = { title: unmdText(line.slice(4).trim()), body: '' };
    } else if (topic) {
      buf.push(line);
    }
  }
  flush();
  return sections;
}

async function verifyStudy(module) {
  const { DOMAINS } = await load(module, 'examInfo.js');
  const { STUDY_CONTENT } = await load(module, 'studyContent.js');
  DOMAINS.forEach((domain, i) => {
    const expected = STUDY_CONTENT.filter((s) => s.domain === domain.id)
      .map((s) => ({
        taskStatement: s.taskStatement,
        topics: s.topics.map((t) => ({ title: t.title, body: t.body })),
      }));
    const actual = parseStudy(read(module, 'study', `${pad(i + 1)}-${domain.id}.md`));
    assert.deepEqual(actual, expected, `${module}/${domain.id} study round-trip mismatch`);
    counts.topics += expected.reduce((n, s) => n + s.topics.length, 0);
  });
}

for (const module of MODULES) {
  await verifyStudy(module);
}
console.log('OK', JSON.stringify(counts));
```

- [ ] **Step 4: Run the verifier**

Run: `node "$SCRATCH/verify.mjs"`

Expected: `OK {"topics":593,"questions":0,"flashcards":0,"services":0}`

If it throws an `AssertionError`, the emitter is wrong — fix `studyMarkdown`, re-run Step 2, then Step 4. Do not adjust `parseStudy` to accommodate a lossy emitter.

- [ ] **Step 5: Eyeball one generated file**

Run: `head -20 postgres/study/02-schema-design.md && grep -c '^### ' postgres/study/02-schema-design.md`

Expected: an H1 `# Schema Design & Constraints`, a `15% of the exam · 24 topics` line, then `## ` / `### ` headings. The grep prints `24`.

- [ ] **Step 6: Commit**

```bash
git add "*/study/*.md"
git commit -m "feat: generate study content as markdown

593 topics across 27 domain files, round-trip verified against
js/data/studyContent.js."
```

---

### Task 2: Question banks

**Files:**
- Modify: `$SCRATCH/convert.mjs` (add `questionsMarkdown`, `convertQuestions`)
- Modify: `$SCRATCH/verify.mjs` (add `parseQuestions`, `verifyQuestions`)
- Create: `aws/questions.md`, `kubernetes/questions.md`, `networking/questions.md`, `postgres/questions.md`, `sre/questions.md`

**Interfaces:**
- Consumes: `MODULES`, `load`, `MODULE_TITLES` from Task 1's `convert.mjs`.
- Produces: `questionsMarkdown(module, DOMAINS, QUESTIONS)` returning a markdown string.

**Context the implementer needs:**

`QUESTIONS` records are `{ id, domain, questionType, question, options, correctIndexes, explanation }`. `questionType` is `'multiple-choice'` or `'multiple-response'`, but **do not branch on it** — branch on `correctIndexes.length`, which is the authoritative count. Across the 677 questions the distribution is 1 answer (545), 2 (33), 3 (75), 4 (24), and the maximum option count is 7. No question text, option, or explanation contains a newline.

Options keep their source order so letter labels stay stable — explanations sometimes quote a specific distractor's wording.

- [ ] **Step 1: Add the questions emitter to `convert.mjs`**

Insert before the `import.meta.url` guard at the bottom of `$SCRATCH/convert.mjs`:

```js
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
const NUMBER_WORDS = { 2: 'two', 3: 'three', 4: 'four' };

export function questionsMarkdown(module, DOMAINS, QUESTIONS) {
  const out = [
    `# ${MODULE_TITLES[module]} — question bank`,
    '',
    `${QUESTIONS.length} questions. Answers are collapsed; expand to check yourself.`,
    '',
  ];
  for (const domain of DOMAINS) {
    const qs = QUESTIONS.filter((q) => q.domain === domain.id);
    if (qs.length === 0) continue;
    out.push(`## ${mdText(domain.name)}`, '', `${qs.length} questions`, '');
    for (const q of qs) {
      const n = q.correctIndexes.length;
      if (n < 1 || n > 4) {
        throw new Error(`${module} ${q.id}: unexpected correctIndexes length ${n}`);
      }
      if (q.correctIndexes.some((i) => i >= q.options.length)) {
        throw new Error(`${module} ${q.id}: correctIndexes out of range`);
      }
      const question = mdText(q.question);
      out.push(`### ${q.id}`, '');
      out.push(n > 1 ? `${question} *(choose ${NUMBER_WORDS[n]})*` : question, '');
      q.options.forEach((opt, i) => out.push(`- **${LETTERS[i]}.** ${mdText(opt)}`));
      out.push('');
      out.push('<details><summary>Answer</summary>', '');
      out.push(`${q.correctIndexes.map((i) => `**${LETTERS[i]}.**`).join(' ')} — ${mdText(q.explanation)}`, '');
      out.push('</details>', '');
    }
  }
  return out.join('\n').replace(/\n+$/, '') + '\n';
}

export async function convertQuestions(module) {
  const { DOMAINS } = await load(module, 'examInfo.js');
  const { QUESTIONS } = await load(module, 'questions.js');
  writeFileSync(join(REPO, module, 'questions.md'), questionsMarkdown(module, DOMAINS, QUESTIONS));
  return QUESTIONS.length;
}
```

Then extend the bottom guard to call it:

```js
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  for (const module of MODULES) {
    const s = await convertStudy(module);
    const q = await convertQuestions(module);
    console.log(`${module}: ${s} study files, ${q} questions`);
  }
}
```

- [ ] **Step 2: Run the converter**

Run: `node "$SCRATCH/convert.mjs"`

Expected: `aws: 4 study files, 119 questions`, `kubernetes: 5 study files, 140 questions`, `networking: 5 study files, 127 questions`, `postgres: 7 study files, 154 questions`, `sre: 6 study files, 137 questions`.

- [ ] **Step 3: Add the questions verifier to `verify.mjs`**

Insert before the final loop:

```js
const LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function parseQuestions(text) {
  const questions = [];
  let q = null;
  let inAnswer = false;
  const answerBuf = [];
  const flush = () => {
    if (!q) return;
    const joined = answerBuf.join('\n').trim();
    const m = joined.match(/^((?:\*\*[A-Z]\.\*\*\s*)+)— ([\s\S]*)$/);
    if (!m) throw new Error(`${q.id}: unparseable answer block`);
    q.correctIndexes = [...m[1].matchAll(/\*\*([A-Z])\.\*\*/g)]
      .map((x) => LETTERS.indexOf(x[1]));
    q.explanation = unmdText(m[2].trim());
    questions.push(q);
    q = null;
    answerBuf.length = 0;
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('### ')) {
      flush();
      q = { id: line.slice(4).trim(), question: null, options: [] };
      inAnswer = false;
    } else if (!q) {
      continue;
    } else if (line.startsWith('<details>')) {
      inAnswer = true;
    } else if (line.startsWith('</details>')) {
      inAnswer = false;
    } else if (inAnswer) {
      answerBuf.push(line);
    } else if (line.startsWith('- **')) {
      q.options.push(unmdText(line.replace(/^- \*\*[A-Z]\.\*\* /, '')));
    } else if (line.trim() !== '' && q.question === null) {
      q.question = unmdText(line.replace(/ \*\(choose (?:two|three|four)\)\*$/, '').trim());
    }
  }
  flush();
  return questions;
}

async function verifyQuestions(module) {
  const { QUESTIONS } = await load(module, 'questions.js');
  const actual = parseQuestions(read(module, 'questions.md'));
  const expected = QUESTIONS.map((q) => ({
    id: q.id,
    question: q.question,
    options: q.options,
    correctIndexes: q.correctIndexes,
    explanation: q.explanation,
  }));
  // The emitter groups by domain, so compare order-insensitively by id.
  const byId = (a, b) => a.id.localeCompare(b.id);
  assert.deepEqual([...actual].sort(byId), [...expected].sort(byId),
    `${module} questions round-trip mismatch`);
  assert.equal(actual.length, QUESTIONS.length, `${module} question count mismatch`);
  counts.questions += actual.length;
}
```

Add `await verifyQuestions(module);` to the final loop, after `verifyStudy`.

- [ ] **Step 4: Run the verifier**

Run: `node "$SCRATCH/verify.mjs"`

Expected: `OK {"topics":593,"questions":677,"flashcards":0,"services":0}`

- [ ] **Step 5: Confirm a multi-answer question renders correctly**

Run: `grep -A 12 '^### secure-0' aws/questions.md | grep -m1 -B2 -A2 'choose two'`

Expected: a question line ending in `*(choose two)*`, and further down an answer block naming two bold letters.

- [ ] **Step 6: Commit**

```bash
git add "*/questions.md"
git commit -m "feat: generate question banks as markdown

677 questions across 5 files with collapsed answers, round-trip
verified against js/data/questions.js."
```

---

### Task 3: Flashcard decks

**Files:**
- Modify: `$SCRATCH/convert.mjs` (add `flashcardsMarkdown`, `convertFlashcards`)
- Modify: `$SCRATCH/verify.mjs` (add `verifyFlashcards`)
- Create: `aws/flashcards.md`, `kubernetes/flashcards.md`, `networking/flashcards.md`, `postgres/flashcards.md`, `sre/flashcards.md`

**Interfaces:**
- Consumes: `MODULES`, `load`, `MODULE_TITLES` from `convert.mjs`.
- Produces: `flashcardsMarkdown(module, FLASHCARD_DOMAINS, FLASHCARDS)`. The emitted format is consumed by `scripts/lib/flashcard-md.mjs` in Task 5 — **the two must agree exactly.**

**Context the implementer needs:**

`FLASHCARDS` records are `{ id, service, domain, front, back }`. All 579 cards across all five modules have every field populated, and ids are unique within each module. Backs average 388 characters and reach 936; none contains a newline or a pipe. `FLASHCARD_DOMAINS` is the module's canonical bucket list and every card's `domain` is one of them.

**aws is the module that breaks the obvious assumption:** its 8 flashcard buckets are service categories (`Storage`, `Database`, `Analytics`, `Best-Fit Scenarios`, …) and do *not* match its 4 exam domains. The other four modules happen to align 1:1 with their exam domains. The emitter must use `FLASHCARD_DOMAINS`, never `DOMAINS`.

This format is load-bearing: the inline code span carries `id` and the text after `·` carries `service`, both of which the Anki exporter reads. Changing either breaks note keying.

- [ ] **Step 1: Add the flashcards emitter to `convert.mjs`**

Insert before the bottom guard:

```js
export function flashcardsMarkdown(module, FLASHCARD_DOMAINS, FLASHCARDS) {
  const out = [
    `# ${MODULE_TITLES[module]} — flashcards`,
    '',
    `${FLASHCARDS.length} cards. Exported to Anki by scripts/export-anki.mjs.`,
    '',
  ];
  const seen = new Set();
  for (const domain of FLASHCARD_DOMAINS) {
    const cards = FLASHCARDS.filter((c) => c.domain === domain);
    if (cards.length === 0) continue;
    out.push(`## ${mdText(domain)}`, '');
    for (const card of cards) {
      if (seen.has(card.id)) throw new Error(`${module}: duplicate card id "${card.id}"`);
      seen.add(card.id);
      if (!card.id || !card.service || !card.front || !card.back) {
        throw new Error(`${module} ${card.id}: card is missing a required field`);
      }
      if (/[`·\n]/.test(card.id) || /[\n]/.test(card.service)) {
        throw new Error(`${module} ${card.id}: id or service contains a delimiter character`);
      }
      out.push(`### \`${card.id}\` · ${mdText(card.service)}`, '');
      out.push(`**${mdText(card.front)}**`, '');
      out.push('<details><summary>Answer</summary>', '');
      out.push(mdText(card.back), '');
      out.push('</details>', '');
    }
  }
  if (seen.size !== FLASHCARDS.length) {
    throw new Error(`${module}: ${FLASHCARDS.length - seen.size} cards had an unknown domain`);
  }
  return out.join('\n').replace(/\n+$/, '') + '\n';
}

export async function convertFlashcards(module) {
  const { FLASHCARDS, FLASHCARD_DOMAINS } = await load(module, 'flashcards.js');
  writeFileSync(
    join(REPO, module, 'flashcards.md'),
    flashcardsMarkdown(module, FLASHCARD_DOMAINS, FLASHCARDS),
  );
  return FLASHCARDS.length;
}
```

Extend the bottom guard to call `convertFlashcards(module)` and include the count in its log line.

- [ ] **Step 2: Run the converter**

Run: `node "$SCRATCH/convert.mjs"`

Expected card counts: aws 89, kubernetes 109, networking 155, postgres 133, sre 93.

- [ ] **Step 3: Add the flashcards verifier to `verify.mjs`**

This deliberately uses the **real** parser from Task 5's module once it exists; for now it uses a local copy so Task 3 is independently verifiable. Insert before the final loop:

```js
export function parseFlashcardsForVerify(text) {
  const cards = [];
  let domain = null;
  let card = null;
  let inAnswer = false;
  let buf = [];
  const flush = () => {
    if (card) {
      card.back = unmdText(buf.join('\n').trim());
      cards.push(card);
      card = null;
    }
    buf = [];
  };
  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      domain = unmdText(line.slice(3).trim());
    } else if (line.startsWith('### ')) {
      flush();
      const m = line.slice(4).match(/^`([^`]+)` · (.+)$/);
      if (!m) throw new Error(`unparseable card heading: ${line}`);
      card = { id: m[1], service: unmdText(m[2].trim()), domain, front: null, back: '' };
      inAnswer = false;
    } else if (!card) {
      continue;
    } else if (line.startsWith('<details>')) {
      inAnswer = true;
    } else if (line.startsWith('</details>')) {
      inAnswer = false;
    } else if (inAnswer) {
      buf.push(line);
    } else if (card.front === null && line.startsWith('**') && line.endsWith('**')) {
      card.front = unmdText(line.slice(2, -2));
    }
  }
  flush();
  return cards;
}

async function verifyFlashcards(module) {
  const { FLASHCARDS } = await load(module, 'flashcards.js');
  const actual = parseFlashcardsForVerify(read(module, 'flashcards.md'));
  const byId = (a, b) => a.id.localeCompare(b.id);
  const expected = FLASHCARDS.map((c) => ({
    id: c.id, service: c.service, domain: c.domain, front: c.front, back: c.back,
  }));
  assert.deepEqual([...actual].sort(byId), [...expected].sort(byId),
    `${module} flashcards round-trip mismatch`);
  counts.flashcards += actual.length;
}
```

Add `await verifyFlashcards(module);` to the final loop.

- [ ] **Step 4: Run the verifier**

Run: `node "$SCRATCH/verify.mjs"`

Expected: `OK {"topics":593,"questions":677,"flashcards":579,"services":0}`

- [ ] **Step 5: Confirm aws kept its service-category buckets**

Run: `grep -c '^## ' aws/flashcards.md && grep '^## ' aws/flashcards.md`

Expected: `8`, then the eight service categories beginning `## Security, Identity, and Compliance` and ending `## Best-Fit Scenarios` — **not** the four exam domain names.

- [ ] **Step 6: Commit**

```bash
git add "*/flashcards.md"
git commit -m "feat: generate flashcard decks as markdown

579 cards across 5 files, round-trip verified against
js/data/flashcards.js. Card id and service are encoded in the heading
because the Anki exporter keys notes on them."
```

---

### Task 4: AWS services reference

**Files:**
- Modify: `$SCRATCH/convert.mjs` (add `servicesMarkdown`, `convertServices`)
- Modify: `$SCRATCH/verify.mjs` (add `verifyServices`)
- Create: `aws/services.md`

**Interfaces:**
- Consumes: `load`, `MODULE_TITLES` from `convert.mjs`.
- Produces: `servicesMarkdown(SERVICES)`.

**Context the implementer needs:**

`aws/js/data/services.js` is the only services file — no other module has one. Records are `{ id, name, domain, blurb }`. Blurbs are one sentence, contain no newline and no pipe, so a table is safe here. The `domain` values are the **service categories** (7 of them, a subset of `FLASHCARD_DOMAINS` missing `Best-Fit Scenarios`), *not* the four exam domains. Entries are already contiguous by category.

- [ ] **Step 1: Add the services emitter to `convert.mjs`**

```js
export function servicesMarkdown(SERVICES) {
  const categories = [...new Set(SERVICES.map((s) => s.domain))];
  const out = [
    `# ${MODULE_TITLES.aws} — services at a glance`,
    '',
    `${SERVICES.length} services grouped by category.`,
    '',
  ];
  for (const category of categories) {
    out.push(`## ${mdText(category)}`, '', '| Service | What it\'s for |', '| --- | --- |');
    for (const s of SERVICES.filter((x) => x.domain === category)) {
      if (/[|\n]/.test(s.name) || /[|\n]/.test(s.blurb)) {
        throw new Error(`aws service "${s.id}": name or blurb contains a pipe or newline`);
      }
      out.push(`| ${mdText(s.name)} | ${mdText(s.blurb)} |`);
    }
    out.push('');
  }
  return out.join('\n').replace(/\n+$/, '') + '\n';
}

export async function convertServices() {
  const { SERVICES } = await load('aws', 'services.js');
  writeFileSync(join(REPO, 'aws', 'services.md'), servicesMarkdown(SERVICES));
  return SERVICES.length;
}
```

In the bottom guard, call it once outside the per-module loop:

```js
  const svc = await convertServices();
  console.log(`aws: ${svc} services`);
```

- [ ] **Step 2: Run the converter**

Run: `node "$SCRATCH/convert.mjs"`

Expected: a final line `aws: 74 services`.

- [ ] **Step 3: Add the services verifier to `verify.mjs`**

```js
async function verifyServices() {
  const { SERVICES } = await load('aws', 'services.js');
  const rows = read('aws', 'services.md')
    .split('\n')
    .filter((l) => l.startsWith('| ') && !l.startsWith('| ---') && !l.startsWith('| Service '))
    .map((l) => {
      // A clean two-column row `| NAME | BLURB |` contains exactly one ' | '
      // occurrence, so l.split(' | ') yields 2 elements, not 3 — destructuring
      // by index leaves blurb undefined and throws. Anchor on the row shape.
      const m = l.match(/^\|\s*(.*?)\s*\|\s*(.*?)\s*\|$/);
      if (!m) throw new Error(`unparseable services row: ${l}`);
      return { name: unmdText(m[1]), blurb: unmdText(m[2]) };
    });
  const expected = SERVICES.map((s) => ({ name: s.name, blurb: s.blurb }));
  assert.deepEqual(rows, expected, 'aws services round-trip mismatch');
  counts.services += rows.length;
}
```

Call `await verifyServices();` after the module loop, before the final `console.log`.

- [ ] **Step 4: Run the verifier**

Run: `node "$SCRATCH/verify.mjs"`

Expected: `OK {"topics":593,"questions":677,"flashcards":579,"services":74}`

This is the full round-trip green light. Every one of the 1,923 content records is now proven reproducible from markdown.

- [ ] **Step 5: Commit**

```bash
git add aws/services.md
git commit -m "feat: generate the aws services reference as markdown

74 services grouped by service category, round-trip verified against
js/data/services.js."
```

---

### Task 5: Markdown-backed Anki exporter

**Files:**
- Create: `scripts/lib/flashcard-md.mjs`
- Create: `scripts/lib/flashcard-md.test.mjs`
- Modify: `scripts/export-anki.mjs`

**Interfaces:**
- Produces: `parseFlashcardMarkdown(text, moduleName)` → `Array<{ id, service, domain, front, back }>` in file order. Throws `Error` on any malformed input.
- Consumes: `<module>/flashcards.md` as emitted by Task 3's `flashcardsMarkdown`.

**Context the implementer needs:**

The current `scripts/export-anki.mjs` discovers modules by looking for `js/data/flashcards.js`, imports `FLASHCARDS`, and builds four-column TSV rows. **Only the input changes.** Everything downstream — `toTag`, `sanitizeField`, the header lines, the `<module>-<id>` note ID, the `<service> — <front>` front composition, the cross-deck uniqueness assertion, the CLI argument handling, and the `anki/<module>.txt` output paths — is preserved exactly. Read the existing file end to end before touching it.

`sanitizeField` collapses tabs/CR/LF and prefixes a space to any field starting with a double quote (otherwise Anki's importer treats it as a quoted CSV field and corrupts the row). `toTag` lowercases, replaces non-alphanumerics with hyphens, and strips leading/trailing hyphens.

The parser is strict by design: silent omission would quietly shrink a deck, which is the exact failure this migration must not introduce.

- [ ] **Step 1: Capture golden output from the current exporter**

This must happen while `js/data/flashcards.js` still exists. Run:

```bash
node scripts/export-anki.mjs && mkdir -p "$SCRATCH/golden" && cp anki/*.txt "$SCRATCH/golden/"
```

Expected: five lines like `aws: 89 cards → anki/aws.txt`, and five files in `$SCRATCH/golden/`.

- [ ] **Step 2: Write the failing parser tests**

Create `scripts/lib/flashcard-md.test.mjs`:

```js
import test from 'node:test';
import assert from 'node:assert/strict';
import { parseFlashcardMarkdown } from './flashcard-md.mjs';

const CARD = [
  '# Example — flashcards',
  '',
  '2 cards.',
  '',
  '## Storage',
  '',
  '### `s3` · Amazon S3',
  '',
  '**What is it for?**',
  '',
  '<details><summary>Answer</summary>',
  '',
  'Object storage.',
  '',
  '</details>',
  '',
  '### `ebs` · Amazon EBS',
  '',
  '**What is it for?**',
  '',
  '<details><summary>Answer</summary>',
  '',
  'Block storage.',
  '',
  '</details>',
  '',
].join('\n');

test('parses cards with id, service, domain, front and back', () => {
  const cards = parseFlashcardMarkdown(CARD, 'example');
  assert.equal(cards.length, 2);
  assert.deepEqual(cards[0], {
    id: 's3',
    service: 'Amazon S3',
    domain: 'Storage',
    front: 'What is it for?',
    back: 'Object storage.',
  });
  assert.equal(cards[1].id, 'ebs');
});

test('preserves blank lines inside a back', () => {
  const text = CARD.replace('Object storage.', 'First para.\n\nSecond para.');
  const cards = parseFlashcardMarkdown(text, 'example');
  assert.equal(cards[0].back, 'First para.\n\nSecond para.');
});

test('unwraps backticked tag-like placeholders back to bare text', () => {
  const text = CARD.replace('Object storage.', 'Run `kubectl get svc `<name>`` to check.')
    .replace('**What is it for?**', '**What does `<pod>` mean?**');
  const cards = parseFlashcardMarkdown(text, 'example');
  assert.equal(cards[0].back, 'Run `kubectl get svc <name>` to check.');
  assert.equal(cards[0].front, 'What does <pod> mean?');
});

test('leaves genuinely backticked prose alone', () => {
  const text = CARD.replace('Object storage.', 'Run `kubectl get pods` first.');
  const cards = parseFlashcardMarkdown(text, 'example');
  assert.equal(cards[0].back, 'Run `kubectl get pods` first.');
});

test('throws on a card heading that is not `id` · service', () => {
  const text = CARD.replace('### `s3` · Amazon S3', '### Amazon S3');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /unparseable card heading/);
});

test('throws on a card with no front', () => {
  const text = CARD.replace('**What is it for?**\n\n<details>', '<details>');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /missing a front/);
});

test('throws on a card with an empty back', () => {
  const text = CARD.replace('Object storage.', '');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /missing a back/);
});

test('throws on a card before any domain heading', () => {
  const text = CARD.replace('## Storage\n\n', '');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /before any domain heading/);
});

test('throws on a duplicate id within a module', () => {
  const text = CARD.replace('### `ebs` · Amazon EBS', '### `s3` · Amazon EBS');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /duplicate card id/);
});

test('names the module in its errors', () => {
  const text = CARD.replace('### `s3` · Amazon S3', '### broken');
  assert.throws(() => parseFlashcardMarkdown(text, 'example'), /example/);
});
```

- [ ] **Step 3: Run the tests to verify they fail**

Run: `node --test scripts/lib/flashcard-md.test.mjs`

Expected: FAIL — `Cannot find module` for `./flashcard-md.mjs`.

- [ ] **Step 4: Write the parser**

Create `scripts/lib/flashcard-md.mjs`:

```js
// scripts/lib/flashcard-md.mjs
// Parses a module's flashcards.md into card records. The emitted format is
// defined by docs/superpowers/specs/2026-08-26-markdown-conversion-design.md:
//
//   ## <domain>
//   ### `<id>` · <service>
//   **<front>**
//   <details><summary>Answer</summary>
//   <back>
//   </details>
//
// Strict on purpose: a lenient parser would silently shrink an Anki deck.

const HEADING = /^`([^`]+)` · (.+)$/;

// Exact inverse of the converter's mdText. Bare placeholders like <name> are
// emitted backtick-wrapped because CommonMark would otherwise treat them as
// raw HTML and drop them when rendered; Anki fields must carry the original
// text, so they are unwrapped here. Only backticks that wrap a tag-like token
// are stripped, leaving genuinely backticked prose untouched.
const BACKTICKED_TAG = /`(<\/?[A-Za-z][A-Za-z0-9-]*\s*\/?>)`/g;

const unmdText = (text) => text.replace(BACKTICKED_TAG, '$1');

export function parseFlashcardMarkdown(text, moduleName) {
  const cards = [];
  const seen = new Set();
  let domain = null;
  let card = null;
  let inAnswer = false;
  let buf = [];

  const fail = (message) => {
    throw new Error(`${moduleName}/flashcards.md: ${message}`);
  };

  const flush = () => {
    if (!card) return;
    if (card.front === null) fail(`card "${card.id}" is missing a front`);
    card.back = unmdText(buf.join('\n').trim());
    if (card.back === '') fail(`card "${card.id}" is missing a back`);
    cards.push(card);
    card = null;
    buf = [];
  };

  for (const line of text.split('\n')) {
    if (line.startsWith('## ')) {
      flush();
      domain = unmdText(line.slice(3).trim());
    } else if (line.startsWith('### ')) {
      flush();
      const m = line.slice(4).match(HEADING);
      if (!m) fail(`unparseable card heading: ${line}`);
      if (domain === null) fail(`card "${m[1]}" appears before any domain heading`);
      if (seen.has(m[1])) fail(`duplicate card id "${m[1]}"`);
      seen.add(m[1]);
      card = { id: m[1], service: unmdText(m[2].trim()), domain, front: null, back: '' };
      inAnswer = false;
    } else if (!card) {
      continue;
    } else if (line.startsWith('<details>')) {
      inAnswer = true;
    } else if (line.startsWith('</details>')) {
      inAnswer = false;
    } else if (inAnswer) {
      buf.push(line);
    } else if (card.front === null && line.startsWith('**') && line.trimEnd().endsWith('**')) {
      card.front = unmdText(line.trim().slice(2, -2));
    }
  }
  flush();

  if (cards.length === 0) fail('no cards found');
  return cards;
}
```

- [ ] **Step 5: Run the tests to verify they pass**

Run: `node --test scripts/lib/flashcard-md.test.mjs`

Expected: PASS, 10 tests, 0 failures.

- [ ] **Step 6: Repoint the exporter at markdown**

In `scripts/export-anki.mjs`, make exactly three changes and nothing else.

Add the import at the top, alongside the existing `node:fs` import:

```js
import { readFileSync } from 'node:fs';
import { parseFlashcardMarkdown } from './lib/flashcard-md.mjs';
```

Change module discovery from `js/data/flashcards.js` to `flashcards.md`:

```js
const ALL_MODULES = readdirSync(new URL('..', import.meta.url), { withFileTypes: true })
  .filter((e) => e.isDirectory() && existsSync(new URL(`../${e.name}/flashcards.md`, import.meta.url)))
  .map((e) => e.name)
  .sort();
```

Change the first line of `exportModule` from the dynamic import to a parse:

```js
async function exportModule(name) {
  const source = readFileSync(new URL(`../${name}/flashcards.md`, import.meta.url), 'utf8');
  const FLASHCARDS = parseFlashcardMarkdown(source, name);
```

Leave the rest of `exportModule` — `date`, the header `lines`, the `for (const card of FLASHCARDS)` loop, `front`, `back`, `id`, `tag` — untouched. Leave the uniqueness assertion and the write block untouched.

- [ ] **Step 7: Prove the output is identical to the golden capture**

Run:

```bash
node scripts/export-anki.mjs && for m in aws kubernetes networking postgres sre; do diff <(grep -v '^# exported' "$SCRATCH/golden/$m.txt") <(grep -v '^# exported' "anki/$m.txt") && echo "$m identical"; done
```

Expected: five `identical` lines and no diff output. The `grep -v` drops only the dated provenance comment.

If any deck differs, the parser or the emitter is wrong. Fix it and re-run — **do not** accept a diff and move on. A single changed note ID means 579 duplicated cards on the next Anki sync.

- [ ] **Step 8: Commit**

```bash
git add scripts/lib/flashcard-md.mjs scripts/lib/flashcard-md.test.mjs scripts/export-anki.mjs
git commit -m "feat: export Anki decks from markdown instead of js/data

parseFlashcardMarkdown reads the generated flashcards.md; the exporter's
output contract is unchanged, verified byte-identical against a golden
capture from the js/data-backed exporter so existing notes update in
place rather than duplicating."
```

---

### Task 6: Make vpc-explorer self-contained

**Files:**
- Modify: `aws/vpc-explorer.html:478`

**Context the implementer needs:**

`aws/vpc-explorer.html` ends with `<script type="module" src="js/vpc-explorer.js"></script>`. Browsers refuse to load ES modules over `file://`, and `js/` is deleted in Task 7, so the script and its imports must be inlined. The other six standalone pages (five `cheatsheet.html` plus `aws/exam-shortcut.html`) contain zero `<script>` tags and need no work at all.

Three source files are involved: `aws/js/vpc-explorer.js` (406 lines, imports `escapeHtml` from `./lib/html.js` and a set of named functions from `./lib/vpcMath.js`), `aws/js/lib/vpcMath.js` (253 lines), and `aws/js/lib/html.js`.

- [ ] **Step 1: Read the three source files and note the exact import list**

Run: `sed -n '1,32p' aws/js/vpc-explorer.js && wc -l aws/js/lib/vpcMath.js aws/js/lib/html.js`

Record every name imported from `vpcMath.js` — all of them must survive inlining.

- [ ] **Step 2: Inline the scripts**

Replace line 478 of `aws/vpc-explorer.html`:

```html
  <script type="module" src="js/vpc-explorer.js"></script>
```

with a single classic `<script>` block containing, in this order:

1. the body of `js/lib/html.js` with its `export` keywords stripped,
2. the body of `js/lib/vpcMath.js` with its `export` keywords stripped,
3. the body of `js/vpc-explorer.js` with its `import { … } from …;` statements deleted.

Do not use `type="module"` on the new tag — a classic script is what makes `file://` work. Do not reorder or edit any function body; strip only `import`/`export` keywords.

- [ ] **Step 3: Verify it works over file://**

Open `aws/vpc-explorer.html` directly in a browser by file path (not through a server). Confirm all three interactive behaviors:

- clicking a subnet in the diagram selects it and updates the detail panel,
- the packet-trace control walks a packet through the route tables,
- the CIDR inputs recompute subnet ranges when changed.

Then confirm the browser console is free of errors.

- [ ] **Step 4: Confirm no module syntax survived**

Run: `grep -nE '^\s*(import|export)\s' aws/vpc-explorer.html; grep -c 'type="module"' aws/vpc-explorer.html`

Expected: the first grep prints nothing; the second prints `0`.

- [ ] **Step 5: Commit**

```bash
git add aws/vpc-explorer.html
git commit -m "refactor: inline vpc-explorer scripts so it opens over file://

Inlines js/vpc-explorer.js, js/lib/vpcMath.js and escapeHtml into a
single classic script block, ahead of deleting js/. The page now opens
by double-click like the other standalone HTML pages."
```

---

### Task 7: Delete the application layer

**Files:**
- Delete: `<module>/index.html` (5), `<module>/js/**` (111), `<module>/css/**` (5), `<module>/scripts/validate-content.mjs` (5), `scripts/check-drift.mjs` (1)
- Modify: `.github/workflows/ci.yml`

**Context the implementer needs:**

Do not start this task until Task 4's verifier printed all four non-zero counts and Task 5 Step 7 printed five `identical` lines. Those are the two gates.

`<module>/scripts/fetch-doc.mjs` is **kept** — it caches documentation pages for content research and has no dependency on the app. `docs/superpowers/` in every module is kept.

`.github/workflows/ci.yml` currently runs five steps that all discover modules via `*/js/app.js`. Four of them lose their subject entirely: the JS syntax check, `node --test js/lib/*.test.mjs`, `validate-content.mjs`, and `check-drift.mjs`.

This deletes 22 test files. Twenty-one cover logic that ceases to exist. The exception is `aws/js/lib/vpcMath.test.mjs`, whose code survives inlined into `vpc-explorer.html` — that page becomes untested, which the spec records as an accepted tradeoff.

- [ ] **Step 1: Confirm both gates are green**

Run: `node "$SCRATCH/verify.mjs"`

Expected: `OK {"topics":593,"questions":677,"flashcards":579,"services":74}`

If this does not print exactly that, stop and go back to Tasks 1-4.

- [ ] **Step 2: Delete the application files**

```bash
git rm -r -q */js */css */index.html */scripts/validate-content.mjs scripts/check-drift.mjs
git status --short | wc -l
```

Expected: `127`.

- [ ] **Step 3: Confirm the survivors are intact**

Run: `ls aws/ && ls */scripts/`

Expected: `aws/` still contains `README.md`, `cheatsheet.html`, `exam-shortcut.html`, `vpc-explorer.html`, `services.md`, `questions.md`, `flashcards.md`, `study/`, `scripts/`, `docs/`. Each `<module>/scripts/` contains only `fetch-doc.mjs`.

- [ ] **Step 4: Reduce CI to the two steps that still have a subject**

Replace the whole `steps:` list in `.github/workflows/ci.yml` with:

```yaml
    steps:
      - uses: actions/checkout@v7
      - uses: actions/setup-node@v7
        with:
          node-version: 22

      # The flashcard-markdown parser is the only logic left in this repo,
      # and it is what protects the Anki decks from silently shrinking.
      - name: Unit tests
        run: node --test scripts/lib/*.test.mjs

      # Parses every module's flashcards.md and asserts card shape and
      # cross-deck ID uniqueness. Modules are auto-discovered, so adding
      # one needs no workflow edit.
      - name: Anki export (parse + cross-deck ID assertions)
        run: node scripts/export-anki.mjs
```

- [ ] **Step 5: Run the full CI command set locally**

```bash
node --test scripts/lib/*.test.mjs && node scripts/export-anki.mjs
```

Expected: 10 passing tests, then five `<module>: N cards → anki/<module>.txt` lines with counts 89 / 109 / 155 / 133 / 93.

- [ ] **Step 6: Commit**

```bash
git add -A .github/workflows/ci.yml
git commit -m "feat!: delete the browser app layer

Removes every index.html, js/, css/, and validate-content.mjs, plus
check-drift.mjs — 127 files whose subject is gone now that content lives
in markdown. CI reduces to the parser tests and the Anki export, the two
checks that still have a subject.

Lost with the app: quiz and mock-exam scoring, localStorage progress
history, and vpcMath.test.mjs (its code survives inlined in
vpc-explorer.html). All recoverable from git history except browser-local
progress data."
```

---

### Task 8: Scrub published-site references

**Files:**
- Modify: `README.md`
- Modify: `aws/README.md`, `kubernetes/README.md`, `networking/README.md`, `postgres/README.md`, `sre/README.md`
- Modify: `aws/cheatsheet.html:406`, `kubernetes/cheatsheet.html:385`, `networking/cheatsheet.html:474`, `postgres/cheatsheet.html:399`, `sre/cheatsheet.html:377`

**Context the implementer needs:**

Every README opens with a "Live at https://toddcooke.github.io/learn/<module>/" line, and several cross-link sibling modules by that URL. The root `README.md` describes the submodule relationship in its opening paragraph, in the "Adding a module" instructions (which tell you to edit `toddcooke.github.io`'s `content/learn.md` and add a `.claude/launch.json` port), and in a publishing section near line 93. Each cheatsheet prints the site URL as footer text.

`.claude/launch.json` also becomes dead — it configures five `python3 -m http.server` dev servers for an app that no longer exists.

- [ ] **Step 1: Find every remaining reference**

Run: `grep -rn 'toddcooke\.github\.io\|submodule\|http\.server\|localhost:800' README.md */README.md */cheatsheet.html .claude/launch.json`

Every hit is something this task resolves.

- [ ] **Step 2: Rewrite the root README**

Replace the opening description, the Modules list, the "Adding a module" section, and the publishing section so they describe what the repo now is: local markdown study modules, read in any markdown viewer, with flashcards exported to Anki. Each module bullet links to its directory rather than to a URL. "Adding a module" now means: create `<module>/study/NN-<domain>.md`, `questions.md`, and `flashcards.md`, and nothing else — no launch.json port, no `content/learn.md` edit, no CI change. Document the two commands that still exist:

```
node scripts/export-anki.mjs [module...]
node --test scripts/lib/*.test.mjs
```

Keep the existing "Anki export" section and its format documentation intact — that pipeline is unchanged.

- [ ] **Step 3: Rewrite the five module READMEs**

In each, delete the "Live at …" line and replace the "Running it" section (which documents `python3 -m http.server`) with how to read the module now: open `study/`, `questions.md`, and `flashcards.md` in any markdown viewer; open the standalone HTML pages by double-click. Cross-links to sibling modules become relative directory links (`../kubernetes/`). Update the "What's here" list so it describes the markdown files rather than the app's views — in particular, drop the quiz, mock exam, and progress dashboard entries, which no longer exist. Under Development, list only the two commands from Step 2.

- [ ] **Step 4: Remove the site URL from the five cheatsheet footers**

In each `cheatsheet.html`, the footer line reads `toddcooke.github.io/learn/<module> &mdash; hand-maintained, cross-checked against the module's study content`. Drop the URL and the following `&mdash;`, keeping `Hand-maintained, cross-checked against the module's study content`. Change nothing else in these files — their print layout is the reason they survived the migration.

- [ ] **Step 5: Delete the dead launch config**

```bash
git rm -q .claude/launch.json
```

- [ ] **Step 6: Confirm the repo no longer references the site**

Run: `grep -rn 'toddcooke\.github\.io' --include='*.md' --include='*.html' --include='*.json' --include='*.yml' . | grep -v '/docs/superpowers/' | grep -v '^\./\.claude/'`

Expected: no output. Both exclusions are deliberate: `docs/superpowers/` at the repo root *and* inside each module holds specs and plans that are historical records and legitimately still mention the URL, and `.claude/worktrees/` holds an untracked worktree copy that is not part of this change.

- [ ] **Step 7: Commit**

```bash
git add -A README.md "*/README.md" "*/cheatsheet.html" .claude/launch.json
git commit -m "docs: describe the repo as local markdown, not a published site

Drops every toddcooke.github.io URL from the READMEs and cheatsheet
footers, rewrites the running/development instructions for markdown, and
removes .claude/launch.json now that there are no dev servers to run."
```

---

### Task 9: Tear down the toddcooke.github.io integration

**Files (in the separate `toddcooke/toddcooke.github.io` repo at `/Users/toddcooke/IdeaProjects/toddcooke.github.io`):**
- Delete: `static/learn` submodule, its `.gitmodules` entry, `.github/workflows/sync-learn-submodules.yml`, `content/learn.md`
- Modify: `config.yaml` (remove the `learn` menu entry)

**Context the implementer needs:**

**This task deletes live public pages.** Every `https://toddcooke.github.io/learn/*` URL starts returning 404. Do not push without explicit confirmation from Todd at this point in the plan, even though the overall design was approved — approval of a design is not approval of the moment a live site goes down.

Do not start this task until Tasks 1-8 are committed and green.

`config.yaml` holds a `menu.main` list; the `learn` entry is the one with `identifier: learn`, `url: /learn/`, `weight: 5`. `hugo.yaml` (the Pages deploy workflow) and everything else in the site are untouched. Removing `content/learn.md` removes the `/learn/` landing page; removing the submodule removes everything under it.

- [ ] **Step 1: Confirm with Todd before touching the other repo**

Ask explicitly: the change is ready, pushing it takes `https://toddcooke.github.io/learn/` and all five module URLs offline permanently. Wait for a clear yes. If the answer is no or "not yet", stop here — Tasks 1-8 stand on their own and the site simply keeps serving the frozen content.

- [ ] **Step 2: Branch in the site repo**

```bash
cd /Users/toddcooke/IdeaProjects/toddcooke.github.io
git checkout -b remove-learn-submodule
```

- [ ] **Step 3: Remove the submodule**

```bash
git rm -q static/learn
rm -rf .git/modules/static/learn
git status --short
```

Expected: `.gitmodules` modified and `static/learn` deleted. `git rm` removes the `.gitmodules` entry itself; confirm with `cat .gitmodules` that only the `themes/PaperMod` entry remains.

- [ ] **Step 4: Remove the sync workflow and the landing page**

```bash
git rm -q .github/workflows/sync-learn-submodules.yml content/learn.md
```

- [ ] **Step 5: Remove the nav entry**

In `config.yaml`, delete these four lines from `menu.main`:

```yaml
    - identifier: learn
      name: learn
      url: /learn/
      weight: 5
```

Leave `contact`, `resume`, and `rss` and their weights untouched.

- [ ] **Step 6: Confirm nothing else references learn**

Run: `grep -rn 'learn' config.yaml .gitmodules .github/workflows/ content/ 2>/dev/null`

Expected: no output.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "chore: remove the learn submodule and its sync pipeline

The learning modules are now local markdown in toddcooke/learn and are no
longer published. Removes the static/learn submodule, the hourly
sync-learn-submodules workflow, the /learn/ landing page, and the nav
entry. https://toddcooke.github.io/learn/* now 404s."
```

- [ ] **Step 8: Push both repos and confirm the deploy**

Push the site repo branch and merge it, then watch the Hugo deploy:

```bash
gh run watch --repo toddcooke/toddcooke.github.io
```

Then verify the takedown with a cache-busting query string (github.io serves `max-age=600`, so a plain request may return a cached page):

```bash
curl -s -o /dev/null -w '%{http_code}\n' "https://toddcooke.github.io/learn/aws/?cb=$(date +%s)"
```

Expected: `404`.

---

## Self-Review

**Spec coverage.** Every spec section maps to a task: markdown formats → Tasks 1-4; Anki exporter contract → Task 5; CI → Task 7 Step 4; vpc-explorer inlining → Task 6; deletions → Task 7; README/cheatsheet scrub → Task 8; site teardown → Task 9; migration mechanics and the four-part verification → Task 1 Step 4, Task 4 Step 4, Task 5 Step 7, Task 6 Step 3.

**Known deviations from the spec**, both deliberate and both flagged in place:

1. CI has two steps, not one (a parser test step is added). Rationale is in the "Deviation from the spec" section above.
2. Study file H1 is `# <domain name>` with a `<weight>% of the exam · <n> topics` subtitle, rather than the spec's illustrative `# Domain 1: <name>`. Only aws numbers its task statements (`Task 1.1:`); inventing "Domain N" for the other four modules would collide with nothing but would read as false structure. The filename ordinal (`01-secure.md`) already carries the ordering.
3. Task 8 additionally deletes `.claude/launch.json`, which the spec does not mention. It configures dev servers for an app that no longer exists.
4. Prose is not emitted byte-verbatim: tag-like placeholders are backtick-wrapped (see Global Constraints). This is a deliberate, human-approved narrowing of the "carried verbatim" constraint, made after a review found the tokens vanish in every markdown renderer. The round trip is still exact — `unmdText` reverses it — so the verifier still compares against the untouched source.

**Type consistency.** `parseFlashcardMarkdown(text, moduleName)` is defined in Task 5 Step 4 and consumed in Task 5 Step 6 with matching arity. `studyMarkdown`, `questionsMarkdown`, `flashcardsMarkdown`, `servicesMarkdown`, `MODULES`, `load`, `MODULE_TITLES`, and `pad` are defined in Task 1 and used with the same names and signatures in Tasks 2-4. Card records use the same five keys (`id`, `service`, `domain`, `front`, `back`) in the emitter, the verifier, and the parser.
