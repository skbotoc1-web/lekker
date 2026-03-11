const STOPWORDS = [
  /\b(angebot|aktionen|rabatt|sparen|newsletter|konto|anmelden|registrieren|shop|home|mehr|jetzt|entdecken|zuruck|zurück)\b/i,
  /\b(rezept|rezepte|kategorie|kategorien|sortiment|wochenplan|wochenangebote|prospekt)\b/i,
  /\b(airfryer|app|abo|impressum|datenschutz|kontakt|video|news|cookie)\b/i,
  /\b(zum rezept|in den warenkorb|jetzt kaufen|mehr erfahren)\b/i
];

const RETAILER_NOISE = /\b(migros|coop|aldi|lidl|supermarkt|marktfrisch|aktionen)\b/i;
const NON_FOOD_HINTS = /\b(versicherung|konto|reisen|strom|handy|haushalt|deko|service)\b/i;

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
  { re: /\bspinat\b/i, canonical: 'Spinat', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\bzucchini|zucchetti\b/i, canonical: 'Zucchini', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\b(peperoni|paprika)\b/i, canonical: 'Peperoni', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\bkartoffeln?\b/i, canonical: 'Kartoffeln', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\bsuesskartoffeln?|susskartoffeln?\b/i, canonical: 'Süsskartoffeln', veganLikely: true, categoryHint: 'abendessen' },
  { re: /\bkarotten?|moehren?|mohren?|ruebli\b/i, canonical: 'Karotten', veganLikely: true, categoryHint: 'mittagessen' },
  { re: /\btomaten?\b/i, canonical: 'Tomaten', veganLikely: true, categoryHint: 'mittagessen' },
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
  { re: /\bthunfisch(?:filet)?\b/i, canonical: 'Thunfisch', veganLikely: false, categoryHint: 'abendessen' },
  { re: /\beier?|ei\b/i, canonical: 'Eier', veganLikely: false, categoryHint: 'fruehstueck' },
  { re: /\bskyr\b/i, canonical: 'Skyr', veganLikely: false, categoryHint: 'fruehstueck' },
  { re: /\bjoghurt\b/i, canonical: 'Naturjoghurt', veganLikely: false, categoryHint: 'fruehstueck' },
  { re: /\b(kaese|käse|mozzarella|feta|huettenkaese|hüttenkäse)\b/i, canonical: 'Käse', veganLikely: false, categoryHint: 'snack' }
];

const SOFT_FOOD_HINTS = /\b(gemuese|gemüse|obst|salat|fruechte|früchte|brot|milch|drink|fisch|fleisch|protein|bio|frisch|filet)\b/i;

const TOKEN_SYNONYMS = new Map([
  ['zucchetti', 'zucchini'],
  ['paprika', 'peperoni'],
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
  ['rinds', 'rindfleisch'],
  ['pasta', 'vollkornpasta'],
  ['nudeln', 'vollkornpasta'],
  ['susskartoffeln', 'suesskartoffeln'],
  ['chickpeas', 'kichererbsen']
]);

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
    .replace(/\b\d+(?:[.,]\d+)?\s*(kg|g|mg|ml|l|cl|dl|stk|stuck|stück|pack|beutel|x|portion(?:en)?)\b/g, ' ')
    .replace(/\b\d+\s*[x×]\s*\d+(?:[.,]\d+)?\b/g, ' ')
    .replace(/\b(ca\.?|ab|nur|statt|pro|per)\b/g, ' ');
}

function cleanCandidate(original) {
  return original
    .replace(/[|•·:;]+/g, ' ')
    .replace(/\([^)]*\)/g, ' ')
    .replace(/\b(Bio|Frisch|Aktion|Angebot|Regional|Schweiz|Schweizer|Suisse|Grand|XL|Mini)\b/gi, '')
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
