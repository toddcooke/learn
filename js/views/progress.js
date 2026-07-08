import { DOMAINS } from '../data/examInfo.js';
import { FLASHCARDS } from '../data/flashcards.js';
import { createStore } from '../lib/storage.js';

const store = createStore();

export function render(mount) {
  const quizHistory = store.getQuizHistory();
  const mockHistory = store.getMockExamHistory();
  const flashcardState = store.getFlashcardState();
  const knownCount = Object.values(flashcardState).filter(Boolean).length;
  const masteryPct = FLASHCARDS.length ? Math.round((knownCount / FLASHCARDS.length) * 100) : 0;

  mount.innerHTML = `
    <h2>Progress</h2>
    <section>
      <h3>Flashcard Mastery</h3>
      <p>${knownCount} / ${FLASHCARDS.length} marked known (${masteryPct}%)</p>
    </section>
    <section>
      <h3>Quiz History</h3>
      ${quizHistory.length === 0 ? '<p>No quizzes taken yet.</p>' : `
        <table class="history-table">
          <thead><tr><th>Domain</th><th>Score</th><th>Date</th></tr></thead>
          <tbody>
            ${quizHistory.slice().reverse().map((a) => `
              <tr>
                <td>${DOMAINS.find((d) => d.id === a.domain)?.name ?? a.domain}</td>
                <td>${a.score} / ${a.total}</td>
                <td>${new Date(a.timestamp).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </section>
    <section>
      <h3>Mock Exam History</h3>
      ${mockHistory.length === 0 ? '<p>No mock exams taken yet.</p>' : `
        <table class="history-table">
          <thead><tr><th>Score</th><th>Correct</th><th>Result</th><th>Date</th></tr></thead>
          <tbody>
            ${mockHistory.slice().reverse().map((a) => `
              <tr>
                <td>${a.score}</td>
                <td>${a.correct} / ${a.total}</td>
                <td>${a.passed ? 'Pass' : 'Fail'}</td>
                <td>${new Date(a.timestamp).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </section>
  `;
}
