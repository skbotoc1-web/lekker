// Lightweight embedding fallback (hash-embedding) for deterministic semantic grouping.
// Can be replaced by OpenAI/Gemini embeddings via env flag in future.

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

export function clusterOffers(items) {
  const labels = ['fruehstueck', 'mittagessen', 'abendessen', 'snack'];
  return items.map(item => {
    const t = item.item.toLowerCase();
    let category = 'mittagessen';
    if (/muesli|joghurt|brot|hafer|banane|beeren/.test(t)) category = 'fruehstueck';
    else if (/nuss|riegel|apfel|birne/.test(t)) category = 'snack';
    else if (/suppe|salat|pasta|reis|curry/.test(t)) category = 'abendessen';
    return { ...item, category, vegan: /tofu|linsen|bohnen|hafer|gemuese|nuss/.test(t) ? 1 : 0, label: labels.indexOf(category) };
  });
}
