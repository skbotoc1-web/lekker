import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeSlotMeta } from '../services/recipeMeta.js';

test('normalizeSlotMeta enforces strict drink bounds', () => {
  const out = normalizeSlotMeta({
    servings: 1,
    difficulty: 4,
    timeMin: 25,
    kcal: 180,
    co2Label: 'rot',
    titleMarketing: 'Drink',
    subtitle: 'x',
    tipsShopping: ['a good tip'],
    tipsCooking: ['another tip']
  }, 'drink');

  assert.equal(out.difficulty, 1);
  assert.equal(out.co2Label, 'grün');
  assert.equal(out.kcal <= 20, true);
  assert.equal(out.timeMin <= 8, true);
});

test('normalizeSlotMeta validates difficulty range', () => {
  assert.throws(() => normalizeSlotMeta({
    servings: 1,
    difficulty: 7,
    timeMin: 10,
    kcal: 150,
    co2Label: 'grün',
    titleMarketing: '',
    subtitle: '',
    tipsShopping: ['abc'],
    tipsCooking: ['abc']
  }, 'snack'));
});
