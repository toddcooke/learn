// js/views/services.js
// "Services at a glance": every service the site covers, one sentence each,
// grouped by the flashcard deck's domain buckets.
import { SERVICES } from '../data/services.js';
import { FLASHCARD_DOMAINS } from '../data/flashcards.js';
import { escapeHtml } from '../lib/html.js';
import { sortByBareName } from '../lib/serviceSort.js';

// Best-Fit Scenarios is a study bucket, not a service category.
const DOMAINS_IN_ORDER = FLASHCARD_DOMAINS.filter((d) => d !== 'Best-Fit Scenarios');

export function render(mount) {
  mount.innerHTML = `
    <section class="services">
      <h2>Services at a Glance</h2>
      <p>Every AWS service this site covers, one sentence each. For depth, see the
        <a href="#/study">Study Guide</a> or drill with <a href="#/flashcards">Flashcards</a>.</p>
      ${DOMAINS_IN_ORDER.map(renderDomainSection).join('')}
    </section>
  `;
}

function renderDomainSection(domain) {
  const services = sortByBareName(SERVICES.filter((s) => s.domain === domain));
  if (services.length === 0) return '';
  return `
    <h3>${escapeHtml(domain)}</h3>
    <dl class="services-list">
      ${services.map((s) => `
        <div class="services-entry">
          <dt>${escapeHtml(s.name)}</dt>
          <dd>${escapeHtml(s.blurb)}</dd>
        </div>
      `).join('')}
    </dl>
  `;
}
