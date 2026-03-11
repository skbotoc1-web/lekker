import { normalizeIngredient } from './ingredientNormalizer.js';

// Lightweight embedding fallback (hash-embedding) for deterministic semantic grouping.

function hash(str) {
  let h = 2166136261;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h += (h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24);
  }
  return Math.abs(h >>> 0);
}

export function embed(text, dim = 64) {
  const vec = new Array(dim).fill(0);
  const clean = text.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ');
  const grams = clean.split(/\s+/).filter(Boolean);
  for (const token of grams) {
    const idx = hash(token) % dim;
    vec[idx] += 1;
  }
  const norm = Math.sqrt(vec.reduce((s, v) => s + v * v, 0)) || 1;
  return vec.map(v => v / norm);
}

export function cosine(a, b) {
  return a.reduce((s, v, i) => s + v * b[i], 0);
}

function normalizeText(t) {
  return String(t || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function inferCategory(name, hint) {
  if (hint) return hint;

  const t = normalizeText(name);
  if (/hafer|skyr|joghurt|brot|beeren|bananen|apfel|birnen|muesli/.test(t)) return 'fruehstueck';
  if (/nuss|mandeln|riegel|snack/.test(t)) return 'snack';
  if (/fisch|forelle|lachs|poulet|rind|pasta|reis|curry|eintopf|suppe|kartoffeln/.test(t)) return 'abendessen';
  return 'mittagessen';
}

export function clusterOffers(items) {
  return items.map(item => {
    const normalized = normalizeIngredient(item.item);
    const canonical = normalized?.canonical || item.item;
    const category = inferCategory(canonical, normalized?.categoryHint || null);
    const vegan = normalized?.veganLikely == null ? 0 : (normalized.veganLikely ? 1 : 0);

    return {
      ...item,
      item: canonical,
      category,
      vegan,
      confidence: normalized?.confidence ?? 0.5
    };
  });
}
