const NAMESPACE = 'net-prep';

function load(backend, key, fallback) {
  const raw = backend.getItem(`${NAMESPACE}:${key}`);
  if (raw === null) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

function save(backend, key, value) {
  backend.setItem(`${NAMESPACE}:${key}`, JSON.stringify(value));
}

export function createStore(backend = globalThis.localStorage) {
  return {
    getQuizHistory() {
      return load(backend, 'quiz-history', []);
    },
    recordQuizAttempt(attempt) {
      const history = load(backend, 'quiz-history', []);
      history.push(attempt);
      save(backend, 'quiz-history', history);
    },
    getFlashcardState() {
      return load(backend, 'flashcard-state', {});
    },
    setFlashcardKnown(cardId, known) {
      const state = load(backend, 'flashcard-state', {});
      state[cardId] = known;
      save(backend, 'flashcard-state', state);
    },
    getMockExamHistory() {
      return load(backend, 'mock-exam-history', []);
    },
    recordMockExamAttempt(attempt) {
      const history = load(backend, 'mock-exam-history', []);
      history.push(attempt);
      save(backend, 'mock-exam-history', history);
    },
  };
}
