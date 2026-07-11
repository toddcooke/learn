import test from 'node:test';
import assert from 'node:assert/strict';
import { createStore } from './storage.js';

function fakeBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => map.set(k, String(v)),
    removeItem: (k) => map.delete(k),
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

test('save failures are swallowed, not thrown', () => {
  const throwing = {
    getItem: () => null,
    setItem: () => { throw new Error('QuotaExceededError'); },
  };
  const store = createStore(throwing);
  assert.doesNotThrow(() => store.recordQuizAttempt({ score: 1 }));
  assert.deepEqual(store.getQuizHistory(), []);
});

test('unavailable localStorage falls back to in-memory store', () => {
  const store = createStore(null);
  store.recordQuizAttempt({ score: 2 });
  assert.equal(store.getQuizHistory().length, 1);
});

test('exam checkpoint set/get/clear round-trips', () => {
  const backend = fakeBackend();
  const store = createStore(backend);
  assert.equal(store.getExamCheckpoint(), null);
  store.setExamCheckpoint({ index: 3, answers: [[0]], questionIds: ['a'], deadline: 123 });
  assert.equal(store.getExamCheckpoint().index, 3);
  store.clearExamCheckpoint();
  assert.equal(store.getExamCheckpoint(), null);
});
