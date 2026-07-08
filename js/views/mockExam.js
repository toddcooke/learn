import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { drawMockExam, isCorrect, estimateScaledScore } from '../lib/scoring.js';
import { createStore } from '../lib/storage.js';

const store = createStore();

export function render(mount) {
  mount.innerHTML = `
    <h2>Mock Exam</h2>
    <p>${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam.</p>
    <button type="button" id="start-exam">Start Mock Exam</button>
  `;
  document.getElementById('start-exam').addEventListener('click', () => startExam(mount));
}

function startExam(mount) {
  const exam = drawMockExam(QUESTIONS, DOMAINS);
  const state = {
    index: 0,
    answers: new Array(exam.length).fill(null),
    secondsLeft: EXAM_FORMAT.durationMinutes * 60,
  };

  state.timerId = setInterval(() => {
    state.secondsLeft -= 1;
    updateTimerDisplay();
    if (state.secondsLeft <= 0) {
      clearInterval(state.timerId);
      finishExam(mount, exam, state);
    }
  }, 1000);

  function updateTimerDisplay() {
    const el = document.getElementById('exam-timer');
    if (!el) return;
    const m = Math.floor(state.secondsLeft / 60);
    const s = state.secondsLeft % 60;
    el.textContent = `${m}:${String(s).padStart(2, '0')}`;
  }

  function renderQuestion() {
    const q = exam[state.index];
    const isMulti = q.questionType === 'multiple-response';
    const selected = state.answers[state.index] ?? [];
    mount.innerHTML = `
      <div class="exam-header">
        <span>Question ${state.index + 1} of ${exam.length}</span>
        <span id="exam-timer" class="exam-timer"></span>
      </div>
      <form id="exam-form">
        <p class="quiz-question">${q.question}</p>
        ${q.options.map((opt, i) => `
          <label class="quiz-option">
            <input type="${isMulti ? 'checkbox' : 'radio'}" name="answer" value="${i}" ${selected.includes(i) ? 'checked' : ''} />
            ${opt}
          </label>
        `).join('')}
      </form>
      <div class="exam-nav">
        <button type="button" id="exam-prev" ${state.index === 0 ? 'disabled' : ''}>Previous</button>
        <button type="button" id="exam-next">${state.index + 1 < exam.length ? 'Next' : 'Review & Submit'}</button>
      </div>
    `;
    updateTimerDisplay();
    document.getElementById('exam-prev').addEventListener('click', () => { saveAnswer(); state.index -= 1; renderQuestion(); });
    document.getElementById('exam-next').addEventListener('click', () => {
      saveAnswer();
      if (state.index + 1 < exam.length) {
        state.index += 1;
        renderQuestion();
      } else {
        clearInterval(state.timerId);
        finishExam(mount, exam, state);
      }
    });
  }

  function saveAnswer() {
    const selected = Array.from(mount.querySelectorAll('input[name="answer"]:checked')).map((el) => Number(el.value));
    state.answers[state.index] = selected;
  }

  renderQuestion();
}

function finishExam(mount, exam, state) {
  const results = exam.map((q, i) => ({
    question: q,
    selected: state.answers[i] ?? [],
    correct: isCorrect(q, state.answers[i] ?? []),
  }));
  const correctCount = results.filter((r) => r.correct).length;
  const score = estimateScaledScore(correctCount, exam.length);
  const passed = score >= EXAM_FORMAT.passingScore;

  const byDomain = DOMAINS.map((d) => {
    const domainResults = results.filter((r) => r.question.domain === d.id);
    const domainCorrect = domainResults.filter((r) => r.correct).length;
    return { domain: d, correct: domainCorrect, total: domainResults.length };
  });

  store.recordMockExamAttempt({
    score,
    correct: correctCount,
    total: exam.length,
    passed,
    timestamp: new Date().toISOString(),
  });

  mount.innerHTML = `
    <h2>Mock Exam Results</h2>
    <p class="quiz-score">Estimated scaled score: ${score} / ${EXAM_FORMAT.maxScore} — ${passed ? 'PASS' : 'Below passing score'}</p>
    <p class="exam-note">This is an estimate based on percent correct; AWS's real scaling formula is not public. Passing score is ${EXAM_FORMAT.passingScore}.</p>
    <p>${correctCount} / ${exam.length} correct</p>
    <h3>By Domain</h3>
    <ul>
      ${byDomain.map((d) => `<li>${d.domain.name}: ${d.correct} / ${d.total}</li>`).join('')}
    </ul>
    <h3>Review</h3>
    ${results.map((r, i) => `
      <article class="review-item ${r.correct ? 'feedback-correct' : 'feedback-incorrect'}">
        <p><strong>Q${i + 1}.</strong> ${r.question.question}</p>
        <p>${r.correct ? 'Correct' : 'Incorrect'} — ${r.question.explanation}</p>
      </article>
    `).join('')}
    <p><a href="#/exam">Take another mock exam</a> · <a href="#/progress">View progress</a></p>
  `;
}
