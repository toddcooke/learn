import { DOMAINS } from '../data/examInfo.js';
import { STUDY_CONTENT } from '../data/studyContent.js';

export function render(mount, domainId) {
  if (!domainId) {
    renderDomainList(mount);
    return;
  }
  renderDomain(mount, domainId);
}

function renderDomainList(mount) {
  mount.innerHTML = `
    <h2>Study Guide</h2>
    <p>Pick a domain to review its task statements and key concepts.</p>
    <ul class="domain-list">
      ${DOMAINS.map((d) => `<li><a href="#/study/${d.id}">${d.name}</a> — ${d.weight}%</li>`).join('')}
    </ul>
  `;
}

function renderDomain(mount, domainId) {
  const domain = DOMAINS.find((d) => d.id === domainId);
  if (!domain) {
    mount.innerHTML = `<p>Unknown domain "${domainId}". <a href="#/study">Back to Study Guide</a></p>`;
    return;
  }
  const sections = STUDY_CONTENT.filter((s) => s.domain === domainId);
  mount.innerHTML = `
    <p><a href="#/study">&larr; All domains</a></p>
    <h2>${domain.name} (${domain.weight}%)</h2>
    ${sections.map(renderSection).join('')}
    <p><a href="#/quiz/${domainId}">Take a quiz on this domain &rarr;</a></p>
  `;
}

function renderSection(section) {
  return `
    <section class="study-section">
      <h3>${section.taskStatement}</h3>
      ${section.topics.map((t) => `
        <article class="study-topic">
          <h4>${t.title}</h4>
          <p>${t.body}</p>
        </article>
      `).join('')}
    </section>
  `;
}
