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

function tryParseJson(raw) {
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function collectJsonLdNames($) {
  const names = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw) return;

    const parsed = tryParseJson(raw);
    const arr = Array.isArray(parsed) ? parsed : [parsed];

    for (const node of arr) {
      if (!node) continue;
      if (node?.name && typeof node.name === 'string') names.push(node.name);
      if (node?.item?.name) names.push(String(node.item.name));
      if (Array.isArray(node?.itemListElement)) {
        for (const entry of node.itemListElement) {
          const n = entry?.name || entry?.item?.name;
          if (typeof n === 'string') names.push(n);
        }
      }
      if (Array.isArray(node?.offers)) {
        for (const offer of node.offers) {
          if (offer?.name) names.push(String(offer.name));
        }
      }
    }
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

  ['[data-product-name]', '[data-name]', '[data-title]'].forEach(sel => {
    $(sel).each((_, el) => {
      const value = $(el).attr('data-product-name') || $(el).attr('data-name') || $(el).attr('data-title');
      if (value) out.push(value.trim());
    });
  });

  return out;
}

function scoreRows(rows) {
  return rows
    .map(row => ({
      ...row,
      score: row.mentions * 2 + row.maxConfidence + (row.mentions > 1 ? 0.6 : 0) + (row.sources.length > 1 ? 0.3 : 0)
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
    out.push({ item, price: 'n/a', mentions: 1, confidence: 0.5 });
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
    seen.add(item);
    selected.push({ item, price: 'n/a', mentions: row.mentions, confidence: row.maxConfidence });
    if (selected.length >= 10) break;
  }

  if (selected.length >= 2) {
    const fill = fallbackFor(retailerId).filter(x => !seen.has(x.item)).slice(0, 10 - selected.length);
    return [...selected, ...fill].slice(0, 10);
  }

  return fallbackFor(retailerId);
}

export function parseRetailerHtml(html, retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  const $ = cheerio.load(html || '');
  const rawCandidates = [
    ...collectSelectorTexts($, retailer.selectors),
    ...collectJsonLdNames($)
  ];

  const harmonized = scoreRows(harmonizeIngredients(rawCandidates).slice(0, 40));
  return finalizeSelection(harmonized, retailerId);
}

export async function crawlRetailer(retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  try {
    const response = await fetch(retailer.url, {
      headers: {
        'User-Agent': 'lekker-bot/1.4 (+swiss-retailer-harmonizer)',
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
