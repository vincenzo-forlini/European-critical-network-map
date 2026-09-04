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

/**
 * How established a company is. Incumbents get no chip — they are the norm, and
 * badging 60 of them would drown the handful that are new.
 */
export function maturityChip(maturity) {
  if (!maturity || maturity === 'incumbent') return '';
  const label = maturity === 'startup' ? 'Start-up' : 'Scale-up';
  return `<span class="chip chip--${esc(maturity)}">${label}</span>`;
}

/**
 * Marks a site as part of a Strategic Project under the Critical Raw Materials
 * Act. The promoting company stays the headline; this rides alongside it as a
 * label, because who is building the thing matters more than the project's
 * codename.
 */
export function crmaChip(facility, { compact = false } = {}) {
  if (!facility.crmaProject) return '';
  const title = `EU Strategic Project: ${facility.crmaProject}` +
    (facility.crmaStage.length ? ` (${facility.crmaStage.join(', ')})` : '');
  return `<span class="chip chip--crma" title="${esc(title)}">&#9733; ${
    compact ? 'Project' : 'EU Strategic Project'
  }</span>`;
}

const COMPANY_STATUS_LABELS = {
  insolvency: 'In insolvency',
  liquidation: 'In liquidation',
  acquired: 'Acquired',
  dissolved: 'Dissolved',
};

/**
 * Flags an operator that is not trading normally. Worth showing wherever the
 * company appears: a designated project or an operating plant means much less
 * when the company behind it is in court.
 */
export function companyStatusChip(company) {
  if (!company || !company.status || company.status === 'active') return '';
  const label = COMPANY_STATUS_LABELS[company.status] || company.status;
  const cls = company.status === 'acquired' ? 'chip--acquired' : 'chip--distress';
  return `<span class="chip ${cls}" title="${esc(company.status_note || label)}">&#9888; ${esc(label)}</span>`;
}

/**
 * Company mark for the expanded company panel.
 *
 * A monogram is always drawn, and the logo image sits on top of it. If the file
 * is missing or fails to load the monogram simply shows through, so a company
 * whose logo could not be fetched still looks deliberate rather than broken.
 *
 * Colour comes from a hash of the company key, so a given company always gets
 * the same tile and the panels stay recognisable between visits.
 */
export function companyLogo(company, { small = false } = {}) {
  const initials = (company.name || '?')
    .replace(/[^A-Za-zÀ-ÿ0-9 ]/g, ' ')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0].toUpperCase())
    .join('');

  let hash = 0;
  for (const ch of company.key || company.name || '') hash = (hash * 31 + ch.charCodeAt(0)) | 0;
  const hue = Math.abs(hash) % 360;

  const img = company.logo
    ? `<img src="assets/logos/${esc(company.logo)}" alt="" loading="lazy" decoding="async">`
    : '';

  return `<span class="clogo${small ? ' clogo--sm' : ''}" style="--mono-h:${hue}" aria-hidden="true">
    <span class="clogo__mono">${esc(initials)}</span>${img}
  </span>`;
}
