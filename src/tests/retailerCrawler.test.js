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

test('fallback strategy keeps parsed signals and fills remainder up to 10', () => {
  const sparseHtml = '<article><h2>Bio Brokkoli 500g</h2></article>';
  const out = parseRetailerHtml(sparseHtml, 'coop');
  assert.equal(out.length, 10);
  assert.equal(out[0].item, 'Brokkoli');
  assert.equal(out.some(x => x.source === 'fallback'), true);
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

test('json-ld offers are considered as extraction fallback', () => {
  const html = `
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"name":"Paprika Bio"},{"name":"Lachsfilet"}]}
    </script>
  `;
  const out = parseRetailerHtml(html, 'lidl').map(x => x.item);
  assert.equal(out.includes('Peperoni'), true);
  assert.equal(out.includes('Lachs'), true);
});

test('__NEXT_DATA__ json extraction works as fallback for modern retailer pages', () => {
  const html = `
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"products":[{"name":"Zucchetti frisch"},{"name":"Rinds Hack 2 x 500g"}]}}}
    </script>
  `;
  const out = parseRetailerHtml(html, 'aldi').map(x => x.item);
  assert.equal(out.includes('Zucchini'), true);
  assert.equal(out.includes('Rindfleisch'), true);
});

test('retailer parser removes heading noise and still keeps strong ingredient hits', () => {
  const html = `
    <h2>Angebote dieser Woche</h2>
    <h2>Angebote dieser Woche</h2>
    <article><h3>Bio Brokkoli 500g</h3></article>
    <article><h3>Bio Brokkoli 500g</h3></article>
    <article><h3>Rinds Hack 2 x 500g</h3></article>
  `;
  const out = parseRetailerHtml(html, 'coop');
  const items = out.map(x => x.item);
  assert.equal(items.includes('Brokkoli'), true);
  assert.equal(items.includes('Rindfleisch'), true);
  assert.equal(items.includes('Angebote dieser Woche'), false);
});

test('scraper output contract is stable for all retailers', () => {
  const ids = ['migros', 'coop', 'aldi', 'lidl'];
  for (const id of ids) {
    const out = parseRetailerHtml(sampleHtml, id);
    assert.equal(out.length, 10);
    for (const row of out) {
      assert.equal(typeof row.item, 'string');
      assert.equal(typeof row.source, 'string');
      assert.ok(row.confidence >= 0 && row.confidence <= 1);
    }
  }
});

test('retailer parser prefers stronger JSON source and removes duplicate noise', () => {
  const html = `
    <article><h2>Paprika Bio</h2></article>
    <article><h2>Paprika Bio</h2></article>
    <script id="__NEXT_DATA__" type="application/json">
      {"props":{"pageProps":{"products":[{"name":"Paprika Bio"},{"name":"Bio Brokkoli"}]}}}
    </script>
    <script type="application/ld+json">
      {"@context":"https://schema.org","@type":"ItemList","itemListElement":[{"name":"Paprika Bio"}]}
    </script>
  `;

  const out = parseRetailerHtml(html, 'migros');
  const items = out.map(x => x.item);
  assert.equal(items.includes('Peperoni'), true);
  assert.equal(items.includes('Brokkoli'), true);

  const pepperoniRows = out.filter(x => x.item === 'Peperoni');
  assert.equal(pepperoniRows.length, 1);
});

test('retailer parser uses retailer link-hints as fallback extraction path', () => {
  const html = `
    <a href="/de/produkte/gemuese/cherrytomaten" title="Cherrytomaten Bio 250g">zum produkt</a>
    <a href="/de/produkte/fisch/lachsfilet" aria-label="Lachsfilet frisch">fisch</a>
  `;

  const out = parseRetailerHtml(html, 'coop').map(x => x.item);
  assert.equal(out.includes('Tomaten'), true);
  assert.equal(out.includes('Lachs'), true);
});

test('retailer parser also uses image alt and button aria labels as weak fallback', () => {
  const html = `
    <img alt="Bio Brokkoli 500g" />
    <button aria-label="Rinds Hack 2 x 500g"></button>
  `;

  const out = parseRetailerHtml(html, 'migros');
  const items = out.map(x => x.item);
  assert.equal(items.includes('Brokkoli'), true);
  assert.equal(items.includes('Rindfleisch'), true);
  assert.equal(new Set(items).size, out.length);
  assert.equal(out.length, 10);
});

test('retailer parser splits delimiter-heavy labels and extracts useful ingredients', () => {
  const html = `<article><h2>Paprika Bio | 500g | Aktion</h2></article><article><h2>Skyr Nature / 450g</h2></article>`;
  const out = parseRetailerHtml(html, 'coop').map(x => x.item);
  assert.equal(out.includes('Peperoni'), true);
  assert.equal(out.includes('Skyr'), true);
});

test('retailer parser can use meta title/description as final fallback source', () => {
  const html = `<meta property="og:title" content="Frische Zucchetti und Lachsfilet diese Woche" /><meta name="description" content="Top Deal Cherrytomaten" />`;
  const out = parseRetailerHtml(html, 'lidl').map(x => x.item);
  assert.equal(out.includes('Zucchini'), true);
  assert.equal(out.includes('Lachs'), true);
});
