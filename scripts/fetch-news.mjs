/**
 * Collects recent company announcements into data/news.json.
 *
 *   node scripts/fetch-news.mjs [--limit N] [--only <company key>]
 *
 * Each company's own press-release feed is used, taken from the `news_feed`
 * column in data/companies.csv. Companies without a feed are skipped, and the
 * app falls back to offering a news-search link for them.
 *
 * Why company feeds rather than a news aggregator:
 *  - A news API key committed to a public static site is public. RSS needs none.
 *  - Browsers block cross-origin RSS fetches, so this has to run server-side.
 *  - Google News' RSS licence limits it to personal feed readers and expressly
 *    prohibits other use, which republishing it here would be. A company's own
 *    newsroom feed is published precisely to be syndicated.
 *
 * Only the headline, publisher, date and link are stored. Never article text.
 *
 * A company whose fetch fails keeps whatever headlines it already had, so a
 * flaky run costs freshness rather than emptying the file.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseCsv, normaliseKey } from '../js/csv.js';

const ROOT = path.join(path.dirname(fileURLToPath(import.meta.url)), '..');
const OUT = path.join(ROOT, 'data', 'news.json');

const ITEMS_PER_COMPANY = 5;
const DELAY_MS = 800;
const TIMEOUT_MS = 15000;

const args = process.argv.slice(2);
const limit = Number(args[args.indexOf('--limit') + 1]) || Infinity;
const only = args.includes('--only') ? args[args.indexOf('--only') + 1] : null;

/* ------------------------------------------------------------------- input */

const all = parseCsv(fs.readFileSync(path.join(ROOT, 'data', 'companies.csv'), 'utf8')).records
  .filter((r) => r.company)
  .map((r) => ({
    key: normaliseKey(r.company),
    name: r.company,
    feed: (r.news_feed || '').trim(),
  }));

const withFeed = all.filter((c) => c.feed);
const withoutFeed = all.length - withFeed.length;

const existing = fs.existsSync(OUT) ? JSON.parse(fs.readFileSync(OUT, 'utf8')) : { companies: {} };
const out = { generated_at: new Date().toISOString(), companies: { ...existing.companies } };

/* ------------------------------------------------------------------- fetch */

async function fetchText(url) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      signal: controller.signal,
      redirect: 'follow',
      headers: {
        // Identify the client honestly rather than impersonating a browser.
        'User-Agent':
          'european-critical-network-map/1.0 (+https://github.com/vincenzo-forlini/European-critical-network-map)',
        Accept: 'application/rss+xml, application/atom+xml, application/xml, text/xml;q=0.9, */*;q=0.5',
      },
    });
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.text();
  } finally {
    clearTimeout(timer);
  }
}

/* ------------------------------------------------------------------- parse */

const decodeEntities = (s) =>
  String(s)
    .replace(/<!\[CDATA\[([\s\S]*?)\]\]>/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&nbsp;/g, ' ')
    .replace(/&#(\d+);/g, (_, d) => String.fromCharCode(Number(d)))
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCharCode(parseInt(h, 16)))
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();

function tag(xml, name) {
  const m = xml.match(new RegExp(`<${name}(?:\\s[^>]*)?>([\\s\\S]*?)</${name}>`, 'i'));
  return m ? decodeEntities(m[1]) : '';
}

/**
 * Handles both RSS <item> and Atom <entry>. A full XML parser would be a
 * dependency for four fields from two well-known shapes.
 */
function parseFeed(xml) {
  const items = [];
  const blocks = [
    ...[...xml.matchAll(/<item[\s>]([\s\S]*?)<\/item>/gi)].map((m) => ({ kind: 'rss', body: m[1] })),
    ...[...xml.matchAll(/<entry[\s>]([\s\S]*?)<\/entry>/gi)].map((m) => ({ kind: 'atom', body: m[1] })),
  ];

  for (const { kind, body } of blocks) {
    const title = tag(body, 'title');
    let link = '';
    if (kind === 'rss') {
      link = tag(body, 'link');
    }
    if (!link) {
      // Atom puts the URL in an attribute; prefer rel="alternate".
      const alt = body.match(/<link[^>]*rel=["']alternate["'][^>]*href=["']([^"']+)["']/i);
      const any = body.match(/<link[^>]*href=["']([^"']+)["']/i);
      link = decodeEntities(alt?.[1] || any?.[1] || '');
    }
    if (!title || !link) continue;

    const raw = tag(body, 'pubDate') || tag(body, 'published') || tag(body, 'updated') || tag(body, 'dc:date');
    const d = raw ? new Date(raw) : null;

    items.push({
      title,
      link,
      published: d && !Number.isNaN(d.getTime()) ? d.toISOString() : '',
    });
  }

  // Newest first; undated items keep their feed order at the end.
  return items.sort((a, b) => (b.published || '').localeCompare(a.published || ''));
}

/* -------------------------------------------------------------------- main */

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

let ok = 0;
let kept = 0;
let failed = 0;

const targets = withFeed.filter((c) => !only || c.key === only).slice(0, limit);

if (targets.length === 0) {
  console.log('\nNo company has a news_feed set in data/companies.csv.\n');
  console.log('Add a company press-release or newsroom RSS/Atom URL to the news_feed');
  console.log('column and run this again. Companies without one show a news-search');
  console.log('link in the app instead.\n');
  process.exit(0);
}

console.log(`\nFetching announcements for ${targets.length} companies with a feed`);
console.log(`(${withoutFeed} of ${all.length} companies have no news_feed set)\n`);

for (const [i, company] of targets.entries()) {
  process.stdout.write(`  [${i + 1}/${targets.length}] ${company.name.padEnd(34)}`);
  try {
    const xml = await fetchText(company.feed);
    const items = parseFeed(xml)
      .slice(0, ITEMS_PER_COMPANY)
      .map((it) => ({ ...it, source: company.name }));

    if (items.length === 0 && out.companies[company.key]?.items?.length) {
      console.log('no items (keeping previous)');
      kept++;
    } else {
      out.companies[company.key] = { fetched_at: new Date().toISOString(), items };
      console.log(items.length ? `${items.length} items` : 'no items');
      ok++;
    }
  } catch (err) {
    failed++;
    const n = out.companies[company.key]?.items?.length || 0;
    console.log(`failed: ${err.message}${n ? ` (keeping ${n} previous)` : ''}`);
  }

  if (i < targets.length - 1) await sleep(DELAY_MS);
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(out, null, 2) + '\n');

const total = Object.values(out.companies).reduce((n, c) => n + (c.items?.length || 0), 0);
console.log(`\nWrote data/news.json — ${total} items across ${Object.keys(out.companies).length} companies.`);
console.log(`${ok} ok · ${kept} kept · ${failed} failed`);
