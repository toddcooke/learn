const NAMESPACE = 'pg-prep';

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

function memoryBackend() {
  const map = new Map();
  return {
    getItem: (k) => (map.has(k) ? map.get(k) : null),
    setItem: (k, v) => { map.set(k, v); },
    removeItem: (k) => { map.delete(k); },
  };
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
      return load(b, 'quiz-history', []);
    },
    recordQuizAttempt(attempt) {
      const history = load(b, 'quiz-history', []);
      history.push(attempt);
      save(b, 'quiz-history', history);
    },
    getFlashcardState() {
      return load(b, 'flashcard-state', {});
    },
    setFlashcardKnown(cardId, known) {
      const state = load(b, 'flashcard-state', {});
      state[cardId] = known;
      save(b, 'flashcard-state', state);
    },
    getMockExamHistory() {
      return load(b, 'mock-exam-history', []);
    },
    recordMockExamAttempt(attempt) {
      const history = load(b, 'mock-exam-history', []);
      history.push(attempt);
      save(b, 'mock-exam-history', history);
    },
    getExamCheckpoint() {
      return load(b, 'exam-checkpoint', null);
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
  };
}
