import test from 'node:test';
import assert from 'node:assert/strict';
import { isCorrect, estimateScaledScore, drawMockExam } from './scoring.js';

test('isCorrect matches regardless of selection order', () => {
  const q = { correctIndexes: [1, 3] };
  assert.equal(isCorrect(q, [3, 1]), true);
  assert.equal(isCorrect(q, [1, 2]), false);
  assert.equal(isCorrect(q, [1]), false);
});

test('estimateScaledScore maps 0% to minScore and 100% to maxScore', () => {
  assert.equal(estimateScaledScore(0, 65), 100);
  assert.equal(estimateScaledScore(65, 65), 1000);
});

test('drawMockExam pulls the configured count per domain', () => {
  const domains = [
    { id: 'a', mockExamCount: 2 },
    { id: 'b', mockExamCount: 1 },
  ];
  const questions = [
    { id: 'a1', domain: 'a' }, { id: 'a2', domain: 'a' }, { id: 'a3', domain: 'a' },
    { id: 'b1', domain: 'b' }, { id: 'b2', domain: 'b' },
  ];
  const exam = drawMockExam(questions, domains);
  assert.equal(exam.length, 3);
  assert.equal(exam.filter((q) => q.domain === 'a').length, 2);
  assert.equal(exam.filter((q) => q.domain === 'b').length, 1);
});
