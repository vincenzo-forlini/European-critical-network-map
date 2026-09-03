/**
 * Filter state, mirrored into the URL hash.
 *
 * The hash is what makes a filtered view shareable, and it is also what lets a
 * shared link skip the opening gate: if someone arrives with a selection
 * already in the URL, they have effectively answered the gate's question.
 */

const listeners = new Set();

export const state = {
  elements: new Set(),
  stages: new Set(),
  countries: new Set(),
  statuses: new Set(),
  query: '',
  // 'facilities' | 'companies'
  resultsTab: 'facilities',
  // { kind: 'city'|'company'|'element', id } or null
  detail: null,
  selectedKey: null,
  gateSeen: false,
};

export function subscribe(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

let frame = null;
let timer = null;

/**
 * Coalesce bursts of changes into one render.
 *
 * Scheduled on an animation frame *and* a timer, whichever comes first.
 * requestAnimationFrame alone is not enough: browsers stop firing it for hidden
 * tabs, so a state change made while the page is in the background would sit
 * unrendered instead of being applied.
 */
export function emit({ syncHash = true } = {}) {
  if (syncHash) writeHash();
  if (frame !== null || timer !== null) return;

  const run = () => {
    if (frame !== null) cancelAnimationFrame(frame);
    if (timer !== null) clearTimeout(timer);
    frame = null;
    timer = null;
    for (const fn of listeners) fn(state);
  };

  frame = requestAnimationFrame(run);
  timer = setTimeout(run, 24);
}

/* -------------------------------------------------------------- mutations */

export function toggle(facet, value) {
  const set = state[facet];
  if (set.has(value)) set.delete(value);
  else set.add(value);
  emit();
}

export function setMany(facet, values) {
  state[facet] = new Set(values);
  emit();
}

export function clearFacet(facet) {
  state[facet].clear();
  emit();
}

export function clearAll() {
  state.elements.clear();
  state.stages.clear();
  state.countries.clear();
  state.statuses.clear();
  state.query = '';
  emit();
}

export function setQuery(q) {
  state.query = q;
  emit();
}

export function setDetail(detail) {
  state.detail = detail;
  emit({ syncHash: false });
}

export function setSelectedKey(key) {
  state.selectedKey = key;
  emit({ syncHash: false });
}

export function setResultsTab(tab) {
  state.resultsTab = tab;
  emit({ syncHash: false });
}

export function hasAnyFilter() {
  return (
    state.elements.size > 0 ||
    state.stages.size > 0 ||
    state.countries.size > 0 ||
    state.statuses.size > 0 ||
    state.query !== ''
  );
}

/* ------------------------------------------------------------------- hash */

const FACETS = [
  ['elements', 'm'], // materials
  ['stages', 's'],
  ['countries', 'c'],
  ['statuses', 'st'],
];

let writing = false;

function writeHash() {
  const parts = [];
  for (const [facet, key] of FACETS) {
    if (state[facet].size) parts.push(`${key}=${[...state[facet]].map(encodeURIComponent).join(',')}`);
  }
  if (state.query) parts.push(`q=${encodeURIComponent(state.query)}`);

  const hash = parts.length ? `#${parts.join('&')}` : '';
  if (hash === window.location.hash) return;

  writing = true;
  // replaceState rather than pushState: filtering is not navigation, and every
  // checkbox click would otherwise become a back-button step.
  history.replaceState(null, '', hash || window.location.pathname + window.location.search);
  writing = false;
}

/** @returns {boolean} whether the hash carried a usable selection. */
export function readHash() {
  const raw = window.location.hash.replace(/^#/, '');
  if (!raw) return false;

  let found = false;
  for (const part of raw.split('&')) {
    const eq = part.indexOf('=');
    if (eq === -1) continue;
    const key = part.slice(0, eq);
    const value = part.slice(eq + 1);
    if (!value) continue;

    if (key === 'q') {
      state.query = decodeURIComponent(value);
      found = true;
      continue;
    }
    const facet = FACETS.find(([, k]) => k === key)?.[0];
    if (!facet) continue;
    state[facet] = new Set(value.split(',').map(decodeURIComponent).filter(Boolean));
    found = true;
  }
  return found;
}

export function watchHash(onChange) {
  window.addEventListener('hashchange', () => {
    if (writing) return;
    readHash();
    // Pass the state, like every other subscriber receives it. Calling this
    // bare left the renderer with an undefined argument and threw.
    onChange(state);
  });
}
