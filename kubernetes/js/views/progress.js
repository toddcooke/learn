import { DOMAINS, EXAM_UI } from '../data/examInfo.js';
import { FLASHCARDS } from '../data/flashcards.js';
import { createStore } from '../lib/storage.js';
import { computeDomainStats, weakestDomainId } from '../lib/weakAreas.js';
import { escapeHtml } from '../lib/html.js';

const store = createStore();

export function render(mount) {
  const quizHistory = store.getQuizHistory();
  const mockHistory = store.getMockExamHistory();
  const flashcardState = store.getFlashcardState();
  const knownCount = Object.values(flashcardState).filter(Boolean).length;
  const masteryPct = FLASHCARDS.length ? Math.round((knownCount / FLASHCARDS.length) * 100) : 0;

  // Accuracy math and weakest-domain selection live in js/lib/weakAreas.js
  // (unit tested); this view only renders what it's told.
  const domainStats = computeDomainStats(DOMAINS, quizHistory);
  const weakestId = weakestDomainId(domainStats);

  const examLabelLower = EXAM_UI.examLabel.toLowerCase();
  mount.innerHTML = `
    <h2>Progress</h2>
    <section>
      <h3>Flashcard Mastery</h3>
      <p>${knownCount} / ${FLASHCARDS.length} marked known (${masteryPct}%)</p>
    </section>
    <section>
      <h3>By Domain</h3>
      <div class="table-scroll">
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
      </div>
    </section>
    <section>
      <h3>Quiz History</h3>
      ${quizHistory.length === 0 ? '<p>No quizzes taken yet.</p>' : `
        <div class="table-scroll">
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
        </div>
      `}
    </section>
    <section>
      <h3>${escapeHtml(EXAM_UI.examLabel)} History</h3>
      ${mockHistory.length === 0 ? `<p>No ${escapeHtml(examLabelLower)}s taken yet.</p>` : `
        <div class="table-scroll">
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
        </div>
      `}
    </section>
    <section>
      <h3>Reset</h3>
      <p class="exam-note">Each action permanently removes the stored data on this device.</p>
      <div class="progress-reset">
        <button type="button" id="reset-quiz-history" class="danger">Clear quiz history</button>
        <button type="button" id="reset-exam-history" class="danger">Clear ${escapeHtml(examLabelLower)} history</button>
        <button type="button" id="reset-flashcards" class="danger">Reset flashcard progress</button>
      </div>
    </section>
  `;
  // Each reset is confirm()-guarded — a stray click must never wipe months
  // of history — and re-renders the view so the tables above reflect the
  // cleared state immediately.
  document.getElementById('reset-quiz-history').addEventListener('click', () => {
    if (!confirm('Clear all quiz history? This cannot be undone.')) return;
    store.clearQuizHistory();
    render(mount);
  });
  document.getElementById('reset-exam-history').addEventListener('click', () => {
    if (!confirm(`Clear all ${examLabelLower} history? This cannot be undone.`)) return;
    store.clearMockExamHistory();
    render(mount);
  });
  document.getElementById('reset-flashcards').addEventListener('click', () => {
    if (!confirm('Reset flashcard progress? All cards will be unmarked. This cannot be undone.')) return;
    store.clearFlashcardState();
    render(mount);
  });
}
