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
