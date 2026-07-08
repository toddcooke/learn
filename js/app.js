import { render as renderHome } from './views/home.js';
import { render as renderStudyGuide } from './views/studyGuide.js';
import { render as renderQuiz } from './views/quiz.js';
import { render as renderFlashcards } from './views/flashcards.js';
import { render as renderMockExam } from './views/mockExam.js';
import { render as renderProgress } from './views/progress.js';

const VIEWS = {
  home: renderHome,
  study: renderStudyGuide,
  quiz: renderQuiz,
  flashcards: renderFlashcards,
  exam: renderMockExam,
  progress: renderProgress,
};

function parseHash() {
  const hash = window.location.hash.replace(/^#\/?/, '');
  const [view, ...params] = hash.split('/').filter(Boolean);
  return { view: view || 'home', params };
}

function highlightNav(view) {
  document.querySelectorAll('#nav a').forEach((a) => {
    a.classList.toggle('active', a.dataset.view === view);
  });
}

function renderRoute() {
  const { view, params } = parseHash();
  const mount = document.getElementById('app-content');
  const renderFn = VIEWS[view] || renderHome;
  mount.innerHTML = '';
  renderFn(mount, ...params);
  highlightNav(VIEWS[view] ? view : 'home');
}

window.addEventListener('hashchange', renderRoute);
window.addEventListener('DOMContentLoaded', renderRoute);
