import { FLASHCARDS } from '../data/flashcards.js';
import { createStore } from '../lib/storage.js';
import { shuffle } from '../lib/scoring.js';
import { escapeHtml } from '../lib/html.js';

const store = createStore();

export function render(mount) {
  const shuffledCards = shuffle(FLASHCARDS);
  const state = { index: 0, showBack: false, filterUnknown: false };

  function visibleCards() {
    if (!state.filterUnknown) return shuffledCards;
    const known = store.getFlashcardState();
    return shuffledCards.filter((c) => !known[c.id]);
  }

  // `focusId` is the id of the control that triggered this re-render (the
  // whole view is rewritten, so focus must be restored by hand). Focus goes
  // back to that SAME control so keyboard users can e.g. press Enter on
  // "Next" repeatedly; #fc-flip is only a fallback for when the triggering
  // control no longer exists after the rewrite.
  function restoreFocus(focusId) {
    if (!focusId) return;
    const el = document.getElementById(focusId) ?? document.getElementById('fc-flip');
    if (el) el.focus();
  }

  function renderCard(focusId) {
    const cards = visibleCards();
    if (cards.length === 0) {
      mount.innerHTML = `<p>All caught up! <button id="fc-reset">Show all cards</button></p>`;
      document.getElementById('fc-reset').addEventListener('click', () => {
        state.filterUnknown = false;
        state.index = 0;
        state.showBack = false;
        renderCard('fc-filter');
      });
      if (focusId) document.getElementById('fc-reset').focus();
      return;
    }
    if (state.index >= cards.length) state.index = 0;
    const card = cards[state.index];
    const known = store.getFlashcardState();
    mount.innerHTML = `
      <h2>Flashcards</h2>
      <label>
        <input type="checkbox" id="fc-filter" ${state.filterUnknown ? 'checked' : ''} />
        Show only cards I haven't marked known
      </label>
      <p class="quiz-progress">Card ${state.index + 1} of ${cards.length}</p>
      <div class="flashcard" id="flashcard">
        <p class="flashcard-service">${escapeHtml(card.service)}</p>
        <p class="flashcard-text"><span class="visually-hidden">${state.showBack ? 'Back: ' : 'Front: '}</span>${escapeHtml(state.showBack ? card.back : card.front)}</p>
      </div>
      <div id="fc-status" role="status" class="visually-hidden"></div>
      <div class="flashcard-controls">
        <button type="button" id="fc-flip">${state.showBack ? 'Show question' : 'Show answer'}</button>
        <button type="button" id="fc-prev">Previous</button>
        <button type="button" id="fc-next">Next</button>
        <button type="button" id="fc-known" class="secondary">${known[card.id] ? 'Marked Known ✓' : 'Mark Known'}</button>
      </div>
    `;
    document.getElementById('fc-filter').addEventListener('change', (e) => {
      state.filterUnknown = e.target.checked;
      state.index = 0;
      state.showBack = false;
      renderCard('fc-filter');
    });
    document.getElementById('fc-flip').addEventListener('click', () => {
      state.showBack = !state.showBack;
      renderCard('fc-flip');
      // Announce which side is now showing. The flip button's label toggle
      // ("Show answer"/"Show question") covers focused announcements too,
      // but the status region tells AT users the card content changed.
      document.getElementById('fc-status').textContent = state.showBack ? 'Showing back of card' : 'Showing front of card';
    });
    document.getElementById('fc-prev').addEventListener('click', () => {
      state.index = (state.index - 1 + cards.length) % cards.length;
      state.showBack = false;
      renderCard('fc-prev');
    });
    document.getElementById('fc-next').addEventListener('click', () => {
      state.index = (state.index + 1) % cards.length;
      state.showBack = false;
      renderCard('fc-next');
    });
    document.getElementById('fc-known').addEventListener('click', () => {
      store.setFlashcardKnown(card.id, !known[card.id]);
      // With the unknown-only filter on, marking a card known removes it
      // from the visible set, so a different card is about to be shown —
      // never present that new card answer-first.
      if (state.filterUnknown) state.showBack = false;
      renderCard('fc-known');
    });
    restoreFocus(focusId);
  }

  renderCard();
}
