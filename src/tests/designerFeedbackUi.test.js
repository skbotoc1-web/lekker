import test from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createServer } from '../web/server.js';

migrate();

function resetData() {
  db.prepare('DELETE FROM approvals').run();
  db.prepare('DELETE FROM recipes').run();
  db.prepare('DELETE FROM menus').run();
}

function insertMenu(day, status = 'draft') {
  db.prepare(`
    INSERT INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, status, created_at
    ) VALUES (?, 'VB', 'VL', 'VD', 'VS', 'VG', 'OB', 'OL', 'OD', 'OS', 'OG', 1.9, ?, ?)
  `).run(day, status, new Date().toISOString());

  return db.prepare('SELECT id FROM menus WHERE day=?').get(day).id;
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

test('incomplete menu page shows draft hint + gated actions', async () => {
  resetData();
  const day = '2099-12-20';
  insertMenu(day, 'draft');

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/menue/${day}`);
    const html = await res.text();

    assert.equal(res.status, 200);
    assert.equal(html.includes('Dieses Menü ist ein Entwurf. Einzelne Rezepte können noch fehlen.'), true);
    assert.equal(html.includes('Rezept folgt'), true);
    assert.equal(html.includes('Archiv ansehen'), true);
    assert.equal(html.includes('Später erneut laden'), true);
    assert.equal(html.includes(`/rezept/vegan/${day}/fruehstueck`), false);
  });
});

test('recipe detail for missing recipe renders recovery error card', async () => {
  resetData();
  const day = '2099-12-21';
  insertMenu(day, 'draft');

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/rezept/vegan/${day}/fruehstueck`);
    const html = await res.text();

    assert.equal(res.status, 404);
    assert.equal(html.includes('Dieses Rezept ist noch nicht verfügbar'), true);
    assert.equal(html.includes(`href='/menue/${day}'`), true);
    assert.equal(html.includes("href='/menue'"), true);
  });
});

test('menu links separate vegan/non-vegan recipe targets with distinct ids', async () => {
  resetData();
  const day = '2099-12-23';
  const menuId = insertMenu(day, 'draft');

  const stmt = db.prepare('INSERT INTO recipes (menu_id, option_type, meal_slot, title, ingredients, steps, meta) VALUES (?, ?, ?, ?, ?, ?, ?)');
  stmt.run(menuId, 'vegan', 'fruehstueck', 'Tofu-Rührei mit Vollkorntoast', '[]', '[]', JSON.stringify({ titleMarketing: 'Veganes Frühstück' }));
  stmt.run(menuId, 'omni', 'fruehstueck', 'Eiermuffins mit Spinat', '[]', '[]', JSON.stringify({ titleMarketing: 'Nicht-veganes Frühstück' }));

  await withServer(async (baseUrl) => {
    const menuRes = await fetch(`${baseUrl}/menue/${day}`);
    const html = await menuRes.text();

    const veganHref = html.match(new RegExp(`/rezept/vegan/${day}/fruehstueck\\?rid=\\d+`))?.[0];
    const omniHref = html.match(new RegExp(`/rezept/omni/${day}/fruehstueck\\?rid=\\d+`))?.[0];

    assert.equal(menuRes.status, 200);
    assert.ok(veganHref);
    assert.ok(omniHref);
    assert.notEqual(veganHref, omniHref);
    assert.equal(html.includes('Veganes Rezept'), true);
    assert.equal(html.includes('Nicht-veganes Rezept'), true);

    const veganPage = await (await fetch(`${baseUrl}${veganHref}`)).text();
    const omniPage = await (await fetch(`${baseUrl}${omniHref}`)).text();

    assert.equal(veganPage.includes('Vegan · Frühstück'), true);
    assert.equal(omniPage.includes('Nicht-vegan · Frühstück'), true);
  });
});

test('layout exposes skip-link for keyboard navigation', async () => {
  resetData();
  insertMenu('2099-12-22', 'published');

  await withServer(async (baseUrl) => {
    const res = await fetch(`${baseUrl}/`);
    const html = await res.text();

    assert.equal(res.status, 200);
    assert.equal(html.includes('class="skip-link"'), true);
    assert.equal(html.includes('href="#main-content"'), true);
  });
});
