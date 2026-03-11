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
      'article h2',
      'article h3',
      'a[title]'
    ]
  }
];

const fallbackItems = {
  migros: ['Brokkoli', 'Haferflocken', 'Tofu', 'Kichererbsen', 'Äpfel', 'Karotten', 'Vollkornbrot', 'Naturjoghurt', 'Lachs', 'Pouletbrust'],
  coop: ['Spinat', 'Bananen', 'Linsen', 'Nüsse', 'Quinoa', 'Tomaten', 'Eier', 'Skyr', 'Rindfleisch', 'Reis'],
  aldi: ['Peperoni', 'Zucchini', 'Kartoffeln', 'Bohnen', 'Sojadrink', 'Beeren', 'Vollkornpasta', 'Käse', 'Thunfisch', 'Pouletbrust'],
  lidl: ['Brokkoli', 'Pilze', 'Süsskartoffeln', 'Haferdrink', 'Mandeln', 'Birnen', 'Skyr', 'Feta', 'Forelle', 'Rindfleisch']
};

function collectJsonLdNames($) {
  const names = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw) return;

    try {
      const parsed = JSON.parse(raw);
      const arr = Array.isArray(parsed) ? parsed : [parsed];
      for (const node of arr) {
        if (node?.name && typeof node.name === 'string') names.push(node.name);
        if (node?.item?.name) names.push(String(node.item.name));
        if (Array.isArray(node?.itemListElement)) {
          for (const entry of node.itemListElement) {
            const n = entry?.name || entry?.item?.name;
            if (typeof n === 'string') names.push(n);
          }
        }
      }
    } catch {
      // ignore malformed json-ld
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
      const dataName = $(el).attr('data-product-name');
      if (dataName) out.push(dataName.trim());
    });
  }
  return out;
}

function scoreRows(rows) {
  return rows
    .map(row => ({
      ...row,
      score: row.mentions * 2 + row.confidence + (row.mentions > 1 ? 0.6 : 0)
    }))
    .sort((a, b) => b.score - a.score);
}

function fallbackFor(retailerId) {
  return fallbackItems[retailerId].map(item => ({ item, price: 'n/a', mentions: 1, confidence: 0.5 }));
}

export function parseRetailerHtml(html, retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  const $ = cheerio.load(html || '');
  const rawCandidates = [
    ...collectSelectorTexts($, retailer.selectors),
    ...collectJsonLdNames($)
  ];

  const harmonized = scoreRows(harmonizeIngredients(rawCandidates)
    .slice(0, 30)
    .map(x => ({ item: x.canonical, price: 'n/a', mentions: x.mentions, confidence: x.maxConfidence }))
  );

  const selected = [];
  const seen = new Set();
  for (const row of harmonized) {
    if (seen.has(row.item)) continue;
    seen.add(row.item);
    selected.push(row);
    if (selected.length >= 10) break;
  }

  if (selected.length >= 8) return selected.slice(0, 10);

  const fill = fallbackItems[retailerId]
    .filter(item => !seen.has(item))
    .slice(0, 10 - selected.length)
    .map(item => ({ item, price: 'n/a', mentions: 1, confidence: 0.5 }));

  return [...selected, ...fill].slice(0, 10);
}

export async function crawlRetailer(retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  try {
    const response = await fetch(retailer.url, {
      headers: {
        'User-Agent': 'lekker-bot/1.3 (+swiss-retailer-harmonizer)',
        'Accept-Language': 'de-CH,de;q=0.9'
      }
    });

    if (!response.ok) return fallbackFor(retailerId);

    const html = await response.text();
    const parsed = parseRetailerHtml(html, retailerId);
    if (parsed.length < 8) return fallbackFor(retailerId);
    return parsed;
  } catch {
    return fallbackFor(retailerId);
  }
}

export function getRetailers() {
  return retailers;
}
