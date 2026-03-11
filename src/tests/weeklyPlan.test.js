import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { computeRepetitionStats, getWeeklyPlan } from '../services/weeklyPlan.js';

migrate();

test('computeRepetitionStats detects repeated dishes', () => {
  const out = computeRepetitionStats([
    { vegan_breakfast: 'A', vegan_lunch: 'B', vegan_dinner: 'C', vegan_snack: 'D', vegan_drink: 'E', omni_breakfast: 'F', omni_lunch: 'G', omni_dinner: 'H', omni_snack: 'I', omni_drink: 'J' },
    { vegan_breakfast: 'A', vegan_lunch: 'B', vegan_dinner: 'X', vegan_snack: 'Y', vegan_drink: 'Z', omni_breakfast: 'F', omni_lunch: 'K', omni_dinner: 'L', omni_snack: 'M', omni_drink: 'N' }
  ]);

  assert.equal(out.repeatedDishCount >= 1, true);
  assert.equal(out.topRepeats[0].dish, 'A');
});

test('getWeeklyPlan returns bounded menu list and repetition object', () => {
  const day = `2099-01-${String(Math.floor(Math.random() * 9) + 1).padStart(2, '0')}`;
  db.prepare(`
    INSERT OR REPLACE INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, status, created_at
    ) VALUES (?, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 1.2, 'draft', ?)
  `).run(day, new Date().toISOString());

  const weekly = getWeeklyPlan(7);
  assert.equal(Array.isArray(weekly.menus), true);
  assert.equal(typeof weekly.repetition.uniqueDishCount, 'number');
});
