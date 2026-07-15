import { DOMAINS, EXAM_UI } from '../data/examInfo.js';
import { FLASHCARDS } from '../data/flashcards.js';
import { createStore } from '../lib/storage.js';
import { escapeHtml } from '../lib/html.js';

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
      // Unrounded fraction for comparisons; the rounded percent is display-only
      // (two domains that round to the same percent can still differ).
      accuracy: total > 0 ? correct / total : null,
      accuracyPct: total > 0 ? Math.round((correct / total) * 100) : null,
    };
  });
  const attemptedDomains = domainStats.filter((d) => d.attemptCount > 0);
  // Flag the lowest-accuracy attempted domain, but never when it's perfect —
  // there is nothing to "focus on" if every attempted domain is at 100%.
  const weakest = attemptedDomains.length > 0
    ? attemptedDomains.reduce((min, d) => (d.accuracy < min.accuracy ? d : min))
    : null;
  const weakestId = weakest !== null && weakest.accuracy < 1 ? weakest.id : null;

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
              <td>${escapeHtml(d.name)}${d.id === weakestId ? ' <span class="feedback-incorrect">— weakest, focus here</span>' : ''}</td>
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
                <td>${escapeHtml(DOMAINS.find((d) => d.id === a.domain)?.name ?? a.domain)}</td>
                <td>${a.score} / ${a.total}</td>
                <td>${new Date(a.timestamp).toLocaleDateString()}</td>
              </tr>
            `).join('')}
          </tbody>
        </table>
      `}
    </section>
    <section>
      <h3>${escapeHtml(EXAM_UI.examLabel)} History</h3>
      ${mockHistory.length === 0 ? `<p>No ${escapeHtml(EXAM_UI.examLabel.toLowerCase())}s taken yet.</p>` : `
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
