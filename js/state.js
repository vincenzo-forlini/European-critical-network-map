/**
 * Filter state, mirrored into the URL hash.
 *
 * The hash is what makes a filtered view shareable, and it is also what lets a
 * shared link skip the opening gate: if someone arrives with a selection
 * already in the URL, they have effectively answered the gate's question.
 */

const listeners = new Set();

/**
 * Every possible value of each facet, set once at boot.
 *
 * Needed for two things: starting with everything selected, and keeping the URL
 * short. A facet that is fully selected is the default, so it is left out of the
 * hash rather than spelling out all 34 material ids.
 */
const totals = { elements: [], stages: [], countries: [], statuses: [] };

export function setTotals(next) {
  Object.assign(totals, next);
}

export function totalFor(facet) {
  return totals[facet] || [];
}

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

/** Tick every option in a category. */
export function selectAll(facet) {
  state[facet] = new Set(totals[facet]);
  emit();
}

/** Untick every option in a category. The map then shows nothing for it, which
 *  is the literal meaning of the button rather than a hidden "show everything". */
export function deselectAll(facet) {
  state[facet] = new Set();
  emit();
}

export function selectEverything() {
  for (const facet of Object.keys(totals)) state[facet] = new Set(totals[facet]);
  state.query = '';
  emit();
}

export function isFacetFull(facet) {
  return state[facet].size === totals[facet].length;
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

/** True when the view has been narrowed from the default "everything" state. */
export function hasAnyFilter() {
  return (
    !isFacetFull('elements') ||
    !isFacetFull('stages') ||
    !isFacetFull('countries') ||
    !isFacetFull('statuses') ||
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
    // A fully selected facet is the default. Leaving it out keeps the URL short
    // instead of listing all 34 material ids on every page load.
    if (isFacetFull(facet)) continue;
    parts.push(`${key}=${[...state[facet]].map(encodeURIComponent).join(',') || '-'}`);
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

/**
 * Apply the URL hash on top of the default "everything selected" state.
 *
 * A facet absent from the hash means it was not narrowed, so it stays full.
 * `-` means the facet was explicitly emptied.
 */
export function readHash() {
  for (const facet of Object.keys(totals)) state[facet] = new Set(totals[facet]);
  state.query = '';

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
    state[facet] =
      value === '-' ? new Set() : new Set(value.split(',').map(decodeURIComponent).filter(Boolean));
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
