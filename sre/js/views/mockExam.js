import { DOMAINS, EXAM_FORMAT, EXAM_UI } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { drawMockExam, isCorrect, estimateScaledScore } from '../lib/scoring.js';
import { createStore } from '../lib/storage.js';

const store = createStore();
const QUESTIONS_BY_ID = new Map(QUESTIONS.map((q) => [q.id, q]));

// Tracks the single in-flight exam timer (if any) so that navigating away
// from an in-progress mock exam — or starting a new one — can never leave a
// previous countdown's setInterval running in the background. The router
// (js/app.js) has no per-view teardown hook; it just swaps mount.innerHTML,
// so this module has to detect "the user left" itself via `hashchange`.
let activeTimerId = null;
let activeHashchangeHandler = null;
let activeBeforeUnloadHandler = null;

function stopActiveTimer() {
  if (activeTimerId !== null) {
    clearInterval(activeTimerId);
    activeTimerId = null;
  }
  if (activeHashchangeHandler !== null) {
    window.removeEventListener('hashchange', activeHashchangeHandler);
    activeHashchangeHandler = null;
  }
  if (activeBeforeUnloadHandler !== null) {
    window.removeEventListener('beforeunload', activeBeforeUnloadHandler);
    activeBeforeUnloadHandler = null;
  }
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Reads and validates the persisted checkpoint (if any). A checkpoint that
// has expired or whose question ids no longer resolve (e.g. the question
// bank changed) is discarded rather than offered for resume.
function readResumableCheckpoint() {
  const checkpoint = store.getExamCheckpoint();
  if (!checkpoint) return null;

  const { questionIds, answers, index, deadline } = checkpoint;
  const isWellFormed = Array.isArray(questionIds)
    && Array.isArray(answers)
    && typeof index === 'number'
    && typeof deadline === 'number';
  if (!isWellFormed || deadline <= Date.now()) {
    store.clearExamCheckpoint();
    return null;
  }

  const exam = questionIds.map((id) => QUESTIONS_BY_ID.get(id));
  if (exam.some((q) => !q)) {
    store.clearExamCheckpoint();
    return null;
  }

  const answeredCount = answers.filter((a) => Array.isArray(a) && a.length > 0).length;
  const secondsLeft = Math.max(0, Math.round((deadline - Date.now()) / 1000));
  const boundedIndex = Math.min(Math.max(index, 0), exam.length - 1);

  return {
    exam,
    answers: exam.map((_, i) => (Array.isArray(answers[i]) ? answers[i] : null)),
    index: boundedIndex,
    deadline,
    answeredCount,
    timeLeftLabel: formatClock(secondsLeft),
  };
}

export function render(mount) {
  const checkpoint = readResumableCheckpoint();
  mount.innerHTML = `
    <h2>${EXAM_UI.examLabel}</h2>
    <p>${EXAM_UI.startBlurb}</p>
    ${EXAM_UI.startNote ? `<p class="exam-note">${EXAM_UI.startNote}</p>` : ''}
    <button type="button" id="start-exam">Start ${EXAM_UI.examLabel}</button>
    ${checkpoint ? `<button type="button" id="resume-exam">Resume ${EXAM_UI.examLabel} (${checkpoint.answeredCount} answered, ${checkpoint.timeLeftLabel} left)</button>` : ''}
  `;
  document.getElementById('start-exam').addEventListener('click', () => startExam(mount));
  if (checkpoint) {
    document.getElementById('resume-exam').addEventListener('click', () => {
      stopActiveTimer();
      const state = { index: checkpoint.index, answers: checkpoint.answers };
      runExam(mount, checkpoint.exam, state, checkpoint.deadline);
    });
  }
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
  };
  const deadline = Date.now() + EXAM_FORMAT.durationMinutes * 60 * 1000;
  runExam(mount, exam, state, deadline);
}

// Shared exam loop used by both a fresh start and a resumed-from-checkpoint
// exam. `deadline` is an absolute epoch-ms timestamp; time remaining is
// always derived from it rather than decremented, so a resumed exam reflects
// genuinely elapsed time instead of resetting the clock.
function runExam(mount, exam, state, deadline) {
  const questionIds = exam.map((q) => q.id);

  function persistCheckpoint() {
    store.setExamCheckpoint({
      questionIds,
      answers: state.answers,
      index: state.index,
      deadline,
    });
  }
  persistCheckpoint();

  // The mock exam view doesn't use hash params (it's always just `#/exam`),
  // so any navigation away — to Home, Study Guide, back to Mock Exam, etc.
  // — fires a `hashchange`. Use that as the "user left without finishing"
  // signal and tear down the timer. `{ once: true }` means this self-removes
  // the first time it fires, so it never leaks or double-fires. The
  // checkpoint persisted above (and refreshed on every saveAnswer()) is what
  // makes leaving recoverable via the Resume button.
  const onHashChange = () => stopActiveTimer();
  activeHashchangeHandler = onHashChange;
  window.addEventListener('hashchange', onHashChange, { once: true });

  // Refresh/close while an exam is in flight loses nothing thanks to the
  // checkpoint, but still ask for confirmation via the browser's native
  // leave-confirmation prompt so an accidental refresh isn't the default.
  const onBeforeUnload = (e) => { e.preventDefault(); };
  activeBeforeUnloadHandler = onBeforeUnload;
  window.addEventListener('beforeunload', onBeforeUnload);

  function currentSecondsLeft() {
    return Math.max(0, Math.round((deadline - Date.now()) / 1000));
  }

  function updateTimerDisplay() {
    const el = document.getElementById('exam-timer');
    if (!el) return;
    el.textContent = formatClock(currentSecondsLeft());
  }

  activeTimerId = setInterval(() => {
    updateTimerDisplay();
    if (currentSecondsLeft() <= 0) {
      saveAnswer();
      stopActiveTimer();
      finishExam(mount, exam, state);
    }
  }, 1000);

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
    document.getElementById('exam-prev').addEventListener('click', () => {
      saveAnswer();
      state.index -= 1;
      persistCheckpoint();
      renderQuestion();
    });
    document.getElementById('exam-next').addEventListener('click', () => {
      saveAnswer();
      if (state.index + 1 < exam.length) {
        state.index += 1;
        persistCheckpoint();
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
    persistCheckpoint();
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

  mount.innerHTML = `
    <h2>${EXAM_UI.examLabel} Results</h2>
    <p class="quiz-score">Estimated scaled score: ${score} / ${EXAM_FORMAT.maxScore} — ${passed ? 'PASS' : 'Below passing score'}</p>
    <p class="exam-note">${EXAM_UI.resultsNote}</p>
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
    <p><a href="#/exam" id="exam-retake">Take another ${EXAM_UI.examLabel.toLowerCase()}</a> · <a href="#/progress">View progress</a></p>
  `;
  store.clearExamCheckpoint();
  try {
    store.recordMockExamAttempt({
      score,
      correct: correctCount,
      total: exam.length,
      passed,
      timestamp: new Date().toISOString(),
    });
  } catch {
    mount.insertAdjacentHTML('beforeend', '<p class="exam-note">Could not save this attempt to history.</p>');
  }
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
