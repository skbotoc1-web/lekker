import { db } from '../core/db.js';
import { estimateDishCo2 } from '../data/co2Factors.js';
import { canonicalToken, harmonizeRetailerIngredientMap, ingredientCategory, normalizeIngredient, normalizeIngredientMapping } from './ingredientNormalizer.js';

const VEGAN_LIBRARY = {
  fruehstueck: [
    { name: 'Protein-Porridge mit Beeren', keywords: ['haferflocken', 'beeren', 'bananen'] },
    { name: 'Tofu-Rührei mit Vollkorntoast', keywords: ['tofu', 'tomaten', 'brot'] },
    { name: 'Soja-Joghurt-Bowl mit Nüssen', keywords: ['sojadrink', 'nüsse', 'äpfel'] }
  ],
  mittagessen: [
    { name: 'Linsen-Bowl mit Quinoa und Ofengemüse', keywords: ['linsen', 'quinoa', 'brokkoli', 'peperoni'] },
    { name: 'Kichererbsen-Curry mit Naturreis', keywords: ['kichererbsen', 'reis', 'spinat'] },
    { name: 'Tofu-Stir-Fry mit Broccoli', keywords: ['tofu', 'brokkoli', 'zucchini'] },
    { name: 'Mediterrane Bohnenpfanne mit Bulgur', keywords: ['bohnen', 'tomaten', 'zucchini'] },
    { name: 'Thai-Tofu-Curry mit Jasminreis', keywords: ['tofu', 'reis', 'peperoni'] },
    { name: 'Kürbis-Kichererbsen-Eintopf', keywords: ['kichererbsen', 'kuerbis', 'karotten'] },
    { name: 'Vollkornwrap mit Linsenfüllung', keywords: ['linsen', 'tomaten', 'gurken'] },
    { name: 'Rote-Linsen-Dal mit Spinat', keywords: ['linsen', 'spinat', 'reis'] },
    { name: 'Ofenblumenkohl mit Tahini-Quinoa', keywords: ['blumenkohl', 'quinoa', 'kichererbsen'] },
    { name: 'Pilz-Gerste-Risotto', keywords: ['pilze', 'reis', 'spinat'] },
    { name: 'Falafel-Bowl mit Kräutersalat', keywords: ['kichererbsen', 'gurken', 'tomaten'] },
    { name: 'Veganes Pilz-Stroganoff mit Reis', keywords: ['pilze', 'reis', 'spinat'] }
  ],
  abendessen: [
    { name: 'Bohnen-Chili mit Mais und Avocado', keywords: ['bohnen', 'tomaten', 'peperoni'] },
    { name: 'Vollkornpasta mit Linsen-Bolognese', keywords: ['vollkornpasta', 'linsen', 'tomaten'] },
    { name: 'Süsskartoffel-Tofu-Blech', keywords: ['süsskartoffeln', 'tofu', 'brokkoli'] },
    { name: 'Auberginen-Curry mit Kichererbsen', keywords: ['auberginen', 'kichererbsen', 'tomaten'] },
    { name: 'Tofu-Satay mit Gemüse und Reis', keywords: ['tofu', 'reis', 'bohnen'] },
    { name: 'Gefüllte Peperoni mit Linsen', keywords: ['peperoni', 'linsen', 'tomaten'] },
    { name: 'Pilzragout mit Polenta', keywords: ['pilze', 'mais', 'spinat'] },
    { name: 'Kräuter-Kartoffelpfanne mit Bohnen', keywords: ['kartoffeln', 'bohnen', 'zucchini'] },
    { name: 'Spinat-Kichererbsen-Tajine', keywords: ['spinat', 'kichererbsen', 'tomaten'] },
    { name: 'Ofenkarotten mit Linsen-Dip', keywords: ['karotten', 'linsen', 'kichererbsen'] },
    { name: 'Kokos-Linsen-Curry mit Reis', keywords: ['linsen', 'reis', 'spinat'] },
    { name: 'Gemüse-Paella mit Kichererbsen', keywords: ['reis', 'kichererbsen', 'peperoni'] }
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
    { name: 'Rindstreifen mit Vollkornreis', keywords: ['rindfleisch', 'reis', 'peperoni'] },
    { name: 'Rindsragout mit Wurzelgemüse', keywords: ['rindfleisch', 'karotten', 'kartoffeln'] },
    { name: 'Poulet-Curry mit Basmatireis', keywords: ['pouletbrust', 'reis', 'spinat'] },
    { name: 'Forellen-Bowl mit Kräuterreis', keywords: ['forelle', 'reis', 'gurken'] },
    { name: 'Thunfisch-Reis-Salat', keywords: ['thunfisch', 'reis', 'tomaten'] },
    { name: 'Poulet-Wrap mit Gemüse', keywords: ['pouletbrust', 'tomaten', 'gurken'] },
    { name: 'Rindfleisch-Taco-Bowl', keywords: ['rindfleisch', 'peperoni', 'tomaten'] },
    { name: 'Eier-Quinoa-Salat', keywords: ['eier', 'quinoa', 'tomaten'] },
    { name: 'Lachs-Bulgur-Salat', keywords: ['lachs', 'bulgur', 'gurken'] },
    { name: 'Poulet mit Ofenkartoffeln und Kräutern', keywords: ['pouletbrust', 'kartoffeln', 'brokkoli'] }
  ],
  abendessen: [
    { name: 'Forelle mit Ofengemüse', keywords: ['forelle', 'zucchini', 'kartoffeln'] },
    { name: 'Pouletpfanne mit Bohnen', keywords: ['pouletbrust', 'bohnen', 'tomaten'] },
    { name: 'Protein-Pasta mit Thunfisch', keywords: ['vollkornpasta', 'thunfisch', 'tomaten'] },
    { name: 'Rinderhack-Pfanne mit Zucchetti', keywords: ['rindfleisch', 'zucchini', 'tomaten'] },
    { name: 'Lachs aus dem Ofen mit Dillkartoffeln', keywords: ['lachs', 'kartoffeln', 'dill'] },
    { name: 'Poulet-Cacciatore mit Gemüse', keywords: ['pouletbrust', 'tomaten', 'peperoni'] },
    { name: 'Forelle mit Kräuterpolenta', keywords: ['forelle', 'mais', 'spinat'] },
    { name: 'Rindsgeschnetzeltes mit Pilzen', keywords: ['rindfleisch', 'pilze', 'reis'] },
    { name: 'Thunfisch-Steak mit Bohnen', keywords: ['thunfisch', 'bohnen', 'tomaten'] },
    { name: 'Lachs-Teriyaki mit Brokkoli', keywords: ['lachs', 'brokkoli', 'reis'] },
    { name: 'Pouletbrust mit Zitronen-Risotto', keywords: ['pouletbrust', 'reis', 'zitrone'] },
    { name: 'Rinderfilet mit Ofenkarotten', keywords: ['rindfleisch', 'karotten', 'kartoffeln'] }
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

function extractDishNameSignals(name = '') {
  return String(name)
    .split(/[^\p{L}\p{N}]+/u)
    .map(x => normalizeIngredient(x)?.canonical)
    .filter(Boolean)
    .map(x => norm(x));
}

function parseDay(day) {
  const d = new Date(`${day}T00:00:00Z`);
  return Number.isNaN(d.getTime()) ? null : d;
}

function dayGap(targetDay, historicDay) {
  const target = parseDay(targetDay);
  const historic = parseDay(historicDay);
  if (!target || !historic) return null;
  const diff = Math.round((target.getTime() - historic.getTime()) / 86400000);
  return diff > 0 ? diff : null;
}

function dishThemes(name = '') {
  const text = fold(name);
  const themes = new Set();

  if (/pasta|spaghetti|penne|nudel/.test(text)) themes.add('pasta');
  if (/reis|risotto/.test(text)) themes.add('reis');
  if (/quinoa/.test(text)) themes.add('quinoa');
  if (/curry|masala/.test(text)) themes.add('curry');
  if (/bowl/.test(text)) themes.add('bowl');
  if (/pfanne|stir/.test(text)) themes.add('pfanne');
  if (/blech|ofen/.test(text)) themes.add('ofen');
  if (/salat/.test(text)) themes.add('salat');
  if (/smoothie|shake/.test(text)) themes.add('smoothie');
  if (/poulet|huhn/.test(text)) themes.add('protein:poulet');
  if (/rind|beef/.test(text)) themes.add('protein:rind');
  if (/lachs/.test(text)) themes.add('protein:lachs');
  if (/forelle/.test(text)) themes.add('protein:forelle');
  if (/thunfisch|fisch/.test(text)) themes.add('protein:fisch');
  if (/tofu/.test(text)) themes.add('protein:tofu');
  if (/linsen/.test(text)) themes.add('protein:linsen');

  return [...themes];
}

function buildVariationHistory(targetDay, recentRows) {
  const exactBySlot = new Map();
  const themeCount = new Map();
  const themeGap = new Map();

  const entriesFromMenu = (row) => [
    ['vegan', 'fruehstueck', row.vegan_breakfast],
    ['vegan', 'mittagessen', row.vegan_lunch],
    ['vegan', 'abendessen', row.vegan_dinner],
    ['vegan', 'snack', row.vegan_snack],
    ['omni', 'fruehstueck', row.omni_breakfast],
    ['omni', 'mittagessen', row.omni_lunch],
    ['omni', 'abendessen', row.omni_dinner],
    ['omni', 'snack', row.omni_snack]
  ];

  for (const row of recentRows) {
    const gap = dayGap(targetDay, row.day);
    if (!gap || gap > 10) continue;

    for (const [optionType, slot, dish] of entriesFromMenu(row)) {
      const dishKey = `${optionType}:${slot}:${fold(dish).trim()}`;
      const prevGap = exactBySlot.get(dishKey);
      exactBySlot.set(dishKey, prevGap ? Math.min(prevGap, gap) : gap);

      for (const theme of dishThemes(dish)) {
        const keys = [
          `${optionType}:${slot}:${theme}`,
          `${optionType}:all:${theme}`,
          `all:all:${theme}`
        ];

        for (const key of keys) {
          themeCount.set(key, (themeCount.get(key) || 0) + 1);
          const minGap = themeGap.get(key);
          themeGap.set(key, minGap ? Math.min(minGap, gap) : gap);
        }
      }
    }
  }

  return { exactBySlot, themeCount, themeGap };
}

function isExactDishBlocked(name, optionType, slot, history) {
  const dishKey = `${optionType}:${slot}:${fold(name).trim()}`;
  const exactGap = history.exactBySlot.get(dishKey);
  return Boolean(exactGap && exactGap <= 10);
}

function variationPenaltyForDish(name, optionType, slot, history) {
  let penalty = 0;
  for (const theme of dishThemes(name)) {
    const scopedCount = history.themeCount.get(`${optionType}:${slot}:${theme}`) || 0;
    const optionCount = history.themeCount.get(`${optionType}:all:${theme}`) || 0;
    const globalCount = history.themeCount.get(`all:all:${theme}`) || 0;

    penalty += scopedCount * 22;
    penalty += optionCount * 10;
    penalty += globalCount * 5;

    const scopedGap = history.themeGap.get(`${optionType}:${slot}:${theme}`);
    const globalGap = history.themeGap.get(`all:all:${theme}`);

    if (scopedGap && scopedGap <= 2) penalty += 160;
    if (theme === 'pasta' && globalGap && globalGap <= 2) penalty += 520;
  }

  return penalty;
}

function scoreDishByOffers(dish, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, slot, optionType, slotOfferIndex) {
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
    const consensusMentions = retailerConsensus.get(key) || 0;
    const consensusBoost = 1 + Math.min(0.16, consensusMentions * 0.04);

    return score + (base * proteinBoost * dinnerProteinBoost * categoryBoost * diversityBoost * consensusBoost);
  }, 0);

  const coverage = dish.keywords.length ? matchedKeywords / dish.keywords.length : 0;
  const coverageBoost = coverage * 1.8;
  const weakCoveragePenalty = dish.keywords.length >= 2 && coverage < 0.34 ? -0.55 : 0;

  const slotBoost = slotSignals.get(`${slot}:${optionType}`) || 0;
  const neutralSlotBoost = slotSignals.get(`${slot}:any`) || 0;

  const dishNameSignals = extractDishNameSignals(dish.name);
  const dishNameScore = dishNameSignals.reduce((acc, sig) => acc + Math.min(1.2, (offerIndex.get(sig) || 0) * 0.55), 0);

  const slotIndex = slotOfferIndex.get(slot) || new Map();
  const slotKeywordHits = dish.keywords.reduce((acc, kw) => acc + (slotIndex.get(norm(kw)) || 0), 0);
  const slotSpecificBoost = Math.min(1.4, slotKeywordHits * 0.45);

  return keywordScore + coverageBoost + weakCoveragePenalty + (slotBoost * 0.9) + (neutralSlotBoost * 0.35) + dishNameScore + slotSpecificBoost;
}

function buildOfferIndex(day) {
  const todayOffers = db.prepare('SELECT item, category, vegan, source_retailer FROM clustered_offers WHERE day = ?').all(day);
  const idx = new Map();
  const cat = new Map();
  const slotSignals = new Map();
  const retailerSpread = new Map();
  const slotOfferIndex = new Map();

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

    const slotMap = slotOfferIndex.get(slot) || new Map();
    slotMap.set(key, (slotMap.get(key) || 0) + 1);
    slotOfferIndex.set(slot, slotMap);
  }

  const retailerDiversityByKey = new Map([...retailerSpread.entries()].map(([k, set]) => [k, set.size]));
  const offersByRetailer = todayOffers.reduce((acc, row) => {
    const retailer = row.source_retailer || 'unknown';
    if (!acc[retailer]) acc[retailer] = [];
    acc[retailer].push({ item: row.item });
    return acc;
  }, {});

  const harmonized = harmonizeRetailerIngredientMap(offersByRetailer);
  const normalizedMap = normalizeIngredientMapping(todayOffers.map(row => row.item));
  const retailerConsensus = new Map(
    Object.values(harmonized)
      .map(row => [norm(row.canonical), row.mentions])
      .filter(([key]) => Boolean(key))
  );

  for (const row of normalizedMap) {
    const key = norm(row.canonical);
    retailerConsensus.set(key, Math.max(retailerConsensus.get(key) || 0, row.mentions));
  }

  return { idx, cat, slotSignals, retailerDiversityByKey, retailerConsensus, slotOfferIndex };
}

function pickCandidate(candidates, recentMenusJoined, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, slot, optionType, slotOfferIndex, variationHistory) {
  const scored = candidates
    .map(c => {
      const offerScore = scoreDishByOffers(c, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, slot, optionType, slotOfferIndex);
      const repeated = recentMenusJoined.includes(c.name.toLowerCase());
      const variationPenalty = variationPenaltyForDish(c.name, optionType, slot, variationHistory);
      const exactBlocked = isExactDishBlocked(c.name, optionType, slot, variationHistory);
      const totalScore = offerScore - variationPenalty - (repeated ? 250 : 0);

      return {
        ...c,
        offerScore,
        repeated,
        variationPenalty,
        exactBlocked,
        totalScore
      };
    });

  const pool = scored.some(x => !x.exactBlocked)
    ? scored.filter(x => !x.exactBlocked)
    : scored;

  const ranked = pool.sort((a, b) => {
    if (a.totalScore !== b.totalScore) return b.totalScore - a.totalScore;
    if (a.offerScore !== b.offerScore) return b.offerScore - a.offerScore;
    return a.name.localeCompare(b.name, 'de-CH');
  });

  return ranked[0].name;
}

function dishProteinToken(name = '') {
  const text = fold(name);
  if (text.includes('rind')) return 'rind';
  if (text.includes('poulet') || text.includes('huhn')) return 'poulet';
  if (text.includes('forelle')) return 'forelle';
  if (text.includes('lachs')) return 'lachs';
  if (text.includes('thunfisch') || text.includes('fisch')) return 'fisch';
  return 'other';
}

function isLandMeat(token) {
  return token === 'rind' || token === 'poulet';
}

function selectOmniDinnerWithConsistency(omniLunch, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, slotOfferIndex, variationHistory) {
  const defaultDinner = pickCandidate(OMNI_LIBRARY.abendessen, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'abendessen', 'omni', slotOfferIndex, variationHistory);

  const lunchProtein = dishProteinToken(omniLunch);
  const dinnerProtein = dishProteinToken(defaultDinner);

  if (!(isLandMeat(lunchProtein) && isLandMeat(dinnerProtein) && lunchProtein !== dinnerProtein)) {
    return defaultDinner;
  }

  const constrained = OMNI_LIBRARY.abendessen.filter(candidate => {
    const protein = dishProteinToken(candidate.name);
    return protein === lunchProtein || !isLandMeat(protein);
  });

  if (!constrained.length) return defaultDinner;
  return pickCandidate(constrained, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'abendessen', 'omni', slotOfferIndex, variationHistory);
}

export function createDailyMenu(day) {
  const recentRows = db.prepare('SELECT * FROM menus WHERE day < ? ORDER BY day DESC LIMIT 10').all(day);
  const recentText = JSON.stringify(recentRows).toLowerCase();
  const variationHistory = buildVariationHistory(day, recentRows);
  const { idx: offerIndex, cat: categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, slotOfferIndex } = buildOfferIndex(day);

  const veganBreakfast = pickCandidate(VEGAN_LIBRARY.fruehstueck, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'fruehstueck', 'vegan', slotOfferIndex, variationHistory);
  const veganLunch = pickCandidate(VEGAN_LIBRARY.mittagessen, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'mittagessen', 'vegan', slotOfferIndex, variationHistory);
  const veganDinner = pickCandidate(VEGAN_LIBRARY.abendessen, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'abendessen', 'vegan', slotOfferIndex, variationHistory);
  const veganSnack = pickCandidate(VEGAN_LIBRARY.snack, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'snack', 'vegan', slotOfferIndex, variationHistory);
  const veganDrink = VEGAN_LIBRARY.drink[0].name;

  const omniBreakfast = pickCandidate(OMNI_LIBRARY.fruehstueck, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'fruehstueck', 'omni', slotOfferIndex, variationHistory);
  const omniLunch = pickCandidate(OMNI_LIBRARY.mittagessen, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'mittagessen', 'omni', slotOfferIndex, variationHistory);
  const omniDinner = selectOmniDinnerWithConsistency(omniLunch, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, slotOfferIndex, variationHistory);
  const omniSnack = pickCandidate(OMNI_LIBRARY.snack, recentText, offerIndex, categoryIndex, slotSignals, retailerDiversityByKey, retailerConsensus, 'snack', 'omni', slotOfferIndex, variationHistory);
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
