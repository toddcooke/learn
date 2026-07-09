import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About This Site</h2>
      <p>General PostgreSQL mastery — not tied to any certification.</p>
      <p class="exam-note">Unlike some other learning modules on this site, there is no single, universally recognized PostgreSQL certification to prepare for — the PostgreSQL Global Development Group doesn't run one. The domains below are a self-authored curriculum covering both DBA and application-development knowledge, grounded in the official PostgreSQL documentation, not an official exam blueprint.</p>
      <ul class="exam-facts">
        <li>${EXAM_FORMAT.totalQuestions}-question practice exam, ${EXAM_FORMAT.durationMinutes}-minute time limit</li>
        <li>Self-test score 0–${EXAM_FORMAT.maxScore}, informal passing line at ${EXAM_FORMAT.passingScore}</li>
      </ul>
      <h3>Domains</h3>
      <ul class="domain-list">
        ${DOMAINS.map((d) => `<li><a href="#/study/${d.id}">${d.name}</a> — ${d.weight}%</li>`).join('')}
      </ul>
      <h3>How to use this site</h3>
      <ol>
        <li>Read the <a href="#/study">Study Guide</a> for each domain.</li>
        <li>Test yourself with <a href="#/quiz">domain quizzes</a>.</li>
        <li>Drill weak spots with <a href="#/flashcards">flashcards</a>.</li>
        <li>Take the <a href="#/exam">practice exam</a>.</li>
        <li>Track improvement on the <a href="#/progress">progress dashboard</a>.</li>
      </ol>
    </section>
  `;
}
