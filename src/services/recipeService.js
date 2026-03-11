import { db } from '../core/db.js';

function buildRecipe(title, vegan = false) {
  const protein = vegan ? 'Tofu/Linsen' : 'Poulet/Fisch';
  return {
    title,
    ingredients: JSON.stringify([
      `${protein} 200g`,
      'Saisonales Gemüse 300g',
      'Vollkorn-Beilage 150g',
      'Olivenöl',
      'Gewürze nach Geschmack'
    ]),
    steps: JSON.stringify([
      'Zutaten waschen und in mundgerechte Stücke schneiden.',
      'Proteinquelle bei mittlerer Hitze 6-8 Minuten anbraten.',
      'Gemüse hinzufügen und 5 Minuten garen.',
      'Beilage separat kochen und unterheben.',
      'Abschmecken und servieren.'
    ])
  };
}

export function generateRecipesForMenu(menu) {
  db.prepare('DELETE FROM recipes WHERE menu_id = ?').run(menu.id);

  const entries = [
    ['vegan', 'fruehstueck', menu.vegan_breakfast, true],
    ['vegan', 'mittagessen', menu.vegan_lunch, true],
    ['vegan', 'abendessen', menu.vegan_dinner, true],
    ['omni', 'fruehstueck', menu.omni_breakfast, false],
    ['omni', 'mittagessen', menu.omni_lunch, false],
    ['omni', 'abendessen', menu.omni_dinner, false]
  ];

  const stmt = db.prepare('INSERT INTO recipes (menu_id, option_type, meal_slot, title, ingredients, steps) VALUES (?, ?, ?, ?, ?, ?)');
  for (const [optionType, slot, title, vegan] of entries) {
    const recipe = buildRecipe(title, vegan);
    stmt.run(menu.id, optionType, slot, recipe.title, recipe.ingredients, recipe.steps);
  }

  return db.prepare('SELECT * FROM recipes WHERE menu_id = ?').all(menu.id);
}
