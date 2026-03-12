import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createDailyMenu } from '../services/menuPlanner.js';

migrate();

function resetPlanningState(day) {
  db.prepare('DELETE FROM recipes').run();
  db.prepare('DELETE FROM menus').run();
  db.prepare('DELETE FROM clustered_offers WHERE day = ?').run(day);
}

test('menu planner prefers dishes that match clustered offers', () => {
  const day = '2026-03-13';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'abendessen', 0, 'Lachs', 'migros');
  insert.run(day, 'abendessen', 0, 'Kartoffeln', 'migros');
  insert.run(day, 'abendessen', 1, 'Brokkoli', 'migros');

  const menu = createDailyMenu(day);
  assert.match(menu.omni_lunch.toLowerCase(), /lachs|forelle|thunfisch/);
});

test('menu planner matches harmonized synonym offers to recipe keywords', () => {
  const day = '2026-03-14';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'mittagessen', 0, 'Paprika', 'aldi');
  insert.run(day, 'mittagessen', 0, 'Rinds', 'coop');
  insert.run(day, 'mittagessen', 0, 'Reis', 'coop');

  const menu = createDailyMenu(day);
  assert.match(menu.omni_lunch.toLowerCase(), /rind/);
});

test('menu planner prioritizes fish dish when fish+veg offers dominate', () => {
  const day = '2026-03-15';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'abendessen', 0, 'Lachs', 'lidl');
  insert.run(day, 'abendessen', 0, 'Brokkoli', 'lidl');
  insert.run(day, 'abendessen', 0, 'Kartoffeln', 'lidl');

  const menu = createDailyMenu(day);
  assert.match(menu.omni_lunch.toLowerCase(), /lachs|forelle|thunfisch/);
});

test('menu planner uses slot+vegan signals to choose offer-aligned vegan lunch', () => {
  const day = '2026-03-16';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'mittagessen', 1, 'Kichererbsen', 'migros');
  insert.run(day, 'mittagessen', 1, 'Reis', 'migros');
  insert.run(day, 'mittagessen', 1, 'Spinat', 'coop');

  const menu = createDailyMenu(day);
  assert.match(menu.vegan_lunch.toLowerCase(), /kichererbsen|curry|dal/);
});

test('menu planner favors high keyword coverage from harmonized omni offers', () => {
  const day = '2026-03-17';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'mittagessen', 0, 'Pouletbrust', 'coop');
  insert.run(day, 'mittagessen', 0, 'Quinoa', 'coop');
  insert.run(day, 'mittagessen', 0, 'Gurken', 'migros');
  insert.run(day, 'mittagessen', 0, 'Tomaten', 'migros');

  const menu = createDailyMenu(day);
  assert.match(menu.omni_lunch.toLowerCase(), /poulet|huhn|quinoa/);
});

test('menu planner aligns vegan dinner with cross-retailer harmonized offers', () => {
  const day = '2026-03-18';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'abendessen', 1, 'Tofu', 'migros');
  insert.run(day, 'abendessen', 1, 'Süsskartoffeln', 'coop');
  insert.run(day, 'abendessen', 1, 'Brokkoli', 'lidl');

  const menu = createDailyMenu(day);
  assert.match(menu.vegan_dinner.toLowerCase(), /tofu|süsskartoffel|suesskartoffel/);
});

test('menu planner normalizes raw offer labels before scoring dishes', () => {
  const day = '2026-03-19';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'mittagessen', 0, 'Rinds Hack 2 x 500g', 'coop');
  insert.run(day, 'mittagessen', 0, 'Paprika Bio', 'aldi');
  insert.run(day, 'mittagessen', 0, 'Reis', 'migros');

  const menu = createDailyMenu(day);
  assert.match(menu.omni_lunch.toLowerCase(), /rind/);
});

test('menu planner maps retailer-style fish labels to canonical dish matching', () => {
  const day = '2026-03-20';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'abendessen', 0, 'Thunfischchunks 2x160g', 'lidl');
  insert.run(day, 'abendessen', 0, 'Tomaten', 'migros');
  insert.run(day, 'abendessen', 0, 'Vollkornpasta', 'coop');

  const menu = createDailyMenu(day);
  assert.match(menu.omni_dinner.toLowerCase(), /thunfisch|fisch/);
});

test('menu planner uses slot-specific offer index to avoid lunch/dinner mismatch', () => {
  const day = '2026-03-21';
  resetPlanningState(day);

  const insert = db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)');
  insert.run(day, 'mittagessen', 0, 'Pouletbrust', 'coop');
  insert.run(day, 'mittagessen', 0, 'Quinoa', 'migros');
  insert.run(day, 'mittagessen', 0, 'Gurken', 'migros');
  insert.run(day, 'mittagessen', 0, 'Tomaten', 'aldi');
  insert.run(day, 'abendessen', 0, 'Forellenfilet', 'lidl');
  insert.run(day, 'abendessen', 0, 'Kartoffeln', 'lidl');
  insert.run(day, 'abendessen', 0, 'Zucchini', 'lidl');

  const menu = createDailyMenu(day);
  assert.match(menu.omni_lunch.toLowerCase(), /poulet|quinoa|salat/);
  assert.match(menu.omni_dinner.toLowerCase(), /forelle|lachs|thunfisch/);
});
