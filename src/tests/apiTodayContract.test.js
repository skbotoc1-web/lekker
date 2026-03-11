import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createServer } from '../web/server.js';
import { EXPECTED_RECIPE_PAIRS } from '../repositories/recipeRepository.js';
import { getTodayDayString } from '../repositories/menuRepository.js';

migrate();

function insertTodayMenu(status = 'draft') {
  const today = getTodayDayString();
  db.prepare('DELETE FROM recipes WHERE menu_id IN (SELECT id FROM menus WHERE day=?)').run(today);
  db.prepare('DELETE FROM menus WHERE day=?').run(today);

  db.prepare(`
    INSERT INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, status, created_at
    ) VALUES (?, 'VB', 'VL', 'VD', 'VS', 'VG', 'OB', 'OL', 'OD', 'OS', 'OG', 1.7, ?, ?)
  `).run(today, status, new Date().toISOString());

  return db.prepare('SELECT id FROM menus WHERE day=?').get(today).id;
}

async function withServer(fn) {
  const app = createServer();
  const server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const port = server.address().port;

  try {
    await fn(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise(resolve => server.close(resolve));
  }
}

test('api/menu/today returns 409 preparing when today is incomplete', async () => {
  insertTodayMenu('draft');

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/menu/today`);
    const json = await res.json();

    assert.equal(res.status, 409);
    assert.equal(json.state, 'preparing');
  });
});

test('api/menu/today returns ready payload when today is complete', async () => {
  const menuId = insertTodayMenu('published');
  const stmt = db.prepare('INSERT INTO recipes (menu_id, option_type, meal_slot, title, ingredients, steps, meta) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const [option, slot] of EXPECTED_RECIPE_PAIRS) {
    stmt.run(menuId, option, slot, `${option}-${slot}`, '[]', '[]', '{}');
  }

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/api/menu/today`);
    const json = await res.json();

    assert.equal(res.status, 200);
    assert.equal(json.state, 'ready');
    assert.equal(json.menu.day, getTodayDayString());
    assert.equal(Array.isArray(json.recipes), true);
    assert.equal(json.recipes.length, 10);
  });
});
