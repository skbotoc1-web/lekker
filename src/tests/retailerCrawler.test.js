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

const retailerSpecificHtml = {
  migros: '<div data-testid="product-tile"><h2>Bio Brokkoli 500g</h2></div><div data-product-name="Pouletbrustfilet"></div>',
  coop: '<div class="product-teaser"><h3>Skyr Natur</h3></div><div data-qa="product"><span title="Quinoa Bio"></span></div>',
  aldi: '<div class="mod-offer" title="Zucchetti frisch"></div><article><h3>Paprika Aktion</h3></article>',
  lidl: '<div class="product-grid"><a title="Lachsfilet"></a></div><article><h2>Kartoffeln 2kg</h2></article>'
};

test('parseRetailerHtml returns normalized ingredient list with min 10 items', () => {
  const out = parseRetailerHtml(sampleHtml, 'migros');
  assert.ok(Array.isArray(out));
  assert.equal(out.length, 10);

  const names = out.map(x => x.item);
  assert.ok(names.includes('Kichererbsen'));
  assert.ok(names.includes('Pouletbrust'));
  assert.ok(names.includes('Haferflocken'));
});

test('all retailer parsers produce deduplicated top 10 offers', () => {
  const ids = ['migros', 'coop', 'aldi', 'lidl'];
  for (const id of ids) {
    const out = parseRetailerHtml(sampleHtml, id);
    assert.equal(out.length, 10);
    const uniq = new Set(out.map(x => x.item));
    assert.equal(uniq.size, out.length);
  }
});

test('retailer-specific selector heuristics map to canonical ingredients', () => {
  const expectations = {
    migros: ['Brokkoli', 'Pouletbrust'],
    coop: ['Skyr', 'Quinoa'],
    aldi: ['Zucchini', 'Peperoni'],
    lidl: ['Lachs', 'Kartoffeln']
  };

  for (const [retailer, html] of Object.entries(retailerSpecificHtml)) {
    const out = parseRetailerHtml(html, retailer).map(x => x.item);
    for (const expected of expectations[retailer]) {
      assert.ok(out.includes(expected), `${retailer} missing ${expected}`);
    }
  }
});
