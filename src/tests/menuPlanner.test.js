import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createDailyMenu } from '../services/menuPlanner.js';

migrate();

function resetPlanningData() {
  db.prepare('DELETE FROM clustered_offers').run();
  db.prepare('DELETE FROM menus').run();
}

function seedOffer(day, category, vegan, item, retailer = 'migros') {
  db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)')
    .run(day, category, vegan, item, retailer);
}

function seedMenu(day, overrides = {}) {
  const payload = {
    vegan_breakfast: 'Protein-Porridge mit Beeren',
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
}

test('createDailyMenu returns vegan + omni menu with co2 score', () => {
  resetPlanningData();
  const day = '2026-03-11';
  const menu = createDailyMenu(day);
  assert.ok(menu.vegan_breakfast);
  assert.ok(menu.omni_dinner);
  assert.equal(typeof menu.co2_score, 'number');
});

test('menu unique per day', () => {
  resetPlanningData();
  const day = '2026-03-12';
  createDailyMenu(day);
  createDailyMenu(day);
  const rows = db.prepare('SELECT * FROM menus WHERE day = ?').all(day);
  assert.equal(rows.length, 1);
});

test('omni lunch/dinner avoids mixed land-meat proteins in one day (e.g., rind + poulet)', () => {
  resetPlanningData();
  const day = '2026-03-13';

  // Strong lunch signal for beef
  seedOffer(day, 'mittagessen', 0, 'Rindfleisch', 'migros');
  seedOffer(day, 'mittagessen', 0, 'Vollkornreis', 'coop');
  seedOffer(day, 'mittagessen', 0, 'Peperoni', 'lidl');
  // Dinner pressure on poultry
  seedOffer(day, 'abendessen', 0, 'Pouletbrust', 'migros');
  seedOffer(day, 'abendessen', 0, 'Bohnen', 'coop');
  seedOffer(day, 'abendessen', 0, 'Tomaten', 'aldi');

  const menu = createDailyMenu(day);
  const lunch = menu.omni_lunch.toLowerCase();
  const dinner = menu.omni_dinner.toLowerCase();

  assert.equal(/rind/.test(lunch), true);
  assert.equal(/rind/.test(lunch) && /poulet|huhn/.test(dinner), false);
});

test('exact same omni dinner is avoided within 10-day window', () => {
  resetPlanningData();

  seedMenu('2026-02-20', { omni_dinner: 'Protein-Pasta mit Thunfisch' });
  seedMenu('2026-02-22', { omni_dinner: 'Protein-Pasta mit Thunfisch' });
  seedMenu('2026-02-25', { omni_dinner: 'Protein-Pasta mit Thunfisch' });

  const day = '2026-03-01';
  seedOffer(day, 'abendessen', 0, 'Vollkornpasta', 'migros');
  seedOffer(day, 'abendessen', 0, 'Thunfisch', 'coop');
  seedOffer(day, 'abendessen', 0, 'Tomaten', 'lidl');

  const menu = createDailyMenu(day);
  assert.notEqual(menu.omni_dinner, 'Protein-Pasta mit Thunfisch');
});

test('omni pasta dinners are throttled (not every second day)', () => {
  resetPlanningData();

  const base = new Date(Date.UTC(2026, 2, 1));
  const pastaDays = [];

  for (let i = 0; i < 14; i += 1) {
    const day = new Date(base.getTime() + (i * 86400000)).toISOString().slice(0, 10);

    seedOffer(day, 'abendessen', 0, 'Vollkornpasta', 'migros');
    seedOffer(day, 'abendessen', 0, 'Thunfisch', 'coop');
    seedOffer(day, 'abendessen', 0, 'Tomaten', 'aldi');

    const menu = createDailyMenu(day);
    if (menu.omni_dinner.toLowerCase().includes('pasta')) pastaDays.push(day);
  }

  for (let i = 1; i < pastaDays.length; i += 1) {
    const prev = new Date(`${pastaDays[i - 1]}T00:00:00Z`);
    const next = new Date(`${pastaDays[i]}T00:00:00Z`);
    const gap = Math.round((next.getTime() - prev.getTime()) / 86400000);
    assert.ok(gap >= 3, `pasta cadence too dense: ${pastaDays[i - 1]} -> ${pastaDays[i]}`);
  }
});
