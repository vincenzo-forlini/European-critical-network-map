/**
 * The filter sidebar.
 *
 * Counts beside each option are computed with that facet's own filter removed
 * (see facetCounts in data.js), so selecting "Lithium" does not make every other
 * material read zero — the counts stay useful for deciding what to add.
 */

import { STAGES, STAGE_LABELS, STAGE_DESCRIPTIONS, stageIcon } from './icons.js';
import { STATUS_VALUES } from './data.js';
import { esc, checkRow } from './ui.js';

const OPEN = new Map([
  ['elements', true],
  ['stages', true],
  ['countries', false],
  ['statuses', false],
]);

function group({ facet, title, selectedCount, body, scroll }) {
  return `<section class="fgroup" data-facet="${facet}" data-open="${OPEN.get(facet) !== false}">
    <button class="fgroup__head" data-act="toggle-group" data-id="${facet}">
      <svg class="fgroup__chev" viewBox="0 0 16 16" fill="none" stroke="currentColor"
           stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M4 6l4 4 4-4"/></svg>
      <span class="fgroup__title">${esc(title)}</span>
      <span class="fgroup__count">${selectedCount ? `${selectedCount} selected` : ''}</span>
    </button>
    <div class="fgroup__body${scroll ? ' fgroup__body--scroll' : ''}">${body}</div>
  </section>`;
}

export function renderFilters(container, model, state, counts) {
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
      facet: 'countries',
      title: 'Country',
      selectedCount: state.countries.size,
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
}

export function toggleGroup(facet) {
  OPEN.set(facet, OPEN.get(facet) === false);
}
