/**
 * Stage pictograms — original artwork, no third-party licence.
 *
 * Drawn on a 24x24 grid and deliberately chunky: these render at ~15px inside a
 * map marker, where thin strokes and fine detail turn to mush. Solid fills read
 * better than outlines at that size, so most of these are filled shapes.
 *
 * Colour comes from `fill: currentColor`, so a marker sets the hue in CSS.
 */

export const STAGES = ['mining', 'processing', 'refining', 'smelting', 'recycling', 'recovery'];

export const STAGE_LABELS = {
  mining: 'Mining',
  processing: 'Processing',
  refining: 'Refining',
  smelting: 'Smelting',
  recycling: 'Recycling',
  recovery: 'Recovery',
};

/**
 * Shown in the legend and the filter panel.
 *
 * Recycling and recovery are kept apart deliberately. Recycling puts a bulk
 * material back into the same material — copper scrap to copper cathode.
 * Recovery pulls a critical raw material that is a *minor* constituent out of a
 * complex stream: neodymium from a magnet, lithium from black mass, silicon from
 * a solar panel, germanium from a zinc residue. The second is far harder, and in
 * Europe it is where most of the new companies are.
 */
export const STAGE_DESCRIPTIONS = {
  mining: 'Extraction of ore or mineral from the ground',
  processing: 'Crushing, grinding and concentration of ore',
  refining: 'Chemical separation into a purified product',
  smelting: 'Thermal reduction of concentrate into metal',
  recycling: 'Bulk scrap reprocessed back into the same material',
  recovery: 'A minor critical raw material extracted from a complex waste stream',
};

const ICONS = {
  // Mine cart: heaped ore over a trapezoid body on two wheels.
  mining: `
    <circle cx="9.2" cy="6.6" r="1.9"/>
    <circle cx="13.4" cy="7.3" r="1.5"/>
    <path d="M3 10h18l-2.6 7.2H5.6z"/>
    <circle cx="8.4" cy="20.2" r="2"/>
    <circle cx="15.6" cy="20.2" r="2"/>`,

  // Hopper: ore funnelled down and broken into finer material.
  processing: `
    <path d="M2.6 4.4h18.8l-6.2 8.4H8.8z"/>
    <rect x="10.2" y="13.4" width="3.6" height="2.4" rx="0.6"/>
    <circle cx="8.8" cy="19.2" r="1.7"/>
    <circle cx="15.2" cy="19.2" r="1.7"/>
    <circle cx="12" cy="22" r="1.4"/>`,

  // Round-bottom flask: neck, collar, bulb.
  refining: `
    <rect x="8.6" y="2" width="6.8" height="2.2" rx="1"/>
    <path d="M10.2 4.6h3.6v5.1a6.4 6.4 0 1 1-3.6 0z"/>`,

  // Tipped crucible pouring molten metal into a pool.
  smelting: `
    <path d="M2.4 6.9 12.9 3l2.7 7.3-10.5 3.9z"/>
    <path d="M14.6 8.6c2.3 2.4 3.4 5.4 3.6 9h-2.4c-.2-3-1.1-5.4-3-7.4z"/>
    <ellipse cx="17" cy="19.6" rx="4.6" ry="2"/>`,

  // Horseshoe magnet lifting two particles clear of the stream: picking one
  // valuable material out of a mixture, rather than reprocessing the bulk.
  recovery: `
    <path d="M3 19V12a9 9 0 0 1 18 0v7h-6v-7a3 3 0 0 0-6 0v7z"/>
    <circle cx="6" cy="22.3" r="1.5"/>
    <circle cx="18" cy="22.3" r="1.5"/>`,

  // Three chevrons pinwheeling around the centre.
  recycling: `
    <g>
      <path d="M4.6 6.3h8.7V3.8L18.4 7.7 13.3 11.6V9.1H4.6z"/>
      <path d="M4.6 6.3h8.7V3.8L18.4 7.7 13.3 11.6V9.1H4.6z" transform="rotate(120 12 12)"/>
      <path d="M4.6 6.3h8.7V3.8L18.4 7.7 13.3 11.6V9.1H4.6z" transform="rotate(240 12 12)"/>
    </g>`,
};

/** Inline SVG markup for a stage, sized by the caller's CSS. */
export function stageIcon(stage, { size = 24, className = '' } = {}) {
  const body = ICONS[stage];
  if (!body) return '';
  return `<svg class="icon ${className}" viewBox="0 0 24 24" width="${size}" height="${size}"
    fill="currentColor" aria-hidden="true" focusable="false">${body}</svg>`;
}

export function hasIcon(stage) {
  return Object.prototype.hasOwnProperty.call(ICONS, stage);
}
