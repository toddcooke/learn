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

// The in-memory fallback is deliberately shared across every createStore()
// call (see storage.js), so these fallback tests assert relative growth
// rather than absolute lengths — earlier tests may already have written to
// the shared backend.
test('unavailable localStorage falls back to in-memory store', () => {
  const store = createStore(null);
  const before = store.getQuizHistory().length;
  store.recordQuizAttempt({ score: 2 });
  const history = store.getQuizHistory();
  assert.equal(history.length, before + 1);
  assert.equal(history[history.length - 1].score, 2);
});

test('every fallback store shares the same in-memory backend', () => {
  const writer = createStore(null);
  const reader = createStore(null);
  const before = reader.getQuizHistory().length;
  writer.recordQuizAttempt({ score: 7 });
  const history = reader.getQuizHistory();
  assert.equal(history.length, before + 1);
  assert.equal(history[history.length - 1].score, 7);
});

// The namespace prefix differs per module, so seed wrong-shape values with a
// backend that returns the same raw string for every key instead of
// hard-coding namespaced keys.
function storeWithRaw(raw) {
  return createStore({
    getItem: () => raw,
    setItem: () => {},
    removeItem: () => {},
  });
}

test('valid-JSON-but-wrong-shape values fall back per getter', () => {
  assert.deepEqual(storeWithRaw('{}').getQuizHistory(), []);
  assert.deepEqual(storeWithRaw('null').getQuizHistory(), []);
  assert.deepEqual(storeWithRaw('"oops"').getMockExamHistory(), []);
  assert.deepEqual(storeWithRaw('[]').getFlashcardState(), {});
  assert.deepEqual(storeWithRaw('null').getFlashcardState(), {});
  assert.equal(storeWithRaw('[1,2]').getExamCheckpoint(), null);
  assert.equal(storeWithRaw('42').getExamCheckpoint(), null);
});

test('recording over a wrong-shape history starts a fresh array instead of throwing', () => {
  let written;
  const store = createStore({
    getItem: () => '{}',
    setItem: (k, v) => { written = v; },
    removeItem: () => {},
  });
  assert.doesNotThrow(() => store.recordQuizAttempt({ score: 5 }));
  assert.deepEqual(JSON.parse(written), [{ score: 5 }]);
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

test('quiz checkpoint set/get/clear round-trips', () => {
  const store = createStore(fakeBackend());
  assert.equal(store.getQuizCheckpoint(), null);
  store.setQuizCheckpoint({ domainId: 'secure', questionIds: ['a', 'b'], index: 1, answers: [{ questionId: 'a', selected: [0], correct: true }] });
  assert.equal(store.getQuizCheckpoint().domainId, 'secure');
  assert.equal(store.getQuizCheckpoint().index, 1);
  store.clearQuizCheckpoint();
  assert.equal(store.getQuizCheckpoint(), null);
});

test('flashcard session set/get/clear round-trips', () => {
  const store = createStore(fakeBackend());
  assert.equal(store.getFlashcardSession(), null);
  store.setFlashcardSession({ order: ['ec2', 's3'], index: 1, filterUnknown: true });
  assert.deepEqual(store.getFlashcardSession().order, ['ec2', 's3']);
  assert.equal(store.getFlashcardSession().filterUnknown, true);
  store.clearFlashcardSession();
  assert.equal(store.getFlashcardSession(), null);
});

test('wrong-shape quiz checkpoint and flashcard session fall back to null', () => {
  assert.equal(storeWithRaw('[1,2]').getQuizCheckpoint(), null);
  assert.equal(storeWithRaw('"oops"').getQuizCheckpoint(), null);
  assert.equal(storeWithRaw('null').getQuizCheckpoint(), null);
  assert.equal(storeWithRaw('[]').getFlashcardSession(), null);
  assert.equal(storeWithRaw('42').getFlashcardSession(), null);
  assert.equal(storeWithRaw('null').getFlashcardSession(), null);
});

test('clearQuizHistory empties recorded quiz attempts', () => {
  const store = createStore(fakeBackend());
  store.recordQuizAttempt({ domain: 'secure', score: 8, total: 10 });
  assert.equal(store.getQuizHistory().length, 1);
  store.clearQuizHistory();
  assert.deepEqual(store.getQuizHistory(), []);
});

test('clearMockExamHistory empties recorded exam attempts', () => {
  const store = createStore(fakeBackend());
  store.recordMockExamAttempt({ score: 780, correct: 50, total: 65 });
  assert.equal(store.getMockExamHistory().length, 1);
  store.clearMockExamHistory();
  assert.deepEqual(store.getMockExamHistory(), []);
});

test('clearFlashcardState empties known-card state', () => {
  const store = createStore(fakeBackend());
  store.setFlashcardKnown('ec2', true);
  assert.equal(store.getFlashcardState().ec2, true);
  store.clearFlashcardState();
  assert.deepEqual(store.getFlashcardState(), {});
});

test('clear methods swallow removeItem failures instead of throwing', () => {
  const store = createStore({
    getItem: () => null,
    setItem: () => {},
    removeItem: () => { throw new Error('SecurityError'); },
  });
  assert.doesNotThrow(() => store.clearExamCheckpoint());
  assert.doesNotThrow(() => store.clearQuizCheckpoint());
  assert.doesNotThrow(() => store.clearFlashcardSession());
  assert.doesNotThrow(() => store.clearQuizHistory());
  assert.doesNotThrow(() => store.clearMockExamHistory());
  assert.doesNotThrow(() => store.clearFlashcardState());
});

test('backend whose getItem throws during probe falls back to in-memory store', () => {
  const throwingProbe = {
    getItem: () => { throw new Error('SecurityError'); },
    setItem: () => { throw new Error('SecurityError'); },
    removeItem: () => { throw new Error('SecurityError'); },
  };
  const store = createStore(throwingProbe);
  const before = store.getQuizHistory().length;
  assert.doesNotThrow(() => store.recordQuizAttempt({ score: 3 }));
  const history = store.getQuizHistory();
  assert.equal(history.length, before + 1);
  assert.equal(history[history.length - 1].score, 3);
});

test('globalThis.localStorage access throwing does not crash zero-arg createStore', () => {
  const original = Object.getOwnPropertyDescriptor(globalThis, 'localStorage');
  Object.defineProperty(globalThis, 'localStorage', {
    get() { throw new Error('SecurityError'); },
    configurable: true,
  });
  try {
    let store;
    assert.doesNotThrow(() => { store = createStore(); });
    const before = store.getQuizHistory().length;
    store.recordQuizAttempt({ score: 4 });
    const history = store.getQuizHistory();
    assert.equal(history.length, before + 1);
    assert.equal(history[history.length - 1].score, 4);
  } finally {
    if (original) {
      Object.defineProperty(globalThis, 'localStorage', original);
    } else {
      delete globalThis.localStorage;
    }
  }
});

test('arch results: records and keeps the best score per challenge', () => {
  const store = createStore(fakeBackend());
  assert.deepEqual(store.getArchResults(), {});
  store.recordArchResult('public-web', { completedAt: 1, bpPassed: 1, bpApplicable: 3 });
  store.recordArchResult('public-web', { completedAt: 2, bpPassed: 3, bpApplicable: 3 });
  assert.equal(store.getArchResults()['public-web'].bpPassed, 3);
  store.recordArchResult('public-web', { completedAt: 3, bpPassed: 0, bpApplicable: 3 });
  assert.equal(store.getArchResults()['public-web'].bpPassed, 3, 'worse result must not clobber');
  assert.equal(store.getArchResults()['public-web'].completedAt, 2);
});

test('arch drafts: set/get/clear round-trip per challenge id', () => {
  const store = createStore(fakeBackend());
  const draft = {
    vpc: { cidr: '10.0.0.0/16' },
    subnets: [], natGateways: [], routeTables: [], securityGroups: [], workloads: [],
  };
  assert.equal(store.getArchDraft('two-tier'), null);
  store.setArchDraft('two-tier', draft);
  assert.deepEqual(store.getArchDraft('two-tier'), draft);
  assert.equal(store.getArchDraft('sandbox'), null, 'ids are independent');
  store.clearArchDraft('two-tier');
  assert.equal(store.getArchDraft('two-tier'), null);
});

test('arch getters survive a wrong-shape stored value', () => {
  assert.deepEqual(storeWithRaw('["not","an","object"]').getArchResults(), {});
  assert.equal(storeWithRaw('42').getArchDraft('x'), null);
});

test('arch draft with the right outer shape but wrong-shape fields returns null', () => {
  assert.equal(storeWithRaw('{"foo":1}').getArchDraft('x'), null);
});

test('a minimally-shaped arch draft round-trips non-null', () => {
  const raw = '{"vpc":{},"subnets":[],"natGateways":[],"routeTables":[],"securityGroups":[],"workloads":[]}';
  assert.notEqual(storeWithRaw(raw).getArchDraft('x'), null);
});

test('arch CFN text: set/get/clear round-trip per challenge id', () => {
  const store = createStore(fakeBackend());
  assert.equal(store.getArchCfnText('two-tier'), null);
  store.setArchCfnText('two-tier', 'Resources: {}\n');
  assert.equal(store.getArchCfnText('two-tier'), 'Resources: {}\n');
  assert.equal(store.getArchCfnText('sandbox'), null, 'ids are independent');
  store.clearArchCfnText('two-tier');
  assert.equal(store.getArchCfnText('two-tier'), null);
});

test('arch CFN text getter survives a non-string stored value', () => {
  assert.equal(storeWithRaw('{"foo":1}').getArchCfnText('x'), null);
  assert.equal(storeWithRaw('42').getArchCfnText('x'), null);
});
