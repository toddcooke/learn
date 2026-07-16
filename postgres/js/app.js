import { render as renderHome } from './views/home.js';
import { render as renderStudyGuide } from './views/studyGuide.js';
import { render as renderServices } from './views/services.js';
import { render as renderQuiz } from './views/quiz.js';
import { render as renderFlashcards } from './views/flashcards.js';
import { render as renderMockExam } from './views/mockExam.js';
import { render as renderProgress } from './views/progress.js';

const VIEWS = {
  home: renderHome,
  study: renderStudyGuide,
  services: renderServices,
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
    const isActive = a.dataset.view === view;
    a.classList.toggle('active', isActive);
    if (isActive) {
      a.setAttribute('aria-current', 'page');
    } else {
      a.removeAttribute('aria-current');
    }
  });
}

// `focusMount` is true only for navigation-driven renders (hashchange, or a
// same-hash nav click re-dispatched as a synthetic hashchange below) so that
// the initial page load never steals focus from wherever the browser put it.
function renderRoute(focusMount) {
  const { view, params } = parseHash();
  const mount = document.getElementById('app-content');
  const renderFn = VIEWS[view] || renderHome;
  if (!VIEWS[view]) {
    // Unknown/typo'd hash: Home is rendered, so rewrite the address bar to
    // match instead of leaving a bogus hash to be bookmarked or shared.
    // replaceState changes the URL without firing a second hashchange and
    // without adding a history entry.
    history.replaceState(null, '', '#/');
  }
  mount.innerHTML = '';
  renderFn(mount, ...params);
  highlightNav(VIEWS[view] ? view : 'home');
  if (focusMount) {
    mount.setAttribute('tabindex', '-1');
    mount.focus({ preventScroll: true });
  }
}

// Clicking a nav link whose hash already matches the current URL doesn't
// change location.hash, so the browser never fires `hashchange` and the
// click is a no-op (e.g. mid-exam, "Mock Exam" is already `#/exam`). Dispatch
// a synthetic hashchange in that case so both this router's listener and any
// view's own `{ once: true }` hashchange teardown (e.g. mockExam's timer
// cleanup) run exactly as they would for a real navigation. Links to a
// different hash are left alone — the browser's default navigation already
// updates location.hash and fires a real hashchange.
document.getElementById('nav').addEventListener('click', (e) => {
  const a = e.target.closest('a');
  if (!a) return;
  const targetHash = new URL(a.href).hash;
  if (targetHash === window.location.hash) {
    window.dispatchEvent(new HashChangeEvent('hashchange'));
  }
});

window.addEventListener('hashchange', () => renderRoute(true));
window.addEventListener('DOMContentLoaded', () => renderRoute(false));
