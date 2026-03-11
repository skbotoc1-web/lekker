import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createServer } from '../web/server.js';
import { EXPECTED_RECIPE_PAIRS } from '../repositories/recipeRepository.js';
import { getTodayDayString } from '../repositories/menuRepository.js';

migrate();

function insertMenu(day, status = 'draft') {
  db.prepare(`
    INSERT OR REPLACE INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, status, created_at
    ) VALUES (?, 'VB', 'VL', 'VD', 'VS', 'VG', 'OB', 'OL', 'OD', 'OS', 'OG', 1.8, ?, ?)
  `).run(day, status, new Date().toISOString());

  return db.prepare('SELECT id FROM menus WHERE day=?').get(day).id;
}

function insertCompleteSet(menuId) {
  const stmt = db.prepare('INSERT INTO recipes (menu_id, option_type, meal_slot, title, ingredients, steps, meta) VALUES (?, ?, ?, ?, ?, ?, ?)');
  for (const [option, slot] of EXPECTED_RECIPE_PAIRS) {
    stmt.run(menuId, option, slot, `${option}-${slot}`, '[]', '[]', '{}');
  }
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

test('homepage falls back to previous complete menu when today is incomplete', async () => {
  const today = getTodayDayString();
  const prevDate = new Date(`${today}T00:00:00Z`);
  prevDate.setUTCDate(prevDate.getUTCDate() - 1);
  const previous = prevDate.toISOString().slice(0, 10);

  db.prepare('DELETE FROM recipes').run();
  db.prepare('DELETE FROM menus').run();

  const prevMenuId = insertMenu(previous, 'published');
  insertCompleteSet(prevMenuId);
  insertMenu(today, 'draft');

  await withServer(async (baseUrl) => {
    const html = await (await fetch(`${baseUrl}/`)).text();

    assert.ok(html.includes(previous));
    assert.ok(!html.includes(`/rezept/vegan/${today}/fruehstueck`));
  });
});
