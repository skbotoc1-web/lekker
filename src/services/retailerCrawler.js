import * as cheerio from 'cheerio';
import { harmonizeIngredients } from './ingredientNormalizer.js';

const retailers = [
  {
    id: 'migros',
    url: 'https://www.migros.ch/de/offers/home',
    selectors: ['[data-testid*="product"] h2', '[data-testid*="product"] h3', 'article h2', 'article h3', 'a[title]', 'h2', 'h3']
  },
  {
    id: 'coop',
    url: 'https://www.coop.ch/de/',
    selectors: ['[class*="product"] h2', '[class*="product"] h3', 'article h2', 'article h3', 'a[title]', 'h2', 'h3']
  },
  {
    id: 'aldi',
    url: 'https://www.aldi-suisse.ch/de/aktionen-und-angebote.html',
    selectors: ['[class*="offer"] h2', '[class*="offer"] h3', '[class*="product"] h2', '[class*="product"] h3', 'article h2', 'article h3', 'a[title]']
  },
  {
    id: 'lidl',
    url: 'https://www.lidl.ch/',
    selectors: ['[class*="product"] h2', '[class*="product"] h3', '[class*="offer"] h2', '[class*="offer"] h3', 'article h2', 'article h3', 'a[title]']
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
    });
  }
  return out;
}

export function parseRetailerHtml(html, retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  const $ = cheerio.load(html || '');
  const rawCandidates = [
    ...collectSelectorTexts($, retailer.selectors),
    ...collectJsonLdNames($)
  ];

  const harmonized = harmonizeIngredients(rawCandidates)
    .slice(0, 16)
    .map(x => ({ item: x.canonical, price: 'n/a', mentions: x.mentions, confidence: x.maxConfidence }));

  if (harmonized.length >= 10) return harmonized.slice(0, 10);

  const fill = fallbackItems[retailerId]
    .filter(item => !harmonized.some(h => h.item === item))
    .slice(0, 10 - harmonized.length)
    .map(item => ({ item, price: 'n/a', mentions: 1, confidence: 0.5 }));

  return [...harmonized, ...fill].slice(0, 10);
}

export async function crawlRetailer(retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  try {
    const response = await fetch(retailer.url, {
      headers: {
        'User-Agent': 'lekker-bot/1.2 (+ingredient-harmonizer)'
      }
    });

    if (!response.ok) {
      return fallbackItems[retailerId].map(item => ({ item, price: 'n/a', mentions: 1, confidence: 0.5 }));
    }

    const html = await response.text();
    return parseRetailerHtml(html, retailerId);
  } catch {
    return fallbackItems[retailerId].map(item => ({ item, price: 'n/a', mentions: 1, confidence: 0.5 }));
  }
}

export function getRetailers() {
  return retailers;
}
