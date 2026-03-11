import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createDailyMenu } from '../services/menuPlanner.js';

migrate();

test('createDailyMenu returns vegan + omni menu with co2 score', () => {
  const day = '2026-03-11';
  const menu = createDailyMenu(day);
  assert.ok(menu.vegan_breakfast);
  assert.ok(menu.omni_dinner);
  assert.equal(typeof menu.co2_score, 'number');
});

test('menu unique per day', () => {
  const day = '2026-03-12';
  createDailyMenu(day);
  createDailyMenu(day);
  const rows = db.prepare('SELECT * FROM menus WHERE day = ?').all(day);
  assert.equal(rows.length, 1);
});
