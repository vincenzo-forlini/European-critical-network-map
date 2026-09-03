/**
 * Charts for the element encyclopedia, drawn as inline SVG.
 *
 * No chart library: these are two fixed chart types over a small, known data
 * shape, and a dependency would cost more than it saves. Everything reads from
 * data/production.csv via the helpers in data.js.
 *
 * The palette here is separate from the stage colours on purpose — stage colour
 * carries meaning on the map, and reusing it for countries would imply a link
 * that does not exist.
 */

const SERIES_COLOURS = [
  '#6aa6ff', '#ffab3d', '#38dc90', '#ff6b8b', '#b18cff',
  '#37d4d4', '#ffd166', '#8fa6c4', '#f78fb3', '#79c0ff',
];

const REST_COLOUR = '#3b3b4a';

const esc = (s) =>
  String(s).replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );

export function seriesColour(i) {
  return SERIES_COLOURS[i % SERIES_COLOURS.length];
}

/* -------------------------------------------------------------------- donut */

function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

/** Annulus segment path. Handles the full-circle case, which arcs cannot draw. */
function arcPath(cx, cy, rOuter, rInner, startAngle, endAngle) {
  const sweep = endAngle - startAngle;
  if (sweep >= 359.999) {
    // Two half-circles, because a 360° arc collapses to nothing.
    return [
      `M ${cx} ${cy - rOuter}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy + rOuter}`,
      `A ${rOuter} ${rOuter} 0 1 1 ${cx} ${cy - rOuter}`,
      `M ${cx} ${cy - rInner}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy + rInner}`,
      `A ${rInner} ${rInner} 0 1 0 ${cx} ${cy - rInner}`,
      'Z',
    ].join(' ');
  }
  const large = sweep > 180 ? 1 : 0;
  const [x1, y1] = polar(cx, cy, rOuter, startAngle);
  const [x2, y2] = polar(cx, cy, rOuter, endAngle);
  const [x3, y3] = polar(cx, cy, rInner, endAngle);
  const [x4, y4] = polar(cx, cy, rInner, startAngle);
  return [
    `M ${x1} ${y1}`,
    `A ${rOuter} ${rOuter} 0 ${large} 1 ${x2} ${y2}`,
    `L ${x3} ${y3}`,
    `A ${rInner} ${rInner} 0 ${large} 0 ${x4} ${y4}`,
    'Z',
  ].join(' ');
}

/**
 * Donut of country shares, with a legend.
 * @param {{rows: {country, share, value, unit}[], remainder: number}} shares
 */
export function donutChart(shares, { title = '', subtitle = '' } = {}) {
  const slices = shares.rows.map((r, i) => ({ ...r, colour: seriesColour(i) }));
  if (shares.remainder > 0.5) {
    slices.push({
      country: 'Rest of world',
      share: shares.remainder,
      value: null,
      colour: REST_COLOUR,
      isRest: true,
    });
  }
  if (slices.length === 0) return '';

  const size = 168;
  const cx = size / 2;
  const cy = size / 2;
  const rOuter = 76;
  const rInner = 47;

  let angle = 0;
  const paths = slices
    .map((s) => {
      const sweep = (s.share / 100) * 360;
      const d = arcPath(cx, cy, rOuter, rInner, angle, angle + sweep);
      angle += sweep;
      return `<path d="${d}" fill="${s.colour}" stroke="#131318" stroke-width="1.5">
        <title>${esc(s.country)}: ${s.share.toFixed(1)}%</title>
      </path>`;
    })
    .join('');

  const top = slices[0];
  const centre = `
    <text x="${cx}" y="${cy - 4}" text-anchor="middle" class="donut__pct">${Math.round(top.share)}%</text>
    <text x="${cx}" y="${cy + 13}" text-anchor="middle" class="donut__lbl">${esc(top.country)}</text>`;

  const legend = slices
    .map(
      (s) => `<li class="clegend__row">
        <span class="clegend__sw" style="background:${s.colour}"></span>
        <span class="clegend__name">${esc(s.country)}</span>
        <span class="clegend__val">${s.share.toFixed(s.share < 10 ? 1 : 0)}%</span>
      </li>`
    )
    .join('');

  return `
    <figure class="chart">
      ${title ? `<figcaption class="chart__title">${esc(title)}</figcaption>` : ''}
      ${subtitle ? `<p class="chart__sub">${esc(subtitle)}</p>` : ''}
      <div class="donut">
        <svg viewBox="0 0 ${size} ${size}" width="${size}" height="${size}" role="img"
             aria-label="${esc(title || 'Share of supply by country')}">
          ${paths}${centre}
        </svg>
        <ul class="clegend">${legend}</ul>
      </div>
    </figure>`;
}

/* --------------------------------------------------------------------- line */

/**
 * Multi-series line chart of production over time.
 * @param {{country: string, points: {year, value}[]}[]} series
 */
export function lineChart(series, { title = '', unit = '', maxSeries = 6 } = {}) {
  const shown = series.slice(0, maxSeries).filter((s) => s.points.length > 0);
  if (shown.length === 0) return '';

  const years = [...new Set(shown.flatMap((s) => s.points.map((p) => p.year)))].sort((a, b) => a - b);

  // A single year cannot show a trend; the donut already says everything there
  // is to say about it, so do not draw a chart implying a line.
  if (years.length < 2) return '';

  const W = 340;
  const H = 170;
  const pad = { top: 12, right: 12, bottom: 26, left: 38 };
  const plotW = W - pad.left - pad.right;
  const plotH = H - pad.top - pad.bottom;

  const minYear = years[0];
  const maxYear = years[years.length - 1];
  const maxValue = Math.max(...shown.flatMap((s) => s.points.map((p) => p.value)));
  const yMax = niceCeiling(maxValue);

  const x = (year) => pad.left + ((year - minYear) / Math.max(1, maxYear - minYear)) * plotW;
  const y = (value) => pad.top + plotH - (value / yMax) * plotH;

  const ticks = [0, yMax / 2, yMax];
  const grid = ticks
    .map(
      (t) => `<line x1="${pad.left}" x2="${W - pad.right}" y1="${y(t)}" y2="${y(t)}" class="grid"/>
        <text x="${pad.left - 6}" y="${y(t) + 3.5}" text-anchor="end" class="axis">${formatTick(t)}</text>`
    )
    .join('');

  const xLabels = years
    .filter((_, i) => years.length <= 6 || i % Math.ceil(years.length / 6) === 0 || i === years.length - 1)
    .map((yr) => `<text x="${x(yr)}" y="${H - 8}" text-anchor="middle" class="axis">${yr}</text>`)
    .join('');

  const lines = shown
    .map((s, i) => {
      const colour = seriesColour(i);
      const d = s.points.map((p, j) => `${j === 0 ? 'M' : 'L'} ${x(p.year)} ${y(p.value)}`).join(' ');
      const dots = s.points
        .map(
          (p) => `<circle cx="${x(p.year)}" cy="${y(p.value)}" r="2.6" fill="${colour}">
            <title>${esc(s.country)} ${p.year}: ${p.value}${unit === 'share_pct' ? '%' : ''}</title>
          </circle>`
        )
        .join('');
      return `<path d="${d}" fill="none" stroke="${colour}" stroke-width="1.8"
        stroke-linejoin="round" stroke-linecap="round"/>${dots}`;
    })
    .join('');

  const legend = shown
    .map(
      (s, i) => `<li class="clegend__row">
        <span class="clegend__sw" style="background:${seriesColour(i)}"></span>
        <span class="clegend__name">${esc(s.country)}</span>
      </li>`
    )
    .join('');

  return `
    <figure class="chart">
      ${title ? `<figcaption class="chart__title">${esc(title)}</figcaption>` : ''}
      <svg viewBox="0 0 ${W} ${H}" class="linechart" role="img"
           aria-label="${esc(title || 'Production over time')}">
        ${grid}${xLabels}${lines}
      </svg>
      <ul class="clegend clegend--inline">${legend}</ul>
    </figure>`;
}

function niceCeiling(v) {
  if (v <= 0) return 1;
  const mag = 10 ** Math.floor(Math.log10(v));
  for (const step of [1, 1.5, 2, 2.5, 5, 10]) {
    if (v <= step * mag) return step * mag;
  }
  return 10 * mag;
}

function formatTick(v) {
  if (v >= 1e6) return `${(v / 1e6).toFixed(v % 1e6 === 0 ? 0 : 1)}M`;
  if (v >= 1e3) return `${(v / 1e3).toFixed(v % 1e3 === 0 ? 0 : 1)}k`;
  return String(Math.round(v * 10) / 10);
}

/* ------------------------------------------------------------------- meters */

/** Horizontal indicator bar, used for EU import reliance and recycling rate. */
export function meter(label, value, { suffix = '%', danger = 70, hint = '' } = {}) {
  if (value === null || value === undefined) {
    return `<div class="meter">
      <div class="meter__top"><span>${esc(label)}</span><span class="faint">no data</span></div>
    </div>`;
  }
  const pct = Math.max(0, Math.min(100, value));
  return `<div class="meter${value >= danger ? ' meter--high' : ''}"${hint ? ` title="${esc(hint)}"` : ''}>
    <div class="meter__top">
      <span>${esc(label)}</span>
      <span class="meter__val">${value}${suffix}</span>
    </div>
    <div class="meter__track"><div class="meter__fill" style="width:${pct}%"></div></div>
  </div>`;
}
