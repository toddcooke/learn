import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About the Exam</h2>
      <p>Certified Kubernetes Administrator (CKA)</p>
      <ul class="exam-facts">
        <li>Real exam: 2-hour, 100% hands-on performance-based test (command line, live clusters)</li>
        <li>Passing score: ${EXAM_FORMAT.passingScore}%, certification valid 2 years</li>
      </ul>
      <p class="exam-note">Heads up: the real CKA exam has no multiple-choice questions at all — you solve tasks in a live cluster via the command line. This site's quizzes and mock exam (${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes) test the same underlying knowledge, but passing them isn't equivalent to being ready for the real exam. Pair this with hands-on practice using <a href="https://kind.sigs.k8s.io/" target="_blank" rel="noopener">kind</a>, <a href="https://minikube.sigs.k8s.io/" target="_blank" rel="noopener">minikube</a>, or <a href="https://killer.sh/" target="_blank" rel="noopener">killer.sh</a> for genuine exam readiness.</p>
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
