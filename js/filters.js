/**
 * The filter sidebar.
 *
 * Counts beside each option are computed with that facet's own filter removed
 * (see facetCounts in data.js), so selecting "Lithium" does not make every other
 * material read zero — the counts stay useful for deciding what to add.
 */

import { STAGES, STAGE_LABELS, STAGE_DESCRIPTIONS, stageIcon } from './icons.js';
import { STATUS_VALUES, MATURITY_VALUES, CRMA_VALUES } from './data.js';
import { esc, checkRow } from './ui.js';

/** Plain-language labels for the maturity values. */
export const MATURITY_LABELS = {
  incumbent: 'Established (incumbent)',
  'scale-up': 'Scale-up',
  startup: 'Start-up or spin-off',
};

const CRMA_LABELS = {
  strategic: 'EU Strategic Project',
  'not-listed': 'Not on the list',
};

const OPEN = new Map([
  ['elements', true],
  ['stages', true],
  ['maturities', true],
  ['crma', true],
  ['countries', false],
  ['statuses', false],
]);

function group({ facet, title, selectedCount, total, body, scroll }) {
  const all = selectedCount === total;
  const none = selectedCount === 0;
  return `<section class="fgroup" data-facet="${facet}" data-open="${OPEN.get(facet) !== false}">
    <button class="fgroup__head" data-act="toggle-group" data-id="${facet}">
      <svg class="fgroup__chev" viewBox="0 0 16 16" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
      <span class="fgroup__title">${esc(title)}</span>
      <span class="fgroup__count">${all ? 'all' : `${selectedCount} of ${total}`}</span>
    </button>
    <div class="fgroup__body">
      <div class="fgroup__actions">
        <button class="btn btn--sm" data-act="select-all" data-id="${facet}" ${all ? 'disabled' : ''}>Select all</button>
        <button class="btn btn--sm" data-act="deselect-all" data-id="${facet}" ${none ? 'disabled' : ''}>Deselect all</button>
      </div>
      <div class="fgroup__list${scroll ? ' fgroup__list--scroll' : ''}">${body}</div>
    </div>
  </section>`;
}

/**
 * Capture where each scrollable list is scrolled to, so re-rendering the sidebar
 * does not throw the reader back to the top. Ticking "Sweden" near the bottom of
 * the country list otherwise scrolls away from what you just clicked.
 */
function captureScroll(container) {
  const positions = new Map();
  for (const el of container.querySelectorAll('[data-facet] .fgroup__list')) {
    positions.set(el.closest('[data-facet]').dataset.facet, el.scrollTop);
  }
  const outer = container.closest('.panel-scroll');
  return { positions, outer: outer ? outer.scrollTop : 0 };
}

function restoreScroll(container, saved) {
  for (const el of container.querySelectorAll('[data-facet] .fgroup__list')) {
    const top = saved.positions.get(el.closest('[data-facet]').dataset.facet);
    if (top) el.scrollTop = top;
  }
  const outer = container.closest('.panel-scroll');
  if (outer && saved.outer) outer.scrollTop = saved.outer;
}

export function renderFilters(container, model, state, counts) {
  const saved = captureScroll(container);
  const materials = [...model.elements].sort((a, b) => a.name.localeCompare(b.name));
  const strategic = materials.filter((e) => e.strategic);
  const other = materials.filter((e) => !e.strategic);

  const materialRow = (e) =>
    checkRow({
      id: e.id,
      label: e.name,
      checked: state.elements.has(e.id),
      count: counts.elements.get(e.id) || 0,
      star: e.strategic,
    });

  const countries = [...new Set(model.facilities.map((f) => f.country))].sort();

  container.innerHTML = `
    ${group({
      facet: 'elements',
      title: 'Material',
      selectedCount: state.elements.size,
      total: materials.length,
      scroll: true,
      body: `
        <div class="fgroup__sub">Strategic raw materials</div>
        ${strategic.map(materialRow).join('')}
        <div class="fgroup__sub">Other critical raw materials</div>
        ${other.map(materialRow).join('')}`,
    })}

    ${group({
      facet: 'stages',
      title: 'Stage of the chain',
      selectedCount: state.stages.size,
      total: STAGES.length,
      body: STAGES.map((s) =>
        `<label class="check" data-empty="${(counts.stages.get(s) || 0) === 0}"
                title="${esc(STAGE_DESCRIPTIONS[s])}" style="--stage-c: var(--stage-${s})">
          <input type="checkbox" value="${s}" ${state.stages.has(s) ? 'checked' : ''}>
          <span class="check__box">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6"
                 stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 5"/></svg>
          </span>
          <span class="check__stage">${stageIcon(s, { size: 13 })}</span>
          <span class="check__label">${esc(STAGE_LABELS[s])}</span>
          <span class="check__n">${counts.stages.get(s) || 0}</span>
        </label>`
      ).join(''),
    })}

    ${group({
      facet: 'crma',
      title: 'EU Strategic Projects',
      selectedCount: state.crma.size,
      total: CRMA_VALUES.length,
      body: CRMA_VALUES.map((v) =>
        checkRow({
          id: v,
          label: CRMA_LABELS[v],
          checked: state.crma.has(v),
          count: counts.crma.get(v) || 0,
          star: v === 'strategic',
        })
      ).join(''),
    })}

    ${group({
      facet: 'maturities',
      title: 'Company type',
      selectedCount: state.maturities.size,
      total: MATURITY_VALUES.length,
      body: MATURITY_VALUES.map((m) =>
        checkRow({
          id: m,
          label: MATURITY_LABELS[m],
          checked: state.maturities.has(m),
          count: counts.maturities.get(m) || 0,
        })
      ).join(''),
    })}

    ${group({
      facet: 'countries',
      title: 'Country',
      selectedCount: state.countries.size,
      total: countries.length,
      scroll: true,
      body: countries
        .map((c) =>
          checkRow({
            id: c,
            label: c,
            checked: state.countries.has(c),
            count: counts.countries.get(c) || 0,
          })
        )
        .join(''),
    })}

    ${group({
      facet: 'statuses',
      title: 'Status',
      selectedCount: state.statuses.size,
      total: STATUS_VALUES.length,
      body: STATUS_VALUES.map((s) =>
        checkRow({
          id: s,
          label: s.replace(/-/g, ' ').replace(/^./, (m) => m.toUpperCase()),
          checked: state.statuses.has(s),
          count: counts.statuses.get(s) || 0,
        })
      ).join(''),
    })}
  `;

  restoreScroll(container, saved);
}

export function toggleGroup(facet) {
  OPEN.set(facet, OPEN.get(facet) === false);
}
