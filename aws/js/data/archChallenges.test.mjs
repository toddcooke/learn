import test from 'node:test';
import assert from 'node:assert/strict';
import { ARCH_CHALLENGES } from './archChallenges.js';
import { createArch } from '../lib/archModel.js';
import { validateStructure, evaluateBestPractices } from '../lib/archValidate.js';
import { evaluateGoals } from '../lib/archGoals.js';

test('there are at least 5 challenges with unique ids', () => {
  assert.ok(ARCH_CHALLENGES.length >= 5);
  const ids = ARCH_CHALLENGES.map((c) => c.id);
  assert.equal(new Set(ids).size, ids.length);
});

for (const ch of ARCH_CHALLENGES) {
  test(`challenge "${ch.id}": reference solution is structurally clean`, () => {
    const arch = ch.refSolution();
    assert.deepEqual(validateStructure(arch).errors, []);
  });

  test(`challenge "${ch.id}": reference solution passes every goal`, () => {
    const arch = ch.refSolution();
    for (const row of evaluateGoals(arch, ch)) {
      assert.equal(row.ok, true, `${row.label}\n${row.detail}\n${JSON.stringify(row.traces, null, 2)}`);
    }
  });

  test(`challenge "${ch.id}": reference solution passes every applicable best practice`, () => {
    const arch = ch.refSolution();
    for (const row of evaluateBestPractices(arch, ch.bestPractices)) {
      assert.equal(row.ok, true, `${row.ruleId}: ${row.message}`);
    }
  });

  test(`challenge "${ch.id}": an empty architecture does not pass`, () => {
    const start = ch.startState ? ch.startState() : createArch();
    const rows = evaluateGoals(start, ch);
    assert.ok(rows.some((r) => !r.ok), 'at least one goal must fail before any work is done');
  });

  test(`challenge "${ch.id}": startState (when present) is structurally clean`, () => {
    if (!ch.startState) return;
    assert.deepEqual(validateStructure(ch.startState()).errors, []);
  });

  test(`challenge "${ch.id}": refSolution returns a fresh object each call`, () => {
    assert.notEqual(ch.refSolution(), ch.refSolution());
  });
}
