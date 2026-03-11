import test from 'node:test';
import assert from 'node:assert/strict';
import { parseRetailerHtml } from '../services/retailerCrawler.js';

const sampleHtml = `
<html>
  <body>
    <nav>Jetzt anmelden · Datenschutz · Angebote</nav>
    <article><h2>Bio Kicher-Erbsen 500g</h2></article>
    <article><h3>Pouletbrustfilet Aktion</h3></article>
    <article><h3>Hafer Flocken</h3></article>
    <article><h3>Brokkoli</h3></article>
    <article><h3>Skyr nature</h3></article>
    <article><h3>Lachsfilet</h3></article>
    <article><h3>Tomaten</h3></article>
    <article><h3>Kartoffeln</h3></article>
    <article><h3>Spinat</h3></article>
    <article><h3>Äpfel</h3></article>
    <article><h3>Nüsse Mix</h3></article>
  </body>
</html>
`;

test('parseRetailerHtml returns normalized ingredient list with min 10 items', () => {
  const out = parseRetailerHtml(sampleHtml, 'migros');
  assert.ok(Array.isArray(out));
  assert.equal(out.length, 10);

  const names = out.map(x => x.item);
  assert.ok(names.includes('Kichererbsen'));
  assert.ok(names.includes('Pouletbrust'));
  assert.ok(names.includes('Haferflocken'));
});
