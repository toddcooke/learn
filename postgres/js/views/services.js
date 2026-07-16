// js/views/services.js
// Placeholder: this module has no services reference catalog yet. The route
// exists because js/app.js is shared byte-identically across modules (see
// scripts/check-drift.mjs); only modules with a js/data/services.js catalog
// link to this view from their nav.
export function render(mount) {
  mount.innerHTML = `
    <section class="services">
      <h2>Reference</h2>
      <p>This module doesn't have a reference catalog yet. Try the
        <a href="#/study">Study Guide</a> or <a href="#/flashcards">Flashcards</a>.</p>
    </section>
  `;
}
