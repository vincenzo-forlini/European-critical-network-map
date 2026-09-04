/**
 * Filter state.
 *
 * Deliberately not mirrored into the URL: the address bar stays clean. The
 * trade is that a filtered view cannot be shared or bookmarked, and a reload
 * returns to the default view with everything selected.
 */

const listeners = new Set();

/**
 * Every possible value of each facet, set once at boot. Starting state is
 * "everything selected", so these are also the defaults.
 */
const totals = {
  elements: [], stages: [], countries: [], statuses: [], maturities: [], crma: [],
};

export function setTotals(next) {
  Object.assign(totals, next);
  for (const facet of Object.keys(totals)) state[facet] = new Set(totals[facet]);
}

export function totalFor(facet) {
  return totals[facet] || [];
}

export const state = {
  elements: new Set(),
  stages: new Set(),
  countries: new Set(),
  statuses: new Set(),
  maturities: new Set(),
  crma: new Set(),
  query: '',
  // 'facilities' | 'companies'
  resultsTab: 'facilities',
  // { kind: 'city'|'company'|'element', id } or null
  detail: null,
  selectedKey: null,
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
export function emit() {
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
  emit();
}

export function setSelectedKey(key) {
  state.selectedKey = key;
  emit();
}

export function setResultsTab(tab) {
  state.resultsTab = tab;
  emit();
}

/** True when the view has been narrowed from the default "everything" state. */
export function hasAnyFilter() {
  return (
    !isFacetFull('elements') ||
    !isFacetFull('stages') ||
    !isFacetFull('countries') ||
    !isFacetFull('statuses') ||
    !isFacetFull('maturities') ||
    !isFacetFull('crma') ||
    state.query !== ''
  );
}
