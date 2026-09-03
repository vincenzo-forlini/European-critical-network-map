/**
 * Builds data/geo/europe.geo.json from Natural Earth 1:50m admin-0 countries.
 *
 * Run once (or whenever the framing changes):   node scripts/build-europe-geo.mjs
 *
 * Source: https://github.com/nvkelso/natural-earth-vector  (public domain, CC0)
 * Natural Earth asks only that you do not claim their data as your own.
 *
 * Every ring is clipped to BBOX rather than filtered by it. Filtering would keep
 * Russia's whole outline out to Kamchatka and blow up both the file and the framing.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const CACHE = path.join(HERE, '.cache', 'ne_50m_admin_0_countries.geojson');
const OUT = path.join(ROOT, 'data', 'geo', 'europe.geo.json');
const SRC_URL =
  'https://raw.githubusercontent.com/nvkelso/natural-earth-vector/master/geojson/ne_50m_admin_0_countries.geojson';

// [minLon, minLat, maxLon, maxLat].
//
// Deliberately wider than the area the map lets you pan to (MAX_BOUNDS in
// js/map.js). Clipping leaves straight cut lines across Russia and the Arctic,
// and those artefacts have to sit outside anywhere the user can actually reach,
// or the basemap visibly turns into a rectangle.
const BBOX = [-52, 5, 82, 88];

// Included on top of CONTINENT === 'Europe'. Turkey and Cyprus matter for CRM supply
// (boron, chromite, feldspar) and Natural Earth files them under Asia.
const EXTRA_ADMINS = new Set(['Turkey', 'Cyprus', 'Northern Cyprus']);

// Dropped: microstates whose outline is a dot at this scale, and dependencies that
// only add noise. They can still appear in the dataset; this is about the basemap.
const SKIP_ADMINS = new Set(['Vatican', 'Monaco', 'San Marino', 'Guernsey', 'Jersey', 'Isle of Man']);

const COORD_PRECISION = 3; // ~110 m at the equator; far finer than city-level needs
const MIN_RING_SPAN = 0.06; // degrees; drops islets that render as a single pixel

// ---------------------------------------------------------------- clipping

const lerp = (a, b, t) => a + (b - a) * t;

function intersectX(a, b, x) {
  const t = b[0] === a[0] ? 0 : (x - a[0]) / (b[0] - a[0]);
  return [x, lerp(a[1], b[1], t)];
}
function intersectY(a, b, y) {
  const t = b[1] === a[1] ? 0 : (y - a[1]) / (b[1] - a[1]);
  return [lerp(a[0], b[0], t), y];
}

const INSIDE = [
  (p, [minX]) => p[0] >= minX,
  (p, [, , maxX]) => p[0] <= maxX,
  (p, [, minY]) => p[1] >= minY,
  (p, [, , , maxY]) => p[1] <= maxY,
];
const CROSS = [
  (a, b, [minX]) => intersectX(a, b, minX),
  (a, b, [, , maxX]) => intersectX(a, b, maxX),
  (a, b, [, minY]) => intersectY(a, b, minY),
  (a, b, [, , , maxY]) => intersectY(a, b, maxY),
];

/** Sutherland–Hodgman against an axis-aligned rectangle. */
function clipRing(ring, bbox) {
  let out = ring;
  for (let edge = 0; edge < 4; edge++) {
    const input = out;
    if (input.length === 0) return [];
    out = [];
    for (let i = 0; i < input.length; i++) {
      const cur = input[i];
      const prev = input[(i + input.length - 1) % input.length];
      const curIn = INSIDE[edge](cur, bbox);
      const prevIn = INSIDE[edge](prev, bbox);
      if (curIn) {
        if (!prevIn) out.push(CROSS[edge](prev, cur, bbox));
        out.push(cur);
      } else if (prevIn) {
        out.push(CROSS[edge](prev, cur, bbox));
      }
    }
  }
  return out;
}

// ---------------------------------------------------------------- tidying

function roundRing(ring) {
  const f = 10 ** COORD_PRECISION;
  const out = [];
  for (const [x, y] of ring) {
    const p = [Math.round(x * f) / f, Math.round(y * f) / f];
    const last = out[out.length - 1];
    if (!last || last[0] !== p[0] || last[1] !== p[1]) out.push(p);
  }
  // close the ring
  const first = out[0];
  const last = out[out.length - 1];
  if (out.length > 2 && (first[0] !== last[0] || first[1] !== last[1])) out.push([...first]);
  return out;
}

function ringIsSubstantial(ring) {
  if (ring.length < 4) return false;
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  for (const [x, y] of ring) {
    if (x < minX) minX = x;
    if (x > maxX) maxX = x;
    if (y < minY) minY = y;
    if (y > maxY) maxY = y;
  }
  return maxX - minX >= MIN_RING_SPAN || maxY - minY >= MIN_RING_SPAN;
}

function clipPolygon(polygon, bbox) {
  const rings = [];
  for (const ring of polygon) {
    const clipped = roundRing(clipRing(ring, bbox));
    if (ringIsSubstantial(clipped)) rings.push(clipped);
  }
  return rings;
}

// ---------------------------------------------------------------- source

async function loadSource() {
  if (fs.existsSync(CACHE)) {
    console.log(`Using cached source: ${path.relative(ROOT, CACHE)}`);
    return JSON.parse(fs.readFileSync(CACHE, 'utf8'));
  }
  console.log('Downloading Natural Earth 1:50m admin-0 countries…');
  const res = await fetch(SRC_URL);
  if (!res.ok) throw new Error(`Download failed: HTTP ${res.status} ${res.statusText}`);
  const text = await res.text();
  fs.mkdirSync(path.dirname(CACHE), { recursive: true });
  fs.writeFileSync(CACHE, text);
  console.log(`Cached ${(text.length / 1e6).toFixed(1)} MB`);
  return JSON.parse(text);
}

// ---------------------------------------------------------------- main

const source = await loadSource();

const features = [];
let skippedEmpty = 0;

for (const feature of source.features) {
  const p = feature.properties;
  const admin = p.ADMIN;
  if (SKIP_ADMINS.has(admin)) continue;
  if (p.CONTINENT !== 'Europe' && !EXTRA_ADMINS.has(admin)) continue;

  const geom = feature.geometry;
  let polygons = [];
  if (geom.type === 'Polygon') polygons = [geom.coordinates];
  else if (geom.type === 'MultiPolygon') polygons = geom.coordinates;
  else continue;

  const kept = polygons.map((poly) => clipPolygon(poly, BBOX)).filter((rings) => rings.length > 0);

  if (kept.length === 0) {
    skippedEmpty++;
    continue;
  }

  features.push({
    type: 'Feature',
    properties: {
      name: admin,
      iso_a2: p.ISO_A2_EH && p.ISO_A2_EH !== '-99' ? p.ISO_A2_EH : null,
      iso_a3: p.ISO_A3_EH && p.ISO_A3_EH !== '-99' ? p.ISO_A3_EH : null,
    },
    geometry:
      kept.length === 1
        ? { type: 'Polygon', coordinates: kept[0] }
        : { type: 'MultiPolygon', coordinates: kept },
  });
}

features.sort((a, b) => a.properties.name.localeCompare(b.properties.name));

const out = {
  type: 'FeatureCollection',
  // Provenance travels with the file so nobody has to guess where it came from.
  metadata: {
    source: 'Natural Earth 1:50m Admin 0 – Countries',
    source_url: 'https://www.naturalearthdata.com/',
    licence: 'Public domain (CC0)',
    generated_by: 'scripts/build-europe-geo.mjs',
    bbox: BBOX,
    coordinate_precision: COORD_PRECISION,
  },
  features,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out));

const bytes = fs.statSync(OUT).size;
console.log(`\nWrote ${path.relative(ROOT, OUT)}`);
console.log(`  ${features.length} countries, ${(bytes / 1024).toFixed(0)} KB`);
if (skippedEmpty) console.log(`  ${skippedEmpty} feature(s) fell entirely outside the bbox`);
