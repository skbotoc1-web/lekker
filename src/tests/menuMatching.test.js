import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createDailyMenu } from '../services/menuPlanner.js';

migrate();

test('menu planner prefers dishes that match clustered offers', () => {
  const day = '2026-03-13';

  db.prepare('DELETE FROM clustered_offers WHERE day = ?').run(day);
  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'abendessen', 0, 'Lachs', 'migros');
  insert.run(day, 'abendessen', 0, 'Kartoffeln', 'migros');
  insert.run(day, 'abendessen', 1, 'Brokkoli', 'migros');

  const menu = createDailyMenu(day);
  assert.equal(menu.omni_lunch, 'Lachs mit Kartoffeln und Gemüse');
});
