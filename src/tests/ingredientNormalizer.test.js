import test from 'node:test';
import assert from 'node:assert/strict';
import { canonicalIngredientName, canonicalToken, normalizeIngredient, harmonizeIngredients, harmonizeIngredientCandidates, harmonizeRetailerIngredientMap, ingredientCategory, normalizeIngredientMapping } from '../services/ingredientNormalizer.js';

test('normalizeIngredient maps common aliases to canonical forms', () => {
  const a = normalizeIngredient('Bio Kicher-Erbsen 500g');
  const b = normalizeIngredient('Pouletbrustfilet Aktion');
  const c = normalizeIngredient('Hafer Flocken');

  assert.equal(a?.canonical, 'Kichererbsen');
  assert.equal(b?.canonical, 'Pouletbrust');
  assert.equal(c?.canonical, 'Haferflocken');
});

test('normalizeIngredient filters navigation noise', () => {
  const a = normalizeIngredient('Jetzt anmelden');
  const b = normalizeIngredient('Datenschutz');
  assert.equal(a, null);
  assert.equal(b, null);
});

test('harmonizeIngredients deduplicates by canonical key', () => {
  const rows = ['Kicher-Erbsen', 'Kichererbsen', 'Bio Kichererbsen 1kg', 'Tomaten'];
  const out = harmonizeIngredients(rows);
  const chickpeas = out.find(x => x.canonical === 'Kichererbsen');

  assert.ok(chickpeas);
  assert.ok(chickpeas.mentions >= 3);
});

test('normalizeIngredient handles unit cleanup + taxonomy harmonization', () => {
  const a = normalizeIngredient('2 x 500g Pouletbrustfilet');
  const b = normalizeIngredient('zucchetti frisch');
  const c = normalizeIngredient('Paprika Bio Aktion');

  assert.equal(a?.canonical, 'Pouletbrust');
  assert.equal(b?.canonical, 'Zucchini');
  assert.equal(c?.canonical, 'Peperoni');
});

test('canonical token harmonizes retailer synonyms for matching layer', () => {
  assert.equal(canonicalToken('Paprika'), 'peperoni');
  assert.equal(canonicalToken('Zucchetti'), 'zucchini');
  assert.equal(canonicalToken('Hähnchen'), 'pouletbrust');
});

test('ingredient taxonomy maps canonical values consistently', () => {
  assert.equal(ingredientCategory('Lachs'), 'proteins');
  assert.equal(ingredientCategory('Kartoffeln'), 'carbs');
  assert.equal(ingredientCategory('Brokkoli'), 'produce');
});

test('normalizer handles mixed retailer labels and delimiter-heavy text', () => {
  const a = normalizeIngredient('Skyr Nature, Aktion');
  const b = normalizeIngredient('Paprika/Bio Mix');
  const c = normalizeIngredient('Rinds Hack 2 x 500g');

  assert.equal(a?.canonical, 'Skyr');
  assert.equal(b?.canonical, 'Peperoni');
  assert.equal(c?.canonical, 'Rindfleisch');
});

test('harmonizeIngredientCandidates keeps source tags for stronger fallback ranking', () => {
  const out = harmonizeIngredientCandidates([
    { value: 'Bio Brokkoli 500g', sourceTag: 'selector:article h2' },
    { value: 'Brokkoli', sourceTag: 'attr:data' },
    { value: 'Brokkoli', sourceTag: 'application/ld+json' },
    { value: 'Angebote dieser Woche', sourceTag: 'selector:h2' }
  ]);

  const broccoli = out.find(x => x.canonical === 'Brokkoli');
  assert.ok(broccoli);
  assert.equal(broccoli.mentions, 3);
  assert.ok(broccoli.sourceTags.includes('application/ld+json'));
  assert.ok(broccoli.sourceTags.includes('attr:data'));
});

test('normalizeIngredient cleans retail labels, prices and unit clutter', () => {
  const a = normalizeIngredient('Top Deal CHF 5.95 · Pouletbrustfilet 2 x 250g');
  const b = normalizeIngredient('Wochenhit: Kefir Nature 500ml');
  const c = normalizeIngredient('Courgette Bio 1kg');

  assert.equal(a?.canonical, 'Pouletbrust');
  assert.equal(b?.canonical, 'Naturjoghurt');
  assert.equal(c?.canonical, 'Zucchini');
});

test('normalizeIngredient harmonizes swiss retailer aliases to canonical ingredient names', () => {
  const a = normalizeIngredient('Rindshack 3er Pack 450g');
  const b = normalizeIngredient('Cherrytomaten Bio');
  const c = normalizeIngredient('Blattspinat frisch');

  assert.equal(a?.canonical, 'Rindfleisch');
  assert.equal(b?.canonical, 'Tomaten');
  assert.equal(c?.canonical, 'Spinat');
});

test('canonicalIngredientName returns null for noise and canonical for valid labels', () => {
  assert.equal(canonicalIngredientName('Datenschutz und Cookie'), null);
  assert.equal(canonicalIngredientName('2 x 500g Lachsfilet Aktion'), 'Lachs');
});

test('harmonizeRetailerIngredientMap builds cross-retailer canonical view', () => {
  const mapped = harmonizeRetailerIngredientMap({
    migros: [{ item: 'Paprika Bio' }, { item: 'Rinds Hack 2 x 500g' }],
    coop: [{ item: 'Peperoni rot' }, { item: 'Rindfleisch' }],
    lidl: [{ item: 'Lachsfilet' }]
  });

  assert.equal(mapped.Peperoni.mentions, 2);
  assert.deepEqual(mapped.Peperoni.retailers, ['coop', 'migros']);
  assert.equal(mapped.Rindfleisch.mentions, 2);
  assert.equal(mapped.Lachs.taxonomy, 'proteins');
});

test('normalizeIngredient removes retailer brand labels and keeps canonical food item', () => {
  const a = normalizeIngredient('M-Classic Poulet Filetstreifen 2x200g');
  const b = normalizeIngredient('Naturaplan Cherrytomaten 500g');
  const c = normalizeIngredient('Milbona Skyr Nature 450g');

  assert.equal(a?.canonical, 'Pouletbrust');
  assert.equal(b?.canonical, 'Tomaten');
  assert.equal(c?.canonical, 'Skyr');
});

test('normalizeIngredient strips retailer/site noise phrases before canonical mapping', () => {
  const a = normalizeIngredient('Migros Suisse Wochenhit: Griechischer Joghurt 500g');
  const b = normalizeIngredient('Coop Schweiz TopDeal Thunfisch in Wasser 2x160g');

  assert.equal(a?.canonical, 'Naturjoghurt');
  assert.equal(b?.canonical, 'Thunfisch');
});

test('normalizeIngredient maps menu-supporting extras consistently', () => {
  assert.equal(normalizeIngredient('Vollkorntoast 1 Pack')?.canonical, 'Brot');
  assert.equal(normalizeIngredient('Avocados 2er')?.canonical, 'Avocado');
  assert.equal(normalizeIngredient('Maiskörner Dose')?.canonical, 'Mais');
});

test('normalizeIngredientMapping creates canonical alias map for cross-retailer labels', () => {
  const mapped = normalizeIngredientMapping([
    { item: 'Paprika Bio' },
    { item: 'Peperoni rot' },
    { item: 'Rinds Hack 2 x 500g' },
    { item: 'Rindfleisch' }
  ]);

  const pepperoni = mapped.find(x => x.canonical === 'Peperoni');
  const beef = mapped.find(x => x.canonical === 'Rindfleisch');

  assert.ok(pepperoni);
  assert.ok(beef);
  assert.equal(pepperoni.mentions, 2);
  assert.equal(beef.mentions, 2);
  assert.equal(Array.isArray(pepperoni.aliases), true);
});
