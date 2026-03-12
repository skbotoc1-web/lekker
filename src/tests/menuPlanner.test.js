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

test('omni lunch/dinner avoids mixed land-meat proteins in one day (e.g., rind + poulet)', () => {
  const day = '2026-03-13';

  db.prepare('DELETE FROM clustered_offers WHERE day = ?').run(day);
  db.prepare('DELETE FROM menus WHERE day = ?').run(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  // Strong lunch signal for beef
  insert.run(day, 'mittagessen', 0, 'Rindfleisch', 'migros');
  insert.run(day, 'mittagessen', 0, 'Vollkornreis', 'coop');
  insert.run(day, 'mittagessen', 0, 'Peperoni', 'lidl');
  // Dinner would naturally drift to poulet without consistency rule
  insert.run(day, 'abendessen', 0, 'Pouletbrust', 'migros');
  insert.run(day, 'abendessen', 0, 'Bohnen', 'coop');
  insert.run(day, 'abendessen', 0, 'Tomaten', 'aldi');

  const menu = createDailyMenu(day);

  assert.equal(menu.omni_lunch, 'Rindstreifen mit Vollkornreis');
  assert.notEqual(menu.omni_dinner, 'Pouletpfanne mit Bohnen');
});
