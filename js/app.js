/**
 * Boot and wiring.
 *
 * Load order: CSVs -> model -> map -> render loop. The map opens showing the
 * whole dataset. Every UI click is delegated from a small number of listeners
 * using data-act attributes, so nothing has to hold references to everything
 * else.
 */

import {
  buildModel, filterFacilities, facetCounts, groupForMap, countriesByFacilityCount,
  STATUS_VALUES, MATURITY_VALUES, CRMA_VALUES,
} from './data.js';
import {
  initMap, renderBasemap, renderCities, renderMarkers, renderLegend, tintCountries, setSelected,
  flyToCity, resetView, invalidate, openPopupAt, closePopup,
} from './map.js';
import { STAGES } from './icons.js';
import { renderFilters, toggleGroup } from './filters.js';
import { renderResults } from './results.js';
import { cityPanel, companyPanel, elementPanel } from './panels.js';
import * as S from './state.js';
import {
  esc, stageChip, statusChip, elementChips, confidenceBadge, sourceLink, crmaChip,
} from './ui.js';

const $ = (id) => document.getElementById(id);

let model = null;
let news = null;
let productionStage = null; // which stage tab the element chart is showing

/* ------------------------------------------------------------------ loading */

async function text(url) {
  const res = await fetch(url, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`${url} — HTTP ${res.status}`);
  return res.text();
}

async function optionalJson(url) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null; // news is a nice-to-have, never a reason to fail the page
  }
}

async function boot() {
  let sources, geo;
  try {
    [sources, geo, news] = await Promise.all([
      Promise.all([
        text('data/elements.csv'),
        text('data/cities.csv'),
        text('data/companies.csv'),
        text('data/facilities.csv'),
        text('data/production.csv'),
      ]),
      fetch('data/geo/europe.geo.json').then((r) => r.json()),
      optionalJson('data/news.json'),
    ]);
  } catch (err) {
    fatal(err);
    return;
  }

  const [elementsCsv, citiesCsv, companiesCsv, facilitiesCsv, productionCsv] = sources;
  model = buildModel({ elementsCsv, citiesCsv, companiesCsv, facilitiesCsv, productionCsv });

  showIssues(model.issues);

  // Everything is selected by default: the map opens showing the whole dataset,
  // and the reader narrows from there rather than choosing before seeing anything.
  S.setTotals({
    elements: model.elements.map((e) => e.id),
    stages: [...STAGES],
    countries: [...new Set(model.facilities.map((f) => f.country))].sort(),
    statuses: [...STATUS_VALUES],
    maturities: [...MATURITY_VALUES],
    crma: [...CRMA_VALUES],
  });

  initMap({ onCountry: (name) => { S.toggle('countries', name); } });
  renderBasemap(geo);
  renderCities(model.cities);
  renderLegend($('legend'), STAGES);

  wireChrome();
  S.subscribe(render);

  $('loading').hidden = true;

  applyResponsiveSidebar();
  render(S.state);
}

/**
 * Below the breakpoint the sidebar is an overlay sheet, so leaving it open would
 * bury the map. This runs on every breakpoint crossing, not just at boot —
 * applying it once left a desktop window stuck with a zero-width sidebar.
 */
function applyResponsiveSidebar() {
  const narrow = window.matchMedia('(max-width: 900px)');
  const apply = () => setSidebarOpen(!narrow.matches);
  apply();
  narrow.addEventListener('change', apply);
}

function setSidebarOpen(open) {
  const main = $('main');
  main.classList.toggle('sidebar-collapsed', !open);
  const btn = $('toggle-sidebar');
  btn.setAttribute('aria-expanded', String(open));
  btn.setAttribute('aria-label', open ? 'Hide the filter panel' : 'Show the filter panel');
}

/* ------------------------------------------------------------------ render */

function currentFacilities() {
  return filterFacilities(model, S.state);
}

function currentGroups() {
  return groupForMap(currentFacilities());
}

function render(state = S.state) {
  const facilities = currentFacilities();
  const groups = groupForMap(facilities);

  renderMarkers(groups, { onSelect: onMarkerSelect });
  setSelected(state.selectedKey);
  tintCountries(countriesByFacilityCount(facilities), { enabled: state.elements.size === 1 });
  renderLegend($('legend'), [...state.stages]);

  const counts = facetCounts(model, state);
  renderFilters($('panel-filters'), model, state, counts);
  renderResults($('panel-results'), model, state, facilities);

  $('result-count').textContent = facilities.length;
  $('map-note').textContent = `${facilities.length} of ${model.stats.facilities} sites`;

  const searchInput = $('search');
  if (searchInput.value !== state.query) searchInput.value = state.query;
  $('search-clear').hidden = !state.query;

  $('tab-filters').setAttribute('aria-selected', String(currentTab === 'filters'));
  $('tab-results').setAttribute('aria-selected', String(currentTab === 'results'));
  $('panel-filters').hidden = currentTab !== 'filters';
  $('panel-results').hidden = currentTab !== 'results';

  renderDetail(state);
}

function renderDetail(state = S.state) {
  const main = $('main');
  const body = $('detail-body');

  if (!state.detail) {
    main.classList.remove('detail-open');
    body.innerHTML = '';
    invalidate();
    return;
  }

  const { kind, id, stage } = state.detail;
  const kinds = { city: 'Location', company: 'Company', element: 'Material' };
  $('detail-kind').textContent = kinds[kind] || 'Details';

  if (kind === 'city') {
    const visibleIds = new Set(currentFacilities().map((f) => f.id));
    body.innerHTML = cityPanel(model, id, stage, visibleIds);
  }
  else if (kind === 'company') body.innerHTML = companyPanel(model, id, news);
  else if (kind === 'element') body.innerHTML = elementPanel(model, id, { productionStage });

  main.classList.add('detail-open');
  body.scrollTop = 0;
  invalidate();
}

/* -------------------------------------------------------------- map events */

function onMarkerSelect(group) {
  S.setSelectedKey(group.key);
  openPopupAt(group.key, popupHtml(group));
  S.setDetail({ kind: 'city', id: group.city.key, stage: group.stage });
}

/** Answers "where is it" and "who runs it" first, everything else after. */
function popupHtml(group) {
  const first = group.facilities[0];
  const more = group.facilities.length - 1;

  return `<div class="pop">
    <div class="pop__where">${esc(first.city.name)}, ${esc(first.country)}</div>
    <div class="pop__site">${esc(first.name)}</div>
    <span class="pop__co link" data-act="open-company" data-id="${esc(first.companyKey)}">${esc(
      first.company.name
    )}</span>
    <div class="pop__meta">
      ${crmaChip(first)}
      ${stageChip(first.stage)}
      ${statusChip(first.status)}
    </div>
    <div class="pop__meta">${elementChips(first.elements, model.elementById, { max: 4 })}</div>
    ${more > 0
      ? `<div class="pop__more">and ${more} more ${
          more === 1 ? 'site' : 'sites'
        } at this stage here</div>`
      : ''}
    <div class="pop__foot">
      ${confidenceBadge(first.confidence, first.last_checked)}
      ${sourceLink(first.source_url)}
    </div>
  </div>`;
}

/* --------------------------------------------------------------- chrome UI */

let currentTab = 'filters';

function wireChrome() {
  $('tab-filters').addEventListener('click', () => { currentTab = 'filters'; render(S.state); });
  $('tab-results').addEventListener('click', () => { currentTab = 'results'; render(S.state); });

  let debounce;
  $('search').addEventListener('input', (e) => {
    clearTimeout(debounce);
    const v = e.target.value;
    debounce = setTimeout(() => S.setQuery(v), 160);
  });
  $('search-clear').addEventListener('click', () => {
    S.setQuery('');
    $('search').focus();
  });

  $('detail-close').addEventListener('click', () => {
    S.setDetail(null);
    S.setSelectedKey(null);
    closePopup();
  });

  $('reset-view').addEventListener('click', resetView);
  $('toggle-sidebar').addEventListener('click', () => {
    setSidebarOpen($('main').classList.contains('sidebar-collapsed'));
  });
  $('errors-close').addEventListener('click', () => { $('errors').hidden = true; });

  // Filter checkboxes.
  $('panel-filters').addEventListener('change', (e) => {
    const input = e.target.closest('input[type=checkbox]');
    if (!input) return;
    const facet = input.closest('.fgroup')?.dataset.facet;
    if (facet) S.toggle(facet, input.value);
  });

  // Everything else is delegated on data-act.
  document.body.addEventListener('click', onDelegatedClick);
}

function onDelegatedClick(e) {
  const el = e.target.closest('[data-act]');
  if (!el) return;
  const { act, id } = el.dataset;

  switch (act) {
    case 'toggle-group':
      toggleGroup(id);
      render(S.state);
      break;

    case 'results-tab':
      S.setResultsTab(id);
      break;

    case 'focus-facility': {
      const f = model.facilityById.get(id);
      if (!f) break;
      const key = `${f.cityKey}::${f.stage}`;
      S.setSelectedKey(key);
      flyToCity(f.city);
      S.setDetail({ kind: 'city', id: f.cityKey, stage: f.stage });
      break;
    }

    case 'open-company':
      e.stopPropagation();
      S.setDetail({ kind: 'company', id });
      break;

    case 'open-element':
      productionStage = null;
      S.setDetail({ kind: 'element', id });
      break;

    case 'prod-stage':
      productionStage = id;
      renderDetail(S.state);
      break;

    case 'filter-element':
      S.setMany('elements', [id]);
      currentTab = 'results';
      break;

    case 'select-all':
      S.selectAll(id);
      break;

    case 'deselect-all':
      S.deselectAll(id);
      break;

    default:
      break;
  }
}

/* -------------------------------------------------------------- data errors */

function showIssues(issues) {
  const errors = issues.filter((i) => i.severity === 'error');
  const warnings = issues.filter((i) => i.severity === 'warning');
  if (errors.length === 0 && warnings.length === 0) return;

  // Errors are loud; warnings alone stay quiet unless something was dropped.
  if (errors.length === 0 && warnings.length > 0) {
    console.warn(`${warnings.length} data warning(s):`, warnings);
    return;
  }

  $('errors-title').textContent =
    `${errors.length} problem${errors.length === 1 ? '' : 's'} in the CSV data`;
  $('errors-body').innerHTML = errors
    .slice(0, 40)
    .map(
      (i) => `<div class="errors__item">
        <span class="errors__where">${esc(i.file)}${i.line ? `:${i.line}` : ''}</span>
        ${esc(i.message)}
        ${i.hint ? `<div class="faint">${esc(i.hint)}</div>` : ''}
      </div>`
    )
    .join('') + (errors.length > 40 ? `<div class="errors__item faint">…and ${errors.length - 40} more</div>` : '');
  $('errors').hidden = false;
}

function fatal(err) {
  $('loading').innerHTML = `
    <div style="max-width:46ch;text-align:center;line-height:1.6">
      <p style="color:#ff6b6b;font-weight:600">The dataset could not be loaded.</p>
      <p style="color:#a2a3b2">${esc(err.message)}</p>
      <p style="color:#71727f;font-size:12px">
        If you opened <code>index.html</code> directly, the browser blocks reading local
        files. Start the site with <code>start.cmd</code> (Windows) or
        <code>./start.sh</code> instead.
      </p>
    </div>`;
}

boot();
