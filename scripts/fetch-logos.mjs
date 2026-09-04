/**
 * Downloads each company's logo into assets/logos/ and records the filename in
 * the `logo` column of data/companies.csv.
 *
 *   node scripts/fetch-logos.mjs [--force] [--only <company key>] [--limit N]
 *
 * Fetched into the repository rather than hot-linked, for three reasons: the map
 * is meant to work offline, nothing should tell a company's server who is
 * browsing this dataset, and a dataset full of start-ups will accumulate dead
 * links faster than anything else here.
 *
 * Logos are trademarks of their owners and are used only to identify the
 * company whose sites are shown. Re-run with --force after a rebrand.
 *
 * A company with no usable logo is left blank on purpose: the panel draws a
 * monogram instead, which looks deliberate. Never substitute one company's mark
 * for another's.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, normaliseKey } from '../js/csv.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT_DIR = path.join(ROOT, 'assets', 'logos');
const CSV = path.join(ROOT, 'data', 'companies.csv');

const TIMEOUT_MS = 12000;
const DELAY_MS = 400;
const MAX_BYTES = 250 * 1024; // a logo, not a hero image
const UA = 'european-critical-network-map/1.0 (+https://github.com/vincenzo-forlini/European-critical-network-map)';

const args = process.argv.slice(2);
const force = args.includes('--force');
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;

const EXT = {
  'image/png': '.png',
  'image/jpeg': '.jpg',
  'image/webp': '.webp',
  'image/svg+xml': '.svg',
  'image/gif': '.gif',
  'image/x-icon': '.ico',
  'image/vnd.microsoft.icon': '.ico',
};

async function get(url, accept) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    return await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: { 'User-Agent': UA, Accept: accept },
    });
  } finally {
    clearTimeout(timer);
  }
}

/** Candidate logo URLs for a site, best first. */
async function candidates(website) {
  const base = new URL(website);
  const found = [];

  try {
    const res = await get(base.href, 'text/html');
    if (res.ok) {
      const html = (await res.text()).slice(0, 400_000);

      // Apple touch icons are usually the largest and cleanest square mark.
      for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*apple-touch-icon[^"']*["'][^>]*>/gi)) {
        const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
        if (href) found.push(new URL(href, base).href);
      }
      // Then any declared icon, preferring explicitly larger sizes.
      const icons = [];
      for (const m of html.matchAll(/<link[^>]+rel=["'][^"']*\bicon\b[^"']*["'][^>]*>/gi)) {
        const href = m[0].match(/href=["']([^"']+)["']/i)?.[1];
        if (!href) continue;
        const size = Number(m[0].match(/sizes=["'](\d+)/i)?.[1] || 0);
        icons.push({ url: new URL(href, base).href, size });
      }
      icons.sort((a, b) => b.size - a.size);
      found.push(...icons.map((i) => i.url));

      const og = html.match(/<meta[^>]+property=["']og:image["'][^>]*content=["']([^"']+)["']/i)?.[1];
      if (og) found.push(new URL(og, base).href);
    }
  } catch {
    /* fall through to the conventional path below */
  }

  found.push(new URL('/favicon.ico', base).href);
  return [...new Set(found)];
}

async function download(url) {
  const res = await get(url, 'image/*');
  if (!res.ok) throw new Error(`HTTP ${res.status}`);

  const type = (res.headers.get('content-type') || '').split(';')[0].trim().toLowerCase();
  const ext = EXT[type];
  if (!ext) throw new Error(`not an image (${type || 'no content-type'})`);

  const buf = Buffer.from(await res.arrayBuffer());
  if (buf.length === 0) throw new Error('empty file');
  if (buf.length > MAX_BYTES) throw new Error(`too large (${Math.round(buf.length / 1024)} KB)`);
  return { buf, ext };
}

/* -------------------------------------------------------------------- main */

const parsed = parseCsv(fs.readFileSync(CSV, 'utf8'));
const headers = [...parsed.headers];
if (!headers.includes('logo')) headers.push('logo');

fs.mkdirSync(OUT_DIR, { recursive: true });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let kept = 0;
let failed = 0;
let skipped = 0;

const targets = parsed.records.filter((r) => {
  if (only) return normaliseKey(r.company) === only;
  return true;
});

console.log(`\nFetching logos for up to ${Math.min(targets.length, limit)} companies…\n`);

let n = 0;
for (const r of parsed.records) {
  const key = normaliseKey(r.company);
  if (only && key !== only) continue;
  if (n >= limit) break;

  if (!r.website) {
    skipped++;
    continue;
  }
  if (r.logo && !force) {
    kept++;
    continue;
  }
  n++;

  process.stdout.write(`  [${n}] ${r.company.padEnd(32)}`);
  let done = false;
  try {
    for (const url of await candidates(r.website)) {
      try {
        const { buf, ext } = await download(url);
        const file = `${key}${ext}`;
        fs.writeFileSync(path.join(OUT_DIR, file), buf);
        r.logo = file;
        console.log(`${file} (${Math.round(buf.length / 1024) || 1} KB)`);
        ok++;
        done = true;
        break;
      } catch {
        /* try the next candidate */
      }
    }
    if (!done) {
      // Leave the cell blank: the panel draws a monogram, which is honest.
      console.log('no usable logo — monogram will be used');
      failed++;
    }
  } catch (err) {
    console.log(`failed: ${err.message}`);
    failed++;
  }
  await sleep(DELAY_MS);
}

const esc = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
const rows = [headers, ...parsed.records.map((r) => headers.map((h) => r[h] ?? ''))];
fs.writeFileSync(CSV, '﻿' + rows.map((r) => r.map(esc).join(',')).join('\r\n') + '\r\n');

const total = parsed.records.filter((r) => r.logo).length;
console.log(`\n${ok} fetched · ${kept} already had one · ${failed} without · ${skipped} with no website`);
console.log(`${total} of ${parsed.records.length} companies now have a logo.`);
