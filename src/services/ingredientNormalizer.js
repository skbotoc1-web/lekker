const STOPWORDS = [
  /\b(angebot|aktionen|rabatt|sparen|newsletter|konto|anmelden|registrieren|shop|home|mehr|jetzt|entdecken|zuruck|zurück)\b/i,
  /\b(rezept|rezepte|kategorie|kategorien|sortiment|wochenplan|wochenangebote|prospekt)\b/i,
  /\b(airfryer|app|abo|impressum|datenschutz|kontakt|video|news|cookie)\b/i,
  /\b(zum rezept|in den warenkorb|jetzt kaufen|mehr erfahren)\b/i
];

const RETAILER_NOISE = /\b(migros|coop|aldi|lidl|supermarkt|marktfrisch|aktionen)\b/i;
const NON_FOOD_HINTS = /\b(versicherung|konto|reisen|strom|handy|haushalt|deko|service|lieferung|abholung)\b/i;

const KNOWN_INGREDIENTS = [
  { re: /\bhafer[-\s]?(fl|)ocken?\b/i, canonical: 'Haferflocken', veganLikely: true, categoryHint: 'fruehstueck' },
  { re: /\bkicher[-\s]?erbsen|chickpeas?\b/i, canonical: 'Kichererbsen', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\blinsen?\b/i, canonical: 'Linsen', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\bbohnen?\b/i, canonical: 'Bohnen', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\btofu\b/i, canonical: 'Tofu', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\bquinoa\b/i, canonical: 'Quinoa', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\breis\b/i, canonical: 'Reis', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\b(vollkorn)?pasta|nudeln?\b/i, canonical: 'Vollkornpasta', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\bbrokkoli\b/i, canonical: 'Brokkoli', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\b(blatt)?spinat\b/i, canonical: 'Spinat', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\b(zucchini|zucchetti|courgette)\b/i, canonical: 'Zucchini', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\b(peperoni|paprika)\b/i, canonical: 'Peperoni', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\bkartoffeln?\b/i, canonical: 'Kartoffeln', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\bsuesskartoffeln?|susskartoffeln?\b/i, canonical: 'Süsskartoffeln', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\bkarotten?|moehren?|mohren?|ruebli\b/i, canonical: 'Karotten', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\b(cherry)?tomaten?\b/i, canonical: 'Tomaten', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\bgurken?\b/i, canonical: 'Gurken', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\baepfel|apfel\b/i, canonical: 'Äpfel', veganLikely: true, categoryHint: 'snack' },
  { re: /\bbirnen?|birne\b/i, canonical: 'Birnen', veganLikely: true, categoryHint: 'snack' },
  { re: /\bbeeren?\b/i, canonical: 'Beeren', veganLikely: true, categoryHint: 'fruehstueck' },
  { re: /\bbananen?|banane\b/i, canonical: 'Bananen', veganLikely: true, categoryHint: 'fruehstueck' },
  { re: /\bnuesse|nusse|mandeln?|walnuesse|walnusse\b/i, canonical: 'Nüsse', veganLikely: true, categoryHint: 'snack' },
  { re: /\bsoja(drink|milch)?\b/i, canonical: 'Sojadrink', veganLikely: true, categoryHint: 'fruehstueck' },
  { re: /\bhaferdrink\b/i, canonical: 'Haferdrink', veganLikely: true, categoryHint: 'fruehstueck' },
  { re: /\b(poulet(?:brust|filet|brustfilet)?|huhn|haehnchen|hahnchen)\b/i, canonical: 'Pouletbrust', veganLikely: false, categoryHint: 'abendessen' },
  { re: /\brind(?!en)|rinds|rindfleisch|rindshack\b/i, canonical: 'Rindfleisch', veganLikely: false, categoryHint: 'abendessen' },
  { re: /\blachs(?:filet)?\b/i, canonical: 'Lachs', veganLikely: false, categoryHint: 'abendessen' },
  { re: /\bforelle(?:nfilet|filet)?\b/i, canonical: 'Forelle', veganLikely: false, categoryHint: 'abendessen' },
  { re: /\bthunfisch(?:filet|steak)?\b/i, canonical: 'Thunfisch', veganLikely: false, categoryHint: 'abendessen' },
  { re: /\beier?|ei\b/i, canonical: 'Eier', veganLikely: false, categoryHint: 'fruehstueck' },
  { re: /\bskyr\b/i, canonical: 'Skyr', veganLikely: false, categoryHint: 'fruehstueck' },
  { re: /\bkefir\b/i, canonical: 'Naturjoghurt', veganLikely: false, categoryHint: 'fruehstueck' },
  { re: /\bjoghurt\b/i, canonical: 'Naturjoghurt', veganLikely: false, categoryHint: 'fruehstueck' },
  { re: /\b(kaese|käse|mozzarella|feta|huettenkaese|hüttenkäse)\b/i, canonical: 'Käse', veganLikely: false, categoryHint: 'snack' }
];

const SOFT_FOOD_HINTS = /\b(gemuese|gemüse|obst|salat|fruechte|früchte|brot|milch|drink|fisch|fleisch|protein|bio|frisch|filet|nature|natur)\b/i;

const TOKEN_SYNONYMS = new Map([
  ['zucchetti', 'zucchini'],
  ['courgette', 'zucchini'],
  ['paprika', 'peperoni'],
  ['pepperoni', 'peperoni'],
  ['moehren', 'karotten'],
  ['mohren', 'karotten'],
  ['ruebli', 'karotten'],
  ['apfel', 'aepfel'],
  ['birne', 'birnen'],
  ['mandeln', 'nuesse'],
  ['walnuesse', 'nuesse'],
  ['walnusse', 'nuesse'],
  ['huhn', 'pouletbrust'],
  ['haehnchen', 'pouletbrust'],
  ['hahnchen', 'pouletbrust'],
  ['chicken', 'pouletbrust'],
  ['rinds', 'rindfleisch'],
  ['rind', 'rindfleisch'],
  ['lachsfilet', 'lachs'],
  ['forellenfilet', 'forelle'],
  ['thunfischfilet', 'thunfisch'],
  ['thun', 'thunfisch'],
  ['pasta', 'vollkornpasta'],
  ['nudeln', 'vollkornpasta'],
  ['susskartoffeln', 'suesskartoffeln'],
  ['chickpeas', 'kichererbsen'],
  ['nature', 'natur'],
  ['natur', 'natur'],
  ['frisch', 'frisch'],
  ['bio', 'bio'],
  ['filet', 'filet'],
  ['brustfilet', 'pouletbrust'],
  ['rinderhack', 'rindfleisch'],
  ['rindshack', 'rindfleisch'],
  ['hackfleisch', 'rindfleisch'],
  ['thunfischsteak', 'thunfisch'],
  ['rindsentrecote', 'rindfleisch'],
  ['pouletgeschnetzeltes', 'pouletbrust'],
  ['huhnfilet', 'pouletbrust'],
  ['cherrytomaten', 'tomaten'],
  ['blattspinat', 'spinat'],
  ['veggiehack', 'linsen']
]);

export const INGREDIENT_TAXONOMY = {
  proteins: ['Tofu', 'Kichererbsen', 'Linsen', 'Bohnen', 'Skyr', 'Eier', 'Pouletbrust', 'Lachs', 'Forelle', 'Thunfisch', 'Rindfleisch'],
  carbs: ['Reis', 'Kartoffeln', 'Süsskartoffeln', 'Vollkornpasta', 'Haferflocken', 'Quinoa'],
  produce: ['Brokkoli', 'Spinat', 'Zucchini', 'Peperoni', 'Karotten', 'Tomaten', 'Gurken', 'Äpfel', 'Birnen', 'Beeren', 'Bananen'],
  dairyAndAlt: ['Naturjoghurt', 'Käse', 'Sojadrink', 'Haferdrink']
};

function fold(input) {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function sanitizeRaw(input) {
  return String(input || '')
    .replace(/\s+/g, ' ')
    .replace(/[\u00A0]/g, ' ')
    .trim();
}

function removeUnits(input) {
  return input
    .replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|mg|ml|l|cl|dl|stk|stuck|stück|pack|beutel|x|portion(?:en)?|bund|kopf|dose|glas|schale|becher|tranche|scheiben?)\b/g, ' ')
    .replace(/\b\d+\s*[x×]\s*\d+(?:[.,]\d+)?\b/g, ' ')
    .replace(/\b\d+er\b/g, ' ')
    .replace(/\b(ca\.?|ab|nur|statt|pro|per|je|nur heute|solange vorrat)\b/g, ' ')
    .replace(/\b(chf|fr\.?|preis|statt\s*chf\s*\d+(?:[.,]\d+)?)\b/g, ' ')
    .replace(/\b(kaliber|klasse|gr\.?|gross|klein|mittel|aktion|sonderpreis|promo|wochenhit)\b/g, ' ')
    .replace(/\b\d{1,3}%\b/g, ' ');
}

function cleanCandidate(original) {
  return original
    .replace(/[\/,;+]/g, ' ')
    .replace(/[|•·:;]+/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(Bio|Frisch|Aktion|Angebot|Regional|Schweiz|Schweizer|Suisse|Grand|XL|Mini|Natur|Nature|Top\s*Deal|Wochenhit)\b/gi, '')
    .replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|mg|ml|l|cl|dl)\b/gi, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function normalizeToken(token) {
  const t = fold(token).replace(/[^a-z]/g, '');
  return TOKEN_SYNONYMS.get(t) || t;
}

export function canonicalToken(value) {
  return normalizeToken(value);
}

export function canonicalIngredientName(raw) {
  const normalized = normalizeIngredient(raw);
  return normalized?.canonical || null;
}

export function ingredientCategory(canonical) {
  for (const [group, values] of Object.entries(INGREDIENT_TAXONOMY)) {
    if (values.includes(canonical)) return group;
  }
  return 'other';
}

export function normalizeIngredient(raw) {
  const original = sanitizeRaw(raw);
  if (!original) return null;
  if (original.length < 3 || original.length > 90) return null;

  const f = fold(original);
  if (/^[\d\W_]+$/.test(f)) return null;
  if (STOPWORDS.some(re => re.test(f)) || RETAILER_NOISE.test(f) || NON_FOOD_HINTS.test(f)) return null;

  const withoutUnits = removeUnits(f)
    .replace(/[^a-z\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  const compact = withoutUnits.replace(/[\s-]/g, '');

  for (const rule of KNOWN_INGREDIENTS) {
    if (rule.re.test(withoutUnits) || rule.re.test(compact)) {
      return {
        canonical: rule.canonical,
        source: original,
        veganLikely: rule.veganLikely,
        categoryHint: rule.categoryHint,
        taxonomy: ingredientCategory(rule.canonical),
        confidence: 0.96
      };
    }
  }

  if (!SOFT_FOOD_HINTS.test(withoutUnits)) return null;

  const candidate = cleanCandidate(original);
  if (candidate.length < 3 || candidate.length > 42) return null;

  return {
    canonical: candidate,
    source: original,
    veganLikely: null,
    categoryHint: null,
    taxonomy: 'other',
    confidence: 0.62
  };
}

export function harmonizeIngredients(rawItems = []) {
  const grouped = new Map();

  for (const raw of rawItems) {
    const n = normalizeIngredient(raw);
    if (!n) continue;

    if (!grouped.has(n.canonical)) {
      grouped.set(n.canonical, {
        canonical: n.canonical,
        sources: new Set([n.source]),
        mentions: 1,
        maxConfidence: n.confidence,
        veganLikely: n.veganLikely,
        categoryHint: n.categoryHint,
        taxonomy: n.taxonomy,
        token: canonicalToken(n.canonical)
      });
      continue;
    }

    const item = grouped.get(n.canonical);
    item.sources.add(n.source);
    item.mentions += 1;
    item.maxConfidence = Math.max(item.maxConfidence, n.confidence);
    if (item.veganLikely == null) item.veganLikely = n.veganLikely;
    if (!item.categoryHint) item.categoryHint = n.categoryHint;
  }

  return [...grouped.values()]
    .sort((a, b) => {
      const scoreA = a.mentions * 2 + a.maxConfidence;
      const scoreB = b.mentions * 2 + b.maxConfidence;
      return scoreB - scoreA;
    })
    .map(x => ({ ...x, sources: [...x.sources] }));
}

export function harmonizeRetailerIngredientMap(offersByRetailer = {}) {
  const out = {};

  for (const [retailer, rows] of Object.entries(offersByRetailer)) {
    for (const row of rows || []) {
      const raw = typeof row === 'string' ? row : (row?.item || row?.value || '');
      const canonical = canonicalIngredientName(raw);
      if (!canonical) continue;
      if (!out[canonical]) out[canonical] = { canonical, retailers: new Set(), mentions: 0, taxonomy: ingredientCategory(canonical) };
      out[canonical].retailers.add(retailer);
      out[canonical].mentions += 1;
    }
  }

  return Object.fromEntries(
    Object.entries(out)
      .map(([k, v]) => [k, { ...v, retailers: [...v.retailers].sort() }])
      .sort((a, b) => b[1].mentions - a[1].mentions)
  );
}

export function harmonizeIngredientCandidates(candidates = []) {
  const grouped = new Map();

  for (const candidate of candidates) {
    const raw = typeof candidate === 'string' ? candidate : candidate?.value;
    const sourceTag = typeof candidate === 'string' ? 'unknown' : (candidate?.sourceTag || 'unknown');
    const n = normalizeIngredient(raw);
    if (!n) continue;

    const key = n.canonical;
    const entry = grouped.get(key) || {
      canonical: n.canonical,
      token: canonicalToken(n.canonical),
      taxonomy: n.taxonomy,
      veganLikely: n.veganLikely,
      categoryHint: n.categoryHint,
      mentions: 0,
      maxConfidence: n.confidence,
      rawSources: new Set(),
      sourceTags: new Set()
    };

    entry.mentions += 1;
    entry.maxConfidence = Math.max(entry.maxConfidence, n.confidence);
    entry.rawSources.add(n.source);
    entry.sourceTags.add(sourceTag);
    if (entry.veganLikely == null) entry.veganLikely = n.veganLikely;
    if (!entry.categoryHint) entry.categoryHint = n.categoryHint;

    grouped.set(key, entry);
  }

  return [...grouped.values()]
    .map(x => ({ ...x, sources: [...x.rawSources], sourceTags: [...x.sourceTags] }))
    .sort((a, b) => {
      const scoreA = a.mentions * 2 + a.maxConfidence + a.sourceTags.length * 0.2;
      const scoreB = b.mentions * 2 + b.maxConfidence + b.sourceTags.length * 0.2;
      return scoreB - scoreA;
    });
}
