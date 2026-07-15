import { DOMAINS } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { isCorrect, shuffle } from '../lib/scoring.js';
import { createStore } from '../lib/storage.js';
import { escapeHtml } from '../lib/html.js';

const store = createStore();

export function render(mount, domainId) {
  if (!domainId) {
    renderDomainPicker(mount);
    return;
  }
  const domain = DOMAINS.find((d) => d.id === domainId);
  const questions = QUESTIONS.filter((q) => q.domain === domainId);
  if (!domain || questions.length === 0) {
    mount.innerHTML = '<p>Unknown quiz domain. <a href="#/quiz">Back to Quizzes</a></p>';
    return;
  }
  const checkpoint = readResumableQuizCheckpoint(domain, questions);
  if (checkpoint) {
    renderResumePrompt(mount, domain, questions, checkpoint);
  } else {
    runQuiz(mount, domain, questions);
  }
}

// Reads and validates the single-slot quiz checkpoint for `domain`. Returns
// `{ questions, index, answers, correctCount }` when the stored value is a
// resumable in-progress run of THIS domain's quiz, or null otherwise. A
// checkpoint for a different domain is left untouched (starting any quiz
// overwrites the slot anyway); a matching-domain checkpoint that is
// malformed, has question ids that no longer resolve, or is out of range is
// cleared so it can't offer a broken resume again. Question order is
// restored from the stored ids, so a resumed quiz continues in the exact
// order it started with.
function readResumableQuizCheckpoint(domain, questions) {
  const raw = store.getQuizCheckpoint();
  if (raw === null) return null;
  if (raw.domainId !== domain.id) return null;
  const byId = new Map(questions.map((q) => [q.id, q]));
  const { questionIds, index, answers } = raw;
  const isWellFormed = Array.isArray(questionIds) && questionIds.length > 0
    && Array.isArray(answers)
    && Number.isInteger(index) && index > 0 && index < questionIds.length
    && answers.length === index;
  if (!isWellFormed) {
    // Covers a fresh unanswered slot (index 0 — nothing to resume) as well
    // as genuinely broken values; clearing is harmless in both cases.
    store.clearQuizCheckpoint();
    return null;
  }
  const ordered = questionIds.map((id) => byId.get(id));
  if (ordered.some((q) => !q)) {
    store.clearQuizCheckpoint();
    return null;
  }
  return {
    questions: ordered,
    index,
    answers,
    correctCount: answers.filter((a) => a && a.correct === true).length,
  };
}

// Offers Resume / Start over when entering a domain quiz that has an
// in-progress checkpoint. Resume continues the saved run (stored question
// order, saved answers, next unanswered question); Start over discards it.
function renderResumePrompt(mount, domain, questions, checkpoint) {
  mount.innerHTML = `
    <p><a href="#/quiz">&larr; All quizzes</a></p>
    <h2>${escapeHtml(domain.name)} Quiz</h2>
    <p>You have a quiz in progress — ${checkpoint.index} of ${checkpoint.questions.length} answered.</p>
    <button type="button" id="quiz-resume">Resume quiz</button>
    <button type="button" id="quiz-start-over" class="secondary">Start over</button>
  `;
  document.getElementById('quiz-resume').addEventListener('click', () => {
    runQuiz(mount, domain, checkpoint.questions, {
      index: checkpoint.index,
      answers: checkpoint.answers,
      correctCount: checkpoint.correctCount,
    });
  });
  document.getElementById('quiz-start-over').addEventListener('click', () => {
    store.clearQuizCheckpoint();
    runQuiz(mount, domain, questions);
  });
}

function renderDomainPicker(mount) {
  mount.innerHTML = `
    <h2>Quizzes</h2>
    <p>Choose a domain to quiz yourself on.</p>
    <ul class="domain-list">
      ${DOMAINS.map((d) => `<li><a href="#/quiz/${d.id}">${escapeHtml(d.name)}</a> (${QUESTIONS.filter((q) => q.domain === d.id).length} questions)</li>`).join('')}
    </ul>
  `;
}

// Shared question-by-question loop used by a full quiz run, a quiz's own
// review round, and (via the exported runReviewRound wrapper below) the
// mock exam's missed-question practice round. `headerHtml` is caller-owned
// markup rendered above the shared progress line, so each caller can show
// whatever heading/back-link makes sense for its context without this loop
// knowing about quizzes vs exams. `onDone` receives `{ correctCount, total,
// answers }` once the last question is answered — the loop itself never
// decides what happens next (results screen, review-round-results screen,
// practice-complete screen), which is what lets those three screens differ
// while the question mechanics (shuffle, fieldset/legend, role=status
// feedback, focus-on-change) stay identical everywhere.
//
// `initialState` (optional) seeds `{ index, correctCount, answers }` so a
// checkpointed quiz can resume mid-run; `onAnswered` (optional) fires with
// the loop state after every recorded answer, which is the checkpointing
// hook. Review rounds pass neither, so they are never checkpointed.
function runQuestionLoop(mount, { headerHtml, questions, onDone, onAnswered, initialState }) {
  const state = {
    index: initialState?.index ?? 0,
    correctCount: initialState?.correctCount ?? 0,
    answers: initialState?.answers ?? [],
  };

  function renderQuestion(focusLegend) {
    const q = questions[state.index];
    const isMulti = q.questionType === 'multiple-response';
    const shuffledOptions = shuffle(q.options.map((opt, i) => ({ opt, i })));
    mount.innerHTML = `
      ${headerHtml}
      <p class="quiz-progress">Question ${state.index + 1} of ${questions.length}</p>
      <form id="quiz-form">
        <fieldset>
          <legend class="quiz-question">${escapeHtml(q.question)}</legend>
          ${shuffledOptions.map(({ opt, i }) => `
            <label class="quiz-option">
              <input type="${isMulti ? 'checkbox' : 'radio'}" name="answer" value="${i}" />
              ${escapeHtml(opt)}
            </label>
          `).join('')}
        </fieldset>
        <div id="quiz-feedback" role="status"></div>
        <button type="submit">Submit Answer</button>
        <div id="quiz-next-slot"></div>
      </form>
    `;
    document.getElementById('quiz-form').addEventListener('submit', (e) => {
      e.preventDefault();
      handleSubmit(q);
    });
    if (focusLegend) {
      const legend = mount.querySelector('.quiz-question');
      legend.setAttribute('tabindex', '-1');
      legend.focus();
    }
  }

  function handleSubmit(q) {
    const selected = Array.from(mount.querySelectorAll('input[name="answer"]:checked')).map((el) => Number(el.value));
    const feedback = document.getElementById('quiz-feedback');
    if (selected.length === 0) {
      // Visible and (via role=status) announced, so the Submit button never
      // looks dead when nothing is selected.
      feedback.innerHTML = '<p>Select an answer before submitting.</p>';
      return;
    }
    const correct = isCorrect(q, selected);
    if (correct) state.correctCount += 1;
    state.answers.push({ questionId: q.id, selected, correct });
    if (onAnswered) onAnswered(state);

    // Only the announcement text lives inside the role=status region; the
    // "Next Question" control goes in its own slot so AT doesn't read the
    // button as part of the announcement (or re-announce on its insertion).
    // The ✓/✗ marker is aria-hidden decoration — the adjacent word already
    // says Correct/Incorrect — so pass/fail never rides on color alone.
    feedback.innerHTML = `
      <p class="${correct ? 'feedback-correct' : 'feedback-incorrect'}">
        <span class="feedback-marker" aria-hidden="true">${correct ? '✓' : '✗'}</span>
        ${correct ? 'Correct!' : 'Incorrect.'} ${escapeHtml(q.explanation)}
      </p>
    `;
    document.getElementById('quiz-next-slot').innerHTML = `
      <button type="button" id="quiz-next">${state.index + 1 < questions.length ? 'Next Question' : 'See Results'}</button>
    `;
    mount.querySelector('#quiz-form button[type="submit"]').disabled = true;
    mount.querySelectorAll('input[name="answer"]').forEach((el) => { el.disabled = true; });
    // The just-activated Submit button is now disabled, which would drop
    // focus to <body>; move it to the feedback region instead so keyboard
    // users land on the result and can Tab straight to "Next Question".
    feedback.setAttribute('tabindex', '-1');
    feedback.focus();
    document.getElementById('quiz-next').addEventListener('click', () => {
      state.index += 1;
      if (state.index < questions.length) {
        renderQuestion(true);
      } else {
        onDone({ correctCount: state.correctCount, total: questions.length, answers: state.answers });
      }
    });
  }

  renderQuestion();
}

// Runs a review round over a subset of questions (missed questions from a
// quiz, or from a mock exam). Deliberately does NOT record any history —
// it's remediation, not a fresh graded attempt — and leaves what happens
// after the last question entirely up to `onDone`, so quiz.js's own review
// flow (below) and mockExam.js's practice-the-missed-questions flow can each
// render their own follow-up screen while sharing this exact question loop.
export function runReviewRound(mount, label, questions, { onDone }) {
  runQuestionLoop(mount, { headerHtml: `<h2>${escapeHtml(label)}</h2>`, questions, onDone });
}

function runQuiz(mount, domain, questions, initialState) {
  const questionIds = questions.map((q) => q.id);
  // A fresh start claims the single checkpoint slot immediately (index 0,
  // nothing answered), so whatever quiz was previously in progress can no
  // longer offer a stale resume. A resumed run keeps its existing slot.
  if (!initialState) {
    store.setQuizCheckpoint({ domainId: domain.id, questionIds, index: 0, answers: [] });
  }
  runQuestionLoop(mount, {
    headerHtml: `
      <p><a href="#/quiz">&larr; All quizzes</a></p>
      <h2>${escapeHtml(domain.name)} Quiz</h2>
    `,
    questions,
    initialState,
    // `index` is the next question to present — answers accumulate strictly
    // in question order, so it's always answers.length.
    onAnswered: (state) => {
      store.setQuizCheckpoint({
        domainId: domain.id,
        questionIds,
        index: state.answers.length,
        answers: state.answers,
      });
    },
    onDone: (result) => {
      store.clearQuizCheckpoint();
      renderResults(mount, domain, questions, result);
    },
  });
}

function renderResults(mount, domain, questions, result) {
  const missed = result.answers.filter((a) => !a.correct);
  mount.innerHTML = `
    <h2>${escapeHtml(domain.name)} Quiz Results</h2>
    <p class="quiz-score">${result.correctCount} / ${questions.length} correct</p>
    ${missed.length > 0 ? `<p><a href="#" id="quiz-review-missed">Review the ${missed.length} you missed</a></p>` : ''}
    <p><a href="#/quiz/${domain.id}" id="quiz-retake">Retake this quiz</a> · <a href="#/quiz">Other quizzes</a> · <a href="#/progress">View progress</a></p>
  `;
  // The hash (#/quiz/${domain.id}) is already active on this screen, so a
  // click on "Retake this quiz" doesn't change the URL fragment and the
  // router's `hashchange` listener never fires. Re-invoke the quiz runner
  // directly instead of relying on hash navigation.
  document.getElementById('quiz-retake').addEventListener('click', (e) => {
    e.preventDefault();
    runQuiz(mount, domain, questions);
  });
  if (missed.length > 0) {
    document.getElementById('quiz-review-missed').addEventListener('click', (e) => {
      e.preventDefault();
      const missedQuestions = missed.map((a) => questions.find((q) => q.id === a.questionId));
      startReviewRound(mount, domain, questions, missedQuestions);
    });
  }
  // No try/catch here: storage.save() already swallows write failures
  // (quota, blocked storage), so recordQuizAttempt never throws.
  store.recordQuizAttempt({
    domain: domain.id,
    score: result.correctCount,
    total: questions.length,
    timestamp: new Date().toISOString(),
  });
}

// Kicks off (or re-kicks off, for a review round's own misses) a review
// round scoped to `reviewQuestions`. `allQuestions` is threaded through only
// so the eventual results screen can still offer "Retake this quiz" over the
// full original set.
function startReviewRound(mount, domain, allQuestions, reviewQuestions) {
  runReviewRound(mount, `${domain.name} Quiz — review round`, reviewQuestions, {
    onDone: (result) => renderReviewRoundResults(mount, domain, allQuestions, reviewQuestions, result),
  });
}

function renderReviewRoundResults(mount, domain, allQuestions, reviewedQuestions, result) {
  const missedIds = new Set(result.answers.filter((a) => !a.correct).map((a) => a.questionId));
  const stillMissed = reviewedQuestions.filter((q) => missedIds.has(q.id));
  mount.innerHTML = `
    <h2>${escapeHtml(domain.name)} Quiz — review round results</h2>
    <p class="quiz-score">${result.correctCount} / ${result.total} correct this round</p>
    ${stillMissed.length > 0 ? `<p><a href="#" id="quiz-review-again">Review the ${stillMissed.length} you missed again</a></p>` : ''}
    <p><a href="#/quiz/${domain.id}" id="quiz-retake">Retake this quiz</a> · <a href="#/quiz">Other quizzes</a> · <a href="#/progress">View progress</a></p>
  `;
  // Same same-hash caveat as the main results screen's retake link — direct
  // re-invocation instead of relying on a hashchange that won't fire.
  document.getElementById('quiz-retake').addEventListener('click', (e) => {
    e.preventDefault();
    runQuiz(mount, domain, allQuestions);
  });
  if (stillMissed.length > 0) {
    document.getElementById('quiz-review-again').addEventListener('click', (e) => {
      e.preventDefault();
      startReviewRound(mount, domain, allQuestions, stillMissed);
    });
  }
}
