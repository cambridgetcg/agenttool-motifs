import { observe, phraseObservation, projectDoor, findForks, chooseStudy } from './engine.mjs';
import { STUDIES } from './collection.mjs';

const byId = (id) => document.getElementById(id);
const text = (id, value) => {
  const node = byId(id);
  if (node.textContent !== value) node.textContent = value;
};
const sampleTime = Date.UTC(2026, 0, 1, 12, 0);
let selected = 'observations';
let surface = 'brief';

function selectStudy(id, updateHash = false, announce = false) {
  const study = STUDIES.find((item) => item.id === id) || STUDIES[0];
  selected = study.id;
  for (const item of STUDIES) byId(item.id).hidden = item.id !== selected;
  for (const link of document.querySelectorAll('[data-study]')) {
    if (link.dataset.study === selected) link.setAttribute('aria-current', 'true');
    else link.removeAttribute('aria-current');
  }
  for (const node of document.querySelectorAll('[data-motif]')) {
    node.classList.toggle('is-active', study.motifs.includes(node.dataset.motif));
  }
  for (const line of document.querySelectorAll('[data-between]')) {
    line.classList.toggle(
      'is-active',
      line.dataset.between.split(' ').every((motif) => study.motifs.includes(motif))
    );
  }
  text(
    'score-description',
    `${study.title} connects ${study.motifs.join(', ')}. These lines connect ideas, not identities.`
  );
  if (updateHash) history.replaceState(null, '', `#${selected}`);
  if (announce) text('app-status', `${study.title} selected.`);
}

function renderObservation(announce = false) {
  const result = byId('observation-result').value;
  const minutes = Math.max(0, Math.min(90, Number(byId('observation-age').value) || 0));
  const now = sampleTime + minutes * 60_000;
  const card = observe(
    result === 'missing' ? null : { result, observedAt: sampleTime },
    now,
    5 * 60_000
  );
  const missing = card.condition === 'unknown';
  byId('observation-age').disabled = missing;
  byId('observation-age').setAttribute(
    'aria-valuetext',
    missing ? 'No observation; age unavailable' : `${minutes} minutes`
  );
  text('age-value', missing ? '—' : `${minutes} min`);
  text(
    'observation-freshness',
    { fresh: 'fresh.', last_known: 'last known.', unavailable: 'unavailable.' }[card.freshness]
  );
  text(
    'observation-meaning',
    missing
      ? 'No record is supplied. No timestamp is invented.'
      : `Illustrative clock: observed at 12:00 UTC · read at ${new Date(now).toISOString().slice(11, 16)} UTC.`
  );
  document.querySelector('.observation-reading').dataset.freshness = card.freshness;
  text('observation-output', phraseObservation(card, surface));
  byId('observation-output').dataset.surface = surface;
  for (const button of document.querySelectorAll('[data-surface]')) {
    button.setAttribute('aria-pressed', String(button.dataset.surface === surface));
  }
  if (announce)
    text(
      'app-status',
      `${{ brief: 'Brief', full: 'Full', data: 'Data' }[surface]} view. ${phraseObservation(card, 'brief')}${missing ? '' : ` · ${minutes} minutes old`}.`
    );
}

const boundarySamples = {
  unstated: null,
  partial: {
    relationship: 'Independent public service',
    interpretation: 'Discovery alone grants no access.',
  },
  stated: {
    relationship: 'Independent public service',
    dataFlow: 'Displaying this illustrative door sends nothing to that service.',
    interpretation: 'Discovery is not permission. Opening a link is a separate choice.',
  },
};

function renderDoor(announce = false) {
  const record = projectDoor(boundarySamples[byId('door-record').value] ?? null);
  text(
    'door-state',
    { unstated: 'unstated.', partial: 'partly stated.', stated: 'stated.' }[record.kind]
  );
  text(
    'door-meaning',
    {
      unstated: 'Nothing recorded is not the same as nothing to question.',
      partial: 'The recorded words stay. The gaps stay visible too.',
      stated: 'These are publisher statements, not independent verification.',
    }[record.kind]
  );
  for (const [id, field] of [
    ['door-relationship', 'relationship'],
    ['door-data-flow', 'dataFlow'],
    ['door-interpretation', 'interpretation'],
  ]) {
    text(id, record[field] ?? 'Unstated');
    byId(id).classList.toggle('is-unstated', record[field] === null);
  }
  if (announce)
    text(
      'app-status',
      `Boundary ${byId('door-state').textContent} ${byId('door-meaning').textContent}`
    );
}

function renderFork(announce = false) {
  const requested = Number(byId('branch-count').value);
  const count = [1, 2, 3].includes(requested) ? requested : 2;
  const shared = byId('shared-author').checked;
  const leaves = Array.from({ length: count }, (_, index) => ({
    id: `branch-${index + 1}`,
    parent: 'parent-record',
    project: 'illustrative-project',
    author: shared ? 'author-a' : `author-${index + 1}`,
  }));
  const forks = findForks(leaves);
  const positions = count === 1 ? [100] : count === 2 ? [60, 140] : [42, 100, 158];
  for (const group of document.querySelectorAll('[data-leaf]')) {
    const index = Number(group.dataset.leaf);
    group.toggleAttribute('hidden', index >= count);
    if (index < count) {
      group.querySelector('circle').setAttribute('cy', positions[index]);
      group.querySelector('text').setAttribute('y', positions[index] + 5);
    }
  }
  for (const path of document.querySelectorAll('[data-branch]')) {
    const index = Number(path.dataset.branch);
    path.toggleAttribute('hidden', index >= count);
    if (index < count)
      path.setAttribute('d', `M100 100C220 100 245 ${positions[index]} 390 ${positions[index]}`);
  }
  text(
    'fork-statement',
    !shared && count > 1
      ? 'Different authors.'
      : count === 1
        ? 'One continuation.'
        : count === 2
          ? 'Two continuations.'
          : 'Three continuations.'
  );
  text(
    'fork-meaning',
    forks.length
      ? 'A fork is observed. No branch is chosen or discarded.'
      : count === 1
        ? 'No fork is asserted from one continuation.'
        : 'These records stay in distinct authorship scopes; they are not merged.'
  );
  text(
    'fork-scope',
    shared
      ? 'One illustrative project · one author label'
      : 'One illustrative project · distinct author labels'
  );
  text(
    'branch-description',
    `${count} illustrative continuation${count === 1 ? '' : 's'} of a shared beginning. ${shared ? 'A shared author label.' : 'Distinct author labels.'} No winner is chosen.`
  );
  text('fork-data', JSON.stringify(forks, null, 2));
  if (announce)
    text(
      'app-status',
      `${!shared && count > 1 ? `${count} continuations. ` : ''}${byId('fork-statement').textContent} ${byId('fork-meaning').textContent}`
    );
}

function initialize() {
  for (const fieldset of document.querySelectorAll('fieldset.controls')) fieldset.disabled = false;
  for (const button of document.querySelectorAll('[data-surface], #begin-anywhere'))
    button.disabled = false;
  byId('observation-result').addEventListener('change', () => renderObservation(true));
  byId('observation-age').addEventListener('input', () => renderObservation());
  byId('observation-age').addEventListener('change', () => renderObservation(true));
  byId('door-record').addEventListener('change', () => renderDoor(true));
  byId('branch-count').addEventListener('change', () => renderFork(true));
  byId('shared-author').addEventListener('change', () => renderFork(true));
  for (const button of document.querySelectorAll('[data-surface]')) {
    button.addEventListener('click', () => {
      surface = button.dataset.surface;
      renderObservation(true);
    });
  }
  for (const link of document.querySelectorAll('[data-study]')) {
    link.addEventListener('click', (event) => {
      event.preventDefault();
      selectStudy(link.dataset.study, true, true);
    });
  }
  byId('begin-anywhere').addEventListener('click', () => {
    try {
      const choice = chooseStudy(
        STUDIES.map((item) => item.id),
        selected
      );
      selectStudy(choice, true, true);
      byId(`${choice}-title`).focus({ preventScroll: true });
      const top = byId('studies').getBoundingClientRect().top + window.scrollY - 24;
      window.scrollTo({
        top: Math.max(0, top),
        behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      });
    } catch {
      text('app-status', 'Random choice is unavailable. Please choose a study from the index.');
    }
  });
  window.addEventListener('hashchange', () => {
    const id = location.hash.slice(1);
    if (STUDIES.some((study) => study.id === id)) selectStudy(id, false, true);
  });
  renderObservation();
  renderDoor();
  renderFork();
  selectStudy(location.hash.slice(1));
  document.documentElement.classList.add('is-interactive');
}

try {
  initialize();
} catch (error) {
  document.documentElement.classList.remove('is-interactive');
  for (const panel of document.querySelectorAll('.study-panel')) panel.hidden = false;
  for (const fieldset of document.querySelectorAll('fieldset.controls')) fieldset.disabled = true;
  for (const button of document.querySelectorAll('[data-surface], #begin-anywhere'))
    button.disabled = true;
  document.querySelector('.script-note').textContent =
    'Interactive controls could not be loaded. All studies remain readable below.';
  console.error('Gallery initialization failed.', error);
}
