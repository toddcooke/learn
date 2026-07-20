import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';

export function render(mount) {
  mount.innerHTML = `
    <section class="home">
      <h2>About the Exam</h2>
      <p>AWS Certified Solutions Architect – Associate (SAA-C03)</p>
      <ul class="exam-facts">
        <li>${EXAM_FORMAT.totalQuestions} questions (${EXAM_FORMAT.scoredQuestions} scored, ${EXAM_FORMAT.unscoredQuestions} unscored)</li>
        <li>${EXAM_FORMAT.durationMinutes}-minute time limit</li>
        <li>Scaled score ${EXAM_FORMAT.minScore}–${EXAM_FORMAT.maxScore}, passing score ${EXAM_FORMAT.passingScore}</li>
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
        <li>Simulate exam day with the <a href="#/exam">mock exam</a>.</li>
        <li>Track improvement on the <a href="#/progress">progress dashboard</a>.</li>
      </ol>
      <p><a href="vpc-explorer.html">Interactive: VPC &amp; Subnet Explorer</a> — click through subnet tiers, route tables, and CIDR math.</p>
      <p><a href="architecture-challenge.html">Interactive: Architecture Challenge</a> — get a scenario, build the VPC to satisfy it, and have the design checked for correctness and best practices.</p>
      <p><a href="cheatsheet.html">Printable cheatsheet</a> — a one-page, print-friendly summary of storage, database, networking, IAM, and cost facts for last-minute review.</p>
    </section>
  `;
}
