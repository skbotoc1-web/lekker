import { db } from '../core/db.js';
import { estimateDishCo2 } from '../data/co2Factors.js';
import { canonicalToken, ingredientCategory, normalizeIngredient } from './ingredientNormalizer.js';

const VEGAN_LIBRARY = {
  fruehstueck: [
    { name: 'Protein-Porridge mit Beeren', keywords: ['haferflocken', 'beeren', 'bananen'] },
    { name: 'Tofu-Rührei mit Vollkorntoast', keywords: ['tofu', 'tomaten', 'brot'] },
    { name: 'Soja-Joghurt-Bowl mit Nüssen', keywords: ['sojadrink', 'nüsse', 'äpfel'] }
  ],
  mittagessen: [
    { name: 'Linsen-Bowl mit Quinoa und Ofengemüse', keywords: ['linsen', 'quinoa', 'brokkoli', 'peperoni'] },
    { name: 'Kichererbsen-Curry mit Naturreis', keywords: ['kichererbsen', 'reis', 'spinat'] },
    { name: 'Tofu-Stir-Fry mit Broccoli', keywords: ['tofu', 'brokkoli', 'zucchini'] }
  ],
  abendessen: [
    { name: 'Bohnen-Chili mit Mais und Avocado', keywords: ['bohnen', 'tomaten', 'peperoni'] },
    { name: 'Vollkornpasta mit Linsen-Bolognese', keywords: ['vollkornpasta', 'linsen', 'tomaten'] },
    { name: 'Süsskartoffel-Tofu-Blech', keywords: ['süsskartoffeln', 'tofu', 'brokkoli'] }
  ],
  snack: [
    { name: 'Nussmix mit Apfel', keywords: ['nüsse', 'äpfel', 'birnen'] },
    { name: 'Hummus mit Gemüsesticks', keywords: ['kichererbsen', 'karotten', 'gurken'] },
    { name: 'Protein-Smoothie', keywords: ['bananen', 'beeren', 'haferdrink'] }
  ],
  drink: [
    { name: 'Infused Water Zitrone-Minze', keywords: [] },
    { name: 'Ungesüsster Eistee', keywords: [] },
    { name: 'Wasser mit Beeren', keywords: ['beeren'] }
  ]
};

const OMNI_LIBRARY = {
  fruehstueck: [
    { name: 'Skyr-Bowl mit Hafer und Früchten', keywords: ['skyr', 'haferflocken', 'beeren'] },
    { name: 'Eiermuffins mit Spinat', keywords: ['eier', 'spinat'] },
    { name: 'Hüttenkäse-Brot mit Tomaten', keywords: ['käse', 'tomaten', 'brot'] }
  ],
  mittagessen: [
    { name: 'Poulet-Quinoa-Salat', keywords: ['pouletbrust', 'quinoa', 'gurken', 'tomaten'] },
    { name: 'Lachs mit Kartoffeln und Gemüse', keywords: ['lachs', 'kartoffeln', 'brokkoli'] },
    { name: 'Rindstreifen mit Vollkornreis', keywords: ['rindfleisch', 'reis', 'peperoni'] }
  ],
  abendessen: [
    { name: 'Forelle mit Ofengemüse', keywords: ['forelle', 'zucchini', 'kartoffeln'] },
    { name: 'Pouletpfanne mit Bohnen', keywords: ['pouletbrust', 'bohnen', 'tomaten'] },
    { name: 'Protein-Pasta mit Thunfisch', keywords: ['vollkornpasta', 'thunfisch', 'tomaten'] }
  ],
  snack: [
    { name: 'Skyr mit Nüssen', keywords: ['skyr', 'nüsse'] },
    { name: 'Kefir-Shake', keywords: ['kefir', 'bananen'] },
    { name: 'Käsewürfel und Birne', keywords: ['käse', 'birnen'] }
  ],
  drink: [
    { name: 'Wasser mit Limette', keywords: [] },
    { name: 'Hausgemachter Eistee', keywords: [] },
    { name: 'Mineralwasser', keywords: [] }
  ]
};

const PROTEIN_KEYS = new Set(['tofu', 'kichererbsen', 'linsen', 'bohnen', 'skyr', 'eier', 'pouletbrust', 'lachs', 'forelle', 'thunfisch', 'rindfleisch']);

function fold(input) {
  return String(input || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();
}

function norm(value) {
  return canonicalToken(fold(value).replace(/[^a-z]/g, ''));
}

function scoreDishByOffers(dish, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, slot, optionType) {
  let matchedKeywords = 0;

  const keywordScore = dish.keywords.reduce((score, kw) => {
    const key = norm(kw);
    const direct = offerIndex.get(key) || 0;
    let fuzzy = 0;
    let fuzzyRetailers = 0;
    for (const [offerKey, count] of offerIndex.entries()) {
      if (offerKey.includes(key) || key.includes(offerKey)) {
        fuzzy = Math.max(fuzzy, count * 0.55);
        fuzzyRetailers = Math.max(fuzzyRetailers, retailerDiversityByKey.get(offerKey) || 0);
      }
    }

    const base = direct + fuzzy;
    if (base > 0.2) matchedKeywords += 1;

    const proteinBoost = PROTEIN_KEYS.has(key) ? 1.4 : 1;
    const dinnerProteinBoost = slot === 'abendessen' && PROTEIN_KEYS.has(key) ? 1.2 : 1;
    const normalizedKeyword = normalizeIngredient(kw);
    const taxonomy = normalizedKeyword?.taxonomy || ingredientCategory(kw.charAt(0).toUpperCase() + kw.slice(1));
    const taxonomyPresence = categoryIndex.get(taxonomy) || 0;
    const categoryBoost = taxonomyPresence > 0 ? 1.12 + Math.min(0.1, taxonomyPresence * 0.02) : 1;
    const retailerSpread = Math.max(retailerDiversityByKey.get(key) || 0, fuzzyRetailers);
    const diversityBoost = 1 + Math.min(0.18, retailerSpread * 0.06);

    return score + (base * proteinBoost * dinnerProteinBoost * categoryBoost * diversityBoost);
  }, 0);

  const coverage = dish.keywords.length ? matchedKeywords / dish.keywords.length : 0;
  const coverageBoost = coverage * 1.8;
  const weakCoveragePenalty = dish.keywords.length >= 2 && coverage < 0.34 ? -0.55 : 0;

  const slotBoost = slotSignals.get(`${slot}:${optionType}`) || 0;
  const neutralSlotBoost = slotSignals.get(`${slot}:any`) || 0;
  return keywordScore + coverageBoost + weakCoveragePenalty + (slotBoost * 0.9) + (neutralSlotBoost * 0.35);
}

function buildOfferIndex(day) {
  const todayOffers = db.prepare('SELECT item, category, vegan, source_retailer FROM clustered_offers WHERE day = ?').all(day);
  const idx = new Map();
  const cat = new Map();
  const slotSignals = new Map();
  const retailerSpread = new Map();

  for (const row of todayOffers) {
    const normalizedRow = normalizeIngredient(row.item);
    const canonicalItem = normalizedRow?.canonical || row.item;
    const key = norm(canonicalItem);
    if (!key) continue;
    idx.set(key, (idx.get(key) || 0) + 1);
    const taxonomy = ingredientCategory(canonicalItem);
    cat.set(taxonomy, (cat.get(taxonomy) || 0) + 1);

    const retailerSet = retailerSpread.get(key) || new Set();
    retailerSet.add(row.source_retailer || 'unknown');
    retailerSpread.set(key, retailerSet);

    const slot = row.category || 'other';
    slotSignals.set(`${slot}:any`, (slotSignals.get(`${slot}:any`) || 0) + 1);
    const optionKey = Number(row.vegan) === 1 ? 'vegan' : 'omni';
    slotSignals.set(`${slot}:${optionKey}`, (slotSignals.get(`${slot}:${optionKey}`) || 0) + 1);
  }

  const retailerDiversityByKey = new Map([...retailerSpread.entries()].map(([k, set]) => [k, set.size]));
  return { idx, cat, slotSignals, retailerDiversityByKey };
}

function pickCandidate(candidates, recentMenusJoined, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, slot, optionType) {
  const ranked = candidates
    .map(c => ({
      ...c,
      offerScore: scoreDishByOffers(c, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, slot, optionType),
      repeated: recentMenusJoined.includes(c.name.toLowerCase())
    }))
    .sort((a, b) => {
      if (a.repeated !== b.repeated) return a.repeated ? 1 : -1;
      if (a.offerScore !== b.offerScore) return b.offerScore - a.offerScore;
      return a.name.localeCompare(b.name, 'de-CH');
    });

  return ranked[0].name;
}

export function createDailyMenu(day) {
  const recentRows = db.prepare('SELECT * FROM menus ORDER BY day DESC LIMIT 10').all();
  const recentText = JSON.stringify(recentRows).toLowerCase();
  const { idx: offerIndex, cat: categoryIndex, slotSignals, retailerDiversityByKey } = buildOfferIndex(day);

  const veganBreakfast = pickCandidate(VEGAN_LIBRARY.fruehstueck, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, 'fruehstueck', 'vegan');
  const veganLunch = pickCandidate(VEGAN_LIBRARY.mittagessen, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, 'mittagessen', 'vegan');
  const veganDinner = pickCandidate(VEGAN_LIBRARY.abendessen, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, 'abendessen', 'vegan');
  const veganSnack = pickCandidate(VEGAN_LIBRARY.snack, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, 'snack', 'vegan');
  const veganDrink = VEGAN_LIBRARY.drink[0].name;

  const omniBreakfast = pickCandidate(OMNI_LIBRARY.fruehstueck, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, 'fruehstueck', 'omni');
  const omniLunch = pickCandidate(OMNI_LIBRARY.mittagessen, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, 'mittagessen', 'omni');
  const omniDinner = pickCandidate(OMNI_LIBRARY.abendessen, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, 'abendessen', 'omni');
  const omniSnack = pickCandidate(OMNI_LIBRARY.snack, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, 'snack', 'omni');
  const omniDrink = OMNI_LIBRARY.drink[0].name;

  const dishes = [veganBreakfast, veganLunch, veganDinner, omniBreakfast, omniLunch, omniDinner];
  const co2Score = Number((dishes.reduce((s, d) => s + estimateDishCo2(d), 0) / dishes.length).toFixed(2));

  const stmt = db.prepare(`
    INSERT INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(day) DO UPDATE SET
      vegan_breakfast=excluded.vegan_breakfast,
      vegan_lunch=excluded.vegan_lunch,
      vegan_dinner=excluded.vegan_dinner,
      vegan_snack=excluded.vegan_snack,
      vegan_drink=excluded.vegan_drink,
      omni_breakfast=excluded.omni_breakfast,
      omni_lunch=excluded.omni_lunch,
      omni_dinner=excluded.omni_dinner,
      omni_snack=excluded.omni_snack,
      omni_drink=excluded.omni_drink,
      co2_score=excluded.co2_score
  `);

  stmt.run(
    day,
    veganBreakfast,
    veganLunch,
    veganDinner,
    veganSnack,
    veganDrink,
    omniBreakfast,
    omniLunch,
    omniDinner,
    omniSnack,
    omniDrink,
    co2Score,
    new Date().toISOString()
  );

  return db.prepare('SELECT * FROM menus WHERE day = ?').get(day);
}
