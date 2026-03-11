import { db } from '../core/db.js';

export const EXPECTED_RECIPE_PAIRS = [
  ['vegan', 'fruehstueck'],
  ['vegan', 'mittagessen'],
  ['vegan', 'abendessen'],
  ['vegan', 'snack'],
  ['vegan', 'drink'],
  ['omni', 'fruehstueck'],
  ['omni', 'mittagessen'],
  ['omni', 'abendessen'],
  ['omni', 'snack'],
  ['omni', 'drink']
];

export const EXPECTED_RECIPE_COUNT = EXPECTED_RECIPE_PAIRS.length;

function key(option, slot) {
  return `${option}:${slot}`;
}

export function getRecipeRows(menuId) {
  return db.prepare('SELECT * FROM recipes WHERE menu_id=? ORDER BY option_type, meal_slot').all(menuId);
}

export function getRecipeCount(menuId) {
  return db.prepare('SELECT COUNT(*) as c FROM recipes WHERE menu_id=?').get(menuId).c;
}

export function getRecipeLookup(menuId) {
  const rows = db.prepare('SELECT option_type, meal_slot FROM recipes WHERE menu_id=?').all(menuId);
  return new Set(rows.map(r => key(r.option_type, r.meal_slot)));
}

export function assertCompleteSet(recipes) {
  const keys = new Set(recipes.map(r => key(r.option_type, r.meal_slot)));
  const missing = EXPECTED_RECIPE_PAIRS
    .map(([option, slot]) => key(option, slot))
    .filter(k => !keys.has(k));

  if (missing.length > 0) {
    throw new Error(`Recipe integrity check failed. Missing slots: ${missing.join(', ')}`);
  }

  return {
    expected: EXPECTED_RECIPE_COUNT,
    actual: recipes.length,
    missing
  };
}

export function hasCompleteSet(menuId) {
  const rows = db.prepare('SELECT option_type, meal_slot FROM recipes WHERE menu_id=?').all(menuId);
  try {
    assertCompleteSet(rows);
    return true;
  } catch {
    return false;
  }
}
