import { DOMAINS, EXAM_FORMAT, EXAM_UI } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { drawMockExam, isCorrect, estimateScaledScore, shuffle } from '../lib/scoring.js';
import { createStore } from '../lib/storage.js';
import { validateCheckpoint, crossedThreshold } from '../lib/examSupport.js';
import { escapeHtml } from '../lib/html.js';
import { runReviewRound } from './quiz.js';

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
// The exam's visually-hidden aria-live region. It's created once per exam
// screen as a sibling of `mount` (never inside it), so the wholesale
// `mount.innerHTML` rewrites that happen on every Prev/Next/finish leave it
// untouched — only `removeLiveRegion()` (called on real navigation away, or
// defensively before a new exam starts) tears it down. That keeps a message
// like the expiry announcement readable through the results screen instead
// of being yanked out of the DOM in the same tick it was written.
let activeLiveRegion = null;

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

function removeLiveRegion() {
  if (activeLiveRegion !== null) {
    activeLiveRegion.remove();
    activeLiveRegion = null;
  }
}

function formatClock(totalSeconds) {
  const m = Math.floor(totalSeconds / 60);
  const s = totalSeconds % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// Reads and validates the persisted checkpoint (if any) via
// examSupport.validateCheckpoint. A checkpoint whose question ids no longer
// resolve (e.g. the question bank changed) is discarded. A well-formed
// checkpoint whose deadline has passed is NOT discarded — it's returned with
// `expired: true` so render() can score the saved answers instead of
// silently throwing them away.
function readResumableCheckpoint() {
  const validated = validateCheckpoint(store.getExamCheckpoint(), QUESTIONS_BY_ID, Date.now());
  if (!validated) {
    // Covers malformed values AND stored-but-falsy ones (e.g. a raw `0`);
    // clearing is a harmless no-op when nothing was stored at all.
    store.clearExamCheckpoint();
    return null;
  }
  const { checkpoint, expired } = validated;
  return {
    ...checkpoint,
    timeLeftLabel: formatClock(checkpoint.secondsLeft),
    expired,
  };
}

export function render(mount) {
  // The landing screen is never shown while an exam is in flight, so any
  // live region still hanging around here belongs to a just-finished or
  // abandoned exam (finishExam() deliberately leaves it in place so its
  // final announcement stays inspectable through the results screen) —
  // sweep it up before that finished exam's leftovers accumulate.
  removeLiveRegion();
  const checkpoint = readResumableCheckpoint();
  // Time ran out while the user was away: a deadline-expired checkpoint is a
  // finished exam, not a discardable one. Score the saved answers, record the
  // attempt, and show the results screen (finishExam also clears the
  // checkpoint) with a note explaining what happened.
  if (checkpoint && checkpoint.expired) {
    finishExam(mount, checkpoint.exam, { index: checkpoint.index, answers: checkpoint.answers }, { expiredWhileAway: true });
    return;
  }
  mount.innerHTML = `
    <h2>${escapeHtml(EXAM_UI.examLabel)}</h2>
    <p>${escapeHtml(EXAM_UI.startBlurb)}</p>
    ${EXAM_UI.startNote ? `<p class="exam-note">${escapeHtml(EXAM_UI.startNote)}</p>` : ''}
    <button type="button" id="start-exam">Start ${escapeHtml(EXAM_UI.examLabel)}</button>
    ${checkpoint ? `<button type="button" id="resume-exam">Resume ${escapeHtml(EXAM_UI.examLabel)} (${checkpoint.answeredCount} answered, ${checkpoint.timeLeftLabel} left)</button>` : ''}
  `;
  document.getElementById('start-exam').addEventListener('click', () => startExam(mount));
  if (checkpoint) {
    document.getElementById('resume-exam').addEventListener('click', () => {
      stopActiveTimer();
      removeLiveRegion();
      const state = { index: checkpoint.index, answers: checkpoint.answers, flags: new Set(checkpoint.flags) };
      runExam(mount, checkpoint.exam, state, checkpoint.deadline);
    });
  }
}

function startExam(mount) {
  // Defensive: if some earlier exam's timer/listener is still alive for any
  // reason, clear it before starting a new one so two intervals can never
  // run concurrently.
  stopActiveTimer();
  removeLiveRegion();

  const exam = drawMockExam(QUESTIONS, DOMAINS);
  const state = {
    index: 0,
    answers: new Array(exam.length).fill(null),
    flags: new Set(),
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
  // Each question's option order is shuffled ONCE per exam run (here, which
  // also covers resume) and reused on every re-render, so revisiting a
  // question via Previous/Next shows its options in a stable order instead
  // of reshuffling on each visit. Answers are stored by original option
  // index, so the display order never affects scoring.
  const optionOrders = exam.map((q) => shuffle(q.options.map((_, i) => i)));

  function persistCheckpoint() {
    store.setExamCheckpoint({
      questionIds,
      answers: state.answers,
      index: state.index,
      deadline,
      // OPTIONAL field: checkpoints saved before flags existed resume fine
      // (validateCheckpoint normalizes a missing/wrong-shape value to []).
      flags: Array.from(state.flags),
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
  const onHashChange = () => {
    stopActiveTimer();
    removeLiveRegion();
  };
  activeHashchangeHandler = onHashChange;
  window.addEventListener('hashchange', onHashChange, { once: true });

  // Refresh/close while an exam is in flight loses nothing thanks to the
  // checkpoint, but still ask for confirmation via the browser's native
  // leave-confirmation prompt so an accidental refresh isn't the default.
  // Some browsers require returnValue to be set (not just preventDefault)
  // before they show the confirmation dialog.
  const onBeforeUnload = (e) => {
    e.preventDefault();
    e.returnValue = '';
  };
  activeBeforeUnloadHandler = onBeforeUnload;
  window.addEventListener('beforeunload', onBeforeUnload);

  // Visually-hidden polite live region for time-remaining announcements.
  // Deliberately NOT a child of `mount` — every Prev/Next/finish rewrites
  // `mount.innerHTML` wholesale, which would destroy (and, on re-insertion,
  // risk re-announcing) a region living inside it. As a sibling it survives
  // question navigation untouched and is only torn down by `removeLiveRegion()`
  // (real navigation away, or a defensive reset before a new exam starts).
  const liveRegion = document.createElement('div');
  liveRegion.id = 'exam-live-region';
  liveRegion.className = 'visually-hidden';
  liveRegion.setAttribute('aria-live', 'polite');
  mount.after(liveRegion);
  activeLiveRegion = liveRegion;

  function currentSecondsLeft() {
    return Math.max(0, Math.round((deadline - Date.now()) / 1000));
  }

  function updateTimerDisplay() {
    const el = document.getElementById('exam-timer');
    if (!el) return;
    el.textContent = formatClock(currentSecondsLeft());
  }

  // Tracks the previous tick's seconds-left so each threshold is announced
  // exactly once, on the tick it's crossed (`prev > threshold && now <=
  // threshold`) rather than every tick the timer happens to read at/under it.
  // A resumed exam that's already past a threshold when this session starts
  // never fires that threshold's announcement retroactively, since `prev`
  // starts at the current value, not above the threshold.
  let prevSecondsLeft = currentSecondsLeft();

  // crossedThreshold (js/lib/examSupport.js) checks lowest-threshold-first:
  // a throttled background tab can jump many minutes in one tick and cross
  // BOTH thresholds at once, and announcing "10 minutes remaining" when
  // under a minute actually remains would be affirmatively wrong. Only the
  // lowest crossed threshold is announced.
  function announceThresholds(secondsLeft) {
    const message = crossedThreshold(prevSecondsLeft, secondsLeft);
    if (message !== null) {
      liveRegion.textContent = message;
    }
    prevSecondsLeft = secondsLeft;
  }

  activeTimerId = setInterval(() => {
    const secondsLeft = currentSecondsLeft();
    updateTimerDisplay();
    announceThresholds(secondsLeft);
    if (secondsLeft <= 0) {
      liveRegion.textContent = 'Time expired — exam submitted.';
      saveAnswer();
      stopActiveTimer();
      finishExam(mount, exam, state);
    }
  }, 1000);

  function isAnswered(i) {
    return Array.isArray(state.answers[i]) && state.answers[i].length > 0;
  }

  function unansweredCount() {
    return exam.reduce((n, _, i) => n + (isAnswered(i) ? 0 : 1), 0);
  }

  function navItemLabel(i) {
    let label = `Question ${i + 1}`;
    if (isAnswered(i)) label += ', answered';
    if (state.flags.has(i)) label += ', flagged for review';
    return label;
  }

  // Targeted refresh of the bits that change when the user answers or flags
  // without navigating: the unanswered counts and the current question's
  // navigator button. A full renderQuestion() here would rebuild the DOM and
  // yank focus off the control the user just interacted with.
  function updateQuestionStatus() {
    const label = `${unansweredCount()} unanswered`;
    for (const el of mount.querySelectorAll('.exam-unanswered')) {
      el.textContent = label;
    }
    const navBtn = mount.querySelector(`.exam-nav-item[data-index="${state.index}"]`);
    if (navBtn) {
      navBtn.classList.toggle('is-answered', isAnswered(state.index));
      navBtn.classList.toggle('is-flagged', state.flags.has(state.index));
      navBtn.setAttribute('aria-label', navItemLabel(state.index));
    }
  }

  function renderQuestion(focusCounter) {
    const q = exam[state.index];
    const isMulti = q.questionType === 'multiple-response';
    const selected = state.answers[state.index] ?? [];
    const orderedOptions = optionOrders[state.index].map((i) => ({ opt: q.options[i], i }));
    const flagged = state.flags.has(state.index);
    const isLast = state.index + 1 === exam.length;
    mount.innerHTML = `
      <div class="exam-header">
        <h2 id="exam-question-counter" class="exam-question-counter">Question ${state.index + 1} of ${exam.length}</h2>
        <span id="exam-timer" class="exam-timer" role="timer" aria-label="Time remaining"></span>
      </div>
      <form id="exam-form">
        <fieldset>
          <legend class="quiz-question">${escapeHtml(q.question)}</legend>
          ${orderedOptions.map(({ opt, i }) => `
            <label class="quiz-option">
              <input type="${isMulti ? 'checkbox' : 'radio'}" name="answer" value="${i}" ${selected.includes(i) ? 'checked' : ''} />
              ${escapeHtml(opt)}
            </label>
          `).join('')}
        </fieldset>
      </form>
      <button type="button" id="exam-flag" class="exam-flag" aria-pressed="${flagged}"><span class="exam-flag-marker" aria-hidden="true">${flagged ? '⚑ ' : ''}</span>Flag for review</button>
      <nav class="exam-nav" aria-label="Question navigator">
        ${exam.map((_, i) => {
          const classes = ['exam-nav-item'];
          if (i === state.index) classes.push('is-current');
          if (isAnswered(i)) classes.push('is-answered');
          if (state.flags.has(i)) classes.push('is-flagged');
          return `<button type="button" class="${classes.join(' ')}" data-index="${i}" ${i === state.index ? 'aria-current="true"' : ''} aria-label="${navItemLabel(i)}">${i + 1}</button>`;
        }).join('')}
      </nav>
      <p class="exam-unanswered">${unansweredCount()} unanswered</p>
      <div class="exam-controls">
        <button type="button" id="exam-prev" ${state.index === 0 ? 'disabled' : ''}>Previous</button>
        <button type="button" id="exam-next">${isLast ? 'Submit Exam' : 'Next'}</button>
        ${isLast ? `<span class="exam-unanswered exam-unanswered-badge">${unansweredCount()} unanswered</span>` : ''}
      </div>
    `;
    updateTimerDisplay();
    // Persist (and reflect) every selection as it happens, not just on
    // navigation — this is what keeps the unanswered counts live and means
    // a refresh mid-question loses nothing.
    document.getElementById('exam-form').addEventListener('change', () => {
      saveAnswer();
      updateQuestionStatus();
    });
    document.getElementById('exam-flag').addEventListener('click', (e) => {
      const flagBtn = e.currentTarget;
      const nowFlagged = !state.flags.has(state.index);
      if (nowFlagged) {
        state.flags.add(state.index);
      } else {
        state.flags.delete(state.index);
      }
      persistCheckpoint();
      flagBtn.setAttribute('aria-pressed', String(nowFlagged));
      flagBtn.querySelector('.exam-flag-marker').textContent = nowFlagged ? '⚑ ' : '';
      updateQuestionStatus();
    });
    for (const btn of mount.querySelectorAll('.exam-nav-item')) {
      btn.addEventListener('click', () => {
        const target = Number(btn.dataset.index);
        if (target === state.index) return;
        saveAnswer();
        state.index = target;
        persistCheckpoint();
        renderQuestion(true);
      });
    }
    document.getElementById('exam-prev').addEventListener('click', () => {
      saveAnswer();
      state.index -= 1;
      persistCheckpoint();
      renderQuestion(true);
    });
    document.getElementById('exam-next').addEventListener('click', () => {
      saveAnswer();
      if (state.index + 1 < exam.length) {
        state.index += 1;
        persistCheckpoint();
        renderQuestion(true);
      } else {
        stopActiveTimer();
        finishExam(mount, exam, state);
      }
    });
    if (focusCounter) {
      const counter = document.getElementById('exam-question-counter');
      counter.setAttribute('tabindex', '-1');
      counter.focus();
    }
  }

  function saveAnswer() {
    const selected = Array.from(mount.querySelectorAll('input[name="answer"]:checked')).map((el) => Number(el.value));
    state.answers[state.index] = selected;
    persistCheckpoint();
  }

  renderQuestion();
}

// `expiredWhileAway` marks the case where render() found a checkpoint whose
// deadline passed while the user wasn't on the exam view — the results are
// the same, but the screen explains that time ran out in their absence.
function finishExam(mount, exam, state, { expiredWhileAway = false } = {}) {
  const results = exam.map((q, i) => ({
    question: q,
    selected: state.answers[i] ?? [],
    correct: isCorrect(q, state.answers[i] ?? []),
  }));
  const correctCount = results.filter((r) => r.correct).length;
  const missedCount = results.length - correctCount;
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
    <h2>${escapeHtml(EXAM_UI.examLabel)} Results</h2>
    ${expiredWhileAway ? '<p class="exam-note">Time expired while you were away — this exam was scored from your saved answers.</p>' : ''}
    <p class="quiz-score">Estimated scaled score: ${score} / ${EXAM_FORMAT.maxScore} — ${passed ? 'PASS' : 'Below passing score'}</p>
    <p class="exam-note">${escapeHtml(EXAM_UI.resultsNote)}</p>
    <p>${correctCount} / ${exam.length} correct</p>
    <h3>By Domain</h3>
    <div class="table-scroll">
      <table class="exam-domain-table">
        <thead>
          <tr><th scope="col">Domain</th><th scope="col">Correct</th><th scope="col">Total</th></tr>
        </thead>
        <tbody>
          ${byDomain.map((d) => `<tr><th scope="row">${escapeHtml(d.domain.name)}</th><td>${d.correct}</td><td>${d.total}</td></tr>`).join('')}
        </tbody>
      </table>
    </div>
    <h3>Review</h3>
    ${results.map((r, i) => `
      <article class="review-item ${r.correct ? 'feedback-correct' : 'feedback-incorrect'}">
        <p><strong>Q${i + 1}.</strong> ${escapeHtml(r.question.question)}</p>
        <p><span class="feedback-marker" aria-hidden="true">${r.correct ? '✓' : '✗'}</span> ${r.correct ? 'Correct' : 'Incorrect'} — ${escapeHtml(r.question.explanation)}</p>
      </article>
    `).join('')}
    ${missedCount > 0 ? `<p><a href="#" id="exam-practice-missed">Practice the ${missedCount} missed questions</a></p>` : ''}
    <p><a href="#/exam" id="exam-retake">Take another ${escapeHtml(EXAM_UI.examLabel.toLowerCase())}</a> · <a href="#/progress">View progress</a></p>
  `;
  store.clearExamCheckpoint();
  // No try/catch here: storage.save() already swallows write failures
  // (quota, blocked storage), so recordMockExamAttempt never throws.
  store.recordMockExamAttempt({
    score,
    correct: correctCount,
    total: exam.length,
    passed,
    timestamp: new Date().toISOString(),
  });
  // The in-exam hashchange teardown was already consumed by stopActiveTimer()
  // before finishExam ran, so without a fresh listener the live region would
  // linger in the DOM through every later view. Install a one-shot listener
  // whose only job is sweeping it up when the user navigates away from this
  // results screen. It reuses the activeHashchangeHandler slot so a new exam
  // start (stopActiveTimer) also clears it.
  if (activeLiveRegion !== null) {
    const onLeaveResults = () => {
      if (activeHashchangeHandler === onLeaveResults) activeHashchangeHandler = null;
      removeLiveRegion();
    };
    activeHashchangeHandler = onLeaveResults;
    window.addEventListener('hashchange', onLeaveResults, { once: true });
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
  if (missedCount > 0) {
    document.getElementById('exam-practice-missed').addEventListener('click', (e) => {
      e.preventDefault();
      const missedQuestions = results.filter((r) => !r.correct).map((r) => r.question);
      runReviewRound(mount, `${EXAM_UI.examLabel} Practice`, missedQuestions, {
        onDone: (result) => renderPracticeComplete(mount, result),
      });
    });
  }
}

// Completion screen for the missed-questions practice round kicked off from
// finishExam(). Deliberately does nothing exam-specific: no timer, no
// scoring record, no checkpoint interaction — the checkpoint was already
// cleared when the real exam finished, and this round never persists one.
function renderPracticeComplete(mount, result) {
  mount.innerHTML = `
    <h2>${escapeHtml(EXAM_UI.examLabel)} Practice</h2>
    <p class="quiz-score">Review complete — ${result.correctCount} / ${result.total} this round</p>
    <p><a href="#/exam" id="exam-practice-done">Back to ${escapeHtml(EXAM_UI.examLabel)}</a> · <a href="#/progress">View progress</a></p>
  `;
  // Same same-hash caveat as exam-retake above: #/exam is already the active
  // hash, so this needs a direct re-invocation of render() rather than
  // relying on a hashchange that won't fire.
  document.getElementById('exam-practice-done').addEventListener('click', (e) => {
    e.preventDefault();
    render(mount);
  });
}
