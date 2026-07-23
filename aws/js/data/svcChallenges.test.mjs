import test from 'node:test';
import assert from 'node:assert/strict';
import { SVC_CHALLENGES } from './svcChallenges.js';
import { createGraph } from '../lib/svcModel.js';
import { validateStructure, evaluateBestPractices } from '../lib/svcValidate.js';
import { evaluateGoals } from '../lib/svcGoals.js';

test('there are exactly 8 challenges with unique ids', () => {
  assert.equal(SVC_CHALLENGES.length, 8);
  const ids = SVC_CHALLENGES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const ch of SVC_CHALLENGES) {
  test(`challenge "${ch.id}": reference solution is structurally clean`, () => {
    assert.deepEqual(validateStructure(ch.refSolution()).errors, []);
  });

  test(`challenge "${ch.id}": reference solution passes every goal`, () => {
    for (const row of evaluateGoals(ch.refSolution(), ch)) {
      assert.equal(row.ok, true, `${row.label}\n${row.detail}\n${JSON.stringify(row.traces, null, 2)}`);
    }
  });

  test(`challenge "${ch.id}": reference solution passes every applicable best practice`, () => {
    for (const row of evaluateBestPractices(ch.refSolution(), ch.bestPractices)) {
      assert.equal(row.ok, true, `${row.ruleId}: ${row.message}`);
    }
  });

  test(`challenge "${ch.id}": the start state does not already pass`, () => {
    const start = ch.startState ? ch.startState() : createGraph();
    const rows = evaluateGoals(start, ch);
    assert.ok(rows.some((r) => !r.ok), 'at least one goal must fail before any work is done');
  });

  test(`challenge "${ch.id}": startState (when present) is structurally clean`, () => {
    if (!ch.startState) return;
    assert.deepEqual(validateStructure(ch.startState()).errors, []);
  });

  test(`challenge "${ch.id}": builders return fresh objects each call`, () => {
    assert.notEqual(ch.refSolution(), ch.refSolution());
    if (ch.startState) assert.notEqual(ch.startState(), ch.startState());
  });
}

test('fix-diagram: the shipped startState fails exactly its planted goal flaws', () => {
  const ch = SVC_CHALLENGES.find((c) => c.id === 'fix-diagram');
  const rows = evaluateGoals(ch.startState(), ch);
  const failing = rows.filter((r) => !r.ok).map((r) => `${r.goal.type}:${JSON.stringify(r.goal.to ?? r.goal.via ?? '')}`);
  // (a) no CloudFront path + the direct S3 fetch, (b) no queue path + the
  // direct function chain, (c) the direct DynamoDB read. The API path and
  // both exists goals already pass.
  assert.equal(rows.filter((r) => !r.ok).length, 5, failing.join('\n'));
  const bp = evaluateBestPractices(ch.startState(), ch.bestPractices);
  for (const ruleId of ['cdn-in-front', 'auth-on-public-api', 'no-lambda-chaining', 'db-behind-compute']) {
    assert.ok(bp.some((r) => r.ruleId === ruleId && r.applicable && !r.ok), `${ruleId} must start failing`);
  }
});

test('iot-twin start pre-places only the car fleet', () => {
  const ch = SVC_CHALLENGES.find((c) => c.id === 'iot-twin');
  const start = ch.startState();
  assert.deepEqual(start.nodes.map((n) => n.type), ['devices']);
});

test('upload-pipeline start pre-wires the presigned upload edge', () => {
  const ch = SVC_CHALLENGES.find((c) => c.id === 'upload-pipeline');
  const start = ch.startState();
  assert.equal(start.edges.length, 1);
  assert.deepEqual(start.nodes.map((n) => n.type).sort(), ['s3', 'users']);
});

// noEdge is universal (vacuously true over an empty selection), so a
// renamed role or dropped service in a refSolution could silently gut a
// guard goal. Pin the invariant: every selector in every goal matches at
// least one node of the challenge's own reference solution.
for (const ch of SVC_CHALLENGES) {
  test(`challenge "${ch.id}": every goal selector matches a refSolution node`, () => {
    const graph = ch.refSolution();
    const matches = (sel) => graph.nodes.some((n) => (sel.service !== undefined
      ? n.type === sel.service : n.role === sel.role));
    for (const g of ch.goals) {
      const sels = [g.sel, g.from, g.to, g.a, g.b, ...(g.via ?? [])].filter(Boolean);
      assert.ok(sels.length > 0, `${g.type} goal has selectors`);
      for (const sel of sels) {
        assert.ok(matches(sel), `${g.type} selector ${JSON.stringify(sel)} matches nothing in refSolution`);
      }
    }
  });
}
