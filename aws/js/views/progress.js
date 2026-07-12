import { DOMAINS, EXAM_UI } from '../data/examInfo.js';
import { FLASHCARDS } from '../data/flashcards.js';
import { createStore } from '../lib/storage.js';

const store = createStore();

export function render(mount) {
  const quizHistory = store.getQuizHistory();
  const mockHistory = store.getMockExamHistory();
  const flashcardState = store.getFlashcardState();
  const knownCount = Object.values(flashcardState).filter(Boolean).length;
  const masteryPct = FLASHCARDS.length ? Math.round((knownCount / FLASHCARDS.length) * 100) : 0;

  const domainStats = DOMAINS.map((d) => {
    const attempts = quizHistory.filter((a) => a.domain === d.id && a.total > 0);
    const correct = attempts.reduce((sum, a) => sum + a.score, 0);
    const total = attempts.reduce((sum, a) => sum + a.total, 0);
    return {
      id: d.id,
      name: d.name,
      attemptCount: attempts.length,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
    };
  });
  const attemptedDomains = domainStats.filter((d) => d.attemptCount > 0);
  const weakestId = attemptedDomains.length >= 2
    ? attemptedDomains.reduce((min, d) => (d.accuracyPct < min.accuracyPct ? d : min)).id
    : (attemptedDomains.length === 1 && attemptedDomains[0].accuracyPct < 100 ? attemptedDomains[0].id : null);

  mount.innerHTML = `
    <h2>Progress</h2>
    <section>
      <h3>Flashcard Mastery</h3>
      <p>${knownCount} / ${FLASHCARDS.length} marked known (${masteryPct}%)</p>
    </section>
    <section>
      <h3>By Domain</h3>
      <table class="history-table">
        <thead><tr><th>Domain</th><th>Attempts</th><th>Accuracy</th></tr></thead>
        <tbody>
          ${domainStats.map((d) => `
            <tr>
              <td>${d.name}${d.id === weakestId ? ' <span class="feedback-incorrect">— weakest, focus here</span>' : ''}</td>
              <td>${d.attemptCount}</td>
              <td>${d.accuracyPct === null ? 'no attempts yet' : `${d.accuracyPct}%`}</td>
            </tr>
          `).join('')}
        </tbody>
      </table>
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
      <h3>${EXAM_UI.examLabel} History</h3>
      ${mockHistory.length === 0 ? `<p>No ${EXAM_UI.examLabel.toLowerCase()}s taken yet.</p>` : `
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
