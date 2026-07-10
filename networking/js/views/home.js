import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About the Exam</h2>
      <p>CompTIA Network+ (N10-009)</p>
      <ul class="exam-facts">
        <li>Real exam: maximum ${EXAM_FORMAT.totalQuestions} questions (multiple-choice and performance-based), ${EXAM_FORMAT.durationMinutes} minutes</li>
        <li>Scaled score ${EXAM_FORMAT.minScore}–${EXAM_FORMAT.maxScore}, passing score ${EXAM_FORMAT.passingScore}</li>
        <li>Recommended: CompTIA A+ certification, with 9–12 months of hands-on experience in a junior network administrator or network support technician role</li>
      </ul>
      <p class="exam-note">Heads up: the real N10-009 exam also includes performance-based (simulation) questions — this site's quizzes and mock exam (${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes) are multiple-choice/multiple-response only and don't replicate those simulations. Pair this with hands-on lab practice (e.g. Cisco Packet Tracer or GNS3) for genuine exam readiness.</p>
      <h3>Domains</h3>
      <ul class="domain-list">
        ${DOMAINS.map((d) => `<li><a href="#/study/${d.id}">${d.name}</a> — ${d.weight}%</li>`).join('')}
      </ul>
      <h3>How to use this site</h3>
      <ol>
        <li>Read the <a href="#/study">Study Guide</a> for each domain.</li>
        <li>Test yourself with <a href="#/quiz">domain quizzes</a>.</li>
        <li>Drill weak spots with <a href="#/flashcards">flashcards</a>.</li>
        <li>Simulate exam day with the <a href="#/exam">mock exam</a>.</li>
        <li>Track improvement on the <a href="#/progress">progress dashboard</a>.</li>
      </ol>
    </section>
  `;
}
