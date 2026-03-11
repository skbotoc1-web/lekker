import * as cheerio from 'cheerio';
import { harmonizeIngredients } from './ingredientNormalizer.js';

const retailers = [
  {
    id: 'migros',
    url: 'https://www.migros.ch/de/offers/home',
    selectors: [
      '[data-testid*="product"] h2',
      '[data-testid*="product"] h3',
      '[data-testid*="offer"] h2',
      '[class*="product"] [class*="title"]',
      '[class*="offer"] [class*="title"]',
      '[class*="m-product"] [title]',
      '[class*="product"] [data-product-name]',
      '[class*="tile"] [aria-label]',
      'article h2',
      'article h3',
      'a[title*="Bio"]',
      'a[title]'
    ]
  },
  {
    id: 'coop',
    url: 'https://www.coop.ch/de/',
    selectors: [
      '[class*="product"] h2',
      '[class*="product"] h3',
      '[class*="tile"] [class*="headline"]',
      '[class*="teaser"] [class*="title"]',
      '[data-qa*="product"] [title]',
      '[data-qa*="product"] [aria-label]',
      '[class*="offer"] [data-name]',
      'article h2',
      'article h3',
      'a[title]'
    ]
  },
  {
    id: 'aldi',
    url: 'https://www.aldi-suisse.ch/de/aktionen-und-angebote.html',
    selectors: [
      '[class*="offer"] h2',
      '[class*="offer"] h3',
      '[class*="product"] h2',
      '[class*="product"] h3',
      '[class*="teaser"] [class*="title"]',
      '[class*="mod-offer"] [title]',
      '[class*="mod-offer"] [aria-label]',
      '[data-title]',
      'article h2',
      'article h3',
      'a[title]'
    ]
  },
  {
    id: 'lidl',
    url: 'https://www.lidl.ch/',
    selectors: [
      '[class*="product"] h2',
      '[class*="product"] h3',
      '[class*="offer"] h2',
      '[class*="offer"] h3',
      '[class*="tile"] [class*="title"]',
      '[class*="product-grid"] [title]',
      '[class*="product-grid"] [aria-label]',
      '[data-product-name]',
      'article h2',
      'article h3',
      'a[title]'
    ]
  }
];

const fallbackItems = {
  migros: ['Brokkoli', 'Haferflocken', 'Tofu', 'Kichererbsen', 'Äpfel', 'Karotten', 'Vollkornpasta', 'Naturjoghurt', 'Lachs', 'Pouletbrust'],
  coop: ['Spinat', 'Bananen', 'Linsen', 'Nüsse', 'Quinoa', 'Tomaten', 'Eier', 'Skyr', 'Rindfleisch', 'Reis'],
  aldi: ['Peperoni', 'Zucchini', 'Kartoffeln', 'Bohnen', 'Sojadrink', 'Beeren', 'Vollkornpasta', 'Käse', 'Thunfisch', 'Pouletbrust'],
  lidl: ['Brokkoli', 'Pilze', 'Süsskartoffeln', 'Haferdrink', 'Mandeln', 'Birnen', 'Skyr', 'Feta', 'Forelle', 'Rindfleisch']
};

const genericFallback = ['Tomaten', 'Kartoffeln', 'Gurken', 'Karotten', 'Reis', 'Quinoa', 'Kichererbsen', 'Linsen', 'Brokkoli', 'Bananen'];

const HEADING_NOISE = /\b(angebote|aktionen|shop|prospekt|newsletter|kundenkonto|entdecken|inspiration)\b/i;

function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function extractJsonNames(node, out = []) {
  if (!node) return out;

  if (Array.isArray(node)) {
    node.forEach(x => extractJsonNames(x, out));
    return out;
  }

  if (typeof node !== 'object') return out;

  if (typeof node.name === 'string') out.push(node.name);
  if (typeof node.title === 'string') out.push(node.title);
  if (typeof node.headline === 'string') out.push(node.headline);
  if (typeof node.description === 'string' && node.description.length < 80) out.push(node.description);

  for (const key of ['item', 'offers', 'itemListElement', 'mainEntity', 'about', 'hasPart']) {
    if (node[key]) extractJsonNames(node[key], out);
  }

  return out;
}

function collectJsonLdNames($) {
  const names = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw) return;
    const parsed = tryParseJson(raw);
    extractJsonNames(parsed, names);
  });

  return names;
}

function collectSelectorTexts($, selectors) {
  const out = [];
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const txt = $(el).text()?.trim();
      if (txt) out.push(txt);
      const title = $(el).attr('title');
      if (title) out.push(title.trim());
      const aria = $(el).attr('aria-label');
      if (aria) out.push(aria.trim());
      const dataName = $(el).attr('data-product-name') || $(el).attr('data-name') || $(el).attr('data-title');
      if (dataName) out.push(dataName.trim());
    });
  }

  ['[data-product-name]', '[data-name]', '[data-title]', '[aria-label*="Bio"]'].forEach(sel => {
    $(sel).each((_, el) => {
      const value = $(el).attr('data-product-name') || $(el).attr('data-name') || $(el).attr('data-title') || $(el).attr('aria-label');
      if (value) out.push(value.trim());
    });
  });

  return out;
}

function sourceWeight(sources = []) {
  let weight = 0;
  for (const source of sources) {
    const lowered = String(source || '').toLowerCase();
    if (lowered.includes('json')) weight += 0.2;
    else if (lowered.includes('data-')) weight += 0.15;
    else if (lowered.includes('selector')) weight += 0.1;
  }
  return weight;
}

function scoreRows(rows) {
  return rows
    .map(row => ({
      ...row,
      score: row.mentions * 2 + row.maxConfidence + (row.mentions > 1 ? 0.6 : 0) + (row.sources.length > 1 ? 0.3 : 0) + sourceWeight(row.sources)
    }))
    .sort((a, b) => b.score - a.score);
}

function fallbackFor(retailerId) {
  const seen = new Set();
  const sequence = [...(fallbackItems[retailerId] || []), ...genericFallback];
  const out = [];
  for (const item of sequence) {
    if (seen.has(item)) continue;
    seen.add(item);
    out.push({ item, price: 'n/a', mentions: 1, confidence: 0.5, source: 'fallback' });
    if (out.length >= 10) break;
  }
  return out;
}

function finalizeSelection(harmonized, retailerId) {
  const selected = [];
  const seen = new Set();

  for (const row of harmonized) {
    const item = row.canonical;
    if (seen.has(item)) continue;
    if (row.maxConfidence < 0.6 && row.mentions < 2) continue;
    seen.add(item);
    selected.push({ item, price: 'n/a', mentions: row.mentions, confidence: row.maxConfidence, source: 'parsed' });
    if (selected.length >= 10) break;
  }

  if (!selected.length) return fallbackFor(retailerId);

  const fill = fallbackFor(retailerId)
    .filter(x => !seen.has(x.item))
    .slice(0, Math.max(0, 10 - selected.length));
  return [...selected, ...fill].slice(0, 10);
}

function dedupeRawCandidates(items = []) {
  const seen = new Set();
  const out = [];

  for (const item of items) {
    const normalized = String(item || '').toLowerCase().replace(/[^\p{L}\p{N}]+/gu, ' ').trim();
    if (!normalized || normalized.length < 3 || HEADING_NOISE.test(normalized)) continue;
    if (seen.has(normalized)) continue;
    seen.add(normalized);
    out.push(item);
  }

  return out;
}

export function parseRetailerHtml(html, retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  const $ = cheerio.load(html || '');
  const rawCandidates = dedupeRawCandidates([
    ...collectSelectorTexts($, retailer.selectors),
    ...collectJsonLdNames($)
  ]);

  const harmonized = scoreRows(harmonizeIngredients(rawCandidates).slice(0, 120));
  return finalizeSelection(harmonized, retailerId);
}

export async function crawlRetailer(retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  try {
    const response = await fetch(retailer.url, {
      headers: {
        'User-Agent': 'lekker-bot/1.5 (+swiss-retailer-harmonizer)',
        'Accept-Language': 'de-CH,de;q=0.9'
      }
    });

    if (!response.ok) return fallbackFor(retailerId);

    const html = await response.text();
    const parsed = parseRetailerHtml(html, retailerId);
    return parsed.length ? parsed : fallbackFor(retailerId);
  } catch {
    return fallbackFor(retailerId);
  }
}

export function getRetailers() {
  return retailers;
}
