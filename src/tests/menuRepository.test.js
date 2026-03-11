import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { EXPECTED_RECIPE_PAIRS } from '../repositories/recipeRepository.js';
import { getDisplayMenu, getTodayMenuState } from '../repositories/menuRepository.js';

migrate();

function insertMenu(day, status = 'draft') {
  const stmt = db.prepare(`
    INSERT OR REPLACE INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, status, created_at
    ) VALUES (?, 'VB', 'VL', 'VD', 'VS', 'VG', 'OB', 'OL', 'OD', 'OS', 'OG', 1.9, ?, ?)
  `);
  stmt.run(day, status, new Date().toISOString());
  return db.prepare('SELECT id FROM menus WHERE day=?').get(day).id;
}

function insertCompleteRecipeSet(menuId) {
  const stmt = db.prepare('INSERT INTO recipes (menu_id, option_type, meal_slot, title, ingredients, steps, meta) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const [option, slot] of EXPECTED_RECIPE_PAIRS) {
    stmt.run(menuId, option, slot, `${option}-${slot}`, '[]', '[]', '{}');
  }
}

test('display menu falls back to latest complete when today is incomplete', () => {
  const completeDay = '2031-02-10';
  const incompleteDay = '2031-02-11';

  const completeMenuId = insertMenu(completeDay, 'published');
  insertCompleteRecipeSet(completeMenuId);
  insertMenu(incompleteDay, 'draft');

  const selected = getDisplayMenu({ today: incompleteDay });
  assert.equal(selected.mode, 'latest-complete');
  assert.equal(selected.menu.day, completeDay);
});

test('display menu returns today-complete when today has full recipe set', () => {
  const today = '2031-02-12';
  const menuId = insertMenu(today, 'published');
  insertCompleteRecipeSet(menuId);

  const selected = getDisplayMenu({ today });
  assert.equal(selected.mode, 'today-complete');
  assert.equal(selected.menu.day, today);
});

test('today menu state returns preparing when today exists but recipes are incomplete', () => {
  const today = '2031-02-13';
  insertMenu(today, 'draft');

  const state = getTodayMenuState({ today });
  assert.equal(state.state, 'preparing');
  assert.equal(state.day, today);
});
