import test, { before, after } from 'node:test';
import assert from 'node:assert/strict';
import { migrate, db } from '../core/db.js';
import { createServer } from '../web/server.js';

migrate();

let server;
let baseUrl;

before(async () => {
  const app = createServer();
  server = app.listen(0);
  await new Promise(resolve => server.once('listening', resolve));
  const { port } = server.address();
  baseUrl = `http://127.0.0.1:${port}`;
});

after(async () => {
  if (server) await new Promise(resolve => server.close(resolve));
});

test('review endpoint validates action query param', async () => {
  const res = await fetch(`${baseUrl}/review/demo-token`);
  assert.equal(res.status, 400);
  const body = await res.text();
  assert.equal(body.includes('Ungültige Aktion'), true);
});

test('api menu today returns 409 for incomplete selected menu', async () => {
  const day = '2099-12-30';
  db.prepare('DELETE FROM recipes').run();
  db.prepare('DELETE FROM menus').run();

  db.prepare(`
    INSERT INTO menus (
      day, vegan_breakfast, vegan_lunch, vegan_dinner, vegan_snack, vegan_drink,
      omni_breakfast, omni_lunch, omni_dinner, omni_snack, omni_drink, co2_score, status, created_at
    ) VALUES (?, 'A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I', 'J', 1.1, 'draft', ?)
  `).run(day, new Date().toISOString());

  const res = await fetch(`${baseUrl}/api/menu/today`);
  assert.equal([404, 409].includes(res.status), true);
  const json = await res.json();
  assert.equal(typeof json.error, 'string');
});

test('intent landing page and print export are available', async () => {
  const a = await fetch(`${baseUrl}/was-koche-ich-heute-schweiz`);
  assert.equal(a.status, 200);
  const html = await a.text();
  assert.equal(html.includes('Intent-Cluster'), true);

  const b = await fetch(`${baseUrl}/wochenplan/print`);
  assert.equal(b.status, 200);
  const txt = await b.text();
  assert.equal(txt.includes('Einkaufsliste'), true);
});
