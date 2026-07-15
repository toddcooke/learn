import test from 'node:test';
import assert from 'node:assert/strict';
import { validateCheckpoint, crossedThreshold } from './examSupport.js';

const QUESTIONS_BY_ID = new Map([
  ['q1', { id: 'q1' }],
  ['q2', { id: 'q2' }],
  ['q3', { id: 'q3' }],
]);

const NOW = 1_000_000;

function goodCheckpoint(overrides = {}) {
  return {
    questionIds: ['q1', 'q2', 'q3'],
    answers: [[0], null, []],
    index: 1,
    deadline: NOW + 90_000,
    ...overrides,
  };
}

test('validateCheckpoint rejects malformed values', () => {
  assert.equal(validateCheckpoint(null, QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint(0, QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint('nope', QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint([], QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint({}, QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint(goodCheckpoint({ questionIds: [] }), QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint(goodCheckpoint({ questionIds: 'q1' }), QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint(goodCheckpoint({ answers: 'x' }), QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint(goodCheckpoint({ index: -1 }), QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint(goodCheckpoint({ index: 1.5 }), QUESTIONS_BY_ID, NOW), null);
  assert.equal(validateCheckpoint(goodCheckpoint({ deadline: '123' }), QUESTIONS_BY_ID, NOW), null);
});

test('validateCheckpoint rejects checkpoints whose ids no longer resolve', () => {
  const raw = goodCheckpoint({ questionIds: ['q1', 'gone', 'q3'] });
  assert.equal(validateCheckpoint(raw, QUESTIONS_BY_ID, NOW), null);
});

test('validateCheckpoint accepts a well-formed unexpired checkpoint', () => {
  const result = validateCheckpoint(goodCheckpoint(), QUESTIONS_BY_ID, NOW);
  assert.notEqual(result, null);
  assert.equal(result.expired, false);
  assert.deepEqual(result.checkpoint.exam.map((q) => q.id), ['q1', 'q2', 'q3']);
  assert.deepEqual(result.checkpoint.answers, [[0], null, []]);
  assert.equal(result.checkpoint.index, 1);
  assert.equal(result.checkpoint.deadline, NOW + 90_000);
  assert.equal(result.checkpoint.answeredCount, 1);
  assert.equal(result.checkpoint.secondsLeft, 90);
});

test('validateCheckpoint marks a past-deadline checkpoint expired instead of rejecting it', () => {
  const result = validateCheckpoint(goodCheckpoint({ deadline: NOW - 5000 }), QUESTIONS_BY_ID, NOW);
  assert.notEqual(result, null);
  assert.equal(result.expired, true);
  assert.equal(result.checkpoint.secondsLeft, 0);
});

test('validateCheckpoint clamps an out-of-range index', () => {
  const result = validateCheckpoint(goodCheckpoint({ index: 99 }), QUESTIONS_BY_ID, NOW);
  assert.equal(result.checkpoint.index, 2);
});

test('validateCheckpoint normalizes a missing flags field to an empty array', () => {
  const raw = goodCheckpoint();
  assert.equal('flags' in raw, false);
  const result = validateCheckpoint(raw, QUESTIONS_BY_ID, NOW);
  assert.deepEqual(result.checkpoint.flags, []);
});

test('validateCheckpoint normalizes a wrong-shape flags field to an empty array', () => {
  const result = validateCheckpoint(goodCheckpoint({ flags: 'q1' }), QUESTIONS_BY_ID, NOW);
  assert.deepEqual(result.checkpoint.flags, []);
});

test('validateCheckpoint keeps valid flags and drops out-of-range or non-integer entries', () => {
  const result = validateCheckpoint(goodCheckpoint({ flags: [2, 0, -1, 3, 1.5, 'q1'] }), QUESTIONS_BY_ID, NOW);
  assert.deepEqual(result.checkpoint.flags, [2, 0]);
});

test('crossedThreshold returns null when no threshold is crossed', () => {
  assert.equal(crossedThreshold(700, 650), null);
  assert.equal(crossedThreshold(500, 400), null);
  assert.equal(crossedThreshold(30, 20), null);
  assert.equal(crossedThreshold(600, 599), null);
  assert.equal(crossedThreshold(60, 59), null);
});

test('crossedThreshold announces each threshold once, on the crossing tick', () => {
  assert.equal(crossedThreshold(601, 600), '10 minutes remaining');
  assert.equal(crossedThreshold(605, 597), '10 minutes remaining');
  assert.equal(crossedThreshold(61, 60), '1 minute remaining');
  assert.equal(crossedThreshold(62, 58), '1 minute remaining');
});

test('crossedThreshold reports only the lowest threshold on a large jump', () => {
  assert.equal(crossedThreshold(700, 50), '1 minute remaining');
  assert.equal(crossedThreshold(601, 0), '1 minute remaining');
});
