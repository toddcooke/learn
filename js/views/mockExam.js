import { DOMAINS, EXAM_FORMAT } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { drawMockExam, isCorrect, estimateScaledScore } from '../lib/scoring.js';
import { createStore } from '../lib/storage.js';

const store = createStore();

// Tracks the single in-flight exam timer (if any) so that navigating away
// from an in-progress mock exam — or starting a new one — can never leave a
// previous countdown's setInterval running in the background. The router
// (js/app.js) has no per-view teardown hook; it just swaps mount.innerHTML,
// so this module has to detect "the user left" itself via `hashchange`.
let activeTimerId = null;
let activeHashchangeHandler = null;

function stopActiveTimer() {
  if (activeTimerId !== null) {
    clearInterval(activeTimerId);
    activeTimerId = null;
  }
  if (activeHashchangeHandler !== null) {
    window.removeEventListener('hashchange', activeHashchangeHandler);
    activeHashchangeHandler = null;
  }
}

export function render(mount) {
  mount.innerHTML = `
    <h2>Mock Exam</h2>
    <p>${EXAM_FORMAT.totalQuestions} questions, ${EXAM_FORMAT.durationMinutes} minutes, drawn and weighted like the real exam's domains.</p>
    <p class="exam-note">The real CKA exam is 100% hands-on (command-line tasks in a live cluster), not multiple-choice. This mock exam reinforces the same knowledge but isn't a replica of the real exam experience — pair it with hands-on practice (kind, minikube, killer.sh).</p>
    <button type="button" id="start-exam">Start Mock Exam</button>
  `;
  document.getElementById('start-exam').addEventListener('click', () => startExam(mount));
}

function startExam(mount) {
  // Defensive: if some earlier exam's timer/listener is still alive for any
  // reason, clear it before starting a new one so two intervals can never
  // run concurrently.
  stopActiveTimer();

  const exam = drawMockExam(QUESTIONS, DOMAINS);
  const state = {
    index: 0,
    answers: new Array(exam.length).fill(null),
    secondsLeft: EXAM_FORMAT.durationMinutes * 60,
  };

  // The mock exam view doesn't use hash params (it's always just `#/exam`),
  // so any navigation away — to Home, Study Guide, back to Mock Exam, etc.
  // — fires a `hashchange`. Use that as the "user left without finishing"
  // signal and tear down the timer. `{ once: true }` means this self-removes
  // the first time it fires, so it never leaks or double-fires.
  const onHashChange = () => stopActiveTimer();
  activeHashchangeHandler = onHashChange;
  window.addEventListener('hashchange', onHashChange, { once: true });

  state.timerId = setInterval(() => {
    state.secondsLeft -= 1;
    updateTimerDisplay();
    if (state.secondsLeft <= 0) {
      stopActiveTimer();
      finishExam(mount, exam, state);
    }
  }, 1000);
  activeTimerId = state.timerId;

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
        stopActiveTimer();
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
  const score = estimateScaledScore(correctCount, exam.length, {
    minScore: EXAM_FORMAT.minScore,
    maxScore: EXAM_FORMAT.maxScore,
  });
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
    <p><a href="#/exam" id="exam-retake">Take another mock exam</a> · <a href="#/progress">View progress</a></p>
  `;
  // The hash (#/exam) is already active on this results screen, so a click
  // on "Take another mock exam" doesn't change the URL fragment and the
  // router's `hashchange` listener never fires. Re-invoke this module's own
  // entry point directly instead of relying on hash navigation, which shows
  // the "Start Mock Exam" landing screen — matching what a real hash-triggered
  // navigation to #/exam would do (render, not startExam).
  document.getElementById('exam-retake').addEventListener('click', (e) => {
    e.preventDefault();
    render(mount);
  });
}
