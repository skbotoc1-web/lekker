import { db } from '../core/db.js';
import { estimateDishCo2 } from '../data/co2Factors.js';

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

function scoreDishByOffers(dish, offersText) {
  return dish.keywords.reduce((score, kw) => (offersText.includes(kw) ? score + 1 : score), 0);
}

function pickCandidate(candidates, recentMenusJoined, offersText) {
  const ranked = candidates
    .map(c => ({
      ...c,
      offerScore: scoreDishByOffers(c, offersText),
      repeated: recentMenusJoined.includes(c.name.toLowerCase())
    }))
    .sort((a, b) => {
      if (a.repeated !== b.repeated) return a.repeated ? 1 : -1;
      if (a.offerScore !== b.offerScore) return b.offerScore - a.offerScore;
      return 0;
    });

  return ranked[0].name;
}

export function createDailyMenu(day) {
  const recentRows = db.prepare('SELECT * FROM menus ORDER BY day DESC LIMIT 10').all();
  const recentText = JSON.stringify(recentRows).toLowerCase();

  const todayOffers = db.prepare('SELECT item FROM clustered_offers WHERE day = ?').all(day);
  const offersText = todayOffers.map(x => String(x.item || '').toLowerCase()).join(' | ');

  const veganBreakfast = pickCandidate(VEGAN_LIBRARY.fruehstueck, recentText, offersText);
  const veganLunch = pickCandidate(VEGAN_LIBRARY.mittagessen, recentText, offersText);
  const veganDinner = pickCandidate(VEGAN_LIBRARY.abendessen, recentText, offersText);
  const veganSnack = pickCandidate(VEGAN_LIBRARY.snack, recentText, offersText);
  const veganDrink = VEGAN_LIBRARY.drink[0].name;

  const omniBreakfast = pickCandidate(OMNI_LIBRARY.fruehstueck, recentText, offersText);
  const omniLunch = pickCandidate(OMNI_LIBRARY.mittagessen, recentText, offersText);
  const omniDinner = pickCandidate(OMNI_LIBRARY.abendessen, recentText, offersText);
  const omniSnack = pickCandidate(OMNI_LIBRARY.snack, recentText, offersText);
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
