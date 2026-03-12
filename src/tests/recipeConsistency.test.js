import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { generateRecipesForMenu, repairLegacyRecipeSets } from '../services/recipeService.js';

migrate();

function resetData() {
  db.prepare('DELETE FROM approvals').run();
  db.prepare('DELETE FROM recipes').run();
  db.prepare('DELETE FROM menus').run();
}

function insertMenu(day, overrides = {}) {
  const payload = {
    vegan_breakfast: 'Tofu-Rührei mit Vollkorntoast',
    vegan_lunch: 'Linsen-Bowl mit Quinoa und Ofengemüse',
    vegan_dinner: 'Süsskartoffel-Tofu-Blech',
    vegan_snack: 'Hummus mit Gemüsesticks',
    vegan_drink: 'Infused Water Zitrone-Minze',
    omni_breakfast: 'Skyr-Bowl mit Hafer und Früchten',
    omni_lunch: 'Poulet-Quinoa-Salat',
    omni_dinner: 'Forelle mit Ofengemüse',
    omni_snack: 'Skyr mit Nüssen',
    omni_drink: 'Wasser mit Limette',
    ...overrides
  };

  db.prepare(`
    INSERT INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, status, created_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 2.0, 'draft', ?)
  `).run(
    day,
    payload.vegan_breakfast,
    payload.vegan_lunch,
    payload.vegan_dinner,
    payload.vegan_snack,
    payload.vegan_drink,
    payload.omni_breakfast,
    payload.omni_lunch,
    payload.omni_dinner,
    payload.omni_snack,
    payload.omni_drink,
    new Date().toISOString()
  );

  return db.prepare('SELECT * FROM menus WHERE day=?').get(day);
}

function flattenRecipe(recipe) {
  const meta = JSON.parse(recipe.meta || '{}');
  const ingredients = JSON.parse(recipe.ingredients || '[]');
  const steps = JSON.parse(recipe.steps || '[]');
  return {
    ...recipe,
    meta,
    ingredients,
    steps,
    text: `${recipe.title} ${meta.titleMarketing || ''} ${meta.subtitle || ''} ${ingredients.join(' ')} ${steps.join(' ')}`.toLowerCase()
  };
}

test('omni dinner with poulet title stays poulet-consistent and excludes fish proteins', () => {
  resetData();
  const menu = insertMenu('2099-12-25', { omni_dinner: 'Pouletpfanne mit Bohnen' });

  const rows = generateRecipesForMenu(menu).map(flattenRecipe);
  const dinner = rows.find(r => r.option_type === 'omni' && r.meal_slot === 'abendessen');

  assert.ok(dinner);
  assert.equal(dinner.meta.titleMarketing, 'Pouletpfanne mit Bohnen');
  assert.equal(/poulet|huhn/.test(dinner.text), true);
  assert.equal(/forelle|lachs|thunfisch/.test(dinner.text), false);
});

test('omni dinner with forelle title stays fish-consistent and excludes poultry proteins', () => {
  resetData();
  const menu = insertMenu('2099-12-26', { omni_dinner: 'Forelle mit Ofengemüse' });

  const rows = generateRecipesForMenu(menu).map(flattenRecipe);
  const dinner = rows.find(r => r.option_type === 'omni' && r.meal_slot === 'abendessen');

  assert.ok(dinner);
  assert.equal(dinner.meta.titleMarketing, 'Forelle mit Ofengemüse');
  assert.equal(/forelle|fisch/.test(dinner.text), true);
  assert.equal(/poulet|huhn|rind/.test(dinner.text), false);
});

test('omni lunch with lachs title uses lachs and excludes poulet', () => {
  resetData();
  const menu = insertMenu('2099-12-27', { omni_lunch: 'Lachs mit Kartoffeln und Gemüse' });

  const rows = generateRecipesForMenu(menu).map(flattenRecipe);
  const lunch = rows.find(r => r.option_type === 'omni' && r.meal_slot === 'mittagessen');

  assert.ok(lunch);
  assert.equal(lunch.meta.titleMarketing, 'Lachs mit Kartoffeln und Gemüse');
  assert.equal(/lachs|fisch/.test(lunch.text), true);
  assert.equal(/poulet|huhn/.test(lunch.text), false);
});

test('pouletpfanne enforces pan-technique and avoids oven wording', () => {
  resetData();
  const menu = insertMenu('2099-12-28', { omni_dinner: 'Pouletpfanne mit Bohnen' });

  const rows = generateRecipesForMenu(menu).map(flattenRecipe);
  const dinner = rows.find(r => r.option_type === 'omni' && r.meal_slot === 'abendessen');

  assert.ok(dinner);
  const stepsText = dinner.steps.join(' ').toLowerCase();
  assert.equal(stepsText.includes('pfanne'), true);
  assert.equal(stepsText.includes('backofen'), false);
  assert.equal(stepsText.includes('im ofen'), false);
});

test('protein-porridge uses cooking flow and not raw bowl-only wording', () => {
  resetData();
  const menu = insertMenu('2099-12-29', { vegan_breakfast: 'Protein-Porridge mit Beeren' });

  const rows = generateRecipesForMenu(menu).map(flattenRecipe);
  const breakfast = rows.find(r => r.option_type === 'vegan' && r.meal_slot === 'fruehstueck');

  assert.ok(breakfast);
  const stepsText = breakfast.steps.join(' ').toLowerCase();
  assert.equal(stepsText.includes('köcheln') || stepsText.includes('koecheln') || stepsText.includes('kochen'), true);
  assert.equal(/hafer/.test(breakfast.text), true);
});

test('boot repair regenerates legacy recipe sets with inconsistent titleMarketing', () => {
  resetData();
  const menu = insertMenu('2099-12-30', { omni_lunch: 'Poulet-Quinoa-Salat' });

  db.prepare('INSERT INTO recipes (menu_id, option_type, meal_slot, title, ingredients, steps, meta) VALUES (?, ?, ?, ?, ?, ?, ?)')
    .run(menu.id, 'omni', 'mittagessen', 'Poulet-Quinoa-Salat', JSON.stringify(['120 g Pouletbrust']), JSON.stringify(['Poulet anbraten.']), JSON.stringify({ titleMarketing: 'Quinoa-Garten mit Zitronen-Poulet', subtitle: 'Rindstreifen mit Vollkornreis' }));

  const report = repairLegacyRecipeSets();
  assert.equal(report.repaired, 1);

  const repairedRows = db.prepare('SELECT title, meta FROM recipes WHERE menu_id=?').all(menu.id);
  assert.equal(repairedRows.length, 10);

  for (const row of repairedRows) {
    const meta = JSON.parse(row.meta || '{}');
    assert.equal(meta.titleMarketing, row.title);
  }
});
