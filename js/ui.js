/** Small shared render helpers. Everything here returns HTML strings. */

import { stageIcon, STAGE_LABELS } from './icons.js';

export function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

export function stageChip(stage) {
  return `<span class="chip chip--stage" style="--stage-c: var(--stage-${stage})">
    ${stageIcon(stage, { size: 12 })}${esc(STAGE_LABELS[stage] || stage)}
  </span>`;
}

export function elementChips(ids, elementById, { max = 0 } = {}) {
  const names = ids.map((id) => elementById.get(id)?.name || id);
  const shown = max > 0 ? names.slice(0, max) : names;
  const rest = names.length - shown.length;
  return (
    shown.map((n) => `<span class="chip">${esc(n)}</span>`).join('') +
    (rest > 0 ? `<span class="chip faint">+${rest}</span>` : '')
  );
}

export function statusChip(status) {
  const label = String(status).replace(/-/g, ' ');
  return `<span class="chip status-chip" data-status="${esc(status)}">${esc(label)}</span>`;
}

/**
 * Confidence is rendered, never hidden. A reader has to be able to see which
 * rows are shaky without opening the CSV.
 */
export function confidenceBadge(confidence, lastChecked) {
  const label = {
    high: 'High confidence',
    medium: 'Medium confidence',
    low: 'Low confidence',
  }[confidence] || confidence;
  const checked = lastChecked ? `checked ${esc(lastChecked)}` : 'not yet source-verified';
  return `<span class="conf conf--${esc(confidence)}" title="${esc(label)} — ${checked}">${esc(label)}</span>`;
}

export function sourceLink(url, label = 'Source') {
  if (!url) return '<span class="faint">no source recorded</span>';
  return `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)} &nearr;</a>`;
}

export function empty(title, detail) {
  return `<div class="empty"><strong>${esc(title)}</strong>${esc(detail || '')}</div>`;
}

export function plural(n, one, many) {
  return `${n} ${n === 1 ? one : many || one + 's'}`;
}

/** Checkbox row used across the filter sidebar and the opening gate. */
export function checkRow({ id, label, checked, count, swatch, star, disabled }) {
  return `<label class="check" data-empty="${count === 0}">
    <input type="checkbox" value="${esc(id)}" ${checked ? 'checked' : ''} ${disabled ? 'disabled' : ''}>
    <span class="check__box">
      <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2.6"
           stroke-linecap="round" stroke-linejoin="round"><path d="M3 8.5l3.2 3.2L13 5"/></svg>
    </span>
    ${swatch ? `<span class="check__swatch" style="background:${swatch}"></span>` : ''}
    <span class="check__label">${esc(label)}</span>
    ${star ? '<span class="star" title="Strategic raw material">&#9733;</span>' : ''}
    ${count === undefined ? '' : `<span class="check__n">${count}</span>`}
  </label>`;
}
