# Anki Deck Quality Pass Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Implement the seven approved improvements from `docs/superpowers/specs/2026-07-11-anki-quality-design.md` — update-safe ID exports with hierarchical tags, enumeration/port splits, distinguisher cards, binary-front and template-front rewrites, two-ask splits, and AWS scenario cards.

**Architecture:** One script task (export v2), three content tasks (flashcards data), one verification task. Cards double as site content — every data change must render correctly on the site and pass `validate-content.mjs`.

**Tech Stack:** Vanilla ES modules, node scripts, Anki tab-separated text import.

## Global Constraints

- Flashcard shape stays `{id, service, front, back}` — no new fields.
- After every content task: all fronts unique per deck (case-insensitive); `node scripts/validate-content.mjs` green in every touched module; no scratch/checker scripts committed.
- New factual claims grounded in the module's own reviewed `studyContent.js`/`questions.js` or `.cache/aws-docs/` docs; verbatim-copy check (8+ consecutive words vs cached docs AND vs the module's own studyContent/questions) on all new/rewritten text.
- Card `id` values: existing ids never change (the export's module prefix provides global uniqueness); new ids follow each deck's existing style (kebab-case, topic-shaped).
- House style: fronts are questions (the two ordered-anchor cards may stay imperative, e.g. "List the seven OSI layers in order…"); backs are 1-4 sentence prose ending in terminal punctuation; front must not leak its back's key fact; no yes/no fronts anywhere after Task 3.
- Commit messages: plain imperative subjects.

---

### Task 1: Export format v2 — stable IDs, hierarchical tags, date stamp

**Files:**
- Modify: `scripts/export-anki.mjs`, `README.md`, `docs/superpowers/specs/2026-07-10-anki-export-design.md`

- [ ] **Step 1:** Rework `exportModule` to emit:

```
#separator:tab
#html:false
#tags column:4
# exported <YYYY-MM-DD> from toddcooke/learn <module>
<module>-<id>\t<service — front>\t<back>\t<module>::<slug(service)>
```

Concretely: ID field = `${name}-${card.id}`; tags = `${name}::${toTag(card.service)}`; the date from `new Date().toISOString().slice(0, 10)`. Keep the `service — front` composition, `sanitizeField`, validation-before-write, and auto-discovery unchanged. (Lines starting with `#` after the directives are treated as comments by Anki's importer.)

- [ ] **Step 2:** Add a cross-deck ID uniqueness assertion to the script: after computing all requested modules' rows, throw if any `<module>-<id>` repeats (belt-and-braces; the module prefix should guarantee it).

- [ ] **Step 3:** Verify: `node scripts/export-anki.mjs` → 5 decks; `head -5 anki/aws.txt` shows the 4 header/comment lines then a 4-field row; a scratchpad check confirms every row has exactly 4 tab-separated fields, field 1 matches `/^[a-z]+-[a-z0-9-]+$/`, field 4 matches `/^[a-z]+::[a-z0-9-]+$/`, and all 344 IDs are globally unique. `node scripts/export-anki.mjs bogus` still fails before writing.

- [ ] **Step 4:** Docs. README Anki section: document the 4-column format and the ONE-TIME Anki setup — create a note type with fields `ID`, `Front`, `Back` (ID first; set Front as the sort field; don't put ID on the card templates), then File > Import with mapping col1→ID col2→Front col3→Back col4→tags; later re-imports match on ID and update notes in place instead of duplicating. Note the one-time migration: decks imported under the old format should be deleted and re-imported fresh. Spec doc (`2026-07-10-anki-export-design.md`): update the header block and the field list to the v2 format (ID first, tags column 4, hierarchical tag, date comment line).

- [ ] **Step 5:** Commit — `git commit -m "Export Anki decks with stable IDs, hierarchical tags, and date stamp"`

### Task 2: Split networking enumeration and port-bundle cards

**Files:**
- Modify: `networking/js/data/flashcards.js`

Current deck: 70 cards. The five cards to rework (verify ids exist before editing):

- [ ] **Step 1: Port bundles → one card per protocol.** Replace `file-remote-ports`, `mgmt-signaling-ports`, `name-resolution-ports` with single-protocol cards, each front asking for one protocol's port(s) and each back giving the port number(s) plus a one-sentence anchor for what the protocol does. Cover exactly the protocols the three originals covered (read them first; expected: FTP 20/21, SSH 22, RDP 3389; SNMP 161/162, LDAP 389, SIP 5060/5061; DNS 53, DHCP 67/68). One card per protocol (~8 cards replacing 3). Port facts must match the module's studyContent/questions (already reviewed).
- [ ] **Step 2: OSI decomposition.** Keep ONE ordered anchor card (rewrite `osi-model` to ask only the ordered layer list — "List the seven OSI layers in order, 1 through 7." with a back that is just the ordered names). Add per-layer cards ONLY for layers the deck doesn't already cover elsewhere (grep first — e.g. if a transport-layer card exists, don't duplicate it); target fronts like "Which OSI layer handles routing and logical addressing?" Avoid interference: each per-layer front must name a distinct responsibility.
- [ ] **Step 3: Troubleshooting methodology decomposition.** Keep one ordered anchor card (`troubleshooting-methodology` rewritten to ask just the ordered stage list). Add 2-3 transition cards for the stages the exam most tests (e.g. "In the CompTIA methodology, what must happen after a theory is confirmed?" → establish a plan of action) — not one card per stage (7 near-identical fronts would be an interference cluster).
- [ ] **Step 4:** Checks: fronts unique; no front leaks its back; verbatim check vs cached docs + own content; validator; deck renders on the site (`preview_start` `networking-site`, flashcards view shows the new count and flips cleanly).
- [ ] **Step 5:** Commit — `git commit -m "Split networking port-bundle and enumeration flashcards into atomic cards"`

### Task 3: Distinguisher cards + binary-front rewrites + AWS de-templating

**Files:**
- Modify: `aws/js/data/flashcards.js`, `postgres/js/data/flashcards.js`, `sre/js/data/flashcards.js`, `networking/js/data/flashcards.js`

- [ ] **Step 1: Four new distinguisher cards** (additive, one per module): aws `alb-vs-nlb` (single axis: which layer / which traffic type each handles), postgres `vacuum-vs-analyze` (which one updates planner statistics vs reclaims dead tuples), networking `dot1q-vs-dot1x` (frame tagging vs port-based authentication), sre `mtbf` (define MTBF and pin the one-axis contrast with MTTR). Ground each in the module's own reviewed content (grep studyContent/questions for the facts first); service field follows each deck's naming style.
- [ ] **Step 2: Rewrite the 9 binary fronts** as which/what/why questions (verify each id's current text first; backs stay unless the opening word must change): postgres `view`; networking `icmp`, `vlan`, `wpa3`, `mtd`, `dnssec`, `mfa`, `evil-twin-on-path`, `latency-vs-packet-loss`. Example: mfa → "Why does a password plus a 4-digit PIN fail to qualify as MFA?"
- [ ] **Step 3: De-template the 5 AWS comparison fronts** (`control-tower`, `global-accelerator`, `sns`, `efs`, `budgets`): each front pins the single contrast axis its back actually teaches (read the back, extract the axis). No two of the five may share sentence shape afterward.
- [ ] **Step 4:** Checks per touched module: fronts unique; no leakage; verbatim check; validator; spot-render one touched module's flashcards view in the browser.
- [ ] **Step 5:** Commit — `git commit -m "Add distinguisher cards; rewrite binary and template-shaped flashcard fronts"`

### Task 4: Two-ask splits + AWS scenario cards

**Files:**
- Modify: all 5 `*/js/data/flashcards.js` (splits), `aws/js/data/flashcards.js` (scenario cards)

- [ ] **Step 1: Derive the split list programmatically** (scratchpad): fronts matching a two-ask shape (`, and |, what|, when|, how` joins) whose backs carry a discrete numeric/enumerable fact in a non-first sentence. Expected ~14 across the decks (known members: aws `acm`, `kms`, `savings-plans`; kubernetes `namespace`). List them in the report with the extracted second fact.
- [ ] **Step 2: Split each**: original card keeps the what/why front (drop the second ask from the front; back may keep its prose intact if the discrete fact reads as elaboration, or lose the sentence if it moves cleanly); companion card (new id, `-detail`/topic-shaped suffix per deck style) asks the discrete fact directly ("How often does KMS rotate a key with automatic rotation enabled?"). No information may be deleted overall — every fact present before exists after, on some card.
- [ ] **Step 3: ~8-10 AWS scenario cards** (additive): "best fit" mini-scenarios with a one-line situation front and a service+reason back, grounded in existing aws studyContent/questions (e.g. shared POSIX file system → EFS; sub-millisecond caching → ElastiCache; decouple producers from consumers with queues → SQS). Each front must have exactly one defensible best answer among AWS services — avoid scenarios where two services genuinely fit.
- [ ] **Step 4:** Checks: fronts unique ×5; no leakage; verbatim check; validator ×5; card counts recorded per deck.
- [ ] **Step 5:** Commit — `git commit -m "Split two-ask flashcards and add AWS scenario cards"`

### Task 5: Final verification

- [ ] **Step 1:** `node scripts/validate-content.mjs` ×5; `node scripts/check-drift.mjs` (should be untouched by this effort — confirm); `node scripts/export-anki.mjs` regenerates all decks.
- [ ] **Step 2:** Full-deck format validation (scratchpad): 4 fields per row, globally unique IDs, valid tag format, no empty fields, no duplicate fronts within a deck, headers correct — across all 5 regenerated decks.
- [ ] **Step 3:** Browser spot-check: networking + aws flashcards views render the new counts, flip/mark/filter work, zero console errors.
- [ ] **Step 4:** Report final per-deck card counts vs the 344 baseline. Commit anything outstanding.

---

Plan complete. Final review (most capable model) over the whole range after Task 5, then finishing-a-development-branch.
