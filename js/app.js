/* TEMPORARY bootstrap — verifies the basemap and pictograms render.
   Replaced by the real application wiring in the next step. */

import { initMap, renderBasemap, renderMarkers, renderLegend } from './map.js';
import { STAGES } from './icons.js';

const DEMO = [
  { key: 'a', stage: 'mining', city: { name: 'Kiruna', lat: 67.86, lon: 20.23 }, facilities: [1] },
  { key: 'b', stage: 'smelting', city: { name: 'Hamburg', lat: 53.55, lon: 9.99 }, facilities: [1] },
  { key: 'c', stage: 'refining', city: { name: 'La Rochelle', lat: 46.16, lon: -1.15 }, facilities: [1] },
  { key: 'd', stage: 'processing', city: { name: 'Kokkola', lat: 63.84, lon: 23.13 }, facilities: [1, 2] },
  { key: 'e', stage: 'recycling', city: { name: 'Antwerp', lat: 51.22, lon: 4.4 }, facilities: [1, 2, 3] },
];

initMap();
renderLegend(document.getElementById('legend'), STAGES);
document.getElementById('map-note').textContent = 'basemap check';

const res = await fetch('data/geo/europe.geo.json');
renderBasemap(await res.json());
renderMarkers(DEMO, { onSelect: (g) => console.log('clicked', g.city.name) });

document.getElementById('loading').hidden = true;
