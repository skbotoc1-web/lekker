import * as cheerio from 'cheerio';
import { harmonizeIngredientCandidates } from './ingredientNormalizer.js';

const retailers = [
  {
    id: 'migros',
    url: 'https://www.migros.ch/de/offers/home',
    linkHints: ['/product/', '/produkt/', '/p/', '/offers/'],
    selectors: [
      '[data-testid*="product"] h2', '[data-testid*="product"] h3', '[data-testid*="offer"] h2',
      '[class*="product"] [class*="title"]', '[class*="offer"] [class*="title"]', '[class*="m-product"] [title]',
      '[class*="product"] [data-product-name]', '[class*="tile"] [aria-label]', '[class*="tile"] [data-title]',
      '[data-testid*="product"] [aria-label]', '[data-testid*="offer"] [aria-label]', '[class*="product-card"] [data-testid*="title"]',
      'article h2', 'article h3', 'a[href*="/produkt/"] [aria-label]',
      'a[title*="Bio"]', 'a[title]', '[data-product-name]', '[data-name]', '[data-title]', 'img[alt]', 'button[aria-label]'
    ]
  },
  {
    id: 'coop',
    url: 'https://www.coop.ch/de/',
    linkHints: ['/de/produkte/', '/de/aktionen/', '/p/'],
    selectors: [
      '[class*="product"] h2', '[class*="product"] h3', '[class*="tile"] [class*="headline"]',
      '[class*="teaser"] [class*="title"]', '[data-qa*="product"] [title]', '[data-qa*="product"] [aria-label]',
      '[class*="offer"] [data-name]', '[class*="article"] [title]', '[class*="product"] [data-name]', '[data-qa*="product"] [data-name]',
      'article h2', 'article h3', 'a[title]', 'a[href*="/produkte/"] [title]', '[data-product-name]', '[data-name]', '[data-title]', 'img[alt]', 'button[aria-label]'
    ]
  },
  {
    id: 'aldi',
    url: 'https://www.aldi-suisse.ch/de/aktionen-und-angebote.html',
    linkHints: ['/produkt/', '/angebote/', '/p/'],
    selectors: [
      '[class*="offer"] h2', '[class*="offer"] h3', '[class*="product"] h2', '[class*="product"] h3',
      '[class*="teaser"] [class*="title"]', '[class*="mod-offer"] [title]', '[class*="mod-offer"] [aria-label]',
      '[class*="mod-offer"] [data-title]', '[class*="product"] [data-name]', '[data-title]', '[data-testid*="product"] [title]',
      '[data-product-name]', '[data-name]', 'article h2', 'article h3', 'a[title]', 'a[href*="/angebote/"] [aria-label]', 'img[alt]', 'button[aria-label]'
    ]
  },
  {
    id: 'lidl',
    url: 'https://www.lidl.ch/',
    linkHints: ['/p/', '/produkt/', '/angebote/'],
    selectors: [
      '[class*="product"] h2', '[class*="product"] h3', '[class*="offer"] h2', '[class*="offer"] h3',
      '[class*="tile"] [class*="title"]', '[class*="product-grid"] [title]', '[class*="product-grid"] [aria-label]',
      '[class*="product-grid"] [data-title]', '[class*="product"] [data-name]', '[data-testid*="product"] [aria-label]',
      '[data-product-name]', '[data-name]', '[data-title]', 'article h2', 'article h3', 'a[title]', 'a[href*="/p/"] [title]', 'img[alt]', 'button[aria-label]'
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
const HEADING_NOISE = /\b(angebote|aktionen|shop|prospekt|newsletter|kundenkonto|entdecken|inspiration|menue|menu|rezepte|mehr anzeigen|alle anzeigen|zur kategorie|sale)\b/i;

function tryParseJson(raw) {
  try { return JSON.parse(raw); } catch { return null; }
}

function extractJsonNames(node, out = []) {
  if (!node) return out;
  if (Array.isArray(node)) return node.forEach(x => extractJsonNames(x, out)), out;
  if (typeof node !== 'object') return out;

  for (const key of ['name', 'title', 'headline']) {
    if (typeof node[key] === 'string') out.push(node[key]);
  }
  if (typeof node.description === 'string' && node.description.length < 80) out.push(node.description);

  for (const key of ['item', 'offers', 'itemListElement', 'mainEntity', 'about', 'hasPart', 'products', 'children']) {
    if (node[key]) extractJsonNames(node[key], out);
  }

  for (const value of Object.values(node)) {
    if (value && typeof value === 'object') extractJsonNames(value, out);
  }

  return out;
}

function collectJsonNames($) {
  const out = [];
  $('script[type="application/ld+json"], script#__NEXT_DATA__, script[type="application/json"]').each((_, el) => {
    const raw = $(el).text();
    if (!raw) return;
    const parsed = tryParseJson(raw);
    if (!parsed) return;
    const scriptId = $(el).attr('id') || '';
    const scriptType = $(el).attr('type') || 'application/json';
    const sourceTag = scriptId ? `${scriptType}#${scriptId}` : scriptType;

    const names = extractJsonNames(parsed, []);
    for (const name of names) out.push({ value: name, sourceTag });
  });
  return out;
}

function splitCandidateText(value) {
  return String(value || '')
    .split(/[|•·,;]|\s+-\s+|\s+\/\s+|\s+und\s+/gi)
    .map(x => x.trim())
    .filter(Boolean)
    .slice(0, 3);
}

function pushCandidate(out, value, sourceTag) {
  const chunks = splitCandidateText(value);
  for (const chunk of chunks) {
    const txt = String(chunk || '').trim();
    if (!txt || txt.length < 3 || txt.length > 90) continue;
    out.push({ value: txt, sourceTag });
  }
}

function collectSelectorCandidates($, selectors) {
  const out = [];
  for (const selector of selectors) {
    $(selector).each((_, el) => {
      const txt = $(el).text()?.trim();
      if (txt) pushCandidate(out, txt, `selector:${selector}`);
      const title = $(el).attr('title');
      const aria = $(el).attr('aria-label');
      const dataName = $(el).attr('data-product-name') || $(el).attr('data-name') || $(el).attr('data-title');
      if (title) pushCandidate(out, title, `attr:title:${selector}`);
      if (aria) pushCandidate(out, aria, `attr:aria:${selector}`);
      if (dataName) pushCandidate(out, dataName, `attr:data:${selector}`);
    });
  }
  return out;
}

function collectMetaCandidates($) {
  const out = [];
  $('meta[property="og:title"], meta[name="title"], meta[name="description"], meta[property="og:description"]').each((_, el) => {
    const content = $(el).attr('content');
    if (content) pushCandidate(out, content, `meta:${$(el).attr('property') || $(el).attr('name')}`);
  });
  return out;
}

function collectInlineScriptCandidates($) {
  const out = [];
  const nameRegex = /"(?:name|title|headline)"\s*:\s*"([^"\\]{3,90})"/g;

  $('script').each((_, el) => {
    const raw = $(el).html() || '';
    if (!raw || raw.length > 2_000_000) return;
    let match;
    let count = 0;
    while ((match = nameRegex.exec(raw)) && count < 60) {
      pushCandidate(out, match[1], 'script:regex-name');
      count += 1;
    }
  });

  return out;
}

function collectLinkCandidates($, linkHints = []) {
  const out = [];
  if (!linkHints.length) return out;

  $('a[href]').each((_, el) => {
    const href = String($(el).attr('href') || '').toLowerCase();
    if (!href) return;
    if (!linkHints.some(hint => href.includes(String(hint).toLowerCase()))) return;

    const txt = $(el).text()?.trim();
    const title = $(el).attr('title');
    const aria = $(el).attr('aria-label');
    if (txt) pushCandidate(out, txt, `link:text:${href.slice(0, 48)}`);
    if (title) pushCandidate(out, title, `link:title:${href.slice(0, 48)}`);
    if (aria) pushCandidate(out, aria, `link:aria:${href.slice(0, 48)}`);
  });

  return out;
}

function sourcePriority(sourceTag = '') {
  const lowered = String(sourceTag).toLowerCase();
  if (lowered.includes('__next_data__')) return 4;
  if (lowered.includes('ld+json')) return 3;
  if (lowered.includes('attr:data')) return 2;
  if (lowered.includes('link:title') || lowered.includes('link:aria')) return 1.75;
  if (lowered.includes('attr:title') || lowered.includes('attr:aria')) return 1.5;
  if (lowered.includes('link:text')) return 1.2;
  if (lowered.includes('selector')) return 1;
  if (lowered.includes('script:regex-name')) return 0.8;
  if (lowered.includes('meta:')) return 0.6;
  return 0;
}

function dedupeRawCandidates(items = []) {
  const grouped = new Map();

  for (const item of items) {
    const normalized = String(item.value || '')
      .toLowerCase()
      .replace(/[^\p{L}\p{N}]+/gu, ' ')
      .trim();
    if (!normalized || normalized.length < 3 || HEADING_NOISE.test(normalized)) continue;

    const current = grouped.get(normalized);
    if (!current || sourcePriority(item.sourceTag) > sourcePriority(current.sourceTag)) {
      grouped.set(normalized, item);
    }
  }

  return [...grouped.values()];
}

function sourceWeight(sourceTags = []) {
  let weight = 0;
  for (const source of sourceTags) {
    const lowered = String(source || '').toLowerCase();
    if (lowered.includes('ld+json') || lowered.includes('next_data') || lowered.includes('application/json')) weight += 0.25;
    else if (lowered.includes('attr:data')) weight += 0.15;
    else if (lowered.includes('attr:title') || lowered.includes('attr:aria')) weight += 0.12;
    else if (lowered.includes('selector')) weight += 0.08;
    else if (lowered.includes('script:regex-name')) weight += 0.06;
    else if (lowered.includes('meta:')) weight += 0.04;
  }
  return weight;
}

function scoreRows(rows) {
  return rows
    .map(row => ({
      ...row,
      score: row.mentions * 2 + row.maxConfidence + (row.mentions > 1 ? 0.6 : 0) + (row.sourceTags.length > 1 ? 0.35 : 0) + sourceWeight(row.sourceTags)
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
  const taxonomySeen = new Set();

  const strict = harmonized.filter(row => row.maxConfidence >= 0.58 || row.mentions >= 2);
  const relaxed = harmonized.filter(row => row.maxConfidence >= 0.52 || row.mentions >= 1);

  const ranked = [...strict, ...relaxed];

  for (const row of ranked) {
    const item = row.canonical;
    if (seen.has(item)) continue;
    const taxonomy = row.taxonomy || 'other';
    if (selected.length < 6 && taxonomySeen.has(taxonomy)) continue;
    seen.add(item);
    taxonomySeen.add(taxonomy);
    selected.push({ item, price: 'n/a', mentions: row.mentions, confidence: row.maxConfidence, source: 'parsed' });
    if (selected.length >= 10) break;
  }

  for (const row of ranked) {
    const item = row.canonical;
    if (seen.has(item)) continue;
    seen.add(item);
    selected.push({ item, price: 'n/a', mentions: row.mentions, confidence: row.maxConfidence, source: 'parsed' });
    if (selected.length >= 10) break;
  }

  if (!selected.length) return fallbackFor(retailerId);

  const fill = fallbackFor(retailerId).filter(x => !seen.has(x.item)).slice(0, Math.max(0, 10 - selected.length));
  return [...selected, ...fill].slice(0, 10);
}

function validateParsedOffers(rows, retailerId) {
  const unique = [];
  const seen = new Set();
  for (const row of rows || []) {
    const item = String(row?.item || '').trim();
    if (!item || seen.has(item)) continue;
    seen.add(item);
    unique.push({
      item,
      price: row?.price || 'n/a',
      mentions: Number(row?.mentions || 1),
      confidence: Number.isFinite(row?.confidence) ? row.confidence : 0.5,
      source: row?.source || 'parsed'
    });
  }

  const clipped = unique.slice(0, 10);
  if (clipped.length === 10) return clipped;

  const filler = fallbackFor(retailerId).filter(x => !seen.has(x.item)).slice(0, 10 - clipped.length);
  return [...clipped, ...filler].slice(0, 10);
}

export function parseRetailerHtml(html, retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  const $ = cheerio.load(html || '');
  const jsonCandidates = collectJsonNames($);
  const selectorCandidates = collectSelectorCandidates($, retailer.selectors);
  const linkCandidates = collectLinkCandidates($, retailer.linkHints || []);
  const metaCandidates = collectMetaCandidates($);
  const inlineScriptCandidates = collectInlineScriptCandidates($);
  const rawCandidates = dedupeRawCandidates([...selectorCandidates, ...jsonCandidates, ...linkCandidates, ...metaCandidates, ...inlineScriptCandidates]);

  const harmonized = scoreRows(harmonizeIngredientCandidates(rawCandidates).slice(0, 150));
  return validateParsedOffers(finalizeSelection(harmonized, retailerId), retailerId);
}

export async function crawlRetailer(retailerId) {
  const retailer = retailers.find(r => r.id === retailerId);
  if (!retailer) throw new Error(`Unknown retailer ${retailerId}`);

  try {
    const response = await fetch(retailer.url, {
      headers: {
        'User-Agent': 'lekker-bot/1.6 (+swiss-retailer-harmonizer)',
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
