/**
 * The map: bundled GeoJSON basemap, no tile server, and one marker per
 * city-and-stage pair.
 *
 * Grouping by city *and* stage is deliberate. Grouping by city alone would
 * collapse Hamburg's smelter and its recycling plant into a single dot that
 * cannot honestly be given one colour; grouping per facility would stack four
 * markers on the same coordinate, because the dataset is only city-precise.
 */

import { stageIcon, STAGES, STAGE_LABELS, STAGE_DESCRIPTIONS } from './icons.js';

const EUROPE_VIEW = {
  center: [56.5, 12],
  zoom: 4,
};

// Must stay inside the clip box used by scripts/build-europe-geo.mjs, so the
// straight edges left by clipping are never reachable.
const MAX_BOUNDS = [
  [32, -28],
  [73, 52],
];

let map = null;
let basemapLayer = null;
let markerLayer = null;
const markersByKey = new Map();
let selectedKey = null;
let onCountryClick = null;

/** Marker diameter in px at a given zoom. Small when zoomed out, or dense
 *  regions like the Low Countries turn into one unreadable blob. */
function markerSizeForZoom(z) {
  if (z <= 3) return 17;
  if (z === 4) return 21;
  if (z === 5) return 25;
  if (z === 6) return 29;
  return 33;
}

function applyMarkerSize() {
  if (!map) return;
  map.getContainer().style.setProperty('--marker-size', `${markerSizeForZoom(map.getZoom())}px`);
}

export function initMap({ onCountry } = {}) {
  onCountryClick = onCountry || null;

  map = L.map('map', {
    center: EUROPE_VIEW.center,
    zoom: EUROPE_VIEW.zoom,
    minZoom: 3,
    maxZoom: 9,
    maxBounds: MAX_BOUNDS,
    maxBoundsViscosity: 0.75,
    zoomControl: true,
    attributionControl: true,
    worldCopyJump: false,
    // The basemap has no tiles, so fractional zoom just blurs the outlines.
    zoomSnap: 1,
  });

  map.attributionControl.setPrefix('');
  map.attributionControl.addAttribution(
    'Boundaries: <a href="https://www.naturalearthdata.com/" target="_blank" rel="noopener">Natural Earth</a>'
  );

  markerLayer = L.layerGroup().addTo(map);

  map.on('zoomend', applyMarkerSize);
  applyMarkerSize();

  return map;
}

export function getMap() {
  return map;
}

/* ------------------------------------------------------------------ basemap */

export function renderBasemap(geojson) {
  if (basemapLayer) basemapLayer.remove();

  basemapLayer = L.geoJSON(geojson, {
    style: () => ({
      className: 'country',
      color: 'rgba(255,255,255,0.72)',
      weight: 1,
      opacity: 1,
      fill: true,
      fillColor: '#ffffff',
      fillOpacity: 0.015,
    }),
    onEachFeature: (feature, layer) => {
      const name = feature.properties?.name;
      if (!name) return;

      layer.on('mouseover', () => layer.setStyle({ fillOpacity: 0.07 }));
      layer.on('mouseout', () => layer.setStyle({ fillOpacity: layer.options._tint ?? 0.015 }));
      layer.on('click', () => onCountryClick && onCountryClick(name));
      layer.bindTooltip(name, { sticky: true, direction: 'top', opacity: 0.9, className: 'country-tip' });
    },
  }).addTo(map);

  // Countries sit under the markers.
  basemapLayer.bringToBack();
  return basemapLayer;
}

/**
 * Tint countries by how many matching sites they hold. Reads at a glance as
 * "who has the lithium" once the filter narrows to a single material.
 */
export function tintCountries(countsByCountry) {
  if (!basemapLayer) return;
  const max = Math.max(0, ...Object.values(countsByCountry || {}));

  basemapLayer.eachLayer((layer) => {
    const name = layer.feature?.properties?.name;
    const n = (countsByCountry && countsByCountry[name]) || 0;
    // Square root keeps a country with one site visible next to one with twenty.
    const tint = max > 0 && n > 0 ? 0.03 + 0.17 * Math.sqrt(n / max) : 0.015;
    layer.options._tint = tint;
    layer.setStyle({ fillOpacity: tint });
  });
}

/* ------------------------------------------------------------------ markers */

function markerHtml(group) {
  const count = group.facilities.length;
  const badge = count > 1 ? `<span class="marker__count">${count}</span>` : '';
  // --stage-c drives every colour in the marker; without it the CSS falls back
  // to inherited white and the pictogram loses its meaning.
  return `<div class="marker-pin" data-key="${group.key}" style="--stage-c: var(--stage-${group.stage})">
    <div class="marker">${stageIcon(group.stage)}${badge}</div>
  </div>`;
}

/**
 * @param {Array} groups  [{ key, city, stage, facilities }]
 */
export function renderMarkers(groups, { onSelect } = {}) {
  markerLayer.clearLayers();
  markersByKey.clear();

  for (const group of groups) {
    const icon = L.divIcon({
      html: markerHtml(group),
      className: 'crm-pin',
      // Zero-size icon: the inner element centres itself with a CSS transform,
      // which lets the marker resize on zoom without rebuilding every icon.
      iconSize: null,
    });

    const marker = L.marker([group.city.lat, group.city.lon], {
      icon,
      title: `${group.city.name} — ${STAGE_LABELS[group.stage] || group.stage}`,
      riseOnHover: true,
      keyboard: true,
      alt: `${STAGE_LABELS[group.stage] || group.stage} in ${group.city.name}`,
    });

    marker.on('click', () => onSelect && onSelect(group));
    marker.addTo(markerLayer);
    markersByKey.set(group.key, marker);
  }

  applySelectionClass();
}

function applySelectionClass() {
  for (const [key, marker] of markersByKey) {
    const el = marker.getElement()?.querySelector('.marker-pin');
    if (el) el.classList.toggle('is-selected', key === selectedKey);
  }
}

export function setSelected(key) {
  selectedKey = key;
  applySelectionClass();
}

export function openPopupAt(key, html) {
  const marker = markersByKey.get(key);
  if (!marker) return;
  marker.bindPopup(html, { closeButton: true, autoPanPadding: [40, 40], maxWidth: 300 }).openPopup();
}

export function closePopup() {
  if (map) map.closePopup();
}

/* ------------------------------------------------------------- navigation */

export function flyToCity(city, zoom = 6) {
  if (!map || !city) return;
  map.flyTo([city.lat, city.lon], Math.max(map.getZoom(), zoom), { duration: 0.6 });
}

export function fitToGroups(groups) {
  if (!map || !groups?.length) return;
  const bounds = L.latLngBounds(groups.map((g) => [g.city.lat, g.city.lon]));
  map.fitBounds(bounds, { padding: [60, 60], maxZoom: 6 });
}

export function resetView() {
  if (!map) return;
  map.closePopup();
  map.setView(EUROPE_VIEW.center, EUROPE_VIEW.zoom, { animate: true });
}

export function invalidate() {
  if (map) map.invalidateSize();
}

/* ----------------------------------------------------------------- legend */

export function renderLegend(container, activeStages) {
  const active = new Set(activeStages && activeStages.length ? activeStages : STAGES);
  container.innerHTML = `
    <div class="legend__title">Stage of the chain</div>
    ${STAGES.map(
      (s) => `
      <div class="legend__row" style="--stage-c: var(--stage-${s})" data-off="${!active.has(s)}"
           title="${STAGE_DESCRIPTIONS[s]}">
        <span class="legend__dot">${stageIcon(s)}</span>
        <span>${STAGE_LABELS[s]}</span>
      </div>`
    ).join('')}
  `;
}
