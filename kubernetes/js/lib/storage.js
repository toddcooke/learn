const NAMESPACE = 'cka-prep';

function load(backend, key, fallback) {
  let raw;
  try {
    raw = backend.getItem(`${NAMESPACE}:${key}`);
  } catch {
    return fallback;
  }
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(backend, key, value) {
  try {
    backend.setItem(`${NAMESPACE}:${key}`, JSON.stringify(value));
  } catch {
    /* ignore write failures (quota exceeded, blocked storage, etc.) */
  }
}

// Single module-scoped in-memory fallback. Every view module calls
// createStore() separately; when localStorage is unavailable they must all
// land on the SAME backend, or each view would get its own private Map and
// cross-view features (e.g. Progress reading quiz history written by Quiz)
// would silently see nothing for the whole session.
let sharedMemoryBackend = null;

function memoryBackend() {
  if (sharedMemoryBackend === null) {
    const map = new Map();
    sharedMemoryBackend = {
      getItem: (k) => (map.has(k) ? map.get(k) : null),
      setItem: (k, v) => { map.set(k, v); },
      removeItem: (k) => { map.delete(k); },
    };
  }
  return sharedMemoryBackend;
}

// Stored values can be valid JSON but the wrong shape (a hand-edited key, or
// a value written by an older/newer format). Each getter validates the parsed
// shape and returns its fallback instead of handing views a value they can't
// iterate — an unguarded wrong shape would throw mid-render and leave the
// view permanently blank until storage is manually cleared.
function isPlainObject(value) {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function loadArray(backend, key) {
  const value = load(backend, key, []);
  return Array.isArray(value) ? value : [];
}

function loadObject(backend, key) {
  const value = load(backend, key, {});
  return isPlainObject(value) ? value : {};
}

export function createStore(backend) {
  let resolved = backend;
  if (resolved === undefined) {
    try {
      resolved = globalThis.localStorage;
    } catch {
      resolved = undefined;
    }
  }
  let b;
  try {
    b = resolved || memoryBackend();
    b.getItem(`${NAMESPACE}:probe`);
  } catch {
    b = memoryBackend();
  }
  return {
    getQuizHistory() {
      return loadArray(b, 'quiz-history');
    },
    recordQuizAttempt(attempt) {
      const history = loadArray(b, 'quiz-history');
      history.push(attempt);
      save(b, 'quiz-history', history);
    },
    getFlashcardState() {
      return loadObject(b, 'flashcard-state');
    },
    setFlashcardKnown(cardId, known) {
      const state = loadObject(b, 'flashcard-state');
      state[cardId] = known;
      save(b, 'flashcard-state', state);
    },
    getMockExamHistory() {
      return loadArray(b, 'mock-exam-history');
    },
    recordMockExamAttempt(attempt) {
      const history = loadArray(b, 'mock-exam-history');
      history.push(attempt);
      save(b, 'mock-exam-history', history);
    },
    getExamCheckpoint() {
      const value = load(b, 'exam-checkpoint', null);
      return isPlainObject(value) ? value : null;
    },
    setExamCheckpoint(checkpoint) {
      save(b, 'exam-checkpoint', checkpoint);
    },
    clearExamCheckpoint() {
      try {
        b.removeItem(`${NAMESPACE}:exam-checkpoint`);
      } catch {
        /* ignore */
      }
    },
    getQuizCheckpoint() {
      const value = load(b, 'quiz-checkpoint', null);
      return isPlainObject(value) ? value : null;
    },
    setQuizCheckpoint(checkpoint) {
      save(b, 'quiz-checkpoint', checkpoint);
    },
    clearQuizCheckpoint() {
      try {
        b.removeItem(`${NAMESPACE}:quiz-checkpoint`);
      } catch {
        /* ignore */
      }
    },
    getFlashcardSession() {
      const value = load(b, 'flashcard-session', null);
      return isPlainObject(value) ? value : null;
    },
    setFlashcardSession(session) {
      save(b, 'flashcard-session', session);
    },
    clearFlashcardSession() {
      try {
        b.removeItem(`${NAMESPACE}:flashcard-session`);
      } catch {
        /* ignore */
      }
    },
    getArchResults() {
      return loadObject(b, 'arch-results');
    },
    recordArchResult(challengeId, result) {
      const results = loadObject(b, 'arch-results');
      const prev = results[challengeId];
      const ratio = (r) => (r.bpApplicable > 0 ? r.bpPassed / r.bpApplicable : 1);
      if (!prev || ratio(result) >= ratio(prev)) {
        results[challengeId] = result;
        save(b, 'arch-results', results);
      }
    },
    getArchDraft(challengeId) {
      // A wrong-shape draft would throw mid-render on the challenge page with
      // no Reset button in reach, so every array field it iterates is checked.
      const value = load(b, `arch-draft:${challengeId}`, null);
      const arraysOk = ['subnets', 'natGateways', 'routeTables', 'securityGroups', 'workloads']
        .every((k) => Array.isArray(value?.[k]));
      return isPlainObject(value) && isPlainObject(value.vpc) && arraysOk ? value : null;
    },
    setArchDraft(challengeId, state) {
      save(b, `arch-draft:${challengeId}`, state);
    },
    clearArchDraft(challengeId) {
      try {
        b.removeItem(`${NAMESPACE}:arch-draft:${challengeId}`);
      } catch {
        /* ignore */
      }
    },
    getArchCfnText(challengeId) {
      const value = load(b, `arch-cfn:${challengeId}`, null);
      return typeof value === 'string' ? value : null;
    },
    setArchCfnText(challengeId, text) {
      save(b, `arch-cfn:${challengeId}`, text);
    },
    clearArchCfnText(challengeId) {
      try {
        b.removeItem(`${NAMESPACE}:arch-cfn:${challengeId}`);
      } catch {
        /* ignore */
      }
    },
    clearQuizHistory() {
      try {
        b.removeItem(`${NAMESPACE}:quiz-history`);
      } catch {
        /* ignore */
      }
    },
    clearMockExamHistory() {
      try {
        b.removeItem(`${NAMESPACE}:mock-exam-history`);
      } catch {
        /* ignore */
      }
    },
    clearFlashcardState() {
      try {
        b.removeItem(`${NAMESPACE}:flashcard-state`);
      } catch {
        /* ignore */
      }
    },
  };
}
