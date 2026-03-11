import { db } from '../core/db.js';
import { estimateDishCo2 } from '../data/co2Factors.js';

const VEGAN_LIBRARY = {
  fruehstueck: ['Protein-Porridge mit Beeren', 'Tofu-Rührei mit Vollkorntoast', 'Soja-Joghurt-Bowl mit Nüssen'],
  mittagessen: ['Linsen-Bowl mit Quinoa und Ofengemüse', 'Kichererbsen-Curry mit Naturreis', 'Tofu-Stir-Fry mit Broccoli'],
  abendessen: ['Bohnen-Chili mit Mais und Avocado', 'Vollkornpasta mit Linsen-Bolognese', 'Süsskartoffel-Tofu-Blech'],
  snack: ['Nussmix mit Apfel', 'Hummus mit Gemüsesticks', 'Protein-Smoothie'],
  drink: ['Infused Water Zitrone-Minze', 'Ungesüsster Eistee', 'Wasser mit Beeren']
};

const OMNI_LIBRARY = {
  fruehstueck: ['Skyr-Bowl mit Hafer und Früchten', 'Eiermuffins mit Spinat', 'Hüttenkäse-Brot mit Tomaten'],
  mittagessen: ['Poulet-Quinoa-Salat', 'Lachs mit Kartoffeln und Gemüse', 'Rindstreifen mit Vollkornreis'],
  abendessen: ['Forelle mit Ofengemüse', 'Pouletpfanne mit Bohnen', 'Protein-Pasta mit Thunfisch'],
  snack: ['Skyr mit Nüssen', 'Kefir-Shake', 'Käsewürfel und Birne'],
  drink: ['Wasser mit Limette', 'Hausgemachter Eistee', 'Mineralwasser']
};

function pickWithoutRecent(candidates, recentMenusJoined) {
  const found = candidates.find(c => !recentMenusJoined.includes(c.toLowerCase()));
  return found || candidates[0];
}

export function createDailyMenu(day) {
  const recentRows = db.prepare('SELECT * FROM menus ORDER BY day DESC LIMIT 10').all();
  const recentText = JSON.stringify(recentRows).toLowerCase();

  const veganBreakfast = pickWithoutRecent(VEGAN_LIBRARY.fruehstueck, recentText);
  const veganLunch = pickWithoutRecent(VEGAN_LIBRARY.mittagessen, recentText);
  const veganDinner = pickWithoutRecent(VEGAN_LIBRARY.abendessen, recentText);
  const veganSnack = pickWithoutRecent(VEGAN_LIBRARY.snack, recentText);
  const veganDrink = VEGAN_LIBRARY.drink[0];

  const omniBreakfast = pickWithoutRecent(OMNI_LIBRARY.fruehstueck, recentText);
  const omniLunch = pickWithoutRecent(OMNI_LIBRARY.mittagessen, recentText);
  const omniDinner = pickWithoutRecent(OMNI_LIBRARY.abendessen, recentText);
  const omniSnack = pickWithoutRecent(OMNI_LIBRARY.snack, recentText);
  const omniDrink = OMNI_LIBRARY.drink[0];

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
