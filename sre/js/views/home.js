import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About This Site</h2>
      <p>General Site Reliability Engineering mastery — not tied to any certification.</p>
      <p class="exam-note">There is no single, industry-wide SRE certification to prepare for. This site's domains are grounded primarily in Google's "Site Reliability Engineering" book and "The Site Reliability Workbook" — the field's most influential published references, but one company's perspective, not a vendor-neutral standard the way an official exam blueprint would be.</p>
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
      <p><a href="cheatsheet.html">Printable cheatsheet</a> — a one-page, print-friendly summary of SLOs, error budgets, golden signals, incident roles, and release patterns for last-minute review.</p>
    </section>
  `;
}
