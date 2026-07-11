import { DOMAINS } from '../data/examInfo.js';
import { QUESTIONS } from '../data/questions.js';
import { isCorrect } from '../lib/scoring.js';
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

function runQuiz(mount, domain, questions) {
  const state = { index: 0, correctCount: 0, answers: [] };

  function renderQuestion(focusLegend) {
    const q = questions[state.index];
    const isMulti = q.questionType === 'multiple-response';
    mount.innerHTML = `
      <p><a href="#/quiz">&larr; All quizzes</a></p>
      <h2>${domain.name} Quiz</h2>
      <p class="quiz-progress">Question ${state.index + 1} of ${questions.length}</p>
      <form id="quiz-form">
        <fieldset>
          <legend class="quiz-question">${q.question}</legend>
          ${q.options.map((opt, i) => `
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
        renderResults();
      }
    });
  }

  function renderResults() {
    mount.innerHTML = `
      <h2>${domain.name} Quiz Results</h2>
      <p class="quiz-score">${state.correctCount} / ${questions.length} correct</p>
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
    try {
      store.recordQuizAttempt({
        domain: domain.id,
        score: state.correctCount,
        total: questions.length,
        timestamp: new Date().toISOString(),
      });
    } catch {
      mount.insertAdjacentHTML('beforeend', '<p class="exam-note">Could not save this attempt to history.</p>');
    }
  }

  renderQuestion();
}
