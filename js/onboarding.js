/**
 * The opening gate: pick materials and stages before the map draws anything.
 *
 * It sets the initial view rather than locking it — the same controls stay in
 * the sidebar afterwards, and the gate can be reopened from the header.
 * A URL carrying a filter hash skips it entirely, so shared links land on the
 * map directly.
 */

import { STAGES, STAGE_LABELS, STAGE_DESCRIPTIONS, stageIcon } from './icons.js';
import { esc, checkRow, plural } from './ui.js';

const PRESETS = [
  {
    id: 'battery',
    label: 'Battery materials',
    elements: ['lithium', 'cobalt', 'nickel', 'natural-graphite', 'manganese', 'copper'],
  },
  {
    id: 'magnets',
    label: 'Magnet materials',
    elements: ['light-rare-earths', 'heavy-rare-earths', 'boron', 'nickel'],
  },
  { id: 'strategic', label: 'All 17 strategic', elements: null },
  { id: 'everything', label: 'Everything', elements: [] },
];

// Working copy; only committed to the real filter state when "Show map" is clicked.
let draft = { elements: new Set(), stages: new Set(STAGES) };

export function openGate(model, state) {
  draft = {
    elements: new Set(state.elements),
    stages: new Set(state.stages.size ? state.stages : STAGES),
  };
  render(model);
  document.getElementById('gate').hidden = false;
  document.getElementById('gate-go').focus();
}

export function closeGate() {
  document.getElementById('gate').hidden = true;
}

export function getDraft() {
  return draft;
}

function render(model) {
  const materials = [...model.elements].sort((a, b) => a.name.localeCompare(b.name));
  const strategic = materials.filter((e) => e.strategic);
  const other = materials.filter((e) => !e.strategic);

  const row = (e) =>
    checkRow({
      id: e.id,
      label: e.name,
      checked: draft.elements.has(e.id),
      count: e.facility_count,
      star: e.strategic,
    });

  document.getElementById('gate-presets').innerHTML = PRESETS.map(
    (p) => `<button class="btn btn--sm" data-act="gate-preset" data-id="${p.id}">${esc(p.label)}</button>`
  ).join('');

  document.getElementById('gate-elements').innerHTML = `
    <div class="gate__col">
      <div class="fgroup__sub">Strategic raw materials</div>
      ${strategic.map(row).join('')}
    </div>
    <div class="gate__col">
      <div class="fgroup__sub">Other critical raw materials</div>
      ${other.map(row).join('')}
    </div>`;

  document.getElementById('gate-stages').innerHTML = STAGES.map(
    (s) => `<button class="stage-card" data-act="gate-stage" data-id="${s}"
      aria-pressed="${draft.stages.has(s)}" style="--stage-c: var(--stage-${s})">
      <span class="stage-card__icon">${stageIcon(s, { size: 17 })}</span>
      <span>
        <span class="stage-card__name">${esc(STAGE_LABELS[s])}</span>
        <span class="stage-card__desc">${esc(STAGE_DESCRIPTIONS[s])}</span>
      </span>
    </button>`
  ).join('');

  updateSummary(model);
}

/** Live count of what the current draft would show, so "Everything" is never a surprise. */
function updateSummary(model) {
  const n = model.facilities.filter(
    (f) =>
      (draft.elements.size === 0 || f.elements.some((e) => draft.elements.has(e))) &&
      (draft.stages.size === 0 || draft.stages.has(f.stage))
  ).length;

  const materialsLabel =
    draft.elements.size === 0 ? 'all materials' : plural(draft.elements.size, 'material');
  const stagesLabel =
    draft.stages.size === STAGES.length ? 'all stages' : plural(draft.stages.size, 'stage');

  const el = document.getElementById('gate-summary');
  el.textContent = `${materialsLabel}, ${stagesLabel} — ${plural(n, 'site')} on the map`;

  document.getElementById('gate-go').disabled = draft.stages.size === 0;
  document.getElementById('gate-el-hint').textContent =
    draft.elements.size === 0 ? 'Leave empty to show every material' : `${draft.elements.size} selected`;
}

/* ------------------------------------------------------------- interaction */

export function wireGate(model, onCommit) {
  const gate = document.getElementById('gate');

  gate.addEventListener('change', (e) => {
    const input = e.target.closest('#gate-elements input[type=checkbox]');
    if (!input) return;
    if (input.checked) draft.elements.add(input.value);
    else draft.elements.delete(input.value);
    updateSummary(model);
  });

  gate.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act]');
    if (!btn) return;
    const act = btn.dataset.act;

    if (act === 'gate-stage') {
      const s = btn.dataset.id;
      if (draft.stages.has(s)) draft.stages.delete(s);
      else draft.stages.add(s);
      btn.setAttribute('aria-pressed', draft.stages.has(s));
      updateSummary(model);
      return;
    }

    if (act === 'gate-preset') {
      const preset = PRESETS.find((p) => p.id === btn.dataset.id);
      if (!preset) return;
      draft.elements =
        preset.elements === null
          ? new Set(model.elements.filter((el) => el.strategic).map((el) => el.id))
          : new Set(preset.elements.filter((id) => model.elementById.has(id)));
      draft.stages = new Set(STAGES);
      render(model);
    }
  });

  document.getElementById('gate-everything').addEventListener('click', () => {
    draft.elements = new Set();
    draft.stages = new Set(STAGES);
    onCommit(draft);
  });

  document.getElementById('gate-go').addEventListener('click', () => onCommit(draft));

  gate.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && !gate.hidden) onCommit(draft);
  });
}
