import { DOMAINS } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { isCorrect, shuffle } from '../lib/scoring.js';
import { createStore } from '../lib/storage.js';

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
  runQuiz(mount, domain, questions);
}

function renderDomainPicker(mount) {
  mount.innerHTML = `
    <h2>Quizzes</h2>
    <p>Choose a domain to quiz yourself on.</p>
    <ul class="domain-list">
      ${DOMAINS.map((d) => `<li><a href="#/quiz/${d.id}">${d.name}</a> (${QUESTIONS.filter((q) => q.domain === d.id).length} questions)</li>`).join('')}
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
function runQuestionLoop(mount, { headerHtml, questions, onDone }) {
  const state = { index: 0, correctCount: 0, answers: [] };

  function renderQuestion(focusLegend) {
    const q = questions[state.index];
    const isMulti = q.questionType === 'multiple-response';
    const shuffledOptions = shuffle(q.options.map((opt, i) => ({ opt, i })));
    mount.innerHTML = `
      ${headerHtml}
      <p class="quiz-progress">Question ${state.index + 1} of ${questions.length}</p>
      <form id="quiz-form">
        <fieldset>
          <legend class="quiz-question">${q.question}</legend>
          ${shuffledOptions.map(({ opt, i }) => `
            <label class="quiz-option">
              <input type="${isMulti ? 'checkbox' : 'radio'}" name="answer" value="${i}" />
              ${opt}
            </label>
          `).join('')}
        </fieldset>
        <div id="quiz-feedback" role="status"></div>
        <button type="submit">Submit Answer</button>
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
    if (selected.length === 0) return;
    const correct = isCorrect(q, selected);
    if (correct) state.correctCount += 1;
    state.answers.push({ questionId: q.id, selected, correct });

    const feedback = document.getElementById('quiz-feedback');
    feedback.innerHTML = `
      <p class="${correct ? 'feedback-correct' : 'feedback-incorrect'}">
        ${correct ? 'Correct!' : 'Incorrect.'} ${q.explanation}
      </p>
      <button type="button" id="quiz-next">${state.index + 1 < questions.length ? 'Next Question' : 'See Results'}</button>
    `;
    mount.querySelector('#quiz-form button[type="submit"]').disabled = true;
    mount.querySelectorAll('input[name="answer"]').forEach((el) => { el.disabled = true; });
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
  runQuestionLoop(mount, { headerHtml: `<h2>${label}</h2>`, questions, onDone });
}

function runQuiz(mount, domain, questions) {
  runQuestionLoop(mount, {
    headerHtml: `
      <p><a href="#/quiz">&larr; All quizzes</a></p>
      <h2>${domain.name} Quiz</h2>
    `,
    questions,
    onDone: (result) => renderResults(mount, domain, questions, result),
  });
}

function renderResults(mount, domain, questions, result) {
  const missed = result.answers.filter((a) => !a.correct);
  mount.innerHTML = `
    <h2>${domain.name} Quiz Results</h2>
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
  try {
    store.recordQuizAttempt({
      domain: domain.id,
      score: result.correctCount,
      total: questions.length,
      timestamp: new Date().toISOString(),
    });
  } catch {
    mount.insertAdjacentHTML('beforeend', '<p class="exam-note">Could not save this attempt to history.</p>');
  }
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
    <h2>${domain.name} Quiz — review round results</h2>
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
