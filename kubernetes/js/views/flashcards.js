import { FLASHCARDS } from '../data/flashcards.js';
import { createStore } from '../lib/storage.js';
import { shuffle } from '../lib/scoring.js';

const store = createStore();

export function render(mount) {
  const shuffledCards = shuffle(FLASHCARDS);
  const state = { index: 0, showBack: false, filterUnknown: false };

  function visibleCards() {
    if (!state.filterUnknown) return shuffledCards;
    const known = store.getFlashcardState();
    return shuffledCards.filter((c) => !known[c.id]);
  }

  function renderCard(focusFlip) {
    const cards = visibleCards();
    if (cards.length === 0) {
      mount.innerHTML = `<p>All caught up! <button id="fc-reset">Show all cards</button></p>`;
      document.getElementById('fc-reset').addEventListener('click', () => {
        state.filterUnknown = false;
        state.index = 0;
        renderCard();
      });
      if (focusFlip) document.getElementById('fc-reset').focus();
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
        <p class="flashcard-service">${card.service}</p>
        <p class="flashcard-text">${state.showBack ? card.back : card.front}</p>
      </div>
      <div class="flashcard-controls">
        <button type="button" id="fc-flip">Flip</button>
        <button type="button" id="fc-prev">Previous</button>
        <button type="button" id="fc-next">Next</button>
        <button type="button" id="fc-known" class="secondary">${known[card.id] ? 'Marked Known ✓' : 'Mark Known'}</button>
      </div>
    `;
    document.getElementById('fc-filter').addEventListener('change', (e) => {
      state.filterUnknown = e.target.checked;
      state.index = 0;
      renderCard();
    });
    document.getElementById('fc-flip').addEventListener('click', () => {
      state.showBack = !state.showBack;
      renderCard(true);
    });
    document.getElementById('fc-prev').addEventListener('click', () => {
      state.index = (state.index - 1 + cards.length) % cards.length;
      state.showBack = false;
      renderCard(true);
    });
    document.getElementById('fc-next').addEventListener('click', () => {
      state.index = (state.index + 1) % cards.length;
      state.showBack = false;
      renderCard(true);
    });
    document.getElementById('fc-known').addEventListener('click', () => {
      store.setFlashcardKnown(card.id, !known[card.id]);
      renderCard(true);
    });
    if (focusFlip) document.getElementById('fc-flip').focus();
  }

  renderCard();
}
