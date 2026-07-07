import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './storage.js';

function fakeBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
  };
}

test('quiz history starts empty and records attempts', () => {
  const store = createStore(fakeBackend());
  assert.deepEqual(store.getQuizHistory(), []);
  store.recordQuizAttempt({ domain: 'secure', score: 8, total: 10 });
  assert.equal(store.getQuizHistory().length, 1);
  assert.equal(store.getQuizHistory()[0].domain, 'secure');
});

test('flashcard known state persists per card', () => {
  const store = createStore(fakeBackend());
  assert.deepEqual(store.getFlashcardState(), {});
  store.setFlashcardKnown('ec2', true);
  assert.equal(store.getFlashcardState().ec2, true);
});

test('mock exam history records attempts', () => {
  const store = createStore(fakeBackend());
  store.recordMockExamAttempt({ score: 780, correct: 50, total: 65 });
  assert.equal(store.getMockExamHistory().length, 1);
  assert.equal(store.getMockExamHistory()[0].score, 780);
});
