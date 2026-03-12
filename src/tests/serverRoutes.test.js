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
  db.prepare('DELETE FROM approvals').run();
  db.prepare('DELETE FROM approvals').run();
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

test('api status returns contract fields', async () => {
  const res = await fetch(`${baseUrl}/api/status`);
  assert.equal(res.status, 200);
  const json = await res.json();
  assert.equal(typeof json.ok, 'boolean');
  assert.equal(typeof json.generatedAt, 'string');
  assert.equal(typeof json.runHealth?.sampleSize, 'number');
  assert.equal(Array.isArray(json.latestRuns), true);
});

test('intent landing page and exports are available', async () => {
  const a = await fetch(`${baseUrl}/was-koche-ich-heute-schweiz`);
  assert.equal(a.status, 200);
  const html = await a.text();
  assert.equal(html.includes('Intent-Cluster'), true);
  assert.equal(html.includes('FAQPage'), true);
  assert.equal(html.includes('ItemList'), true);
  assert.equal(html.includes('BreadcrumbList'), true);

  const b = await fetch(`${baseUrl}/wochenplan/print`);
  assert.equal(b.status, 200);
  const txt = await b.text();
  assert.equal(txt.includes('Einkaufsliste'), true);

  const c = await fetch(`${baseUrl}/wochenplan/export.csv`);
  assert.equal(c.status, 200);
  const csv = await c.text();
  assert.equal(csv.includes('section;key;value'), true);

  const d = await fetch(`${baseUrl}/kategorie/schnell`);
  assert.equal(d.status, 200);
});

test('status page shows retailer food table grouped by retailer', async () => {
  const day = '2099-12-31';
  db.prepare('DELETE FROM clustered_offers').run();
  db.prepare('DELETE FROM offers').run();

  db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)').run(day, 'mittagessen', 0, 'Rindfleisch', 'coop');
  db.prepare('INSERT INTO clustered_offers (day, category, vegan, item, source_retailer) VALUES (?, ?, ?, ?, ?)').run(day, 'mittagessen', 1, 'Tofu', 'migros');
  db.prepare('INSERT INTO offers (retailer, item, price, crawled_at) VALUES (?, ?, ?, ?)').run('coop', 'Rindfleisch', 'n/a', new Date().toISOString());

  const res = await fetch(`${baseUrl}/status`);
  assert.equal(res.status, 200);
  const html = await res.text();

  assert.equal(html.includes('Ermittelte Lebensmittel je Händler'), true);
  assert.equal(html.includes('Migros'), true);
  assert.equal(html.includes('Coop'), true);
  assert.equal(html.includes('Rindfleisch'), true);
  assert.equal(html.includes('Lebensmittel neu von Händler-Webseiten fetchen'), true);
});

test('status refetch endpoint can trigger menu stage via form post', async () => {
  const before = db.prepare('SELECT COUNT(*) as c FROM pipeline_runs').get().c;

  const form = new URLSearchParams({ mode: 'menu' });
  if (process.env.HOOK_TOKEN) form.set('token', process.env.HOOK_TOKEN);

  const res = await fetch(`${baseUrl}/status/refetch-offers`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: form,
    redirect: 'manual'
  });

  assert.equal(res.status, 303);
  const location = res.headers.get('location') || '';
  assert.equal(location.startsWith('/status?ok=1'), true);

  const after = db.prepare('SELECT COUNT(*) as c FROM pipeline_runs').get().c;
  assert.equal(after, before + 1);

  const latest = db.prepare('SELECT stage, ok FROM pipeline_runs ORDER BY id DESC LIMIT 1').get();
  assert.equal(latest.stage, 'menu');
  assert.equal(latest.ok, 1);
});
